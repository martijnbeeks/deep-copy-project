# Lambda Docker image for prelander image generation
FROM public.ecr.aws/lambda/python:3.12

# Install uv for dependency management
RUN pip install --no-cache-dir uv

# Copy pyproject.toml
COPY pyproject.toml ${LAMBDA_TASK_ROOT}/

# Install dependencies using uv (install directly from pyproject.toml)
RUN cd ${LAMBDA_TASK_ROOT} && \
    uv pip install --system --no-cache \
      requests>=2.31.0 \
      cloudflare>=4.0.0 \
      pillow>=10.0.0 \
      google-genai>=1.0.0 \
      boto3>=1.26.0 \
      "sentry-sdk>=2.0.0"

# Force rebuild by adding a timestamp
RUN echo "Build timestamp: $(date)" > /tmp/build_timestamp

# Copy function code
COPY utils/ ${LAMBDA_TASK_ROOT}/utils/
COPY services/ ${LAMBDA_TASK_ROOT}/services/
COPY llm_usage.py ${LAMBDA_TASK_ROOT}/
COPY handler.py ${LAMBDA_TASK_ROOT}/

# Set the CMD to your handler
CMD [ "handler.lambda_handler" ]

