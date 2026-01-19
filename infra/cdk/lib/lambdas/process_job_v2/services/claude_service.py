"""
Claude (Anthropic) service wrapper for process_job_v2 Lambda.

Provides Claude API access with usage tracking and telemetry.
Uses streaming for all requests as recommended for long-running jobs.
"""

import json
import logging
import time
from typing import Any, Dict, List, Optional, Tuple

import anthropic

from llm_usage import UsageContext, emit_llm_usage_event, normalize_anthropic_usage
from utils.retry import retry_with_exponential_backoff


logger = logging.getLogger(__name__)


class ClaudeService:
    """
    Claude API service wrapper with usage tracking.
    
    Provides methods for calling Claude APIs with automatic
    telemetry emission for cost and usage tracking.
    Uses streaming for all requests (recommended for long-running jobs).
    """
    
    DEFAULT_MODEL = "claude-sonnet-4-5-20250929"
    
    def __init__(
        self, 
        api_key: str, 
        model: str = DEFAULT_MODEL,
        usage_ctx: Optional[UsageContext] = None,
        aws_request_id: Optional[str] = None
    ):
        """
        Initialize Claude service.
        
        Args:
            api_key: Anthropic API key.
            model: Default model to use for requests.
            usage_ctx: Telemetry context for usage tracking.
            aws_request_id: AWS Lambda request ID for tracking.
        """
        self.client = anthropic.Anthropic(api_key=api_key)
        self.model = model
        self.usage_ctx = usage_ctx
        self.aws_request_id = aws_request_id
    
    def set_usage_context(
        self, 
        usage_ctx: UsageContext, 
        aws_request_id: Optional[str] = None
    ) -> None:
        """
        Update the usage context for telemetry.
        
        Args:
            usage_ctx: New telemetry context.
            aws_request_id: AWS Lambda request ID.
        """
        self.usage_ctx = usage_ctx
        self.aws_request_id = aws_request_id
    
    def _emit_usage(
        self,
        *,
        operation: str,
        subtask: str,
        model: str,
        t0: float,
        success: bool,
        usage: Optional[Any] = None,
        error: Optional[Exception] = None,
        retry_attempt: int = 1,
    ) -> None:
        """
        Emit usage telemetry event.
        
        Args:
            operation: API operation name.
            subtask: The subtask being performed.
            model: Model used for the request.
            t0: Request start time (from time.time()).
            success: Whether the request succeeded.
            usage: Usage data from API response.
            error: Exception if request failed.
            retry_attempt: Current retry attempt number.
        """
        if not self.usage_ctx:
            return
        
        emit_llm_usage_event(
            ctx=self.usage_ctx,
            provider="anthropic",
            model=model,
            operation=operation,
            subtask=subtask,
            latency_ms=int((time.time() - t0) * 1000),
            success=success,
            retry_attempt=retry_attempt,
            aws_request_id=self.aws_request_id,
            error_type=type(error).__name__ if error else None,
            usage=normalize_anthropic_usage(usage) if usage is not None else None,
        )
    
    def create_response(
        self,
        content: List[Dict[str, Any]],
        subtask: str,
        model: Optional[str] = None,
        max_tokens: int = 4096,
        system_prompt: Optional[str] = None,
    ) -> str:
        """
        Create a response using Claude's streaming API.
        
        Args:
            content: List of content items (text, images, etc.).
            subtask: Subtask name for telemetry.
            model: Model to use (defaults to instance model).
            max_tokens: Maximum tokens in response.
            system_prompt: Optional system prompt.
            
        Returns:
            The response output text.
            
        Raises:
            Exception: If API call fails after retries.
        """
        model = model or self.model
        response_text = ""
        usage_data = None
        
        def _execute():
            nonlocal response_text, usage_data
            t0 = time.time()
            
            try:
                # Build request kwargs
                request_kwargs = {
                    "model": model,
                    "max_tokens": max_tokens,
                    "messages": [{"role": "user", "content": content}],
                }
                if system_prompt:
                    request_kwargs["system"] = system_prompt
                
                # Use streaming as recommended for long-running jobs
                with self.client.messages.stream(**request_kwargs) as stream:
                    response_text = ""
                    for text in stream.text_stream:
                        response_text += text
                    
                    message = stream.get_final_message()
                    usage_data = message.usage
                
                self._emit_usage(
                    operation="messages.stream",
                    subtask=subtask,
                    model=model,
                    t0=t0,
                    success=True,
                    usage=usage_data,
                )
                return response_text
                
            except Exception as e:
                self._emit_usage(
                    operation="messages.stream",
                    subtask=subtask,
                    model=model,
                    t0=t0,
                    success=False,
                    error=e,
                )
                raise
        
        return retry_with_exponential_backoff(_execute)
    
    def parse_structured(
        self,
        prompt: str,
        response_format: type,
        subtask: str,
        model: Optional[str] = None,
        max_tokens: int = 4096,
        system_prompt: Optional[str] = None,
    ) -> Any:
        """
        Parse structured output using Claude's tool use with streaming.
        
        Uses tool_choice to force structured output matching the response_format.
        
        Args:
            prompt: The prompt text.
            response_format: Pydantic model class for structured output.
            subtask: Subtask name for telemetry.
            model: Model to use (defaults to instance model).
            max_tokens: Maximum tokens in response.
            system_prompt: Optional system prompt.
            
        Returns:
            Parsed response as the specified Pydantic model.
            
        Raises:
            Exception: If API call fails after retries.
        """
        model = model or self.model
        structured_result = None
        usage_data = None
        
        # Convert Pydantic model to tool schema
        tool_name = "structured_output"
        tool_description = f"Generate structured output matching the {response_format.__name__} schema."
        tool_schema = response_format.model_json_schema()
        
        # Clean up schema for tool use (remove metadata fields)
        tool_input_schema = {
            k: v for k, v in tool_schema.items() 
            if k not in ["$schema", "title", "description", "$defs"]
        }
        # Add $defs back if present (needed for nested models)
        if "$defs" in tool_schema:
            tool_input_schema["$defs"] = tool_schema["$defs"]
        
        def _execute():
            nonlocal structured_result, usage_data
            t0 = time.time()
            
            try:
                # Build request kwargs
                request_kwargs = {
                    "model": model,
                    "max_tokens": max_tokens,
                    "messages": [{"role": "user", "content": prompt}],
                    "tools": [{
                        "name": tool_name,
                        "description": tool_description,
                        "input_schema": tool_input_schema
                    }],
                    "tool_choice": {"type": "tool", "name": tool_name}
                }
                if system_prompt:
                    request_kwargs["system"] = system_prompt
                
                # Use streaming with tool use
                with self.client.messages.stream(**request_kwargs) as stream:
                    # Consume the stream (required for streaming to work)
                    for _ in stream.text_stream:
                        pass
                    
                    response = stream.get_final_message()
                
                # Extract structured output from tool use
                if response.stop_reason == "tool_use" and len(response.content) > 0:
                    # Find the ToolUseBlock in content
                    found_tool = None
                    for block in response.content:
                        if block.type == "tool_use":
                            found_tool = block
                            break
                    
                    if found_tool:
                        input_data = found_tool.input
                        if isinstance(input_data, dict):
                            structured_result = response_format.model_validate(input_data)
                        elif isinstance(input_data, str):
                            structured_result = response_format.model_validate_json(input_data)
                        else:
                            structured_result = response_format.model_validate(input_data)
                    else:
                        raise ValueError("No ToolUseBlock found in response content")
                else:
                    raise ValueError(
                        f"Expected tool_use response, got stop_reason: {response.stop_reason}"
                    )
                
                usage_data = response.usage
                self._emit_usage(
                    operation="messages.stream.tool_use",
                    subtask=subtask,
                    model=model,
                    t0=t0,
                    success=True,
                    usage=usage_data,
                )
                return structured_result
                
            except Exception as e:
                self._emit_usage(
                    operation="messages.stream.tool_use",
                    subtask=subtask,
                    model=model,
                    t0=t0,
                    success=False,
                    error=e,
                )
                raise
        
        return retry_with_exponential_backoff(_execute)
