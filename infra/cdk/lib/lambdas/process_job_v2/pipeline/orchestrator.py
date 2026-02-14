"""
Pipeline orchestrator for process_job_v2 Lambda.

Coordinates the execution of all pipeline steps and manages
parallel processing of avatars.
"""

import json
import logging
import os
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

from llm_usage import UsageContext
from services.aws import AWSServices
from services.openai_service import OpenAIService
from services.perplexity_service import PerplexityService
from services.cache import ResearchCacheService
from pipeline.steps.analyze_page import AnalyzePageStep
from pipeline.steps.deep_research import DeepResearchStep
from pipeline.steps.avatars import AvatarStep
from pipeline.steps.marketing import MarketingStep
from pipeline.steps.offer_brief import OfferBriefStep
from pipeline.steps.template_prediction import TemplatePredictionStep
from services.template_prediction_service import LibrarySummariesCache
from services.prompt_service import PromptService
from services.cloudflare_service import CloudflareService
from services.klaviyo_service import KlaviyoEmailService
from services.postgres_notifier import PostgresNotifier


logger = logging.getLogger(__name__)

DEV_MODE_SOURCE_JOB_ID = "70c7ec82-0abb-4126-a32f-7f376103f00a"


@dataclass
class PipelineConfig:
    """Configuration for pipeline execution."""
    sales_page_url: str
    s3_bucket: str
    project_name: str
    job_id: str
    gender: Optional[str] = None
    location: Optional[str] = None
    research_requirements: Optional[str] = None
    target_product_name: Optional[str] = None
    notification_email: Optional[str] = None
    callback_url: Optional[str] = None
    dev_mode: bool = False
    api_version: str = "v2"


@dataclass
class PipelineResult:
    """Result of pipeline execution."""
    success: bool
    status_code: int
    body: Dict[str, Any]


class PipelineOrchestrator:
    """
    Orchestrates the full pipeline execution.
    
    Manages service initialization, step execution, parallel processing,
    and result aggregation.
    """
    
    def __init__(self, aws_request_id: Optional[str] = None):
        """
        Initialize the pipeline orchestrator.
        
        Args:
            aws_request_id: AWS Lambda request ID for telemetry.
        """
        self.aws_request_id = aws_request_id
        
        # Initialize AWS services
        self.aws_services = AWSServices()
        
        # Initialize LLM services
        self.openai_service = OpenAIService(
            api_key=self.aws_services.secrets["OPENAI_API_KEY"],
            aws_request_id=aws_request_id
        )
        self.perplexity_service = PerplexityService(
            api_key=self.aws_services.secrets["PERPLEXITY_API_KEY"],
            aws_request_id=aws_request_id
        )
        
        # Initialize cache service
        self.cache_service = ResearchCacheService(
            s3_client=self.aws_services.s3_client,
            s3_bucket=self.aws_services.s3_bucket
        )
        
        # Initialize prompt service (DATABASE_URL is required)
        db_url = self.aws_services.secrets.get("DATABASE_URL")
        if not db_url:
            raise RuntimeError("DATABASE_URL not found in secrets. Cannot load prompts from DB.")
        self.prompt_service = PromptService(db_url, "process_job_v2")

        # Initialize PostgreSQL notifier (uses same DATABASE_URL)
        self.postgres_notifier = PostgresNotifier(db_url)
        self._webhook_secret = self.aws_services.secrets.get("WEBHOOK_SECRET", "")

        # Initialize pipeline steps
        self.analyze_page_step = AnalyzePageStep(self.openai_service, prompt_service=self.prompt_service)
        self.deep_research_step = DeepResearchStep(self.perplexity_service, prompt_service=self.prompt_service)
        self.avatar_step = AvatarStep(self.openai_service, prompt_service=self.prompt_service)
        self.marketing_step = MarketingStep(self.openai_service, prompt_service=self.prompt_service)
        self.offer_brief_step = OfferBriefStep(self.openai_service, prompt_service=self.prompt_service)

        # Initialize template prediction step
        self.library_cache = LibrarySummariesCache(
            s3_client=self.aws_services.s3_client,
            s3_bucket=self.aws_services.s3_bucket
        )
        self.template_prediction_step = TemplatePredictionStep(
            openai_service=self.openai_service,
            library_cache=self.library_cache,
            prompt_service=self.prompt_service
        )

        # Initialize Cloudflare service (non-fatal if creds missing)
        self.cloudflare_service = None
        try:
            cf_token = self.aws_services.secrets.get("CLOUDFLARE_API_TOKEN", "").strip()
            cf_account = self.aws_services.secrets.get("CLOUDFLARE_ACCOUNT_ID", "").strip()
            if cf_token and cf_account:
                self.cloudflare_service = CloudflareService(cf_token, cf_account)
            else:
                logger.warning("Cloudflare credentials missing; product_image will remain base64")
        except Exception as e:
            logger.warning("Failed to initialize CloudflareService: %s", e)

        # Initialize Klaviyo service (non-fatal if key missing)
        self.klaviyo_service = None
        try:
            klaviyo_key = self.aws_services.secrets.get("KLAVIYO_API_KEY", "").strip()
            if klaviyo_key:
                self.klaviyo_service = KlaviyoEmailService(klaviyo_key)
            else:
                logger.warning("KLAVIYO_API_KEY missing; email notifications disabled")
        except Exception as e:
            logger.warning("Failed to initialize KlaviyoEmailService: %s", e)
    
    def _set_usage_context(self, config: PipelineConfig) -> None:
        """
        Set the usage context for telemetry on all services.
        
        Args:
            config: Pipeline configuration.
        """
        usage_ctx = UsageContext(
            endpoint="POST /v2/jobs",
            job_id=config.job_id,
            job_type="V2_JOB",
            api_version=config.api_version,
            project_name=config.project_name,
        )
        
        self.openai_service.set_usage_context(usage_ctx, self.aws_request_id)
        self.perplexity_service.set_usage_context(usage_ctx, self.aws_request_id)
    
    def _handle_dev_mode(self, config: PipelineConfig) -> PipelineResult:
        """
        Handle dev mode execution with mock results.
        
        Args:
            config: Pipeline configuration.
            
        Returns:
            PipelineResult with mock data.
        """
        logger.info(f"Dev mode detected for job {config.job_id}. Using mock results.")
        
        try:
            # Load mock results from S3
            mock_key = f"results/{DEV_MODE_SOURCE_JOB_ID}/comprehensive_results.json"
            logger.info(f"Loading mock results from S3: {mock_key}")
            
            comprehensive_data = self.aws_services.get_object_from_s3(
                config.s3_bucket, mock_key
            )
            results = comprehensive_data.get("results", {})
            
            # Save as new result
            self.aws_services.save_results_to_s3(
                results, config.s3_bucket, config.project_name, config.job_id
            )
            
            # Update status
            self.aws_services.update_job_status(
                config.job_id,
                "SUCCEEDED",
                {"resultPrefix": f"s3://{config.s3_bucket}/projects/{config.project_name}/"}
            )

            # Send email notification if requested
            if config.notification_email and self.klaviyo_service:
                try:
                    self.klaviyo_service.send_job_completed_email(
                        config.notification_email, config.project_name, config.job_id
                    )
                except Exception as e:
                    logger.warning("Email notification failed (dev mode): %s", e)

            # Update PostgreSQL + callback (dev mode)
            self.postgres_notifier.notify_completed(config.job_id)
            if config.callback_url and self._webhook_secret:
                self.postgres_notifier.send_callback(
                    config.callback_url, config.job_id, "completed", self._webhook_secret,
                )

            return PipelineResult(
                success=True,
                status_code=200,
                body={
                    "message": "Prelander Generator pipeline completed successfully (DEV MODE)",
                    "project_name": config.project_name,
                    "s3_bucket": config.s3_bucket,
                    "job_id": config.job_id,
                    "dev_mode": True,
                    "results_location": f"s3://{config.s3_bucket}/projects/{config.project_name}/",
                    "job_results_location": f"s3://{config.s3_bucket}/results/{config.job_id}/",
                }
            )
            
        except Exception as e:
            logger.error(f"Dev mode failed: {e}")
            self.aws_services.update_job_status(config.job_id, "FAILED", {"error": str(e)})
            raise
    
    def _complete_avatar_with_beliefs(
        self,
        identified_avatar: Any,
        deep_research_output: str,
        target_product_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Complete both avatar details and necessary beliefs for a single avatar.

        Args:
            identified_avatar: The identified avatar object.
            deep_research_output: The deep research document.
            target_product_name: Optional product name for consistent naming.

        Returns:
            Dictionary with avatar details and beliefs.
        """
        avatar_details = self.avatar_step.complete_avatar_details(
            identified_avatar, deep_research_output, target_product_name=target_product_name
        )
        # necessary_beliefs = self.avatar_step.complete_necessary_beliefs(
        #     identified_avatar, deep_research_output
        # )
        return {
            "identified_avatar": identified_avatar,
            "avatar_details": avatar_details,
        }
    
    def _generate_angles_for_avatar(
        self,
        result_entry: Dict[str, Any],
        deep_research_output: str,
        target_product_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Generate marketing angles for a single avatar.

        Args:
            result_entry: Dictionary with avatar details and beliefs.
            deep_research_output: The deep research document.
            target_product_name: Optional product name for consistent naming.

        Returns:
            Dictionary with avatar, angles, and beliefs.
        """
        avatar = result_entry["avatar_details"]
        angles = self.marketing_step.generate_marketing_angles(avatar, deep_research_output, target_product_name=target_product_name)

        # Step 5c: Generate template predictions for top angles
        angles_dict = angles.dict()
        for i, angle_data in enumerate(angles_dict.get("generated_angles", [])):
            if i < len(angles.generated_angles):
                angle = angles.generated_angles[i]
                prediction = self.template_prediction_step.execute(avatar, angle)
                if prediction:
                    angles_dict["generated_angles"][i]["template_predictions"] = prediction.dict()

        return {
            "avatar": avatar.dict(),
            "angles": angles_dict,
        }
    
    def run(self, config: PipelineConfig) -> PipelineResult:
        """
        Execute the full pipeline.
        
        Args:
            config: Pipeline configuration.
            
        Returns:
            PipelineResult with execution outcome.
        """
        try:
            logger.info("Starting Prelander Generator pipeline")
            logger.info(f"Config: job_id={config.job_id}, project={config.project_name}")
            
            # Set up telemetry context
            self._set_usage_context(config)
            
            # Update job status to RUNNING
            self.aws_services.update_job_status(
                config.job_id, "RUNNING", {"message": "Job started"}
            )
            
            # Handle dev mode
            if config.dev_mode:
                return self._handle_dev_mode(config)
            
            # Check cache for deep research results
            cached_research = self.cache_service.get_cached_research(config.sales_page_url, target_product_name=config.target_product_name)
            
            if cached_research:
                # Cache HIT - use cached data and skip Steps 1-3
                logger.info("Using cached research data - skipping Steps 1-3")
                research_page_analysis = cached_research.research_page_analysis
                deep_research_prompt = cached_research.deep_research_prompt
                deep_research_output = cached_research.deep_research_output
                # Still capture product image (not cached — it's large base64 data)
                logger.info("Capturing product image for cached research")
                product_image = self.analyze_page_step.capture_product_image_only(config.sales_page_url)
            else:
                # Cache MISS - execute Steps 1-3 and cache results

                # Step 1: Analyze research page
                logger.info("Step 1: Analyzing research page")
                page_result = self.analyze_page_step.execute(config.sales_page_url)
                research_page_analysis = page_result.analysis
                product_image = page_result.product_image

                # Step 2: Create deep research prompt
                logger.info("Step 2: Creating deep research prompt")
                deep_research_prompt = self.deep_research_step.create_prompt(
                    sales_page_url=config.sales_page_url,
                    research_page_analysis=research_page_analysis,
                    gender=config.gender,
                    location=config.location,
                    research_requirements=config.research_requirements,
                    target_product_name=config.target_product_name,
                )

                # Step 3: Execute deep research
                logger.info("Step 3: Executing deep research")
                deep_research_output = self.deep_research_step.execute(deep_research_prompt)

                # Save to cache for future runs
                logger.info("Saving research results to cache")
                self.cache_service.save_research_cache(
                    sales_page_url=config.sales_page_url,
                    research_page_analysis=research_page_analysis,
                    deep_research_prompt=deep_research_prompt,
                    deep_research_output=deep_research_output,
                    target_product_name=config.target_product_name,
                )
            
            # Step 4: Identify and complete avatars
            logger.info("Step 4a: Identifying avatars")
            identified_avatars = self.avatar_step.identify_avatars(deep_research_output, target_product_name=config.target_product_name)
            
            logger.info(
                f"Step 4b: Completing details AND necessary beliefs for "
                f"{len(identified_avatars.avatars)} avatars in parallel"
            )
            
            # Run avatar completions in parallel
            avatar_results: List[Dict[str, Any]] = []
            max_workers = min(10, len(identified_avatars.avatars))
            
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {
                    executor.submit(
                        self._complete_avatar_with_beliefs, ia, deep_research_output, config.target_product_name
                    ): ia
                    for ia in identified_avatars.avatars
                }
                for future in as_completed(futures):
                    ia = futures[future]
                    try:
                        result = future.result()
                        avatar_results.append(result)
                        logger.info(f"Completed avatar details + beliefs for: {ia.name}")
                    except Exception as e:
                        logger.error(f"Failed to complete avatar for {ia.name}: {e}")
                        raise
            
            # Step 5: Generate marketing angles for each avatar
            logger.info("Step 5: Generating marketing angles")
            
            marketing_avatars_list: List[Dict[str, Any]] = []
            max_workers = min(10, len(avatar_results))
            
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                futures = {
                    executor.submit(
                        self._generate_angles_for_avatar, result_entry, deep_research_output, config.target_product_name
                    ): result_entry
                    for result_entry in avatar_results
                }
                for future in as_completed(futures):
                    result_entry = futures[future]
                    try:
                        result = future.result()
                        marketing_avatars_list.append(result)
                        logger.info(
                            f"Completed marketing angles for: "
                            f"{result_entry['avatar_details'].overview.name}"
                        )
                    except Exception as e:
                        logger.error(
                            f"Failed to generate angles for "
                            f"{result_entry['avatar_details'].overview.name}: {e}"
                        )
                        raise
            
            # Step 5b: Generate Offer Brief
            logger.info("Step 5b: Generating Offer Brief")
            offer_brief = self.offer_brief_step.create_offer_brief(
                marketing_avatars_list, deep_research_output, target_product_name=config.target_product_name
            )
            
            # Upload product image to Cloudflare CDN
            if self.cloudflare_service and product_image:
                try:
                    product_image = self.cloudflare_service.upload_base64_image(
                        product_image,
                        f"{config.job_id}_product.jpg",
                        {
                            "source": "process_job_v2",
                            "job_id": config.job_id,
                            "project_name": config.project_name,
                        },
                    )
                except Exception as e:
                    logger.warning("Cloudflare upload failed, keeping base64: %s", e)

            # Step 6: Save results
            logger.info("Step 6: Saving results")
            all_results = {
                "research_page_analysis": research_page_analysis,
                "deep_research_prompt": deep_research_prompt,
                "deep_research_output": deep_research_output,
                "offer_brief": offer_brief.model_dump(),
                "marketing_avatars": marketing_avatars_list,
                "product_image": product_image,
                "target_product_name": config.target_product_name,
            }
            
            self.aws_services.save_results_to_s3(
                all_results, config.s3_bucket, config.project_name, config.job_id
            )
            
            # Update job status to SUCCEEDED
            logger.info("Pipeline completed successfully")
            try:
                self.aws_services.update_job_status(
                    config.job_id,
                    "SUCCEEDED",
                    {"resultPrefix": f"s3://{config.s3_bucket}/projects/{config.project_name}/"}
                )
            except Exception:
                pass

            # Send email notification if requested
            if config.notification_email and self.klaviyo_service:
                try:
                    self.klaviyo_service.send_job_completed_email(
                        config.notification_email, config.project_name, config.job_id
                    )
                except Exception as e:
                    logger.warning("Email notification failed: %s", e)

            # Update PostgreSQL directly (non-fatal)
            self.postgres_notifier.notify_completed(config.job_id)

            # Send webhook callback to trigger result processing
            if config.callback_url and self._webhook_secret:
                self.postgres_notifier.send_callback(
                    config.callback_url, config.job_id, "completed", self._webhook_secret,
                )

            return PipelineResult(
                success=True,
                status_code=200,
                body={
                    "message": "Prelander Generator pipeline completed successfully",
                    "project_name": config.project_name,
                    "s3_bucket": config.s3_bucket,
                    "avatars_count": len(marketing_avatars_list),
                    "results_location": f"s3://{config.s3_bucket}/projects/{config.project_name}/",
                    "job_results_location": f"s3://{config.s3_bucket}/results/{config.job_id}/",
                    "job_id": config.job_id
                }
            )
            
        except Exception as e:
            logger.error(f"Error in pipeline execution: {e}")

            # Attempt to mark job failed
            try:
                self.aws_services.update_job_status(
                    config.job_id, "FAILED", {"error": str(e)}
                )
            except Exception:
                pass

            # Update PostgreSQL directly (non-fatal)
            self.postgres_notifier.notify_failed(config.job_id)

            # Send webhook callback to notify frontend of failure
            if config.callback_url and self._webhook_secret:
                self.postgres_notifier.send_callback(
                    config.callback_url, config.job_id, "failed", self._webhook_secret,
                )

            return PipelineResult(
                success=False,
                status_code=500,
                body={
                    "error": str(e),
                    "message": "Prelander Generator pipeline failed"
                }
            )


def create_config_from_event(event: Dict[str, Any], s3_bucket_default: str) -> PipelineConfig:
    """
    Create PipelineConfig from Lambda event.
    
    Args:
        event: Lambda event dictionary.
        s3_bucket_default: Default S3 bucket if not in event.
        
    Returns:
        PipelineConfig instance.
    """
    job_id = event.get("job_id") or os.environ.get("JOB_ID") or str(uuid.uuid4())
    
    return PipelineConfig(
        sales_page_url=event.get("sales_page_url") or os.environ.get("SALES_PAGE_URL", ""),
        s3_bucket=event.get("s3_bucket", s3_bucket_default),
        project_name=event.get("project_name") or os.environ.get("PROJECT_NAME") or "default-project",
        job_id=job_id,
        gender=event.get("gender"),
        location=event.get("location"),
        research_requirements=event.get("research_requirements"),
        target_product_name=event.get("target_product_name"),
        notification_email=event.get("notification_email"),
        callback_url=event.get("callback_url"),
        dev_mode=event.get("dev_mode") == "true",
        api_version=event.get("api_version") or os.environ.get("API_VERSION") or "v2"
    )
