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

# Stage 3: build the Rust Secure Document Gateway
FROM rust:1-slim AS rust-builder
WORKDIR /build/gateway
COPY gateway/Cargo.toml gateway/Cargo.lock ./
COPY gateway/src ./src
RUN cargo build --release

# Stage 4: FastAPI app serving the API, the built frontend, the prepared model, and the compiled Rust gateway
FROM python:3.12.9-slim
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY scripts/start.sh ./scripts/start.sh
RUN chmod +x ./scripts/start.sh
COPY --from=web /build/app/web ./app/web
COPY --from=model-builder /build/models ./models
COPY --from=rust-builder /build/gateway/target/release/custodia-secure-gateway /usr/local/bin/custodia-secure-gateway

# Create non-root user and writable /data directory for SQLite storage
RUN groupadd -r custodia && useradd -r -g custodia -d /srv -s /sbin/nologin custodia \
    && mkdir -p /data && chown -R custodia:custodia /data /srv /usr/local/bin/custodia-secure-gateway

USER custodia

ENV CUSTODIA_DB=/data/custodia.db SCOPELOCK_DB=/data/custodia.db PYTHONUNBUFFERED=1 \
    CUSTODIA_NLI_ENABLED=0 \
    CUSTODIA_NLI_MODEL_PATH=/srv/models/model_int8.onnx \
    CUSTODIA_NLI_TOKENIZER_PATH=/srv/models/tokenizer.json \
    CUSTODIA_NLI_CONFIG_PATH=/srv/models/config.json \
    CUSTODIA_GATEWAY_URL=http://127.0.0.1:8002
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/ping'); urllib.request.urlopen('http://127.0.0.1:8002/health')" || exit 1

CMD ["./scripts/start.sh"]
