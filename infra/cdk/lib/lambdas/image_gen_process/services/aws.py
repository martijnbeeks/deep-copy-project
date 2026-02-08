"""
AWS service utilities for image_gen_process Lambda.

Contains wrappers for Secrets Manager, S3, DynamoDB, and related operations.
"""

import base64
import json
import os
from typing import Any, Dict, Optional

import boto3
import requests

from utils.helpers import now_iso
from utils.logging_config import setup_logging
from utils.image import guess_mime_from_key

logger = setup_logging(__name__)

# Initialize AWS clients
s3_client = boto3.client("s3")
ddb_client = boto3.client("dynamodb")


def get_secrets() -> dict:
    """
    Get secrets from AWS Secrets Manager.
    
    Returns:
        Dictionary containing secret values.
    """
    secret_id = os.environ.get("SECRET_ID", "deepcopy-secret-dev")
    aws_region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "eu-west-1"
    client = boto3.client("secretsmanager", region_name=aws_region)
    resp = client.get_secret_value(SecretId=secret_id)
    return json.loads(resp["SecretString"])


def configure_from_secrets(secrets: dict) -> None:
    """
    Populate environment variables from secrets for SDK configuration.
    
    Args:
        secrets: Dictionary of secret values to set as environment variables.
    """
    for k in [
        "OPENAI_API_KEY",
        "ANTHROPIC_API_KEY",
        "GEMINI_API_KEY",
        "CLOUDFLARE_API_TOKEN",
        "CLOUDFLARE_ACCOUNT_ID",
        "IMAGE_GENERATION_PROVIDER",
        "CONVERSATION_PROVIDER",
        "CLAUDE_MODEL",
    ]:
        if secrets.get(k) and not os.environ.get(k):
            os.environ[k] = str(secrets[k])


def update_job_status(
    job_id: Optional[str], 
    status: str, 
    extra_attrs: Optional[dict] = None
) -> None:
    """
    Update job status in DynamoDB.
    
    Args:
        job_id: Job identifier.
        status: New status string.
        extra_attrs: Additional attributes to store.
    """
    jobs_table_name = os.environ.get("JOBS_TABLE_NAME")
    if not jobs_table_name or not job_id:
        return

    try:
        item: Dict[str, Dict[str, str]] = {
            "jobId": {"S": str(job_id)},
            "status": {"S": status},
            "updatedAt": {"S": now_iso()},
        }
        if extra_attrs:
            for key, value in extra_attrs.items():
                if isinstance(value, (str, int, float, bool)):
                    item[key] = {"S": str(value)}
                else:
                    item[key] = {"S": json.dumps(value, ensure_ascii=False)}
        ddb_client.put_item(TableName=jobs_table_name, Item=item)
    except Exception as e:
        # Never fail the job purely due to status updates
        logger.warning("Failed to update job status for %s: %s", job_id, e)


def load_json_from_s3(bucket: str, key: str) -> Any:
    """
    Load and parse JSON from S3.
    
    Args:
        bucket: S3 bucket name.
        key: S3 object key.
        
    Returns:
        Parsed JSON content.
    """
    obj = s3_client.get_object(Bucket=bucket, Key=key)
    raw = obj["Body"].read()
    return json.loads(raw.decode("utf-8"))


def load_bytes_from_s3(bucket: str, key: str) -> bytes:
    """
    Load raw bytes from S3.
    
    Args:
        bucket: S3 bucket name.
        key: S3 object key.
        
    Returns:
        Raw bytes content.
    """
    obj = s3_client.get_object(Bucket=bucket, Key=key)
    return obj["Body"].read()


def save_json_to_s3(bucket: str, key: str, data: Any) -> None:
    """
    Save JSON data to S3.

    Args:
        bucket: S3 bucket name.
        key: S3 object key.
        data: Data to serialize as JSON.
    """
    s3_client.put_object(
        Bucket=bucket,
        Key=key,
        Body=json.dumps(data, ensure_ascii=False, indent=2),
        ContentType="application/json",
    )
    logger.info("Saved results to s3://%s/%s", bucket, key)


def download_image_to_b64(url: str, timeout_s: int = 30) -> Optional[Dict[str, str]]:
    """
    Download image from URL and convert to base64.
    
    Args:
        url: Image URL to download.
        timeout_s: Request timeout in seconds.
        
    Returns:
        Dict with 'base64' and 'mimeType' keys, or None on failure.
    """
    try:
        resp = requests.get(url, timeout=timeout_s)
        resp.raise_for_status()
        content_type = (resp.headers.get("content-type") or "").split(";")[0].strip().lower()
        if not content_type.startswith("image/"):
            # best effort fallback
            content_type = guess_mime_from_key(url, fallback="image/png")
        data = resp.content
        return {"base64": base64.b64encode(data).decode("utf-8"), "mimeType": content_type}
    except Exception as e:
        logger.warning("Failed to download product image url: %s", e)
        return None
