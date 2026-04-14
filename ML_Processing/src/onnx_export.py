"""
Exports the trained StressClassifier to ONNX format.

The exported model takes tokenised inputs directly:
    input_ids : int64  (batch, seq_len)
    attention_mask : int64  (batch, seq_len)
    logits : float32 (batch, 5)

ONNX Runtime usage
1. Tokenize the input text
2. Feed input_ids + attention_mask to the ONNX session.
3. Argmax(logits) + 1  predicted stress level (1-5).
"""

import os
import sys
import torch
import numpy as np
import onnxruntime as ort

sys.path.insert(0, os.path.dirname(__file__))
from text_encoding import StressClassifier, get_device, SBERT_MODEL_NAME
from transformers import AutoTokenizer

# Configuration
BEST_MODEL_PATH = "models/Model_v5.pt"
ONNX_PATH = "models/Model_v5.onnx"
OPSET = 17
MAX_LENGTH = 128  # must match training config
HIDDEN_DIM = 512
DROPOUT = 0.3

# Test sentence to verify the export round-trips correctly
VERIFY_TEXT = "I haven't slept in days and I'm failing everything."


def _load_model(model_path: str) -> StressClassifier:
    """Load StressClassifier weights from disk, eval mode, on CPU."""
    model = StressClassifier(
        model_name=SBERT_MODEL_NAME,
        hidden_dim=HIDDEN_DIM,
        dropout=DROPOUT,
        attn_implementation="eager",
    )
    model.load_state_dict(torch.load(model_path, map_location="cpu"))
    model.eval()
    return model


# Export
def export(model_path: str, onnx_path: str, device: torch.device):
    print(f"\nLoading weights from: {model_path}")
    # dynamo export works directly with StressClassifier — no wrapper needed.
    # torch.export traces through transformers' dynamic dispatch cleanly.
    model = _load_model(model_path).to(device)

    tokenizer = AutoTokenizer.from_pretrained(SBERT_MODEL_NAME)

    # Dummy inputs for export (batch_size=1, seq_len=MAX_LENGTH)
    dummy = tokenizer(
        "Example input sentence for export.",
        padding="max_length",
        truncation=True,
        max_length=MAX_LENGTH,
        return_tensors="pt",
    )
    dummy_ids = dummy["input_ids"].to(device)
    dummy_mask = dummy["attention_mask"].to(device)

    os.makedirs(os.path.dirname(onnx_path), exist_ok=True)

    torch.onnx.export(
        model,
        (dummy_ids, dummy_mask),
        onnx_path,
        input_names=["input_ids", "attention_mask"],
        output_names=["logits"],
        dynamic_axes={
            "input_ids": {0: "batch_size", 1: "seq_len"},
            "attention_mask": {0: "batch_size", 1: "seq_len"},
            "logits": {0: "batch_size"},
        },
        opset_version=OPSET,
        dynamo=True,  # torch.export-based exporter; requires onnxscript
    )

    size_mb = os.path.getsize(onnx_path) / 1024**2
    print(f"Saved: {onnx_path}  ({size_mb:.1f} MB)")
    return tokenizer


# Verification
def verify(onnx_path: str, tokenizer, text: str):
    """Run the same sentence through PyTorch and ONNX Runtime and compare."""
    print(f"\nVerifying ONNX output on: '{text}'")

    # PyTorch reference
    model = _load_model(BEST_MODEL_PATH)

    encoding = tokenizer(
        text,
        padding="max_length",
        truncation=True,
        max_length=MAX_LENGTH,
        return_tensors="pt",
    )
    with torch.no_grad():
        pt_logits = model(encoding["input_ids"], encoding["attention_mask"])
    pt_pred = pt_logits.argmax(dim=-1).item() + 1

    # ONNX Runtime
    sess = ort.InferenceSession(
        onnx_path,
        providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
    )
    ort_out = sess.run(
        ["logits"],
        {
            "input_ids": encoding["input_ids"].numpy(),
            "attention_mask": encoding["attention_mask"].numpy(),
        },
    )[0]
    ort_pred = int(np.argmax(ort_out, axis=-1)[0]) + 1

    print(f"PyTorch prediction : Level {pt_pred}")
    print(f"ONNX RT prediction : Level {ort_pred}")

    max_diff = np.abs(pt_logits.numpy() - ort_out).max()
    print(f"  Max logit diff : {max_diff:.6f}")
    if max_diff < 1e-3:
        print("Export verified.")
    else:
        print("WARNING: logit diff is large - check export settings.")


def main():
    device = get_device()

    if not os.path.exists(BEST_MODEL_PATH):
        print(f"ERROR: {BEST_MODEL_PATH} not found.")
        sys.exit(1)

    tokenizer = export(BEST_MODEL_PATH, ONNX_PATH, device)
    verify(ONNX_PATH, tokenizer, VERIFY_TEXT)

    # Save tokenizer vocab alongside the model for Android
    tok_dir = "models/tokenizer"
    tokenizer.save_pretrained(tok_dir)
    print(f"\nTokenizer saved to: {tok_dir}/")
    print(f"\nDeployment files:")
    print(f" {ONNX_PATH}")
    print(f" {tok_dir}/vocab.txt")


if __name__ == "__main__":
    main()