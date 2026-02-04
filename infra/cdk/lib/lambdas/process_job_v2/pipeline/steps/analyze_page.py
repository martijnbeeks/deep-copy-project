"""
Page analysis pipeline step.

Captures and analyzes a sales page using vision AI.
"""

import base64
import logging
from typing import List, Dict, Any

from utils.image import save_fullpage_png, compress_image_if_needed
from services.openai_service import OpenAIService
from services.prompt_service import PromptService


logger = logging.getLogger(__name__)


class AnalyzePageStep:
    """
    Pipeline step for analyzing a sales/research page.

    Captures a full-page screenshot and analyzes it using vision AI
    to extract product information, claims, and target customer insights.
    """

    def __init__(self, openai_service: OpenAIService, prompt_service: PromptService):
        """
        Initialize the page analysis step.

        Args:
            openai_service: OpenAI service for vision analysis.
            prompt_service: PromptService for DB-stored prompts.
        """
        self.openai_service = openai_service
        self.prompt_service = prompt_service
    
    def execute(self, sales_page_url: str) -> str:
        """
        Analyze a sales page using GPT-5 Vision.
        
        Captures a screenshot of the page and sends it to the vision model
        for analysis of the product, claims, proof, and overall offer.
        
        Args:
            sales_page_url: URL of the sales page to analyze.
            
        Returns:
            Analysis text describing the product and potential customers.
            
        Raises:
            Exception: If page capture or analysis fails.
        """
        try:
            logger.info(f"Capturing page: {sales_page_url}")
            
            # Capture and compress screenshot
            try:
                screenshot_bytes = save_fullpage_png(sales_page_url)
                # Compress if needed (max 480KB for safe API limits)
                compressed_bytes = compress_image_if_needed(screenshot_bytes, max_size_mb=0.48)
                logger.info(
                    f"Image captured for {sales_page_url}. "
                    f"Original: {len(screenshot_bytes)}, Compressed: {len(compressed_bytes)}"
                )
                base64_image = base64.b64encode(compressed_bytes).decode("utf-8")
            except Exception as e:
                logger.error(f"Failed to capture or encode image from {sales_page_url}: {e}")
                raise
            
            # Build content payload with text and image
            prompt = self.prompt_service.get_prompt("get_analyze_research_page_prompt")
            content_payload: List[Dict[str, Any]] = [
                {"type": "input_text", "text": prompt},
                {"type": "input_image", "image_url": f"data:image/jpeg;base64,{base64_image}"}
            ]
            
            logger.info("Calling GPT-5 Vision API for research page analysis")
            result = self.openai_service.create_response(
                content=content_payload,
                subtask="process_job_v2.analyze_research_page"
            )
            logger.info("GPT-5 Vision API call completed for research page analysis")
            
            return result
            
        except Exception as e:
            logger.error(f"Error analyzing research page: {e}")
            raise
