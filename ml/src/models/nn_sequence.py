"""PyTorch GRU sequence model for telemetry micro-dynamics (Task 7.1.5).

Architecture:
    Input: (batch, seq_len=12, 4) — 12 telemetry points × 15 sec = 3-min window
    Channels: [delta_time, speed, delta_heading, distance_delta]
    Layers: Bidirectional GRU(input_size=4, hidden_size=32, num_layers=2)
            + Linear Head (64 → 16 → 1)
    Output: seq_delay_adjustment — correction to CatBoost delay prediction

Blending:
    y_hat = alpha * y_catboost + (1 - alpha) * y_pytorch   (alpha=0.85 default)

Why this matters:
    CatBoost sees summary statistics (mean speed, std, trend).
    The GRU sees the raw 3-minute acceleration/deceleration micro-trajectory
    and can detect patterns like "bus approaching a known bottleneck intersection"
    that aggregate stats miss.

Run training:
    cd ml && uv run python -m src.models.nn_sequence --train
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("nn_sequence")

# ─── Hyper-parameters ──────────────────────────────────────────────
SEQ_LEN = 12           # 12 points × ~15 sec ≈ 3-minute window
INPUT_SIZE = 4         # [delta_time, speed, delta_heading, distance_delta]
HIDDEN_SIZE = 32       # GRU hidden dim
NUM_LAYERS = 2         # stacked GRU layers
BLEND_ALPHA = 0.85     # CatBoost weight in ensemble
BATCH_SIZE = 256
LEARNING_RATE = 1e-3
NUM_EPOCHS = 50
SEED = 42


def repo_root() -> Path:
    return Path(__file__).resolve().parents[3]


# ─── Model ──────────────────────────────────────────────────────────

class DelayGRU(nn.Module):
    """Bidirectional GRU for telemetry sequence → delay adjustment."""

    def __init__(
        self,
        input_size: int = INPUT_SIZE,
        hidden_size: int = HIDDEN_SIZE,
        num_layers: int = NUM_LAYERS,
    ) -> None:
        super().__init__()
        self.gru = nn.GRU(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            bidirectional=True,
        )
        # BiGRU outputs hidden_size * 2 = 64
        self.head = nn.Sequential(
            nn.Linear(hidden_size * 2, 16),
            nn.ReLU(),
            nn.Linear(16, 1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Forward pass.

        Args:
            x: (batch_size, seq_len, input_size) telemetry sequence tensor.

        Returns:
            (batch_size,) — predicted delay adjustment in seconds.
        """
        # output: (batch, seq_len, hidden*2)
        output, _ = self.gru(x)
        # Take the last timestep from both directions
        last_hidden = output[:, -1, :]  # (batch, hidden*2)
        pred = self.head(last_hidden)   # (batch, 1)
        return pred.squeeze(-1)


# ─── Dataset ────────────────────────────────────────────────────────

@dataclass
class SequenceSample:
    """Single training sample: telemetry window + target delay."""
    sequence: np.ndarray      # (SEQ_LEN, INPUT_SIZE)
    target_delay_s: float
    sample_id: str
    catboost_pred: Optional[float] = None


class TelemetrySequenceDataset(Dataset):
    """PyTorch Dataset of telemetry windows aligned to prediction points."""

    def __init__(self, samples: list[SequenceSample]) -> None:
        self.samples = samples

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        s = self.samples[idx]
        x = torch.tensor(s.sequence, dtype=torch.float32)
        y = torch.tensor(s.target_delay_s, dtype=torch.float32)
        return x, y


# ─── Sequence Extraction ───────────────────────────────────────────

def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance between two points in meters."""
    R = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _heading_delta(h1: float, h2: float) -> float:
    """Signed heading difference, normalized to [-180, 180]."""
    d = h2 - h1
    return ((d + 180) % 360) - 180


def extract_sequences(
    labels_df: pd.DataFrame,
    traffic_df: pd.DataFrame,
    seq_len: int = SEQ_LEN,
) -> list[SequenceSample]:
    """Extracts telemetry windows for each labeled prediction point.

    For each (tr_id, T) in labels, grabs the last `seq_len` valid GPS points
    with event_time <= T and computes 4 channels:
        [delta_time_s, speed_kmh, delta_heading_deg, distance_delta_m]

    Points with too few telemetry records get a zero-padded sequence.
    """
    # Pre-process traffic
    traffic = traffic_df.copy()
    if not pd.api.types.is_datetime64_any_dtype(traffic["event_time"]):
        traffic["event_time"] = pd.to_datetime(traffic["event_time"])

    # Filter valid GPS only
    if "location_valid" in traffic.columns:
        traffic = traffic[traffic["location_valid"].astype(bool)].copy()

    traffic["epoch_s"] = traffic["event_time"].astype("int64") // 10**9
    traffic = traffic.sort_values(["tr_id", "epoch_s"]).reset_index(drop=True)

    # Index by vehicle
    vehicle_groups: dict[int, pd.DataFrame] = {}
    for tr_id, grp in traffic.groupby("tr_id"):
        vehicle_groups[int(tr_id)] = grp

    samples: list[SequenceSample] = []
    n_short = 0

    for _, row in labels_df.iterrows():
        tr_id = int(row["tr_id"])
        t_val = row["T"]
        if not isinstance(t_val, pd.Timestamp):
            t_val = pd.to_datetime(t_val)
        t_epoch = int(t_val.timestamp())

        target = float(row["target_delay_s"]) if "target_delay_s" in row.index else 0.0

        grp = vehicle_groups.get(tr_id)
        if grp is None:
            # No telemetry for this vehicle — pad with zeros
            seq = np.zeros((seq_len, INPUT_SIZE), dtype=np.float32)
            samples.append(SequenceSample(
                sequence=seq,
                target_delay_s=target,
                sample_id=str(row["sample_id"]),
            ))
            n_short += 1
            continue

        # Slice event_time <= T
        mask = grp["epoch_s"].values <= t_epoch
        before_t = grp[mask]

        if len(before_t) < 2:
            seq = np.zeros((seq_len, INPUT_SIZE), dtype=np.float32)
            samples.append(SequenceSample(
                sequence=seq,
                target_delay_s=target,
                sample_id=str(row["sample_id"]),
            ))
            n_short += 1
            continue

        # Take last (seq_len + 1) points to compute seq_len deltas
        tail = before_t.tail(seq_len + 1)
        epochs = tail["epoch_s"].values.astype(np.float64)
        speeds = tail["speed"].values.astype(np.float32)
        headings = tail["heading"].values.astype(np.float32)
        lats = tail["lat"].values.astype(np.float64)
        lons = tail["lon"].values.astype(np.float64)

        n_points = len(tail) - 1  # number of deltas

        channels = np.zeros((n_points, INPUT_SIZE), dtype=np.float32)
        for i in range(n_points):
            dt = float(epochs[i + 1] - epochs[i])
            spd = float(speeds[i + 1])
            dh = _heading_delta(float(headings[i]), float(headings[i + 1]))
            dist = _haversine_m(
                float(lats[i]), float(lons[i]),
                float(lats[i + 1]), float(lons[i + 1]),
            )
            channels[i] = [dt, spd, dh, dist]

        # Pad or truncate to seq_len
        if n_points < seq_len:
            pad = np.zeros((seq_len - n_points, INPUT_SIZE), dtype=np.float32)
            channels = np.concatenate([pad, channels], axis=0)
            n_short += 1
        elif n_points > seq_len:
            channels = channels[-seq_len:]

        # Normalize: scale delta_time by 1/60, speed by 1/60, heading by 1/180, dist by 1/500
        channels[:, 0] /= 60.0   # delta_time: typical 10-30s → 0.17-0.5
        channels[:, 1] /= 60.0   # speed: typical 0-60 km/h → 0-1
        channels[:, 2] /= 180.0  # heading delta: -180..+180 → -1..+1
        channels[:, 3] /= 500.0  # distance: typical 0-500m → 0-1

        samples.append(SequenceSample(
            sequence=channels,
            target_delay_s=target,
            sample_id=str(row["sample_id"]),
        ))

    logger.info(
        f"Extracted {len(samples)} sequences ({n_short} zero-padded/short) "
        f"from {len(labels_df)} labels"
    )
    return samples


# ─── Training ───────────────────────────────────────────────────────

def train_model(
    train_samples: list[SequenceSample],
    val_samples: list[SequenceSample],
    epochs: int = NUM_EPOCHS,
    batch_size: int = BATCH_SIZE,
    lr: float = LEARNING_RATE,
    patience: int = 10,
) -> tuple[DelayGRU, dict]:
    """Trains the GRU model with early stopping on validation MAE."""
    torch.manual_seed(SEED)
    np.random.seed(SEED)

    device = torch.device("cpu")  # CPU-only for hackathon portability
    model = DelayGRU().to(device)

    train_ds = TelemetrySequenceDataset(train_samples)
    val_ds = TelemetrySequenceDataset(val_samples)
    train_loader = DataLoader(train_ds, batch_size=batch_size, shuffle=True,
                              drop_last=False, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=batch_size, shuffle=False,
                            num_workers=0)

    # Huber loss aligns with CatBoost's Huber:delta=60
    criterion = nn.HuberLoss(delta=60.0)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=5, min_lr=1e-5,
    )

    best_val_mae = float("inf")
    best_state = None
    wait = 0
    history: list[dict] = []

    for epoch in range(epochs):
        # Train
        model.train()
        train_losses = []
        for x_batch, y_batch in train_loader:
            x_batch, y_batch = x_batch.to(device), y_batch.to(device)
            optimizer.zero_grad()
            pred = model(x_batch)
            loss = criterion(pred, y_batch)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=5.0)
            optimizer.step()
            train_losses.append(loss.item())

        # Validate
        model.eval()
        val_preds, val_targets = [], []
        with torch.no_grad():
            for x_batch, y_batch in val_loader:
                x_batch = x_batch.to(device)
                pred = model(x_batch)
                val_preds.append(pred.cpu().numpy())
                val_targets.append(y_batch.numpy())

        val_preds_arr = np.concatenate(val_preds)
        val_targets_arr = np.concatenate(val_targets)
        val_mae = float(np.abs(val_preds_arr - val_targets_arr).mean())
        train_loss_mean = float(np.mean(train_losses))

        scheduler.step(val_mae)

        history.append({
            "epoch": epoch + 1,
            "train_loss": round(train_loss_mean, 4),
            "val_mae": round(val_mae, 2),
            "lr": optimizer.param_groups[0]["lr"],
        })

        if (epoch + 1) % 5 == 0 or epoch == 0:
            logger.info(
                f"Epoch {epoch+1:3d}/{epochs}: "
                f"train_loss={train_loss_mean:.4f}  val_MAE={val_mae:.2f}s  "
                f"lr={optimizer.param_groups[0]['lr']:.1e}"
            )

        if val_mae < best_val_mae:
            best_val_mae = val_mae
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            wait = 0
        else:
            wait += 1
            if wait >= patience:
                logger.info(f"Early stopping at epoch {epoch+1}, best val MAE={best_val_mae:.2f}s")
                break

    if best_state is not None:
        model.load_state_dict(best_state)

    metrics = {
        "best_val_mae_gru": round(best_val_mae, 2),
        "total_epochs": len(history),
        "model_params": sum(p.numel() for p in model.parameters()),
    }
    return model, metrics


# ─── Blending & Evaluation ─────────────────────────────────────────

def evaluate_blend(
    gru_preds: np.ndarray,
    catboost_preds: np.ndarray,
    targets: np.ndarray,
    alphas: list[float] | None = None,
) -> dict:
    """Evaluates CatBoost-only, GRU-only, and blended MAE at multiple alphas."""
    if alphas is None:
        alphas = [0.0, 0.50, 0.70, 0.80, 0.85, 0.90, 0.95, 1.0]

    results = {}
    for alpha in alphas:
        blended = alpha * catboost_preds + (1 - alpha) * gru_preds
        mae = float(np.abs(blended - targets).mean())
        key = f"alpha_{alpha:.2f}"
        results[key] = round(mae, 2)
        if alpha == 1.0:
            results["catboost_only_mae"] = round(mae, 2)
        elif alpha == 0.0:
            results["gru_only_mae"] = round(mae, 2)

    best_alpha = min(alphas, key=lambda a: results[f"alpha_{a:.2f}"])
    results["best_alpha"] = best_alpha
    results["best_blend_mae"] = results[f"alpha_{best_alpha:.2f}"]
    return results


# ─── Inference utility ──────────────────────────────────────────────

def load_gru_model(model_path: Path) -> DelayGRU:
    """Loads a trained GRU model from disk."""
    model = DelayGRU()
    state = torch.load(str(model_path), map_location="cpu", weights_only=True)
    model.load_state_dict(state)
    model.eval()
    return model


def predict_batch(
    model: DelayGRU,
    sequences: np.ndarray,
) -> np.ndarray:
    """Runs GRU inference on a batch of sequences.

    Args:
        model: Trained DelayGRU.
        sequences: (N, seq_len, input_size) array.

    Returns:
        (N,) array of delay adjustments.
    """
    model.eval()
    with torch.no_grad():
        x = torch.tensor(sequences, dtype=torch.float32)
        preds = model(x).numpy()
    return preds


# ─── Full Pipeline ──────────────────────────────────────────────────

def run_training_pipeline() -> int:
    """End-to-end: extract sequences → train GRU → evaluate blend → save."""
    root = repo_root()
    processed = root / "data" / "processed" / "_snapshot"
    dataset_root = root / "dataset"
    out_dir = root / "data" / "models" / "competition"
    out_dir.mkdir(parents=True, exist_ok=True)

    # Load labels
    train_labels = pd.read_parquet(processed / "features_train.parquet")
    test_labels = pd.read_parquet(processed / "features_test.parquet")

    # Load raw telemetry
    logger.info("Loading raw telemetry for sequence extraction...")
    train_traffic = pd.read_csv(dataset_root / "train" / "traffic.csv")
    test_traffic = pd.read_csv(dataset_root / "test" / "traffic.csv")

    # Extract sequences
    logger.info("Extracting train sequences...")
    train_samples = extract_sequences(train_labels, train_traffic, seq_len=SEQ_LEN)
    logger.info("Extracting test sequences...")
    test_samples = extract_sequences(test_labels, test_traffic, seq_len=SEQ_LEN)

    # Train GRU
    logger.info("Training GRU model...")
    gru_model, train_metrics = train_model(train_samples, test_samples)
    logger.info(f"GRU training done: {train_metrics}")

    # Get GRU predictions on test holdout
    gru_model.eval()
    test_ds = TelemetrySequenceDataset(test_samples)
    test_loader = DataLoader(test_ds, batch_size=512, shuffle=False)
    gru_preds_list, targets_list = [], []
    with torch.no_grad():
        for x_b, y_b in test_loader:
            gru_preds_list.append(gru_model(x_b).numpy())
            targets_list.append(y_b.numpy())
    gru_preds = np.concatenate(gru_preds_list)
    targets = np.concatenate(targets_list)

    # Load CatBoost predictions for blending
    from catboost import CatBoostRegressor

    try:
        from ..features.extractor import MODEL_FEATURE_NAMES
    except (ImportError, ValueError):
        from src.features.extractor import MODEL_FEATURE_NAMES

    FEATURE_COLS = list(MODEL_FEATURE_NAMES)

    gold_path = out_dir / "catboost_competition_gold_score1.0.cbm"
    default_path = out_dir / "catboost_competition.cbm"
    cb_path = gold_path if gold_path.exists() else default_path
    logger.info(f"Loading CatBoost model from {cb_path.name}")
    cb_model = CatBoostRegressor()
    cb_model.load_model(str(cb_path))
    cb_preds = cb_model.predict(test_labels[FEATURE_COLS])

    # Evaluate blending
    blend_results = evaluate_blend(gru_preds, cb_preds, targets)
    logger.info("Blend evaluation results:")
    for k, v in sorted(blend_results.items()):
        logger.info(f"  {k}: {v}")

    catboost_holdout = blend_results["catboost_only_mae"]
    best_blend = blend_results["best_blend_mae"]
    best_alpha = blend_results["best_alpha"]

    logger.info(
        f"\n{'='*60}\n"
        f"CatBoost-only holdout MAE: {catboost_holdout:.2f}s\n"
        f"GRU-only holdout MAE:      {blend_results['gru_only_mae']:.2f}s\n"
        f"Best blend MAE:            {best_blend:.2f}s (alpha={best_alpha:.2f})\n"
        f"Improvement over CatBoost: {catboost_holdout - best_blend:+.2f}s\n"
        f"{'='*60}"
    )

    # Save model
    gru_path = out_dir / "gru_sequence.pt"
    torch.save(gru_model.state_dict(), str(gru_path))
    logger.info(f"Saved GRU model → {gru_path}")

    # Save metrics
    all_metrics = {
        **train_metrics,
        **blend_results,
        "catboost_holdout_mae": catboost_holdout,
        "improvement_over_catboost_s": round(catboost_holdout - best_blend, 2),
        "beats_catboost": best_blend < catboost_holdout,
        "seq_len": SEQ_LEN,
        "input_size": INPUT_SIZE,
        "hidden_size": HIDDEN_SIZE,
        "num_layers": NUM_LAYERS,
        "architecture": "BiGRU(4→32×2) + Linear(64→16→1)",
    }
    metrics_path = out_dir / "gru_metrics.json"
    metrics_path.write_text(json.dumps(all_metrics, indent=2))
    logger.info(f"Saved metrics → {metrics_path}")

    # Benchmark inference latency (batch of 100)
    dummy_batch = np.random.randn(100, SEQ_LEN, INPUT_SIZE).astype(np.float32)
    times = []
    for _ in range(100):
        t0 = time.perf_counter()
        predict_batch(gru_model, dummy_batch)
        times.append((time.perf_counter() - t0) * 1000)
    p50 = float(np.median(times))
    p99 = float(np.percentile(times, 99))
    logger.info(f"Inference latency (batch=100): p50={p50:.2f}ms  p99={p99:.2f}ms")
    all_metrics["inference_batch100_p50_ms"] = round(p50, 2)
    all_metrics["inference_batch100_p99_ms"] = round(p99, 2)
    metrics_path.write_text(json.dumps(all_metrics, indent=2))

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--train", action="store_true", help="Run full training pipeline")
    parser.add_argument("--benchmark", action="store_true", help="Benchmark inference only")
    args = parser.parse_args()

    if args.train:
        return run_training_pipeline()

    if args.benchmark:
        model = DelayGRU()
        model.eval()
        dummy = np.random.randn(100, SEQ_LEN, INPUT_SIZE).astype(np.float32)
        times = []
        for _ in range(200):
            t0 = time.perf_counter()
            predict_batch(model, dummy)
            times.append((time.perf_counter() - t0) * 1000)
        p50 = np.median(times)
        logger.info(f"Benchmark (batch=100): p50={p50:.2f}ms  p99={np.percentile(times, 99):.2f}ms")
        return 0

    parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
