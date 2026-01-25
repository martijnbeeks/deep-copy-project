#!/usr/bin/env python3
"""
Generate summary library for all landing pages in S3 content_library.

Scans the S3 content_library folder for HTML files with _original.html suffix,
generates summaries using Claude, and stores them as a JSON library for future
prediction/matching use.

Usage:
    python scripts/generate_content_library_summaries.py --dry-run
    python scripts/generate_content_library_summaries.py
    python scripts/generate_content_library_summaries.py --single A00001
    python scripts/generate_content_library_summaries.py --output-local ./summaries.json

Dependencies:
    pip install anthropic boto3 beautifulsoup4 pydantic
"""

import argparse
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

# Add lambda directory to path for imports
LAMBDA_DIR = Path(__file__).parent.parent / "cdk" / "lib" / "lambdas" / "write_swipe"
sys.path.insert(0, str(LAMBDA_DIR))

import anthropic
import boto3
from bs4 import BeautifulSoup
from pydantic import BaseModel, Field

from services.aws import get_secrets


# ============================================================================
# CONFIGURATION
# ============================================================================

DEFAULT_BUCKET = "deepcopystack-resultsbucketa95a2103-zhwjflrlpfih"
CONTENT_LIBRARY_PREFIX = "content_library/"
OUTPUT_KEY = "content_library/library_summaries.json"
DEFAULT_MODEL = "claude-sonnet-4-5-20250929"


# ============================================================================
# DATA MODELS
# ============================================================================

class LandingPageSummary(BaseModel):
    """Summary of a single landing page from the content library."""
    id: str = Field(..., description="The landing page ID (e.g., 'A00001')")
    s3_key: str = Field(..., description="Full S3 key")
    product_name: Optional[str] = Field(None, description="Detected product name")
    product_category: Optional[str] = Field(
        None,
        description="Product category (e.g., 'supplement', 'course', 'software')"
    )
    short_description: str = Field(
        ...,
        description="One-sentence description of the product/service"
    )
    target_audience: str = Field(..., description="Who this product targets")
    primary_pain_point: str = Field(..., description="Main pain point addressed")
    primary_benefit: str = Field(..., description="Main benefit/outcome promised")
    tone: str = Field(
        ...,
        description="Writing tone (e.g., 'urgent', 'professional', 'friendly')"
    )
    keywords: List[str] = Field(
        default_factory=list,
        description="Key terms/phrases from the page (5-10)"
    )
    price_point: Optional[str] = Field(
        None,
        description="Price range if detectable ('low', 'mid', 'high', 'premium')"
    )
    text_length: int = Field(..., description="Character count of extracted text")
    processed_at: str = Field(..., description="ISO timestamp of processing")
    llm_model_used: str = Field(..., description="Model used for summarization")


class LandingPageAnalysis(BaseModel):
    """Schema for Claude's structured output (without metadata fields)."""
    product_name: Optional[str] = Field(None, description="Detected product name")
    product_category: Optional[str] = Field(
        None,
        description="Product category (e.g., 'supplement', 'course', 'software')"
    )
    short_description: str = Field(
        ...,
        description="One-sentence description of the product/service"
    )
    target_audience: str = Field(..., description="Who this product targets")
    primary_pain_point: str = Field(..., description="Main pain point addressed")
    primary_benefit: str = Field(..., description="Main benefit/outcome promised")
    tone: str = Field(
        ...,
        description="Writing tone (e.g., 'urgent', 'professional', 'friendly')"
    )
    keywords: List[str] = Field(
        default_factory=list,
        description="Key terms/phrases from the page (5-10)"
    )
    price_point: Optional[str] = Field(
        None,
        description="Price range if detectable ('low', 'mid', 'high', 'premium', 'unknown')"
    )


class ContentLibrarySummaries(BaseModel):
    """Complete library of all landing page summaries."""
    version: str = Field(default="1.0", description="Schema version")
    generated_at: str = Field(..., description="ISO timestamp of generation")
    total_pages: int = Field(..., description="Number of pages processed")
    summaries: List[LandingPageSummary] = Field(default_factory=list)


# ============================================================================
# HTML EXTRACTION
# ============================================================================

def extract_clean_text_from_html(html_content: str) -> Optional[str]:
    """
    Extract clean, readable text from HTML content.

    Follows the pattern from cdk/lib/lambdas/write_swipe/utils/html.py
    """
    if not html_content:
        return None

    try:
        soup = BeautifulSoup(html_content, 'html.parser')

        # Remove script, style, nav, footer, header elements
        for element in soup([
            "script", "style", "nav", "footer", "header",
            "noscript", "iframe", "svg"
        ]):
            element.decompose()

        # Try to find the main content area
        main_content = None
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
                main_content = max(found, key=lambda x: len(x.get_text()))
                break

        # Fallback to body or soup
        if not main_content:
            main_content = soup.body if soup.body else soup

        # Replace <br> and </p> with newlines to preserve structure
        for br in main_content.find_all("br"):
            br.replace_with("\n")

        for p in main_content.find_all("p"):
            p.append("\n\n")

        text = main_content.get_text()

        # Clean up whitespace
        text = re.sub(r'\n{3,}', '\n\n', text)
        lines = [line.strip() for line in text.split('\n')]
        text = '\n'.join(lines)

        return text.strip()

    except Exception as e:
        print(f"  WARNING: Error extracting text: {e}")
        # Fallback: simple tag removal
        return re.sub(r'<[^>]+>', ' ', html_content).strip()


# ============================================================================
# S3 OPERATIONS
# ============================================================================

def list_landing_pages(s3_client, bucket: str) -> List[tuple]:
    """
    List all landing pages in content_library with _original.html suffix.

    Returns:
        List of (page_id, s3_key) tuples
    """
    pages = []
    paginator = s3_client.get_paginator('list_objects_v2')

    for page in paginator.paginate(Bucket=bucket, Prefix=CONTENT_LIBRARY_PREFIX):
        for obj in page.get('Contents', []):
            key = obj['Key']
            if key.endswith('_original.html'):
                # Extract ID: content_library/A00002_original.html -> A00002
                match = re.search(r'content_library/(.+)_original\.html$', key)
                if match:
                    page_id = match.group(1)
                    pages.append((page_id, key))

    return sorted(pages, key=lambda x: x[0])


def load_html_from_s3(s3_client, bucket: str, key: str) -> str:
    """Load HTML content from S3."""
    obj = s3_client.get_object(Bucket=bucket, Key=key)
    return obj['Body'].read().decode('utf-8')


def save_library_to_s3(s3_client, bucket: str, library: ContentLibrarySummaries):
    """Save the summary library to S3."""
    body = library.model_dump_json(indent=2)

    # Save main file
    s3_client.put_object(
        Bucket=bucket,
        Key=OUTPUT_KEY,
        Body=body,
        ContentType='application/json'
    )
    print(f"Saved to s3://{bucket}/{OUTPUT_KEY}")

    # Save backup with timestamp
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')
    backup_key = f"content_library/library_summaries_backup_{timestamp}.json"
    s3_client.put_object(
        Bucket=bucket,
        Key=backup_key,
        Body=body,
        ContentType='application/json'
    )
    print(f"Backup saved to s3://{bucket}/{backup_key}")


# ============================================================================
# LLM SUMMARIZATION
# ============================================================================

def get_landing_page_summary_prompt(content: str) -> str:
    """Generate the prompt for landing page summarization."""
    return f"""You are analyzing a landing page (advertorial/pre-lander) to create a concise summary for a content library. This library will be used to match new products to existing landing page templates.

Extract the following information from this landing page text:

1. **Product Name**: The name of the product or service being sold (if identifiable)
2. **Product Category**: Category such as 'health supplement', 'digital course', 'SaaS tool', 'physical product', 'financial service', etc.
3. **Short Description**: One sentence describing what this product/service is and does
4. **Target Audience**: Who is this product for? Be specific about demographics and psychographics
5. **Primary Pain Point**: The main problem, frustration, or desire this product addresses
6. **Primary Benefit**: The main outcome or transformation promised
7. **Tone**: The overall writing tone - choose from: 'urgent', 'professional', 'friendly', 'scientific', 'conversational', 'sensational', 'authoritative'
8. **Keywords**: 5-10 key terms or phrases that characterize this landing page's content and style
9. **Price Point**: If detectable from the content, categorize as:
   - 'low' (under $50)
   - 'mid' ($50-200)
   - 'high' ($200-1000)
   - 'premium' (over $1000)
   - 'unknown' if not mentioned

Analyze the following landing page content:
---
{content[:50000]}
---

Provide your analysis using the structured output tool."""


def summarize_landing_page(
    client: anthropic.Anthropic,
    page_id: str,
    s3_key: str,
    text_content: str,
    model: str = DEFAULT_MODEL
) -> Optional[LandingPageSummary]:
    """Generate summary for a single landing page using Claude with tool use."""

    prompt = get_landing_page_summary_prompt(text_content)

    # Get schema for tool use
    tool_schema = LandingPageAnalysis.model_json_schema()

    # Clean up schema for tool use
    tool_input_schema = {
        k: v for k, v in tool_schema.items()
        if k not in ["$schema", "title", "description", "$defs"]
    }
    if "$defs" in tool_schema:
        tool_input_schema["$defs"] = tool_schema["$defs"]

    try:
        response = client.messages.create(
            model=model,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
            tools=[{
                "name": "create_landing_page_summary",
                "description": "Create a structured summary of the landing page",
                "input_schema": tool_input_schema
            }],
            tool_choice={"type": "tool", "name": "create_landing_page_summary"}
        )

        # Extract structured output from tool use
        for block in response.content:
            if block.type == "tool_use":
                analysis = LandingPageAnalysis.model_validate(block.input)

                # Convert to full summary with metadata
                return LandingPageSummary(
                    id=page_id,
                    s3_key=s3_key,
                    product_name=analysis.product_name,
                    product_category=analysis.product_category,
                    short_description=analysis.short_description,
                    target_audience=analysis.target_audience,
                    primary_pain_point=analysis.primary_pain_point,
                    primary_benefit=analysis.primary_benefit,
                    tone=analysis.tone,
                    keywords=analysis.keywords,
                    price_point=analysis.price_point,
                    text_length=len(text_content),
                    processed_at=datetime.now(timezone.utc).isoformat(),
                    llm_model_used=model
                )

        print(f"  WARNING: No tool use block in response")
        return None

    except Exception as e:
        print(f"  ERROR: Claude API call failed: {e}")
        return None


# ============================================================================
# MAIN
# ============================================================================

def main():
    parser = argparse.ArgumentParser(
        description='Generate content library summaries for landing pages'
    )
    parser.add_argument(
        '--bucket',
        default=DEFAULT_BUCKET,
        help=f'S3 bucket name (default: {DEFAULT_BUCKET})'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='List pages without processing'
    )
    parser.add_argument(
        '--single',
        type=str,
        help='Process single page by ID (e.g., A00001)'
    )
    parser.add_argument(
        '--output-local',
        type=str,
        help='Save to local file instead of S3'
    )
    parser.add_argument(
        '--model',
        default=DEFAULT_MODEL,
        help=f'Claude model to use (default: {DEFAULT_MODEL})'
    )
    args = parser.parse_args()

    print(f"S3 Bucket: {args.bucket}")
    print(f"Content library prefix: {CONTENT_LIBRARY_PREFIX}")
    print()

    # Initialize S3 client
    s3_client = boto3.client('s3')

    # List pages
    print("Scanning for landing pages...")
    pages = list_landing_pages(s3_client, args.bucket)
    print(f"Found {len(pages)} landing page(s) with _original.html suffix")
    print()

    if args.dry_run:
        print("Dry run - listing pages only:")
        for page_id, key in pages:
            print(f"  - {page_id}: {key}")
        return 0

    # Filter if single page requested
    if args.single:
        pages = [(pid, key) for pid, key in pages if pid == args.single]
        if not pages:
            print(f"ERROR: Page '{args.single}' not found")
            return 1
        print(f"Processing single page: {args.single}")

    # Initialize Claude client
    print("Fetching API key from Secrets Manager...")
    secrets = get_secrets()
    api_key = secrets.get('ANTHROPIC_API_KEY')
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY not found in secrets")
        return 1
    claude_client = anthropic.Anthropic(api_key=api_key)
    print(f"Using model: {args.model}")
    print()

    # Process pages
    summaries = []
    for i, (page_id, s3_key) in enumerate(pages):
        print(f"[{i + 1}/{len(pages)}] Processing: {page_id}")

        try:
            # Load HTML
            html = load_html_from_s3(s3_client, args.bucket, s3_key)
            print(f"  Loaded {len(html):,} bytes from S3")

            # Extract text
            text = extract_clean_text_from_html(html)
            if not text:
                print(f"  WARNING: No text extracted, skipping")
                continue
            print(f"  Extracted {len(text):,} characters of text")

            # Summarize
            summary = summarize_landing_page(
                claude_client, page_id, s3_key, text, args.model
            )
            if summary:
                summaries.append(summary)
                print(f"  OK: {summary.short_description[:70]}...")
            else:
                print(f"  WARNING: Failed to generate summary")

        except Exception as e:
            print(f"  ERROR: {e}")

        print()

    # Create library
    library = ContentLibrarySummaries(
        generated_at=datetime.now(timezone.utc).isoformat(),
        total_pages=len(summaries),
        summaries=summaries
    )

    print(f"Generated {len(summaries)} summaries")
    print()

    # Save
    if args.output_local:
        with open(args.output_local, 'w') as f:
            f.write(library.model_dump_json(indent=2))
        print(f"Saved to {args.output_local}")
    else:
        save_library_to_s3(s3_client, args.bucket, library)

    return 0


if __name__ == '__main__':
    sys.exit(main())
