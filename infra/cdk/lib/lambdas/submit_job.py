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


def handler(event, _context):
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

    job_id = str(uuid.uuid4())
    result_prefix = f"results/{job_id}"

    # Detect dev mode
    path = event.get("path", "")
    dev_mode = path.startswith("/dev") or "/dev/" in path
    dev_mode = True

    # Persist initial job record
    try:
        _ddb.put_item(
            TableName=JOBS_TABLE_NAME,
            Item={
                "jobId": {"S": job_id},
                "status": {"S": "SUBMITTED"},
                "createdAt": {"S": datetime.now(timezone.utc).isoformat()},
                "input": {"S": json.dumps(body)},
                "resultPrefix": {"S": result_prefix},
            },
        )
    except ClientError as e:
        return {
            "statusCode": 500,
            "headers": {"content-type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": f"DynamoDB error: {e.response['Error'].get('Message', str(e))}"}),
        }

    # Prepare Lambda invocation payload
    lambda_payload = {
        **body,
        "job_id": job_id,
        "result_prefix": result_prefix,
        "dev_mode": dev_mode,
    }

    try:
        # Invoke Lambda function asynchronously
        invoke_resp = _lambda.invoke(
            FunctionName=PROCESS_LAMBDA_NAME,
            InvocationType="Event",  # Asynchronous invocation
            Payload=json.dumps(lambda_payload),
        )
    except ClientError as e:
        return {
            "statusCode": 500,
            "headers": {"content-type": "application/json", "Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": f"Lambda invocation error: {e.response['Error'].get('Message', str(e))}"}),
        }

    return {
        "statusCode": 202,
        "headers": {"content-type": "application/json", "Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"jobId": job_id, "status": "SUBMITTED"}),
    }


