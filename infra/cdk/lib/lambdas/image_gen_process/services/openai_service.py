"""
OpenAI service wrapper for image_gen_process Lambda.

Contains OpenAI API wrappers for vision detection and image generation with usage tracking.
"""

import base64
import io
import os
import time
from typing import Any, Dict, List, Optional

from openai import OpenAI
from pydantic import BaseModel

from utils.logging_config import setup_logging
from prompts import get_detect_product_prompt
from llm_usage import (
    UsageContext,
    emit_llm_usage_event,
    normalize_openai_usage,
)

logger = setup_logging(__name__)


class ProductDetectionResponse(BaseModel):
    """Response model for product detection analysis."""
    has_product: bool
    reasoning: str


class OpenAIService:
    """OpenAI API service wrapper with usage tracking."""
    
    def __init__(self, api_key: str = None):
        """
        Initialize OpenAI service.
        
        Args:
            api_key: OpenAI API key (defaults to OPENAI_API_KEY env var).
        """
        self.api_key = api_key or os.environ.get("OPENAI_API_KEY", "")
        if not self.api_key:
            raise RuntimeError("OPENAI_API_KEY missing")
        self.client = OpenAI(api_key=self.api_key)
    
    def detect_product_in_image(
        self, 
        image_bytes: bytes, 
        job_id: Optional[str]
    ) -> bool:
        """
        Use OpenAI vision to detect if reference image contains a product image.
        
        Args:
            image_bytes: Raw image bytes to analyze.
            job_id: Job ID for usage tracking.
            
        Returns:
            True if product image is detected, False otherwise.
        """
        import PIL.Image
        
        # Convert bytes to PIL Image
        img = PIL.Image.open(io.BytesIO(image_bytes))
        
        # Create base64 data URL
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        img_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
        
        prompt = get_detect_product_prompt()
        
        model = os.environ.get("OPENAI_TEXT_MODEL", "gpt-5-mini")
        t0 = time.time()
        
        try:
            resp = self.client.beta.chat.completions.parse(
                model=model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{img_b64}",
                                    "detail": "high"
                                }
                            }
                        ]
                    }
                ],
                response_format=ProductDetectionResponse,
            )
            
            emit_llm_usage_event(
                ctx=UsageContext(endpoint="POST /image-gen/generate", job_id=job_id, job_type="IMAGE_GEN"),
                provider="openai",
                model=model,
                operation="chat.completions.parse",
                subtask="image_gen.detect_product_in_image",
                latency_ms=int((time.time() - t0) * 1000),
                success=True,
                retry_attempt=1,
                usage=normalize_openai_usage(resp),
            )
            
            result = resp.choices[0].message.parsed
            if not result:
                logger.warning("Product detection returned empty parsed result, defaulting to True")
                return True

            has_product = result.has_product
            
            logger.info("Product detection: has_product=%s reasoning=%s", has_product, result.reasoning)
            return has_product
            
        except Exception as e:
            emit_llm_usage_event(
                ctx=UsageContext(endpoint="POST /image-gen/generate", job_id=job_id, job_type="IMAGE_GEN"),
                provider="openai",
                model=model,
                operation="chat.completions.parse",
                subtask="image_gen.detect_product_in_image",
                latency_ms=int((time.time() - t0) * 1000),
                success=False,
                retry_attempt=1,
                error_type=type(e).__name__,
            )
            logger.error("Product detection failed: %s", e)
            # Default to True (support product) if detection fails - safer default
            return True
    
    def summarize_docs(
        self, 
        foundational_text: str, 
        language: str, 
        job_id: Optional[str]
    ) -> Optional[str]:
        """
        Summarize foundational documents for image generation context.
        
        Args:
            foundational_text: Text to summarize.
            language: Target language for output.
            job_id: Job ID for usage tracking.
            
        Returns:
            Summary text or None if input is too short.
        """
        from prompts import get_summarize_docs_prompt
        
        if not foundational_text or len(foundational_text.strip()) < 50:
            return None
        
        # Keep short for cost/context
        text = foundational_text.strip()
        if len(text) > 12000:
            text = text[:12000] + "\n\n[TRUNCATED]"
        
        prompt = get_summarize_docs_prompt(language, text)
        model = os.environ.get("OPENAI_TEXT_MODEL", "gpt-5-mini")
        t0 = time.time()
        
        try:
            resp = self.client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
            )
            emit_llm_usage_event(
                ctx=UsageContext(endpoint="POST /image-gen/generate", job_id=job_id, job_type="IMAGE_GEN"),
                provider="openai",
                model=model,
                operation="chat.completions.create",
                subtask="image_gen.summarize_docs_if_needed",
                latency_ms=int((time.time() - t0) * 1000),
                success=True,
                retry_attempt=1,
                usage=normalize_openai_usage(resp),
            )
        except Exception as e:
            emit_llm_usage_event(
                ctx=UsageContext(endpoint="POST /image-gen/generate", job_id=job_id, job_type="IMAGE_GEN"),
                provider="openai",
                model=model,
                operation="chat.completions.create",
                subtask="image_gen.summarize_docs_if_needed",
                latency_ms=int((time.time() - t0) * 1000),
                success=False,
                retry_attempt=1,
                error_type=type(e).__name__,
            )
            raise
        
        content = resp.choices[0].message.content or ""
        return content.strip()
    
    def match_angles_to_images(
        self,
        system_prompt: str,
        user_prompt: str,
        job_id: Optional[str]
    ) -> Optional[str]:
        """
        Call OpenAI to match marketing angles to reference images.
        
        Args:
            system_prompt: System prompt for the LLM.
            user_prompt: User prompt with context.
            job_id: Job ID for usage tracking.
            
        Returns:
            LLM response content or None on failure.
        """
        model = os.environ.get("OPENAI_TEXT_MODEL", "gpt-5-mini")
        t0 = time.time()
        
        try:
            resp = self.client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt}, 
                    {"role": "user", "content": user_prompt}
                ],
            )
            emit_llm_usage_event(
                ctx=UsageContext(endpoint="POST /image-gen/generate", job_id=job_id, job_type="IMAGE_GEN"),
                provider="openai",
                model=model,
                operation="chat.completions.create",
                subtask="image_gen.match_angles_to_images",
                latency_ms=int((time.time() - t0) * 1000),
                success=True,
                retry_attempt=1,
                usage=normalize_openai_usage(resp),
            )
            return resp.choices[0].message.content or ""
        except Exception as e:
            logger.warning("matchAnglesToReferenceImages LLM path failed: %s", e)
            return None
    
    def generate_image(
        self,
        prompt: str,
        reference_image_data: Optional[Dict[str, str]],
        product_image_data: Optional[Dict[str, str]],
        job_id: Optional[str],
    ) -> str:
        """
        Generate image using OpenAI's image generation API.
        
        Args:
            prompt: Generation prompt.
            reference_image_data: Reference image dict with 'base64' and 'mimeType'.
            product_image_data: Product image dict with 'base64' and 'mimeType'.
            job_id: Job ID for usage tracking.
            
        Returns:
            Base64-encoded generated image.
            
        Raises:
            RuntimeError: If OpenAI returns no image.
        """
        content: List[Dict[str, Any]] = [{"type": "input_text", "text": prompt}]
        
        if reference_image_data and reference_image_data.get("base64"):
            content.append(
                {
                    "type": "input_image",
                    "image_url": f"data:{reference_image_data.get('mimeType','image/png')};base64,{reference_image_data['base64']}",
                    "detail": "high",
                }
            )
        
        # Safety check: only add product image if it's actually provided
        if product_image_data and product_image_data.get("base64"):
            logger.debug("Adding product image to OpenAI generation")
            content.append(
                {
                    "type": "input_image",
                    "image_url": f"data:{product_image_data.get('mimeType','image/png')};base64,{product_image_data['base64']}",
                    "detail": "high",
                }
            )
        else:
            logger.debug("No product image provided for OpenAI generation")
        
        model = os.environ.get("OPENAI_IMAGE_MODEL", "gpt-4o")
        t0 = time.time()
        
        try:
            resp = self.client.responses.create(
                model=model,
                input=[{"role": "user", "content": content}],
                tools=[{"type": "image_generation"}],
                max_output_tokens=1000,
            )
            emit_llm_usage_event(
                ctx=UsageContext(endpoint="POST /image-gen/generate", job_id=job_id, job_type="IMAGE_GEN"),
                provider="openai",
                model=model,
                operation="responses.create",
                subtask="image_gen.generate_image_openai",
                latency_ms=int((time.time() - t0) * 1000),
                success=True,
                retry_attempt=1,
                usage={**normalize_openai_usage(resp), "imagesGenerated": 1},
            )
        except Exception as e:
            emit_llm_usage_event(
                ctx=UsageContext(endpoint="POST /image-gen/generate", job_id=job_id, job_type="IMAGE_GEN"),
                provider="openai",
                model=model,
                operation="responses.create",
                subtask="image_gen.generate_image_openai",
                latency_ms=int((time.time() - t0) * 1000),
                success=False,
                retry_attempt=1,
                error_type=type(e).__name__,
            )
            raise
        
        img_b64 = self._extract_image_b64(resp)
        if not img_b64:
            raise RuntimeError("OpenAI returned no image")
        return img_b64
    
    def _extract_image_b64(self, response_obj: Any) -> Optional[str]:
        """
        Extract base64 image from OpenAI response.
        
        Args:
            response_obj: OpenAI API response object.
            
        Returns:
            Base64 encoded image string or None.
        """
        try:
            if response_obj is None:
                return None
            if hasattr(response_obj, "model_dump"):
                response = response_obj.model_dump()
            elif isinstance(response_obj, dict):
                response = response_obj
            else:
                response = response_obj.__dict__ if hasattr(response_obj, "__dict__") else None
            if not response or "output" not in response:
                return None
            for output in response.get("output", []) or []:
                if isinstance(output, dict) and output.get("type") == "image_generation_call" and output.get("result"):
                    return output.get("result")
                if isinstance(output, dict) and isinstance(output.get("content"), list):
                    for item in output.get("content") or []:
                        if isinstance(item, dict) and item.get("type") == "image" and item.get("image"):
                            return item.get("image")
            # fallback: any 'result' field
            for output in response.get("output", []) or []:
                if isinstance(output, dict) and isinstance(output.get("result"), str):
                    return output.get("result")
            return None
        except Exception as e:
            logger.warning("Failed to extract image from OpenAI response: %s", e)
            return None
