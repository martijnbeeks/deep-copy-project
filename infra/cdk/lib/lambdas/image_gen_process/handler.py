"""
AWS Lambda handler for image_gen_process.

This module provides the Lambda entry point.
All business logic is delegated to the pipeline orchestrator.
"""

import json
import os
import uuid

from utils.logging_config import setup_logging
from pipeline.orchestrator import ImageGenOrchestrator

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
        "job_id": "local-test-1",
        "project_name": "Test Project",
        "marketing_avatar": {"description": "Tech Enthusiast"},
        "marketing_angles": [
            {
                "angle_number": 1,
                "angle_name": "Productivity",
                "visual_variations": [{"variation_number": 1, "description": "Working at desk"}]
            }
        ],
        "library_images": {"10.png": "Desk setup"},
        "product_name": "SuperMouse",
        "language": "English"
    }
    
    print(lambda_handler(test_event, None))