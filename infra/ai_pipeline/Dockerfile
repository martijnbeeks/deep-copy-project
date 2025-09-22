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

# System deps required by Chromium on Debian
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxext6 \
    libxrender1 \
    fonts-liberation \
    fonts-unifont \
    && rm -rf /var/lib/apt/lists/*

# Copy deps and app
COPY --from=build /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=build /usr/local/bin /usr/local/bin
COPY . /app

# Install Chromium browser binaries in the final image
RUN playwright install chromium

# Precompile (non-fatal)
RUN python -m compileall -q /app || true

# Default command runs a single job; Pipes overrides env to inject job params
CMD ["python", "-m", "src.pipeline.handler"]
