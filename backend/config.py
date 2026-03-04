import os

# Maximum upload size in bytes (configurable via MAX_UPLOAD_SIZE_MB env var)
MAX_UPLOAD_SIZE_BYTES = int(os.getenv("MAX_UPLOAD_SIZE_MB", "50")) * 1024 * 1024

# Accepted file extensions — all formats supported by Docling
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".xlsx", ".html", ".htm", ".md"}

# Maximum number of concurrent conversion jobs (configurable via MAX_CONCURRENT_JOBS env var)
MAX_CONCURRENT_JOBS = int(os.getenv("MAX_CONCURRENT_JOBS", "2"))
