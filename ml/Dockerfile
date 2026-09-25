# Dockerfile for Python ML & FastAPI Inference Service
FROM python:3.12-slim

# Install system dependencies for C++ libraries (CatBoost, OpenMP)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install uv from official binary image for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy project definition and install dependencies
COPY pyproject.toml .python-version ./
RUN uv pip install --system --no-cache -r pyproject.toml

COPY src ./src

EXPOSE 8000

CMD ["uvicorn", "src.api.server:app", "--host", "0.0.0.0", "--port", "8000"]
