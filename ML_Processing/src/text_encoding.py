"""
Model architecture, dataset, and helper utilities

Architecture
  Input text ->
  AutoTokenizer  (all-MiniLM-L6-v2 - 384-dim, 12 layers) ->
  AutoModel (transformer encoder) ->
  Mean pooling over token embeddings ->
  Linear(384 -> hidden_dim) -> ReLU -> Dropout ->
  Linear(hidden_dim -> 5) ->
  Logits (softmax applied at inference time)
"""

import os
import torch
import torch.nn as nn
import pandas as pd
from torch.utils.data import Dataset
from transformers import AutoTokenizer, AutoModel

# Constants

SBERT_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"
NUM_CLASSES = 5
EMBED_DIM = 384 # hidden size of all-MiniLM-L6-v2
LEVEL_NAMES = ["Level 1", "Level 2", "Level 3", "Level 4", "Level 5"]

# Dataset
class StressDataset(Dataset):
    """
    Loads training_data.csv and tokenises on the fly.

    CSV format (after the CSV-fix pass):
        "text","label"
        "I am overwhelmed","5"

    Labels 1-5 are shifted to 0-4 for CrossEntropyLoss.
    """

    def __init__(self, texts, labels, tokenizer, max_length=128):
        """
        Args:
            texts (list[str]) : raw sentence strings
            labels (list[int]) : stress levels 1-5
            tokenizer : HuggingFace tokenizer instance
            max_length (int) : token cap (128 is generous for short logs)
        """
        self.texts = list(texts)
        self.labels = [int(l) - 1 for l in labels]   # shift 1-5 → 0-4
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        encoding = self.tokenizer(
            self.texts[idx],
            padding="max_length",
            truncation=True,
            max_length=self.max_length,
            return_tensors="pt",
        )
        return {
            "input_ids": encoding["input_ids"].squeeze(0), # (max_length,)
            "attention_mask": encoding["attention_mask"].squeeze(0),  # (max_length,)
            "label": torch.tensor(self.labels[idx], dtype=torch.long),
        }
# Model
class StressClassifier(nn.Module):
    """
    S-BERT encoder + lightweight classification head.

    Freezing strategy
    1. Call freeze_encoder() - all encoder params frozen, only head trains.
    2. Call unfreeze_top_layers(n) - top-n transformer layers unfrozen for
       fine-tuning
    """

    def __init__(
        self,
        model_name: str = SBERT_MODEL_NAME,
        num_classes: int = NUM_CLASSES,
        hidden_dim: int = 512,
        dropout: float = 0.3,
        attn_implementation: str = "eager",
    ):
        super().__init__()
        # "eager" is required for TorchScript-based ONNX tracing; SDPA's
        # dynamic masking code is not JIT-traceable.  For inference/export
        # the speed difference on a small model like MiniLM is negligible.
        self.encoder = AutoModel.from_pretrained(
            model_name, attn_implementation=attn_implementation
        )
        self.classifier = nn.Sequential(
            nn.Linear(EMBED_DIM, hidden_dim), # 384 -> 512
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, hidden_dim // 2),  # 512 -> 256
            nn.GELU(),
            nn.Dropout(dropout * 0.7), # slightly less aggressive on second layer
            nn.Linear(hidden_dim // 2, num_classes), # 256 -> 5
        )
    # Forward
    @staticmethod
    def _mean_pool(token_embeddings: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        """
        Mean-pool token embeddings, ignoring padding tokens.
        token_embeddings : (batch, seq_len, hidden)
        attention_mask : (batch, seq_len)
        returns : (batch, hidden)
        """
        mask = attention_mask.unsqueeze(-1).float() # (B, S, 1)
        summed = torch.sum(token_embeddings * mask, dim=1) # (B, H)
        count = torch.clamp(mask.sum(dim=1), min=1e-9) # (B, 1)
        return summed / count

    def forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
        """
        Args:
            input_ids : (batch, seq_len) - token IDs
            attention_mask : (batch, seq_len) - 1 for real tokens, 0 for padding
        Returns:
            logits : (batch, num_classes)
        """
        outputs = self.encoder(input_ids=input_ids, attention_mask=attention_mask)
        embeddings = self._mean_pool(outputs.last_hidden_state, attention_mask)
        return self.classifier(embeddings)

    # Freezing helpers
    def freeze_encoder(self):
        """Freeze all S-BERT parameters. Only the classifier head will train."""
        for param in self.encoder.parameters():
            param.requires_grad = False

    def unfreeze_top_layers(self, n: int = 3):
        """
        Unfreeze the top-n transformer encoder layers for fine-tuning.
        The bottom layers (generic syntax/grammar) stay frozen.
        """
        for layer in self.encoder.encoder.layer[-n:]:
            for param in layer.parameters():
                param.requires_grad = True

    def trainable_param_count(self) -> dict:
        """Return counts of trainable vs frozen parameters."""
        trainable = sum(p.numel() for p in self.parameters() if p.requires_grad)
        total = sum(p.numel() for p in self.parameters())
        return {"trainable": trainable, "frozen": total - trainable, "total": total}

# Data loading

def load_data(csv_path: str):
    """
    Load the fixed training CSV.

    Returns:
        texts (list[str]) : raw text strings
        labels (list[int]) : stress levels 1-5
    """
    df = pd.read_csv(csv_path)
    df["label"] = df["label"].astype(int)
    if not set(df["label"].unique()).issubset({1, 2, 3, 4, 5}):
        raise ValueError(f"Unexpected label values: {df['label'].unique()}")
    return df["text"].tolist(), df["label"].tolist()

# Device selection
def get_device() -> torch.device:
    """
    Pick the best available device.
    """
    if torch.cuda.is_available():
        device = torch.device("cuda")
        name = torch.cuda.get_device_name(0)
        vram = torch.cuda.get_device_properties(0).total_memory / 1024**3
        print(f"Device : {name} ({vram:.1f} GB VRAM)")
    else:
        device = torch.device("cpu")
        print("Device : CPU (no CUDA found)")
    return device
