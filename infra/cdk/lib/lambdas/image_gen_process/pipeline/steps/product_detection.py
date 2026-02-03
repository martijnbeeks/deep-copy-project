"""
Product detection step for image_gen_process pipeline.
"""
from typing import Optional
from services.openai_service import OpenAIService
from utils.logging_config import setup_logging

logger = setup_logging(__name__)

def detect_product_in_image(
    openai_service: OpenAIService,
    image_bytes: bytes,
    job_id: Optional[str],
    prompt_service,
) -> bool:
    """
    Detect if the reference image contains a product.

    Args:
        openai_service: Initialized OpenAIService.
        image_bytes: Raw bytes of the reference image.
        job_id: Job identifier for logging/metrics.
        prompt_service: PromptService for DB-stored prompts.

    Returns:
        bool: True if product is detected, False otherwise.
    """
    return openai_service.detect_product_in_image(image_bytes, job_id, prompt_service=prompt_service)
