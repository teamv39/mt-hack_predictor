# Dockerfile for Python ML & FastAPI Inference Service
FROM python:3.12-slim

# Install runtime dependencies for C++ libraries (OpenMP for CatBoost)
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Install uv from official binary image for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy project definition and install dependencies using BuildKit wheel cache
COPY pyproject.toml .python-version ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv pip install --system --extra-index-url https://download.pytorch.org/whl/cpu -r pyproject.toml

COPY src ./src

EXPOSE 8000

CMD ["uvicorn", "src.api.server:app", "--host", "0.0.0.0", "--port", "8000"]
