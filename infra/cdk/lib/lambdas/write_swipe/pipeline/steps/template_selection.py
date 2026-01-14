"""
Template selection step for write_swipe pipeline.
"""
import os
import json
from typing import List, Tuple, Any
from services.aws import s3_client
from utils.logging_config import setup_logging

logger = setup_logging(__name__)

def select_swipe_files_template(select_angle: str, research_page_analysis: str, product_summary: str) -> List[str]:
    """Select swipe files template based on product summary."""
    # TODO: Implement smart selection logic based on inputs
    # For now returning hardcoded default as per original
    logger.info(f"Selecting swipe file for angle: {select_angle[:50]}...")
    return ["A00002"]

def load_swipe_file_templates(swipe_file_template_ids: List[str]) -> Tuple[List[str], List[Any]]:
    """Load swipe file templates from S3 and return raw HTML and JSON objects."""
    results_bucket = os.environ.get('RESULTS_BUCKET')
    if not results_bucket:
        raise RuntimeError("RESULTS_BUCKET environment variable not set")
    
    swipe_file_html = []
    swipe_file_json = []
    
    for swipe_file_template_id in swipe_file_template_ids:
        try:
            # Load HTML file
            # Original code assumes content_library/{id}_original.html
            s3_key_html = f'content_library/{swipe_file_template_id}_original.html'
            obj_html = s3_client.get_object(Bucket=results_bucket, Key=s3_key_html)
            html_content = obj_html['Body'].read().decode('utf-8')
            swipe_file_html.append(html_content)
            
            # Load JSON file
            s3_key_json = f'content_library/{swipe_file_template_id}.json'
            obj_json = s3_client.get_object(Bucket=results_bucket, Key=s3_key_json)
            json_content = json.loads(obj_json['Body'].read().decode('utf-8'))
            swipe_file_json.append(json_content)
            
        except Exception as e:
            logger.error(f"Failed to load template {swipe_file_template_id}: {e}")
            # If fail, append None or re-raise? Original code didn't handle iteration failure explicitly inside loop
            # We'll re-raise for now as templates are critical
            raise

    return swipe_file_html, swipe_file_json
