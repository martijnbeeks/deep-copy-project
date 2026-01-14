"""
AWS Lambda handler for write_swipe.
"""
import json
import logging
from pipeline.orchestrator import SwipeGenerationOrchestrator

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
        return {'statusCode': 500, 'error': str(e)}

if __name__ == "__main__":
    # Local Test
    import os
    os.environ['RESULTS_BUCKET'] = 'deepcopystack-resultsbucketa95a2103-zhwjflrlpfih'
    test_evt = {
         "original_job_id": "test-job-id",
         "job_id": "test-swipe-job",
         "select_angle": "Test Angle",
         "swipe_file_ids": ["L00002"]
    }
    # Might fail if secrets not accessible locally
    lambda_handler(test_evt, None)