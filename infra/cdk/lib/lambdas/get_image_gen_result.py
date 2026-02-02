import json
import os

import boto3
from botocore.exceptions import ClientError


_s3 = boto3.client("s3")
_RESULTS_BUCKET = os.environ.get("RESULTS_BUCKET")


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

    if not _RESULTS_BUCKET:
        return _response(500, "Server misconfiguration: RESULTS_BUCKET not set")

    # Keep in sync with image_gen_process output location
    key = f"results/image-gen/{job_id}/image_gen_results.json"
    try:
        obj = _s3.get_object(Bucket=_RESULTS_BUCKET, Key=key)
        data = obj["Body"].read()
        try:
            payload = json.loads(data)
            return _response(200, payload)
        except json.JSONDecodeError:
            return _response(200, data.decode("utf-8"))
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        if error_code in ("NoSuchKey", "404"):
            return _response(404, "Result not available")
        return _response(500, f"S3 error: {e.response['Error'].get('Message', str(e))}")



