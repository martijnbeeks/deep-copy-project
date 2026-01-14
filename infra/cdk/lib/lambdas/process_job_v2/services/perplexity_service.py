"""
Perplexity service wrapper for process_job_v2 Lambda.

Provides Perplexity API access with usage tracking and telemetry.
"""

import logging
import time
from typing import Optional

from perplexity import Perplexity

from llm_usage import UsageContext, emit_llm_usage_event, normalize_perplexity_usage


logger = logging.getLogger(__name__)


class PerplexityService:
    """
    Perplexity API service wrapper with usage tracking.
    
    Provides methods for calling Perplexity APIs with automatic
    telemetry emission for cost and usage tracking.
    """
    
    DEFAULT_MODEL = "sonar-deep-research"
    
    def __init__(
        self, 
        api_key: str, 
        model: str = DEFAULT_MODEL,
        usage_ctx: Optional[UsageContext] = None,
        aws_request_id: Optional[str] = None
    ):
        """
        Initialize Perplexity service.
        
        Args:
            api_key: Perplexity API key.
            model: Default model to use for requests.
            usage_ctx: Telemetry context for usage tracking.
            aws_request_id: AWS Lambda request ID for tracking.
        """
        self.client = Perplexity(api_key=api_key)
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
            provider="perplexity",
            model=model,
            operation=operation,
            subtask=subtask,
            latency_ms=int((time.time() - t0) * 1000),
            success=success,
            retry_attempt=1,
            aws_request_id=self.aws_request_id,
            error_type=type(error).__name__ if error else None,
            usage=normalize_perplexity_usage(response) if response is not None else None,
        )
    
    def deep_research(
        self,
        prompt: str,
        subtask: str,
        model: Optional[str] = None,
    ) -> str:
        """
        Execute deep research using Perplexity.
        
        Args:
            prompt: The research prompt.
            subtask: Subtask name for telemetry.
            model: Model to use (defaults to sonar-deep-research).
            
        Returns:
            The research response content.
            
        Raises:
            Exception: If API call fails.
        """
        model = model or self.model
        t0 = time.time()
        
        try:
            logger.info("Calling Perplexity Deep Research API")
            
            response = self.client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}]
            )
            
            self._emit_usage(
                operation="chat.completions.create",
                subtask=subtask,
                model=model,
                t0=t0,
                success=True,
                response=response,
            )
            
            logger.info("Perplexity Deep Research API call completed")
            return response.choices[0].message.content
            
        except Exception as e:
            self._emit_usage(
                operation="chat.completions.create",
                subtask=subtask,
                model=model,
                t0=t0,
                success=False,
                error=e,
            )
            logger.error(f"Error executing deep research: {e}")
            raise
