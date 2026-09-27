"""API package for ML inference service."""

from .routes import router
from .server import app

__all__ = ["app", "router"]
