# Lambda Docker image for image generation jobs (static ad variations)
FROM public.ecr.aws/lambda/python:3.12

# Install uv for dependency management
RUN pip install --no-cache-dir uv

# Copy pyproject and lockfile and install dependencies
COPY pyproject.toml uv.lock ${LAMBDA_TASK_ROOT}/

# Create minimal structure required by pyproject.toml (README.md and src directory)
WORKDIR ${LAMBDA_TASK_ROOT}
RUN echo "# image-gen-process" > README.md && \
    mkdir -p src

# Use uv to export dependencies and install them (frozen lock)
RUN uv export --no-dev --frozen > requirements.txt && \
    grep -v 'file:///' requirements.txt > requirements.lock && \
    uv pip install --system --no-cache --requirement requirements.lock

# Force rebuild by adding a timestamp
RUN echo "Build timestamp: $(date)" > /tmp/build_timestamp

# Copy function code
COPY handler.py ${LAMBDA_TASK_ROOT}/

# Set the CMD to your handler
CMD [ "handler.lambda_handler" ]


