import json
import os

import boto3
from botocore.exceptions import ClientError


_ddb = boto3.client("dynamodb")
_JOBS_TABLE_NAME = os.environ.get("JOBS_TABLE_NAME")


def _response(status_code: int, body: dict | str):
    if isinstance(body, dict):
        body = json.dumps(body)
        headers = {"content-type": "application/json", "Access-Control-Allow-Origin": "*"}
    else:
        headers = {"content-type": "text/plain", "Access-Control-Allow-Origin": "*"}
    return {"statusCode": status_code, "headers": headers, "body": body}


def handler(event, _context):
    job_id = (event.get("pathParameters") or {}).get("id")
    if not job_id:
        return _response(400, "Missing id")

    if not _JOBS_TABLE_NAME:
        return _response(500, "Server misconfiguration: JOBS_TABLE_NAME not set")

    try:
        resp = _ddb.get_item(
            TableName=_JOBS_TABLE_NAME,
            Key={"jobId": {"S": job_id}},
        )
    except ClientError as e:
        return _response(500, f"DynamoDB error: {e.response['Error'].get('Message', str(e))}")

    item = resp.get("Item")
    if not item:
        return _response(404, "Not found")

    status = item.get("status", {}).get("S")
    api_version = item.get("apiVersion", {}).get("S")
    error = item.get("error", {}).get("S")

    response_body = {
        "jobId": job_id,
        "status": status,
    }
    if api_version:
        response_body["api_version"] = api_version
    if error:
        response_body["error"] = error

    return _response(200, response_body)


