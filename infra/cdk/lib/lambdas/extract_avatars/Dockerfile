# Lambda Docker image with Playwright support
# Using Python 3.12 which is based on Amazon Linux 2023 with newer glibc
# Force rebuild: v4 - with fixed Playwright browser path
FROM public.ecr.aws/lambda/python:3.12

# Install system dependencies for Chromium (dnf for Amazon Linux 2023)
RUN dnf install -y \
    wget \
    unzip \
    libX11 \
    libXcomposite \
    libXcursor \
    libXdamage \
    libXext \
    libXi \
    libXtst \
    cups-libs \
    libXScrnSaver \
    libXrandr \
    alsa-lib \
    atk \
    gtk3 \
    nss \
    nspr \
    && dnf clean all

# Install uv for dependency management
RUN pip install --no-cache-dir uv

# Copy pyproject.toml and uv.lock
COPY pyproject.toml uv.lock* ${LAMBDA_TASK_ROOT}/

# Use uv to install dependencies system-wide
RUN if [ -f uv.lock ]; then \
        uv export --no-dev --frozen > requirements.txt; \
    else \
        uv export --no-dev > requirements.txt; \
    fi && \
    grep -v 'file:///' requirements.txt > requirements.lock && \
    uv pip install --system --no-cache --requirement requirements.lock

# Set Playwright to install browsers in a fixed location accessible by Lambda
ENV PLAYWRIGHT_BROWSERS_PATH=/var/task/.playwright

# Install Playwright Chromium to the fixed location
RUN python -m playwright install chromium

# Force rebuild by adding a timestamp
RUN echo "Build timestamp: $(date)" > /tmp/build_timestamp

# Copy function code
COPY handler.py ${LAMBDA_TASK_ROOT}/
COPY avatar_extractor.py ${LAMBDA_TASK_ROOT}/
COPY llm_usage.py ${LAMBDA_TASK_ROOT}/
COPY get_largest_image.py ${LAMBDA_TASK_ROOT}/

# Set the CMD to your handler
CMD [ "handler.lambda_handler" ]

