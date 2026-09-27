"""MT-Hackathon Track 3: Machine Learning & Real-time Inference Service.

This package provides end-to-end ML components for the Moscow Transport hackathon:
- api: FastAPI HTTP server and REST endpoints (/health, /predict, /predict/batch, /models/info, /models/reload)
- core: App configuration, settings management, and structured logging
- features: Feature extraction, schedule matching, telemetry cleaning, and offline pipeline
- models: CatBoost regressors/classifiers with TreeSHAP explainability, model managers, and fallbacks
- schemas: Pydantic v2 data models for input features, predictions, health checks, and dataset records
"""

__version__ = "0.3.0"
