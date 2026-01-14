"""
AWS service utilities for write_swipe Lambda.
"""
import json
import os
from typing import Any, Dict, Optional
import boto3
from utils.logging_config import setup_logging
from utils.helpers import now_iso

logger = setup_logging(__name__)

s3_client = boto3.client("s3")
ddb_client = boto3.client("dynamodb")

def get_secrets() -> dict:
    """
    Get secrets from AWS Secrets Manager.
    """
    secret_id = os.environ.get("SECRET_ID", "deepcopy-secret-dev")
    aws_region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "eu-west-1"
    
    try:
        client = boto3.client("secretsmanager", region_name=aws_region)
        resp = client.get_secret_value(SecretId=secret_id)
        return json.loads(resp["SecretString"])
    except Exception as e:
        logger.error(f"Failed to get secrets: {e}")
        return {}

def update_job_status(job_id: str, status: str, extra_attrs: Optional[Dict[str, Any]] = None) -> None:
    """
    Update job status in DynamoDB.
    """
    jobs_table_name = os.environ.get("JOBS_TABLE_NAME")
    if not jobs_table_name or not job_id:
        return

    try:
        item = {
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
        logger.warning(f"Failed to update job status: {e}")

def save_results_to_s3(bucket: str, key: str, data: Any) -> bool:
    """
    Save results to S3 as JSON.
    """
    try:
        s3_client.put_object(
            Bucket=bucket,
            Key=key,
            Body=json.dumps(data, ensure_ascii=False),
            ContentType="application/json"
        )
        return True
    except Exception as e:
        logger.error(f"Failed to save results to S3: {e}")
        return False

def fetch_results_from_s3(bucket: str, key: str) -> Any:
    """
    Fetch and parse JSON results from S3.
    """
    try:
        obj = s3_client.get_object(Bucket=bucket, Key=key)
        return json.loads(obj["Body"].read().decode("utf-8"))
    except Exception as e:
        logger.error(f"Failed to fetch results from S3: {e}")
        return None
