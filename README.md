# Docling Webapp

A web application for converting documents (PDF, DOCX, PPTX, XLSX, HTML, Markdown) to Markdown using [Docling](https://github.com/docling-project/docling).

Features real-time conversion progress via SSE streaming, batch file support, configurable OCR engines, and a dark/light theme.

## Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Document conversion | [Docling](https://github.com/docling-project/docling) | 2.76.0 |
| API backend | FastAPI + Uvicorn | 0.135.1 / 0.41.0 |
| Python runtime | Python | 3.12.13 |
| Frontend framework | React | 19.2.0 |
| Build tool | Vite | 7.3.1 |
| TypeScript | TypeScript | 5.9.3 |
| CSS framework | Tailwind CSS | 4.2.1 |
| Reverse proxy | nginx | 1.27-alpine |
| Node build image | Node.js | 22-alpine |
| Backend base image | python | 3.12-slim-bookworm |

### OCR Engines

| Engine | Version | Notes |
|--------|---------|-------|
| RapidOCR (ONNX) | 1.4.4 | Default — CPU-only, multilingual, fast |
| EasyOCR | 1.7.2 | GPU-capable, supports 80+ languages |
| Tesseract (via tesserocr) | 2.10.0 | Classic engine, requires language packs |

OCR is auto-selected at runtime (RapidOCR by default). All three engines are pre-installed in the Docker image.

### Supported Input Formats

`PDF` `DOCX` `PPTX` `XLSX` `HTML` `MD` — max 50 MB per file.

---

## Quick Start (pre-built images)

Pull pre-built multi-arch images from DockerHub — no source code or build tools required.

### Requirements

- Docker Engine 24+ with Compose v2
- ~4 GB disk space on first pull (Docling ML models are pre-baked in the image)
- No GPU required (CPU inference)
- Supported architectures: linux/amd64, linux/arm64

### Deploy

```bash
docker compose up -d
```

The app is available at **http://localhost:3000**.

To use a different port:

```bash
PORT=8080 docker compose up -d
```

> **Note:** The backend image is ~1.5 GB (Docling ML models pre-baked). First pull takes a few minutes depending on network speed. Subsequent starts are instant.

### Update (existing users)

```bash
docker compose pull
docker compose up -d
```

Images: [ricky75/docling-webapp-backend](https://hub.docker.com/r/ricky75/docling-webapp-backend) · [ricky75/docling-webapp-frontend](https://hub.docker.com/r/ricky75/docling-webapp-frontend)

---

## Quick Start (build from source)

### Requirements

- Docker Engine 24+ with Compose v2
- ~4 GB disk space (models are pre-downloaded into the image)
- No GPU required (CPU inference)

### Build and run

```bash
docker compose -f docker-compose.build.yml up --build -d
```

The app is available at **http://localhost:3000**.

To use a different port:

```bash
PORT=8080 docker compose -f docker-compose.build.yml up --build -d
```

### Development (hot reload)

```bash
docker compose -f docker-compose.build.yml -f docker-compose.dev.yml up --build
```

This mounts `./backend` into the container and enables `--reload` on Uvicorn. The frontend is still served via nginx (no Vite dev server in this mode). Edit `frontend/` files and run `npm run build` locally to see changes, or use the local dev setup below.

---

## Local Development (no Docker)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

> **Note:** First run will download Docling models (~1.5 GB) to `~/.cache/docling/models/`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs at **http://localhost:5173** and proxies `/api/` to `http://localhost:8000`.

---

## Platform Notes

### macOS (Apple Silicon / Intel)

Works out of the box with Docker Desktop or OrbStack.

```bash
docker compose up -d
```

For local development without Docker, install Tesseract if you plan to use that OCR engine:

```bash
brew install tesseract tesseract-lang
```

### Linux (x86_64 / arm64)

Works with Docker Engine and Docker Compose v2 (no Desktop needed).

```bash
# Install Docker Engine if not already present
curl -fsSL https://get.docker.com | sh

docker compose up -d
```

For Tesseract OCR in local dev (no Docker):

```bash
# Debian/Ubuntu
sudo apt-get install tesseract-ocr tesseract-ocr-eng tesseract-ocr-ita

# Fedora/RHEL
sudo dnf install tesseract tesseract-langpack-eng tesseract-langpack-ita
```

### Windows

Use **Docker Desktop with WSL 2** backend.

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Enable WSL 2 integration in Docker Desktop settings
3. Open a WSL terminal and run:

```bash
docker compose up -d
```

For local development without Docker, use WSL 2 (Ubuntu recommended) and follow the Linux instructions above.

---

## Configuration

Environment variables (apply to both `docker-compose.yml` and `docker-compose.build.yml`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Host port exposed by nginx |
| `MAX_UPLOAD_SIZE_MB` | `50` | Max upload size per file |
| `MAX_CONCURRENT_JOBS` | `2` | Max parallel conversion jobs |

Pass them inline or in a `.env` file:

```bash
PORT=8080 MAX_CONCURRENT_JOBS=4 docker compose up -d
```

---

## Project Structure

```
.
├── backend/              # FastAPI application
│   ├── main.py           # API endpoints (/convert, /jobs/:id/stream, /health)
│   ├── adapter.py        # Docling wrapper with async support
│   ├── config.py         # Allowed extensions, upload limits
│   └── requirements.txt
├── frontend/             # React + Vite application
│   └── src/
│       ├── App.tsx
│       ├── components/   # UploadZone, OptionsPanel, BatchList, ResultViewer…
│       └── hooks/        # useBatchUpload, useJobStream
├── Dockerfile            # Backend image (Python 3.12 + Docling models)
├── Dockerfile.frontend   # Frontend image (Node 22 build + nginx serve)
├── nginx.conf            # Reverse proxy with SSE-safe configuration
├── docker-compose.yml       # Default stack (pre-built DockerHub images)
├── docker-compose.build.yml # Build from source
└── docker-compose.dev.yml   # Development overrides (hot reload)
```
