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


def _response(status_code: int, body: dict | str):
    if isinstance(body, dict):
        body = json.dumps(body)
        headers = {"content-type": "application/json", "Access-Control-Allow-Origin": "*"}
    else:
        headers = {"content-type": "text/plain", "Access-Control-Allow-Origin": "*"}
    return {"statusCode": status_code, "headers": headers, "body": body}


def handler(event, _context):
    body = event.get("body")
    if isinstance(body, str):
        try:
            body = json.loads(body) if body else {}
        except json.JSONDecodeError:
            return _response(400, {"error": "Invalid JSON body"})
    elif not isinstance(body, dict) or body is None:
        body = {}

    selected_avatar = body.get("selectedAvatar")
    selected_angles = body.get("selectedAngles")
    if not selected_avatar or not isinstance(selected_avatar, str):
        return _response(400, {"error": "selectedAvatar is required and must be a string"})
    if not selected_angles or not isinstance(selected_angles, list) or not all(isinstance(x, str) for x in selected_angles):
        return _response(400, {"error": "selectedAngles is required and must be a list of strings"})

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



