"""
Shared test helpers for lambda E2E tests.

This is an importable module (NOT a conftest.py) to avoid pytest auto-discovery
issues when running separate lambda test suites.
"""

import json
import os
from pathlib import Path

import boto3

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
TEST_BUCKET = "test-results-bucket"
TEST_JOBS_TABLE = "test-jobs-table"
TEST_SECRET_ID = "deepcopy-secret-dev"
AWS_REGION = "eu-west-1"


# ---------------------------------------------------------------------------
# DATABASE_URL loader
# ---------------------------------------------------------------------------
def load_database_url() -> str:
    """
    Read DATABASE_URL from tests/.env (via python-dotenv) or environment.

    Raises:
        RuntimeError: If DATABASE_URL is not set anywhere.
    """
    from dotenv import load_dotenv

    env_path = Path(__file__).parent / ".env"
    if env_path.exists():
        load_dotenv(env_path, override=False)

    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError(
            "DATABASE_URL not set. Create tests/.env or export DATABASE_URL."
        )
    return url


# ---------------------------------------------------------------------------
# Common env vars
# ---------------------------------------------------------------------------
def set_common_env_vars() -> None:
    """Set the environment variables all lambdas expect."""
    os.environ["RESULTS_BUCKET"] = TEST_BUCKET
    os.environ["JOBS_TABLE_NAME"] = TEST_JOBS_TABLE
    os.environ["SECRET_ID"] = TEST_SECRET_ID
    os.environ["AWS_DEFAULT_REGION"] = AWS_REGION
    os.environ["AWS_ACCESS_KEY_ID"] = "testing"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "testing"
    os.environ["AWS_SECURITY_TOKEN"] = "testing"
    os.environ["AWS_SESSION_TOKEN"] = "testing"


# ---------------------------------------------------------------------------
# AWS resource creation (call inside a moto mock_aws context)
# ---------------------------------------------------------------------------
def create_aws_resources(database_url: str) -> None:
    """
    Create the moto-backed AWS resources all lambdas need.

    Must be called while moto's mock_aws() context manager is active.

    Args:
        database_url: Real production DATABASE_URL to inject into the secret.
    """
    region = AWS_REGION

    # --- Secrets Manager ---
    sm = boto3.client("secretsmanager", region_name=region)
    secret_value = {
        "OPENAI_API_KEY": "sk-test-fake",
        "ANTHROPIC_API_KEY": "sk-ant-test-fake",
        "PERPLEXITY_API_KEY": "pplx-test-fake",
        "GEMINI_API_KEY": "gemini-test-fake",
        "CLOUDFLARE_API_TOKEN": "cf-test-fake",
        "CLOUDFLARE_ACCOUNT_ID": "cf-account-fake",
        "IMAGE_GENERATION_PROVIDER": "google",
        "DATABASE_URL": database_url,
    }
    sm.create_secret(
        Name=TEST_SECRET_ID,
        SecretString=json.dumps(secret_value),
    )

    # --- S3 Bucket ---
    s3 = boto3.client("s3", region_name=region)
    s3.create_bucket(
        Bucket=TEST_BUCKET,
        CreateBucketConfiguration={"LocationConstraint": region},
    )

    # --- DynamoDB Jobs Table ---
    ddb = boto3.client("dynamodb", region_name=region)
    ddb.create_table(
        TableName=TEST_JOBS_TABLE,
        KeySchema=[{"AttributeName": "jobId", "KeyType": "HASH"}],
        AttributeDefinitions=[{"AttributeName": "jobId", "AttributeType": "S"}],
        BillingMode="PAY_PER_REQUEST",
    )


# ---------------------------------------------------------------------------
# DynamoDB assertion helper
# ---------------------------------------------------------------------------
def get_job_status(job_id: str) -> str:
    """Read the current status of a job from the moto DynamoDB table."""
    ddb = boto3.client("dynamodb", region_name=AWS_REGION)
    resp = ddb.get_item(
        TableName=TEST_JOBS_TABLE,
        Key={"jobId": {"S": job_id}},
    )
    item = resp.get("Item", {})
    return item.get("status", {}).get("S", "")


# ---------------------------------------------------------------------------
# S3 assertion helper
# ---------------------------------------------------------------------------
def get_s3_json(key: str) -> dict:
    """Read and parse a JSON object from the moto S3 bucket."""
    s3 = boto3.client("s3", region_name=AWS_REGION)
    obj = s3.get_object(Bucket=TEST_BUCKET, Key=key)
    return json.loads(obj["Body"].read().decode("utf-8"))


def s3_key_exists(key: str) -> bool:
    """Check if an S3 key exists in the moto bucket."""
    s3 = boto3.client("s3", region_name=AWS_REGION)
    try:
        s3.head_object(Bucket=TEST_BUCKET, Key=key)
        return True
    except Exception:
        return False
