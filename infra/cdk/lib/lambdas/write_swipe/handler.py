"""
AWS Lambda handler for processing swipe file generation jobs asynchronously.

Expected event format:
{
    "original_job_id": "uuid",
    "job_id": "uuid-swipe",
    "select_angle": "Marketing angle description"
}

Saves results to S3 and updates DynamoDB job status.
"""
import os
import json
import logging
import boto3
from datetime import datetime, timezone
import anthropic
from swipe_file_writer import rewrite_swipe_file


# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
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
    """Save swipe files results to S3."""
    results_bucket = os.environ.get('RESULTS_BUCKET')
    if not results_bucket:
        raise RuntimeError("RESULTS_BUCKET environment variable not set")
    
    s3_key = f'results/swipe_files/{job_id}/swipe_files_results.json'
    
    s3_client.put_object(
        Bucket=results_bucket,
        Key=s3_key,
        Body=json.dumps(results, ensure_ascii=False, indent=2),
        ContentType='application/json'
    )
    
    logger.info(f"Saved results to S3: s3://{results_bucket}/{s3_key}")
    return s3_key

def fetch_results_from_s3(job_id: str):
    """Fetch results from S3 based on job_id."""
    results_bucket = os.environ.get('RESULTS_BUCKET')
    if not results_bucket:
        raise RuntimeError("RESULTS_BUCKET environment variable not set")
    
    s3_key = f'results/{job_id}/comprehensive_results.json'
    obj = s3_client.get_object(Bucket=results_bucket, Key=s3_key)
    return json.loads(obj['Body'].read().decode('utf-8'))


def select_swipe_files_template(select_angle: str, research_page_analysis: str, product_summary: str):
    """Select swipe files template based on product summary."""
    # TODO: Implement this
    return ["A00002"]


def load_swipe_file_templates(swipe_file_template_ids: list[str]):
    """Load swipe file templates from S3 and return raw HTML and JSON objects."""
    results_bucket = os.environ.get('RESULTS_BUCKET')
    if not results_bucket:
        raise RuntimeError("RESULTS_BUCKET environment variable not set")
    
    swipe_file_html = []
    swipe_file_json = []
    for swipe_file_template_id in swipe_file_template_ids:
        
        # Load HTML file
        s3_key = f'content_library/{swipe_file_template_id}_original.html'
        obj = s3_client.get_object(Bucket=results_bucket, Key=s3_key)
        html_content = obj['Body'].read().decode('utf-8')
        swipe_file_html.append(html_content)
        
        # Load JSON file
        s3_key = f'content_library/{swipe_file_template_id}.json'
        obj = s3_client.get_object(Bucket=results_bucket, Key=s3_key)
        json_content = json.loads(obj['Body'].read().decode('utf-8'))
        swipe_file_json.append(json_content)
        
    return swipe_file_html, swipe_file_json


def lambda_handler(event, context):
    """
    Lambda handler for processing swipe file generation jobs.
    
    Args:
        event: Direct invocation with 'original_job_id', 'job_id', and 'select_angle' parameters
        context: Lambda context
        
    Returns:
        Success/failure status
    """
    original_job_id = event.get('original_job_id')
    job_id = event.get('job_id')
    select_angle = event.get('select_angle')
    
    swipe_file_ids = event.get('swipe_file_ids', [])
    # check if swipe_file_ids is a number / string, make a list of it
    if isinstance(swipe_file_ids, (str)):
        swipe_file_ids = [swipe_file_ids]
    
    if not job_id or not select_angle:
        error_msg = f"Missing required parameters: job_id={job_id}, select_angle={select_angle}"
        logger.error(error_msg)
        return {'statusCode': 400, 'error': error_msg}
    
    try:
        # Update status to RUNNING
        update_job_status(job_id, "RUNNING", {"message": "Processing swipe file generation"})
        
        if event.get("dev_mode"):
            logger.info(f"Dev mode detected for job {job_id}. Using mock results.")
            try:
                # Mock source
                mock_key = "results/all_results.json"
                results_bucket = os.environ.get('RESULTS_BUCKET')
                
                # Fetch mock
                s3_response = s3_client.get_object(Bucket=results_bucket, Key=mock_key)
                results = json.loads(s3_response['Body'].read().decode('utf-8'))
                
                # Save to S3
                s3_key = save_results_to_s3(job_id, results)
                
                # Update status to SUCCEEDED
                update_job_status(job_id, "SUCCEEDED", {"resultKey": s3_key})
                
                return {'statusCode': 200, 'message': 'Swipe file generation completed successfully (DEV MODE)'}
            except Exception as e:
                logger.error(f"Dev mode failed: {e}")
                update_job_status(job_id, "FAILED", {"error": str(e)})
                return {'statusCode': 500, 'error': str(e)}
        
        try:
            secrets = get_secrets("deepcopy-secret-dev")
            anthropic_api_key = secrets.get('ANTHROPIC_API_KEY')
        except Exception as e:
            logger.error(f'Failed to retrieve secrets: {e}')
            update_job_status(job_id, "FAILED", {"error": "Failed to retrieve API key from Secrets Manager"})
            raise
        
        if not anthropic_api_key:
            error_msg = 'ANTHROPIC_API_KEY not found in environment or secrets'
            logger.error(error_msg)
            update_job_status(job_id, "FAILED", {"error": error_msg})
            raise RuntimeError(error_msg)
        
        # Initialize Anthropic client
        anthropic_client = anthropic.Anthropic(api_key=anthropic_api_key)
        
        # Process swipe file generation
        logger.info(f'Processing swipe file generation for job {job_id}')
        
        # Fetch results based on original_job_id
        results = fetch_results_from_s3(original_job_id)
        job_results = results.get("results", {})
        research_page_analysis = job_results.get("research_page_analysis")
        deep_research_output = job_results.get("deep_research_output")
        avatar_sheet = job_results.get("avatar_sheet")
        offer_brief = job_results.get("offer_brief")
        marketing_philosophy_analysis = job_results.get("marketing_philosophy_analysis")
        summary = job_results.get("summary")
        angles = job_results.get("marketing_angles", [])
        
        # Select swipe files (3) template based on product summary
        if not swipe_file_ids:
            logger.info(f"No swipe file IDs provided, selecting swipe files based on product summary")
            swipe_file_ids = select_swipe_files_template(select_angle, research_page_analysis, summary)
        
        # Load swipe file template from S3
        swipe_file_html_list, swipe_file_json_list = load_swipe_file_templates(swipe_file_ids)
        
        swipe_file_config = {}
        for i, template_id in enumerate(swipe_file_ids):
            swipe_file_config[template_id] = {
                "html": swipe_file_html_list[i] if i < len(swipe_file_html_list) else None,
                "json": swipe_file_json_list[i] if i < len(swipe_file_json_list) else None
            }
        
        
        # Generate swipe files based on the selected templates
        swipe_files = rewrite_swipe_file(
            select_angle, avatar_sheet, deep_research_output, offer_brief, marketing_philosophy_analysis, swipe_file_config, anthropic_client
        )
        

        s3_key = save_results_to_s3(job_id, swipe_files)
        
        # Update status to SUCCEEDED
        update_job_status(job_id, "SUCCEEDED", {"resultKey": s3_key})
        
        logger.info(f'Successfully completed swipe file generation for job {job_id}')
        return {'statusCode': 200, 'message': 'Swipe file generation completed successfully'}
        
    except Exception as e:
        error_msg = f'Error processing swipe file generation: {str(e)}'
        logger.error(error_msg, exc_info=True)
        update_job_status(job_id, "FAILED", {"error": str(e)})
        return {'statusCode': 500, 'error': error_msg}


if __name__ == "__main__":
    # Local testing
    # set RESULTS_BUCKET to the results bucket
    os.environ['RESULTS_BUCKET'] = 'deepcopystack-resultsbucketa95a2103-zhwjflrlpfih'
    test_event = {
        "original_job_id": "03479dbf-bc4c-4472-80ff-b11b561b8777",
        "job_id": "03479dbf-bc4c-4472-80ff-b11b561b8777-swipe",
        "select_angle": "Embarrassment & Professional Confidence: 'Restore the beard you earned—no flakes in meetings.'",
        "swipe_file_ids": ["L00002"],
        "dev_mode": os.environ.get('dev_mode', 'false').lower() == 'true',
    }
    lambda_handler(test_event, {})