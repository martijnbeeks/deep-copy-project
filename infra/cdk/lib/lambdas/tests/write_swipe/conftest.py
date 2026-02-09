"""
Pytest fixtures for write_swipe E2E tests.

Inserts the lambda root into sys.path[0] so that ``import services.aws``
resolves to the write_swipe copy, not a sibling lambda's.
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
_LAMBDA_ROOT = str(Path(__file__).resolve().parents[2] / "write_swipe")
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
    make_comprehensive_results,
    make_swipe_template_html,
    make_swipe_template_json,
    make_structured_response,
    make_image_prompt_response,
    make_streaming_response,
    make_usage_mock,
)


@pytest.fixture(autouse=True)
def _aws_env_and_moto():
    """
    Set env vars, start moto, create AWS resources, patch module-level
    boto3 clients, and mock external services (Anthropic).
    """
    import boto3
    from moto import mock_aws

    shared.set_common_env_vars()
    os.environ["ANTHROPIC_API_KEY"] = "sk-ant-test-fake"

    # Reset PromptService module-level cache
    import services.prompt_service as ps_mod
    ps_mod._prompt_cache.clear()
    ps_mod._cache_timestamp = 0.0

    with mock_aws():
        db_url = shared.load_database_url()
        shared.create_aws_resources(database_url=db_url)

        s3 = boto3.client("s3", region_name=shared.AWS_REGION)

        # Seed comprehensive results (original job)
        original_job_id = "original-job-123"
        results_data = make_comprehensive_results()
        s3.put_object(
            Bucket=shared.TEST_BUCKET,
            Key=f"results/{original_job_id}/comprehensive_results.json",
            Body=json.dumps(results_data),
            ContentType="application/json",
        )

        # Seed swipe file templates into content_library/
        for template_id in ["AD0001_POV", "AD0001_AUTHORITY", "LD0001", "A00002"]:
            s3.put_object(
                Bucket=shared.TEST_BUCKET,
                Key=f"content_library/{template_id}_original.html",
                Body=make_swipe_template_html().encode("utf-8"),
                ContentType="text/html",
            )
            s3.put_object(
                Bucket=shared.TEST_BUCKET,
                Key=f"content_library/{template_id}.json",
                Body=json.dumps(make_swipe_template_json()),
                ContentType="application/json",
            )

        # Patch module-level boto3 clients created at import time
        import services.aws as aws_mod
        aws_mod.s3_client = boto3.client("s3", region_name=shared.AWS_REGION)
        aws_mod.ddb_client = boto3.client("dynamodb", region_name=shared.AWS_REGION)

        # --- Mock Anthropic SDK ---
        mock_anthropic_cls = MagicMock()
        with patch("services.anthropic_service.anthropic.Anthropic", mock_anthropic_cls):
            # --- Mock llm_usage ---
            with patch("services.anthropic_service.emit_llm_usage_event"):
                with patch("pipeline.steps.swipe_generation.emit_llm_usage_event"):
                    yield {
                        "mock_anthropic_cls": mock_anthropic_cls,
                    }


@pytest.fixture()
def mock_anthropic_structured(monkeypatch):
    """
    Mock AnthropicService.make_structured_request to return a valid
    advertorial dict without calling the real API.
    """
    call_count = {"n": 0}

    def _structured(self, messages, tool_name, tool_description, tool_schema, max_tokens, model, usage_ctx=None, usage_subtask=""):
        call_count["n"] += 1
        # First call returns structured advertorial, second call returns image prompts
        if call_count["n"] % 2 == 1:
            return make_structured_response()
        else:
            return make_image_prompt_response()

    monkeypatch.setattr(
        "services.anthropic_service.AnthropicService.make_structured_request",
        _structured,
    )


@pytest.fixture()
def mock_anthropic_streaming(monkeypatch):
    """
    Mock AnthropicService.make_streaming_request to return a style guide
    string without calling the real API.
    """

    def _streaming(self, messages, max_tokens, model, system_prompt=None, usage_ctx=None, usage_subtask=""):
        return make_streaming_response(), make_usage_mock()

    monkeypatch.setattr(
        "services.anthropic_service.AnthropicService.make_streaming_request",
        _streaming,
    )
