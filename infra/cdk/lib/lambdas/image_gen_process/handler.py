"""
AWS Lambda handler for image_gen_process.

This module provides the Lambda entry point.
All business logic is delegated to the pipeline orchestrator.
"""

import json
import os
import uuid

import sentry_sdk
from sentry_sdk.integrations.aws_lambda import AwsLambdaIntegration

from utils.logging_config import setup_logging
from pipeline.orchestrator import ImageGenOrchestrator

sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN", ""),
    integrations=[AwsLambdaIntegration()],
    traces_sample_rate=0.1,
    environment=os.environ.get("ENVIRONMENT", "prod"),
)

# Initialize logging on module load
logger = setup_logging()

def lambda_handler(event: dict, context) -> dict:
    """
    Lambda entry point for image generation process.
    
    Args:
        event: Lambda event.
        context: Lambda context.
        
    Returns:
        Response dict with statusCode and body.
    """
    logger.info("Received event: %s", json.dumps(event)[:1000]) # Log first 1000 chars
    
    # Get AWS request ID
    aws_request_id = getattr(context, "aws_request_id", None) if context else str(uuid.uuid4())
    
    # Initialize Orchestrator
    orchestrator = ImageGenOrchestrator(aws_request_id=aws_request_id)
    
    # Handle API Gateway wrapping if needed (though this lambda usually invoked directly via StepFunctions or SNS?)
    # But for safety, check body
    payload = event
    if "body" in event and isinstance(event["body"], str):
        try:
            payload = json.loads(event["body"])
        except:
            pass
    
    # Run Pipeline
    try:
        return orchestrator.run(payload)
    except Exception as e:
        logger.error("Unhandled exception in lambda_handler: %s", e)
        sentry_sdk.capture_exception(e)
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }

if __name__ == "__main__":
    """
    Local execution entry point for testing.
    """
    # Setup dummy env if needed
    if not os.environ.get("RESULTS_BUCKET"):
        logger.warning("RESULTS_BUCKET env var not set for local run.")

    # Load event from file or use dummy
    test_event = {
        "job_id": "816291a5-8e63-4f09-aeb6-58efbab66ff1",
        "project_name": "Test Project",
        "productName": "MeritRelief",
        "selectedAvatar": "Men 50-65, skeptical, wants fast relief",
        "selectedAngles": [
            "Pain relief without pills",
            "Get back to walking comfortably"
        ],
        "language": "english",
        "productImageUrls": [
            "https://static.vecteezy.com/system/resources/thumbnails/057/068/323/small/single-fresh-red-strawberry-on-table-green-background-food-fruit-sweet-macro-juicy-plant-image-photo.jpg"
        ],
        "forcedReferenceImageIds": ["12.png", "23.png"],
    }
    
    print(lambda_handler(test_event, None))