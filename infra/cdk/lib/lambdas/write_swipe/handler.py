"""
AWS Lambda handler for write_swipe.
"""
import json
import logging
import os

import sentry_sdk
from sentry_sdk.integrations.aws_lambda import AwsLambdaIntegration

from pipeline.orchestrator import SwipeGenerationOrchestrator

sentry_sdk.init(
    dsn=os.environ.get("SENTRY_DSN", ""),
    integrations=[AwsLambdaIntegration()],
    traces_sample_rate=0.1,
    environment=os.environ.get("ENVIRONMENT", "prod"),
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

def lambda_handler(event, context):
    """
    Lambda handler for processing swipe file generation jobs.
    """
    logger.info(f"Received event: {json.dumps(event)[:1000]}")
    
    orchestrator = SwipeGenerationOrchestrator()
    
    try:
        return orchestrator.run(event)
    except Exception as e:
        logger.error(f"Handler failed: {e}")
        sentry_sdk.capture_exception(e)
        return {'statusCode': 500, 'error': str(e)}

if __name__ == "__main__":
    # Local Test
    import os
    os.environ['RESULTS_BUCKET'] = 'deepcopystack-resultsbucketa95a2103-zhwjflrlpfih'
    test_evt = {
         "original_job_id": "47fdceed-c87a-4d4c-b41d-8eadb85d5f5d",
         "job_id": "47fdceed-c87a-4d4c-b41d-8eadb85d5f5d-swipe",
         "avatar_id": "weekend-warrior-recreational-athlete",
         "angle_id": "angle-1-return-fast-performance",
         "swipe_file_ids": ["AD0001_AUTHORITY"],
         "image_style": "realistic"
    }
    # Might fail if secrets not accessible locally
    lambda_handler(test_evt, None)