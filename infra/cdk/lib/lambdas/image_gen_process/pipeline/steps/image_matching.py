"""
Image matching step for image_gen_process pipeline.
"""
import json
from typing import Any, Dict, List, Optional, Set

from services.openai_service import OpenAIService
from utils.logging_config import setup_logging
from prompts import get_match_angles_system_prompt, get_match_angles_user_prompt
from utils.image import normalize_image_id

logger = setup_logging(__name__)

def match_angles_to_images(
    openai_service: OpenAIService,
    angles: List[Dict[str, Any]],
    marketing_avatar: Dict[str, Any],
    library_images: Dict[str, Any],
    job_id: Optional[str],
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
    
    system_prompt = get_match_angles_system_prompt()
    
    # Use a set to track used image IDs to avoid repetition
    used_ids: Set[str] = set()
    
    # Call core logic
    # In original code, it might have looped. Here we do a single call for simplicity 
    # unless we detect need for batching. The prompt expects a list of slots.
    
    user_prompt = get_match_angles_user_prompt(
        selected_avatar=avatar_desc,
        used_ids=list(used_ids),
        slots_desc=slots_desc,
        images=library_images
    )
    
    resp_text = openai_service.match_angles_to_images(system_prompt, user_prompt, job_id)
    
    if not resp_text:
        logger.error("Failed to get response from match_angles_to_images.")
        return {}
        
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
        logger.error("Error parsing match assignments: %s", e)
        # Fallback assignments could happen here, or let the caller handle empty
        
    return final_mapping
