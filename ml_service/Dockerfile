# ─── Python FastAPI ML Service ───
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (cache layer)
COPY ml_service/requirements.txt ./requirements.txt

# Install CPU-only PyTorch first (much smaller than GPU version)
RUN pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu

# Install remaining dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire ml_service package (from repo root context)
COPY ml_service/ ./ml_service/

# Create models directory
RUN mkdir -p ml_service/models

# Railway provides PORT env var
ENV PORT=8000
ENV PYTHONUNBUFFERED=1
EXPOSE ${PORT}

# Run uvicorn — module path needs the package structure
CMD uvicorn ml_service.app.main:app --host 0.0.0.0 --port ${PORT}
