# Stage 1: build the React frontend (output lands in /build/app/web, see frontend/vite.config.ts)
FROM node:22.14.0-slim AS web
WORKDIR /build/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
RUN npm run build

# Stage 2: FastAPI app serving the API and the built frontend
FROM python:3.12.9-slim
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY --from=web /build/app/web ./app/web

# Create non-root user and writable /data directory for SQLite storage
RUN groupadd -r custodia && useradd -r -g custodia -d /srv -s /sbin/nologin custodia \
    && mkdir -p /data && chown -R custodia:custodia /data /srv

USER custodia

ENV CUSTODIA_DB=/data/custodia.db SCOPELOCK_DB=/data/custodia.db PYTHONUNBUFFERED=1
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health')" || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips '*'"]
