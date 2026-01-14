"""
Avatar identification and completion pipeline step.

Identifies customer avatars from research and completes their profiles.
"""

import logging
from typing import Any

from services.openai_service import OpenAIService
from data_models import Avatar, IdentifiedAvatarList
from prompts import (
    get_identify_avatars_prompt,
    get_complete_avatar_details_prompt,
    get_necessary_beliefs_prompt
)


logger = logging.getLogger(__name__)


class AvatarStep:
    """
    Pipeline step for avatar identification and completion.
    
    Identifies distinct customer avatars from research output,
    then completes detailed profiles and necessary beliefs for each.
    """
    
    def __init__(self, openai_service: OpenAIService):
        """
        Initialize the avatar step.
        
        Args:
            openai_service: OpenAI service for LLM operations.
        """
        self.openai_service = openai_service
    
    def identify_avatars(self, deep_research_output: str) -> IdentifiedAvatarList:
        """
        Identify potential avatars from research output.
        
        Args:
            deep_research_output: The raw deep research document.
            
        Returns:
            List of identified avatars with names and descriptions.
            
        Raises:
            Exception: If avatar identification fails.
        """
        try:
            prompt = get_identify_avatars_prompt(deep_research_output)
            
            logger.info("Calling GPT-5 API to identify avatars")
            result = self.openai_service.parse_structured(
                prompt=prompt,
                response_format=IdentifiedAvatarList,
                subtask="process_job_v2.identify_avatars"
            )
            logger.info("GPT-5 API call completed for avatar identification")
            
            return result
            
        except Exception as e:
            logger.error(f"Error identifying avatars: {e}")
            raise
    
    def complete_avatar_details(
        self, 
        identified_avatar: Any, 
        deep_research_output: str
    ) -> Avatar:
        """
        Complete the full avatar sheet for a specific identified avatar.
        
        Args:
            identified_avatar: The identified avatar object (with name and description).
            deep_research_output: The raw deep research document.
            
        Returns:
            Complete Avatar object with all profile details.
            
        Raises:
            Exception: If avatar completion fails.
        """
        try:
            prompt = get_complete_avatar_details_prompt(
                avatar_name=identified_avatar.name,
                avatar_description=identified_avatar.description,
                deep_research_output=deep_research_output
            )
            
            logger.info(f"Calling GPT-5 API to complete avatar details for {identified_avatar.name}")
            result = self.openai_service.parse_structured(
                prompt=prompt,
                response_format=Avatar,
                subtask=f"process_job_v2.complete_avatar_details.{identified_avatar.name}"
            )
            logger.info(f"GPT-5 API call completed for avatar details: {identified_avatar.name}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error completing avatar details for {identified_avatar.name}: {e}")
            raise
    
    def complete_necessary_beliefs(
        self, 
        identified_avatar: Any, 
        deep_research_output: str
    ) -> str:
        """
        Extract necessary beliefs for a specific avatar.
        
        Implements the 6-belief hierarchy framework for belief
        transformation marketing.
        
        Args:
            identified_avatar: The identified avatar object.
            deep_research_output: The raw deep research document.
            
        Returns:
            Necessary beliefs analysis as text.
            
        Raises:
            Exception: If belief extraction fails.
        """
        try:
            avatar_name = identified_avatar.name
            avatar_description = identified_avatar.description
            
            prompt = get_necessary_beliefs_prompt(
                avatar_name=avatar_name,
                avatar_description=avatar_description,
                deep_research_output=deep_research_output
            )
            
            logger.info(f"Calling GPT-5 API to complete necessary beliefs for {avatar_name}")
            result = self.openai_service.create_response(
                content=[{"type": "input_text", "text": prompt}],
                subtask=f"process_job_v2.complete_necessary_beliefs_for_avatar.{avatar_name}"
            )
            logger.info(f"GPT-5 API call completed for necessary beliefs: {avatar_name}")
            
            return result
            
        except Exception as e:
            logger.error(f"Error completing necessary beliefs for {identified_avatar.name}: {e}")
            raise
