# Prelander AI Pipeline

A LangChain pipeline for creating high-converting pre-lander copy.

## Features

- **PDF File Attachment**: The pipeline now supports attaching PDF files directly to LLM calls instead of converting them to text. This is particularly useful for analyzing sales pages and other documents that need to be processed as files.

## Configuration

### Sales Page PDF Analysis

The pipeline automatically downloads and analyzes PDFs from URLs specified in the configuration:

1. **URL Configuration**: Set the `link_to_sales_page` variable in `DEFAULT_VARIABLES` (in `steps.py`) to point to your sales page URL.

2. **Automatic Download**: The pipeline will:
   - Download the PDF from the specified URL
   - Store it temporarily
   - Attach it as a file to the LLM call for analysis
   - Clean up the temporary file after processing

3. **Fallback Handling**: If the URL doesn't point to a PDF or download fails, the pipeline will provide a fallback analysis based on the URL and product information.

**Note**: The system now supports both PDF files and HTML pages:
- **PDF URLs**: Downloads and processes directly
- **HTML URLs**: Automatically converts to PDF using Playwright (handles JavaScript, dynamic content, and modern web layouts)
- **Fallback**: If conversion fails, falls back to URL-based analysis

### Environment Variables

- `ADVERTORIAL_MAIN_ANGLE`: Override the advertorial main angle
- `COMPETITOR_ADVERTORIAL_PDF`: Path to competitor advertorial PDF
- `RESEARCH_PDF`: Path to research PDF

## Usage

```bash
# Run the pipeline
python -m ai_pipeline.main

# Or use the CLI
prelander-run
```

## Dependencies

- `requests`: For downloading PDFs from URLs
- `pypdf`: For PDF text extraction (fallback)
- `playwright`: For converting HTML pages to PDF (handles JavaScript and dynamic content)
- `langchain`: For the AI pipeline
- `openai`: For LLM integration

## Installation

After installing the package dependencies, you need to install Playwright's browser binaries:

```bash
# Install the package
pip install -e .

# Install Playwright browsers
python install_playwright.py
```

## File Structure

```
ai_pipeline/
├── src/ai_pipeline/
│   ├── steps.py          # Configuration and PDF download logic
│   ├── pipeline.py       # Main pipeline with file attachment support
│   └── main.py          # Entry point
├── content/             # Content files and PDFs
└── pyproject.toml      # Dependencies
``` 