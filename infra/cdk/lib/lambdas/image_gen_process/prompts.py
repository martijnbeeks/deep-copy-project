"""
Central prompt repository for image_gen_process Lambda.

All LLM prompts are defined here for maintainability, versioning, and easy iteration.
Each function returns a formatted prompt string ready for LLM consumption.
"""

from typing import List, Dict, Any
import json


def get_detect_product_prompt() -> str:
    """
    Generate prompt for analyzing a reference image to detect product presence.
    
    Used with OpenAI vision to determine if a reference image already contains
    a product image that shouldn't be merged with additional product imagery.
    
    Returns:
        Formatted prompt string for product detection analysis.
    """
    return (
        "Analyze this reference image for advertising/creative purposes. "
        "Does this image contain a visible product image, product photo, or product packaging? "
        "A product image would be a clear photo of a physical product (like a bottle, package, box, etc.) "
        "that is distinct from the background or other elements. "
        "Text-only ads, lifestyle images without products, or abstract designs should have has_product=False. "
        "Provide a brief reasoning for your decision."
    )


def get_summarize_docs_prompt(language: str, text: str) -> str:
    """
    Generate prompt for summarizing foundational research documents.
    
    Args:
        language: Target language for the output.
        text: The foundational document text to summarize.
        
    Returns:
        Formatted prompt string for document summarization.
    """
    return (
        f"Summarize this research into: pains, desires, objections, proof points, hooks. "
        f"Output JSON with keys pains, desires, objections, proofs, hooks. Language: {language}.\n\n{text}"
    )


def get_match_angles_system_prompt() -> str:
    """
    Generate system prompt for matching marketing angles to reference images.
    
    Returns:
        System prompt string for angle-to-image matching.
    """
    return (
        "You assign reference creative image IDs to marketing angles.\n"
        "Rules:\n"
        "- Return ONLY valid JSON.\n"
        "- For each requested slot, choose one image_id from the provided library.\n"
        "- Avoid duplicates across all slots.\n"
        "- Output shape: {\"assignments\":[{\"angle_num\":\"1\",\"variation_num\":\"1\",\"image_id\":\"12.png\"},...]}\n"
    )


def get_match_angles_user_prompt(
    selected_avatar: str,
    used_ids: List[str],
    slots_desc: List[Dict[str, str]],
    images: Dict[str, Any]
) -> str:
    """
    Generate user prompt for matching marketing angles to reference images.
    
    Args:
        selected_avatar: Description of the selected avatar.
        used_ids: List of already used image IDs to avoid duplicates.
        slots_desc: List of slot descriptions needing assignment.
        images: Dictionary of available images with descriptions.
        
    Returns:
        User prompt string for angle-to-image matching.
    """
    return (
        f"Selected avatar: {selected_avatar}\n"
        f"Already used image_ids (do not reuse): {sorted(list(used_ids))}\n"
        f"Slots needing assignment:\n{json.dumps(slots_desc, ensure_ascii=False)}\n\n"
        f"Library (imageId: description):\n{json.dumps(images, ensure_ascii=False)}\n"
    )


def get_image_gen_base_prompt(
    language: str,
    avatar: str,
    angle: str,
    product_name: str = None,
    analysis_json_or_text: str = None
) -> List[str]:
    """
    Generate base prompt parts for image generation.
    
    Args:
        language: Target language for the ad.
        avatar: Description of target avatar.
        angle: Marketing angle for the ad.
        product_name: Optional product name.
        analysis_json_or_text: Optional research summary.
        
    Returns:
        List of prompt strings to join for image generation.
    """
    prompt_parts = [
        f"Generate a high-converting static ad image in {language}.",
        f"Target avatar: {avatar}",
        f"Marketing angle: {angle}",
    ]
    
    if product_name:
        prompt_parts.append(f"Product name: {product_name}")
        # Add explicit instruction to replace any product names in reference
        prompt_parts.append(
            f"IMPORTANT: Replace ALL product names, brand names, and website URLs "
            f"visible in the reference image with '{product_name}'. "
            f"Do NOT copy any product names, brand names, or URLs from the reference image."
        )
    
    if analysis_json_or_text:
        prompt_parts.append(f"Research summary (JSON/text): {analysis_json_or_text}")
    
    return prompt_parts


def get_image_gen_with_product_prompt() -> str:
    """
    Generate prompt instructions for image generation when product image IS supported.
    
    This is appended when the reference image supports product image merging
    and a product image was provided.
    
    Returns:
        Prompt string for product-supported image generation.
    """
    return (
        "Use the provided reference creative image as the layout/style template. "
        "If a product image is provided, incorporate it naturally. "
        "For the color theme: intelligently decide whether to use colors from the product image "
        "or preserve the reference image's color scheme. "
        "Use product image colors when they enhance the ad's appeal and conversion potential, "
        "but preserve the reference image's color theme when it already works well and fits the product. "
        "Prioritize creating a cohesive, high-converting ad that balances visual appeal with brand consistency. "
        "Return only the final image."
    )


def get_image_gen_without_product_prompt_no_support() -> str:
    """
    Generate prompt instructions for image generation when product image is NOT supported.

    This includes explicit blocking instructions to prevent product image inclusion.

    Returns:
        Prompt string for non-product image generation when reference doesn't support products.
    """
    return (
        "CRITICAL: This reference image does NOT support product images. "
        "DO NOT include, merge, add, or reference any product images in the generated image. "
        "Use ONLY the reference creative image as provided. "
        "Ignore and do not copy any product images that may be visible in the reference image itself. "
        "Generate the image using only the reference template without any product imagery.\n"
        "Use the provided reference creative image as the layout/style template. "
        "For the color theme and visual style, intelligently decide what works best: "
        "you may preserve the color theme from the reference image if it fits well, "
        "or choose a color scheme that better matches the target avatar and marketing angle. "
        "Prioritize creating a high-converting ad that resonates with the target audience. "
        "Return only the final image."
    )


def get_image_gen_without_product_prompt_with_support() -> str:
    """
    Generate prompt instructions for image generation when product image IS supported but not provided.

    This is used when the reference image supports product images, but no product image was given.

    Returns:
        Prompt string for non-product image generation when reference supports products.
    """
    return (
        "Use the provided reference creative image as the layout/style template. "
        "For the color theme and visual style, intelligently decide what works best: "
        "you may preserve the color theme from the reference image if it fits well, "
        "or choose a color scheme that better matches the target avatar and marketing angle. "
        "Prioritize creating a high-converting ad that resonates with the target audience. "
        "Return only the final image."
    )
