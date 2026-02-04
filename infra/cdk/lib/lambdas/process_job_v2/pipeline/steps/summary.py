"""
Summary pipeline step.

Creates a summary of all pipeline outputs.
"""

import logging

from services.openai_service import OpenAIService
from services.prompt_service import PromptService


logger = logging.getLogger(__name__)


class SummaryStep:
    """
    Pipeline step for creating summaries.

    Generates a comprehensive summary of all research and avatar
    outputs for quick reference.
    """

    def __init__(self, openai_service: OpenAIService, prompt_service: PromptService):
        """
        Initialize the summary step.

        Args:
            openai_service: OpenAI service for LLM operations.
            prompt_service: PromptService for DB-stored prompts.
        """
        self.openai_service = openai_service
        self.prompt_service = prompt_service
    
    def create_summary(
        self, 
        marketing_avatars_str: str, 
        deep_research_output: str
    ) -> str:
        """
        Create a summary of all outputs.
        
        Generates an executive summary covering key findings,
        avatar insights, and strategic recommendations.
        
        Args:
            marketing_avatars_str: String representation of marketing avatars list.
            deep_research_output: The raw deep research document.
            
        Returns:
            Summary text.
            
        Raises:
            Exception: If summary creation fails.
        """
        try:
            kwargs = dict(
                marketing_avatars_str=marketing_avatars_str,
                deep_research_output=deep_research_output,
            )
            prompt = self.prompt_service.get_prompt("get_summary_prompt", **kwargs)
            
            logger.info("Calling GPT-5 API to create summary")
            result = self.openai_service.create_response(
                content=[{"type": "input_text", "text": prompt}],
                subtask="process_job_v2.create_summary"
            )
            logger.info("GPT-5 API call completed for summary creation")
            
            return result
            
        except Exception as e:
            logger.error(f"Error creating summary: {e}")
            raise
