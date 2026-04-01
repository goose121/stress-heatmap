import sys
import numpy as np
import onnxruntime as ort
from transformers import AutoTokenizer

ONNX_PATH  = "models/Model_v3.onnx"
TOK_DIR = "models/tokenizer"
MAX_LENGTH = 128

def load(onnx_path: str = ONNX_PATH, tok_dir: str = TOK_DIR):
    """Load the ONNX session and tokenizer. Call once at startup."""
    tokenizer = AutoTokenizer.from_pretrained(tok_dir)
    session = ort.InferenceSession(
        onnx_path,
        providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
    )
    return session, tokenizer


def predict(text: str, session: ort.InferenceSession, tokenizer) -> dict:
    """
    Run inference on a single string.

    Returns a dict with:
        level int) stress level 1-5
        confidence (float) softmax probability of the predicted class
        scores (list) softmax probabilities for all 5 levels
    """
    encoding = tokenizer(
        text,
        padding="max_length",
        truncation=True,
        max_length=MAX_LENGTH,
        return_tensors="np",
    )
    logits = session.run(
        ["logits"],
        {
            "input_ids": encoding["input_ids"].astype(np.int64),
            "attention_mask": encoding["attention_mask"].astype(np.int64),
        },
    )[0][0]  # shape (5,)

    # Softmax for probabilities
    exp = np.exp(logits - logits.max())
    scores = (exp / exp.sum()).tolist()

    level = int(np.argmax(scores)) + 1  # 1-indexed

    return {
        "level": level,
        "confidence":  round(scores[level - 1], 4),
        "scores": [round(s, 4) for s in scores],
    }


if __name__ == "__main__":
    text = "I have three deadlines tomorrow and I haven't started."

    session, tokenizer = load()
    result = predict(text, session, tokenizer)

    print(f"\nInput : {text}")
    print(f"Level : {result['level']} / 5")
    print(f"Confidence : {result['confidence'] * 100:.1f}%")
    print(f"All scores : { {i+1: f'{s*100:.1f}%' for i, s in enumerate(result['scores'])} }")