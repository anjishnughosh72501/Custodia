# Deployment & Operational Runbook

## Architecture Overview

Custodia is designed as a modular, containerized application with dual services:
1. **Rust Security Gateway (Port 8002)**: High-performance binary validating incoming document uploads and media files.
2. **FastAPI Application (Port 8001)**: Core API server running brand governance, preflight analysis, workflow approvals, and serving built React single-page application (SPA) assets from `app/web/`.

---

## 1. Containerized Deployment (Docker)

Custodia includes a production-ready, multi-stage `Dockerfile`:

### Stages:
1. **Stage 1 (Rust Builder)**: Compiles `gateway/` in release mode using `rust:latest`.
2. **Stage 2 (Node.js Builder)**: Compiles `frontend/` using `node:20` (`npm run build`), generating static assets into `app/web/`.
3. **Stage 3 (Python Runtime)**: Uses `python:3.11-slim`, installs Python dependencies from `requirements.txt`, copies the compiled Rust gateway binary, and bundles the application code and built web assets.

### Build & Run Commands:
```bash
# Build the Docker image
docker build -t custodia-brand-governance .

# Run the container (maps API & Web to port 8001)
docker run -d -p 8001:8001 -p 8002:8002 --name custodia custodia-brand-governance
```

Access the application in your browser:
* Web Application & Dashboard: `http://localhost:8001`
* Interactive API Documentation (Swagger UI): `http://localhost:8001/docs`
* OpenAPI JSON Specification: `http://localhost:8001/openapi.json`
* Rust Security Gateway Health: `http://localhost:8002/health`

---

## 2. Environment Variables & Configuration

Custodia runs **100% functional with zero environment variables** thanks to its zero-key deterministic fallback and embedded SQLite database.

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | *(Empty)* | PostgreSQL connection string. When unset, defaults to local `custodia.db` (SQLite). |
| `RUST_GATEWAY_URL` | `http://localhost:8002` | Endpoint for the Rust pre-validation gateway. |
| `GEMINI_API_KEY` | *(Optional)* | Enables Google Gemini qualitative analysis and deep document parsing. |
| `OPENAI_API_KEY` | *(Optional)* | Enables OpenAI GPT-4o creative suggestions. |
| `ANTHROPIC_API_KEY` | *(Optional)* | Enables Anthropic Claude legal compliance reasoning. |
| `ENVIRONMENT` | `production` | Execution environment (`development`, `staging`, `production`). |

---

## 3. Local Development (Without Docker)

### Step 1: Rust Gateway
```bash
cd gateway
cargo run --release
# Gateway listens on http://localhost:8002
```

### Step 2: Python Backend
```bash
# Install dependencies
pip install -r requirements.txt

# Run FastAPI server
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### Step 3: Frontend Development or Production Build
For live development with hot reload:
```bash
cd frontend
npm install
npm run dev
# Vite dev server runs on http://localhost:5173 (proxies API requests to 8001)
```

To build production static assets served directly by FastAPI:
```bash
cd frontend
npm run build
# Compiles to ../app/web/
```

---

## 4. Production Checklist

- [x] Multi-stage Dockerfile verified.
- [x] Static assets compiled directly into `app/web/`.
- [x] Database migrations & schema auto-seeding enabled (`seed_demo_brand_dna_if_needed`).
- [x] Zero-key deterministic fallback enabled for air-gapped or key-less environments.
- [x] Rust gateway memory safety and timeout protection verified.
- [x] Cryptographic SHA-256 audit logging active.
