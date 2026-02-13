"""
Klaviyo Events API client for email notifications.

Tracks events in Klaviyo which trigger Flows that send notification
emails. This avoids needing the Klaviyo Transactional Email add-on.
"""

import json
import logging
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

logger = logging.getLogger(__name__)

KLAVIYO_EVENTS_URL = "https://a.klaviyo.com/api/events/"
KLAVIYO_API_REVISION = "2024-10-15"
RESULTS_BASE_URL = "https://deepcopy.co/results"


class KlaviyoEmailService:
    def __init__(self, api_key: str):
        self.api_key = api_key

    def track_event(
        self,
        to_email: str,
        metric_name: str,
        properties: dict,
    ) -> bool:
        """
        Track an event in Klaviyo for the given email address.
        A Klaviyo Flow listens for this metric and sends the
        notification email automatically.

        Returns True on success, False on failure. Never raises.
        """
        try:
            payload = {
                "data": {
                    "type": "event",
                    "attributes": {
                        "metric": {"data": {"type": "metric", "attributes": {"name": metric_name}}},
                        "profile": {"data": {"type": "profile", "attributes": {"email": to_email}}},
                        "properties": properties,
                    },
                }
            }

            data = json.dumps(payload).encode("utf-8")
            req = Request(
                KLAVIYO_EVENTS_URL,
                data=data,
                method="POST",
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Klaviyo-API-Key {self.api_key}",
                    "revision": KLAVIYO_API_REVISION,
                },
            )

            with urlopen(req, timeout=10) as resp:
                logger.info(
                    "Klaviyo event '%s' tracked for %s (status %s)",
                    metric_name,
                    to_email,
                    resp.status,
                )
                return True

        except HTTPError as e:
            body = ""
            try:
                body = e.read().decode("utf-8", errors="replace")
            except Exception:
                pass
            logger.error("Klaviyo API HTTP error %s: %s", e.code, body)
            return False
        except URLError as e:
            logger.error("Klaviyo API URL error: %s", e.reason)
            return False
        except Exception as e:
            logger.error("Klaviyo notification failed: %s", e)
            return False

    def send_job_completed_email(
        self, to_email: str, project_name: str, job_id: str
    ) -> bool:
        """Track a 'Deep Research Completed' event."""
        return self.track_event(to_email, "Deep Research Completed", {
            "project_name": project_name,
            "job_id": job_id,
            "results_url": f"{RESULTS_BASE_URL}/{job_id}",
        })

    def send_swipe_completed_email(
        self, to_email: str, job_id: str
    ) -> bool:
        """Track a 'Swipe File Completed' event."""
        return self.track_event(to_email, "Swipe File Completed", {
            "job_id": job_id,
            "results_url": f"{RESULTS_BASE_URL}/{job_id.replace('-swipe', '')}",
        })

    def send_image_gen_completed_email(
        self, to_email: str, job_id: str
    ) -> bool:
        """Track an 'Image Generation Completed' event."""
        return self.track_event(to_email, "Image Generation Completed", {
            "job_id": job_id,
        })

    def send_prelander_images_completed_email(
        self, to_email: str, job_id: str
    ) -> bool:
        """Track a 'Prelander Images Completed' event."""
        return self.track_event(to_email, "Prelander Images Completed", {
            "job_id": job_id,
        })
