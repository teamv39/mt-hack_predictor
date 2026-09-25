"""Structured logging configuration for ML Service."""

import logging
import sys
from .config import get_settings


def setup_logger(name: str = "ml_service") -> logging.Logger:
    """Configures and returns a logger instance with consistent formatting."""
    settings = get_settings()
    logger = logging.getLogger(name)

    level = getattr(logging, settings.log_level.upper(), logging.INFO)
    logger.setLevel(level)

    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
        handler.setFormatter(formatter)
        logger.addHandler(handler)

    return logger
