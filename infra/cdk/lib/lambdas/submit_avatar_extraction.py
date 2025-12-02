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


JOBS_TABLE_NAME = _required_env("JOBS_TABLE_NAME")
PROCESS_LAMBDA_NAME = _required_env("PROCESS_LAMBDA_NAME")


def handler(event, _context):
    """
    Submit an avatar extraction job.
    
    Expected body: {"url": "https://example.com/product"}
    Returns: {"jobId": "...", "status": "SUBMITTED"}
    """
    body = event.get("body")
    if isinstance(body, str):
        try:
            body = json.loads(body) if body else {}
        except json.JSONDecodeError:
            return {
                "statusCode": 400,
                "headers": {"content-type": "application/json", "Access-Control-Allow-Origin": "*"},
                "body": json.dumps({"error": "Invalid JSON body"}),
            }
    elif not isinstance(body, dict) or body is None:
        body = {}

    # Validate URL is provided
    url = body.get("url")
    if not url:
        return {
            "statusCode": 400,
            "headers": {"content-type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "error": "Missing required parameter: url",
                "example": {"url": "https://example.com/product"}
            }),
        }
    
    # Validate URL format
    if not url.startswith(('http://', 'https://')):
        return {
            "statusCode": 400,
            "headers": {"content-type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "error": "Invalid URL format. URL must start with http:// or https://"
            }),
        }

    job_id = str(uuid.uuid4())
    result_key = f"results/avatars/{job_id}/avatar_extraction_results.json"

    # Detect dev mode
    path = event.get("path", "")
    dev_mode = path.startswith("/dev") or "/dev/" in path
    dev_mode = True

    # Persist initial job record in DynamoDB
    try:
        _ddb.put_item(
            TableName=JOBS_TABLE_NAME,
            Item={
                "jobId": {"S": job_id},
                "status": {"S": "SUBMITTED"},
                "createdAt": {"S": datetime.now(timezone.utc).isoformat()},
                "input": {"S": json.dumps(body)},
                "resultKey": {"S": result_key},
            },
        )
    except ClientError as e:
        return {
            "statusCode": 500,
            "headers": {"content-type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "error": f"DynamoDB error: {e.response['Error'].get('Message', str(e))}"
            }),
        }

    # Invoke processing Lambda asynchronously
    payload = {
        "job_id": job_id,
        "url": url,
        "dev_mode": dev_mode,
    }
    
    try:
        _lambda.invoke(
            FunctionName=PROCESS_LAMBDA_NAME,
            InvocationType="Event",  # Async invocation
            Payload=json.dumps(payload),
        )
    except ClientError as e:
        # Update job status to failed
        try:
            _ddb.put_item(
                TableName=JOBS_TABLE_NAME,
                Item={
                    "jobId": {"S": job_id},
                    "status": {"S": "FAILED"},
                    "updatedAt": {"S": datetime.now(timezone.utc).isoformat()},
                    "error": {"S": f"Lambda invoke error: {e.response['Error'].get('Message', str(e))}"},
                },
            )
        except Exception:
            pass
        
        return {
            "statusCode": 500,
            "headers": {"content-type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "error": f"Failed to start processing: {e.response['Error'].get('Message', str(e))}"
            }),
        }

    return {
        "statusCode": 202,
        "headers": {"content-type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps({
            "jobId": job_id,
            "status": "SUBMITTED"
        }),
    }

