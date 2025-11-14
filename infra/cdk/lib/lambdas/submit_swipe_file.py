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
    Submit a swipe file generation job.
    
    Expected body: {
        "original_job_id": "uuid-of-original-job",
        "select_angle": "Marketing angle description"
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
    original_job_id = body.get("original_job_id")
    select_angle = body.get("select_angle")
    
    if not original_job_id:
        return {
            "statusCode": 400,
            "headers": {"content-type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "error": "Missing required parameter: original_job_id",
                "example": {"original_job_id": "uuid", "select_angle": "Marketing angle"}
            }),
        }
    
    if not select_angle:
        return {
            "statusCode": 400,
            "headers": {"content-type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({
                "error": "Missing required parameter: select_angle",
                "example": {"original_job_id": "uuid", "select_angle": "Marketing angle"}
            }),
        }

    job_id = f"{original_job_id}-swipe"
    result_key = f"results/swipe_files/{job_id}/swipe_files_results.json"

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
        "select_angle": select_angle,
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

