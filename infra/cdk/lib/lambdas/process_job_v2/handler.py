"""
AWS Lambda handler for processing AI pipeline jobs.

This module provides the Lambda entry point and event handling.
All business logic is delegated to the pipeline orchestrator and steps.
"""

import json
import os
import uuid

from utils.logging_config import setup_logging
from pipeline.orchestrator import PipelineOrchestrator, PipelineConfig, create_config_from_event


# Initialize logging on module load
logger = setup_logging()


def run_pipeline(event: dict, context) -> dict:
    """
    Execute the Prelander Generator pipeline.
    
    Expected event structure:
    {
        "sales_page_url": "URL of the sales page to analyze",
        "s3_bucket": "S3 bucket to store results",
        "project_name": "Name of the project for organization",
        "job_id": "Optional job identifier",
        "gender": "Optional target gender",
        "location": "Optional target location",
        "research_requirements": "Optional specific research requirements",
        "dev_mode": "true" to use mock results
    }
    
    Args:
        event: Lambda event dictionary.
        context: Lambda context object.
        
    Returns:
        Response dictionary with statusCode and body.
    """
    logger.info("Starting Prelander Generator pipeline")
    logger.info(f"Event: {json.dumps(event)}")
    logger.info(f"Context: {context}")
    
    # Get AWS request ID for telemetry
    aws_request_id = getattr(context, "aws_request_id", None) if context else None
    
    # Initialize the orchestrator
    orchestrator = PipelineOrchestrator(aws_request_id=aws_request_id)
    
    # Create config from event
    config = create_config_from_event(event, orchestrator.aws_services.s3_bucket)
    
    # Run the pipeline
    result = orchestrator.run(config)
    
    return {
        "statusCode": result.status_code,
        "body": result.body
    }


def lambda_handler(event: dict, context) -> dict:
    """
    Lambda entry point for processing AI pipeline jobs.
    
    Handles both direct invocation and API Gateway events by
    parsing the body if present.
    
    Args:
        event: Lambda event (can be direct invocation or from API Gateway).
        context: Lambda context.
        
    Returns:
        Response dict with statusCode and body (JSON string).
    """
    # Handle both direct invocation and API Gateway events
    if isinstance(event, dict) and "body" in event:
        # API Gateway event - parse body
        try:
            if isinstance(event["body"], str):
                event = json.loads(event["body"])
            else:
                event = event["body"]
        except json.JSONDecodeError:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Invalid JSON body"})
            }
    
    # Run the pipeline
    result = run_pipeline(event, context)
    
    # Ensure body is JSON string if it's a dict
    if isinstance(result.get("body"), dict):
        result["body"] = json.dumps(result["body"])
    
    return result


if __name__ == "__main__":
    """
    Local execution entry point for testing.
    """
    job_event_env = os.environ.get("JOB_EVENT_JSON")
    
    try:
        event = json.loads(job_event_env) if job_event_env else {}
    except Exception:
        raise Exception("Failed to load JOB_EVENT_JSON")
    
    # Set defaults for local execution
    event["dev_mode"] = "true"
    event["RESULTS_BUCKET"] = os.environ.get(
        "RESULTS_BUCKET", 
        "deepcopystack-resultsbucketa95a2103-zhwjflrlpfih"
    )
    event["s3_bucket"] = os.environ.get("s3_bucket", event["RESULTS_BUCKET"])
    event["project_name"] = os.environ.get("project_name", "test")
    event["sales_page_url"] = os.environ.get(
        "sales_page_url", 
        "https://naxir.co/products/steadystrap"
    )
    event["job_id"] = os.environ.get("JOB_ID") or event.get("job_id") or str(uuid.uuid4())
    event["notification_email"] = "martijn.beeks@gmail.com"
    
    result = run_pipeline(event, None)
    print(json.dumps(result, indent=2))
