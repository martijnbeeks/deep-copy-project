"""
Send test events to Klaviyo to auto-create the metrics needed for Flows.

Usage:
    python seed_klaviyo_metrics.py <klaviyo_api_key> <your_email>
"""

import json
import sys
from urllib.request import Request, urlopen
from urllib.error import HTTPError

KLAVIYO_EVENTS_URL = "https://a.klaviyo.com/api/events/"
KLAVIYO_API_REVISION = "2024-10-15"

METRICS = [
    {
        "name": "Deep Research Completed",
        "properties": {
            "project_name": "Test Project",
            "job_id": "test-deep-research-001",
            "results_url": "https://deepcopy.co/results/test-deep-research-001",
        },
    },
    {
        "name": "Swipe File Completed",
        "properties": {
            "job_id": "test-swipe-001",
            "results_url": "https://deepcopy.co/results/test-swipe-001",
        },
    },
    {
        "name": "Image Generation Completed",
        "properties": {
            "job_id": "test-image-gen-001",
        },
    },
    {
        "name": "Prelander Images Completed",
        "properties": {
            "job_id": "test-prelander-001",
        },
    },
]


def send_event(api_key: str, email: str, metric_name: str, properties: dict) -> bool:
    payload = {
        "data": {
            "type": "event",
            "attributes": {
                "metric": {"data": {"type": "metric", "attributes": {"name": metric_name}}},
                "profile": {"data": {"type": "profile", "attributes": {"email": email}}},
                "properties": properties,
            },
        }
    }

    req = Request(
        KLAVIYO_EVENTS_URL,
        data=json.dumps(payload).encode("utf-8"),
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Klaviyo-API-Key {api_key}",
            "revision": KLAVIYO_API_REVISION,
        },
    )

    try:
        with urlopen(req, timeout=10) as resp:
            print(f"  OK ({resp.status})")
            return True
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"  FAILED ({e.code}): {body}")
        return False


def main():
    if len(sys.argv) != 3:
        print(f"Usage: python {sys.argv[0]} <klaviyo_api_key> <your_email>")
        sys.exit(1)

    api_key = sys.argv[1]
    email = sys.argv[2]

    print(f"Sending test events to Klaviyo for: {email}\n")

    for metric in METRICS:
        print(f"  {metric['name']}...", end="")
        send_event(api_key, email, metric["name"], metric["properties"])

    print("\nDone! Check Klaviyo > Analytics > Metrics to see the new metrics.")
    print("You can now create Flows triggered by each metric.")


if __name__ == "__main__":
    main()
