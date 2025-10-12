"""
AWS Lambda handler for extracting customer avatars from product pages.

Expected event format:
{
    "url": "https://example.com/product"
}

Returns:
{
    "success": true,
    "url": "...",
    "avatars": [...]
}
"""
import os
import json
import logging
import boto3
from avatar_extractor import extract_avatars_from_url

# Configure logging
logger = logging.getLogger()
logger.setLevel(logging.INFO)


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


def lambda_handler(event, context):
    """
    Lambda handler for avatar extraction.
    
    Args:
        event: API Gateway event or direct invocation with 'url' parameter
        context: Lambda context
        
    Returns:
        API Gateway response format
    """
    try:
        # Parse input - handle both API Gateway and direct invocation
        if isinstance(event, str):
            body = json.loads(event)
        elif 'body' in event:
            # API Gateway format
            body = json.loads(event['body']) if isinstance(event['body'], str) else event['body']
        else:
            # Direct invocation
            body = event
        
        # Extract URL from request
        url = body.get('url')
        if not url:
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                'body': json.dumps({
                    'error': 'Missing required parameter: url',
                    'example': {'url': 'https://example.com/product'}
                })
            }
        
        # Validate URL format
        if not url.startswith(('http://', 'https://')):
            return {
                'statusCode': 400,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                'body': json.dumps({
                    'error': 'Invalid URL format. URL must start with http:// or https://'
                })
            }
        
        # Get OpenAI API key (check env first for local testing, then Secrets Manager)
        openai_api_key = os.environ.get('OPENAI_API_KEY')
        
        if not openai_api_key:
            # Fall back to Secrets Manager (production)
            try:
                secrets = get_secrets("deepcopy-secret-dev")
                openai_api_key = secrets.get('OPENAI_API_KEY')
            except Exception as e:
                logger.error(f'Failed to retrieve secrets: {e}')
                return {
                    'statusCode': 500,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                    },
                    'body': json.dumps({
                        'error': 'Server configuration error: Failed to retrieve API key from Secrets Manager'
                    })
                }
        
        if not openai_api_key:
            logger.error('OPENAI_API_KEY not found in environment or secrets')
            return {
                'statusCode': 500,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                },
                'body': json.dumps({
                    'error': 'Server configuration error: OPENAI_API_KEY not found'
                })
            }
        
        # Optional: Get model from environment or use default
        model = os.environ.get('OPENAI_MODEL', 'gpt-5-mini')
        
        # Extract avatars
        logger.info(f'Processing request for URL: {url}')
        avatars = extract_avatars_from_url(url, openai_api_key, model)
        
        # Convert to dict for JSON serialization
        response_data = {
            'success': True,
            'url': url,
            'avatars': [avatar.model_dump() for avatar in avatars.avatars]
        }
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps(response_data, indent=2)
        }
        
    except Exception as e:
        logger.error(f'Error processing request: {str(e)}', exc_info=True)
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            'body': json.dumps({
                'error': 'Failed to extract avatars',
                'details': str(e)
            })
        }
