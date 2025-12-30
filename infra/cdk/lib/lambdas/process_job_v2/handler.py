"""
AWS Lambda handler for processing AI pipeline jobs.

This handler wraps the run_pipeline function from the original handler.py
and adapts it for Lambda execution.
"""
import json
import os
import base64
import requests
import io
from PIL import Image
from botocore.exceptions import ClientError
from openai import OpenAI
from perplexity import Perplexity
import boto3
import sys
import logging
from datetime import datetime, timezone
import uuid
import anthropic
import time

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional, Literal, Any, Dict, Union
from pydantic import BaseModel, Field, ConfigDict, create_model

from playwright.sync_api import sync_playwright


from data_models import Avatar, AvatarList, IdentifiedAvatarList

from llm_usage import UsageContext, emit_llm_usage_event, normalize_openai_usage, normalize_perplexity_usage

# Import extract_clean_text_from_html from test_anthropic since utils.py was removed
def extract_clean_text_from_html(html_file_path: str) -> str:
    """Extract clean text from an HTML file by removing scripts, styles, and extra whitespace."""
    from bs4 import BeautifulSoup
    with open(html_file_path, 'r', encoding='utf-8') as f:
        html = f.read()
    soup = BeautifulSoup(html, 'html.parser')
    for script in soup(["script", "style"]):
        script.decompose()
    text = soup.get_text()
    lines = (line.strip() for line in text.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    clean_text = '\n'.join(chunk for chunk in chunks if chunk)
    return clean_text


# Configure logging
logger = logging.getLogger()
# Derive log level from env, default INFO
_log_level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
_log_level = getattr(logging, _log_level_name, logging.INFO)
logger.setLevel(_log_level)

# Add stdout handler if none exist (local/ECS), otherwise align existing handlers' levels (Lambda)
if not logger.handlers:
    _stdout_handler = logging.StreamHandler(stream=sys.stdout)
    _stdout_handler.setLevel(_log_level)
    _formatter = logging.Formatter(
        fmt="%(asctime)s %(levelname)s %(name)s - %(message)s"
    )
    _stdout_handler.setFormatter(_formatter)
    logger.addHandler(_stdout_handler)
else:
    for _h in logger.handlers:
        try:
            _h.setLevel(_log_level)
        except Exception:
            pass


def save_fullpage_png(url: str) -> bytes:
    with sync_playwright() as p:
        launch_args = {
            "headless": True,
            "args": [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--single-process",
                "--no-zygote",
                "--disable-software-rasterizer",
                "--disable-web-security",
            ],
        }

        # Use a persistent context instead of passing --user-data-dir to launch()
        user_data_dir = "/tmp/playwright-user"
        context = p.chromium.launch_persistent_context(user_data_dir=user_data_dir, **launch_args)
        page = context.new_page()

        # Load the page
        try:
            # Use domcontentloaded first with a longer timeout (60s)
            page.goto(url, wait_until="domcontentloaded", timeout=60000)
            
            # Try to wait for network idle, but proceed if it times out (some sites never idle)
            try:
                page.wait_for_load_state("networkidle", timeout=30000)
            except Exception:
                logger.warning(f"Timeout waiting for network idle on {url}, proceeding with screenshot")
                
        except Exception as e:
            logger.error(f"Failed to load page {url}: {e}")
            raise e

        # Take a full-page screenshot
        screenshot_bytes = page.screenshot(full_page=True)

        logger.info(f"Captured full-page screenshot for {url}")

        page.close()
        context.close()
        return screenshot_bytes


def compress_image_if_needed(image_bytes: bytes, max_size_mb: float = 0.5) -> bytes:
    """
    Compress image if it exceeds the max size.
    Resize and reduce quality iteratively until it fits.
    """
    max_bytes = int(max_size_mb * 1024 * 1024)
    if len(image_bytes) <= max_bytes:
        return image_bytes
        
    logger.info(f"Image size {len(image_bytes)} exceeds limit of {max_bytes}. Compressing...")
    
    try:
        img = Image.open(io.BytesIO(image_bytes))
        
        # Convert to RGB if necessary (e.g. PNG with transparency to JPEG)
        if img.mode in ('RGBA', 'P'):
             img = img.convert('RGB')
             
        # Iteratively reduce quality/size
        quality = 90
        output_io = io.BytesIO()
        
        while True:
            output_io.seek(0)
            output_io.truncate()
            img.save(output_io, format='JPEG', quality=quality)
            current_size = output_io.tell()
            
            if current_size <= max_bytes or quality <= 10:
                break
                
            # Reduce quality
            quality -= 10
            
            # If quality is getting low, also resize
            if quality < 60:
                 width, height = img.size
                 new_width = int(width * 0.8)
                 new_height = int(height * 0.8)
                 # Ensure we don't shrink to 0
                 if new_width < 1 or new_height < 1:
                     break
                 img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        compressed_bytes = output_io.getvalue()
        logger.info(f"Compressed image to {len(compressed_bytes)} bytes")
        return compressed_bytes
        
    except Exception as e:
        logger.error(f"Failed to compress image: {e}")
        # Return original if compression fails
        return image_bytes
    
    
def json_type_to_python(
    schema: Dict[str, Any],
    definitions: Dict[str, Any] = None
) -> type:
    """
    Convert JSON schema type to Python type.
    
    Args:
        schema: JSON schema for a field
        definitions: Schema definitions ($defs) for nested types
        
    Returns:
        Python type for the field
    """
    definitions = definitions or {}
    
    # Handle $ref (references to definitions)
    if "$ref" in schema:
        ref_path = schema["$ref"]
        if ref_path.startswith("#/$defs/"):
            def_name = ref_path.replace("#/$defs/", "")
            if def_name in definitions:
                return create_model_from_schema(
                    def_name,
                    definitions[def_name],
                    definitions
                )
        return Any
    
    # Handle allOf (used by Pydantic for nested models)
    if "allOf" in schema:
        for sub_schema in schema["allOf"]:
            if "$ref" in sub_schema:
                return json_type_to_python(sub_schema, definitions)
        return Any
    
    # Handle anyOf (union types)
    if "anyOf" in schema:
        types = []
        for sub_schema in schema["anyOf"]:
            sub_type = json_type_to_python(sub_schema, definitions)
            if sub_type is not type(None):  # Skip None for now, we'll handle it below
                types.append(sub_type)
        
        # Check if None is one of the options
        has_null = any(sub.get("type") == "null" for sub in schema["anyOf"])
        
        if len(types) == 0:
            return type(None)
        elif len(types) == 1:
            return Optional[types[0]] if has_null else types[0]
        else:
            # Multiple non-null types
            union_type = Union[tuple(types)]
            return Optional[union_type] if has_null else union_type
    
    json_type = schema.get("type")
    
    if json_type == "string":
        return str
    elif json_type == "integer":
        return int
    elif json_type == "number":
        return float
    elif json_type == "boolean":
        return bool
    elif json_type == "array":
        items_schema = schema.get("items", {})
        item_type = json_type_to_python(items_schema, definitions)
        return List[item_type]
    elif json_type == "object":
        # Create a nested model for object types
        return create_model_from_schema(
            schema.get("title", "NestedModel"),
            schema,
            definitions
        )
    elif json_type == "null":
        return type(None)
    
    return Any


def create_model_from_schema(
    model_name: str,
    schema: Dict[str, Any],
    definitions: Dict[str, Any] = None
) -> type[BaseModel]:
    """
    Create a Pydantic model from a JSON schema.
    
    Args:
        model_name: Name for the model
        schema: JSON schema object
        definitions: Schema definitions ($defs) for nested types
        
    Returns:
        Pydantic BaseModel class
    """
    definitions = definitions or {}
    
    properties = schema.get("properties", {})
    required_fields = schema.get("required", [])
    
    # Build field definitions
    field_definitions = {}
    
    for field_name, field_schema in properties.items():
        field_type = json_type_to_python(field_schema, definitions)
        
        # Determine if field is required
        is_required = field_name in required_fields
        
        # Get description
        description = field_schema.get("description", "")
        
        # Create Field with metadata
        if is_required:
            field_definitions[field_name] = (
                field_type,
                Field(..., description=description)
            )
        else:
            field_definitions[field_name] = (
                Optional[field_type],
                Field(None, description=description)
            )
    
    # Create the model
    model = create_model(
        model_name,
        **field_definitions,
        __base__=BaseModel
    )
    
    # Add docstring
    if "description" in schema:
        model.__doc__ = schema["description"]
    
    return model


def load_schema_as_model(schema: str) -> type[BaseModel]:
    """
    Load a JSON schema file and create a Pydantic BaseModel.
    
    Args:
        schema_path: Path to JSON schema file
        
    Returns:
        Pydantic BaseModel class
    """
    schema = json.loads(schema)
    
    # Get definitions
    definitions = schema.get("$defs", {})
    
    # Get model name from schema or use default
    model_name = schema.get("title", "GeneratedModel")
    
    # Create the main model
    return create_model_from_schema(model_name, schema, definitions)



class DeepCopy:
    def __init__(self):
        # Resolve secret id/name/arn and region from environment for Lambda flexibility
        env = os.environ.get('ENVIRONMENT', 'dev')
        secret_id = "deepcopy-secret-dev"
        self.openai_model = "gpt-5-mini"
        self.secrets = self.get_secrets(secret_id)
        self.client = OpenAI(api_key=self.secrets["OPENAI_API_KEY"]) 
        self.pplx_client = Perplexity(api_key=self.secrets["PERPLEXITY_API_KEY"])
        self.anthropic_client = anthropic.Anthropic(api_key=self.secrets["ANTHROPIC_API_KEY"])
        aws_region = os.environ.get('AWS_REGION') or os.environ.get('AWS_DEFAULT_REGION') or 'eu-west-1'
        self.s3_client = boto3.client('s3', region_name=aws_region)
        # Get bucket from environment or use default
        self.s3_bucket = os.environ.get('RESULTS_BUCKET', "deepcopystack-resultsbucketa95a2103-zhwjflrlpfih")
        # Optional DynamoDB for job status updates
        self.ddb_client = boto3.client('dynamodb', region_name=aws_region)
        self.jobs_table_name = os.environ.get('JOBS_TABLE_NAME', "DeepCopyStack-JobsTable1970BC16-1BVYVOHK8WXTU")
        # Telemetry context (set by run_pipeline)
        self.usage_ctx: UsageContext | None = None
        self.aws_request_id: str | None = None

    def _emit_openai(
        self,
        *,
        operation: str,
        subtask: str,
        model: str,
        t0: float,
        success: bool,
        response: object | None = None,
        error: Exception | None = None,
    ) -> None:
        if not self.usage_ctx:
            return
        emit_llm_usage_event(
            ctx=self.usage_ctx,
            provider="openai",
            model=model,
            operation=operation,
            subtask=subtask,
            latency_ms=int((time.time() - t0) * 1000),
            success=success,
            retry_attempt=1,
            aws_request_id=self.aws_request_id,
            error_type=type(error).__name__ if error else None,
            usage=normalize_openai_usage(response) if response is not None else None,
        )

    def _emit_perplexity(
        self,
        *,
        operation: str,
        subtask: str,
        model: str,
        t0: float,
        success: bool,
        response: object | None = None,
        error: Exception | None = None,
    ) -> None:
        if not self.usage_ctx:
            return
        emit_llm_usage_event(
            ctx=self.usage_ctx,
            provider="perplexity",
            model=model,
            operation=operation,
            subtask=subtask,
            latency_ms=int((time.time() - t0) * 1000),
            success=success,
            retry_attempt=1,
            aws_request_id=self.aws_request_id,
            error_type=type(error).__name__ if error else None,
            usage=normalize_perplexity_usage(response) if response is not None else None,
        )
        
    def get_secrets(self, secret_id):
        """Get secrets from AWS Secrets Manager"""
        try:
            aws_region = os.environ.get('AWS_REGION') or os.environ.get('AWS_DEFAULT_REGION') or 'eu-west-1'
            client = boto3.client('secretsmanager', region_name=aws_region)
            response = client.get_secret_value(SecretId=secret_id)
            return json.loads(response['SecretString'])
        except Exception as e:
            logger.error(f"Error getting secrets: {e}")
            raise
    
    def analyze_research_page(self, sales_page_url):
        """Analyze the sales page using GPT-5 Vision
        
        Args:
            sales_page_url: URL of the sales page to analyze
        """
        try:
            base64_image = None
            logger.info(f"Capturing page: {sales_page_url}")
            try:
                screenshot_bytes = save_fullpage_png(sales_page_url)
                # Compress if needed (max 500KB)
                compressed_bytes = compress_image_if_needed(screenshot_bytes, max_size_mb=0.48)
                logger.info(f"Image captured for {sales_page_url}. Original: {len(screenshot_bytes)}, Compressed: {len(compressed_bytes)}")
                base64_image = base64.b64encode(compressed_bytes).decode("utf-8")
            except Exception as e:
                logger.error(f"Failed to capture or encode image from {sales_page_url}: {e}")
                raise
            
            prompt = f"""
            You are my expert copywriter and you specialise in writing highly persuasive direct response style copy.
            
            I've attached my current sales page.    

            Analyze this page and please let me know your thoughts on the product, the claims, the proof, and the overall offer.
            Identify what kind of customers this product might appeal to.
            """
            
            logger.info("Calling GPT-5 Vision API for research page analysis")
            content_payload = [{"type": "input_text", "text": prompt}, {"type": "input_image", "image_url": f"data:image/jpeg;base64,{base64_image}"}]
            
            t0 = time.time()
            try:
                response = self.client.responses.create(
                    model=self.openai_model,
                    input=[{"role": "user", "content": content_payload}]
                )
                self._emit_openai(
                    operation="responses.create",
                    subtask="process_job_v2.analyze_research_page",
                    model=self.openai_model,
                    t0=t0,
                    success=True,
                    response=response,
                )
            except Exception as e:
                self._emit_openai(
                    operation="responses.create",
                    subtask="process_job_v2.analyze_research_page",
                    model=self.openai_model,
                    t0=t0,
                    success=False,
                    error=e,
                )
                raise
            logger.info("GPT-5 Vision API call completed for research page analysis")
            return response.output_text
            
        except Exception as e:
            logger.error(f"Error analyzing research page: {e}")
            raise
    
    def create_deep_research_prompt(self, sales_page_url, research_page_analysis, gender=None, location=None, research_requirements=None, language_of_output="English"):
        """Create a comprehensive research prompt"""
        # try:
        #     prompt = f"""
        #     Now that you understand how to conduct research, create a full, best-practice prompt for Deep Research tool to research products from {sales_page_url} according to the sections below. 
        #     Please only return the actual prompt that directly can be used in the Deep Research tool, no other text or return questions.
        #     Do not ask to add any appendices, everything should be text and in a single document.
            
        #     Please ensure that the deep research prompt covers multiple potential customer avatars and marketing angles.
            
        #     Inputs to consider:
        #     - Gender: {gender if gender else "Not specified"}
        #     - Location: {location if location else "Not specified"}
        #     - Specific Research Requirements: {research_requirements if research_requirements else "None"}

        #     Research Page analysis:
        #     {research_page_analysis}

        #     Research doc1 analysis:
        #     {doc1_analysis}

        #     Research doc2 analysis:
        #     {doc2_analysis}
        #     """
            
        #     logger.info("Calling GPT-5 API to create deep research prompt")
        #     t0 = time.time()
        #     try:
        #         response = self.client.responses.create(
        #             model=self.openai_model,
        #             input=[{
        #                 "role": "user",
        #                 "content": [{"type": "input_text", "text": prompt}]
        #             }]
        #         )
        #         self._emit_openai(
        #             operation="responses.create",
        #             subtask="process_job_v2.create_deep_research_prompt",
        #             model=self.openai_model,
        #             t0=t0,
        #             success=True,
        #             response=response,
        #         )
        #     except Exception as e:
        #         self._emit_openai(
        #             operation="responses.create",
        #             subtask="process_job_v2.create_deep_research_prompt",
        #             model=self.openai_model,
        #             t0=t0,
        #             success=False,
        #             error=e,
        #         )
        #         raise
        #     logger.info("GPT-5 API call completed for deep research prompt creation")
            
        #     return response.output_text
            
        # except Exception as e:
        #     logger.error(f"Error creating deep research prompt: {e}")
        #     raise
        prompt = f"""
        You are the Deep Research tool. Conduct comprehensive, unbiased, full-spectrum research ONLY (no marketing, no copywriting) using the inputs and requirements below.

        ===============================================================================
        INPUTS (PLACEHOLDERS — DO NOT ASK QUESTIONS)
        ===============================================================================
        - sales_page_url: {sales_page_url}
        - gender: {gender}                                         (e.g., “Female”, “Male”, “Mixed”, “Not specified”)
        - location: {location}                                     (country/region/city; “Not specified” allowed)
        - specific_research_requirements: {research_requirements}   (“None” allowed)
        - language_of_output: {language_of_output}                 (e.g., “English”)
        - Product Page analysis: {research_page_analysis}

        ===============================================================================
        NON-NEGOTIABLE RULES (RESEARCH ONLY)
        ===============================================================================
        This is RESEARCH ONLY. Do NOT:
        - Choose marketing angles or hooks
        - Identify “avatars to target” as recommendations
        - Make positioning recommendations
        - Suggest creative direction
        - Write any marketing copy (ads, landing copy, headlines, email copy, scripts)

        You MUST:
        - Mine real customer language from actual sources
        - Document the complete emotional landscape
        - Extract exact quotes, phrases, and words people use (no paraphrasing for quotes)
        - Map all failed solutions and why they failed
        - Identify patterns across large volumes of data
        - Cover multiple potential customer avatars AND multiple marketing angles ONLY as OBSERVATIONS found in the data (no recommendations)

        If any instruction conflicts, obey “RESEARCH ONLY” and “NO RECOMMENDATIONS”.

        ===============================================================================
        SCOPE & CONTEXT SETUP (MANDATORY FIRST STEPS)
        ===============================================================================
        1) Visit and analyze {sales_page_url} to extract and summarize (briefly) the factual product context needed for research:
        - What the product is, category, promised outcomes/claims, mechanism, format (supplement/device/service/app), pricing if visible, usage protocol, risk/contraindications if stated, and any compliance disclaimers.
        - Capture exact on-page phrases that describe outcomes, mechanisms, or target use-cases (quote small excerpts as needed).

        2) Define research search terms and synonyms from:
        - product_name, product_brief_description, category keywords inferred from {sales_page_url}, and the problem the product solves.
        - Include condition/problem synonyms, colloquial terms, and common misspellings.

        3) Respect the inputs:
        - Gender: {gender}
        - Location/Primary market: {location}
        - Specific Research Requirements: {research_requirements}
        If “Not specified”, broaden the search and then report what the evidence shows.

        ===============================================================================
        SOURCES TO MINE (PRIORITIZE REAL CUSTOMER LANGUAGE)
        ===============================================================================
        Mine and cite evidence from:
        - Reddit threads in relevant subreddits
        - Amazon product reviews (1-star, 3-star, 5-star) and other major retailers where applicable
        - YouTube video comments on relevant videos
        - Quora Q&A
        - Public Facebook groups/pages (publicly accessible content only)
        - Health/hobby forums and communities
        - Google “People Also Ask” queries (capture the query language verbatim)
        - Independent review sites, niche communities, and reputable publications where relevant
        - Competitor sites and competitor review pages

        For every claim, pattern, or notable point, provide source evidence. For every quote, provide attribution details.

        ===============================================================================
        EVIDENCE, QUOTATION, AND ATTRIBUTION REQUIREMENTS
        ===============================================================================
        - Quotes must be copied verbatim. Do not “clean up” grammar.
        - For each quote include:
        - Source type (Reddit/Amazon/YouTube/etc.)
        - Identifier (subreddit + thread title, product listing name, video title/channel, forum name/thread)
        - Date (if available)
        - Link/reference (as available in the environment)
        - Distinguish between:
        - (A) Customer-reported experiences
        - (B) Opinions/beliefs/narratives (including conspiratorial or suppression claims)
        - (C) Clinically or scientifically supported statements (only when backed by reputable sources)

        Do not validate misinformation. Document it as “observed narrative” with attribution.

        ===============================================================================
        OUTPUT FORMAT REQUIREMENTS (SINGLE DOCUMENT)
        ===============================================================================
        - Output language: {language_of_output}
        - Single document, no appendices, text only
        - Minimum length: 6 pages equivalent
        - Clear section headers matching Parts 1–9 below
        - Dense with evidence: include citations/attribution throughout
        - No marketing recommendations; no copywriting

        ===============================================================================
        RESEARCH DOCUMENT STRUCTURE (FOLLOW EXACTLY)
        ===============================================================================

        PART 1: UNDERSTANDING THE MARKET DEMOGRAPHIC
        1. WHO ARE THESE PEOPLE?
        - Demographics: age ranges, gender, income levels, occupations
        - Life stage and circumstances
        - Where they spend time online (forums, platforms, communities)
        - Note differences by {location} vs other regions where observed

        2. ATTITUDES AND WORLDVIEW
        - How do they see themselves?
        - What do they value most?
        - What are they proud of? Ashamed of?
        - How do they want others to perceive them?

        3. HOPES AND DREAMS
        - Ideal outcome: what does success look like?
        - What would life be like if the problem was solved?
        - What would they be able to do that they can’t do now?
        - What identity do they want to reclaim or achieve?

        4. VICTORIES AND FAILURES
        - Small wins
        - Crushing defeats
        - The moment they realized it was a real problem
        - “Rock bottom” stories (quote-heavy)

        5. OUTSIDE FORCES THEY BLAME
        - Who/what they blame: doctors, system, genetics, age, society, employers, family, etc.
        - Past bad advice
        - Companies/products that failed them

        6. PREJUDICES AND BIASES
        - Skepticism triggers
        - What they’ve been burned by
        - Solutions dismissed immediately
        - Claims that cause eye-rolls

        7. CORE BELIEFS ABOUT THE PROBLEM
        - Believed causes
        - Believed requirements to fix
        - What they believe is impossible
        - Limiting beliefs

        PART 2: EXISTING SOLUTIONS LANDSCAPE
        8. WHAT ARE THEY CURRENTLY USING?
        - Exhaustive list: OTC, prescriptions, devices, services, DIY remedies, lifestyle changes
        - “Default” solutions and the most popular ones
        - Differences by {location} where observed

        9. EXPERIENCE WITH CURRENT SOLUTIONS
        - What they like
        - What they hate
        - What’s missing from everything they tried
        - Price/effort/time/trust barriers (from evidence)

        10. HORROR STORIES AND FAILURES
            - Specific stories of failure
            - Things that made the issue worse
            - Money wasted
            - Side effects/negative experiences

        11. BELIEF IN SOLUTIONS
            - Do they believe a real solution exists?
            - Hopeful vs defeated language
            - What would convince them something new works? (evidence only)

        PART 3: CURIOSITY AND INTRIGUE ELEMENTS
        12. UNIQUE HISTORICAL APPROACHES
            - Forgotten solutions and pre-1960s approaches
            - Traditional/folk medicine and historical practices
            - “Before modern solutions” behaviors
            - Clearly separate history vs anecdote; cite sources

        13. SUPPRESSION OR CONSPIRACY NARRATIVES
            - “Hidden solutions” beliefs
            - Suppression/cover-up narratives
            - “They don’t want you to know” themes
            - Present as observed narratives only; do not endorse; attribute sources

        PART 4: “FALL FROM EDEN” RESEARCH
        14. WHEN DID THIS PROBLEM NOT EXIST?
            - Historical prevalence or when it was rarer
            - What changed and when
            - Epidemiology or credible historical data (cite reputable sources)

        15. CORRUPTING FORCES
            - Environmental/diet/lifestyle shifts
            - Policies/industry changes blamed
            - “Real reason this is happening now” (separate evidence vs narrative)

        16. ISOLATED POPULATIONS
            - Populations with low prevalence (if supported by credible evidence)
            - What differs in lifestyle/diet/environment
            - Lessons as neutral observations, not recommendations

        PART 5: COMPETITOR LANDSCAPE
        17. TOP COMPETITORS
            - Top competitors
            - Positioning and price points (as stated/observable)
            - Mechanisms/claims (quote competitors directly where useful)
            - What seems to be working in their marketing (observable signals only, no recommendations)

        18. COMPETITOR CUSTOMER REVIEWS
            - What customers love
            - What customers hate
            - Gaps not being filled (from review evidence)
            - Recurring complaints across competitors

        19. COMPETITOR WEAKNESSES
            - Vulnerabilities evidenced by customer complaints
            - Claims they are not making (observable)
            - Objections not being addressed (evidence-based)

        PART 6: RAW LANGUAGE MAP (CRITICAL)

        Sources to mine:
        - Reddit
        - Amazon/retailer reviews
        - YouTube comments
        - Quora
        - Public Facebook groups/pages
        - Forums/communities
        - “People Also Ask” queries (verbatim)

        Organize into these categories (quotes only, minimal commentary):
        20. PAIN STATEMENTS (15–20 quotes)
        21. DESIRE STATEMENTS (15–20 quotes)
        22. FAILURE STATEMENTS (10–15 quotes)
        23. FRUSTRATION STATEMENTS (10–15 quotes)
        24. BELIEF STATEMENTS (10–15 quotes)
        25. OBJECTION STATEMENTS (10–15 quotes)

        Each quote must include source + identifier + date if available.

        PART 7: PATTERN SYNTHESIS (EVIDENCE-BASED)
        26. TOP 10 PAIN PATTERNS
            - Rank by frequency and intensity; cite representative quotes for each

        27. TOP 10 DESIRE PATTERNS
            - Rank by emotional pull and frequency; cite representative quotes for each

        28. TOP 5 FAILED SOLUTION PATTERNS
            - What failed most and why; cite representative quotes

        29. TOP 5 OBJECTION PATTERNS
            - Common objections to new solutions; cite representative quotes

        30. TOP 5 BELIEF PATTERNS
            - Most common beliefs; label misconceptions; cite representative quotes

        31. EMOTIONAL LANDSCAPE MAP
            - Map primary emotions, intensity, and journey stages (awareness → experimentation → fatigue/hope)
            - Support with quotes

        PART 8: OBSERVABLE MARKET SEGMENTS (OBSERVATION ONLY)
        32. SEGMENTS VISIBLE IN RESEARCH (no recommendations)
            - Different types visible in the data (life stage, severity, constraints, motivation)
            - Different trigger moments/entry points
            - For each segment: defining features + representative quotes
            - Do NOT recommend targeting; only document

        PART 9: TOP INSIGHTS SUMMARY (NO RECOMMENDATIONS)
        33. KEY DISCOVERIES
            - 10–15 most important insights (evidence-backed)
            - Surprising findings
            - Market gaps as observed unmet needs (no strategy)
            - What “success” language looks like vs “failure” language (quote-supported)

        ===============================================================================
        QUALITY CONTROL CHECKLIST (MUST EXECUTE)
        ===============================================================================
        Before finalizing, confirm:
        - At least 6 pages equivalent length
        - No marketing copy, no positioning advice, no creative direction
        - Multiple potential customer avatars and angles are covered as OBSERVATIONS only
        - Specific Research Requirements ({research_requirements}) are addressed across relevant sections
        - Clear labeling of narratives vs evidence where necessary
        """
        return prompt
    
    def execute_deep_research(self, prompt):
        """Execute deep research using Perplexity SDK"""
        try:
            model_name = "sonar-deep-research"
            
            logger.info("Calling Perplexity API for deep research execution")
            t0 = time.time()
            try:
                response = self.pplx_client.chat.completions.create(
                    model=model_name,
                    messages=[
                        {"role": "system", "content": "You are a world-class research assistant. Please execute the research prompt below and adhere to the instructions provided."},
                        {"role": "user", "content": prompt},
                    ],
                )
                self._emit_perplexity(
                    operation="chat.completions.create",
                    subtask="process_job_v2.execute_deep_research",
                    model=model_name,
                    t0=t0,
                    success=True,
                    response=response,
                )
                logger.info("Perplexity API call completed for deep research execution")
                return response.choices[0].message.content
            except Exception as e:
                self._emit_perplexity(
                    operation="chat.completions.create",
                    subtask="process_job_v2.execute_deep_research",
                    model=model_name,
                    t0=t0,
                    success=False,
                    error=e,
                )
                raise
            
        except Exception as e:
            logger.error(f"Error executing deep research: {e}")
            raise
    
    def identify_avatars(self, deep_research_output):
        """Identify potential avatars from research output"""
        try:
            
            prompt = f"""
            Based on the following deep research, please identify the distinct customer avatars (personas) that would be most profitable to target.
            Return a list of these avatars with a name and a brief description for each.
            
            Deep research output:
            {deep_research_output}
            """

            logger.info("Calling GPT-5 API to identify avatars")
            t0 = time.time()
            try:
                response = self.client.responses.parse(
                    model=self.openai_model,
                    input=[{
                        "role": "user",
                        "content": [{"type": "input_text", "text": prompt}]
                    }],
                    text_format=IdentifiedAvatarList,
                )
                self._emit_openai(
                    operation="responses.parse",
                    subtask="process_job_v2.identify_avatars",
                    model=self.openai_model,
                    t0=t0,
                    success=True,
                    response=response,
                )
            except Exception as e:
                self._emit_openai(
                    operation="responses.parse",
                    subtask="process_job_v2.identify_avatars",
                    model=self.openai_model,
                    t0=t0,
                    success=False,
                    error=e,
                )
                raise
            logger.info("GPT-5 API call completed for avatar identification")
            
            return response.output_parsed
            
        except Exception as e:
            logger.error(f"Error identifying avatars: {e}")
            raise
    
    def complete_avatar_details(self, identified_avatar, deep_research_output):
        """Complete the full avatar sheet for a specific identified avatar"""
        try:
            prompt = f"""
            Amazing work! Now I want you to please complete the detailed Avatar sheet template for the following specific avatar, using the deep research output.
            
            Target Avatar:
            Name: {identified_avatar.name}
            Description: {identified_avatar.description}
            
            Deep research output:
            {deep_research_output}
            """

            logger.info(f"Calling GPT-5 API to complete avatar details for {identified_avatar.name}")
            t0 = time.time()
            try:
                response = self.client.responses.parse(
                    model=self.openai_model,
                    input=[{
                        "role": "user",
                        "content": [{"type": "input_text", "text": prompt}]
                    }],
                    text_format=Avatar,
                )
                self._emit_openai(
                    operation="responses.parse",
                    subtask=f"process_job_v2.complete_avatar_details.{identified_avatar.name}",
                    model=self.openai_model,
                    t0=t0,
                    success=True,
                    response=response,
                )
            except Exception as e:
                self._emit_openai(
                    operation="responses.parse",
                    subtask=f"process_job_v2.complete_avatar_details.{identified_avatar.name}",
                    model=self.openai_model,
                    t0=t0,
                    success=False,
                    error=e,
                )
                raise
            logger.info(f"GPT-5 API call completed for avatar details: {identified_avatar.name}")
            
            return response.output_parsed
            
        except Exception as e:
            logger.error(f"Error completing avatar details for {identified_avatar.name}: {e}")
            raise
    
    def complete_necessary_beliefs_for_avatar(self, identified_avatar, deep_research_output):
        """Extract necessary beliefs for a specific avatar based on deep research"""
        try:
            avatar_name = identified_avatar.name
            avatar_description = identified_avatar.description
            
            prompt = f"""Marketing is fundamentally about BELIEF TRANSFORMATION — taking prospects from 
their current beliefs to new beliefs that empower them to purchase. 

These beliefs form the ARGUMENT STRUCTURE of the campaign. Not the words. 
Not the power phrases. The ARGUMENT.

As Todd Brown teaches: "Stop writing copy and start crafting arguments." 
Every campaign is about leading the prospect to a BELIEF they must hold 
before you introduce the offer. That belief pre-sells them.

The 6 beliefs you extract will form an unbreakable logical and emotional 
chain. Each belief leads to the next. The final belief makes purchasing 
the ONLY rational conclusion.

═══════════════════════════════════════════════════════════════════════════════
TARGET AVATAR
═══════════════════════════════════════════════════════════════════════════════

Avatar Name: {avatar_name}
Avatar Description: {avatar_description}

═══════════════════════════════════════════════════════════════════════════════
DOCUMENT PROVIDED
═══════════════════════════════════════════════════════════════════════════════

Deep Research Document containing:
- Raw customer language from forums, reviews, YouTube comments
- Pain points and emotional frustrations
- Desires and dream outcomes
- Failed solutions and why they didn't work
- Objections and skepticism
- Fears and risks they worry about
- Beliefs about the problem and solutions

{deep_research_output}

═══════════════════════════════════════════════════════════════════════════════
TASK
═══════════════════════════════════════════════════════════════════════════════

Analyze the deep research document and extract the 6 NECESSARY BELIEFS this 
specific avatar ({avatar_name}) must hold before purchasing.

These are not generic beliefs. These are the specific belief SHIFTS required 
for THIS avatar, THIS problem, THIS product category — extracted directly 
from the language and patterns in the research.

═══════════════════════════════════════════════════════════════════════════════
THE 6-BELIEF HIERARCHY
═══════════════════════════════════════════════════════════════════════════════

BELIEF 1: PROBLEM BELIEF (The Reframe)
What must they believe about the TRUE CAUSE of their problem?

This belief reframes their understanding of why they're suffering. It reveals 
the root cause they didn't know about — the hidden reason nothing has worked. 
This opens the door to a new solution by closing the door on their old 
understanding.

───────────────────────────────────────────────────────────────────────────────

BELIEF 2: SOLUTION CATEGORY BELIEF (The Elimination)
What must they believe about WHY past solutions failed?

This belief eliminates alternatives and competitor approaches. It explains 
why the things they've tried couldn't work — not because they did it wrong, 
but because those solutions were fundamentally flawed. This clears the path 
for a new approach.

───────────────────────────────────────────────────────────────────────────────

BELIEF 3: MECHANISM BELIEF (The Criteria)
What must they believe about HOW the right solution works?

This belief establishes the criteria for an effective solution — the 
mechanism or method that actually addresses the root cause. It creates a 
mental checklist that only our unique mechanism can satisfy.

───────────────────────────────────────────────────────────────────────────────

BELIEF 4: PRODUCT BELIEF (The Delivery)
What must they believe about WHY this specific product delivers?

This belief connects the mechanism to a tangible, proprietary product. It 
answers: "Why this product and not something else that claims the same 
mechanism?" This is about formulation, quality, proof of results, and 
differentiation.

───────────────────────────────────────────────────────────────────────────────

BELIEF 5: TIMING BELIEF (The Urgency)
What must they believe about WHY now is the time to act?

This belief overcomes procrastination and "I'll think about it." It can be 
about their condition worsening, a limited opportunity, the cost of waiting, 
or the compounding benefit of starting today.

───────────────────────────────────────────────────────────────────────────────

BELIEF 6: RISK BELIEF (The Safety)
What must they believe about WHY it's safe to try?

This belief neutralizes fear of wasting money, being scammed, or failing 
again. It addresses the voice in their head that says "What if this doesn't 
work either?" and "I've been burned before."

═══════════════════════════════════════════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════════════════════════════════════════

For each of the 6 beliefs, provide:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BELIEF [#]: [CATEGORY NAME]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CURRENT BELIEF (What they believe now):
"I believe that..."
[Write in the prospect's voice — the limiting or incorrect belief they 
currently hold based on the research]

NECESSARY BELIEF (What they must believe to buy):
"I believe that..."
[Write the shifted belief that opens them to our solution]

BELIEF SHIFT SUMMARY:
[One sentence: FROM [current] → TO [necessary]]

PROOF POINT:
[The specific evidence, mechanism explanation, story, statistic, or logical 
argument that makes this belief shift inevitable. Be specific.]

RAW LANGUAGE FROM RESEARCH:
"[Direct quote from the research that reveals they hold the current belief 
or are searching for the necessary belief]"
— Source: [Forum/Review/Platform]

OBJECTION THIS NEUTRALIZES:
[What objection or resistance does this belief shift overcome?]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

═══════════════════════════════════════════════════════════════════════════════
AFTER ALL 6 BELIEFS — PROVIDE:
═══════════════════════════════════════════════════════════════════════════════

THE ARGUMENT CHAIN (One Paragraph):
Write the complete logical flow connecting all 6 beliefs as a single 
persuasive argument. This is the "spine" of the entire campaign — the 
airtight argument that makes purchase inevitable.

Format: "Because [Belief 1], and because [Belief 2], it becomes clear that 
[Belief 3]. This means [Belief 4]. Given [Belief 5], and since [Belief 6], 
the only logical decision is to [purchase action]."

UNIQUE MECHANISM IDENTIFIED:
Based on the beliefs, what is the unique mechanism that emerges as the 
proprietary, different, superior solution?

BELIEFS NEEDING MORE PROOF:
Flag any beliefs where the research doesn't provide sufficient evidence. 
Mark as [NEEDS PROOF: specific type of proof needed]

═══════════════════════════════════════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════════════════════════════════════

1. EXTRACT FROM RESEARCH — Do not invent beliefs. Every belief must be 
   grounded in actual customer language, patterns, and pain points from 
   the research document.

2. ARGUMENT CHAIN — Each belief must logically lead to the next. If belief 
   #3 doesn't flow from beliefs #1 and #2, the argument breaks.

3. PROSPECT'S VOICE — Write beliefs as the prospect would say them in their 
   own head, not as marketing copy.

4. SPECIFICITY — Avoid generic beliefs like "I believe this product works." 
   Get specific to THIS avatar ({avatar_name}) and THIS problem.

5. ONE CONCLUSION — The 6 beliefs together should make purchasing the ONLY 
   rational and emotional conclusion. There should be no escape route.

6. RAW LANGUAGE REQUIRED — Every belief must include at least one direct 
   quote from the research. If you cannot find supporting language, flag 
   the belief as [NEEDS VALIDATION].
"""

            logger.info(f"Calling GPT-5 API to complete necessary beliefs for {avatar_name}")
            t0 = time.time()
            try:
                response = self.client.responses.create(
                    model=self.openai_model,
                    input=[{
                        "role": "user",
                        "content": [{"type": "input_text", "text": prompt}]
                    }]
                )
                self._emit_openai(
                    operation="responses.create",
                    subtask=f"process_job_v2.complete_necessary_beliefs_for_avatar.{avatar_name}",
                    model=self.openai_model,
                    t0=t0,
                    success=True,
                    response=response,
                )
            except Exception as e:
                self._emit_openai(
                    operation="responses.create",
                    subtask=f"process_job_v2.complete_necessary_beliefs_for_avatar.{avatar_name}",
                    model=self.openai_model,
                    t0=t0,
                    success=False,
                    error=e,
                )
                raise
            logger.info(f"GPT-5 API call completed for necessary beliefs: {avatar_name}")
            
            return response.output_text
            
        except Exception as e:
            logger.error(f"Error completing necessary beliefs for {identified_avatar.name}: {e}")
            raise

    
    def create_summary(self, avatar_sheet, deep_research_output, necessary_beliefs_per_avatar):
        """Create a summary of all outputs"""
        try:
            # Format necessary beliefs for the prompt
            beliefs_str = ""
            for avatar_name, beliefs in necessary_beliefs_per_avatar.items():
                beliefs_str += f"\n--- {avatar_name} ---\n{beliefs}\n"
            
            prompt = f"""
            Great work! Please summarize the following outputs in a way that is easy to understand and use for a copywriter:
            
            Avatar sheet:
            {avatar_sheet}
            
            Deep research output:
            {deep_research_output}
            
            Necessary Beliefs per Avatar:
            {beliefs_str}
            """
            
            logger.info("Calling GPT-5 API to create summary")
            t0 = time.time()
            try:
                response = self.client.responses.create(
                    model=self.openai_model,
                    input=[{
                        "role": "user",
                        "content": [{"type": "input_text", "text": prompt}]
                    }]
                )
                self._emit_openai(
                    operation="responses.create",
                    subtask="process_job_v2.create_summary",
                    model=self.openai_model,
                    t0=t0,
                    success=True,
                    response=response,
                )
            except Exception as e:
                self._emit_openai(
                    operation="responses.create",
                    subtask="process_job_v2.create_summary",
                    model=self.openai_model,
                    t0=t0,
                    success=False,
                    error=e,
                )
                raise
            logger.info("GPT-5 API call completed for summary creation")
            
            return response.output_text
            
        except Exception as e:
            logger.error(f"Error creating summary: {e}")
            raise
    
    def save_results_to_s3(self, results, s3_bucket, project_name, job_id):
        """Save all results to S3"""
        try:
            # Save comprehensive results
            comprehensive_results = {
                "project_name": project_name,
                "timestamp_iso": datetime.now(timezone.utc).isoformat(),
                "results": results,
                "job_id": job_id
            }
            
            # add datetime to the s3 key
            datetime_str = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            s3_key = f'projects/{project_name}/{datetime_str}/comprehensive_results.json'
            self.s3_client.put_object(
                Bucket=s3_bucket,
                Key=s3_key,
                Body=json.dumps(comprehensive_results, ensure_ascii=False, indent=4),
                ContentType='application/json'
            )
            
            # Also save under project id
            s3_key = f'results/{job_id}/comprehensive_results.json'
            self.s3_client.put_object(
                Bucket=s3_bucket,
                Key=s3_key,
                Body=json.dumps(comprehensive_results, ensure_ascii=False, indent=4),
                ContentType='application/json'
            )
            
            logger.info(f"Saved comprehensive results to S3: {s3_key}")
            
        except Exception as e:
            logger.error(f"Error saving results to S3: {e}")
            raise

    def update_job_status(self, job_id: Optional[str], status: str, extra_attrs: Optional[dict] = None):
        """Update job status in DynamoDB if configured.

        job_id: The job identifier (string)
        status: One of SUBMITTED, RUNNING, SUCCEEDED, FAILED
        extra_attrs: Optional additional attributes to store (strings only or will be JSON-serialized)
        """
        try:
            if not self.jobs_table_name or not job_id:
                return
            item = {
                'jobId': {'S': str(job_id)},
                'status': {'S': status},
                'updatedAt': {'S': datetime.now(timezone.utc).isoformat()},
            }
            if extra_attrs:
                for key, value in extra_attrs.items():
                    # Store as string; JSON-serialize complex values
                    if isinstance(value, (str, int, float)):
                        item[key] = {'S': str(value)}
                    else:
                        item[key] = {'S': json.dumps(value, ensure_ascii=False)}
            self.ddb_client.put_item(TableName=self.jobs_table_name, Item=item)
        except Exception as e:
            logger.error(f"Failed to update job status for {job_id}: {e}")
    
def run_pipeline(event, context):
    """
    Prelander Generator pipeline
    
    Expected event structure:
    {
        "sales_page_url": "URL of the sales page to analyze",
        "s3_bucket": "S3 bucket to store results",
        "project_name": "Name of the project for organization",
        "content_dir": "Directory containing content files (optional, defaults to src/pipeline/content/)"
    }
    """
    try:
        logger.info("Starting Prelander Generator pipeline")
        logger.info(f"Event: {json.dumps(event)}")
        logger.info(f"Context: {context}")
        
        job_id = event.get("job_id") or os.environ.get("JOB_ID") or str(uuid.uuid4())
        # Initialize the generator
        generator = DeepCopy()
        generator.aws_request_id = getattr(context, "aws_request_id", None)
        generator.update_job_status(job_id, "RUNNING", {"message": "Job started"})
        
        # Extract parameters from event (fallback to env vars)
        sales_page_url = event.get("sales_page_url") or os.environ.get("SALES_PAGE_URL")
        s3_bucket = event.get("s3_bucket", generator.s3_bucket)
        project_name = event.get("project_name") or os.environ.get("PROJECT_NAME") or "default-project"
        generator.usage_ctx = UsageContext(
            endpoint="POST /v2/jobs",
            job_id=job_id,
            job_type="V2_JOB",
            api_version=event.get("api_version") or os.environ.get("API_VERSION") or "v2",
            project_name=project_name,
        )
        
        # Optional new parameters
        research_requirements = event.get("research_requirements")
        gender = event.get("gender")
        location = event.get("location")
        
        content_dir = "content/"
        
        if event.get("dev_mode") == "true":
            logger.info(f"Dev mode detected for job {job_id}. Using mock results.")
            try:
                # Mock source
                # mock_key = "projects/test/20251121_114946/comprehensive_results.json" #new aura
                mock_key = "results/4d46fe25-2ca1-4923-bd62-07da6ae3346b/comprehensive_results.json" #hypowered
                
                logger.info(f"Loading mock results from S3: {mock_key}")
                s3_response = generator.s3_client.get_object(Bucket=s3_bucket, Key=mock_key)
                comprehensive_data = json.loads(s3_response['Body'].read().decode('utf-8'))
                results = comprehensive_data.get("results", {})
                
                # Save as new result
                generator.save_results_to_s3(results, s3_bucket, project_name, job_id)
                
                # Update status
                generator.update_job_status(job_id, "SUCCEEDED", {"resultPrefix": f"s3://{s3_bucket}/projects/{project_name}/"})
                
                return {
                    "statusCode": 200,
                    "body": {
                        "message": "Prelander Generator pipeline completed successfully (DEV MODE)",
                        "project_name": project_name,
                        "s3_bucket": s3_bucket,
                        "job_id": job_id,
                        "dev_mode": True,
                        "results_location": f"s3://{s3_bucket}/projects/{project_name}/",
                        "job_results_location": f"s3://{s3_bucket}/results/{job_id}/",
                    }
                }
                
                
            except Exception as e:
                logger.error(f"Dev mode failed: {e}")
                generator.update_job_status(job_id, "FAILED", {"error": str(e)})
                raise e
        
        
        
        
    
        
        # Step 1: Analyze research page
        logger.info("Step 1: Analyzing research page")
        research_page_analysis = generator.analyze_research_page(sales_page_url)
        
        # Step 2: Analyze research documents
        logger.info("Step 2: Analyzing research documents")
        
        
        # Step 3: Create deep research prompt
        logger.info("Step 3: Creating deep research prompt")
        deep_research_prompt = generator.create_deep_research_prompt(
            sales_page_url, 
            research_page_analysis, 
            gender=gender,
            location=location,
            research_requirements=research_requirements
        )
        
        # Step 4: Execute deep research
        logger.info("Step 4: Executing deep research")
        deep_research_output = generator.execute_deep_research(deep_research_prompt)
        
        # Step 5: Identify and Complete avatars
        logger.info("Step 5a: Identifying avatars")
        identified_avatars = generator.identify_avatars(deep_research_output)
        
        logger.info(f"Step 5b: Completing details AND necessary beliefs for {len(identified_avatars.avatars)} avatars in parallel")
        
        # Run avatar completions AND necessary beliefs in parallel for faster processing
        def complete_avatar_with_beliefs(ia):
            """Complete both avatar details and necessary beliefs for a single avatar"""
            avatar_details = generator.complete_avatar_details(ia, deep_research_output)
            necessary_beliefs = generator.complete_necessary_beliefs_for_avatar(ia, deep_research_output)
            return {
                "identified_avatar": ia,
                "avatar_details": avatar_details,
                "necessary_beliefs": necessary_beliefs
            }
        
        avatar_results = []
        with ThreadPoolExecutor(max_workers=min(10, len(identified_avatars.avatars))) as executor:
            futures = {executor.submit(complete_avatar_with_beliefs, ia): ia for ia in identified_avatars.avatars}
            for future in as_completed(futures):
                ia = futures[future]
                try:
                    result = future.result()
                    avatar_results.append(result)
                    logger.info(f"Completed avatar details + beliefs for: {ia.name}")
                except Exception as e:
                    logger.error(f"Failed to complete avatar for {ia.name}: {e}")
                    raise
        
        # Extract full avatars and necessary beliefs per avatar
        full_avatars = [r["avatar_details"] for r in avatar_results]
        necessary_beliefs_per_avatar = {r["identified_avatar"].name: r["necessary_beliefs"] for r in avatar_results}
        
        avatar_list = AvatarList(avatars=full_avatars)
        
        # Stringify the avatar list for prompt inputs
        avatar_sheet_str = str([a.model_dump() for a in full_avatars])
        
        # Step 6: Create summary
        logger.info("Step 6: Creating summary")
        summary = generator.create_summary(
            avatar_sheet_str, deep_research_output, necessary_beliefs_per_avatar
        )
        
        logger.info("Step 7: Saving results")
        all_results = {
            "research_page_analysis": research_page_analysis,
            "deep_research_prompt": deep_research_prompt,
            "deep_research_output": deep_research_output,
            "avatars": avatar_list.model_dump(),
            "necessary_beliefs_per_avatar": necessary_beliefs_per_avatar,
            "summary": summary,
        }
        
        generator.save_results_to_s3(all_results, s3_bucket, project_name, job_id)
        
        # Return success response
        response = {
            "statusCode": 200,
            "body": {
                "message": "Prelander Generator pipeline completed successfully",
                "project_name": project_name,
                "s3_bucket": s3_bucket,
                "avatars_count": len(full_avatars),
                "results_location": f"s3://{s3_bucket}/projects/{project_name}/",
                "job_results_location": f"s3://{s3_bucket}/results/{job_id}/",
                "job_id": job_id
            }
        }
        
        logger.info("Pipeline completed successfully")
        try:
            generator.update_job_status(job_id, "SUCCEEDED", {"resultPrefix": f"s3://{s3_bucket}/projects/{project_name}/"})
        except Exception:
            pass
        return response
        
    except Exception as e:
        logger.error(f"Error in lambda_handler: {e}")
        # Attempt to mark job failed
        try:
            job_id = event.get("job_id") or os.environ.get("JOB_ID")
            DeepCopy().update_job_status(job_id, "FAILED", {"error": str(e)})
        except Exception:
            pass
        error_response = {
            "statusCode": 500,
            "body": {
                "error": str(e),
                "message": "Prelander Generator pipeline failed"
            }
        }
        return error_response


def lambda_handler(event, context):
    """
    Lambda entry point for processing AI pipeline jobs.
    
    Args:
        event: Lambda event (can be direct invocation or from API Gateway)
        context: Lambda context
        
    Returns:
        Response dict with statusCode and body
    """
    # Handle both direct invocation and API Gateway events
    if isinstance(event, dict) and "body" in event:
        # API Gateway event - parse body
        try:
            if isinstance(event["body"], str):
                event = json.loads(event["body"])
            else:
                event = event["body"]
        except json.JSONDecodeError:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "Invalid JSON body"})
            }
    
    # Run the pipeline
    result = run_pipeline(event, context)
    
    # Ensure body is JSON string if it's a dict
    if isinstance(result.get("body"), dict):
        result["body"] = json.dumps(result["body"])
    
    return result

if __name__ == "__main__":
    job_event_env = os.environ.get("JOB_EVENT_JSON")
    try:    
        event = json.loads(job_event_env)
    except Exception:
        raise Exception("Failed to load JOB_EVENT_JSON")
    

    event["dev_mode"] = "false"
    event["RESULTS_BUCKET"] = os.environ.get("RESULTS_BUCKET", "deepcopystack-resultsbucketa95a2103-zhwjflrlpfih")
    event["s3_bucket"] = os.environ.get("s3_bucket", event["RESULTS_BUCKET"])
    event["project_name"] = os.environ.get("project_name", "test")
    event["content_dir"] = os.environ.get("content_dir", "content/")
    # event["customer_avatars"] = os.environ.get("customer_avatars", [])
    event["sales_page_url"] = os.environ.get("sales_page_url", "https://naxir.co/products/steadystrap")
    
    # Inject jobId and result prefix
    event["job_id"] = os.environ.get("JOB_ID") or event.get("job_id") or str(uuid.uuid4())
    result = run_pipeline(event, None)
    test = 1
