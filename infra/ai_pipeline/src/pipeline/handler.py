import json
import os
import base64
import requests
from botocore.exceptions import ClientError
from openai import OpenAI
import boto3
import sys
import logging
from datetime import datetime, timezone
import uuid

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional, Literal, Any, Dict, Union
from pydantic import BaseModel, Field, ConfigDict, create_model


from playwright.sync_api import sync_playwright

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

class Demographics(BaseModel):
    """Demographic & general information about the avatar."""
    age_range: Optional[int] = Field(
        None, description="Inclusive min/max age in years, e.g. (28, 45)."
    )
    gender: Optional[List[str]] = Field(
        None, description="Gender distribution labels, e.g. ['male', 'female', 'non-binary']."
    )
    locations: Optional[List[str]] = Field(
        None, description="Primary regions/countries where the segment is concentrated."
    )
    monthly_revenue: Optional[int] = Field(
        None, description="Typical monthly revenue range (min, max) in your chosen currency."
    )
    professional_backgrounds: List[str] = Field(
        default_factory=list, description="Typical professional backgrounds (e.g., 'founder', 'marketing lead')."
    )
    typical_identities: List[str] = Field(
        default_factory=list, description="Typical identities/lifestyles/roles (e.g., 'bootstrapped founder')."
    )

class PainPointGroup(BaseModel):
    """A themed set of related challenges/concerns."""
    title: str = Field(..., description="Name of the pain point theme, e.g., 'Lead Generation'.")
    bullets: List[str] = Field(
        ..., min_items=1, description="Concrete challenges/concerns under this theme."
    )

class Goals(BaseModel):
    """Outcomes the avatar wants."""
    short_term: List[str] = Field(
        default_factory=list, description="Short-term goals (weeks/months)."
    )
    long_term: List[str] = Field(
        default_factory=list, description="Long-term aspirations (quarters/years)."
    )

class Quotes(BaseModel):
    """Verbatim quotes used for messaging and copy."""
    general_client: List[str] = Field(
        default_factory=list, description='General direct client quotes, e.g., "I just need consistent leads."'
    )
    pain_frustrations: List[str] = Field(
        default_factory=list, description='Quotes that express pains/frustrations.'
    )
    mindset: List[str] = Field(
        default_factory=list, description='Quotes that capture mindset, e.g., principles or mottos.'
    )
    emotional_state_drivers: List[str] = Field(
        default_factory=list, description='Quotes about emotional state/personal drivers.'
    )

class EmotionalJourney(BaseModel):
    """Narrative progression through the buying journey."""
    awareness: str = Field(..., description="Initial awareness stage (problem/status quo).")
    frustration: str = Field(..., description="Frustration stage (failed attempts/costs of inaction).")
    seeking_solutions: str = Field(..., description="Desperation & seeking solutions stage (research/criteria).")
    relief_commitment: str = Field(..., description="Relief & commitment stage (decision/outcome).")

class Avatar(BaseModel):
    """
    Marketing Avatar sheet for product–market fit & messaging research.
    Use this to standardize ICP/persona data for campaigns, ads, and positioning.
    """
    model_config = ConfigDict(
        title="Marketing Avatar",
        description="Structured avatar sheet capturing demographics, pains, goals, psychology, quotes, journey, and angles.",
        extra="forbid",
    )

    demographics: Demographics = Field(..., description="Demographic & general information.")
    pain_points: List[PainPointGroup] = Field(
        ..., min_items=1, description="List of pain point themes, each with concrete challenges."
    )
    goals: Goals = Field(..., description="Short-term goals and long-term aspirations.")
    emotional_drivers: List[str] = Field(
        default_factory=list, description="Emotional drivers & psychological insights."
    )
    quotes: Quotes = Field(..., description="Verbatim quotes for copy and creative.")
    emotional_journey: EmotionalJourney = Field(
        ..., description="Typical emotional journey from awareness to commitment."
    )
    marketing_angles: List[str] = Field(
        default_factory=list, description="Main marketing angles to test or use."
    )


def save_fullpage_png(url: str, out_file: str = "page.png"):
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
        page.goto(url, wait_until="networkidle")

        # Take a full-page screenshot
        page.screenshot(path=out_file, full_page=True)

        logger.info(f"Saved full-page screenshot to {out_file}")

        page.close()
        context.close()
        return out_file
    
    
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
        # Resolve secret id/name/arn and region from environment for ECS flexibility
        env = os.environ.get('ENVIRONMENT', 'dev')
        secret_id = "deepcopy-secret-dev"
        self.openai_model = "gpt-5-mini"
        self.secrets = self.get_secrets(secret_id)
        self.client = OpenAI(api_key=self.secrets["OPENAI_API_KEY"]) 
        aws_region = os.environ.get('AWS_REGION') or os.environ.get('AWS_DEFAULT_REGION') or 'eu-west-1'
        self.s3_client = boto3.client('s3', region_name=aws_region)
        self.s3_bucket = "deepcopystack-resultsbucketa95a2103-zhwjflrlpfih"
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
        
    def encode_image(self, image_path):
        """Encode image to base64"""
        try:
            with open(image_path, "rb") as image_file:
                return base64.b64encode(image_file.read()).decode("utf-8")
        except Exception as e:
            logger.error(f"Error encoding image: {e}")
            raise
    
    def analyze_research_page(self, sales_page_url, customer_avatars):
        """Analyze the sales page using GPT-5 Vision
        
        Args:
            sales_page_url: URL of the sales page to analyze
            customer_avatars: List of dicts with keys: persona_name, description, age_range, gender, key_buying_motivation
        """
        try:
            base64_image = None
            logger.info(f"Capturing page: {sales_page_url}")
            try:
                image_path = save_fullpage_png(sales_page_url)
                logger.info(f"Image captured at: {image_path}")
                base64_image = self.encode_image(image_path)
            except Exception as e:
                logger.error(f"Failed to capture or encode image from {sales_page_url}: {e}")
                raise
            finally:
                # Clean up the image file if it was created
                try:
                    if 'image_path' in locals() and image_path and os.path.exists(image_path):
                        os.remove(image_path)
                except Exception as cleanup_exc:
                    logger.warning(f"Failed to clean up image file {image_path}: {cleanup_exc}")
            
            # Format avatars for the prompt
            avatars_description = "\n\n".join([
                f"Avatar {i+1}: {avatar['persona_name']}\n"
                f"- Description: {avatar['description']}\n"
                f"- Age Range: {avatar['age_range']}\n"
                f"- Gender: {avatar['gender']}\n"
                f"- Key Buying Motivation: {avatar['key_buying_motivation']}"
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
    
    def create_deep_research_prompt(self, sales_page_url, research_page_analysis, doc1_analysis, doc2_analysis):
        """Create a comprehensive research prompt"""
        try:
            prompt = f"""
            Now that you understand how to conduct research, create a full, best-practice prompt for Deep Research tool to research products from {sales_page_url} according to the sections below. 
            Please only return the actual prompt that directly can be used in the Deep Research tool, no other text or return questions.
            Do not ask to add any appendices, everything should be text and in a single document.

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
            with open("src/pipeline/content/offer_brief_template.txt", "r", encoding="utf-8") as f:
                offer_brief_template = f.read()
            
            prompt = f"""
            Amazing work! Now that you have properly completed the research portion, I want you to please complete this Offer brief template using the deep research output:
            
            Offer brief template:
            {offer_brief_template}
            
            Deep research output:
            {deep_research_output}
            """

            logger.info("Calling GPT-5 API to complete offer brief")
            response = self.client.responses.create(
                model=self.openai_model,
                input=[{
                    "role": "user", 
                    "content": [{"type": "input_text", "text": prompt}]
                }]
            )
            logger.info("GPT-5 API call completed for offer brief completion")
            
            return response.output_text
            
        except Exception as e:
            logger.error(f"Error completing offer brief: {e}")
            raise
    
    def analyze_marketing_philosophy(self, avatar_sheet, offer_brief, deep_research_output):
        """Analyze marketing philosophy and extract core beliefs"""
        try:
            with open("src/pipeline/content/marketing_philosophy.txt", "r", encoding="utf-8") as f:
                marketing_philosophy = f.read()
            
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
        
    def analyze_swipe_file(self, swipe_file_html, advertorial_type: Literal["Advertorial", "Listicle"]):
        """Analyze the swipe file"""
        try:
            prompt = f"""
            Please analyze the following swipe file and provide a detailed analysis of the content and style used in this marketing document: {advertorial_type}:
            
            This analysis should be very detailed and should be used to rewrite different swipe files with the same style and tone.
            
            Swipe file HTML:
            {swipe_file_html}
            """
            
            response = self.client.responses.create(
                model="gpt-5",
                input=[{
                    "role": "user", 
                    "content": [{"type": "input_text", "text": prompt}]
                }]
            )            
            return response.output_text
        except Exception as e:
            logger.error(f"Error analyzing swipe file: {e}")
            raise
    
    def rewrite_swipe_files(self, angles, avatar_sheet, summary, swipe_file_analysis, swipe_file_html, advertorial_type: Literal["Advertorial", "Listicle"], model: BaseModel):
        """Rewrite swipe files for each marketing angle"""
        try:

            
            def _rewrite_for_angle(angle: str):
                prompt = f"""
                Great, now I want you to please rewrite this {advertorial_type} but using all of the information around products stated below. 
                I want you to specifically focus on the first marketing angle from the avatar sheet: {angle}. 
                Please rewrite the {advertorial_type} with the new content, adhere to the style and tone used in the swipe file analysis and original swipe file html and output it in provided format. 
                
                For example:
                if the original swipe file has a title that includes: "12 reasons why...", you should rewrite the {advertorial_type} title in the same format.
                
                            
                Avatar sheet:
                {avatar_sheet}
                
                Content for the {advertorial_type}:
                {summary}
                
                Swipe file analysis:
                {swipe_file_analysis}
                
                Original swipe file html:
                {swipe_file_html}
                
                """

                logger.info(f"Calling GPT-5 API to rewrite swipe file for angle: {angle}")
                
                try:
                    response = self.client.responses.parse(
                        model="gpt-5",
                        input=[{
                            "role": "user", 
                            "content": [{"type": "input_text", "text": prompt}]
                        }],
                        text_format=model,
                    )
                    logger.info(f"GPT-5 API call completed for swipe file rewrite (angle: {angle})")
                    return {"angle": angle, "content": response.output_text}
                except Exception as e:
                    logger.error(f"Error in GPT-5 API call for swipe file rewrite (angle: {angle}): {e}")
                    return {}

            # Run API calls in parallel while preserving the original order
            results_by_index = [None] * len(angles)
            if not angles:
                return results_by_index

            max_workers = min(1, len(angles))
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                future_to_index = {}
                for idx, angle in enumerate(angles):
                    future = executor.submit(_rewrite_for_angle, angle)
                    future_to_index[future] = idx
                for future in as_completed(future_to_index):
                    idx = future_to_index[future]
                    # Propagate exceptions if any to maintain previous failure semantics
                    results_by_index[idx] = future.result()
                    
            # If all results are empty dictionaries, raise an error
            if all(result == {} for result in results_by_index):
                raise Exception("All swipe file rewrites failed")

            return results_by_index
            
        except Exception as e:
            logger.error(f"Error rewriting swipe files: {e}")
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
    
    def get_available_swipe_files(self, s3_bucket: str) -> List[str]:
        """Get list of available swipe files from S3 content_library folder.
        
        Args:
            s3_bucket: The S3 bucket name
            
        Returns:
            Sorted list of unique swipe file base names (without extensions)
        """
        try:
            html_files = set()
            json_files = set()
            paginator = self.s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=s3_bucket, Prefix='content_library/')
            
            for page in pages:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        key = obj['Key']
                        # Extract filename from key (e.g., "content_library/file_name.json")
                        filename = key.split('/')[-1]
                        # Remove file extensions to get unique base names
                        if filename.endswith('_original.html'):
                            base_name = filename.replace('_original.html', '')
                            html_files.add(base_name)
                        elif filename.endswith('_orginal.html'):  # Handle typo in filename
                            base_name = filename.replace('_orginal.html', '')
                            html_files.add(base_name)
                        elif filename.endswith('.json') and not filename.endswith('_analysis.json'):
                            base_name = filename.replace('.json', '')
                            json_files.add(base_name)
            
            # Only return files that have BOTH HTML and JSON files
            available_files = html_files.intersection(json_files)
            return sorted(list(available_files))
        except Exception as e:
            logger.error(f"Error listing available swipe files from S3: {e}")
            return []

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
        # Mark job running if Jobs table configured
        try:
            generator.update_job_status(job_id, "RUNNING", {"message": "Job started"})
        except Exception:
            pass
        
        # Extract parameters from event (fallback to env vars)
        sales_page_url = event.get("sales_page_url") or os.environ.get("SALES_PAGE_URL")
        s3_bucket = event.get("s3_bucket", generator.s3_bucket)
        project_name = event.get("project_name") or os.environ.get("PROJECT_NAME") or "default-project"
        swipe_file_id = event.get("swipe_file_id") or os.environ.get("SWIPE_FILE_ID")
        advertorial_type = event.get("advertorial_type")
        persona = event.get("persona")
        age_range = event.get("age_range")
        gender = event.get("gender")
        content_dir = event.get("content_dir", "src/pipeline/content/")
        logger.info(
            f"Pipeline inputs: project_name={project_name}, sales_page_url={sales_page_url}, "
            f"swipe_file_id={swipe_file_id}, content_dir={content_dir}"
        )

        # Require swipe_file_id when not provided return 400
        if not swipe_file_id:
            error_msg = "Missing required input: swipe_file_id"
            logger.error(error_msg)
            try:
                generator.update_job_status(job_id, "FAILED", {"error": error_msg})
            except Exception:
                pass
            return {
                "statusCode": 400,
                "body": {"error": error_msg}
            }

        try:
            # load both the html as the json file
            # Try both spellings: "original" and "orginal" (typo in some files)
            s3_key_html_correct = f"content_library/{swipe_file_id}_original.html"
            s3_key_json = f"content_library/{swipe_file_id}.json"
            
            # Try the correct spelling first, then the typo
            obj_html = generator.s3_client.get_object(Bucket=s3_bucket, Key=s3_key_html_correct)
            
            html_bytes = obj_html["Body"].read()
            swipe_file_html = html_bytes.decode("utf-8")
            
            obj_json = generator.s3_client.get_object(Bucket=s3_bucket, Key=s3_key_json)
            json_bytes = obj_json["Body"].read()
            json_text = json_bytes.decode("utf-8")
            swipe_file_model = load_schema_as_model(json_text)
            
        except Exception as e:
            # Check if it's a file not found error (NoSuchKey)
            if hasattr(e, 'response') and e.response.get('Error', {}).get('Code') == 'NoSuchKey':
                # Get list of available swipe files from S3
                available_files_list = generator.get_available_swipe_files(s3_bucket)
                
                if available_files_list:
                    error_msg = (
                        f"Error: The swipe file '{swipe_file_id}' is not available in the library. "
                        f"Available swipe files: {', '.join(available_files_list)}. "
                        f"Please select one of the available files."
                    )
                else:
                    error_msg = (
                        f"Error: The swipe file '{swipe_file_id}' is not available in the library. "
                        f"No swipe files found in content_library folder."
                    )
                
                logger.error(error_msg)
                try:
                    generator.update_job_status(job_id, "FAILED", {"error": error_msg})
                except Exception:
                    pass
                return {
                    "statusCode": 404,
                    "body": {
                        "error": error_msg,
                        "available_files": available_files_list
                    }
                }
            else:
                # It's a different error (JSON parsing, schema validation, etc.)
                error_msg = f"Error loading swipe file '{swipe_file_id}': {str(e)}"
                logger.error(error_msg)
                try:
                    generator.update_job_status(job_id, "FAILED", {"error": error_msg})
                except Exception:
                    pass
                return {
                    "statusCode": 500,
                    "body": {
                        "error": error_msg,
                        "message": "Failed to load or parse swipe file"
                    }
                }
        # Get customer avatars from event
        customer_avatars = event.get("customer_avatars", [])
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
            sales_page_url, research_page_analysis, doc1_analysis, doc2_analysis
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
        offer_brief = generator.complete_offer_brief(deep_research_output)
        
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
        
        
        # Step 9: Analyse the swipe file
        logger.info("Step 9: Analyzing swipe file")
        swipe_file_analysis = generator.analyze_swipe_file(swipe_file_html, advertorial_type)
        
        # Step 10: Rewrite swipe files
        logger.info("Step 9: Rewriting swipe files")
        
        
        swipe_results = generator.rewrite_swipe_files(
            angles, avatar_sheet, summary, swipe_file_analysis, swipe_file_html, advertorial_type, swipe_file_model
        )
        
        # Step 10: Save all results
        logger.info("Step 10: Saving results")
        all_results = {
            "research_page_analysis": research_page_analysis,
            "doc1_analysis": doc1_analysis,
            "doc2_analysis": doc2_analysis,
            "deep_research_prompt": deep_research_prompt,
            "deep_research_output": deep_research_output,
            "avatar_sheet": avatar_sheet,
            "offer_brief": offer_brief,
            "marketing_philosophy_analysis": marketing_philosophy_analysis,
            "summary": summary,
            "swipe_file_id": swipe_file_id,
            "swipe_results": swipe_results,
            "marketing_angles": angles
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
                "swipe_files_generated": len(swipe_results),
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

if __name__ == "__main__":
    # Allow ECS task to pass inputs via env var JOB_EVENT_JSON and JOB_ID
    job_event_env = os.environ.get("JOB_EVENT_JSON")
    try:    
        event = json.loads(job_event_env)
    except Exception:
        raise Exception("Failed to load JOB_EVENT_JSON")
    # Inject jobId and result prefix
    event["job_id"] = os.environ.get("JOB_ID") or event.get("job_id") or str(uuid.uuid4())
    result = run_pipeline(event, None)
    
