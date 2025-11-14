# Lambda Docker image for swipe file generation
# Using Python 3.12 which is based on Amazon Linux 2023 with newer glibc
FROM public.ecr.aws/lambda/python:3.12

# Copy requirements and install Python dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

# Force rebuild by adding a timestamp
RUN echo "Build timestamp: $(date)" > /tmp/build_timestamp

# Copy function code
COPY handler.py ${LAMBDA_TASK_ROOT}/
COPY swipe_file_writer.py ${LAMBDA_TASK_ROOT}/

# Set the CMD to your handler
CMD [ "handler.lambda_handler" ]

