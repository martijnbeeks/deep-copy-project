"""
Image matching step for image_gen_process pipeline.
"""
import json
from typing import Any, Dict, List, Optional, Set

from services.openai_service import OpenAIService
from utils.logging_config import setup_logging
from utils.image import normalize_image_id

logger = setup_logging(__name__)

def match_angles_to_images(
    openai_service: OpenAIService,
    angles: List[Dict[str, Any]],
    marketing_avatar: Dict[str, Any],
    library_images: Dict[str, Any],
    job_id: Optional[str],
    prompt_service,
) -> Dict[str, str]:
    """
    Match marketing angles to available library images using OpenAI.

    Args:
        openai_service: Initialized OpenAIService.
        angles: List of marketing angles.
        marketing_avatar: The selected avatar data.
        library_images: Dictionary of available library images (id -> description).
        job_id: Job identifier.

    Returns:
        Dict[str, str]: Map of "angle_num:variation_num" -> "image_id".
    """
    if not angles or not library_images:
        logger.warning("No angles or no library images to match.")
        return {}

    # Flatten angles into slots
    slots_desc: List[Dict[str, str]] = []
    # If angle structure is unexpected, handle gracefully or assume standard shape
    for ang in angles:
        a_num = str(ang.get("angle_number", ""))
        a_name = ang.get("angle_name", "")
        for var in ang.get("visual_variations", []):
            v_num = str(var.get("variation_number", ""))
            v_desc = var.get("description", "")
            slots_desc.append({
                "angle_num": a_num,
                "angle_name": a_name,
                "variation_num": v_num,
                "variation_desc": v_desc
            })

    if not slots_desc:
        logger.warning("No visual variations found in angles.")
        return {}

    # We map "angle:variation" -> image_id
    final_mapping: Dict[str, str] = {}
    
    # We'll do this in batches if needed, but for now assuming one pass or simple loop
    # The original code did chunking if many slots. Let's try to do all in one go
    # or follow the logic of retries/filling.
    
    # Construct prompts
    avatar_desc = marketing_avatar.get("description", "Target Audience")

    system_prompt = prompt_service.get_prompt("get_match_angles_system_prompt")

    # Use a set to track used image IDs to avoid repetition
    used_ids: Set[str] = set()

    # Build user prompt inline — the DB template stores Python f-string source
    # code rather than a renderable template, so we construct it directly.
    user_prompt = (
        f"Selected avatar: {avatar_desc}\n"
        f"Already used image_ids (do not reuse): {sorted(list(used_ids))}\n"
        f"Slots needing assignment:\n{json.dumps(slots_desc, ensure_ascii=False)}\n\n"
        f"Library (imageId: description):\n{json.dumps(library_images, ensure_ascii=False)}\n"
    )

    logger.info("User prompt (first 500 chars): %s", user_prompt[:500])

    resp_text = openai_service.match_angles_to_images(system_prompt, user_prompt, job_id)

    if not resp_text:
        logger.error("Failed to get response from match_angles_to_images.")
        return {}

    logger.info("match_angles_to_images raw response (first 500 chars): %s", resp_text[:500])

    # JSON parsing logic
    try:
        # Clean potential markdown
        cleaned = resp_text.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]

        data = json.loads(cleaned)
        assignments = data.get("assignments", [])
        logger.info("Parsed %d assignments from response", len(assignments))
        
        for item in assignments:
            # key: "1:1"
            key = f"{item.get('angle_num')}:{item.get('variation_num')}"
            img_id = normalize_image_id(item.get('image_id'))
            
            # Verify image actually exists in library, if not ignoring (or keeping if we trust LLM to not hallucinate ids too bad)
            # The prompt provided library keys.
            # Normalization ensures extension matching.
            
            # Simple check:
            # if img_id not in library_images -> warning
            # But library_images keys usually have extension or not? 
            # The prompt passes library_images keys directly.
            
            final_mapping[key] = img_id
            used_ids.add(img_id)
            
    except Exception as e:
        logger.error("Error parsing match assignments: %s. Raw response: %s", e, resp_text[:500])

    logger.info("Final angle-to-image mapping: %s", final_mapping)
    return final_mapping
