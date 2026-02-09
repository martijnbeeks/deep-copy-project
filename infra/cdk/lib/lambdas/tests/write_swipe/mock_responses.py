"""
Mock response factories for write_swipe tests.
"""

import json
from typing import Any, Dict, Tuple
from unittest.mock import MagicMock


def make_comprehensive_results(
    avatar_id: str = "test-avatar-id",
    angle_id: str = "test-angle-id",
) -> dict:
    """Return a minimal comprehensive_results.json structure for S3 seeding."""
    return {
        "results": {
            "research_page_analysis": "Test product analysis",
            "deep_research_output": "Test deep research output",
            "offer_brief": "Test offer brief with product details",
            "marketing_avatars": [
                {
                    "avatar": {
                        "id": avatar_id,
                        "overview": {
                            "name": "Test Avatar",
                            "headline": "A test avatar for unit tests",
                        },
                        "demographics": {
                            "age_range": "30-50",
                            "gender": "Male",
                        },
                    },
                    "angles": {
                        "generated_angles": [
                            {
                                "id": angle_id,
                                "angle_title": "Test Angle",
                                "angle_subtitle": "A test subtitle",
                                "core_argument": "Core argument for testing",
                                "angle_type": "problem_solution",
                            }
                        ]
                    },
                }
            ],
        }
    }


def make_swipe_template_html() -> str:
    """Return minimal advertorial HTML for template loading."""
    return """
    <html>
    <body>
        <h1>Test Advertorial Template</h1>
        <p>This is a test advertorial with compelling copy about the product.</p>
        <div class="section">
            <h2>Section One</h2>
            <p>Body text for section one with marketing content.</p>
        </div>
    </body>
    </html>
    """


def make_swipe_template_json() -> dict:
    """Return minimal advertorial JSON schema for tool use."""
    return {
        "type": "object",
        "properties": {
            "headline": {"type": "string"},
            "subheadline": {"type": "string"},
            "sections": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "section_title": {"type": "string"},
                        "section_body": {"type": "string"},
                        "imagePrompt": {"type": "string"},
                    },
                    "required": ["section_title", "section_body"],
                },
            },
        },
        "required": ["headline", "subheadline", "sections"],
    }


def make_structured_response() -> dict:
    """Return a mock structured response from Anthropic (advertorial JSON)."""
    return {
        "headline": "Revolutionary Test Product",
        "subheadline": "Discover the science-backed solution",
        "sections": [
            {
                "section_title": "The Problem",
                "section_body": "Many people struggle with this common issue.",
                "imagePrompt": "A person looking stressed at their desk",
            },
            {
                "section_title": "The Solution",
                "section_body": "Our product addresses this problem effectively.",
                "imagePrompt": "Happy person using the product outdoors",
            },
        ],
    }


def make_image_prompt_response() -> dict:
    """Return a mock structured response for image prompt regeneration."""
    return {
        "sections": [
            {"imagePrompt": "Realistic photo of a person looking stressed at their desk"},
            {"imagePrompt": "Realistic photo of happy person using product outdoors"},
        ]
    }


def make_streaming_response() -> str:
    """Return a mock streaming text response (style guide)."""
    return json.dumps({
        "tone": "conversational yet authoritative",
        "sentence_length": "medium",
        "vocabulary_level": "accessible",
        "persuasion_techniques": ["social proof", "urgency", "testimonials"],
    })


def make_usage_mock() -> MagicMock:
    """Return a mock usage object."""
    usage = MagicMock()
    usage.input_tokens = 100
    usage.output_tokens = 200
    return usage
