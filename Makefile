PORT ?= 9000

.PHONY: help setup build-frontend run dev clean

help: ## Show available targets
	@echo "Usage: make <target>"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  %-18s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

setup: ## Initial setup: install system deps, Python deps, and build frontend
	@echo "Installing system dependencies..."
	brew install tesseract || true
	@echo "Installing Python dependencies..."
	uv sync
	@echo "Building frontend..."
	cd frontend && npm install && npm run build
	@echo ""
	@echo "Setup complete. Run 'make run' to start the app."

build-frontend: ## Build frontend static files
	cd frontend && npm run build

run: ## Run the app (API + frontend on PORT, default 9000)
	uv run uvicorn backend.main:app --host 0.0.0.0 --port $(PORT)

dev: ## Run with hot-reload (backend only, frontend served from last build)
	uv run uvicorn backend.main:app --host 0.0.0.0 --port $(PORT) --reload

clean: ## Remove build artifacts
	rm -rf frontend/dist .venv __pycache__ backend/__pycache__
