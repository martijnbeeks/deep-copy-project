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


def _normalize_uploaded_urls(value) -> list:
    """Normalize uploadedReferenceImageUrls to a list."""
    if not value:
        return []
    
    if isinstance(value, list):
        return value
    
    if isinstance(value, str):
        # Try parsing as JSON array first
        try:
            parsed = json.loads(value)
            if isinstance(parsed, list):
                return parsed
        except (json.JSONDecodeError, ValueError):
            pass
        
        # Check if comma-separated
        if ',' in value:
            return [url.strip() for url in value.split(',') if url.strip()]
        
        # Single URL string
        return [value] if value.strip() else []
    
    return []


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

    selected_avatar = body.get("selectedAvatar")
    selected_angles = body.get("selectedAngles")
    
    # Normalize uploadedReferenceImageUrls - handle all formats
    uploaded_reference_image_urls_raw = (
        body.get("uploadedReferenceImageUrls") or 
        body.get("uploadedReferenceImageUrl") or  # Singular (backward compat)
        body.get("customReferenceImageUrls") or   # Old field name (backward compat)
        []
    )
    
    # Normalize to list
    uploaded_reference_image_urls = _normalize_uploaded_urls(uploaded_reference_image_urls_raw)
    
    # Also handle selectedAngles if it comes as a string (form-data)
    if isinstance(selected_angles, str):
        try:
            selected_angles = json.loads(selected_angles)
        except (json.JSONDecodeError, ValueError):
            # Try comma-separated
            if ',' in selected_angles:
                selected_angles = [angle.strip() for angle in selected_angles.split(',') if angle.strip()]
            else:
                selected_angles = [selected_angles]
    
    if not selected_avatar or not isinstance(selected_avatar, str):
        return _response(400, {"error": "selectedAvatar is required and must be a string"})
    if not selected_angles or not isinstance(selected_angles, list) or not all(isinstance(x, str) for x in selected_angles):
        return _response(400, {"error": "selectedAngles is required and must be a list of strings"})
    
    # Validate uploaded image URLs if provided
    if uploaded_reference_image_urls:
        if not isinstance(uploaded_reference_image_urls, list):
            return _response(400, {"error": "uploadedReferenceImageUrls must be a list"})
        if not all(isinstance(url, str) and url.startswith(('http://', 'https://')) for url in uploaded_reference_image_urls):
            return _response(400, {"error": "uploadedReferenceImageUrls must be a list of valid HTTP/HTTPS URLs"})
    
    # Normalize the field name in the payload for downstream processing
    body["uploadedReferenceImageUrls"] = uploaded_reference_image_urls

    job_id = str(uuid.uuid4())
    result_prefix = f"results/{job_id}"

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
                "jobType": {"S": "IMAGE_GEN"},
            },
        )
    except ClientError as e:
        return _response(500, {"error": f"DynamoDB error: {e.response['Error'].get('Message', str(e))}"})

    lambda_payload = {
        **body,
        "job_id": job_id,
        "result_prefix": result_prefix,
        "dev_mode": dev_mode,
    }

    try:
        _lambda.invoke(
            FunctionName=PROCESS_LAMBDA_NAME,
            InvocationType="Event",
            Payload=json.dumps(lambda_payload),
        )
    except ClientError as e:
        return _response(500, {"error": f"Lambda invocation error: {e.response['Error'].get('Message', str(e))}"})

    return _response(202, {"jobId": job_id, "status": "SUBMITTED"})



