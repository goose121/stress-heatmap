"""
Two-stage training for the S-BERT stress classifier.

Stage 1: Frozen encoder
    Only the classification head trains. S-BERT weights are locked.
    LR: 1e-4, larger batch size okay.

Stage 2: Partial unfreeze
    Top 3 transformer layers are unfrozen alongside the head.
    Two learning-rate groups: head -> 1e-4, top layers -> 1e-5.
    Cosine annealing with linear warmup.
"""

import os
import sys
import time
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split
from torch.optim import AdamW
from torch.optim.lr_scheduler import OneCycleLR
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
from transformers import AutoTokenizer
import numpy as np

# Allow running from ML_Processing/ root
sys.path.insert(0, os.path.dirname(__file__))
from text_encoding import (
    StressClassifier, StressDataset, load_data,
    get_device, SBERT_MODEL_NAME, LEVEL_NAMES,
)

# Configuration 

CFG = {
    # Paths 
    "data_path": "data/processed/training_data.csv",
    "checkpoint_dir": "models/",
    "best_model_path": "models/Model_v5.pt",

    # Data
    "test_size": 0.15, # 15% held-out test set
    "val_size": 0.12, # 12% of remaining for validation
    "max_length": 128, # tokenizer sequence cap
    "random_seed": 42,

    # Model
    "hidden_dim": 512,
    "dropout": 0.3,

    # Stage 1 - frozen encoder, head only
    "stage1_epochs": 10,
    "stage1_lr": 1e-4,
    "stage1_batch": 64,

    # Stage 2 - top-6 layers unfrozen
    "stage2_epochs": 10,
    "stage2_lr_head": 1e-4,
    "stage2_lr_layers": 3e-5, # 10× lower than head
    "stage2_batch": 32,
    "unfreeze_n":6, # how many top layers to unfreeze

    "use_amp": True,
    "amp_dtype": torch.bfloat16,

    # Early stopping
    "patience": 4,
}

# Utilities

class EarlyStopping:
    def __init__(self, patience: int, path: str):
        self.patience  = patience
        self.path = path
        self.best_loss  = float("inf")
        self.counter = 0
        self.best_acc = 0.0

    def step(self, val_loss: float, val_acc: float, model: nn.Module) -> bool:
        """Returns True if training should stop."""
        if val_loss < self.best_loss:
            self.best_loss = val_loss
            self.best_acc = val_acc
            self.counter = 0
            torch.save(model.state_dict(), self.path)
            print(f"[checkpoint] val_acc={val_acc*100:.2f}%  saved: {self.path}")
        else:
            self.counter += 1
            print(f"[early stop] no improvement ({self.counter}/{self.patience})")
            if self.counter >= self.patience:
                return True
        return False


def format_time(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m}m {s}s"

# Train / eval loops

def run_epoch(model, loader, criterion, optimizer, scheduler, device, scaler, train: bool):
    model.train() if train else model.eval()
    total_loss, correct, n = 0.0, 0, 0

    ctx = torch.enable_grad() if train else torch.no_grad()
    with ctx:
        for batch in loader:
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["label"].to(device)

            with torch.autocast(device_type=device.type, dtype=CFG["amp_dtype"],
                                enabled=CFG["use_amp"] and device.type == "cuda"):
                logits = model(input_ids, attention_mask)
                loss = criterion(logits, labels)

            if train:
                scaler.scale(loss).backward()
                scaler.unscale_(optimizer)
                torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                scaler.step(optimizer)
                scaler.update()
                optimizer.zero_grad()
                if scheduler is not None:
                    scheduler.step()

            preds = logits.argmax(dim=-1)
            correct += (preds == labels).sum().item()
            total_loss += loss.item() * len(labels)
            n += len(labels)

    return total_loss / n, correct / n


def evaluate_final(model, loader, device):
    """Full classification report on the held-out test set."""
    model.eval()
    all_preds, all_labels = [], []
    with torch.no_grad():
        for batch in loader:
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["label"].to(device)
            logits = model(input_ids, attention_mask)
            all_preds.extend(logits.argmax(dim=-1).cpu().tolist())
            all_labels.extend(labels.cpu().tolist())

    # Shift back to 1-5 for display
    preds_display = [p + 1 for p in all_preds]
    labels_display = [l + 1 for l in all_labels]
    acc = accuracy_score(labels_display, preds_display)

    print(f"\n Overall accuracy : {acc * 100:.2f}%")
    print(classification_report(
        labels_display, preds_display,
        target_names=LEVEL_NAMES,
        digits=3,
    ))
    return acc

# Training
def train_stage(
    stage_name: str,
    model: nn.Module,
    train_loader: DataLoader,
    val_loader: DataLoader,
    optimizer,
    scheduler,
    epochs: int,
    device: torch.device,
    early_stopper: EarlyStopping,
):
    criterion = nn.CrossEntropyLoss()
    scaler = torch.amp.GradScaler("cuda", enabled=CFG["use_amp"] and device.type == "cuda")

    print(f"{stage_name}")
    counts = model.trainable_param_count()
    print(f"Trainable params : {counts['trainable']:,}  /  {counts['total']:,}")

    for epoch in range(1, epochs + 1):
        t0 = time.time()
        tr_loss, tr_acc = run_epoch(model, train_loader, criterion, optimizer,
                                    scheduler, device, scaler, train=True)
        vl_loss, vl_acc = run_epoch(model, val_loader, criterion, None,
                                    None, device, scaler, train=False)

        elapsed = format_time(time.time() - t0)
        print(f"Epoch {epoch:02d}/{epochs}  "
              f"train_loss={tr_loss:.4f} train_acc={tr_acc*100:.1f}%  |  "
              f"val_loss={vl_loss:.4f} val_acc={vl_acc*100:.1f}%  [{elapsed}]")

        if early_stopper.step(vl_loss, vl_acc, model):
            print("Early stopping triggered.")
            break

    # Restore best weights at the end of stage
    model.load_state_dict(torch.load(early_stopper.path, map_location=device))
    print(f"\n  Best val_acc: {early_stopper.best_acc*100:.2f}%  (weights restored)")

# Main

def main():
    os.makedirs(CFG["checkpoint_dir"], exist_ok=True)
    torch.manual_seed(CFG["random_seed"])

    device = get_device()
    # Data
    texts, labels = load_data(CFG["data_path"])
    print(f"Total examples : {len(texts)}")

    label_dist = {i: labels.count(i) for i in range(1, 6)}
    for lvl, cnt in label_dist.items():
        print(f"Level {lvl} : {cnt} examples")

    # Stratified split: train+val / test
    texts_tv, texts_test, labels_tv, labels_test = train_test_split(
        texts, labels, test_size=CFG["test_size"],
        stratify=labels, random_state=CFG["random_seed"],
    )
    # Stratified split: train / val
    texts_train, texts_val, labels_train, labels_val = train_test_split(
        texts_tv, labels_tv, test_size=CFG["val_size"],
        stratify=labels_tv, random_state=CFG["random_seed"],
    )
    print(f"\n Train : {len(texts_train)} | Val : {len(texts_val)} | Test : {len(texts_test)}")

    # Tokeniser + datasets
    tokenizer = AutoTokenizer.from_pretrained(SBERT_MODEL_NAME)

    train_ds = StressDataset(texts_train, labels_train, tokenizer, CFG["max_length"])
    val_ds   = StressDataset(texts_val, labels_val, tokenizer, CFG["max_length"])
    test_ds  = StressDataset(texts_test, labels_test, tokenizer, CFG["max_length"])

    # Model
    model = StressClassifier(
        model_name=SBERT_MODEL_NAME,
        hidden_dim=CFG["hidden_dim"],
        dropout=CFG["dropout"],
    ).to(device)

    early_stopper = EarlyStopping(patience=CFG["patience"], path=CFG["best_model_path"])

    # Stage 1: frozen encoder - train head only
    model.freeze_encoder()

    s1_loader = DataLoader(train_ds, batch_size=CFG["stage1_batch"],
                           shuffle=True, num_workers=2, pin_memory=True)
    val_loader = DataLoader(val_ds, batch_size=64, num_workers=2)

    optimizer_s1  = AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=CFG["stage1_lr"], weight_decay=1e-2,
    )
    scheduler_s1  = OneCycleLR(
        optimizer_s1,
        max_lr=CFG["stage1_lr"],
        steps_per_epoch=len(s1_loader),
        epochs=CFG["stage1_epochs"],
        pct_start=0.2,
    )

    train_stage(
        "Stage 1 - frozen encoder, head only",
        model, s1_loader, val_loader,
        optimizer_s1, scheduler_s1,
        CFG["stage1_epochs"], device, early_stopper,
    )

    # Stage 2: partial unfreeze - top-N layers + head
    model.unfreeze_top_layers(CFG["unfreeze_n"])

    # Reset early stopper counter (keep best checkpoint path)
    early_stopper.counter = 0
    early_stopper.best_loss = float("inf")

    s2_loader = DataLoader(train_ds, batch_size=CFG["stage2_batch"],
                           shuffle=True, num_workers=2, pin_memory=True)

    # Two LR groups
    head_params = list(model.classifier.parameters())
    layer_params = [p for layer in model.encoder.encoder.layer[-CFG["unfreeze_n"]:]
                     for p in layer.parameters()]

    optimizer_s2 = AdamW([
        {"params": head_params, "lr": CFG["stage2_lr_head"]},
        {"params": layer_params, "lr": CFG["stage2_lr_layers"]},
    ], weight_decay=1e-2)

    scheduler_s2 = OneCycleLR(
        optimizer_s2,
        max_lr=[CFG["stage2_lr_head"], CFG["stage2_lr_layers"]],
        steps_per_epoch=len(s2_loader),
        epochs=CFG["stage2_epochs"],
        pct_start=0.3,
    )

    train_stage(
        f"Stage 2 - top {CFG['unfreeze_n']} layers unfrozen + head",
        model, s2_loader, val_loader,
        optimizer_s2, scheduler_s2,
        CFG["stage2_epochs"], device, early_stopper,
    )

    print("Final evaluation on held-out test set")
    test_loader = DataLoader(test_ds, batch_size=64, num_workers=2)
    evaluate_final(model, test_loader, device)

    print(f"\nDone. Model saved at: {CFG['best_model_path']}")


if __name__ == "__main__":
    main()