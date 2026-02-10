"""
Marketing angles pipeline step.

Generates marketing angles for customer avatars.
"""

import logging
from typing import Optional

from services.openai_service import OpenAIService
from services.prompt_service import PromptService
from data_models import Avatar, AvatarMarketingAngles


logger = logging.getLogger(__name__)


class MarketingStep:
    """
    Pipeline step for generating marketing angles.

    Creates targeted marketing angles for each customer avatar
    based on their profile and the research findings.
    """

    def __init__(self, openai_service: OpenAIService, prompt_service: PromptService):
        """
        Initialize the marketing step.

        Args:
            openai_service: OpenAI service for LLM operations.
            prompt_service: PromptService for DB-stored prompts.
        """
        self.openai_service = openai_service
        self.prompt_service = prompt_service
    
    def generate_marketing_angles(
        self,
        avatar: Avatar,
        deep_research_output: str,
        target_product_name: Optional[str] = None,
    ) -> AvatarMarketingAngles:
        """
        Generate marketing angles for a specific avatar.
        
        Creates a comprehensive set of marketing angles including
        headlines, hooks, objection handlers, and persuasion elements.
        
        Args:
            avatar: Complete Avatar object with profile details.
            deep_research_output: The raw deep research document.
            
        Returns:
            AvatarMarketingAngles object with generated angles.
            
        Raises:
            Exception: If angle generation fails.
        """
        try:
            avatar_name = avatar.overview.name
            
            kwargs = dict(
                avatar_name=avatar_name,
                avatar_json=avatar.model_dump_json(indent=2),
                deep_research_output=deep_research_output,
                target_product_name=target_product_name if target_product_name else "Not specified",
            )
            prompt = self.prompt_service.get_prompt("get_marketing_angles_prompt", **kwargs)
            
            logger.info(f"Calling GPT-5 API to generate marketing angles for {avatar_name}")
            result = self.openai_service.parse_structured(
                prompt=prompt,
                response_format=AvatarMarketingAngles,
                subtask=f"process_job_v2.generate_marketing_angles.{avatar_name}"
            )
            logger.info(f"GPT-5 API call completed for marketing angles: {avatar_name}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error generating marketing angles for {avatar.overview.name}: {e}")
            raise
