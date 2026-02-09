"""
E2E tests for the write_swipe Lambda handler.
"""

import json

import conftest_shared as shared


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ORIGINAL_JOB_ID = "original-job-123"
AVATAR_ID = "test-avatar-id"
ANGLE_ID = "test-angle-id"


def _base_event(
    job_id="test-job-swipe",
    original_job_id=ORIGINAL_JOB_ID,
    avatar_id=AVATAR_ID,
    angle_id=ANGLE_ID,
    swipe_file_ids=None,
    image_style="realistic",
    dev_mode=False,
):
    """Build a minimal valid event dict for write_swipe."""
    event = {
        "job_id": job_id,
        "original_job_id": original_job_id,
        "avatar_id": avatar_id,
        "angle_id": angle_id,
        "swipe_file_ids": swipe_file_ids or ["AD0001_POV"],
        "image_style": image_style,
    }
    if dev_mode:
        event["dev_mode"] = True
    return event


# ---------------------------------------------------------------------------
# Tests — Happy Path
# ---------------------------------------------------------------------------

class TestHappyPath:
    """Full pipeline with pre-seeded data."""

    def test_returns_200(
        self, mock_anthropic_structured, mock_anthropic_streaming
    ):
        from handler import lambda_handler

        event = _base_event()
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 200

    def test_saves_results_to_s3(
        self, mock_anthropic_structured, mock_anthropic_streaming
    ):
        from handler import lambda_handler

        job_id = "test-s3-swipe"
        event = _base_event(job_id=job_id)
        lambda_handler(event, None)

        key = f"results/swipe_files/{job_id}/swipe_files_results.json"
        data = shared.get_s3_json(key)
        assert "AD0001_POV" in data
        assert "full_advertorial" in data["AD0001_POV"]

    def test_updates_ddb_status_succeeded(
        self, mock_anthropic_structured, mock_anthropic_streaming
    ):
        from handler import lambda_handler

        job_id = "test-ddb-swipe"
        event = _base_event(job_id=job_id)
        lambda_handler(event, None)

        status = shared.get_job_status(job_id)
        assert status == "SUCCEEDED"

    def test_result_includes_avatar_and_angle_ids(
        self, mock_anthropic_structured, mock_anthropic_streaming
    ):
        from handler import lambda_handler

        job_id = "test-ids-swipe"
        event = _base_event(job_id=job_id)
        lambda_handler(event, None)

        key = f"results/swipe_files/{job_id}/swipe_files_results.json"
        data = shared.get_s3_json(key)
        assert data["avatar_id"] == AVATAR_ID
        assert data["angle_id"] == ANGLE_ID


# ---------------------------------------------------------------------------
# Tests — Multiple Swipe File IDs
# ---------------------------------------------------------------------------

class TestMultipleSwipeFiles:
    """Pipeline with multiple swipe_file_ids."""

    def test_processes_multiple_templates(
        self, mock_anthropic_structured, mock_anthropic_streaming
    ):
        from handler import lambda_handler

        job_id = "test-multi-swipe"
        event = _base_event(
            job_id=job_id,
            swipe_file_ids=["AD0001_POV", "AD0001_AUTHORITY"],
        )
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 200
        key = f"results/swipe_files/{job_id}/swipe_files_results.json"
        data = shared.get_s3_json(key)
        # The last template processed should always be in results
        assert "AD0001_AUTHORITY" in data
        assert "full_advertorial" in data["AD0001_AUTHORITY"]


# ---------------------------------------------------------------------------
# Tests — Validation
# ---------------------------------------------------------------------------

class TestValidation:
    """Missing required params should return 500 with error message."""

    def test_missing_job_id_returns_500(self):
        from handler import lambda_handler

        event = _base_event()
        event["job_id"] = None
        resp = lambda_handler(event, None)
        assert resp["statusCode"] == 500
        assert "Missing required parameters" in resp["error"]

    def test_missing_avatar_id_returns_500(self):
        from handler import lambda_handler

        event = _base_event()
        event["avatar_id"] = None
        resp = lambda_handler(event, None)
        assert resp["statusCode"] == 500
        assert "Missing required parameters" in resp["error"]

    def test_missing_angle_id_returns_500(self):
        from handler import lambda_handler

        event = _base_event()
        event["angle_id"] = None
        resp = lambda_handler(event, None)
        assert resp["statusCode"] == 500
        assert "Missing required parameters" in resp["error"]


# ---------------------------------------------------------------------------
# Tests — Avatar/Angle Not Found
# ---------------------------------------------------------------------------

class TestAvatarAngleNotFound:
    """Non-existent avatar or angle in job results returns 500."""

    def test_unknown_avatar_returns_500(
        self, mock_anthropic_structured, mock_anthropic_streaming
    ):
        from handler import lambda_handler

        event = _base_event(avatar_id="nonexistent-avatar")
        resp = lambda_handler(event, None)
        assert resp["statusCode"] == 500
        assert "Avatar with ID" in resp["error"]

    def test_unknown_angle_returns_500(
        self, mock_anthropic_structured, mock_anthropic_streaming
    ):
        from handler import lambda_handler

        event = _base_event(angle_id="nonexistent-angle")
        resp = lambda_handler(event, None)
        assert resp["statusCode"] == 500
        assert "Marketing angle with ID" in resp["error"]

    def test_failed_status_on_avatar_error(
        self, mock_anthropic_structured, mock_anthropic_streaming
    ):
        from handler import lambda_handler

        job_id = "test-fail-avatar"
        event = _base_event(job_id=job_id, avatar_id="nonexistent-avatar")
        resp = lambda_handler(event, None)
        assert resp["statusCode"] == 500

        status = shared.get_job_status(job_id)
        assert status == "FAILED"


# ---------------------------------------------------------------------------
# Tests — Dev Mode
# ---------------------------------------------------------------------------

class TestDevMode:
    """Dev mode should load mock results from S3 and re-save."""

    def test_dev_mode_returns_200(self):
        """Dev mode should succeed even without Anthropic mocks."""
        import boto3
        from handler import lambda_handler

        # Seed mock dev data at the expected location
        s3 = boto3.client("s3", region_name=shared.AWS_REGION)
        mock_source_job_id = "47fdceed-c87a-4d4c-b41d-8eadb85d5f5d-swipe"
        s3.put_object(
            Bucket=shared.TEST_BUCKET,
            Key=f"results/swipe_files/{mock_source_job_id}/swipe_files_results.json",
            Body=json.dumps({"mock": True, "message": "Dev mode mock data"}),
            ContentType="application/json",
        )

        job_id = "test-dev-mode"
        event = _base_event(job_id=job_id, dev_mode=True)
        resp = lambda_handler(event, None)

        assert resp["statusCode"] == 200
        assert "DEV MODE" in resp.get("message", "")

    def test_dev_mode_saves_to_target_key(self):
        """Dev mode should save to the target job's S3 key."""
        import boto3
        from handler import lambda_handler

        s3 = boto3.client("s3", region_name=shared.AWS_REGION)
        mock_source_job_id = "47fdceed-c87a-4d4c-b41d-8eadb85d5f5d-swipe"
        s3.put_object(
            Bucket=shared.TEST_BUCKET,
            Key=f"results/swipe_files/{mock_source_job_id}/swipe_files_results.json",
            Body=json.dumps({"mock": True}),
            ContentType="application/json",
        )

        job_id = "test-dev-s3"
        event = _base_event(job_id=job_id, dev_mode=True)
        lambda_handler(event, None)

        key = f"results/swipe_files/{job_id}/swipe_files_results.json"
        data = shared.get_s3_json(key)
        assert data["mock"] is True


# ---------------------------------------------------------------------------
# Tests — PromptService Integration
# ---------------------------------------------------------------------------

class TestPromptServiceIntegration:
    """Verify prompts loaded from production PostgreSQL."""

    def test_prompt_service_loads_prompts(
        self, mock_anthropic_structured, mock_anthropic_streaming
    ):
        from handler import lambda_handler

        event = _base_event()
        # If PromptService fails, the handler will error
        resp = lambda_handler(event, None)
        assert resp["statusCode"] == 200
