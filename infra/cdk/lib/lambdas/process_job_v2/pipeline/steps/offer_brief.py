"""
Offer brief pipeline step.

Generates strategic offer brief from avatars and research.
"""

import json
import logging
from typing import List, Dict, Any

from services.openai_service import OpenAIService
from services.prompt_service import PromptService
from data_models import OfferBrief


logger = logging.getLogger(__name__)


class OfferBriefStep:
    """
    Pipeline step for generating offer briefs.

    Creates a strategic offer brief that synthesizes insights from
    all avatars and research into actionable marketing strategy.
    """

    def __init__(self, openai_service: OpenAIService, prompt_service: PromptService):
        """
        Initialize the offer brief step.

        Args:
            openai_service: OpenAI service for LLM operations.
            prompt_service: PromptService for DB-stored prompts.
        """
        self.openai_service = openai_service
        self.prompt_service = prompt_service
    
    def create_offer_brief(
        self, 
        marketing_avatars_list: List[Dict[str, Any]], 
        deep_research_output: str
    ) -> OfferBrief:
        """
        Generate a strategic Offer Brief based on avatars and research.
        
        Synthesizes all avatar profiles, marketing angles, and research
        findings into a comprehensive strategic brief for the offer.
        
        Args:
            marketing_avatars_list: List of avatar dictionaries with 
                                    avatar details, angles, and beliefs.
            deep_research_output: The raw deep research document.
            
        Returns:
            OfferBrief object with strategic positioning and messaging.
            
        Raises:
            Exception: If offer brief creation fails.
        """
        try:
            # Prepare inputs string
            avatars_summary = json.dumps(marketing_avatars_list, ensure_ascii=False, indent=2)
            
            kwargs = dict(
                avatars_summary=avatars_summary,
                deep_research_output=deep_research_output,
            )
            prompt = self.prompt_service.get_prompt("get_offer_brief_prompt", **kwargs)
            
            logger.info("Calling GPT-5 API to create strategic Offer Brief")
            result = self.openai_service.parse_structured(
                prompt=prompt,
                response_format=OfferBrief,
                subtask="process_job_v2.create_offer_brief"
            )
            logger.info("GPT-5 API call completed for Offer Brief")
            
            return result
            
        except Exception as e:
            logger.error(f"Error creating Offer Brief: {e}")
            raise
