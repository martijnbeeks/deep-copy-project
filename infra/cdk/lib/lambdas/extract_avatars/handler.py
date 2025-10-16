"""
AWS Lambda handler for processing avatar extraction jobs asynchronously.

Expected event format:
{
    "job_id": "uuid",
    "url": "https://example.com/product"
}

Saves results to S3 and updates DynamoDB job status.
"""
import os
import json
import logging
import boto3
from datetime import datetime, timezone
from avatar_extractor import extract_avatars_from_url

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)

# Initialize AWS clients
s3_client = boto3.client('s3')
ddb_client = boto3.client('dynamodb')


def get_secrets(secret_id: str = "deepcopy-secret-dev"):
    """
    Get secrets from AWS Secrets Manager.
    Uses the same secret as the ECS pipeline.
    """
    try:
        aws_region = os.environ.get('AWS_REGION', 'eu-west-1')
        client = boto3.client('secretsmanager', region_name=aws_region)
        response = client.get_secret_value(SecretId=secret_id)
        return json.loads(response['SecretString'])
    except Exception as e:
        logger.error(f"Error getting secrets from {secret_id}: {e}")
        raise


def update_job_status(job_id: str, status: str, extra_attrs: dict = None):
    """Update job status in DynamoDB."""
    jobs_table_name = os.environ.get('JOBS_TABLE_NAME')
    if not jobs_table_name or not job_id:
        return
    
    try:
        item = {
            'jobId': {'S': job_id},
            'status': {'S': status},
            'updatedAt': {'S': datetime.now(timezone.utc).isoformat()},
        }
        if extra_attrs:
            for key, value in extra_attrs.items():
                if isinstance(value, (str, int, float)):
                    item[key] = {'S': str(value)}
                else:
                    item[key] = {'S': json.dumps(value, ensure_ascii=False)}
        ddb_client.put_item(TableName=jobs_table_name, Item=item)
    except Exception as e:
        logger.error(f"Failed to update job status for {job_id}: {e}")


def save_results_to_s3(job_id: str, results: dict):
    """Save avatar extraction results to S3."""
    results_bucket = os.environ.get('RESULTS_BUCKET')
    if not results_bucket:
        raise RuntimeError("RESULTS_BUCKET environment variable not set")
    
    s3_key = f'results/{job_id}/avatar_extraction_results.json'
    
    s3_client.put_object(
        Bucket=results_bucket,
        Key=s3_key,
        Body=json.dumps(results, ensure_ascii=False, indent=2),
        ContentType='application/json'
    )
    
    logger.info(f"Saved results to S3: s3://{results_bucket}/{s3_key}")
    return s3_key


def lambda_handler(event, context):
    """
    Lambda handler for processing avatar extraction jobs.
    
    Args:
        event: Direct invocation with 'job_id' and 'url' parameters
        context: Lambda context
        
    Returns:
        Success/failure status
    """
    job_id = event.get('job_id')
    url = event.get('url')
    
    if not job_id or not url:
        error_msg = f"Missing required parameters: job_id={job_id}, url={url}"
        logger.error(error_msg)
        return {'statusCode': 400, 'error': error_msg}
    
    try:
        # Update status to RUNNING
        update_job_status(job_id, "RUNNING", {"message": "Processing avatar extraction"})
        
        # Get OpenAI API key (check env first for local testing, then Secrets Manager)
        openai_api_key = os.environ.get('OPENAI_API_KEY')
        
        if not openai_api_key:
            # Fall back to Secrets Manager (production)
            try:
                secrets = get_secrets("deepcopy-secret-dev")
                openai_api_key = secrets.get('OPENAI_API_KEY')
            except Exception as e:
                logger.error(f'Failed to retrieve secrets: {e}')
                update_job_status(job_id, "FAILED", {"error": "Failed to retrieve API key from Secrets Manager"})
                raise
        
        if not openai_api_key:
            error_msg = 'OPENAI_API_KEY not found in environment or secrets'
            logger.error(error_msg)
            update_job_status(job_id, "FAILED", {"error": error_msg})
            raise RuntimeError(error_msg)
        
        # Get model from environment or use default
        model = os.environ.get('OPENAI_MODEL', 'gpt-4o')
        
        # Extract avatars using OpenAI
        logger.info(f'Processing avatar extraction for job {job_id}, URL: {url}')
        avatars = extract_avatars_from_url(url, openai_api_key, model)
        
        # Prepare results
        results = {
            'success': True,
            'url': url,
            'job_id': job_id,
            'timestamp_iso': datetime.now(timezone.utc).isoformat(),
            'avatars': [avatar.model_dump() for avatar in avatars.avatars]
        }
        
        # Save to S3
        s3_key = save_results_to_s3(job_id, results)
        
        # Update status to SUCCEEDED
        update_job_status(job_id, "SUCCEEDED", {"resultKey": s3_key})
        
        logger.info(f'Successfully completed avatar extraction for job {job_id}')
        return {'statusCode': 200, 'message': 'Avatar extraction completed successfully'}
        
    except Exception as e:
        error_msg = f'Error processing avatar extraction: {str(e)}'
        logger.error(error_msg, exc_info=True)
        update_job_status(job_id, "FAILED", {"error": str(e)})
        return {'statusCode': 500, 'error': error_msg}


if __name__ == "__main__":
    # Local testing
    test_event = {
        "job_id": "test-job-123",
        "url": "https://hypowered.nl/en"
    }
    print(lambda_handler(test_event, {}))