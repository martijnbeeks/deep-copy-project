"""
Pipeline Orchestrator for write_swipe.
"""
import os
import traceback
from typing import Any, Dict, Optional

from utils.logging_config import setup_logging
from services.aws import (
    get_secrets,
    update_job_status,
    save_results_to_s3,
    fetch_results_from_s3,
)
from services.anthropic_service import AnthropicService
from pipeline.steps.template_selection import select_swipe_files_template, load_swipe_file_templates
from pipeline.steps.swipe_generation import rewrite_swipe_file

logger = setup_logging(__name__)

class SwipeGenerationOrchestrator:
    def __init__(self):
        # Initialize secrets
        self.secrets = get_secrets()
        
        # Setup Env from secrets if needed, but services usually check env or we pass explicitly
        if self.secrets.get("ANTHROPIC_API_KEY"):
            os.environ["ANTHROPIC_API_KEY"] = self.secrets.get("ANTHROPIC_API_KEY")
            
        self.anthropic = AnthropicService()
        
    def run(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run the swipe generation pipeline.
        """
        original_job_id = event.get('original_job_id')
        job_id = event.get('job_id')
        select_angle = event.get('select_angle')
        swipe_file_ids = event.get('swipe_file_ids', [])
        
        # Normalize swipe_file_ids
        if isinstance(swipe_file_ids, str):
            swipe_file_ids = [swipe_file_ids]
            
        if not job_id or not select_angle:
             raise ValueError(f"Missing required parameters: job_id={job_id}, select_angle={select_angle}")

        try:
            update_job_status(job_id, "RUNNING", {"message": "Processing swipe file generation"})
            
            # Dev Mode Check (stubbed logic, can implement full mock if needed)
            if event.get("dev_mode"):
                 logger.info("Dev mode detected - check handler for implementation if needed or implement here")
                 # Typically we might return mock here.
                 # For brevity, implementing Mock return:
                 mock_res = {"statusCode": 200, "message": "Dev Mode Mock Success"}
                 update_job_status(job_id, "SUCCEEDED", {"resultKey": "mock/key"})
                 return mock_res

            # 1. Fetch Job Results (Inputs)
            logger.info(f"Fetching inputs from original job {original_job_id}")
            results = fetch_results_from_s3(os.environ.get("RESULTS_BUCKET"), f"results/{original_job_id}/comprehensive_results.json")
            if not results:
                raise RuntimeError(f"Could not fetch results for {original_job_id}")
                
            job_results = results.get("results", {})
            
            # Extract required data
            research_page_analysis = job_results.get("research_page_analysis", "")
            deep_research_output = job_results.get("deep_research_output", "")
            avatar_sheet = job_results.get("avatar_sheet", "") # Might be object or string?
            offer_brief = job_results.get("offer_brief", "")
            marketing_philosophy = job_results.get("marketing_philosophy_analysis", "")
            summary = job_results.get("summary", "")
            
            # 2. Template Selection (if needed)
            if not swipe_file_ids:
                swipe_file_ids = select_swipe_files_template(select_angle, research_page_analysis, summary)
            
            # 3. Load Templates
            swipe_htmls, swipe_jsons = load_swipe_file_templates(swipe_file_ids)
            
            # Config map
            swipe_config = {}
            for i, tid in enumerate(swipe_file_ids):
                swipe_config[tid] = {
                    "html": swipe_htmls[i] if i < len(swipe_htmls) else None,
                    "json": swipe_jsons[i] if i < len(swipe_jsons) else None
                }
                
            # 4. Generate Rewrites
            final_results = rewrite_swipe_file(
                select_angle=select_angle,
                marketing_avatar=str(avatar_sheet), # ensuring string for prompt
                deep_research=str(deep_research_output),
                offer_brief=str(offer_brief),
                marketing_philosophy=str(marketing_philosophy),
                summary=str(summary),
                swipe_file_config=swipe_config,
                anthropic_service=self.anthropic,
                job_id=job_id
            )
            
            # 5. Save & Finish
            s3_key_res = f'results/swipe_files/{job_id}/swipe_files_results.json'
            save_results_to_s3(os.environ.get("RESULTS_BUCKET"), s3_key_res, final_results) # using key directly?
            # actually save_results_to_s3 in AWS service took (bucket, key, data)
            
            # Update AWS service to match original handler usage or adapt?
            # Original handler calculated key. My AWS service helper assumes I pass bucket and key.
            # I pass bucket and key above.
            
            update_job_status(job_id, "SUCCEEDED", {"resultKey": s3_key_res})
            
            return {'statusCode': 200, 'message': 'Swipe file generation completed successfully'}

        except Exception as e:
            logger.error(f"Pipeline failed: {e}", exc_info=True)
            update_job_status(job_id, "FAILED", {"error": str(e)})
            raise
