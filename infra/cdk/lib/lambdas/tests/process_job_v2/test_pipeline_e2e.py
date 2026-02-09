"""
E2E tests for the process_job_v2 Lambda handler.
"""

import json

import pytest

import conftest_shared as shared


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _base_event(
    job_id="test-job-v2",
    sales_page_url="https://example.com/product",
    project_name="Test Project",
    gender=None,
    location=None,
    dev_mode=False,
):
    """Build a minimal valid event dict for process_job_v2."""
    event = {
        "job_id": job_id,
        "sales_page_url": sales_page_url,
        "project_name": project_name,
    }
    if gender:
        event["gender"] = gender
    if location:
        event["location"] = location
    if dev_mode:
        event["dev_mode"] = "true"
    return event


# ---------------------------------------------------------------------------
# Tests — Happy Path (cache miss)
# ---------------------------------------------------------------------------

class TestHappyPath:
    """Full pipeline with all steps (no cache)."""

    def test_returns_200(self, mock_all_llm):
        from handler import lambda_handler

        event = _base_event()
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 200

    def test_body_contains_avatars_count(self, mock_all_llm):
        from handler import lambda_handler

        event = _base_event()
        resp = lambda_handler(event, None)

        body = resp["body"]
        if isinstance(body, str):
            body = json.loads(body)
        assert body["avatars_count"] >= 1

    def test_saves_results_to_s3(self, mock_all_llm):
        from handler import lambda_handler

        job_id = "test-s3-v2"
        event = _base_event(job_id=job_id)
        lambda_handler(event, None)

        key = f"results/{job_id}/comprehensive_results.json"
        data = shared.get_s3_json(key)
        assert "results" in data
        results = data["results"]
        assert "research_page_analysis" in results
        assert "deep_research_output" in results
        assert "marketing_avatars" in results

    def test_updates_ddb_status_succeeded(self, mock_all_llm):
        from handler import lambda_handler

        job_id = "test-ddb-v2"
        event = _base_event(job_id=job_id)
        lambda_handler(event, None)

        status = shared.get_job_status(job_id)
        assert status == "SUCCEEDED"

    def test_result_contains_offer_brief(self, mock_all_llm):
        from handler import lambda_handler

        job_id = "test-offer-brief"
        event = _base_event(job_id=job_id)
        lambda_handler(event, None)

        key = f"results/{job_id}/comprehensive_results.json"
        data = shared.get_s3_json(key)
        assert "offer_brief" in data["results"]

    def test_gender_and_location_passed(self, mock_all_llm):
        from handler import lambda_handler

        event = _base_event(gender="Female", location="US")
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 200


# ---------------------------------------------------------------------------
# Tests — Cache Hit
# ---------------------------------------------------------------------------

class TestCacheHit:
    """Pipeline with pre-cached research data should skip Steps 1-3."""

    def test_cache_hit_returns_200(
        self, mock_parse_structured, mock_template_prediction, _aws_env_and_moto
    ):
        """Pre-seed cache, skip Perplexity, still succeed."""
        import boto3
        import hashlib
        from handler import lambda_handler

        # Set up screenshot mock for capture_product_image_only
        mock_screenshot = _aws_env_and_moto["mock_screenshots"]
        mock_result = type("Obj", (), {
            "fullpage_bytes": b"\x89PNG" + b"\x00" * 100,
            "product_image_bytes": b"\x89PNG" + b"\x00" * 50,
        })()
        mock_screenshot.return_value = mock_result

        # Pre-seed research cache in S3
        s3 = boto3.client("s3", region_name=shared.AWS_REGION)
        sales_url = "https://example.com/cached-product"
        # Mimic the cache key generation
        from urllib.parse import urlparse
        parsed = urlparse(sales_url.lower().rstrip("/"))
        normalized = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
        cache_key = hashlib.sha256(normalized.encode()).hexdigest()

        cache_data = {
            "sales_page_url": sales_url,
            "research_page_analysis": "Cached analysis text",
            "deep_research_prompt": "Cached prompt",
            "deep_research_output": "Cached deep research output",
            "cached_at": "2025-01-01T00:00:00Z",
            "cache_version": "1.0",
        }
        s3.put_object(
            Bucket=shared.TEST_BUCKET,
            Key=f"cache/research/{cache_key}/research_cache.json",
            Body=json.dumps(cache_data),
            ContentType="application/json",
        )

        event = _base_event(
            job_id="test-cache-hit",
            sales_page_url=sales_url,
        )
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 200
        status = shared.get_job_status("test-cache-hit")
        assert status == "SUCCEEDED"


# ---------------------------------------------------------------------------
# Tests — Dev Mode
# ---------------------------------------------------------------------------

class TestDevMode:
    """Dev mode should load mock results from S3 and re-save."""

    def test_dev_mode_returns_200(self):
        """Dev mode should succeed even without LLM mocks."""
        import boto3
        from handler import lambda_handler

        # Seed mock dev data at the expected location
        s3 = boto3.client("s3", region_name=shared.AWS_REGION)
        mock_source_job_id = "82d4a4e7-2d67-4209-a82b-8c7c796b8100"
        s3.put_object(
            Bucket=shared.TEST_BUCKET,
            Key=f"results/{mock_source_job_id}/comprehensive_results.json",
            Body=json.dumps({"results": {"mock": True, "message": "Dev mode data"}}),
            ContentType="application/json",
        )

        job_id = "test-dev-mode-v2"
        event = _base_event(job_id=job_id, dev_mode=True)
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 200

    def test_dev_mode_saves_to_target_key(self):
        """Dev mode should save to the target job's S3 key."""
        import boto3
        from handler import lambda_handler

        s3 = boto3.client("s3", region_name=shared.AWS_REGION)
        mock_source_job_id = "82d4a4e7-2d67-4209-a82b-8c7c796b8100"
        s3.put_object(
            Bucket=shared.TEST_BUCKET,
            Key=f"results/{mock_source_job_id}/comprehensive_results.json",
            Body=json.dumps({"results": {"mock": True}}),
            ContentType="application/json",
        )

        job_id = "test-dev-s3-v2"
        event = _base_event(job_id=job_id, dev_mode=True)
        lambda_handler(event, None)

        key = f"results/{job_id}/comprehensive_results.json"
        data = shared.get_s3_json(key)
        assert data["results"]["mock"] is True

    def test_dev_mode_updates_status_succeeded(self):
        """Dev mode should mark job as SUCCEEDED."""
        import boto3
        from handler import lambda_handler

        s3 = boto3.client("s3", region_name=shared.AWS_REGION)
        mock_source_job_id = "82d4a4e7-2d67-4209-a82b-8c7c796b8100"
        s3.put_object(
            Bucket=shared.TEST_BUCKET,
            Key=f"results/{mock_source_job_id}/comprehensive_results.json",
            Body=json.dumps({"results": {"mock": True}}),
            ContentType="application/json",
        )

        job_id = "test-dev-status-v2"
        event = _base_event(job_id=job_id, dev_mode=True)
        lambda_handler(event, None)

        status = shared.get_job_status(job_id)
        assert status == "SUCCEEDED"


# ---------------------------------------------------------------------------
# Tests — Error Handling
# ---------------------------------------------------------------------------

class TestErrorHandling:
    """LLM failures should result in FAILED status and 500 response."""

    def test_analyze_page_failure_returns_500(
        self, mock_deep_research, mock_parse_structured, _aws_env_and_moto, monkeypatch,
    ):
        from handler import lambda_handler

        # Set up screenshot mock that raises an error
        _aws_env_and_moto["mock_screenshots"].side_effect = RuntimeError("Playwright crashed")

        job_id = "test-fail-analyze"
        event = _base_event(job_id=job_id)
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 500
        status = shared.get_job_status(job_id)
        assert status == "FAILED"

    def test_parse_structured_failure_returns_500(
        self, mock_analyze_page, mock_deep_research, _aws_env_and_moto, monkeypatch,
    ):
        from handler import lambda_handler

        def _parse_fail(self, prompt, response_format, subtask, model=None):
            raise RuntimeError("OpenAI API failed")

        monkeypatch.setattr(
            "services.openai_service.OpenAIService.parse_structured",
            _parse_fail,
        )

        job_id = "test-fail-parse"
        event = _base_event(job_id=job_id)
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 500
        status = shared.get_job_status(job_id)
        assert status == "FAILED"


# ---------------------------------------------------------------------------
# Tests — API Gateway Event Format
# ---------------------------------------------------------------------------

class TestAPIGatewayEvent:
    """Handler should handle API Gateway event format with body field."""

    def test_api_gateway_event_format(self, mock_all_llm):
        from handler import lambda_handler

        inner_event = _base_event(job_id="test-apigw")
        api_gw_event = {"body": json.dumps(inner_event)}
        resp = lambda_handler(api_gw_event, None)

        assert resp["statusCode"] == 200

    def test_invalid_json_body_returns_400(self):
        from handler import lambda_handler

        api_gw_event = {"body": "not valid json{{{"}
        resp = lambda_handler(api_gw_event, None)

        assert resp["statusCode"] == 400


# ---------------------------------------------------------------------------
# Tests — PromptService Integration
# ---------------------------------------------------------------------------

class TestPromptServiceIntegration:
    """Verify prompts loaded from production PostgreSQL."""

    def test_prompt_service_loads_prompts(self, mock_all_llm):
        """PromptService should load real prompts from the DB."""
        from handler import lambda_handler

        event = _base_event()
        # If PromptService fails to load, the handler will error
        resp = lambda_handler(event, None)
        assert resp["statusCode"] == 200
