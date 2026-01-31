"""
Lightweight LLM usage event emitter (S3 JSONL).

Design goals:
- Best-effort: never raise on emission failures
- No prompt/response content is written
- One S3 object per event (single JSON line) to avoid S3 append complexity
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import boto3

logger = logging.getLogger(__name__)


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def _safe_int(x: Any) -> Optional[int]:
    try:
        if x is None:
            return None
        return int(x)
    except Exception:
        return None


def _get_attr(obj: Any, name: str) -> Any:
    if obj is None:
        return None
    if isinstance(obj, dict):
        return obj.get(name)
    return getattr(obj, name, None)


def normalize_gemini_usage(response: Any) -> Dict[str, Optional[int]]:
    meta = _get_attr(response, "usage_metadata") or _get_attr(response, "usageMetadata")
    if meta is None:
        return {"inputTokens": None, "outputTokens": None}

    prompt = _get_attr(meta, "prompt_token_count") or _get_attr(meta, "promptTokenCount")
    cand = _get_attr(meta, "candidates_token_count") or _get_attr(meta, "candidatesTokenCount")
    return {"inputTokens": _safe_int(prompt), "outputTokens": _safe_int(cand)}


@dataclass(frozen=True)
class UsageContext:
    endpoint: str
    job_id: Optional[str]
    job_type: str
    api_version: Optional[str] = None
    project_name: Optional[str] = None


def emit_llm_usage_event(
    *,
    ctx: UsageContext,
    provider: str,
    model: Optional[str],
    operation: str,
    subtask: str,
    latency_ms: Optional[int],
    success: bool,
    retry_attempt: int = 1,
    aws_request_id: Optional[str] = None,
    http_status: Optional[int] = None,
    error_type: Optional[str] = None,
    usage: Optional[Dict[str, Optional[int]]] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> None:
    try:
        bucket = (os.environ.get("RESULTS_BUCKET") or "").strip()
        if not bucket:
            return
        prefix = (os.environ.get("LLM_USAGE_EVENTS_PREFIX") or "llm_usage_events").strip().strip("/")

        now = _now_utc()
        dt = now.strftime("%Y-%m-%d")
        hour = now.strftime("%H")
        event_id = str(uuid.uuid4())

        event: Dict[str, Any] = {
            "eventVersion": 1,
            "eventId": event_id,
            "timestamp": _iso(now),
            "awsRequestId": aws_request_id,
            "endpoint": ctx.endpoint,
            "jobId": ctx.job_id,
            "jobType": ctx.job_type,
            "apiVersion": ctx.api_version,
            "projectName": ctx.project_name,
            "subtask": subtask,
            "provider": provider,
            "model": model,
            "operation": operation,
            "latencyMs": latency_ms,
            "success": bool(success),
            "retryAttempt": int(retry_attempt),
            "httpStatus": http_status,
            "errorType": error_type,
        }
        if usage:
            event.update(usage)
        if extra:
            event["extra"] = extra

        job_part = ctx.job_id or "no_job"
        key = f"{prefix}/dt={dt}/hour={hour}/jobId={job_part}/{event_id}.jsonl"
        body = (json.dumps(event, ensure_ascii=False) + "\n").encode("utf-8")

        boto3.client("s3").put_object(
            Bucket=bucket,
            Key=key,
            Body=body,
            ContentType="application/x-ndjson",
        )
    except Exception as e:
        try:
            logger.debug("Failed to emit LLM usage event: %s", e)
        except Exception:
            pass

