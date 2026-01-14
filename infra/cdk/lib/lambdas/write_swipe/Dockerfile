# Lambda Docker image for swipe file generation
# Using Python 3.12 which is based on Amazon Linux 2023 with newer glibc
FROM public.ecr.aws/lambda/python:3.12

# Install uv for dependency management
RUN pip install --no-cache-dir uv

# Copy pyproject.toml and uv.lock
COPY pyproject.toml uv.lock ${LAMBDA_TASK_ROOT}/

# Use uv to export dependencies and install them system-wide
RUN uv export --no-dev --frozen > requirements.txt && \
    grep -v 'file:///' requirements.txt > requirements.lock && \
    uv pip install --system --no-cache --requirement requirements.lock

# Force rebuild by adding a timestamp
RUN echo "Build timestamp: $(date)" > /tmp/build_timestamp

# Copy function code
COPY utils/ ${LAMBDA_TASK_ROOT}/utils/
COPY services/ ${LAMBDA_TASK_ROOT}/services/
COPY pipeline/ ${LAMBDA_TASK_ROOT}/pipeline/
COPY prompts.py ${LAMBDA_TASK_ROOT}/
COPY llm_usage.py ${LAMBDA_TASK_ROOT}/
COPY handler.py ${LAMBDA_TASK_ROOT}/

# Set the CMD to your handler
CMD [ "handler.lambda_handler" ]

