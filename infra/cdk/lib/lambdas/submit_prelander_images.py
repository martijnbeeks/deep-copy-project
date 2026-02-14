import json
import os
import uuid
from datetime import datetime, timezone
from urllib.parse import parse_qs, unquote

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


def _response(status_code: int, body: dict | str):
    if isinstance(body, dict):
        body = json.dumps(body)
        headers = {"content-type": "application/json", "Access-Control-Allow-Origin": "*"}
    else:
        headers = {"content-type": "text/plain", "Access-Control-Allow-Origin": "*"}
    return {"statusCode": status_code, "headers": headers, "body": body}


def _parse_form_data(body_str: str) -> dict:
    """Parse url-encoded form data into a dict."""
    result = {}
    if not body_str:
        return result
    
    # Parse query string format (key=value&key2=value2)
    parsed = parse_qs(body_str, keep_blank_values=True)
    
    # Convert lists to single values or arrays as appropriate
    for key, values in parsed.items():
        if len(values) == 1:
            # Single value - could be a string or JSON
            value = unquote(values[0])
            # Try to parse as JSON (for arrays sent as JSON strings)
            try:
                parsed_json = json.loads(value)
                result[key] = parsed_json
            except (json.JSONDecodeError, ValueError):
                # Not JSON, use as string
                result[key] = value
        else:
            # Multiple values - keep as array
            result[key] = [unquote(v) for v in values]
    
    return result


def handler(event, _context):
    # Check content type to determine parsing method
    headers = event.get("headers", {}) or {}
    content_type = headers.get("Content-Type", "") or headers.get("content-type", "")
    
    body = event.get("body")
    
    # Handle form-data or url-encoded
    if content_type and ("application/x-www-form-urlencoded" in content_type or "multipart/form-data" in content_type):
        if isinstance(body, str):
            body = _parse_form_data(body)
        elif isinstance(body, dict):
            # Already parsed by API Gateway
            pass
        else:
            body = {}
    # Handle JSON
    elif isinstance(body, str):
        try:
            body = json.loads(body) if body else {}
        except json.JSONDecodeError:
            return _response(400, {"error": "Invalid JSON body"})
    elif not isinstance(body, dict) or body is None:
        body = {}

    # Validate required fields
    prompts = body.get("prompts")
    if not prompts or not isinstance(prompts, list):
        return _response(400, {"error": "prompts is required and must be a list"})
    
    # Validate prompts structure
    for i, prompt_item in enumerate(prompts):
        if not isinstance(prompt_item, dict):
            return _response(400, {"error": f"prompts[{i}] must be an object"})
        if not prompt_item.get("role"):
            return _response(400, {"error": f"prompts[{i}].role is required"})
        if not prompt_item.get("prompt"):
            return _response(400, {"error": f"prompts[{i}].prompt is required"})
    
    # Optional fields
    template_id = body.get("templateId")
    type_field = body.get("type")
    product_image_url = body.get("productImageUrl")

    job_id = str(uuid.uuid4())
    result_prefix = f"results/prelander-images/{job_id}"

    # Detect dev mode (optional, consistent with other submitters)
    path = event.get("path", "")
    dev_mode = path.startswith("/dev") or "/dev/" in path

    try:
        _ddb.put_item(
            TableName=JOBS_TABLE_NAME,
            Item={
                "jobId": {"S": job_id},
                "status": {"S": "SUBMITTED"},
                "createdAt": {"S": datetime.now(timezone.utc).isoformat()},
                "input": {"S": json.dumps(body)},
                "resultPrefix": {"S": result_prefix},
                "jobType": {"S": "PRELANDER_IMAGE_GEN"},
            },
        )
    except ClientError as e:
        return _response(500, {"error": f"DynamoDB error: {e.response['Error'].get('Message', str(e))}"})

    notification_email = body.get("notification_email")

    lambda_payload = {
        "job_id": job_id,
        "templateId": template_id,
        "type": type_field,
        "prompts": prompts,
        "productImageUrl": product_image_url,
        "result_prefix": result_prefix,
        "dev_mode": dev_mode,
    }

    if notification_email:
        lambda_payload["notification_email"] = notification_email

    try:
        _lambda.invoke(
            FunctionName=PROCESS_LAMBDA_NAME,
            InvocationType="Event",
            Payload=json.dumps(lambda_payload),
        )
    except ClientError as e:
        return _response(500, {"error": f"Lambda invocation error: {e.response['Error'].get('Message', str(e))}"})

    return _response(202, {"jobId": job_id, "status": "SUBMITTED"})

