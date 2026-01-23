"""
Pipeline Orchestrator for write_swipe.
"""
import os
import traceback
import json
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
        avatar_id = event.get('avatar_id')
        angle_id = event.get('angle_id')
        swipe_file_ids = event.get('swipe_file_ids', [])
        
        # Normalize swipe_file_ids
        if isinstance(swipe_file_ids, str):
            swipe_file_ids = [swipe_file_ids]
            
        if not job_id or not avatar_id or not angle_id:
             raise ValueError(f"Missing required parameters: job_id={job_id}, avatar_id={avatar_id}, angle_id={angle_id}")

        try:
            update_job_status(job_id, "RUNNING", {"message": "Processing swipe file generation"})
            
            # Dev Mode Check
            if event.get("dev_mode"):
                 logger.info("Dev mode detected - using mock results")
                 mock_source_job_id = "ebebbc1b-ee10-4376-be52-98b119f215a7-swipe"
                 mock_key = f"results/swipe_files/{mock_source_job_id}/swipe_files_results.json"
                 bucket = os.environ.get("RESULTS_BUCKET")
                 
                 mock_data = fetch_results_from_s3(bucket, mock_key)
                 if not mock_data:
                     logger.warning(f"Mock data not found at {mock_key}")
                     mock_data = {"message": "Mock data not found", "mock_source": mock_source_job_id}
                 
                 target_key = f"results/swipe_files/{job_id}/swipe_files_results.json"
                 save_results_to_s3(bucket, target_key, mock_data)
                 
                 update_job_status(job_id, "SUCCEEDED", {"resultKey": target_key})
                 return {'statusCode': 200, 'message': 'Swipe file generation completed successfully (DEV MODE)'}

            # 1. Fetch Job Results (Inputs)
            logger.info(f"Fetching inputs from original job {original_job_id}")
            results = fetch_results_from_s3(os.environ.get("RESULTS_BUCKET"), f"results/{original_job_id}/comprehensive_results.json")
            if not results:
                raise RuntimeError(f"Could not fetch results for {original_job_id}")
                
            job_results = results.get("results", {})
            
            # Find the specific avatar and angle from the results
            marketing_avatars = job_results.get("marketing_avatars", [])
            selected_avatar = None
            selected_angle = None
            
            for m_avatar in marketing_avatars:
                av = m_avatar.get("avatar", {})
                if av.get("id") == avatar_id:
                    selected_avatar = av
                    # Look for angle in this avatar's generated angles
                    angles_data = m_avatar.get("angles", {})
                    generated_angles = angles_data.get("generated_angles", [])
                    for ang in generated_angles:
                        if ang.get("id") == angle_id:
                            selected_angle = ang
                            break
                if selected_avatar and selected_angle:
                    break
            
            if not selected_avatar:
                raise ValueError(f"Avatar with ID {avatar_id} not found in job results")
            if not selected_angle:
                raise ValueError(f"Marketing angle with ID {angle_id} not found for avatar {avatar_id}")

            logger.info(f"Processing Swipe Generation for Avatar: {selected_avatar.get('overview', {}).get('name', 'Unknown')} (ID: {avatar_id})")
            logger.info(f"Using Marketing Angle: {selected_angle.get('angle_title', 'Unknown')} (ID: {angle_id})")

            # Prepare text representations for LLM prompts
            select_angle_text = f"Title: {selected_angle.get('angle_title')}\nSubtitle: {selected_angle.get('angle_subtitle')}\nCore Argument: {selected_angle.get('core_argument')}\nType: {selected_angle.get('angle_type')}"
            marketing_avatar_text = json.dumps(selected_avatar, indent=2)

            # Extract other required data
            research_page_analysis = job_results.get("research_page_analysis", "")
            deep_research_output = job_results.get("deep_research_output", "")
            offer_brief = job_results.get("offer_brief", "")
            marketing_philosophy = job_results.get("marketing_philosophy_analysis", "")
            summary = job_results.get("summary", "")
            
            # 2. Template Selection (if needed)
            if not swipe_file_ids:
                # Use the angle title or description for template selection context
                angle_context = f"{selected_angle.get('angle_title')}: {selected_angle.get('core_argument')}"
                swipe_file_ids = select_swipe_files_template(angle_context, research_page_analysis, summary)
            
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
                select_angle=select_angle_text,
                marketing_avatar=marketing_avatar_text,
                deep_research=str(deep_research_output),
                offer_brief=str(offer_brief),
                marketing_philosophy=str(marketing_philosophy),
                summary=str(summary),
                swipe_file_config=swipe_config,
                anthropic_service=self.anthropic,
                job_id=job_id
            )

            # Include context IDs in the final result
            final_results['avatar_id'] = avatar_id
            final_results['angle_id'] = angle_id
            
            # 5. Save & Finish
            s3_key_res = f'results/swipe_files/{job_id}/swipe_files_results.json'
            save_results_to_s3(os.environ.get("RESULTS_BUCKET"), s3_key_res, final_results)
            
            update_job_status(job_id, "SUCCEEDED", {"resultKey": s3_key_res})
            
            return {'statusCode': 200, 'message': 'Swipe file generation completed successfully'}

        except Exception as e:
            logger.error(f"Pipeline failed: {e}", exc_info=True)
            update_job_status(job_id, "FAILED", {"error": str(e)})
            raise
