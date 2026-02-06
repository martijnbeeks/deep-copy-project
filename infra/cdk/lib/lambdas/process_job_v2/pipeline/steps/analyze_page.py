"""
Page analysis pipeline step.

Captures and analyzes a sales page using vision AI.
"""

import logging
from dataclasses import dataclass
from typing import List, Dict, Any

from utils.image import (
    capture_page_screenshots,
    compress_image_if_needed,
    compress_to_base64,
)
from services.openai_service import OpenAIService
from services.prompt_service import PromptService


logger = logging.getLogger(__name__)


@dataclass
class PageAnalysisResult:
    """Result of page analysis containing both the analysis text and product image."""
    analysis: str
    product_image: str  # base64-encoded JPEG


class AnalyzePageStep:
    """
    Pipeline step for analyzing a sales/research page.

    Captures a full-page screenshot and analyzes it using vision AI
    to extract product information, claims, and target customer insights.
    Also captures a product image (top portion of the page) for display.
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

    def execute(self, sales_page_url: str) -> PageAnalysisResult:
        """
        Analyze a sales page using GPT-5 Vision.

        Captures both a full-page screenshot (for vision analysis) and a product
        image (top 800px for display) in a single browser session.

        Args:
            sales_page_url: URL of the sales page to analyze.

        Returns:
            PageAnalysisResult with analysis text and product image base64.

        Raises:
            Exception: If page capture or analysis fails.
        """
        try:
            logger.info(f"Capturing page: {sales_page_url}")

            # Capture both screenshots in one browser session
            try:
                screenshots = capture_page_screenshots(sales_page_url)
                # Compress full-page for vision API (max 480KB)
                compressed_bytes = compress_image_if_needed(screenshots.fullpage_bytes, max_size_mb=0.48)
                logger.info(
                    f"Images captured for {sales_page_url}. "
                    f"Full-page original: {len(screenshots.fullpage_bytes)}, "
                    f"Compressed: {len(compressed_bytes)}, "
                    f"Product image: {len(screenshots.product_image_bytes)}"
                )
                base64_image = compress_to_base64(compressed_bytes, max_size_mb=0.48)
                # Compress product image to base64 (max 0.5MB)
                product_image_b64 = compress_to_base64(screenshots.product_image_bytes, max_size_mb=0.5)
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
            analysis = self.openai_service.create_response(
                content=content_payload,
                subtask="process_job_v2.analyze_research_page"
            )
            logger.info("GPT-5 Vision API call completed for research page analysis")

            return PageAnalysisResult(
                analysis=analysis,
                product_image=product_image_b64,
            )

        except Exception as e:
            logger.error(f"Error analyzing research page: {e}")
            raise

    def capture_product_image_only(self, sales_page_url: str) -> str:
        """
        Capture only the product image (top 800px) for cache-hit scenarios.

        Used when research data is cached but we still need a fresh product image.

        Args:
            sales_page_url: URL of the sales page to capture.

        Returns:
            Base64-encoded JPEG of the product image.
        """
        logger.info(f"Capturing product image only for: {sales_page_url}")
        screenshots = capture_page_screenshots(sales_page_url)
        return compress_to_base64(screenshots.product_image_bytes, max_size_mb=0.5)
