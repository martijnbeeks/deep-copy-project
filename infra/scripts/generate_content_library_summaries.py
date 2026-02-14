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
    format_type: str = Field(
        ...,
        description="Template format: 'advertorial', 'listicle', 'advertorial_pov', 'advertorial_authority'"
    )
    writing_perspective: str = Field(
        ...,
        description="Narrative voice: 'first_person', 'third_person', 'second_person_direct', 'authority_expert'"
    )
    article_structure_flow: str = Field(
        ...,
        description="Narrative arc (e.g. 'personal story -> problem -> discovery -> mechanism -> social proof -> CTA')"
    )
    content_density: str = Field(
        ...,
        description="Content density: 'light', 'medium', 'dense'"
    )
    tone: str = Field(
        ...,
        description="Writing tone (e.g., 'urgent', 'professional', 'friendly', 'conversational')"
    )
    energy_level: str = Field(
        ...,
        description="Energy level: 'calm_educational', 'moderate', 'high_energy_urgent', 'emotionally_intense'"
    )
    persuasion_techniques: List[str] = Field(
        default_factory=list,
        description="3-5 persuasion techniques used"
    )
    emotional_approach: str = Field(
        ...,
        description="Emotional journey: 'fear_to_hope', 'frustration_to_relief', 'curiosity_to_discovery', etc."
    )
    engagement_devices: List[str] = Field(
        default_factory=list,
        description="3-5 engagement devices used"
    )
    cta_style: str = Field(
        ...,
        description="CTA style: 'soft_discovery', 'urgent_action', 'embedded_recurring', 'single_end'"
    )
    best_for_awareness_levels: List[str] = Field(
        default_factory=list,
        description="Best awareness levels: 'unaware', 'problem_aware', 'solution_aware', 'product_aware'"
    )
    best_for_angle_types: List[str] = Field(
        default_factory=list,
        description="Best angle types: 'mechanism', 'pain_lead', 'desire_lead', 'social_proof', 'fear_based', 'curiosity', 'contrarian', 'story'"
    )
    text_length: int = Field(..., description="Character count of extracted text")
    processed_at: str = Field(..., description="ISO timestamp of processing")
    llm_model_used: str = Field(..., description="Model used for summarization")


class LandingPageAnalysis(BaseModel):
    """Schema for Claude's structured output (without metadata fields)."""
    format_type: str = Field(
        ...,
        description="Template format: 'advertorial', 'listicle', 'advertorial_pov', 'advertorial_authority'"
    )
    writing_perspective: str = Field(
        ...,
        description="Narrative voice: 'first_person', 'third_person', 'second_person_direct', 'authority_expert'"
    )
    article_structure_flow: str = Field(
        ...,
        description="Narrative arc (e.g. 'personal story -> problem -> discovery -> mechanism -> social proof -> CTA')"
    )
    content_density: str = Field(
        ...,
        description="Content density: 'light', 'medium', 'dense'"
    )
    tone: str = Field(
        ...,
        description="Writing tone (e.g., 'urgent', 'professional', 'friendly', 'conversational')"
    )
    energy_level: str = Field(
        ...,
        description="Energy level: 'calm_educational', 'moderate', 'high_energy_urgent', 'emotionally_intense'"
    )
    persuasion_techniques: List[str] = Field(
        default_factory=list,
        description="3-5 persuasion techniques from: emotional_storytelling, social_proof, authority_citation, urgency_scarcity, fear_of_inaction, mechanism_explanation, before_after, statistics_data, testimonials, expert_endorsement, contrarian_reveal, curiosity_gap"
    )
    emotional_approach: str = Field(
        ...,
        description="Emotional journey: 'fear_to_hope', 'frustration_to_relief', 'curiosity_to_discovery', etc."
    )
    engagement_devices: List[str] = Field(
        default_factory=list,
        description="3-5 engagement devices from: personal_anecdote, expert_quotes, customer_testimonials, before_after_comparison, faq_section, numbered_list, statistics_callout, embedded_cta, image_heavy, pull_quotes"
    )
    cta_style: str = Field(
        ...,
        description="CTA style: 'soft_discovery', 'urgent_action', 'embedded_recurring', 'single_end'"
    )
    best_for_awareness_levels: List[str] = Field(
        default_factory=list,
        description="Best awareness levels from: 'unaware', 'problem_aware', 'solution_aware', 'product_aware'"
    )
    best_for_angle_types: List[str] = Field(
        default_factory=list,
        description="Best angle types from: 'mechanism', 'pain_lead', 'desire_lead', 'social_proof', 'fear_based', 'curiosity', 'contrarian', 'story'"
    )


class ContentLibrarySummaries(BaseModel):
    """Complete library of all landing page summaries."""
    version: str = Field(default="2.0", description="Schema version")
    generated_at: str = Field(..., description="ISO timestamp of generation")
    total_pages: int = Field(..., description="Number of pages processed")
    summaries: List[LandingPageSummary] = Field(default_factory=list)


# ============================================================================
# HTML EXTRACTION
# ============================================================================

def _extract_config_text(html_content: str) -> Optional[str]:
    """
    Extract readable text from JS-based CONFIG templates (AD0001_POV, AD0001_AUTHORITY).

    These templates store all content inside a <script>const CONFIG = {...}</script> block.
    Extracts headline, subheadline, section headlines and body HTML from the CONFIG.
    """
    match = re.search(r'const\s+CONFIG\s*=\s*\{', html_content)
    if not match:
        return None

    # Extract the CONFIG object text (from 'const CONFIG' to end of script)
    config_start = match.start()
    # Find the closing </script> after CONFIG
    script_end = html_content.find('</script>', config_start)
    if script_end == -1:
        return None

    config_text = html_content[config_start:script_end]

    # Extract key fields using regex
    parts = []

    # Template comments tell us the template type
    theme_match = re.search(r'THEME:\s*"([^"]*)"', config_text)
    category_match = re.search(r'CATEGORY:\s*"([^"]*)"', config_text)
    if category_match:
        parts.append(f"Category: {category_match.group(1)}")

    headline_match = re.search(r'HEADLINE:\s*"([^"]*)"', config_text)
    if headline_match:
        parts.append(f"Headline: {headline_match.group(1)}")

    subheadline_match = re.search(r'SUBHEADLINE:\s*"([^"]*)"', config_text)
    if subheadline_match:
        parts.append(f"Subheadline: {subheadline_match.group(1)}")

    author_match = re.search(r'AUTHOR_NAME:\s*"([^"]*)"', config_text)
    if author_match:
        parts.append(f"Author: {author_match.group(1)}")

    # Extract section headlines and body content (SECTIONS format)
    section_headlines = re.findall(r'headline:\s*"([^"]*)"', config_text)
    for i, h in enumerate(section_headlines, 1):
        parts.append(f"\nSection {i}: {h}")

    # Extract body HTML from template literals (backtick strings)
    body_blocks = re.findall(r'body:\s*`([^`]*)`', config_text)
    for body in body_blocks:
        clean = re.sub(r'<[^>]+>', ' ', body)
        clean = re.sub(r'\s+', ' ', clean).strip()
        if clean:
            parts.append(clean)

    # Extract body HTML from double-quoted strings (LD0001 listicle format)
    body_quoted = re.findall(r'"body":\s*"((?:[^"\\]|\\.)*)"', config_text)
    for body in body_quoted:
        clean = re.sub(r'<[^>]+>', ' ', body)
        clean = re.sub(r'\\n|\\r|\\t', ' ', clean)
        clean = re.sub(r'\s+', ' ', clean).strip()
        if clean:
            parts.append(clean)

    # Extract additional CONFIG fields common in listicle templates
    for field in ['OPENING_HOOK', 'OPENING_BODY', 'SUB_HEADLINE', 'HERO_HEADLINE',
                  'EXPERT_QUOTE', 'SOLUTION_INSIGHT', 'PRODUCT_INTRO',
                  'PRODUCT_TAGLINE', 'FINAL_CTA_HEADLINE']:
        field_match = re.search(rf'{field}:\s*"((?:[^"\\]|\\.)*)"', config_text)
        if field_match:
            clean = re.sub(r'<[^>]+>', ' ', field_match.group(1))
            clean = re.sub(r'\s+', ' ', clean).strip()
            if clean:
                parts.append(f"{field}: {clean}")

    # Also extract HTML comment instructions (template capabilities)
    comments = re.findall(r'║\s*(.+?)\s*║', html_content[:3000])
    if comments:
        template_info = [c.strip() for c in comments if c.strip() and '⬇' not in c]
        if template_info:
            parts.append("\nTemplate capabilities: " + "; ".join(template_info[:10]))

    result = "\n".join(parts)
    return result.strip() if result.strip() else None


def extract_clean_text_from_html(html_content: str) -> Optional[str]:
    """
    Extract clean, readable text from HTML content.

    Handles both regular HTML pages and JS-based CONFIG templates.
    """
    if not html_content:
        return None

    # First, check for JS-based CONFIG templates
    config_text = _extract_config_text(html_content)
    if config_text and len(config_text) > 200:
        return config_text

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
                candidate = max(found, key=lambda x: len(x.get_text()))
                # Only use selector match if it has substantial text
                if len(candidate.get_text().strip()) > 200:
                    main_content = candidate
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

        return text.strip() if text.strip() else None

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
    """Generate the prompt for landing page style/format analysis."""
    return f"""You are analyzing a landing page (advertorial/pre-lander) to create a STYLE AND FORMAT profile for a content library. This profile will be used to match the template's writing style to new avatar+angle combinations — NOT to match by product content.

IMPORTANT: Ignore what product is being sold. Focus entirely on HOW the page is written, structured, and persuades.

Analyze the following dimensions:

1. **format_type**: The template format — choose ONE:
   - 'advertorial' — third-person news/editorial style article
   - 'listicle' — numbered list format (e.g., "5 Reasons Why...")
   - 'advertorial_pov' — first-person personal story advertorial
   - 'advertorial_authority' — expert/authority-driven advertorial

2. **writing_perspective**: The narrative voice — choose ONE:
   - 'first_person' — "I discovered...", personal narrative
   - 'third_person' — "Studies show...", "Experts say..."
   - 'second_person_direct' — "You need to...", "Are you tired of..."
   - 'authority_expert' — "Dr. Smith reveals...", "According to research..."

3. **article_structure_flow**: Describe the narrative arc as a flow, e.g.:
   - "personal story -> problem -> discovery -> mechanism -> social proof -> CTA"
   - "hook question -> list of tips -> product reveal -> testimonials -> CTA"

4. **content_density**: How much content per section — choose ONE: 'light', 'medium', 'dense'

5. **tone**: Overall writing tone — choose from: 'urgent', 'professional', 'friendly', 'scientific', 'conversational', 'sensational', 'authoritative'

6. **energy_level**: Emotional intensity — choose ONE:
   - 'calm_educational' — informative, measured
   - 'moderate' — engaged but not pushy
   - 'high_energy_urgent' — time-pressure, exclamation marks, urgency
   - 'emotionally_intense' — strong emotional appeals, dramatic language

7. **persuasion_techniques**: Choose 3-5 from this list:
   emotional_storytelling, social_proof, authority_citation, urgency_scarcity, fear_of_inaction, mechanism_explanation, before_after, statistics_data, testimonials, expert_endorsement, contrarian_reveal, curiosity_gap

8. **emotional_approach**: The emotional journey — e.g.:
   'fear_to_hope', 'frustration_to_relief', 'curiosity_to_discovery', 'shame_to_empowerment', 'skepticism_to_trust'

9. **engagement_devices**: Choose 3-5 from this list:
   personal_anecdote, expert_quotes, customer_testimonials, before_after_comparison, faq_section, numbered_list, statistics_callout, embedded_cta, image_heavy, pull_quotes

10. **cta_style**: How calls-to-action appear — choose ONE:
    - 'soft_discovery' — "Learn more", subtle
    - 'urgent_action' — "Order NOW before it's gone!"
    - 'embedded_recurring' — CTAs throughout the article
    - 'single_end' — one CTA at the end

11. **best_for_awareness_levels**: Which audience awareness levels does this template style work best for? Choose 1-3 from: 'unaware', 'problem_aware', 'solution_aware', 'product_aware'

12. **best_for_angle_types**: Which marketing angle types does this template style work best for? Choose 2-4 from: 'mechanism', 'pain_lead', 'desire_lead', 'social_proof', 'fear_based', 'curiosity', 'contrarian', 'story'

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
                    format_type=analysis.format_type,
                    writing_perspective=analysis.writing_perspective,
                    article_structure_flow=analysis.article_structure_flow,
                    content_density=analysis.content_density,
                    tone=analysis.tone,
                    energy_level=analysis.energy_level,
                    persuasion_techniques=analysis.persuasion_techniques,
                    emotional_approach=analysis.emotional_approach,
                    engagement_devices=analysis.engagement_devices,
                    cta_style=analysis.cta_style,
                    best_for_awareness_levels=analysis.best_for_awareness_levels,
                    best_for_angle_types=analysis.best_for_angle_types,
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
                print(f"  OK: {summary.format_type} / {summary.writing_perspective} / {summary.tone}")
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
