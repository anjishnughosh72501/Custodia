# Stage 1: build the React frontend (output lands in /build/app/web, see frontend/vite.config.ts)
FROM node:22.14.0-slim AS web
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

# Stage 2: build-stage NLI model preparation using pinned revision and checksum validation
FROM python:3.12.9-slim AS model-builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir httpx numpy onnxruntime tokenizers
COPY scripts/prepare_nli_model.py scripts/
RUN python scripts/prepare_nli_model.py --dir /build/models

# Stage 3: FastAPI app serving the API, the built frontend, and the prepared quantized model
FROM python:3.12.9-slim
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY --from=web /build/app/web ./app/web
COPY --from=model-builder /build/models ./models

# Create non-root user and writable /data directory for SQLite storage
RUN groupadd -r custodia && useradd -r -g custodia -d /srv -s /sbin/nologin custodia \
    && mkdir -p /data && chown -R custodia:custodia /data /srv

USER custodia

ENV CUSTODIA_DB=/data/custodia.db SCOPELOCK_DB=/data/custodia.db PYTHONUNBUFFERED=1 \
    CUSTODIA_NLI_ENABLED=0 \
    CUSTODIA_NLI_MODEL_PATH=/srv/models/model_int8.onnx \
    CUSTODIA_NLI_TOKENIZER_PATH=/srv/models/tokenizer.json \
    CUSTODIA_NLI_CONFIG_PATH=/srv/models/config.json
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/ping')" || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1 --proxy-headers --forwarded-allow-ips '*'"]
