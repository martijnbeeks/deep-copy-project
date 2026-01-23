"""
Swipe file generation step for write_swipe pipeline.
"""
import os
import time
from typing import Any, Dict, List, Optional

from services.anthropic_service import AnthropicService
from utils.logging_config import setup_logging
from utils.html import extract_clean_text_from_html
from utils.pdf import load_pdf_file
from prompts import get_style_guide_analysis_prompt, get_advertorial_rewrite_prompt
from llm_usage import UsageContext, emit_llm_usage_event

logger = setup_logging(__name__)

def rewrite_swipe_file(
    select_angle: str,
    marketing_avatar: str,
    deep_research: str,
    offer_brief: str,
    marketing_philosophy: str,
    summary: str,
    swipe_file_config: Dict[str, Any],
    anthropic_service: AnthropicService,
    job_id: str = "unknown"
) -> Dict[str, Any]:
    """
    Rewrite swipe files based on the inputs using Anthropic.
    
    Args:
        select_angle: Selected marketing angle.
        marketing_avatar: Avatar description.
        deep_research: Research data.
        offer_brief: Offer details.
        marketing_philosophy: Marketing philosophy text.
        summary: Summary of product/research.
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
        
        # 1. Extract Text
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
        
        style_prompt = get_style_guide_analysis_prompt(raw_text)
        model = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")
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
        # Note: Original code skipped Turn 2? It went from "style_guide" to "third_query_prompt".
        # Yes, previous view of swipe_file_writer.py showed style_guide -> third_query_prompt.
        
        logger.info("Turn 3: Rewrite advertorial")
        
        rewrite_prompt = get_advertorial_rewrite_prompt(
            style_guide=style_guide,
            angle=select_angle,
            deep_research_output=deep_research,
            offer_brief=offer_brief,
            marketing_philosophy_analysis=marketing_philosophy,
            avatar_info=marketing_avatar
        )
        
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
            max_tokens=8192, # Was 10000 in original, let's use high limit
            model=model,
            usage_ctx=usage_ctx,
            usage_subtask=f"write_swipe.turn3_generate_advertorial.template_{swipe_file_id}"
        )
        
        swipe_file_results[swipe_file_id] = {
            "full_advertorial": full_advertorial
        }
        
    return swipe_file_results
