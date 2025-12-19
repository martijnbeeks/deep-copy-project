import json
import os
import base64
import requests
import re
from botocore.exceptions import ClientError
from openai import OpenAI
import boto3
import sys
import logging
import time
from datetime import datetime, timezone
import uuid
import anthropic
from bs4 import BeautifulSoup
from pathlib import Path

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional, Literal, Any, Dict, Union
from pydantic import BaseModel, Field, ConfigDict, create_model


# Configure logger for interactive environments
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Prevent propagation to root logger to avoid duplicate logs
logger.propagate = False

# Add console handler if not already present
if not logger.handlers:
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)



# ============================================================================
# HELPER FUNCTIONS FOR MODULAR CONVERSATION HANDLING
# ============================================================================



def extract_clean_text_from_html(html: str) -> str:
    """
    Extract clean text from an HTML string by removing scripts, styles, and extra whitespace.
    Preserves only bold text tags (<b>, <strong>) and line break tags (<br>), removes all other HTML tags.

    Args:
        html: HTML content as a string.

    Returns:
        Cleaned text as a string with only bold and br tags preserved.
    """
    soup = BeautifulSoup(html, 'html.parser')

    # Remove script and style elements
    for script in soup(["script", "style"]):
        script.decompose()

    # Find all tags except bold and br tags and unwrap them (remove tag but keep content)
    # Process in reverse order (deepest first) to avoid unwrapping parent before child
    all_tags = soup.find_all(True)  # Find all tags
    # Keep both bold tags (<b>, <strong>) and line break tags (<br>, <br/>)
    non_bold_tags = [tag for tag in all_tags if tag.name not in ['b', 'strong', 'br']]
    
    # Sort by depth (deepest first) - tags with more parents come first
    def get_depth(tag):
        depth = 0
        parent = tag.parent
        while parent and parent.name != '[document]':
            depth += 1
            parent = parent.parent
        return depth
    
    non_bold_tags.sort(key=get_depth, reverse=True)
    
    # Unwrap all non-bold tags (this removes the tag but keeps the content)
    for tag in non_bold_tags:
        try:
            tag.unwrap()
        except (AttributeError, ValueError):
            # Tag might have been already unwrapped or removed
            pass

    # Convert the soup back to string
    html_output = str(soup)

    # Clean up excessive whitespace while preserving structure
    # Remove multiple consecutive spaces (but keep single spaces)
    html_output = re.sub(r' +', ' ', html_output)
    
    # Clean up multiple consecutive newlines (max 2)
    html_output = re.sub(r'\n{3,}', '\n\n', html_output)
    
    # Remove leading/trailing whitespace from each line
    lines = []
    for line in html_output.splitlines():
        stripped = line.strip()
        if stripped:  # Keep non-empty lines
            lines.append(stripped)
        elif lines and lines[-1]:  # Keep single blank lines between content
            lines.append("")

    clean_text = "\n".join(lines)
    
    # Convert any remaining newline characters to <br> tags for valid HTML
    # (newlines in HTML source don't render as line breaks)
    clean_text = clean_text.replace('\n', '<br>')
    
    return clean_text

def load_pdf_file(file_path: str) -> str:
    """Load and encode a PDF file to base64."""
    with open(file_path, 'rb') as f:
        file_bytes = f.read()
        file_data = base64.b64encode(file_bytes).decode('utf-8')
        logger.info(f"Encoded file: {file_path} (size: {len(file_bytes)} bytes)")
        return file_data


def retry_with_exponential_backoff(
    func,
    max_retries: int = 5,
    initial_delay: float = 1.0,
    max_delay: float = 60.0,
    exponential_base: float = 2.0
):
    """
    Retry a function with exponential backoff for transient API errors.
    
    Args:
        func: Function to execute (should be a callable that returns the stream context)
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds
        max_delay: Maximum delay between retries in seconds
        exponential_base: Base for exponential backoff
        
    Raises:
        The last exception if all retries are exhausted
    """
    delay = initial_delay
    
    for attempt in range(max_retries):
        try:
            return func()
        except anthropic.APIStatusError as e:
            # Check if it's a retryable error
            if hasattr(e, 'status_code') and e.status_code in [429, 500, 502, 503, 504, 529]:
                # Rate limit or overloaded error
                if attempt == max_retries - 1:
                    logger.error(f"Max retries ({max_retries}) reached. Giving up.")
                    raise
                
                # Check if it's a token-based rate limit (per minute)
                error_str = str(e).lower()
                is_token_rate_limit = 'tokens per minute' in error_str or 'input tokens per minute' in error_str
                
                if is_token_rate_limit:
                    # For token-based rate limits, wait longer (up to 60s) to reset the minute window
                    wait_time = min(60.0, delay * 2)  # Wait up to 60 seconds for token rate limits
                    logger.warning(f"Token rate limit exceeded (attempt {attempt + 1}/{max_retries}). Waiting {wait_time:.1f}s to reset minute window...")
                    time.sleep(wait_time)
                    delay = min(delay * exponential_base, max_delay)
                else:
                    logger.warning(f"API rate limit (attempt {attempt + 1}/{max_retries}). Retrying in {delay:.1f}s...")
                    time.sleep(delay)
                    delay = min(delay * exponential_base, max_delay)
            else:
                # Non-retryable error, raise immediately
                raise
        except anthropic.APIError as e:
            # Check for rate limit errors in the error message
            error_str = str(e).lower()
            is_rate_limit = 'overloaded' in error_str or 'rate' in error_str or 'rate_limit_error' in error_str
            
            if is_rate_limit:
                if attempt == max_retries - 1:
                    logger.error(f"Max retries ({max_retries}) reached. Giving up.")
                    raise
                
                # Check if it's a token-based rate limit (per minute)
                is_token_rate_limit = 'tokens per minute' in error_str or 'input tokens per minute' in error_str
                
                if is_token_rate_limit:
                    # For token-based rate limits, wait longer (up to 60s) to reset the minute window
                    wait_time = min(60.0, delay * 2)  # Wait up to 60 seconds for token rate limits
                    logger.warning(f"Token rate limit exceeded (attempt {attempt + 1}/{max_retries}): {e}. Waiting {wait_time:.1f}s to reset minute window...")
                    time.sleep(wait_time)
                    delay = min(delay * exponential_base, max_delay)
                else:
                    logger.warning(f"API rate limit error (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {delay:.1f}s...")
                    time.sleep(delay)
                    delay = min(delay * exponential_base, max_delay)
            else:
                # Non-retryable error, raise immediately
                raise
        except Exception as e:
            # Check for rate limit in generic exceptions (some errors might not be APIError)
            error_str = str(e).lower()
            if 'rate_limit_error' in error_str or ('rate' in error_str and 'limit' in error_str):
                if attempt == max_retries - 1:
                    logger.error(f"Max retries ({max_retries}) reached. Giving up.")
                    raise
                
                # Check if it's a token-based rate limit (per minute)
                is_token_rate_limit = 'tokens per minute' in error_str or 'input tokens per minute' in error_str
                
                if is_token_rate_limit:
                    # For token-based rate limits, wait longer (up to 60s) to reset the minute window
                    wait_time = min(60.0, delay * 2)  # Wait up to 60 seconds for token rate limits
                    logger.warning(f"Token rate limit exceeded (attempt {attempt + 1}/{max_retries}): {e}. Waiting {wait_time:.1f}s to reset minute window...")
                    time.sleep(wait_time)
                    delay = min(delay * exponential_base, max_delay)
                else:
                    logger.warning(f"Rate limit error (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {delay:.1f}s...")
                    time.sleep(delay)
                    delay = min(delay * exponential_base, max_delay)
            else:
                # Non-retryable error, raise immediately
                raise
    
    # Should never reach here, but just in case
    raise Exception(f"Failed after {max_retries} retries")


def print_usage_stats(response, query_number: int):
    """Log token usage statistics for a query."""
    usage = response.usage
    cache_creation = getattr(usage, 'cache_creation_input_tokens', 0)
    cache_read = getattr(usage, 'cache_read_input_tokens', 0)
    
    logger.info(f"--- Token Usage (Query {query_number})")
    logger.info(f"Input tokens (new): {usage.input_tokens}")
    logger.info(f"Cache creation tokens: {cache_creation}")
    logger.info(f"Cache read tokens: {cache_read} (90% cheaper!)")
    logger.info(f"Output tokens: {usage.output_tokens}")
    
    if cache_read > 0:
        total_input = usage.input_tokens + cache_read
        savings_percent = (cache_read / total_input) * 100
        logger.info(f"✓ Cache hit rate: {savings_percent:.1f}%")
        logger.info(f"✓ Cost savings: ~{savings_percent * 0.9:.1f}% on cached tokens")
    
    logger.info("----------------------------------")


def log_usage_stats(usage_data, query_number: int, is_structured: bool = False):
    """Log token usage statistics from usage data."""
    if not usage_data:
        return
    
    cache_creation = getattr(usage_data, 'cache_creation_input_tokens', 0)
    cache_read = getattr(usage_data, 'cache_read_input_tokens', 0)
    
    output_type = "Structured Output" if is_structured else ""
    logger.info(f"--- Token Usage (Query {query_number}){f' - {output_type}' if output_type else ''}")
    logger.info(f"Input tokens (new): {usage_data.input_tokens}")
    logger.info(f"Cache creation tokens: {cache_creation}")
    logger.info(f"Cache read tokens: {cache_read} (90% cheaper!)")
    logger.info(f"Output tokens: {usage_data.output_tokens}")
    
    if cache_read > 0:
        total_input = usage_data.input_tokens + cache_read
        savings_percent = (cache_read / total_input) * 100
        logger.info(f"✓ Cache hit rate: {savings_percent:.1f}%")
        logger.info(f"✓ Cost savings: ~{savings_percent * 0.9:.1f}% on cached tokens")
    
    logger.info("----------------------------------")


def prepare_schema_for_tool_use(schema: dict[str, Any]) -> tuple[str, str, dict[str, Any]]:
    """
    Prepare JSON schema for tool use.
    
    Returns:
        Tuple of (tool_name, tool_description, tool_schema)
    """
    tool_name = schema.get("title", "generate_content").lower().replace(" ", "_")
    tool_description = schema.get("description", "Generate structured content")
    tool_schema = {k: v for k, v in schema.items() 
                   if k not in ["$schema", "title", "description"]}
    return tool_name, tool_description, tool_schema


def make_structured_request_with_retry(
    messages: List[Dict[str, Any]],
    tool_name: str,
    tool_description: str,
    tool_schema: Dict[str, Any],
    max_tokens: int,
    model: str,
    anthropic_client: anthropic.Anthropic,
    system_prompt: List[Dict[str, Any]] = None,
) -> tuple[Dict[str, Any], Any]:
    """
    Make a structured output request with streaming and retry logic.
    
    Returns:
        Tuple of (structured_result, usage_data)
    """
    logger.info(f"Using structured output mode with streaming")
    structured_result = None
    usage_data = None
    
    def make_structured_request():
        nonlocal structured_result, usage_data
        
        with anthropic_client.messages.stream(
            model=model,
            max_tokens=max_tokens,
            messages=messages,
            # system=system_prompt if system_prompt else None,
            tools=[{
                "name": tool_name,
                "description": tool_description,
                "input_schema": tool_schema
            }],
            tool_choice={"type": "tool", "name": tool_name}
        ) as stream:
            # Consume the stream (tool use will be in the final message)
            for _ in stream.text_stream:
                pass  # We don't need text for tool use, but we need to consume the stream
            
            # Get the final message with usage data
            response = stream.get_final_message()
        
        # Extract structured output from tool use
        if response.stop_reason == "tool_use" and len(response.content) > 0:
            tool_use = response.content[0]
            logger.info(f"Tool use block type: {type(tool_use).__name__}")
            logger.info(f"Tool use ID: {getattr(tool_use, 'id', 'N/A')}")
            logger.info(f"Tool use name: {getattr(tool_use, 'name', 'N/A')}")
            
            if hasattr(tool_use, 'input'):
                input_data = tool_use.input
                logger.info(f"Input data type: {type(input_data)}")
                logger.info(f"Input data keys (if dict): {list(input_data.keys()) if isinstance(input_data, dict) else 'N/A (not a dict)'}")
            
                
                if isinstance(input_data, dict):
                    structured_result = input_data
                    # Log how many fields we got
                    logger.info(f"Received {len(input_data)} top-level fields in structured output")
                elif isinstance(input_data, str):
                    logger.info(f"Input is string, attempting JSON parse. Length: {len(input_data)}")
                    structured_result = json.loads(input_data)
                else:
                    logger.warning(f"Unexpected input type: {type(input_data)}")
                    structured_result = input_data
            else:
                available_attrs = [attr for attr in dir(tool_use) if not attr.startswith('_')]
                raise ValueError(f"Tool use response missing 'input' attribute. Available: {available_attrs}")
        else:
            logger.error(f"Unexpected response: stop_reason={response.stop_reason}, content_length={len(response.content)}")
            if response.content:
                logger.error(f"Content types: {[type(c).__name__ for c in response.content]}")
            raise ValueError(f"Expected tool_use response, got stop_reason: {response.stop_reason}")
        
        usage_data = response.usage
        logger.info(f"Output tokens used: {usage_data.output_tokens if usage_data else 'N/A'}")
        return structured_result
    
    # Execute with retry logic
    retry_with_exponential_backoff(make_structured_request)
    
    return structured_result, usage_data


def make_streaming_request_with_retry(
    messages: List[Dict[str, Any]],
    max_tokens: int,
    model: str,
    anthropic_client: anthropic.Anthropic,
    system_prompt: List[Dict[str, Any]] = None,
) -> tuple[str, Any]:
    """
    Make a streaming text request with retry logic.
    
    Returns:
        Tuple of (response_text, usage_data)
    """
    logger.info(f"Using streaming text mode")
    response_text = ""
    usage_data = None
    
    def make_stream_request():
        nonlocal response_text, usage_data
        response_text = ""  # Reset on retry
        
        with anthropic_client.messages.stream(
            model=model,
            max_tokens=max_tokens,
            messages=messages,
            system=system_prompt if system_prompt else [],
        ) as stream:
            for text in stream.text_stream:
                response_text += text
            
            # Get the final message with usage data
            message = stream.get_final_message()
            usage_data = message.usage
            return response_text
    
    # Execute with retry logic
    retry_with_exponential_backoff(make_stream_request)
    
    return response_text, usage_data



def rewrite_swipe_file(
    angle: str,
    avatar_sheet: str,
    deep_research_output: str,
    offer_brief: str,
    marketing_philosophy_analysis: str,
    summary: str,
    swipe_file_config: dict[str, dict[str, Any]],
    anthropic_client: anthropic.Anthropic,
    model: str = "claude-sonnet-4-5-20250929",
    max_tokens: int = 4000) -> dict[str, dict[str, Any]]:  
    # Model configuration
    
    for swipe_file_id, swipe_file_data in swipe_file_config.items():
        raw_swipe_file_text = extract_clean_text_from_html(swipe_file_data["html"])
        swipe_file_config[swipe_file_id]["raw_text"] = raw_swipe_file_text
    
    
    # Build messages list manually - we'll append to this for each turn
    messages: List[Dict[str, Any]] = []
    
    # ============================================================
    # Turn 1: Familiarize with documents
    # ============================================================
    logger.info("Turn 1: Familiarizing with documents")
    
    
    swipe_file_results = {}
    for swipe_file_id, swipe_file_data in swipe_file_config.items():
        # Create an own messages list for the specific swipe file template
        message_swipe = messages.copy()
        
        # Pepare Step 2
        raw_swipe_file_text = swipe_file_data["raw_text"]
        
        logger.info("Turn 1: Generate a style guide")
        
        
        first_query_prompt = f"""
        You are an expert copywriter analyzing an advertorial's style to create a detailed style guide for rewriting.
        YOUR TASK:
        Analyze the provided original advertorial and output a comprehensive style guide in JSON format. This guide will be used by a second process to generate new copy that matches the original's style exactly.

        ANALYSIS REQUIREMENTS:
        1. Sentence Structure Analysis
        Count and analyze:

        Average words per sentence in body sections (calculate across all section bodies)
        Shortest sentence length (in words)
        Longest sentence length (in words)
        Fragment frequency (count intentional fragments like "No X. Just Y.")
        Fragment examples (list 3-5 examples from original)

        2. White Space & Line Break Analysis
        Map the formatting:
        <br> tag count in story intro
        Average <br> tags per section body (count across sections 1-11)
        Line break pattern (describe: frequent breaks between every 2-3 sentences, or longer paragraphs?)
        White space philosophy (dense prose vs. scannable chunks)

        3. Tone & Voice Markers
        Identify:
        Formality level (casual/conversational or formal/authoritative - choose one)
        Contraction frequency (count contractions like "you're", "don't" and calculate per 100 words)
        Direct address frequency (count uses of "you/your" per 100 words)
        Energy level (punchy/urgent or calm/educational - choose one)
        Confidence style (assertive claims or hedged language - choose one)

        4. Repetition & Rhythm Devices
        Catalog patterns:
        Parallel structure examples (find patterns like "Ditch X, ditch Y" - list 3-5)
        Rule of threes (find "X, Y, and Z" patterns - list examples)
        Rhetorical questions (count and list examples)
        Repeated phrases (any phrases that appear multiple times)

        5. Pacing & Information Density
        Measure:
        Facts per section body (average number of specific claims/facts per section)
        Explanation depth (light touch with benefits only, or detailed mechanisms? - describe)
        Speed variation (where does copy speed up with short sentences vs. slow down? - note patterns)

        6. Formatting & CTA Patterns
        Document:
        HTML elements used (list all: <br>, <b>, <strong>, <ul>, <ol>, etc.)
        Bold/emphasis frequency (count uses of <b> or <strong> tags)
        Inline CTA presence (yes/no)
        Inline CTA sections (if yes, list which section numbers have them: e.g., 3, 5, 7, 9, 11)
        CTA format (if present, show exact format like "👉 [Text]")
        Emoji usage (list any emojis used, or "none")

        7. Punctuation & Special Characters
        Identify:
        Ellipsis usage (count "..." occurrences)
        Exclamation points (count and note if used sparingly or frequently)

        8. Section-Specific Patterns
        Analyze structure:
        Story intro word count
        Story intro sentence count
        Story intro structure (describe the flow: problem → agitation → hope, or other pattern)
        Average section body word count (calculate across sections 1-11)
        Average section body sentence count
        Section body structure (describe pattern: benefit → detail → proof, or other)


        OUTPUT FORMAT:
        Return your analysis as style report that can be used to rewrite the advertorial.

        CRITICAL INSTRUCTIONS:
        Be precise with counts - actually count, don't estimate
        Calculate averages accurately - show your math if needed
        Provide specific examples - use exact quotes from original
        Fill every field - no null or empty values
        Set hard rules in criticalRules - based on your analysis, set the limits for Call 2


        INPUT:
        Original Advertorial:
        {raw_swipe_file_text}

        """
        
        style_message = [
            {
                "role": "user",
                "content": first_query_prompt
            }
        ]
        

        
        style_guide, usage_style = make_streaming_request_with_retry(
            messages=style_message,
            max_tokens=max_tokens,
            model=model,
            anthropic_client=anthropic_client,
        )
        
        
        third_query_prompt = f"""
        You are an expert copywriter creating a complete advertorial for a new product, following an exact style guide.
        YOUR TASK:
        Write a complete advertorial using:

        The style specifications from the provided style guide (from Call 1)
        All relevant product information from the product data
        The specified marketing angle (focus the copy around this emotional driver)
        The output schema structure

        CRITICAL: The marketing angle should be woven throughout the copy, not just stated once. It should drive the emotional arc, headline choices, and benefit framing.
        Generate a full and complete output with every schema field filled. Do NOT skip or leave out any fields.

        STYLE GUIDE (FROM CALL 1):
        {style_guide}

        CRITICAL WRITING RULES (EXTRACT FROM STYLE GUIDE):
        Read the style guide above carefully and extract these key values:
        Sentence Construction

        MAXIMUM sentence length: Extract from "Maximum sentence length" in Critical Rules section - NO EXCEPTIONS
        Fragment requirement: Extract from "Fragments required" in Critical Rules section
        Fragment patterns to use: Use examples from "Fragment examples" in Sentence Structure section
        Average target: Extract from "Average words per sentence" in Sentence Structure section
        Before writing each sentence: Count the words. If over max, split it.

        White Space & Line Breaks
        Story intro <br> tags: Extract from "<br> tags in story intro" in White Space section
        Section body <br> tags: Extract from "Mandatory <br> tags per section" in Critical Rules section
        Placement pattern: Extract from "Line break pattern" in White Space section
        Philosophy: Extract from "White space philosophy" in White Space section
        Format: Use <br><br> to separate idea chunks (double break for visual space)

        Tone & Voice
        Formality: Extract from "Formality level" in Tone & Voice section
        Contractions: Extract rate from "Contractions per 100 words" in Tone & Voice section
        Direct address: Extract rate from "Direct address per 100 words" in Tone & Voice section
        Energy: Extract from "Energy level" in Tone & Voice section
        Confidence: Extract from "Confidence style" in Tone & Voice section

        Rhythm & Repetition
        Use parallel structures: Extract examples from "Parallel structure examples" in Rhythm & Repetition section
        Rule of threes: Extract examples from "Rule of threes examples" in Rhythm & Repetition section
        Rhetorical questions: Extract frequency from "Rhetorical questions found" in Rhythm & Repetition section

        Pacing & Density
        Facts per section: Extract from "Average facts/claims per section" in Pacing section
        Explanation depth: Extract from "Explanation depth" in Pacing section

        Formatting & CTAs
        HTML elements allowed: Extract from "HTML elements used" in Formatting section
        Inline CTAs:
        Required: Extract from "Inline CTAs required" in Critical Rules section
        If yes, sections: Extract from "If yes, which sections" in Formatting section
        Format: Extract from "CTA format" in Formatting section


        Emojis: Extract from "Emojis used" in Formatting section
        Punctuation
        Do not allow em dashes. Use commas, periods, or rewrite differently.
        If normal dashes are used, please use appropriate spacing around them, never use dashes without spaces.
        Preferred dash style: Extract from "Preferred dash style" in Punctuation section

        Section Targets
        Story intro word count: Extract from "Target intro word count" in Critical Rules section (±20 words)
        Story intro sentences: Extract from "Story intro sentence count" in Section-Specific Patterns
        Story intro flow: Extract from "Story intro structure" in Section-Specific Patterns
        Section body word count: Extract from "Target section word count" in Critical Rules section (±15 words)
        Section body sentences: Extract from "Average section body sentence count" in Section-Specific Patterns
        Section body flow: Extract from "Section body structure" in Section-Specific Patterns


        PRODUCT INFORMATION:
        Marketing Angle:
        {angle}
        Product Data:
        Deep research output:
        {deep_research_output}
        Offer brief:
        {offer_brief}
        Marketing philosophy analysis:
        {marketing_philosophy_analysis}



        PRE-SUBMISSION VERIFICATION CHECKLIST:
        STOP. Before submitting, verify these items:
        1. Sentence Length Audit
        Every sentence in story intro ≤ [Max from Critical Rules section] words
        Every sentence in sections 1-11 ≤ [Max from Critical Rules section] words
        If any exceed limit, they are split into shorter sentences or fragments

        2. Line Break Audit
        Story intro contains ≥ [Number from White Space section] <br><br> tags
        Each section body contains ≥ [Number from Critical Rules section] <br><br> tags
        Line breaks separate distinct ideas/emotional beats

        3. Inline CTA Audit
        If inline CTAs required per Critical Rules section, CTAs are added
        CTAs appear in correct sections per Formatting section
        CTA format matches example in Formatting section

        4. Punctuation Audit
        Do not allow em dashes. Use commas, periods, or rewrite differently.
        If normal dashes are used, please use appropriate spacing around them, never use dashes without spaces.
        Ellipses (...) avoided unless Punctuation section shows usage
        Exclamation points match original frequency from Punctuation section

        5. Fragment Audit
        If fragments required per Critical Rules section, fragments included
        Fragment style matches examples from Sentence Structure section
        Used for emphasis and rhythm

        6. Word Count Audit
        Story intro: [Target from Critical Rules section] ±20 words
        Each section body: [Target from Critical Rules section] ±15 words
        Staying within targets = stronger, more scannable copy

        7. Schema Audit
        Every required field is filled
        Character counts fall within minLength/maxLength
        No placeholder text or incomplete thoughts

        If you cannot verify all 7 audits above, DO NOT SUBMIT. Fix first.

        OUTPUT INSTRUCTIONS:
        Output ONLY the completed JSON schema with all fields filled.
        Do not include:

        Explanations or process notes
        Style guide references
        Meta-commentary
        Preambles or conclusions

        Just the raw JSON schema, fully populated and verified against all checklists.
        """
        
        test_message = [{
            "role": "user",
            "content": third_query_prompt
        }]
    
        # Prepare schema for tool use
        # Use JSON schema from config (already parsed as dict)
        schema = swipe_file_data.get("json")
        if not schema:
            raise ValueError(f"Missing JSON schema for swipe file {swipe_file_id}")
        
        tool_name, tool_description, tool_schema = prepare_schema_for_tool_use(schema)
    
        # Get structured response
        full_advertorial, third_usage = make_structured_request_with_retry(
            messages=test_message,
            tool_name=tool_name,
            tool_description=tool_description,
            tool_schema=tool_schema,
            max_tokens=10000,
            model=model,
            anthropic_client=anthropic_client,
            # system_prompt=system_prompt
        )
        
        # save the full_advertorial to the swipe_file_results
        swipe_file_results[swipe_file_id] = {
            "full_advertorial": full_advertorial
        }
        
    
        logger.info(f"Turn 3 completed. Received {len(full_advertorial) if isinstance(full_advertorial, dict) else 0} fields in structured output")
        logger.info(f"Turn 3 usage: {third_usage}")
        # Check if enough fields are present, else retry
        
    
    return swipe_file_results