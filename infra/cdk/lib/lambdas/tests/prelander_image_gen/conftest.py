"""
Pytest fixtures for prelander_image_gen E2E tests.

Inserts the lambda root into sys.path[0] so that ``import services.aws``
resolves to the prelander_image_gen copy, not a sibling lambda's.
"""

import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# sys.path setup — MUST happen before any lambda imports
# ---------------------------------------------------------------------------
_LAMBDA_ROOT = str(Path(__file__).resolve().parents[2] / "prelander_image_gen")
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
from mock_responses import make_tiny_png_b64, make_cloudflare_upload_response  # noqa: E402


@pytest.fixture(autouse=True)
def _aws_env_and_moto():
    """
    Set env vars, start moto, create AWS resources, patch module-level
    boto3 clients, and mock external services (Gemini, Cloudflare, requests).
    """
    import boto3
    from moto import mock_aws

    shared.set_common_env_vars()
    # Cloudflare service reads these from env
    os.environ["CLOUDFLARE_API_TOKEN"] = "cf-test-fake"
    os.environ["CLOUDFLARE_ACCOUNT_ID"] = "cf-account-fake"
    os.environ["GEMINI_API_KEY"] = "gemini-test-fake"

    # Clear cached lambda modules so they re-import within the mocked context
    _lambda_modules = [k for k in sys.modules if k.startswith(("handler", "services.", "utils.", "pipeline."))]
    saved = {k: sys.modules.pop(k) for k in _lambda_modules}

    with mock_aws():
        shared.create_aws_resources(database_url="postgresql://fake:fake@localhost/fake")

        # --- Mock Gemini genai (imported as `from google import genai` inside __init__) ---
        mock_genai = MagicMock()
        with patch.dict("sys.modules", {"google": MagicMock(), "google.genai": mock_genai}):
            # --- Mock CloudflareService (prevent real HTTP) ---
            mock_cf_cls = MagicMock()
            with patch("services.cloudflare_service.Cloudflare", mock_cf_cls):
                # --- Mock requests.get in services.aws (download_image_to_b64) ---
                with patch("services.aws.requests.get") as mock_requests_get:
                    # Re-import aws module and patch its module-level clients
                    import services.aws as aws_mod
                    aws_mod.s3_client = boto3.client("s3", region_name=shared.AWS_REGION)
                    aws_mod.ddb_client = boto3.client("dynamodb", region_name=shared.AWS_REGION)

                    yield {
                        "mock_genai": mock_genai,
                        "mock_cf_cls": mock_cf_cls,
                        "mock_requests_get": mock_requests_get,
                    }


@pytest.fixture()
def mock_gemini_generate(monkeypatch):
    """
    Provide a pre-wired mock for GeminiService.generate_image that returns
    a valid base64 PNG string.
    """
    b64 = make_tiny_png_b64()

    def _generate(self, prompt, product_image_bytes=None, job_id=None):
        return b64

    monkeypatch.setattr(
        "services.gemini_service.GeminiService.generate_image", _generate
    )
    return b64


@pytest.fixture()
def mock_cloudflare_upload(monkeypatch):
    """
    Provide a pre-wired mock for CloudflareService.upload_base64_image.
    """

    def _upload(self, base64_data, filename, role, job_id=None):
        return make_cloudflare_upload_response(job_id=job_id or "test", role=role)

    monkeypatch.setattr(
        "services.cloudflare_service.CloudflareService.upload_base64_image", _upload
    )


@pytest.fixture()
def mock_download_image(_aws_env_and_moto):
    """Mock requests.get for download_image_to_b64 to return image data."""
    import base64

    tiny_png = base64.b64decode(make_tiny_png_b64())
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.headers = {"content-type": "image/png"}
    mock_resp.content = tiny_png
    mock_resp.raise_for_status = MagicMock()
    _aws_env_and_moto["mock_requests_get"].return_value = mock_resp
