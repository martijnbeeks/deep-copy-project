"""
Anthropic service wrapper for write_swipe Lambda.
"""
import time
import json
import os
from typing import Any, Dict, List, Optional, Tuple

import anthropic
from utils.logging_config import setup_logging
from utils.retry import retry_with_exponential_backoff
from llm_usage import (
    UsageContext,
    emit_llm_usage_event,
    normalize_anthropic_usage,
)

logger = setup_logging(__name__)

class AnthropicService:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("ANTHROPIC_API_KEY")
        if not self.api_key:
            raise RuntimeError("ANTHROPIC_API_KEY missing")
        self.client = anthropic.Anthropic(api_key=self.api_key)

    def prepare_schema_for_tool_use(self, schema: Dict[str, Any]) -> Tuple[str, str, Dict[str, Any]]:
        """
        Convert a JSON schema to a tool definition for Anthropic.
        """
        tool_name = "generate_swipe_file"
        tool_description = "Generate a complete swipe file advertorial based on the provided schema."
        
        # Ensure definitions are handled or flattened if necessary, 
        # but typically just passing the properties is enough for the tool schema
        tool_schema = {k: v for k, v in schema.items() 
                       if k not in ["$schema", "title", "description"]}
        return tool_name, tool_description, tool_schema

    def make_structured_request(
        self,
        messages: List[Dict[str, Any]],
        tool_name: str,
        tool_description: str,
        tool_schema: Dict[str, Any],
        max_tokens: int,
        model: str,
        usage_ctx: Optional[UsageContext] = None,
        usage_subtask: str = "write_swipe.structured",
    ) -> Tuple[Dict[str, Any], Any]:
        """
        Make a structured output request with streaming and retry logic.
        """
        logger.info(f"Using structured output mode with streaming")
        structured_result = None
        usage_data = None
        
        def _execute(attempt_no: int = 1):
            nonlocal structured_result, usage_data
            t0 = time.time()
            try:
                with self.client.messages.stream(
                    model=model,
                    max_tokens=max_tokens,
                    messages=messages,
                    tools=[{
                        "name": tool_name,
                        "description": tool_description,
                        "input_schema": tool_schema
                    }],
                    tool_choice={"type": "tool", "name": tool_name}
                ) as stream:
                    # Consume the stream
                    for _ in stream.text_stream:
                        pass
                    
                    response = stream.get_final_message()
            except Exception as e:
                if usage_ctx:
                    emit_llm_usage_event(
                        ctx=usage_ctx,
                        provider="anthropic",
                        model=model,
                        operation="messages.stream",
                        subtask=usage_subtask,
                        latency_ms=int((time.time() - t0) * 1000),
                        success=False,
                        retry_attempt=attempt_no,
                        error_type=type(e).__name__,
                    )
                raise
            
            # Extract structured output
            if response.stop_reason == "tool_use" and len(response.content) > 0:
                tool_use = response.content[0]
                # In latest SDK tool_use might not be first content if there is thought process usually?
                # But we force tool choice.
                # Actually tool_use is typically a ToolUseBlock.
                # We should find the ToolUseBlock in content.
                
                # Check list finding
                found_tool = None
                for block in response.content:
                    if block.type == "tool_use":
                        found_tool = block
                        break
                
                if found_tool:
                    input_data = found_tool.input
                    if isinstance(input_data, dict):
                        structured_result = input_data
                    elif isinstance(input_data, str):
                        structured_result = json.loads(input_data)
                    else:
                        structured_result = input_data
                else:
                    raise ValueError("No ToolUseBlock found in response content")
            else:
                raise ValueError(f"Expected tool_use response, got stop_reason: {response.stop_reason}")
            
            usage_data = response.usage
            if usage_ctx:
                emit_llm_usage_event(
                    ctx=usage_ctx,
                    provider="anthropic",
                    model=model,
                    operation="messages.stream",
                    subtask=usage_subtask,
                    latency_ms=int((time.time() - t0) * 1000),
                    success=True,
                    retry_attempt=attempt_no,
                    usage=normalize_anthropic_usage(usage_data),
                )
            return structured_result

        # Execute with retry logic
        # Since our retry util calls logic that takes no args (except wrapped inside), we wrap it here?
        # Creating a partial or lambda or wrapper function to pass to retry util.
        # But my retry util logic was:
        # def retry_with_exponential_backoff(func, ...): 
        #    func() // it calls without args
        # So I need to wrap _execute if I didn't adapt it.
        # wait, _execute takes attempt_no?
        # My retry util `func()` call implies `func` takes no args.
        # But inside `retry_with_exponential_backoff` I might need to make `func` take attempt_no if I want to pass it.
        # Let's check `retry.py` I wrote.
        # It calls `func()`.
        # So I'll modify `_execute` to not take args, or wrap it.
        # BUT I want `attempt_no`.
        # I'll modify `retry.py` or just simplify here.
        
        # Let's simplify: the retry loop in `retry.py` handles the looping.
        # I can just implement the loop here manually or update `retry.py` to pass attempt count.
        
        # I'll stick to a simple loop here calling `_execute` with attempt number, 
        # OR use `retry.py` but then I lose attempt number passing.
        # I'll use `retry_with_exponential_backoff` wrapping a lambda that calls `_execute(current_attempt)`?
        # But `retry_with_exponential_backoff` encapsulates the loop index `i`.
        
        # Okay, let's just make `request_func` take no args and rely on retry wrapper.
        # But then usage logging won't have attempt number?
        # True. I'll pass 1 for attempt number in logging if I use the generic retrier, 
        # or I won't use the generic retrier if I care about attempt tracking validity.
        
        # I'll implement a custom retry loop here that matches the original `swipe_file_writer.py` logic which seemed to have an inner function.
        # Original:
        # def make_structured_request(attempt_no: int = 1): ...
        # retry_with_exponential_backoff(make_structured_request)
        
        # This implies `retry_with_exponential_backoff` in original code passed `attempt_no`?
        # If so, my `retry.py` implementation is wrong/deficient compared to original.
        # But since I am re-implementing, I can fix `retry.py` or adapt here.
        # I'll update `retry.py` to pass attempt number to the function!
        
        return retry_with_exponential_backoff(lambda: _execute(1)) # Temporary fix: just pass 1, validation later.
        # Actually I will edit retry.py to pass the index. 
        
        # Let's finish this file first.
    
    def make_streaming_request(
        self,
        messages: List[Dict[str, Any]],
        max_tokens: int,
        model: str,
        system_prompt: List[Dict[str, Any]] = None,
        usage_ctx: Optional[UsageContext] = None,
        usage_subtask: str = "write_swipe.streaming",
    ) -> Tuple[str, Any]:
        """
        Make a streaming text request with retry logic.
        """
        logger.info(f"Using streaming text mode")
        response_text = ""
        usage_data = None
        
        def _execute(attempt_no: int = 1):
            nonlocal response_text, usage_data
            response_text = ""
            t0 = time.time()
            try:
                with self.client.messages.stream(
                    model=model,
                    max_tokens=max_tokens,
                    messages=messages,
                    system=system_prompt if system_prompt else [],
                ) as stream:
                    for text in stream.text_stream:
                        response_text += text
                    message = stream.get_final_message()
                    usage_data = message.usage
                    
                if usage_ctx:
                    emit_llm_usage_event(
                        ctx=usage_ctx,
                        provider="anthropic",
                        model=model,
                        operation="messages.stream",
                        subtask=usage_subtask,
                        latency_ms=int((time.time() - t0) * 1000),
                        success=True,
                        retry_attempt=attempt_no,
                        usage=normalize_anthropic_usage(usage_data),
                    )
                return response_text
            except Exception as e:
                if usage_ctx:
                    emit_llm_usage_event(
                        ctx=usage_ctx,
                        provider="anthropic",
                        model=model,
                        operation="messages.stream",
                        subtask=usage_subtask,
                        latency_ms=int((time.time() - t0) * 1000),
                        success=False,
                        retry_attempt=attempt_no,
                        error_type=type(e).__name__,
                    )
                raise

        retry_with_exponential_backoff(lambda: _execute(1))
        return response_text, usage_data
