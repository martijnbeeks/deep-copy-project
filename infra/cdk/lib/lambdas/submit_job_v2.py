"""
Submit Job V2 Lambda Handler

This handler enforces the new v2 request format:
- Required: sales_page_url, project_name
- Optional: research_requirements, gender, location, advertorial_type
- Rejected: customer_avatars, persona, age_range (deprecated fields)

The api_version is stored in DynamoDB for tracking.
"""

import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError


_lambda = boto3.client("lambda")
_ddb = boto3.client("dynamodb")


def _required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing env {name}")
    return value


PROCESS_LAMBDA_NAME = _required_env("PROCESS_LAMBDA_NAME")
JOBS_TABLE_NAME = _required_env("JOBS_TABLE_NAME")

# Fields that are deprecated and should be rejected in v2
DEPRECATED_FIELDS = {"customer_avatars", "persona", "age_range"}

# Required fields for v2
REQUIRED_FIELDS = {"sales_page_url", "project_name"}

# Allowed optional fields for v2
OPTIONAL_FIELDS = {"research_requirements", "gender", "location", "advertorial_type", "target_product_name", "notification_email", "callback_url"}


def _response(status_code: int, body: dict) -> dict:
    return {
        "statusCode": status_code,
        "headers": {"content-type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps(body),
    }


def _validate_request(body: dict) -> tuple[bool, str | None]:
    """
    Validate the v2 request body.
    
    Returns:
        (is_valid, error_message)
    """
    # Check for deprecated fields
    deprecated_found = DEPRECATED_FIELDS.intersection(body.keys())
    if deprecated_found:
        return False, f"Deprecated fields not allowed in v2 API: {', '.join(sorted(deprecated_found))}"
    
    # Check for required fields
    missing_required = REQUIRED_FIELDS - body.keys()
    if missing_required:
        return False, f"Missing required fields: {', '.join(sorted(missing_required))}"
    
    # Validate required fields are not empty
    for field in REQUIRED_FIELDS:
        value = body.get(field)
        if not value or (isinstance(value, str) and not value.strip()):
            return False, f"Field '{field}' cannot be empty"
    
    # Validate URL format (basic check)
    sales_page_url = body.get("sales_page_url", "")
    if not sales_page_url.startswith(("http://", "https://")):
        return False, "Field 'sales_page_url' must be a valid URL starting with http:// or https://"
    
    return True, None


def handler(event, _context):
    body = event.get("body")
    if isinstance(body, str):
        try:
            body = json.loads(body) if body else {}
        except json.JSONDecodeError:
            return _response(400, {"error": "Invalid JSON body"})
    elif not isinstance(body, dict) or body is None:
        body = {}

    # Validate the request
    is_valid, error_message = _validate_request(body)
    if not is_valid:
        return _response(400, {"error": error_message})

    job_id = str(uuid.uuid4())
    result_prefix = f"results/{job_id}"

    # Detect dev mode from path OR body parameter
    path = event.get("path", "")
    path_is_dev = "/dev/" in path or path.startswith("/dev")
    body_dev_mode = str(body.get("dev_mode", "")).lower() == "true"
    dev_mode = "true" if (path_is_dev or body_dev_mode) else "false"

    # Persist initial job record with api_version
    try:
        _ddb.put_item(
            TableName=JOBS_TABLE_NAME,
            Item={
                "jobId": {"S": job_id},
                "status": {"S": "SUBMITTED"},
                "createdAt": {"S": datetime.now(timezone.utc).isoformat()},
                "input": {"S": json.dumps(body)},
                "resultPrefix": {"S": result_prefix},
                "apiVersion": {"S": "v2"},
            },
        )
    except ClientError as e:
        return _response(500, {"error": f"DynamoDB error: {e.response['Error'].get('Message', str(e))}"})

    # Prepare Lambda invocation payload with api_version marker
    lambda_payload = {
        **body,
        "job_id": job_id,
        "result_prefix": result_prefix,
        "dev_mode": dev_mode,
        "api_version": "v2",
    }

    try:
        # Invoke Lambda function asynchronously
        _lambda.invoke(
            FunctionName=PROCESS_LAMBDA_NAME,
            InvocationType="Event",  # Asynchronous invocation
            Payload=json.dumps(lambda_payload),
        )
    except ClientError as e:
        return _response(500, {"error": f"Lambda invocation error: {e.response['Error'].get('Message', str(e))}"})

    return _response(202, {"jobId": job_id, "status": "SUBMITTED"})

