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
import boto3
import sys
import logging
from datetime import datetime, timezone
import uuid
import anthropic

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional, Literal, Any, Dict, Union
from pydantic import BaseModel, Field, ConfigDict, create_model

from playwright.sync_api import sync_playwright


from data_models import Avatar, OfferBrief

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
        self.anthropic_client = anthropic.Anthropic(api_key=self.secrets["ANTHROPIC_API_KEY"])
        aws_region = os.environ.get('AWS_REGION') or os.environ.get('AWS_DEFAULT_REGION') or 'eu-west-1'
        self.s3_client = boto3.client('s3', region_name=aws_region)
        # Get bucket from environment or use default
        self.s3_bucket = os.environ.get('RESULTS_BUCKET', "deepcopystack-resultsbucketa95a2103-zhwjflrlpfih")
        # Optional DynamoDB for job status updates
        self.ddb_client = boto3.client('dynamodb', region_name=aws_region)
        self.jobs_table_name = os.environ.get('JOBS_TABLE_NAME', "DeepCopyStack-JobsTable1970BC16-1BVYVOHK8WXTU")
        
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
    
    def analyze_research_page(self, sales_page_url, customer_avatars):
        """Analyze the sales page using GPT-5 Vision
        
        Args:
            sales_page_url: URL of the sales page to analyze
            customer_avatars: List of dicts with CustomerAvatar fields (persona_name, characteristics, description, age_range, gender, key_buying_motivation, pain_point, emotion, desire, objections, failed_alternatives, is_broad_avatar)
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
            
            # Format avatars for the prompt
            def format_avatar(avatar, index):
                lines = [f"Avatar {index+1}: {avatar.get('persona_name', 'Unnamed')}"]
                
                if avatar.get('is_broad_avatar'):
                    lines.append("- Type: Broad Avatar (represents overall customer base)")
                
                if avatar.get('characteristics'):
                    lines.append(f"- Characteristics: {', '.join(avatar['characteristics'])}")
                
                if avatar.get('description'):
                    lines.append(f"- Description: {avatar['description']}")
                
                if avatar.get('age_range'):
                    lines.append(f"- Age Range: {avatar['age_range']}")
                
                if avatar.get('gender'):
                    lines.append(f"- Gender: {avatar['gender']}")
                
                if avatar.get('key_buying_motivation'):
                    lines.append(f"- Key Buying Motivation: {avatar['key_buying_motivation']}")
                
                if avatar.get('pain_point'):
                    lines.append(f"- Pain Point: {avatar['pain_point']}")
                
                if avatar.get('emotion'):
                    lines.append(f"- Emotion: {avatar['emotion']}")
                
                if avatar.get('desire'):
                    lines.append(f"- Desire: {avatar['desire']}")
                
                if avatar.get('objections'):
                    objections_str = '\n  '.join(f"• {obj}" for obj in avatar['objections'])
                    lines.append(f"- Objections:\n  {objections_str}")
                
                if avatar.get('failed_alternatives'):
                    alternatives_str = '\n  '.join(f"• {alt}" for alt in avatar['failed_alternatives'])
                    lines.append(f"- Failed Alternatives:\n  {alternatives_str}")
                
                return '\n'.join(lines)
            
            avatars_description = "\n\n".join([
                format_avatar(avatar, i)
                for i, avatar in enumerate(customer_avatars)
            ]) if customer_avatars else "No customer avatars provided"
            
            prompt = f"""
            You are my expert copywriter and you specialise in writing highly persuasive direct response style copy for my companies.
            
            I'm targeting the following customer avatars (if any):
            {avatars_description if customer_avatars else "No customer avatars provided"}
            
            I've attached my current sales page.    

            Analyze this page and please let me know your thoughts on how it appeals to these different customer segments.
            """
            
            logger.info("Calling GPT-5 Vision API for research page analysis")
            content_payload = [{"type": "input_text", "text": prompt}, {"type": "input_image", "image_url": f"data:image/jpeg;base64,{base64_image}"}]
            
            response = self.client.responses.create(
                model=self.openai_model,
                input=[{"role": "user", "content": content_payload}]
            )
            logger.info("GPT-5 Vision API call completed for research page analysis")
            return response.output_text
            
        except Exception as e:
            logger.error(f"Error analyzing research page: {e}")
            raise
    
    def analyze_research_document(self, doc_path, doc_name):
        """Analyze a research document"""
        try:
            with open(doc_path, "r", encoding="utf-8") as f:
                content = f.read()
            
            prompt = f"""
            Please analyze this research document and provide a summary of the key insights for conducting market research:\n\n{content}
            """
            
            logger.info(f"Calling GPT-5 API for research document analysis: {doc_name}")
            response = self.client.responses.create(
                model=self.openai_model,
                input=[{
                    "role": "user", 
                    "content": [{"type": "input_text", "text": prompt}]
                }]
            )
            logger.info(f"GPT-5 API call completed for research document analysis: {doc_name}")
            
            return response.output_text
            
        except Exception as e:
            logger.error(f"Error analyzing research document {doc_name}: {e}")
            raise
    
    def create_deep_research_prompt(self, sales_page_url, research_page_analysis, doc1_analysis, doc2_analysis, avatar):
        """Create a comprehensive research prompt"""
        try:
            prompt = f"""
            Now that you understand how to conduct research, create a full, best-practice prompt for Deep Research tool to research products from {sales_page_url} according to the sections below. 
            Please only return the actual prompt that directly can be used in the Deep Research tool, no other text or return questions.
            Do not ask to add any appendices, everything should be text and in a single document.
            
            Please ensure that the deep research prompt is tailored to the following avatar:
            {avatar}

            Research Page analysis:
            {research_page_analysis}

            Research doc1 analysis:
            {doc1_analysis}

            Research doc2 analysis:
            {doc2_analysis}
            """
            
            logger.info("Calling GPT-5 API to create deep research prompt")
            response = self.client.responses.create(
                model=self.openai_model,
                input=[{
                    "role": "user", 
                    "content": [{"type": "input_text", "text": prompt}]
                }]
            )
            logger.info("GPT-5 API call completed for deep research prompt creation")
            
            return response.output_text
            
        except Exception as e:
            logger.error(f"Error creating deep research prompt: {e}")
            raise
    
    def execute_deep_research(self, prompt):
        """Execute deep research using Perplexity API"""
        try:
            model_name = "sonar-deep-research"
            api_key = self.secrets["PERPLEXITY_API_KEY"]
            if not api_key:
                raise RuntimeError("PERPLEXITY_API_KEY not set in environment")

            url = "https://api.perplexity.ai/chat/completions"
            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": model_name,
                "messages": [
                    {"role": "system", "content": "You are a world-class research assistant. Please execute the research prompt below and adhere to the instructions provided."},
                    {"role": "user", "content": prompt},
                ],
            }
            
            logger.info("Calling Perplexity API for deep research execution")
            resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=1000)
            resp.raise_for_status()
            data = resp.json()
            logger.info("Perplexity API call completed for deep research execution")
            
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return content or json.dumps(data)
            
        except Exception as e:
            logger.error(f"Error executing deep research: {e}")
            raise
    
    def complete_avatar_sheet(self, deep_research_output):
        """Complete the avatar sheet using the research output"""
        try:
            
            prompt = f"""
            Amazing work! Now that you have properly completed the research portion, I want you to please complete the Avatar sheet template using the deep research output:
            
            Deep research output:
            {deep_research_output}
            """

            logger.info("Calling GPT-5 API to complete avatar sheet")
            response = self.client.responses.parse(
                model=self.openai_model,
                input=[{
                    "role": "user", 
                    "content": [{"type": "input_text", "text": prompt}]
                }],
                text_format=Avatar,
            )
            logger.info("GPT-5 API call completed for avatar sheet completion")
            
            return response.output_parsed, response.output_text
            
        except Exception as e:
            logger.error(f"Error completing avatar sheet: {e}")
            raise
    
    def complete_offer_brief(self, deep_research_output):
        """Complete the offer brief using the research output"""
        try:
            prompt = f"""
            Amazing work! Now that you have properly completed the research portion, I want you to please complete this Offer brief template using the deep research output:
            
            Deep research output:
            {deep_research_output}
            """

            logger.info("Calling GPT-5 API to complete offer brief")
            response = self.client.responses.parse(
                model=self.openai_model,
                input=[{
                    "role": "user", 
                    "content": [{"type": "input_text", "text": prompt}]
                }],
                text_format=OfferBrief,
            )
            logger.info("GPT-5 API call completed for offer brief completion")
            
            return response.output_parsed, response.output_text
            
        except Exception as e:
            logger.error(f"Error completing offer brief: {e}")
            raise
    
    def analyze_marketing_philosophy(self, avatar_sheet, offer_brief, deep_research_output):
        """Analyze marketing philosophy and extract core beliefs"""
        try:
            # Note: This file path won't exist in Lambda, so this function may need adjustment
            # For now, we'll skip it or load from S3 if needed
            marketing_philosophy = ""  # Placeholder - would need to load from S3 or include in Lambda package
            
            prompt = f"""
            Great work! Now that you understand that marketing at his core is simply about changing the existing beliefs of a customer into the belief that align with them empowering them to purchase our product, 
            I want you to please analyze the following documents about my prospect and write out the few absolutely necessary, beliefs that a prospect must have before purchasing my product. 
            It should be no more than 6 beliefs. I also want you to structure these as "I believe that…" statements.
            
            Marketing philosophy:
            {marketing_philosophy}
            
            Avatar sheet:
            {avatar_sheet}
            
            Offer brief:
            {offer_brief}
            
            Deep research output:
            {deep_research_output}
            """

            logger.info("Calling GPT-5 API to analyze marketing philosophy")
            response = self.client.responses.create(
                model=self.openai_model,
                input=[{
                    "role": "user", 
                    "content": [{"type": "input_text", "text": prompt}]
                }]
            )
            logger.info("GPT-5 API call completed for marketing philosophy analysis")
            
            return response.output_text
            
        except Exception as e:
            logger.error(f"Error analyzing marketing philosophy: {e}")
            raise
    
    def create_summary(self, avatar_sheet, offer_brief, deep_research_output, marketing_philosophy):
        """Create a summary of all outputs"""
        try:
            prompt = f"""
            Great work! Please summarize the following outputs in a way that is easy to understand and use for a copywriter:
            
            Avatar sheet:
            {avatar_sheet}
            
            Offer brief:
            {offer_brief}
            
            Deep research output:
            {deep_research_output}
            
            Marketing philosophy:
            {marketing_philosophy}
            """
            
            logger.info("Calling GPT-5 API to create summary")
            response = self.client.responses.create(
                model=self.openai_model,
                input=[{
                    "role": "user", 
                    "content": [{"type": "input_text", "text": prompt}]
                }]
            )
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
        generator.update_job_status(job_id, "RUNNING", {"message": "Job started"})
        
        # Extract parameters from event (fallback to env vars)
        sales_page_url = event.get("sales_page_url") or os.environ.get("SALES_PAGE_URL")
        s3_bucket = event.get("s3_bucket", generator.s3_bucket)
        project_name = event.get("project_name") or os.environ.get("PROJECT_NAME") or "default-project"
        customer_avatars = event.get("customer_avatars", [])
        
        content_dir = "content/"
        
        if event.get("dev_mode"):
            logger.info(f"Dev mode detected for job {job_id}. Using mock results.")
            try:
                # Mock source
                # mock_key = "projects/test/20251121_114946/comprehensive_results.json" #new aura
                mock_key = "results/a34fd6f2-b0aa-4369-82a4-51eb4f60d03b/comprehensive_results.json" #hypowered
                
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
        
        
        
        
        # TEMP code:
        # Load pre-computed results from S3 comprehensive_results JSON file
        # Default S3 path: s3://deepcopystack-resultsbucketa95a2103-zhwjflrlpfih/projects/test/20251121_114946/comprehensive_results.json
        # bucket = os.environ.get("RESULTS_BUCKET", "deepcopystack-resultsbucketa95a2103-zhwjflrlpfih")
        # s3_results_key = "projects/test/20251121_114946/comprehensive_results.json"
        # logger.info(f"Loading pre-computed results from S3: {s3_results_key}")
        
        # # Download file from S3
        # try:
        #     s3_response = generator.s3_client.get_object(Bucket=bucket, Key=s3_results_key)
        #     comprehensive_data = json.loads(s3_response['Body'].read().decode('utf-8'))
        #     results = comprehensive_data.get("results", {})
        #     logger.info(f"Successfully loaded results from S3: {bucket}/{s3_results_key}")
        # except Exception as e:
        #     logger.error(f"Failed to load results from S3 {bucket}/{s3_results_key}: {e}")
        #     raise
        
        # Extract all variables from the JSON
        # research_page_analysis = results.get("research_page_analysis")
        # doc1_analysis = results.get("doc1_analysis")
        # doc2_analysis = results.get("doc2_analysis")
        # deep_research_prompt = results.get("deep_research_prompt")
        # deep_research_output = results.get("deep_research_output")
        # avatar_sheet = results.get("avatar_sheet")
        # offer_brief = results.get("offer_brief")
        # marketing_philosophy_analysis = results.get("marketing_philosophy_analysis")
        # summary = results.get("summary")
        # angles = results.get("marketing_angles", [])
        # customer_avatars = results.get("customer_avatars", [])
        
        # Step 1: Analyze research page
        logger.info("Step 1: Analyzing research page")
        research_page_analysis = generator.analyze_research_page(sales_page_url, customer_avatars)
        
        # Step 2: Analyze research documents
        logger.info("Step 2: Analyzing research documents")
        
        
        doc1_analysis = open(f"{content_dir}doc1_analysis.txt", "r").read()
        doc2_analysis = open(f"{content_dir}doc2_analysis.txt", "r").read()

        
        # Step 3: Create deep research prompt
        logger.info("Step 3: Creating deep research prompt")
        deep_research_prompt = generator.create_deep_research_prompt(
            sales_page_url, research_page_analysis, doc1_analysis, doc2_analysis, customer_avatars
        )
        
        # Step 4: Execute deep research
        logger.info("Step 4: Executing deep research")
        deep_research_output = generator.execute_deep_research(deep_research_prompt)
        
        # Step 5: Complete avatar sheet
        logger.info("Step 5: Completing avatar sheet")
        avatar_parsed, avatar_sheet = generator.complete_avatar_sheet(deep_research_output)
        angles = avatar_parsed.marketing_angles
        
        # Step 6: Complete offer brief
        logger.info("Step 6: Completing offer brief")
        offer_brief_parsed, offer_brief = generator.complete_offer_brief(deep_research_output)
        
        # Step 7: Analyze marketing philosophy
        logger.info("Step 7: Analyzing marketing philosophy")
        marketing_philosophy_analysis = generator.analyze_marketing_philosophy(
            avatar_sheet, offer_brief, deep_research_output
        )
        
        # Step 8: Create summary
        logger.info("Step 8: Creating summary")
        summary = generator.create_summary(
            avatar_sheet, offer_brief, deep_research_output, marketing_philosophy_analysis
        )
    
        
        logger.info("Step 10: Saving results")
        all_results = {
            "research_page_analysis": research_page_analysis,
            "doc1_analysis": doc1_analysis,
            "doc2_analysis": doc2_analysis,
            "deep_research_prompt": deep_research_prompt,
            "deep_research_output": deep_research_output,
            "avatar_sheet": avatar_sheet,
            "offer_brief": offer_brief.model_dump() if hasattr(offer_brief, 'model_dump') else offer_brief,
            "marketing_philosophy_analysis": marketing_philosophy_analysis,
            "summary": summary,
            "marketing_angles": [angle.model_dump() if hasattr(angle, 'model_dump') else angle for angle in angles],
            "customer_avatars": customer_avatars,
        }
        
        generator.save_results_to_s3(all_results, s3_bucket, project_name, job_id)
        
        # Return success response
        response = {
            "statusCode": 200,
            "body": {
                "message": "Prelander Generator pipeline completed successfully",
                "project_name": project_name,
                "s3_bucket": s3_bucket,
                "marketing_angles_count": len(angles),
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
    

    event["dev_mode"] = "true"
    event["RESULTS_BUCKET"] = os.environ.get("RESULTS_BUCKET", "deepcopystack-resultsbucketa95a2103-zhwjflrlpfih")
    event["s3_bucket"] = os.environ.get("s3_bucket", event["RESULTS_BUCKET"])
    event["project_name"] = os.environ.get("project_name", "test")
    event["content_dir"] = os.environ.get("content_dir", "content/")
    event["customer_avatars"] = os.environ.get("customer_avatars", [])
    event["sales_page_url"] = os.environ.get("sales_page_url", "https://naxir.co/products/steadystrap")
    
    # Inject jobId and result prefix
    event["job_id"] = os.environ.get("JOB_ID") or event.get("job_id") or str(uuid.uuid4())
    result = run_pipeline(event, None)
