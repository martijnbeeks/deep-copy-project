"""
Pytest fixtures for image_gen_process E2E tests.

Inserts the lambda root into sys.path[0] so that ``import services.aws``
resolves to the image_gen_process copy, not a sibling lambda's.
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
_LAMBDA_ROOT = str(Path(__file__).resolve().parents[2] / "image_gen_process")
_TESTS_ROOT = str(Path(__file__).resolve().parents[1])

# Insert at front so this lambda's modules win over any cached siblings
if _LAMBDA_ROOT not in sys.path:
    sys.path.insert(0, _LAMBDA_ROOT)
if _TESTS_ROOT not in sys.path:
    sys.path.insert(1, _TESTS_ROOT)

# ---------------------------------------------------------------------------
# Now safe to import shared helpers & lambda modules
# ---------------------------------------------------------------------------
import conftest_shared as shared  # noqa: E402
from mock_responses import (  # noqa: E402
    make_tiny_png_b64,
    make_tiny_png_bytes,
    make_cloudflare_upload_response,
    make_library_descriptions,
    make_match_response,
)


@pytest.fixture(autouse=True)
def _aws_env_and_moto():
    """
    Set env vars, start moto, create AWS resources, patch module-level
    boto3 clients, and mock external services (OpenAI, Gemini, Cloudflare, requests).
    """
    import boto3
    from moto import mock_aws

    shared.set_common_env_vars()
    # Services read these from env
    os.environ["CLOUDFLARE_API_TOKEN"] = "cf-test-fake"
    os.environ["CLOUDFLARE_ACCOUNT_ID"] = "cf-account-fake"
    os.environ["GEMINI_API_KEY"] = "gemini-test-fake"
    os.environ["OPENAI_API_KEY"] = "openai-test-fake"
    os.environ["IMAGE_GENERATION_PROVIDER"] = "google"

    # Reset PromptService module-level cache
    import services.prompt_service as ps_mod
    ps_mod._prompt_cache.clear()
    ps_mod._cache_timestamp = 0.0

    with mock_aws():
        db_url = shared.load_database_url()
        shared.create_aws_resources(database_url=db_url)

        # Seed image library descriptions into S3
        s3 = boto3.client("s3", region_name=shared.AWS_REGION)
        s3.put_object(
            Bucket=shared.TEST_BUCKET,
            Key="image_library/static-library-descriptions.json",
            Body=json.dumps(make_library_descriptions()),
            ContentType="application/json",
        )

        # Seed a library image file (so load_bytes_from_s3 works)
        s3.put_object(
            Bucket=shared.TEST_BUCKET,
            Key="image_library/12.png",
            Body=make_tiny_png_bytes(),
            ContentType="image/png",
        )
        s3.put_object(
            Bucket=shared.TEST_BUCKET,
            Key="image_library/23.png",
            Body=make_tiny_png_bytes(),
            ContentType="image/png",
        )

        # Patch module-level boto3 clients created at import time
        import services.aws as aws_mod
        aws_mod.s3_client = boto3.client("s3", region_name=shared.AWS_REGION)
        aws_mod.ddb_client = boto3.client("dynamodb", region_name=shared.AWS_REGION)

        # --- Mock OpenAI SDK ---
        mock_openai_cls = MagicMock()
        with patch("services.openai_service.OpenAI", mock_openai_cls):
            # --- Mock Gemini genai (imported as `from google import genai` inside __init__) ---
            mock_genai = MagicMock()
            with patch.dict("sys.modules", {"google": MagicMock(), "google.genai": mock_genai}):
                # --- Mock Cloudflare ---
                mock_cf_cls = MagicMock()
                with patch("services.cloudflare_service.Cloudflare", mock_cf_cls):
                    # --- Mock requests.get (for download_image_to_b64 & _download_image_bytes_from_url) ---
                    with patch("services.aws.requests.get") as mock_aws_requests_get:
                        with patch("pipeline.orchestrator.requests.get") as mock_orch_requests_get:
                            # --- Mock llm_usage to prevent S3 writes ---
                            with patch("services.openai_service.emit_llm_usage_event"):
                                with patch("services.gemini_service.emit_llm_usage_event"):
                                    yield {
                                        "mock_openai_cls": mock_openai_cls,
                                        "mock_genai": mock_genai,
                                        "mock_cf_cls": mock_cf_cls,
                                        "mock_aws_requests_get": mock_aws_requests_get,
                                        "mock_orch_requests_get": mock_orch_requests_get,
                                    }


@pytest.fixture()
def mock_gemini_generate(monkeypatch):
    """
    Provide a pre-wired mock for GeminiService.generate_image that returns
    a valid base64 PNG string.
    """
    b64 = make_tiny_png_b64()

    def _generate(self, prompt, reference_image_bytes=None, product_image_bytes=None, job_id=None):
        return b64

    monkeypatch.setattr(
        "services.gemini_service.GeminiService.generate_image", _generate
    )
    return b64


@pytest.fixture()
def mock_openai_generate(monkeypatch):
    """
    Provide a pre-wired mock for OpenAIService.generate_image that returns
    a valid base64 PNG string.
    """
    b64 = make_tiny_png_b64()

    def _generate(self, prompt, reference_image_data=None, product_image_data=None, job_id=None):
        return b64

    monkeypatch.setattr(
        "services.openai_service.OpenAIService.generate_image", _generate
    )
    return b64


@pytest.fixture()
def mock_cloudflare_upload(monkeypatch):
    """
    Provide a pre-wired mock for CloudflareService.upload_base64_image.
    """

    def _upload(self, base64_data, filename, product_name, angle_num, variation_num, job_id=None):
        return make_cloudflare_upload_response(
            job_id=job_id or "test",
            product_name=product_name or "TestProduct",
            angle_num=angle_num,
            variation_num=variation_num,
        )

    monkeypatch.setattr(
        "services.cloudflare_service.CloudflareService.upload_base64_image", _upload
    )


@pytest.fixture()
def mock_openai_match(monkeypatch):
    """
    Provide a pre-wired mock for OpenAIService.match_angles_to_images
    that returns a valid JSON response with default assignments.
    """

    def _match(self, system_prompt, user_prompt, job_id):
        return make_match_response({"1:1": "12.png", "2:1": "23.png"})

    monkeypatch.setattr(
        "services.openai_service.OpenAIService.match_angles_to_images", _match
    )


@pytest.fixture()
def mock_openai_summarize(monkeypatch):
    """Mock OpenAIService.summarize_docs to return a simple summary."""

    def _summarize(self, foundational_text, language, job_id, prompt_service=None):
        return "Summarized product research text."

    monkeypatch.setattr(
        "services.openai_service.OpenAIService.summarize_docs", _summarize
    )


@pytest.fixture()
def mock_openai_detect_product(monkeypatch):
    """Mock OpenAIService.detect_product_in_image to return False."""

    def _detect(self, image_bytes, job_id, prompt_service=None):
        return False

    monkeypatch.setattr(
        "services.openai_service.OpenAIService.detect_product_in_image", _detect
    )


@pytest.fixture()
def mock_download_image(_aws_env_and_moto):
    """Mock requests.get for download_image_to_b64 and _download_image_bytes_from_url."""
    import base64

    tiny_png = base64.b64decode(make_tiny_png_b64())
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"content-type": "image/png"}
    mock_resp.content = tiny_png
    mock_resp.raise_for_status = MagicMock()
    _aws_env_and_moto["mock_aws_requests_get"].return_value = mock_resp
    _aws_env_and_moto["mock_orch_requests_get"].return_value = mock_resp
