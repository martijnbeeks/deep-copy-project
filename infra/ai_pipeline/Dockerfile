#####################################
# Stage 1: Build deps with uv       #
#####################################
FROM python:3.12-slim AS build

RUN pip install --no-cache-dir uv

WORKDIR /app

COPY pyproject.toml uv.lock* ./
COPY README.md ./README.md
COPY src ./src

RUN uv export --no-dev --frozen > requirements.txt && \
    grep -v 'file:///' requirements.txt > requirements.lock && \
    uv pip install --system --no-cache --requirement requirements.lock

# add "playwright", "install", "chromium"
RUN playwright install chromium

#####################################
# Stage 2: Runtime image for ECS    #
#####################################
FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONPATH=/app:/app/src

WORKDIR /app

# System deps (minimal); Playwright disabled at runtime via env
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# Copy deps and app
COPY --from=build /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=build /usr/local/bin /usr/local/bin
COPY . /app

# Precompile (non-fatal)
RUN python -m compileall -q /app || true

# Default command runs a single job; Pipes overrides env to inject job params
CMD ["python", "-m", "src.pipeline.handler"]
