"""
E2E tests for the image_gen_process Lambda handler.
"""

import json

import pytest

import conftest_shared as shared
from mock_responses import make_tiny_png_b64, make_match_response


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _base_event(
    job_id="test-job-imggen",
    product_name="TestProduct",
    avatar=None,
    angles=None,
    forced_ids=None,
    product_url="https://example.com/product.png",
    language="english",
):
    """Build a minimal valid event dict for image_gen_process."""
    event = {
        "job_id": job_id,
        "project_name": "Test Project",
        "productName": product_name,
        "selectedAvatar": avatar or {
            "description": "Men 50-65, skeptical, wants fast relief"
        },
        "selectedAngles": angles or [
            {
                "angle_number": 1,
                "angle_name": "Pain relief without pills",
                "visual_variations": [
                    {"variation_number": 1, "description": "Man stretching outdoors"}
                ],
            },
        ],
        "language": language,
    }
    if product_url:
        event["productImageUrls"] = [product_url]
    if forced_ids:
        event["forcedReferenceImageIds"] = forced_ids
    return event


# ---------------------------------------------------------------------------
# Tests — Forced Reference IDs (round-robin, no AI matching)
# ---------------------------------------------------------------------------

class TestForcedReferenceIds:
    """Pipeline with forcedReferenceImageIds: skips AI matching, round-robin."""

    def test_returns_200_and_results(
        self,
        mock_gemini_generate,
        mock_cloudflare_upload,
        mock_download_image,
    ):
        from handler import lambda_handler

        event = _base_event(forced_ids=["12.png"])
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 200
        body = json.loads(resp["body"])
        assert body["count"] >= 1
        assert body["results"][0]["status"] == "success"

    def test_saves_results_to_s3(
        self,
        mock_gemini_generate,
        mock_cloudflare_upload,
        mock_download_image,
    ):
        from handler import lambda_handler

        job_id = "test-s3-forced"
        event = _base_event(job_id=job_id, forced_ids=["12.png"])
        lambda_handler(event, None)

        key = f"results/image-gen/{job_id}/image_gen_results.json"
        data = shared.get_s3_json(key)
        assert data["job_id"] == job_id
        assert len(data["results"]) >= 1

    def test_updates_ddb_status(
        self,
        mock_gemini_generate,
        mock_cloudflare_upload,
        mock_download_image,
    ):
        from handler import lambda_handler

        job_id = "test-ddb-forced"
        event = _base_event(job_id=job_id, forced_ids=["12.png"])
        lambda_handler(event, None)

        status = shared.get_job_status(job_id)
        assert status == "COMPLETED_IMAGE_GEN"

    def test_round_robin_multiple_angles(
        self,
        mock_gemini_generate,
        mock_cloudflare_upload,
        mock_download_image,
    ):
        """Two angles with one variation each, two forced IDs -> alternates."""
        from handler import lambda_handler

        event = _base_event(
            forced_ids=["12.png", "23.png"],
            angles=[
                {
                    "angle_number": 1,
                    "angle_name": "Pain relief",
                    "visual_variations": [
                        {"variation_number": 1, "description": "Stretching"}
                    ],
                },
                {
                    "angle_number": 2,
                    "angle_name": "Active lifestyle",
                    "visual_variations": [
                        {"variation_number": 1, "description": "Walking"}
                    ],
                },
            ],
        )
        resp = lambda_handler(event, None)
        body = json.loads(resp["body"])
        assert body["count"] == 2
        refs = [r["reference_image_id"] for r in body["results"]]
        assert "12.png" in refs
        assert "23.png" in refs


# ---------------------------------------------------------------------------
# Tests — AI Matching (no forced IDs)
# ---------------------------------------------------------------------------

class TestAIMatching:
    """Pipeline without forcedReferenceImageIds: uses OpenAI matching."""

    def test_ai_matching_called(
        self,
        mock_openai_match,
        mock_gemini_generate,
        mock_cloudflare_upload,
        mock_download_image,
    ):
        from handler import lambda_handler

        event = _base_event(forced_ids=None)
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 200
        body = json.loads(resp["body"])
        assert body["count"] >= 1

    def test_ai_matching_multi_angle(
        self,
        mock_cloudflare_upload,
        mock_download_image,
        monkeypatch,
    ):
        """AI matching with 2 angles -> 2 results."""
        from handler import lambda_handler

        b64 = make_tiny_png_b64()

        def _generate(self, prompt, reference_image_bytes=None, product_image_bytes=None, job_id=None):
            return b64

        monkeypatch.setattr(
            "services.gemini_service.GeminiService.generate_image", _generate
        )

        def _match(self, system_prompt, user_prompt, job_id):
            return make_match_response({"1:1": "12.png", "2:1": "23.png"})

        monkeypatch.setattr(
            "services.openai_service.OpenAIService.match_angles_to_images", _match
        )

        event = _base_event(
            angles=[
                {
                    "angle_number": 1,
                    "angle_name": "Pain relief",
                    "visual_variations": [
                        {"variation_number": 1, "description": "Stretching"}
                    ],
                },
                {
                    "angle_number": 2,
                    "angle_name": "Active lifestyle",
                    "visual_variations": [
                        {"variation_number": 1, "description": "Walking"}
                    ],
                },
            ],
        )
        resp = lambda_handler(event, None)
        body = json.loads(resp["body"])
        assert body["count"] == 2


# ---------------------------------------------------------------------------
# Tests — Input Normalization
# ---------------------------------------------------------------------------

class TestInputNormalization:
    """Flat API-spec inputs (string avatar, string[] angles) are normalized."""

    def test_string_avatar_normalized(
        self,
        mock_gemini_generate,
        mock_cloudflare_upload,
        mock_download_image,
    ):
        from handler import lambda_handler

        event = _base_event(forced_ids=["12.png"])
        # Override avatar to a flat string (API-spec format)
        event["selectedAvatar"] = "Men 50-65, skeptical"
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 200

    def test_string_angles_normalized(
        self,
        mock_gemini_generate,
        mock_cloudflare_upload,
        mock_download_image,
    ):
        from handler import lambda_handler

        event = _base_event(forced_ids=["12.png"])
        # Override angles to flat string list (API-spec format)
        event["selectedAngles"] = ["Pain relief without pills", "Active lifestyle"]
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 200
        body = json.loads(resp["body"])
        # Two angles should each have 1 variation -> 2 results
        assert body["count"] == 2

    def test_product_url_list_normalized(
        self,
        mock_gemini_generate,
        mock_cloudflare_upload,
        mock_download_image,
    ):
        from handler import lambda_handler

        event = _base_event(forced_ids=["12.png"])
        # productImageUrls as list (API-spec format) — should be normalized to single string
        event["productImageUrls"] = ["https://example.com/product.png"]
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 200


# ---------------------------------------------------------------------------
# Tests — Partial Failure
# ---------------------------------------------------------------------------

class TestPartialFailure:
    """One generation fails; others should succeed."""

    def test_partial_failure_continues(
        self, mock_cloudflare_upload, mock_download_image, monkeypatch
    ):
        from handler import lambda_handler

        call_count = {"n": 0}

        def _generate(self, prompt, reference_image_bytes=None, product_image_bytes=None, job_id=None):
            call_count["n"] += 1
            if call_count["n"] == 1:
                raise RuntimeError("Gemini exploded")
            return make_tiny_png_b64()

        monkeypatch.setattr(
            "services.gemini_service.GeminiService.generate_image", _generate
        )

        event = _base_event(
            forced_ids=["12.png", "23.png"],
            angles=[
                {
                    "angle_number": 1,
                    "angle_name": "Fail me",
                    "visual_variations": [
                        {"variation_number": 1, "description": "Will fail"}
                    ],
                },
                {
                    "angle_number": 2,
                    "angle_name": "Succeed",
                    "visual_variations": [
                        {"variation_number": 1, "description": "Will succeed"}
                    ],
                },
            ],
        )
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 200
        body = json.loads(resp["body"])
        successes = [r for r in body["results"] if r["status"] == "success"]
        failures = [r for r in body["results"] if r["status"] == "failed"]
        assert len(successes) == 1
        assert len(failures) == 1


# ---------------------------------------------------------------------------
# Tests — Validation Errors
# ---------------------------------------------------------------------------

class TestValidation:
    """Missing required data should fail the pipeline."""

    def test_missing_avatar_raises(
        self, mock_gemini_generate, mock_cloudflare_upload, mock_download_image
    ):
        from handler import lambda_handler

        event = _base_event(forced_ids=["12.png"])
        event["selectedAvatar"] = {}
        event["selectedAngles"] = []
        resp = lambda_handler(event, None)

        # The orchestrator raises ValueError -> caught in handler -> 500
        assert resp["statusCode"] == 500

    def test_failed_status_on_error(
        self, mock_gemini_generate, mock_cloudflare_upload, mock_download_image
    ):
        from handler import lambda_handler

        job_id = "test-fail-validation"
        event = _base_event(job_id=job_id, forced_ids=["12.png"])
        event["selectedAvatar"] = {}
        event["selectedAngles"] = []
        lambda_handler(event, None)

        status = shared.get_job_status(job_id)
        assert status == "FAILED_IMAGE_GEN"


# ---------------------------------------------------------------------------
# Tests — Result Structure
# ---------------------------------------------------------------------------

class TestResultStructure:
    """Verify the structure of result items."""

    def test_result_contains_expected_fields(
        self,
        mock_gemini_generate,
        mock_cloudflare_upload,
        mock_download_image,
    ):
        from handler import lambda_handler

        event = _base_event(forced_ids=["12.png"])
        resp = lambda_handler(event, None)
        body = json.loads(resp["body"])

        result = body["results"][0]
        assert result["status"] == "success"
        assert "angle_number" in result
        assert "variation_number" in result
        assert "cloudflare_id" in result
        assert "cloudflare_url" in result
        assert result["cloudflare_url"].startswith("https://")
        assert "reference_image_id" in result


# ---------------------------------------------------------------------------
# Tests — PromptService Integration
# ---------------------------------------------------------------------------

class TestPromptServiceIntegration:
    """Verify prompts loaded from production PostgreSQL."""

    def test_prompt_service_loads_prompts(
        self, mock_gemini_generate, mock_cloudflare_upload, mock_download_image
    ):
        """PromptService should load real prompts from the DB."""
        from handler import lambda_handler

        event = _base_event(forced_ids=["12.png"])
        # If PromptService fails to load, the handler will error
        resp = lambda_handler(event, None)
        assert resp["statusCode"] == 200
