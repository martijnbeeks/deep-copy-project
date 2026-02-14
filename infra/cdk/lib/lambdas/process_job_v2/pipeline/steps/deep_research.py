"""
Deep research pipeline step.

Creates and executes comprehensive market research using Perplexity.
"""

import logging
from typing import List, Optional

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
        sales_page_url: Optional[str] = None,
        research_page_analysis: str = "",
        gender: Optional[str] = None,
        location: Optional[str] = None,
        research_requirements: Optional[str] = None,
        language_of_output: str = "English",
        target_product_name: Optional[str] = None,
        sales_page_urls: Optional[List[str]] = None,
    ) -> str:
        """
        Create a comprehensive research prompt.

        Args:
            sales_page_url: Single URL (deprecated, use sales_page_urls).
            research_page_analysis: Analysis output from the page analysis step.
            gender: Target gender (optional).
            location: Target location/market (optional).
            research_requirements: Additional research requirements (optional).
            language_of_output: Language for the research output.
            target_product_name: Optional product name.
            sales_page_urls: List of URLs being researched (preferred).

        Returns:
            Formatted research prompt string.
        """
        # Build the URL text for the prompt template placeholder
        urls = sales_page_urls or ([sales_page_url] if sales_page_url else [])
        if len(urls) == 1:
            url_text = urls[0]
        else:
            url_text = "\n".join(f"  - URL {i}: {url}" for i, url in enumerate(urls, start=1))

        kwargs = dict(
            sales_page_url=url_text,
            gender=gender if gender else "Not specified",
            location=location if location else "Not specified",
            research_requirements=research_requirements if research_requirements else "None",
            language_of_output=language_of_output,
            research_page_analysis=research_page_analysis,
            target_product_name=target_product_name if target_product_name else "Not specified",
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
