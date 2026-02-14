"""
Page analysis pipeline step.

Captures and analyzes a sales page using vision AI.
"""

import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import List, Dict, Any, Tuple

from utils.image import (
    capture_page_screenshots,
    compress_image_if_needed,
    compress_to_base64,
)
from services.openai_service import OpenAIService
from services.prompt_service import PromptService
from data_models import PageAnalysisQualityCheck


logger = logging.getLogger(__name__)


class PageAnalysisQualityError(Exception):
    """Raised when the sales page analysis fails quality checks."""
    pass


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

            # Quality gate: check if the analysis contains meaningful product-specific info
            quality_check = self._check_analysis_quality(analysis, sales_page_url)
            if quality_check.overall_quality_score <= 2:
                missing = []
                if not quality_check.product_name_identified:
                    missing.append("product name")
                if not quality_check.product_type_identified:
                    missing.append("product type")
                if not quality_check.specific_claims_extracted:
                    missing.append("specific claims")
                if not quality_check.target_audience_identified:
                    missing.append("target audience")
                if not quality_check.price_or_offer_identified:
                    missing.append("pricing/offer details")

                error_msg = (
                    f"Sales page analysis quality check failed for URL '{sales_page_url}'. "
                    f"The page analysis did not extract enough product-specific information to proceed. "
                    f"Issues: {quality_check.failure_reason}. "
                    f"Missing: {', '.join(missing) if missing else 'N/A'}. "
                    f"Please verify the URL is accessible, fully rendered, and contains visible product/sales content."
                )
                logger.error(error_msg)
                raise PageAnalysisQualityError(error_msg)

            logger.info(
                f"Page analysis quality check passed (score={quality_check.overall_quality_score}/5) "
                f"for {sales_page_url}"
            )

            return PageAnalysisResult(
                analysis=analysis,
                product_image=product_image_b64,
            )

        except Exception as e:
            logger.error(f"Error analyzing research page: {e}")
            raise

    def _check_analysis_quality(
        self, analysis_text: str, sales_page_url: str
    ) -> PageAnalysisQualityCheck:
        """
        Evaluate whether a page analysis contains meaningful product-specific information.

        Args:
            analysis_text: The vision analysis text to evaluate.
            sales_page_url: The URL that was analyzed (for context).

        Returns:
            PageAnalysisQualityCheck with structured quality assessment.
        """
        prompt = (
            "You are a quality evaluator for sales page analyses. "
            "Below is an AI-generated analysis of a sales/product page. "
            "Evaluate whether the analysis contains real, product-specific information "
            "or is mostly generic/placeholder text that could apply to any page.\n\n"
            f"URL analyzed: {sales_page_url}\n\n"
            f"Analysis to evaluate:\n---\n{analysis_text}\n---\n\n"
            "Rate each dimension and provide an overall quality score."
        )

        return self.openai_service.parse_structured(
            prompt=prompt,
            response_format=PageAnalysisQualityCheck,
            subtask="process_job_v2.analyze_page_quality_check",
            model="gpt-5-mini",
        )

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

    def execute_multiple(self, sales_page_urls: List[str]) -> Tuple[str, str]:
        """
        Analyze one or more sales pages.

        For a single URL, delegates to ``execute()``.
        For multiple URLs, analyzes all in parallel using a thread pool,
        then combines the analyses with labeled sections.

        Args:
            sales_page_urls: List of 1-3 URLs to analyze.

        Returns:
            Tuple of (combined_analysis, product_image_base64).
            The product image comes from the first (primary) URL.

        Raises:
            PageAnalysisQualityError: If any URL fails the quality gate.
            Exception: If any URL fails to be captured/analyzed.
        """
        if len(sales_page_urls) == 1:
            result = self.execute(sales_page_urls[0])
            return result.analysis, result.product_image

        logger.info(f"Analyzing {len(sales_page_urls)} URLs in parallel")

        results: Dict[str, PageAnalysisResult] = {}
        errors: Dict[str, Exception] = {}

        with ThreadPoolExecutor(max_workers=len(sales_page_urls)) as executor:
            future_to_url = {
                executor.submit(self.execute, url): url
                for url in sales_page_urls
            }
            for future in as_completed(future_to_url):
                url = future_to_url[future]
                try:
                    results[url] = future.result()
                    logger.info(f"Completed analysis for: {url}")
                except Exception as e:
                    logger.error(f"Failed to analyze URL {url}: {e}")
                    errors[url] = e

        # Fail-fast: if any URL failed, raise the first error
        if errors:
            first_url = next(iter(errors))
            raise errors[first_url]

        # Combine analyses in original URL order with clear labels
        combined_parts: List[str] = []
        for i, url in enumerate(sales_page_urls, start=1):
            combined_parts.append(f"=== URL {i}: {url} ===\n{results[url].analysis}")
        combined_analysis = "\n\n".join(combined_parts)

        # Use the first URL's product image as the primary
        product_image = results[sales_page_urls[0]].product_image

        logger.info(f"Combined analysis from {len(sales_page_urls)} URLs")
        return combined_analysis, product_image
