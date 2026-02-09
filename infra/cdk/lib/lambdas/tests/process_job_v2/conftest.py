"""
Pytest fixtures for process_job_v2 E2E tests.

Inserts the lambda root into sys.path[0] so that ``import services.aws``
resolves to the process_job_v2 copy, not a sibling lambda's.
"""

import json
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# sys.path setup — MUST happen before any lambda imports
# ---------------------------------------------------------------------------
_LAMBDA_ROOT = str(Path(__file__).resolve().parents[2] / "process_job_v2")
_TESTS_ROOT = str(Path(__file__).resolve().parents[1])

if _LAMBDA_ROOT not in sys.path:
    sys.path.insert(0, _LAMBDA_ROOT)
if _TESTS_ROOT not in sys.path:
    sys.path.insert(1, _TESTS_ROOT)

# ---------------------------------------------------------------------------
# Now safe to import shared helpers & lambda modules
# ---------------------------------------------------------------------------
import conftest_shared as shared  # noqa: E402
from mock_responses import (  # noqa: E402
    make_identified_avatar_list,
    make_avatar,
    make_marketing_angles,
    make_offer_brief,
    make_template_prediction_result,
    make_page_analysis,
    make_deep_research_output,
    make_library_summaries_json,
)


@pytest.fixture(autouse=True)
def _aws_env_and_moto():
    """
    Set env vars, start moto, create AWS resources, and mock SDK constructors.

    process_job_v2 uses a class-based AWSServices that creates boto3 clients
    in __init__, so moto intercepts them automatically as long as mock_aws
    is active before PipelineOrchestrator is instantiated.
    """
    from moto import mock_aws

    shared.set_common_env_vars()
    os.environ["OPENAI_API_KEY"] = "sk-test-fake"
    os.environ["PERPLEXITY_API_KEY"] = "pplx-test-fake"

    # Reset PromptService module-level cache
    import services.prompt_service as ps_mod
    ps_mod._prompt_cache.clear()
    ps_mod._cache_timestamp = 0.0

    with mock_aws():
        db_url = shared.load_database_url()
        shared.create_aws_resources(database_url=db_url)

        # Seed library summaries for TemplatePredictionStep
        import boto3
        s3 = boto3.client("s3", region_name=shared.AWS_REGION)
        s3.put_object(
            Bucket=shared.TEST_BUCKET,
            Key="content_library/library_summaries.json",
            Body=json.dumps(make_library_summaries_json()),
            ContentType="application/json",
        )

        # --- Mock OpenAI SDK ---
        mock_openai_cls = MagicMock()
        with patch("services.openai_service.OpenAI", mock_openai_cls):
            # --- Mock Perplexity SDK ---
            mock_perplexity_cls = MagicMock()
            with patch("services.perplexity_service.Perplexity", mock_perplexity_cls):
                # --- Mock Playwright screenshot capture ---
                with patch("utils.image.capture_page_screenshots") as mock_screenshots:
                    # --- Mock llm_usage ---
                    with patch("services.openai_service.emit_llm_usage_event"):
                        with patch("services.perplexity_service.emit_llm_usage_event"):
                            yield {
                                "mock_openai_cls": mock_openai_cls,
                                "mock_perplexity_cls": mock_perplexity_cls,
                                "mock_screenshots": mock_screenshots,
                            }


# ---------------------------------------------------------------------------
# LLM method mocks
# ---------------------------------------------------------------------------

@pytest.fixture()
def mock_analyze_page(monkeypatch, _aws_env_and_moto):
    """
    Mock capture_page_screenshots and OpenAIService.create_response
    for the page analysis step.
    """
    from pipeline.steps.analyze_page import PageAnalysisResult
    import base64

    # Create a tiny fake screenshot
    mock_screenshot = MagicMock()
    mock_screenshot.fullpage_bytes = b"\x89PNG" + b"\x00" * 100
    mock_screenshot.product_image_bytes = b"\x89PNG" + b"\x00" * 50
    _aws_env_and_moto["mock_screenshots"].return_value = mock_screenshot

    def _create_response(self, content, subtask, model=None):
        return make_page_analysis()

    monkeypatch.setattr(
        "services.openai_service.OpenAIService.create_response",
        _create_response,
    )


@pytest.fixture()
def mock_deep_research(monkeypatch):
    """Mock PerplexityService.deep_research."""

    def _deep_research(self, prompt, subtask, model=None):
        return make_deep_research_output()

    monkeypatch.setattr(
        "services.perplexity_service.PerplexityService.deep_research",
        _deep_research,
    )


@pytest.fixture()
def mock_parse_structured(monkeypatch):
    """
    Mock OpenAIService.parse_structured to dispatch by response_format type.

    Returns valid Pydantic model instances matching each step's expected output.
    """
    from data_models import (
        IdentifiedAvatarList,
        Avatar,
        AvatarMarketingAngles,
        OfferBrief,
    )

    def _parse_structured(self, prompt, response_format, subtask, model=None):
        if response_format is IdentifiedAvatarList:
            return make_identified_avatar_list()
        elif response_format is Avatar:
            return make_avatar()
        elif response_format is AvatarMarketingAngles:
            return make_marketing_angles()
        elif response_format is OfferBrief:
            return make_offer_brief()
        else:
            # Fallback for unknown types (e.g., template prediction)
            return MagicMock()

    monkeypatch.setattr(
        "services.openai_service.OpenAIService.parse_structured",
        _parse_structured,
    )


@pytest.fixture()
def mock_template_prediction(monkeypatch):
    """Mock TemplatePredictionStep.execute to return a valid result."""

    def _execute(self, avatar, angle, top_k=5):
        return make_template_prediction_result(
            avatar_id=avatar.id,
            angle_id=angle.id,
        )

    monkeypatch.setattr(
        "pipeline.steps.template_prediction.TemplatePredictionStep.execute",
        _execute,
    )


@pytest.fixture()
def mock_all_llm(
    mock_analyze_page,
    mock_deep_research,
    mock_parse_structured,
    mock_template_prediction,
):
    """Convenience fixture that activates all LLM mocks."""
    pass
