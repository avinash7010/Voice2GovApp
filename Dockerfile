# ============================================================
# Voice2Gov Backend – Production Dockerfile
# ============================================================
FROM python:3.11-slim

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libglib2.0-0 \
    libgl1-mesa-glx \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# App working directory
WORKDIR /app

# Install Python dependencies first (layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Download spaCy model
RUN python -m spacy download en_core_web_sm || echo "spaCy model download failed – will use keyword fallback"

# Copy source code
COPY . .

# Create required directories
RUN mkdir -p logs uploads

# Non-root user for security
RUN adduser --disabled-password --no-create-home appuser \
    && chown -R appuser:appuser /app
USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Expose port
EXPOSE 8000

# Start server
CMD ["uvicorn", "app.main:socket_app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
