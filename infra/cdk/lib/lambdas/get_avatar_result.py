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
    """
    Get avatar extraction result from S3.
    
    Path parameter: id (job ID)
    Returns: Avatar extraction results JSON
    """
    job_id = (event.get("pathParameters") or {}).get("id")
    if not job_id:
        return _response(400, "Missing id")

    if not _RESULTS_BUCKET:
        return _response(500, "Server misconfiguration: RESULTS_BUCKET not set")

    key = f"results/avatars/{job_id}/avatar_extraction_results.json"

    try:
        obj = _s3.get_object(Bucket=_RESULTS_BUCKET, Key=key)
        data = obj["Body"].read()
        try:
            payload = json.loads(data)
            return _response(200, payload)
        except json.JSONDecodeError:
            # Return raw text if not valid JSON
            return _response(200, data.decode("utf-8"))
    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code")
        if error_code in ("NoSuchKey", "404"):
            return _response(404, "Result not available")
        return _response(500, f"S3 error: {e.response['Error'].get('Message', str(e))}")

if __name__ == "__main__":
    print(handler({"pathParameters": {"id": "a81aa659-4924-4765-92b6-3e862d140d6a"}}, {}))