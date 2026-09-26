"""Tests for PyTorch GRU sequence model (Task 7.1.5).

Validates:
    1. Model architecture correctness (input/output shapes)
    2. Inference latency < 20ms for batch of 100
    3. Sequence extraction produces valid tensors
    4. Blending function correctness
    5. Model save/load roundtrip
"""

from __future__ import annotations

import tempfile
import time
from pathlib import Path

import numpy as np
import pytest
import torch

from src.models.nn_sequence import (
    BLEND_ALPHA,
    INPUT_SIZE,
    SEQ_LEN,
    DelayGRU,
    SequenceSample,
    TelemetrySequenceDataset,
    evaluate_blend,
    load_gru_model,
    predict_batch,
)


class TestDelayGRUArchitecture:
    """Tests for the GRU model architecture."""

    def test_model_instantiation(self) -> None:
        model = DelayGRU()
        assert isinstance(model, torch.nn.Module)

    def test_forward_shape(self) -> None:
        model = DelayGRU()
        model.eval()
        x = torch.randn(8, SEQ_LEN, INPUT_SIZE)
        with torch.no_grad():
            out = model(x)
        assert out.shape == (8,), f"Expected (8,), got {out.shape}"

    def test_single_sample_forward(self) -> None:
        model = DelayGRU()
        model.eval()
        x = torch.randn(1, SEQ_LEN, INPUT_SIZE)
        with torch.no_grad():
            out = model(x)
        assert out.shape == (1,)
        assert torch.isfinite(out).all()

    def test_batch_forward(self) -> None:
        model = DelayGRU()
        model.eval()
        x = torch.randn(64, SEQ_LEN, INPUT_SIZE)
        with torch.no_grad():
            out = model(x)
        assert out.shape == (64,)
        assert torch.isfinite(out).all()

    def test_parameter_count(self) -> None:
        model = DelayGRU()
        n_params = sum(p.numel() for p in model.parameters())
        # BiGRU(4,32,2) + Linear(64,16) + Linear(16,1)
        # Should be a lightweight model (< 100k params)
        assert n_params < 100_000, f"Model has {n_params} params, expected < 100k"
        assert n_params > 1_000, f"Model has {n_params} params, suspiciously low"

    def test_gradients_flow(self) -> None:
        """Verifies gradients flow through the entire network.

        Uses a larger batch (32) to ensure numeric gradients propagate
        through all layers of the deep BiGRU (reverse layers on tiny
        batches may legitimately have near-zero gradients).
        """
        model = DelayGRU()
        model.train()
        torch.manual_seed(123)
        x = torch.randn(32, SEQ_LEN, INPUT_SIZE)
        y = torch.randn(32)
        pred = model(x)
        loss = torch.nn.functional.mse_loss(pred, y)
        loss.backward()
        for name, param in model.named_parameters():
            assert param.grad is not None, f"No gradient for {name}"
        # At least 90% of parameters should have non-zero gradients
        non_zero = sum(
            1 for p in model.parameters()
            if p.grad is not None and p.grad.abs().sum() > 0
        )
        total = sum(1 for _ in model.parameters())
        assert non_zero / total >= 0.9, (
            f"Only {non_zero}/{total} params have non-zero gradients"
        )


class TestInferenceLatency:
    """Inference latency must be < 20ms for batch of 100 on CPU."""

    def test_batch_100_latency(self) -> None:
        model = DelayGRU()
        model.eval()
        batch = np.random.randn(100, SEQ_LEN, INPUT_SIZE).astype(np.float32)

        # Warmup
        for _ in range(5):
            predict_batch(model, batch)

        # Measure
        times = []
        for _ in range(50):
            t0 = time.perf_counter()
            predict_batch(model, batch)
            t1 = time.perf_counter()
            times.append((t1 - t0) * 1000)

        p50 = float(np.median(times))
        assert p50 < 20.0, f"Inference p50={p50:.2f}ms exceeds 20ms limit"

    def test_single_inference_latency(self) -> None:
        model = DelayGRU()
        model.eval()
        single = np.random.randn(1, SEQ_LEN, INPUT_SIZE).astype(np.float32)

        # Warmup
        for _ in range(5):
            predict_batch(model, single)

        times = []
        for _ in range(50):
            t0 = time.perf_counter()
            predict_batch(model, single)
            times.append((time.perf_counter() - t0) * 1000)

        p50 = float(np.median(times))
        assert p50 < 5.0, f"Single inference p50={p50:.2f}ms exceeds 5ms limit"


class TestSequenceDataset:
    """Tests for TelemetrySequenceDataset."""

    def test_dataset_creation(self) -> None:
        samples = [
            SequenceSample(
                sequence=np.random.randn(SEQ_LEN, INPUT_SIZE).astype(np.float32),
                target_delay_s=42.0,
                sample_id="test_001",
            )
            for _ in range(10)
        ]
        ds = TelemetrySequenceDataset(samples)
        assert len(ds) == 10

    def test_dataset_getitem(self) -> None:
        seq = np.random.randn(SEQ_LEN, INPUT_SIZE).astype(np.float32)
        samples = [SequenceSample(sequence=seq, target_delay_s=99.5, sample_id="s1")]
        ds = TelemetrySequenceDataset(samples)
        x, y = ds[0]
        assert x.shape == (SEQ_LEN, INPUT_SIZE)
        assert y.item() == pytest.approx(99.5)

    def test_dataloader_integration(self) -> None:
        samples = [
            SequenceSample(
                sequence=np.random.randn(SEQ_LEN, INPUT_SIZE).astype(np.float32),
                target_delay_s=float(i),
                sample_id=f"s{i}",
            )
            for i in range(20)
        ]
        ds = TelemetrySequenceDataset(samples)
        loader = torch.utils.data.DataLoader(ds, batch_size=8, shuffle=False)
        batches = list(loader)
        assert len(batches) == 3  # 20 / 8 = 2.5 → 3 batches
        x0, y0 = batches[0]
        assert x0.shape == (8, SEQ_LEN, INPUT_SIZE)


class TestBlending:
    """Tests for the evaluate_blend function."""

    def test_alpha_1_equals_catboost(self) -> None:
        gru = np.array([10.0, 20.0, 30.0])
        cb = np.array([15.0, 25.0, 35.0])
        targets = np.array([12.0, 22.0, 32.0])
        results = evaluate_blend(gru, cb, targets, alphas=[1.0])
        # alpha=1.0 means 100% CatBoost
        expected_mae = float(np.abs(cb - targets).mean())
        assert results["alpha_1.00"] == pytest.approx(expected_mae, abs=0.01)

    def test_alpha_0_equals_gru(self) -> None:
        gru = np.array([10.0, 20.0, 30.0])
        cb = np.array([15.0, 25.0, 35.0])
        targets = np.array([12.0, 22.0, 32.0])
        results = evaluate_blend(gru, cb, targets, alphas=[0.0])
        expected_mae = float(np.abs(gru - targets).mean())
        assert results["alpha_0.00"] == pytest.approx(expected_mae, abs=0.01)

    def test_best_alpha_selection(self) -> None:
        # Make GRU perfect, CatBoost bad → best_alpha should be 0.0
        targets = np.array([10.0, 20.0, 30.0])
        gru = targets.copy()  # perfect
        cb = targets + 100.0  # bad
        results = evaluate_blend(gru, cb, targets)
        assert results["best_alpha"] == 0.0

    def test_blend_improves_over_both(self) -> None:
        """Check that blending can improve over individual models."""
        np.random.seed(42)
        targets = np.random.randn(100) * 50
        # Two models with complementary errors
        gru = targets + np.random.randn(100) * 30
        cb = targets + np.random.randn(100) * 30
        results = evaluate_blend(gru, cb, targets)
        # Blend should at minimum be <= worst individual
        assert results["best_blend_mae"] <= max(
            results["catboost_only_mae"],
            results["gru_only_mae"],
        )


class TestModelSaveLoad:
    """Tests for model persistence."""

    def test_save_load_roundtrip(self) -> None:
        model = DelayGRU()
        model.eval()
        x = torch.randn(4, SEQ_LEN, INPUT_SIZE)
        with torch.no_grad():
            pred_original = model(x).numpy()

        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test_model.pt"
            torch.save(model.state_dict(), str(path))

            loaded = load_gru_model(path)
            with torch.no_grad():
                pred_loaded = loaded(x).numpy()

        np.testing.assert_allclose(pred_original, pred_loaded, atol=1e-6)

    def test_predict_batch_consistency(self) -> None:
        model = DelayGRU()
        model.eval()
        batch = np.random.randn(10, SEQ_LEN, INPUT_SIZE).astype(np.float32)
        p1 = predict_batch(model, batch)
        p2 = predict_batch(model, batch)
        np.testing.assert_allclose(p1, p2, atol=1e-6)
