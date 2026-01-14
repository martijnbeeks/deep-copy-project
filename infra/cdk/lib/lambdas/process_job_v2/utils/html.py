"""
HTML text extraction utilities for process_job_v2 Lambda.
"""


def extract_clean_text_from_html(html_file_path: str) -> str:
    """
    Extract clean text from an HTML file by removing scripts, styles, and extra whitespace.
    
    Args:
        html_file_path: Path to the HTML file to extract text from.
        
    Returns:
        Clean text content with scripts/styles removed and whitespace normalized.
    """
    from bs4 import BeautifulSoup
    
    with open(html_file_path, 'r', encoding='utf-8') as f:
        html = f.read()
    
    soup = BeautifulSoup(html, 'html.parser')
    
    # Remove script and style elements
    for script in soup(["script", "style"]):
        script.decompose()
    
    # Extract text
    text = soup.get_text()
    
    # Normalize whitespace
    lines = (line.strip() for line in text.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    clean_text = '\n'.join(chunk for chunk in chunks if chunk)
    
    return clean_text
