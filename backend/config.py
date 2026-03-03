import os

# Maximum upload size in bytes (configurable via MAX_UPLOAD_SIZE_MB env var)
MAX_UPLOAD_SIZE_BYTES = int(os.getenv("MAX_UPLOAD_SIZE_MB", "50")) * 1024 * 1024

# Accepted file extensions for Phase 1 (PDF only — extend in Phase 4)
ALLOWED_EXTENSIONS = {".pdf"}

# Maximum number of concurrent conversion jobs (configurable via MAX_CONCURRENT_JOBS env var)
MAX_CONCURRENT_JOBS = int(os.getenv("MAX_CONCURRENT_JOBS", "2"))
