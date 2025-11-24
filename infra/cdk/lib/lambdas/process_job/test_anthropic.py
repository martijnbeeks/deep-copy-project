import json
import os
import base64
import requests
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



def extract_clean_text_from_html(html_file_path: str) -> str:
    """
    Extract clean text from an HTML file by removing scripts, styles, and extra whitespace.

    Args:
        html_file_path: Path to the HTML file.

    Returns:
        Cleaned text as a string.
    """
    with open(html_file_path, 'r', encoding='utf-8') as f:
        html = f.read()

    soup = BeautifulSoup(html, 'html.parser')

    # Remove script and style elements
    for script in soup(["script", "style"]):
        script.decompose()

    # Get text
    text = soup.get_text()

    # Break into lines and remove leading/trailing space
    lines = (line.strip() for line in text.splitlines())

    # Drop blank lines and join with newlines
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    clean_text = '\n'.join(chunk for chunk in chunks if chunk)

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
            if hasattr(e, 'status_code') and e.status_code in [429, 529]:
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


def prepare_schema_for_tool_use(schema_json: str) -> tuple[str, str, Dict[str, Any]]:
    """
    Prepare JSON schema for tool use.
    
    Returns:
        Tuple of (tool_name, tool_description, tool_schema)
    """
    schema = json.loads(schema_json)
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


def send_query_with_conversation_history(
    conversation_history: List[Dict[str, Any]],
    new_query: Union[str, List[Dict[str, Any]]],
    query_number: int,
    model: str,
    anthropic_client: anthropic.Anthropic,
    pdf_file_path: Optional[str] = None,
    max_tokens: int = 10000,
    schema_json: Optional[str] = None,
    
) -> Union[str, Dict[str, Any]]:
    """
    Send a query with full conversation history.
    
    Args:
        conversation_history: List of previous conversation turns
        new_query: The new query content (can be string or already formatted list with PDF)
        query_number: The query number (for logging)
        pdf_file_path: Optional path to PDF file to include with the query (only if new_query is string)
        max_tokens: Maximum tokens for response
        schema_json: Optional JSON schema string for structured output. If provided, returns structured dict instead of text.
        
    Returns:
        Response text from the API (if schema_json is None) or structured dict (if schema_json is provided)
    """
    try:
        # Build the new query content (only if not already formatted)
        if pdf_file_path and isinstance(new_query, str):
            file_data = load_pdf_file(pdf_file_path)
            new_query_content = [
                {"type": "text", "text": new_query},
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": file_data
                    }
                }
            ]
        else:
            # new_query is already formatted or is a simple string
            new_query_content = new_query
        
        # Add the new query to conversation history
        temp_history = conversation_history.copy()
        temp_history.append({"role": "user", "content": new_query_content})
        messages = temp_history
        
        # If schema_json is provided, use structured output (tool use)
        if schema_json:
            tool_name, tool_description, tool_schema = prepare_schema_for_tool_use(schema_json)
            structured_result, usage_data = make_structured_request_with_retry(
                messages, tool_name, tool_description, tool_schema, max_tokens, model, anthropic_client
            )
            log_usage_stats(usage_data, query_number, is_structured=True)
            return structured_result
        
        # Otherwise, use streaming text output
        response_text, usage_data = make_streaming_request_with_retry(messages, max_tokens, model, anthropic_client)
        log_usage_stats(usage_data, query_number, is_structured=False)
        return response_text
        
    except Exception as e:
        logger.error(f"Error calling Claude API: {e}")
        raise
