"""
Document analysis step for image_gen_process pipeline.
"""
from typing import Optional
from services.openai_service import OpenAIService
from utils.logging_config import setup_logging

logger = setup_logging(__name__)

def summarize_docs_if_needed(
    openai_service: OpenAIService,
    foundational_text: str,
    language: str,
    job_id: Optional[str]
) -> Optional[str]:
    """
    Summarize foundational documents if provided.
    
    Args:
        openai_service: Initialized OpenAIService.
        foundational_text: The full text to summarize.
        language: The target language.
        job_id: Job identifier.
        
    Returns:
        Optional[str]: The summary, or None if text is too short.
    """
    return openai_service.summarize_docs(foundational_text, language, job_id)
