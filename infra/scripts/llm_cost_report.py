#!/usr/bin/env python3
"""
Compute cost per run/endpoints/subtasks from S3 JSONL LLM usage events.

Assumptions:
- Each S3 object is a single JSON line (as written by llm_usage.py)
- Costs are derived from pricing/llm_pricing.v1.json (versioned, in-repo)
"""

from __future__ import annotations

import argparse
import csv
import json
import os
from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any, Dict, Iterable, List, Optional, Tuple

import boto3


def _parse_date(s: str) -> date:
    return datetime.strptime(s, "%Y-%m-%d").date()


def _daterange(start: date, end: date) -> Iterable[date]:
    cur = start
    while cur <= end:
        yield cur
        cur = cur + timedelta(days=1)


@dataclass(frozen=True)
class RateKey:
    provider: str
    model: str
    unit: str


def load_pricing(path: str) -> Dict[RateKey, float]:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    rates = {}
    for r in data.get("rates", []):
        key = RateKey(
            provider=str(r["provider"]),
            model=str(r["model"]),
            unit=str(r["unit"]),
        )
        rates[key] = float(r["usd"])
    return rates


def rate_get(rates: Dict[RateKey, float], provider: str, model: str, unit: str) -> Optional[float]:
    return rates.get(RateKey(provider=provider, model=model, unit=unit))


def compute_event_cost_usd(event: Dict[str, Any], rates: Dict[RateKey, float], strict: bool) -> float:
    provider = str(event.get("provider") or "")
    model = str(event.get("model") or "")
    if not provider or not model:
        return 0.0

    def req(unit: str) -> float:
        v = rate_get(rates, provider, model, unit)
        if v is None:
            if strict:
                raise KeyError(f"Missing rate for provider={provider} model={model} unit={unit}")
            return 0.0
        return v

    input_tokens = int(event.get("inputTokens") or 0)
    output_tokens = int(event.get("outputTokens") or 0)
    cache_read = int(event.get("cacheReadInputTokens") or 0)
    cache_creation = int(event.get("cacheCreationInputTokens") or 0)
    images = int(event.get("imagesGenerated") or 0)
    citation_tokens = int(event.get("citationTokens") or 0)
    search_queries = int(event.get("searchQueries") or 0)
    reasoning_tokens = int(event.get("reasoningTokens") or 0)

    cost = 0.0
    # Token costs are per 1M tokens
    if input_tokens:
        cost += (input_tokens / 1_000_000.0) * req("input_token_1m")
    if output_tokens:
        cost += (output_tokens / 1_000_000.0) * req("output_token_1m")
    if cache_read:
        cost += (cache_read / 1_000_000.0) * req("cache_read_input_token_1m")
    if cache_creation:
        cost += (cache_creation / 1_000_000.0) * req("cache_creation_input_token_1m")
    if images:
        cost += images * req("image_generation")
    if citation_tokens:
        cost += (citation_tokens / 1_000_000.0) * req("citation_token_1m")
    if search_queries:
        cost += (search_queries / 1000.0) * req("search_query_1k")
    if reasoning_tokens:
        cost += (reasoning_tokens / 1_000_000.0) * req("reasoning_token_1m")
    return cost


def iter_events_from_s3(bucket: str, prefix: str, start_dt: date, end_dt: date) -> Iterable[Dict[str, Any]]:
    s3 = boto3.client("s3")
    for d in _daterange(start_dt, end_dt):
        # scan all hours (00..23)
        dt_prefix = f"{prefix.strip().strip('/')}/dt={d.strftime('%Y-%m-%d')}/"
        paginator = s3.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=bucket, Prefix=dt_prefix):
            for obj in page.get("Contents", []) or []:
                key = obj["Key"]
                body = s3.get_object(Bucket=bucket, Key=key)["Body"].read().decode("utf-8")
                for line in body.splitlines():
                    line = line.strip()
                    if not line:
                        continue
                    yield json.loads(line)


def write_csv(rows: List[Dict[str, Any]], path: str) -> None:
    if not rows:
        with open(path, "w", newline="", encoding="utf-8") as f:
            f.write("")
        return
    fieldnames = sorted({k for r in rows for k in r.keys()})
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(rows)


def main() -> int:
    start_llm_cost_collection = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    today_str = date.today().strftime("%Y-%m-%d")
    default_bucket = "deepcopystack-resultsbucketa95a2103-zhwjflrlpfih"

    ap = argparse.ArgumentParser()
    ap.add_argument("--bucket", default=default_bucket, help=f"S3 bucket containing usage events (default: {default_bucket})")
    ap.add_argument("--prefix", default="llm_usage_events", help="S3 prefix for JSONL events (default: llm_usage_events)")
    ap.add_argument("--start-date", default=today_str, help=f"YYYY-MM-DD (inclusive, default: {start_llm_cost_collection})")
    ap.add_argument("--end-date", default=today_str, help=f"YYYY-MM-DD (inclusive, default: {today_str})")
    ap.add_argument("--pricing", default="pricing/llm_pricing.v1.json", help="Path to pricing config")
    ap.add_argument("--strict", action="store_true", help="Fail if a model rate is missing")
    ap.add_argument("--job-id", default=None, help="Optional filter by jobId")
    ap.add_argument("--out-json", default="llm_cost_report.json", help="Output JSON path")
    ap.add_argument("--out-csv", default="llm_cost_report.csv", help="Output CSV path")
    args = ap.parse_args()

    rates = load_pricing(args.pricing)
    start_dt = _parse_date(args.start_date)
    end_dt = _parse_date(args.end_date)

    def _new_stats():
        return {
            "costUsd": 0.0,
            "callCount": 0,
            "inputTokens": 0,
            "outputTokens": 0,
            "cacheReadInputTokens": 0,
            "cacheCreationInputTokens": 0,
            "imagesGenerated": 0,
            "citationTokens": 0,
            "searchQueries": 0,
            "reasoningTokens": 0,
        }

    per_job = defaultdict(_new_stats)
    per_endpoint = defaultdict(_new_stats)
    per_subtask = defaultdict(_new_stats)
    per_provider_model = defaultdict(_new_stats)

    rows: List[Dict[str, Any]] = []

    for ev in iter_events_from_s3(args.bucket, args.prefix, start_dt, end_dt):
        if args.job_id and str(ev.get("jobId")) != args.job_id:
            continue

        cost = compute_event_cost_usd(ev, rates, strict=args.strict)
        job_id = str(ev.get("jobId") or "no_job")
        endpoint = str(ev.get("endpoint") or "unknown")
        subtask = str(ev.get("subtask") or "unknown")
        provider = str(ev.get("provider") or "unknown")
        model = str(ev.get("model") or "unknown")

        input_tokens = int(ev.get("inputTokens") or 0)
        output_tokens = int(ev.get("outputTokens") or 0)
        cache_read = int(ev.get("cacheReadInputTokens") or 0)
        cache_creation = int(ev.get("cacheCreationInputTokens") or 0)
        images = int(ev.get("imagesGenerated") or 0)
        citations = int(ev.get("citationTokens") or 0)
        searches = int(ev.get("searchQueries") or 0)
        reasoning = int(ev.get("reasoningTokens") or 0)

        for stats in [
            per_job[job_id],
            per_endpoint[endpoint],
            per_subtask[subtask],
            per_provider_model[f"{provider}:{model}"],
        ]:
            stats["costUsd"] += cost
            stats["callCount"] += 1
            stats["inputTokens"] += input_tokens
            stats["outputTokens"] += output_tokens
            stats["cacheReadInputTokens"] += cache_read
            stats["cacheCreationInputTokens"] += cache_creation
            stats["imagesGenerated"] += images
            stats["citationTokens"] += citations
            stats["searchQueries"] += searches
            stats["reasoningTokens"] += reasoning

        rows.append(
            {
                "timestamp": ev.get("timestamp"),
                "jobId": ev.get("jobId"),
                "endpoint": ev.get("endpoint"),
                "projectName": ev.get("projectName"),
                "subtask": ev.get("subtask"),
                "provider": provider,
                "model": model,
                "operation": ev.get("operation"),
                "success": ev.get("success"),
                "retryAttempt": ev.get("retryAttempt"),
                "inputTokens": input_tokens,
                "outputTokens": output_tokens,
                "cacheReadInputTokens": cache_read,
                "cacheCreationInputTokens": cache_creation,
                "imagesGenerated": images,
                "citationTokens": citations,
                "searchQueries": searches,
                "reasoningTokens": reasoning,
                "latencyMs": ev.get("latencyMs"),
                "costUsd": round(cost, 10),
            }
        )

    def _finalize_stats(stats_dict: Dict[str, Any]) -> Dict[str, Any]:
        # Sort by costUsd descending
        sorted_items = sorted(stats_dict.items(), key=lambda x: -x[1]["costUsd"])
        final = {}
        for key, stats in sorted_items:
            s = stats.copy()
            s["costUsd"] = round(s["costUsd"], 10)
            s["avgCostUsd"] = round(s["costUsd"] / s["callCount"], 10) if s["callCount"] > 0 else 0.0
            final[key] = s
        return final

    report = {
        "startDate": args.start_date,
        "endDate": args.end_date,
        "bucket": args.bucket,
        "prefix": args.prefix,
        "pricing": args.pricing,
        "strict": bool(args.strict),
        "filters": {"jobId": args.job_id},
        "totals": {
            "perJobId": _finalize_stats(per_job),
            "perEndpoint": _finalize_stats(per_endpoint),
            "perSubtask": _finalize_stats(per_subtask),
            "perProviderModel": _finalize_stats(per_provider_model),
            "grandTotalUsd": round(sum(s["costUsd"] for s in per_job.values()), 10),
        },
        "events": rows,
    }

    with open(args.out_json, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    write_csv(rows, args.out_csv)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())


