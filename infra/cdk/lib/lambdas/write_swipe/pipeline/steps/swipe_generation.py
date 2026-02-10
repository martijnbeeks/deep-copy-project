"""
Swipe file generation step for write_swipe pipeline.
"""
import os
import time
import json
from typing import Any, Dict, List, Optional

from services.anthropic_service import AnthropicService
from utils.logging_config import setup_logging
from utils.html import extract_clean_text_from_html
from utils.pdf import load_pdf_file
from prompts import ImageStyle
from services.prompt_service import PromptService
from llm_usage import UsageContext, emit_llm_usage_event

logger = setup_logging(__name__)


def _is_image_prompt_key(key: str) -> bool:
    """Check if a key is an image prompt field (case-insensitive)."""
    return "imageprompt" in key.lower()


def extract_image_prompt_skeleton(data: Any, path: str = "") -> tuple[Any, list[str]]:
    """
    Recursively walk a dict/list and return a skeleton containing only
    image-prompt keys (set to empty strings), plus a list of dot-paths found.

    Returns (skeleton_or_None, list_of_dot_paths).
    """
    if isinstance(data, dict):
        skeleton = {}
        paths = []
        for key, value in data.items():
            if _is_image_prompt_key(key):
                skeleton[key] = ""
                paths.append(f"{path}.{key}" if path else key)
            else:
                child_skeleton, child_paths = extract_image_prompt_skeleton(
                    value, f"{path}.{key}" if path else key
                )
                if child_skeleton is not None:
                    skeleton[key] = child_skeleton
                    paths.extend(child_paths)
        return (skeleton if skeleton else None, paths)
    elif isinstance(data, list):
        skeletons = []
        paths = []
        for i, item in enumerate(data):
            child_skeleton, child_paths = extract_image_prompt_skeleton(
                item, f"{path}[{i}]"
            )
            if child_skeleton is not None:
                skeletons.append(child_skeleton)
                paths.extend(child_paths)
        return (skeletons if skeletons else None, paths)
    return (None, [])


def build_image_prompt_schema(skeleton: Any) -> dict:
    """
    Build a JSON schema from an image-prompt skeleton.
    Dicts become {"type": "object", "properties": ...},
    lists become {"type": "array", "items": ...} (using first element as template),
    strings become {"type": "string"}.
    """
    if isinstance(skeleton, dict):
        properties = {}
        required = list(skeleton.keys())
        for key, value in skeleton.items():
            properties[key] = build_image_prompt_schema(value)
        schema: dict = {
            "type": "object",
            "properties": properties,
            "required": required,
            "additionalProperties": False,
        }
        return schema
    elif isinstance(skeleton, list):
        if not skeleton:
            return {"type": "array", "items": {"type": "object"}}
        return {"type": "array", "items": build_image_prompt_schema(skeleton[0])}
    else:
        return {"type": "string"}


def merge_image_prompts(original: Any, regenerated: Any) -> Any:
    """
    Walk original and regenerated in parallel, overwriting image-prompt
    values from regenerated into original. Returns the modified original.
    """
    if isinstance(original, dict) and isinstance(regenerated, dict):
        for key in original:
            if _is_image_prompt_key(key) and key in regenerated:
                original[key] = regenerated[key]
            elif key in regenerated:
                original[key] = merge_image_prompts(original[key], regenerated[key])
    elif isinstance(original, list) and isinstance(regenerated, list):
        for i in range(min(len(original), len(regenerated))):
            original[i] = merge_image_prompts(original[i], regenerated[i])
    return original


def rewrite_swipe_file(
    select_angle: str,
    angle_info: str,
    marketing_avatar: str,
    deep_research: str,
    offer_brief: str,
    swipe_file_config: Dict[str, Any],
    anthropic_service: AnthropicService,
    prompt_service: PromptService,
    job_id: str = "unknown",
    image_style: ImageStyle = "realistic",
    target_product_name: str = "Not specified",
) -> Dict[str, Any]:
    """
    Rewrite swipe files based on the inputs using Anthropic.
    
    Args:
        select_angle: Selected marketing angle.
        marketing_avatar: Avatar description.
        deep_research: Research data.
        offer_brief: Offer details.
        swipe_file_config: Dict mapping id -> {html: ..., json: ...}
        anthropic_service: Initialized service.
        job_id: Job ID for tracking.
        
    Returns:
        Dict mapping swipe_file_id -> {full_advertorial: values}
    """
    swipe_file_results = {}
    
    for swipe_file_id, swipe_file_data in swipe_file_config.items():
        logger.info(f"Processing swipe file template: {swipe_file_id}")
        
        usage_ctx = UsageContext(
            endpoint="POST /job/swipe", 
            job_id=job_id, 
            job_type="SWIPE_GENERATION"
        )

        skip_analysis = False
        if swipe_file_id in ["AD0001_POV", "AD0001_AUTHORITY", "LD0001"]:
            skip_analysis = True

        
        # 1. Extract Text
        style_guide = ""
        model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")
        if not skip_analysis:
            raw_text = None
            if swipe_file_data.get("html"):
                raw_text = extract_clean_text_from_html(swipe_file_data["html"], url=swipe_file_id)
            elif swipe_file_data.get("pdf"):
                raw_text = load_pdf_file(swipe_file_data["pdf"])
                
            if not raw_text:
                logger.warning(f"No text extracted for {swipe_file_id}, skipping")
                continue
                
            # 2. Style Analysis (Turn 1)
            logger.info("Turn 1: Generate a style guide")
            
            style_prompt = prompt_service.get_prompt(
                "get_style_guide_analysis_prompt",
                raw_swipe_file_text=raw_text,
            )
            
            max_tokens = 8192
            
            style_guide, usage = anthropic_service.make_streaming_request(
                messages=[{"role": "user", "content": style_prompt}],
                max_tokens=max_tokens,
                model=model,
                usage_ctx=usage_ctx,
                usage_subtask=f"write_swipe.turn1_style_guide.template_{swipe_file_id}"
            )
            
            logger.info("Style guide generated")
        
        # 3. Advertorial Generation (Turn 3/Final)
        logger.info("Turn 3: Rewrite advertorial")
        

        if swipe_file_id == "LD0001":
            kwargs = dict(avatar_info=marketing_avatar, angle_info=angle_info, offer_brief=offer_brief, target_product_name=target_product_name)
            rewrite_prompt = prompt_service.get_prompt("get_listicle_generation_prompt", **kwargs)
        elif swipe_file_id == "AD0001_POV":
            kwargs = dict(avatar_info=marketing_avatar, angle_info=angle_info, offer_brief=offer_brief, target_product_name=target_product_name)
            rewrite_prompt = prompt_service.get_prompt("get_advertorial_rewrite_prompt_customer_pov", **kwargs)
        elif swipe_file_id == "AD0001_AUTHORITY":
            kwargs = dict(avatar_info=marketing_avatar, angle_info=angle_info, offer_brief=offer_brief, target_product_name=target_product_name)
            rewrite_prompt = prompt_service.get_prompt("get_advertorial_rewrite_prompt_authority", **kwargs)
        else:
            kwargs = dict(
                style_guide=style_guide,
                angle=select_angle,
                deep_research_output=deep_research,
                offer_brief=offer_brief,
                avatar_info=marketing_avatar,
                target_product_name=target_product_name,
            )
            rewrite_prompt = prompt_service.get_prompt("get_advertorial_rewrite_prompt", **kwargs)
            
        # Prepare Schema (Tool Use)
        schema = swipe_file_data.get("json")
        if not schema:
            logger.error(f"Missing JSON schema for {swipe_file_id}")
            continue
            
        tool_name, tool_desc, tool_schema = anthropic_service.prepare_schema_for_tool_use(schema)
        
        full_advertorial = anthropic_service.make_structured_request(
            messages=[{"role": "user", "content": rewrite_prompt}],
            tool_name=tool_name,
            tool_description=tool_desc,
            tool_schema=tool_schema,
            max_tokens=15000, # Was 10000 in original, let's use high limit
            model=model,
            usage_ctx=usage_ctx,
            usage_subtask=f"write_swipe.turn3_generate_advertorial.template_{swipe_file_id}"
        )

        if swipe_file_id in ["AD0001_POV", "AD0001_AUTHORITY", "LD0001"]:
            # Extract image prompt skeleton and regenerate with dedicated prompt
            skeleton, img_paths = extract_image_prompt_skeleton(full_advertorial)
            if skeleton:
                logger.info(f"Found {len(img_paths)} image prompt fields: {img_paths}")

                if swipe_file_id == "LD0001":
                    kwargs = dict(
                        listicle_copy=json.dumps(full_advertorial),
                        offer_brief=offer_brief,
                        image_style=image_style,
                    )
                    image_gen_prompt = prompt_service.get_prompt("get_listicle_image_generation_prompt", **kwargs)
                else:
                    kwargs = dict(
                        advertorial_copy=json.dumps(full_advertorial),
                        offer_brief=offer_brief,
                        image_style=image_style,
                    )
                    image_gen_prompt = prompt_service.get_prompt("get_advertorial_image_generation_prompt", **kwargs)

                img_schema = build_image_prompt_schema(skeleton)
                img_tool_name = "generate_image_prompts"
                img_tool_desc = "Generate image prompts for the listicle based on the provided schema." if swipe_file_id == "LD0001" else "Generate image prompts for the advertorial based on the provided schema."

                regenerated_prompts = anthropic_service.make_structured_request(
                    messages=[{"role": "user", "content": image_gen_prompt}],
                    tool_name=img_tool_name,
                    tool_description=img_tool_desc,
                    tool_schema=img_schema,
                    max_tokens=8000,
                    model=model,
                    usage_ctx=usage_ctx,
                    usage_subtask=f"write_swipe.image_prompt_regen.template_{swipe_file_id}",
                )

                full_advertorial = merge_image_prompts(full_advertorial, regenerated_prompts)
                logger.info("Merged regenerated image prompts into advertorial")
            else:
                logger.info("No image prompt fields found in advertorial, skipping regeneration")

    swipe_file_results[swipe_file_id] = {
        "full_advertorial": full_advertorial
    }
        
    return swipe_file_results
