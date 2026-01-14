"""
HTML extraction utilities for write_swipe Lambda.
"""
import re
from typing import Optional
from bs4 import BeautifulSoup
from utils.logging_config import setup_logging

logger = setup_logging(__name__)

def extract_clean_text_from_html(html_content: str, url: str = "Unknown URL") -> Optional[str]:
    """
    Extract clean, readable text from HTML content, preserving enough structure
    for LLM analysis but removing clutter.
    """
    if not html_content:
        return None
        
    try:
        soup = BeautifulSoup(html_content, 'html.parser')
        
        # Remove script, style, nav, footer, header elements
        for element in soup(["script", "style", "nav", "footer", "header", "noscript", "iframe", "svg"]):
            element.decompose()
            
        # Try to find the main content area
        main_content = None
        
        # Common selectors for main content
        selectors = [
            "article", 
            "main", 
            ".post-content", 
            ".entry-content", 
            ".article-body", 
            "#content", 
            ".content",
            ".main"
        ]
        
        for selector in selectors:
            found = soup.select(selector)
            if found:
                # Use the one with the most text
                main_content = max(found, key=lambda x: len(x.get_text()))
                logger.info(f"Found main content using selector: {selector}")
                break
                
        # If no main content found, fallback to body or soup
        if not main_content:
            main_content = soup.body if soup.body else soup
            
        # Process text
        # Replace <br> and </p> with newlines to preserve paragraph structure
        for br in main_content.find_all("br"):
            br.replace_with("\n")
            
        for p in main_content.find_all("p"):
            p.append("\n\n")
            
        text = main_content.get_text()
        
        # Clean up whitespace
        # Remove excessive newlines (more than 2)
        text = re.sub(r'\n{3,}', '\n\n', text)
        # Remove whitespace at start/end of lines
        lines = [line.strip() for line in text.split('\n')]
        text = '\n'.join(lines)
        
        return text.strip()
        
    except Exception as e:
        logger.error(f"Error extracting text from HTML for {url}: {e}")
        # Fallback: simple tag removal
        return re.sub(r'<[^>]+>', ' ', html_content).strip()
