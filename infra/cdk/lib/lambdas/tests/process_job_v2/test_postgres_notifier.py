"""
Unit tests for PostgresNotifier service.

Tests the PostgreSQL notification and webhook callback functionality
that syncs job status to the frontend database.
"""

import json
from unittest.mock import MagicMock, patch, call

import pytest


# ---------------------------------------------------------------------------
# PostgresNotifier unit tests (mock pg8000)
# ---------------------------------------------------------------------------

class TestPostgresNotifier:
    """Test PostgresNotifier with mocked pg8000 connections."""

    def _make_notifier(self):
        """Create a PostgresNotifier instance with a test database URL."""
        from services.postgres_notifier import PostgresNotifier
        return PostgresNotifier("postgresql://user:pass@localhost:5432/testdb")

    def test_parse_database_url_basic(self):
        """Verify URL parsing extracts correct connection params."""
        from services.postgres_notifier import _parse_database_url

        params = _parse_database_url("postgresql://myuser:mypass@dbhost:5433/mydb")
        assert params["user"] == "myuser"
        assert params["password"] == "mypass"
        assert params["host"] == "dbhost"
        assert params["port"] == 5433
        assert params["database"] == "mydb"
        assert "ssl_context" not in params

    def test_parse_database_url_with_ssl(self):
        """Verify SSL context is created when sslmode=require."""
        from services.postgres_notifier import _parse_database_url

        params = _parse_database_url(
            "postgresql://user:pass@host:5432/db?sslmode=require"
        )
        assert "ssl_context" in params
        assert params["ssl_context"] is not None

    def test_parse_database_url_ssl_disable(self):
        """sslmode=disable should not create an SSL context."""
        from services.postgres_notifier import _parse_database_url

        params = _parse_database_url(
            "postgresql://user:pass@host:5432/db?sslmode=disable"
        )
        assert "ssl_context" not in params

    @patch("services.postgres_notifier.pg8000.native.Connection")
    def test_update_job_status(self, mock_conn_cls):
        """update_job_status should execute an UPDATE query."""
        mock_conn = MagicMock()
        mock_conn_cls.return_value = mock_conn

        notifier = self._make_notifier()
        notifier.update_job_status("job-123", "completed", 100)

        mock_conn.run.assert_called_once()
        call_args = mock_conn.run.call_args
        assert "UPDATE jobs SET status" in call_args[0][0]
        assert call_args[1]["status"] == "completed"
        assert call_args[1]["progress"] == 100
        assert call_args[1]["job_id"] == "job-123"
        mock_conn.close.assert_called_once()

    @patch("services.postgres_notifier.pg8000.native.Connection")
    def test_notify_completed(self, mock_conn_cls):
        """notify_completed should set status=completed, progress=100."""
        mock_conn = MagicMock()
        mock_conn_cls.return_value = mock_conn

        notifier = self._make_notifier()
        notifier.notify_completed("job-456")

        call_args = mock_conn.run.call_args
        assert call_args[1]["status"] == "completed"
        assert call_args[1]["progress"] == 100

    @patch("services.postgres_notifier.pg8000.native.Connection")
    def test_notify_failed(self, mock_conn_cls):
        """notify_failed should set status=failed, progress=0."""
        mock_conn = MagicMock()
        mock_conn_cls.return_value = mock_conn

        notifier = self._make_notifier()
        notifier.notify_failed("job-789")

        call_args = mock_conn.run.call_args
        assert call_args[1]["status"] == "failed"
        assert call_args[1]["progress"] == 0

    @patch("services.postgres_notifier.pg8000.native.Connection")
    def test_notify_running(self, mock_conn_cls):
        """notify_running should set status=processing, progress=50."""
        mock_conn = MagicMock()
        mock_conn_cls.return_value = mock_conn

        notifier = self._make_notifier()
        notifier.notify_running("job-abc")

        call_args = mock_conn.run.call_args
        assert call_args[1]["status"] == "processing"
        assert call_args[1]["progress"] == 50

    @patch("services.postgres_notifier.pg8000.native.Connection")
    def test_update_job_status_connection_failure_is_nonfatal(self, mock_conn_cls):
        """Connection failures should log a warning, not raise."""
        mock_conn_cls.side_effect = Exception("Connection refused")

        notifier = self._make_notifier()
        # Should NOT raise
        notifier.update_job_status("job-fail", "completed", 100)

    @patch("services.postgres_notifier.pg8000.native.Connection")
    def test_update_job_status_query_failure_is_nonfatal(self, mock_conn_cls):
        """Query failures should log a warning, not raise."""
        mock_conn = MagicMock()
        mock_conn_cls.return_value = mock_conn
        mock_conn.run.side_effect = Exception("constraint violation")

        notifier = self._make_notifier()
        # Should NOT raise
        notifier.update_job_status("job-fail-query", "completed", 100)
        mock_conn.close.assert_called_once()

    @patch("services.postgres_notifier.pg8000.native.Connection")
    def test_connection_reusable_after_ssl(self, mock_conn_cls):
        """After _connect(), ssl_context should be restored in conn_params."""
        mock_conn = MagicMock()
        mock_conn_cls.return_value = mock_conn

        from services.postgres_notifier import PostgresNotifier

        notifier = PostgresNotifier(
            "postgresql://user:pass@host:5432/db?sslmode=require"
        )
        assert "ssl_context" in notifier._conn_params

        notifier.update_job_status("job-1", "completed", 100)
        # After the call, ssl_context should still be in conn_params
        assert "ssl_context" in notifier._conn_params

        notifier.update_job_status("job-2", "failed", 0)
        # Second call should also work
        assert mock_conn.run.call_count == 2


class TestSendCallback:
    """Test the webhook callback functionality."""

    def _make_notifier(self):
        from services.postgres_notifier import PostgresNotifier
        return PostgresNotifier("postgresql://user:pass@localhost:5432/testdb")

    @patch("urllib.request.urlopen")
    def test_send_callback_success(self, mock_urlopen):
        """Successful callback should log info."""
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.__enter__ = MagicMock(return_value=mock_resp)
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_resp

        notifier = self._make_notifier()
        notifier.send_callback(
            "https://app.example.com/api/webhooks/job-complete",
            "job-123",
            "completed",
            "test-secret",
        )

        mock_urlopen.assert_called_once()
        req = mock_urlopen.call_args[0][0]
        assert req.full_url == "https://app.example.com/api/webhooks/job-complete"
        assert req.method == "POST"
        # urllib normalizes headers to "X-webhook-signature" (capitalize first letter only)
        assert "X-webhook-signature" in req.headers

        # Verify payload
        payload = json.loads(req.data.decode("utf-8"))
        assert payload["jobId"] == "job-123"
        assert payload["status"] == "completed"

    @patch("urllib.request.urlopen")
    def test_send_callback_hmac_signature(self, mock_urlopen):
        """Verify the HMAC-SHA256 signature is computed correctly."""
        import hashlib
        import hmac

        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.__enter__ = MagicMock(return_value=mock_resp)
        mock_resp.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_resp

        notifier = self._make_notifier()
        secret = "my-webhook-secret"
        notifier.send_callback(
            "https://example.com/api/webhooks/job-complete", "job-456", "failed", secret,
        )

        req = mock_urlopen.call_args[0][0]
        actual_sig = req.headers["X-webhook-signature"]

        # Recompute expected signature
        payload = json.dumps({"jobId": "job-456", "status": "failed"}).encode("utf-8")
        expected_sig = hmac.new(
            secret.encode("utf-8"), payload, hashlib.sha256
        ).hexdigest()

        assert actual_sig == expected_sig

    @patch("urllib.request.urlopen")
    def test_send_callback_failure_is_nonfatal(self, mock_urlopen):
        """Network failures should log a warning, not raise."""
        mock_urlopen.side_effect = Exception("Connection timed out")

        notifier = self._make_notifier()
        # Should NOT raise
        notifier.send_callback(
            "https://example.com/api/webhooks/job-complete", "job-789", "completed", "secret",
        )

    @patch("urllib.request.urlopen")
    def test_send_callback_rejects_invalid_path(self, mock_urlopen):
        """Callback URLs with wrong path should be silently rejected."""
        notifier = self._make_notifier()
        notifier.send_callback(
            "https://evil.com/steal-data", "job-ssrf", "completed", "secret",
        )
        mock_urlopen.assert_not_called()

    @patch("urllib.request.urlopen")
    def test_send_callback_rejects_http(self, mock_urlopen):
        """Callback URLs without HTTPS should be rejected."""
        notifier = self._make_notifier()
        notifier.send_callback(
            "http://example.com/api/webhooks/job-complete", "job-http", "completed", "secret",
        )
        mock_urlopen.assert_not_called()


# ---------------------------------------------------------------------------
# PipelineConfig + create_config_from_event tests
# ---------------------------------------------------------------------------

class TestPipelineConfigCallbackUrl:
    """Test that callback_url flows through PipelineConfig."""

    def test_config_has_callback_url_field(self):
        """PipelineConfig should accept callback_url."""
        from pipeline.orchestrator import PipelineConfig

        config = PipelineConfig(
            sales_page_url="https://example.com",
            s3_bucket="my-bucket",
            project_name="test",
            job_id="job-1",
            callback_url="https://app.example.com/api/webhooks/job-complete",
        )
        assert config.callback_url == "https://app.example.com/api/webhooks/job-complete"

    def test_config_callback_url_defaults_to_none(self):
        """callback_url should default to None."""
        from pipeline.orchestrator import PipelineConfig

        config = PipelineConfig(
            sales_page_url="https://example.com",
            s3_bucket="my-bucket",
            project_name="test",
            job_id="job-1",
        )
        assert config.callback_url is None

    def test_create_config_from_event_with_callback(self):
        """create_config_from_event should extract callback_url."""
        from pipeline.orchestrator import create_config_from_event

        event = {
            "sales_page_url": "https://example.com",
            "project_name": "test",
            "job_id": "job-1",
            "callback_url": "https://app.example.com/webhook",
        }
        config = create_config_from_event(event, "default-bucket")
        assert config.callback_url == "https://app.example.com/webhook"

    def test_create_config_from_event_without_callback(self):
        """create_config_from_event should set None when no callback_url."""
        from pipeline.orchestrator import create_config_from_event

        event = {
            "sales_page_url": "https://example.com",
            "project_name": "test",
            "job_id": "job-1",
        }
        config = create_config_from_event(event, "default-bucket")
        assert config.callback_url is None
