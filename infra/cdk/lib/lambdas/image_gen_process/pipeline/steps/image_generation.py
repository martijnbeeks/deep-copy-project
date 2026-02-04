"""
Image generation step for image_gen_process pipeline.
"""
from typing import Dict, List, Optional

from services.openai_service import OpenAIService
from services.gemini_service import GeminiService
from utils.logging_config import setup_logging

logger = setup_logging(__name__)


def _build_base_prompt_parts(
    prompt_service,
    language: str,
    avatar: str,
    angle: str,
    product_name: str = None,
    analysis_json_or_text: str = None
) -> List[str]:
    """
    Build base prompt parts for image generation using database-stored prompts.

    Args:
        prompt_service: PromptService for DB-stored prompts.
        language: Target language for the ad.
        avatar: Description of target avatar.
        angle: Marketing angle for the ad.
        product_name: Optional product name.
        analysis_json_or_text: Optional research summary.

    Returns:
        List of prompt strings to join for image generation.
    """
    base_prompt = prompt_service.get_prompt(
        "get_image_gen_base_prompt",
        language=language,
        avatar=avatar,
        angle=angle,
        product_name=product_name or "",
        analysis_json_or_text=analysis_json_or_text or ""
    )

    return [base_prompt]


def _get_without_product_prompt(prompt_service, supports_product: bool) -> str:
    """
    Get the appropriate without-product prompt based on support flag.

    Args:
        prompt_service: PromptService for DB-stored prompts.
        supports_product: Whether the reference image supports product images.

    Returns:
        Prompt string for non-product image generation.
    """
    if not supports_product:
        return prompt_service.get_prompt("get_image_gen_without_product_prompt_no_support")
    else:
        return prompt_service.get_prompt("get_image_gen_without_product_prompt_with_support")

def generate_image_openai(
    openai_service: OpenAIService,
    language: str,
    marketing_avatar: Dict,
    angle: Dict,
    variation: Dict,
    product_name: str,
    analysis_text: Optional[str],
    reference_image_data: Dict[str, str], # base64, mimeType
    product_image_data: Optional[Dict[str, str]], # base64, mimeType
    supports_product: bool,
    job_id: Optional[str],
    prompt_service,
) -> str:
    """
    Generate image using OpenAI (DALL-E 3 / GPT-4o).

    Returns:
        str: Base64 encoded image or raises Exception.
    """
    # 1. Build Prompt
    prompt_parts = _build_base_prompt_parts(
        prompt_service=prompt_service,
        language=language,
        avatar=marketing_avatar.get("description", ""),
        angle=angle.get("angle_name", ""),
        product_name=product_name,
        analysis_json_or_text=analysis_text
    )

    # Add variation description
    prompt_parts.append(f"Visual variation: {variation.get('description', '')}")

    # Add product support instructions
    if supports_product and product_image_data:
        prompt_parts.append(prompt_service.get_prompt("get_image_gen_with_product_prompt"))
    else:
        prompt_parts.append(_get_without_product_prompt(prompt_service, supports_product))

    final_prompt = "\n\n".join(prompt_parts)

    # 2. Call Service
    eff_product_data = product_image_data if supports_product else None

    return openai_service.generate_image(
        prompt=final_prompt,
        reference_image_data=reference_image_data,
        product_image_data=eff_product_data,
        job_id=job_id
    )


def generate_image_nano_banana(
    gemini_service: GeminiService,
    language: str,
    marketing_avatar: Dict,
    angle: Dict,
    variation: Dict,
    product_name: str,
    analysis_text: Optional[str],
    reference_image_bytes: bytes,
    product_image_bytes: Optional[bytes],
    supports_product: bool,
    job_id: Optional[str],
    prompt_service,
) -> str:
    """
    Generate image using Gemini (Nano Banana / Gemini 3 Pro).

    Returns:
        str: Base64 encoded image.
    """
    # 1. Build Prompt (Reusing same components as OpenAI for consistency)
    prompt_parts = _build_base_prompt_parts(
        prompt_service=prompt_service,
        language=language,
        avatar=marketing_avatar.get("description", ""),
        angle=angle.get("angle_name", ""),
        product_name=product_name,
        analysis_json_or_text=analysis_text
    )

    prompt_parts.append(f"Visual variation: {variation.get('description', '')}")

    if supports_product and product_image_bytes:
        prompt_parts.append(prompt_service.get_prompt("get_image_gen_with_product_prompt"))
    else:
        prompt_parts.append(_get_without_product_prompt(prompt_service, supports_product))

    final_prompt = "\n\n".join(prompt_parts)

    # 2. Call Service
    eff_product_bytes = product_image_bytes if supports_product else None

    return gemini_service.generate_image(
        prompt=final_prompt,
        reference_image_bytes=reference_image_bytes,
        product_image_bytes=eff_product_bytes,
        job_id=job_id
    )
