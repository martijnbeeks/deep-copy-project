"""
E2E tests for the prelander_image_gen Lambda handler.
"""

import json

import pytest

import conftest_shared as shared
from mock_responses import make_tiny_png_b64, make_cloudflare_upload_response


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_DEFAULT_PROMPTS = [
    {"role": "hero", "prompt": "A hero banner image"},
    {"role": "section", "index": 0, "prompt": "A section image"},
]


def _base_event(prompts=None, product_url=None, job_id="test-job-prelander"):
    """Build a minimal valid event dict."""
    return {
        "job_id": job_id,
        "templateId": "A00005",
        "type": "realistic",
        "prompts": _DEFAULT_PROMPTS if prompts is None else prompts,
        "productImageUrl": product_url,
    }


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestHappyPathWithProductImage:
    """Full pipeline with product image URL provided."""

    def test_returns_200_and_images(
        self, mock_gemini_generate, mock_cloudflare_upload, mock_download_image
    ):
        from handler import lambda_handler

        event = _base_event(
            product_url="https://example.com/product.png",
            prompts=[
                {"role": "hero", "prompt": "Hero banner"},
                {"role": "section", "index": 0, "prompt": "Section 0"},
                {"role": "product", "prompt": "Product shot"},
            ],
        )
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 200
        body = json.loads(resp["body"])
        assert body["success"] is True
        assert len(body["images"]) == 3

    def test_saves_results_to_s3(
        self, mock_gemini_generate, mock_cloudflare_upload, mock_download_image
    ):
        from handler import lambda_handler

        job_id = "test-s3-save"
        event = _base_event(
            job_id=job_id,
            product_url="https://example.com/product.png",
        )
        lambda_handler(event, None)

        key = f"results/prelander-images/{job_id}/results.json"
        data = shared.get_s3_json(key)
        assert data["success"] is True
        assert len(data["images"]) == 2

    def test_updates_ddb_status(
        self, mock_gemini_generate, mock_cloudflare_upload, mock_download_image
    ):
        from handler import lambda_handler

        job_id = "test-ddb-status"
        event = _base_event(
            job_id=job_id,
            product_url="https://example.com/product.png",
        )
        lambda_handler(event, None)

        status = shared.get_job_status(job_id)
        assert status == "COMPLETED_PRELANDER_IMAGE_GEN"


class TestHappyPathWithoutProductImage:
    """Pipeline without a product image URL."""

    def test_generates_without_product_bytes(
        self, mock_gemini_generate, mock_cloudflare_upload
    ):
        from handler import lambda_handler

        event = _base_event(product_url=None)
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 200
        body = json.loads(resp["body"])
        assert body["success"] is True
        assert len(body["images"]) == 2


class TestInvalidPrompts:
    """Validation: empty or missing prompts list."""

    def test_empty_prompts_returns_400(self):
        from handler import lambda_handler

        event = _base_event(prompts=[])
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 400
        body = json.loads(resp["body"])
        assert "error" in body

    def test_missing_prompts_returns_400(self):
        from handler import lambda_handler

        event = {"job_id": "bad-event"}
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 400

    def test_failed_status_written_on_invalid_prompts(self):
        from handler import lambda_handler

        job_id = "test-fail-status"
        event = {"job_id": job_id, "prompts": []}
        lambda_handler(event, None)

        status = shared.get_job_status(job_id)
        assert status == "FAILED_PRELANDER_IMAGE_GEN"


class TestPartialFailure:
    """One generation fails; others should succeed."""

    def test_partial_failure_continues(
        self, mock_cloudflare_upload, mock_download_image, monkeypatch
    ):
        from handler import lambda_handler

        call_count = {"n": 0}

        def _generate(self, prompt, product_image_bytes=None, job_id=None):
            call_count["n"] += 1
            if call_count["n"] == 1:
                raise RuntimeError("Gemini exploded")
            return make_tiny_png_b64()

        monkeypatch.setattr(
            "services.gemini_service.GeminiService.generate_image", _generate
        )

        event = _base_event(
            prompts=[
                {"role": "hero", "prompt": "Fail me"},
                {"role": "section", "index": 0, "prompt": "Succeed"},
            ],
        )
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 200
        body = json.loads(resp["body"])
        # First failed, second succeeded
        assert len(body["images"]) == 1
        assert body["images"][0]["role"] == "section"


class TestImageResults:
    """Verify the structure of result items."""

    def test_result_contains_role_and_url(
        self, mock_gemini_generate, mock_cloudflare_upload
    ):
        from handler import lambda_handler

        event = _base_event(
            prompts=[
                {"role": "hero", "prompt": "Banner"},
                {"role": "section", "index": 2, "prompt": "Third section"},
            ],
        )
        resp = lambda_handler(event, None)
        body = json.loads(resp["body"])

        hero = next(i for i in body["images"] if i["role"] == "hero")
        assert "url" in hero
        assert hero["url"].startswith("https://")

        section = next(i for i in body["images"] if i["role"] == "section")
        assert section["index"] == 2
