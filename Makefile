# Requires: docker login && docker buildx (bundled with Docker Desktop)

REGISTRY  := docker.io
NAMESPACE := ricky75
TAG       ?= latest
PLATFORMS := linux/amd64,linux/arm64

BACKEND_IMAGE   := $(REGISTRY)/$(NAMESPACE)/docling-webapp-backend:$(TAG)
FRONTEND_IMAGE  := $(REGISTRY)/$(NAMESPACE)/docling-webapp-frontend:$(TAG)
BACKEND_LATEST  := $(REGISTRY)/$(NAMESPACE)/docling-webapp-backend:latest
FRONTEND_LATEST := $(REGISTRY)/$(NAMESPACE)/docling-webapp-frontend:latest

.PHONY: help builder push-backend push-frontend push

help: ## Show available targets
	@echo "Usage: make <target> [TAG=v1.x]"
	@echo ""
	@echo "Targets:"
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  %-18s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""
	@echo "Examples:"
	@echo "  make push TAG=v1.3   # push versioned + latest tags"
	@echo "  make push            # push :latest only"

builder: ## Create (or reuse) the multiarch buildx builder
	docker buildx create --name multiarch --driver docker-container --bootstrap --use 2>/dev/null || docker buildx use multiarch

push-backend: builder ## Build and push backend multi-arch image to DockerHub
	docker buildx build \
		--platform $(PLATFORMS) \
		--tag $(BACKEND_IMAGE) \
		--tag $(BACKEND_LATEST) \
		--file Dockerfile \
		--push \
		.

push-frontend: builder ## Build and push frontend multi-arch image to DockerHub
	docker buildx build \
		--platform $(PLATFORMS) \
		--tag $(FRONTEND_IMAGE) \
		--tag $(FRONTEND_LATEST) \
		--file Dockerfile.frontend \
		--push \
		.

push: push-backend push-frontend ## Build and push both backend and frontend images
	@echo ""
	@echo "Published images:"
	@echo "  $(BACKEND_IMAGE)"
	@echo "  $(BACKEND_LATEST)"
	@echo "  $(FRONTEND_IMAGE)"
	@echo "  $(FRONTEND_LATEST)"
