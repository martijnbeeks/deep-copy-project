"""
OpenAI service wrapper for process_job_v2 Lambda.

Provides OpenAI API access with usage tracking and telemetry.
"""

import logging
import time
from typing import Any, Dict, List, Optional

from openai import OpenAI

from llm_usage import UsageContext, emit_llm_usage_event, normalize_openai_usage


logger = logging.getLogger(__name__)


class OpenAIService:
    """
    OpenAI API service wrapper with usage tracking.
    
    Provides methods for calling OpenAI APIs with automatic
    telemetry emission for cost and usage tracking.
    """
    
    DEFAULT_MODEL = "gpt-5-mini"
    
    def __init__(
        self, 
        api_key: str, 
        model: str = DEFAULT_MODEL,
        usage_ctx: Optional[UsageContext] = None,
        aws_request_id: Optional[str] = None
    ):
        """
        Initialize OpenAI service.
        
        Args:
            api_key: OpenAI API key.
            model: Default model to use for requests.
            usage_ctx: Telemetry context for usage tracking.
            aws_request_id: AWS Lambda request ID for tracking.
        """
        self.client = OpenAI(api_key=api_key)
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
        response: Optional[object] = None,
        error: Optional[Exception] = None,
    ) -> None:
        """
        Emit usage telemetry event.
        
        Args:
            operation: API operation name.
            subtask: The subtask being performed.
            model: Model used for the request.
            t0: Request start time (from time.time()).
            success: Whether the request succeeded.
            response: API response object (for usage extraction).
            error: Exception if request failed.
        """
        if not self.usage_ctx:
            return
        
        emit_llm_usage_event(
            ctx=self.usage_ctx,
            provider="openai",
            model=model,
            operation=operation,
            subtask=subtask,
            latency_ms=int((time.time() - t0) * 1000),
            success=success,
            retry_attempt=1,
            aws_request_id=self.aws_request_id,
            error_type=type(error).__name__ if error else None,
            usage=normalize_openai_usage(response) if response is not None else None,
        )
    
    def create_response(
        self,
        content: List[Dict[str, Any]],
        subtask: str,
        model: Optional[str] = None,
    ) -> str:
        """
        Create a response using OpenAI Responses API.
        
        Args:
            content: List of content items (text, images, etc.).
            subtask: Subtask name for telemetry.
            model: Model to use (defaults to instance model).
            
        Returns:
            The response output text.
            
        Raises:
            Exception: If API call fails.
        """
        model = model or self.model
        t0 = time.time()
        
        try:
            response = self.client.responses.create(
                model=model,
                input=[{"role": "user", "content": content}]
            )
            self._emit_usage(
                operation="responses.create",
                subtask=subtask,
                model=model,
                t0=t0,
                success=True,
                response=response,
            )
            return response.output_text
            
        except Exception as e:
            self._emit_usage(
                operation="responses.create",
                subtask=subtask,
                model=model,
                t0=t0,
                success=False,
                error=e,
            )
            raise
    
    def parse_structured(
        self,
        prompt: str,
        response_format: type,
        subtask: str,
        model: Optional[str] = None,
    ) -> Any:
        """
        Parse structured output using OpenAI's parse endpoint.
        
        Args:
            prompt: The prompt text.
            response_format: Pydantic model class for structured output.
            subtask: Subtask name for telemetry.
            model: Model to use (defaults to instance model).
            
        Returns:
            Parsed response as the specified Pydantic model.
            
        Raises:
            Exception: If API call fails.
        """
        model = model or self.model
        t0 = time.time()
        
        try:
            response = self.client.responses.parse(
                model=model,
                input=[{"role": "user", "content": prompt}],
                text_format=response_format,
            )
            self._emit_usage(
                operation="responses.parse",
                subtask=subtask,
                model=model,
                t0=t0,
                success=True,
                response=response,
            )
            return response.output_parsed
            
        except Exception as e:
            self._emit_usage(
                operation="responses.parse",
                subtask=subtask,
                model=model,
                t0=t0,
                success=False,
                error=e,
            )
            raise
