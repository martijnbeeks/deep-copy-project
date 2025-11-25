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
            system=system_prompt if system_prompt else None,
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
                
                # rerun if less then 10 fields
                if len(input_data) < 10:
                    logger.info(f"Less then 10 fields, rerunning...")
                    return make_structured_request()
                
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
            system=system_prompt if system_prompt else None,
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
    field_prompt = f"""Hey, Claude, I want you to please analyze system prompt above. I've done a significant amount of research of a product that I'm going to be selling, and it's your role as my direct response copywriter to understand this research, the avatar document, the offer brief, and the necessary beliefs document to an extremely high degree. So please familiarize yourself with these documents before we proceed with writing anything.
    """
    system_prompt = [{
            "type": "text",
            "text": f"""
            Text that need to be analyzed:
            Avatar sheet:
            {avatar_sheet}
            - Deep research output:
            {deep_research_output}
            - Offer brief:
            {offer_brief}
            - Marketing philosophy analysis:
            {marketing_philosophy_analysis}
            """,
            "cache_control": {"type": "ephemeral"}
    }]
    
    # TODO: test performance with only a summary of deep research.
    
    # Add first user message
    messages.append({
        "role": "user",
        "content": field_prompt
    })
    
    # Get first response using streaming
    first_response_text, first_usage = make_streaming_request_with_retry(
        messages=messages,
        max_tokens=max_tokens,
        model=model,
        anthropic_client=anthropic_client,
        system_prompt=system_prompt
    )
    
    # Add assistant response to messages
    messages.append({
        "role": "assistant",
        "content": first_response_text
    })
    
    logger.info(f"Turn 1 completed. Response length: {len(first_response_text)} chars")
    logger.info(f"Turn 1 usage: {first_usage}")
    
    # After this step, it is specific to the swipe file template that was selected
    logger.info("Turn 2: Make it specific to the swipe file template")
    
    swipe_file_results = {}
    for swipe_file_id, swipe_file_data in swipe_file_config.items():
        # Create an own messages list for the specific swipe file template
        message_swipe = messages.copy()
        
        # Pepare Step 2
        raw_swipe_file_text = swipe_file_data["raw_text"]
        
        generate_content_prompt = f"""Excellent work. Now we're going to be writing an advertorial, which is a type of pre-sales page designed to nurture customers before they actually see the main product offer page. I'm going to send you an indirect competitor with a very successful advertorial, and I want you to please analyze this advertorial and let me know your thoughts
        Raw text from the pdf advertorial with HTML formatting preserved:
        {raw_swipe_file_text}
        """
        user_content_with_pdf = [
            {"type": "text", "text": generate_content_prompt},
        ]

    
        # Add second user message with PDF
        message_swipe.append({
            "role": "user",
            "content": user_content_with_pdf
        })
    
        # Get second response using streaming
        second_response_text, second_usage = make_streaming_request_with_retry(
            messages=message_swipe,
            max_tokens=max_tokens,
            model=model,
            anthropic_client=anthropic_client,
            system_prompt=system_prompt
        )
        
        # Add assistant response to messages
        message_swipe.append({
            "role": "assistant",
            "content": second_response_text
        })
    
        logger.info(f"Turn 2 completed for {swipe_file_id}. Response length: {len(second_response_text)} chars")
        logger.info(f"Turn 2 usage for {swipe_file_id}: {second_usage}")

        logger.info("Turn 3: Writing advertorial with structured output")
        third_query_prompt = f"""You are an expert copywriter creating a complete, polished advertorial for a new product.

        Your task:
        1. Rewrite the advertorial using ALL the relevant information about the new product.  
        2. Focus specifically on the marketing angle: {angle}.  
        3. Generate **a full and complete output** following the schema provided below.  
        4. DO NOT skip or leave out any fields — every field in the schema must be filled.  
        5. Match the FORMATTING style of the original advertorial exactly:
        - Use short, punchy paragraphs (1-2 sentences each where dramatic)
        - Create white space and breathing room between key moments
        - Keep the rhythm snappy and scannable
        - Aim for similar total word count as the original example
        - Use similar HTML formatting elements within your text as the original advertorial, only <br>, <b>, <strong>
        - In addition to using standard HTML formatting elements found in the example, you must actively incorporate **ordered lists** (`<ol>`) for numbered steps, **unordered lists** (`<ul>`) for bullet points, and **list items** (`<li>`) for individual entries whenever you present a series, steps, important points, or grouped information. Use these tags natively (not just plain text) to match real advertorial HTML style.
        6. Avoid using AI-specific markers, emojis and unusual punctuation (such as long em dashes "—") in your writing.
        8. If any data is missing, intelligently infer or create realistic content that fits the schema.  
        9. Write fluently and naturally, with complete sentences. Do not stop mid-thought or end with ellipses ("...").
        10. Prioritize EMOTIONAL PACING over information density — shorter is often stronger in direct response copy.
        11. At the end, verify your own output is **100% complete** — all schema fields filled.

        CRITICAL FORMATTING RULES:
        - Break up dense paragraphs into shorter ones
        - Use paragraph breaks for dramatic pauses
        - Single impactful sentences should stand alone
        - Match the "fascination-style" pacing of the original

        When ready, output ONLY the completed schema with all fields filled in. Do not include explanations or notes.
        """
        # Add third user message
        message_swipe.append({
            "role": "user",
            "content": third_query_prompt
        })
    
        # Prepare schema for tool use
        # Use JSON schema from config (already parsed as dict)
        schema = swipe_file_data.get("json")
        if not schema:
            raise ValueError(f"Missing JSON schema for swipe file {swipe_file_id}")
        
        tool_name, tool_description, tool_schema = prepare_schema_for_tool_use(schema)
    
        # Get structured response
        full_advertorial, third_usage = make_structured_request_with_retry(
            messages=message_swipe,
            tool_name=tool_name,
            tool_description=tool_description,
            tool_schema=tool_schema,
            max_tokens=20000,
            model=model,
            anthropic_client=anthropic_client,
            system_prompt=system_prompt
        )
        
        # save the full_advertorial to the swipe_file_results
        swipe_file_results[swipe_file_id] = {
            "full_advertorial": full_advertorial
        }
        
    
        logger.info(f"Turn 3 completed. Received {len(full_advertorial) if isinstance(full_advertorial, dict) else 0} fields in structured output")
        logger.info(f"Turn 3 usage: {third_usage}")
        # Check if enough fields are present, else retry
        if len(full_advertorial) < 10:
            logger.error(f"Less then 10 fields, rerunning...")
            # return rewrite_swipe_file(angle, avatar_sheet, deep_research_output, offer_brief, marketing_philosophy_analysis, swipe_file_config, anthropic_client, model, max_tokens)
    # ============================================================
    # Turn 4: Quality check (commented out for now)
    # ============================================================
    # fifth_query_prompt = f"""Amazing! I'm going to send you the full advertorial that I just completed. I want you to please analyze it and let me know your thoughts. I would specifically analyze how in line all of the copy is in relation to all the research amongst the avatar, the competitors, the research, necessary beliefs, levels of consciousness, the objections, etc., that you did earlier.
    #
    # Please include the deep research output such that you can verify whether all factual information is used.
    #
    # Rate the advertorial and provide me with a quality metrics.
    #
    # Find all research content can be found above and verify whether all factual information is used.
    #
    # Here is the full advertorial:
    #
    # {full_advertorial}"""
    # 
    # # Use only the first turn for quality check (reset messages to first turn only)
    # first_turn_messages = [
    #     messages[0],  # First user message
    #     messages[1],  # First assistant response
    #     {"role": "user", "content": fifth_query_prompt}
    # ]
    # 
    # quality_report, quality_usage = make_streaming_request_with_retry(
    #     messages=first_turn_messages,
    #     max_tokens=MAX_TOKENS,
    #     model=MODEL,
    #     anthropic_client=self.anthropic_client
    # )
    
    return swipe_file_results