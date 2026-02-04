"""
Deep research pipeline step.

Creates and executes comprehensive market research using Perplexity.
"""

import logging
from typing import Optional

from services.perplexity_service import PerplexityService
from services.prompt_service import PromptService


logger = logging.getLogger(__name__)


class DeepResearchStep:
    """
    Pipeline step for conducting deep market research.

    Generates a comprehensive research prompt and executes it
    using Perplexity's deep research capabilities.
    """

    def __init__(self, perplexity_service: PerplexityService, prompt_service: PromptService):
        """
        Initialize the deep research step.

        Args:
            perplexity_service: Perplexity service for research execution.
            prompt_service: PromptService for DB-stored prompts.
        """
        self.perplexity_service = perplexity_service
        self.prompt_service = prompt_service
    
    def create_prompt(
        self,
        sales_page_url: str,
        research_page_analysis: str,
        gender: Optional[str] = None,
        location: Optional[str] = None,
        research_requirements: Optional[str] = None,
        language_of_output: str = "English"
    ) -> str:
        """
        Create a comprehensive research prompt.
        
        Args:
            sales_page_url: URL of the sales page being researched.
            research_page_analysis: Analysis output from the page analysis step.
            gender: Target gender (optional).
            location: Target location/market (optional).
            research_requirements: Additional research requirements (optional).
            language_of_output: Language for the research output.
            
        Returns:
            Formatted research prompt string.
        """
        kwargs = dict(
            sales_page_url=sales_page_url,
            gender=gender if gender else "Not specified",
            location=location if location else "Not specified",
            research_requirements=research_requirements if research_requirements else "None",
            language_of_output=language_of_output,
            research_page_analysis=research_page_analysis,
        )
        return self.prompt_service.get_prompt("get_deep_research_prompt", **kwargs)
    
    def execute(self, prompt: str) -> str:
        """
        Execute deep research using the generated prompt.
        
        Args:
            prompt: The research prompt to execute.
            
        Returns:
            Research output document.
            
        Raises:
            Exception: If research execution fails.
        """
        try:
            logger.info("Executing deep research")
            
            # Add system context to the prompt
            full_prompt = prompt
            
            result = self.perplexity_service.deep_research(
                prompt=full_prompt,
                subtask="process_job_v2.execute_deep_research"
            )
            
            logger.info("Deep research execution completed")
            return result
            
        except Exception as e:
            logger.error(f"Error executing deep research: {e}")
            raise
