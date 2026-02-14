import json
import os
import uuid
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)


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
    Submit a swipe file generation job.
    
    Expected body: {
        "original_job_id": "uuid-of-original-job",
        "avatar_id": "id-of-avatar",
        "angle_id": "id-of-marketing-angle"
    }
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

    # Validate required parameters
    logger.info(f"Body: {body}")
    original_job_id = body.get("original_job_id")
    avatar_id = body.get("avatar_id")
    angle_id = body.get("angle_id")
    swipe_file_ids = body.get("swipe_file_ids", [])
    VALID_IMAGE_STYLES = {"realistic", "photorealistic", "illustration"}
    image_style = body.get("image_style", "realistic")
    if image_style not in VALID_IMAGE_STYLES:
        return {
            "statusCode": 400,
            "headers": {"content-type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "error": f"Invalid image_style: '{image_style}'. Must be one of: {', '.join(sorted(VALID_IMAGE_STYLES))}"
            }),
        }
    
    if not original_job_id:
        return {
            "statusCode": 400,
            "headers": {"content-type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "error": "Missing required parameter: original_job_id",
                "example": {"original_job_id": "uuid", "avatar_id": "uuid", "angle_id": "uuid"}
            }),
        }
    
    if not avatar_id or not angle_id:
        return {
            "statusCode": 400,
            "headers": {"content-type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "error": "Missing required parameters: avatar_id and angle_id are required",
                "example": {"original_job_id": "uuid", "avatar_id": "uuid", "angle_id": "uuid"}
            }),
        }

    job_id = f"{original_job_id}-swipe"
    result_key = f"results/swipe_files/{job_id}/swipe_files_results.json"

    # Detect dev mode
    path = event.get("path", "")
    dev_mode = path.startswith("/dev") or "/dev/" in path

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
        "original_job_id": original_job_id,
        "job_id": job_id,
        "avatar_id": avatar_id,
        "angle_id": angle_id,
        "dev_mode": dev_mode,
        "swipe_file_ids": swipe_file_ids,
        "image_style": image_style,
    }

    # Optional override fields
    target_product_name = body.get("target_product_name")
    if target_product_name:
        payload["target_product_name"] = target_product_name

    notification_email = body.get("notification_email")
    if notification_email:
        payload["notification_email"] = notification_email
    
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

