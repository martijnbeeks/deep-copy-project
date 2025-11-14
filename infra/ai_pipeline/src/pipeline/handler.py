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
import anthropic

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Optional, Literal, Any, Dict, Union
from pydantic import BaseModel, Field, ConfigDict, create_model


from playwright.sync_api import sync_playwright
from pipeline.test_anthropic import (
    make_streaming_request_with_retry,
    make_structured_request_with_retry,
    prepare_schema_for_tool_use,
    load_pdf_file,
)

from pipeline.data_models import Avatar, OfferBrief

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
        self.anthropic_client = anthropic.Anthropic(api_key=self.secrets["ANTHROPIC_API_KEY"])
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
    
    def create_deep_research_prompt(self, sales_page_url, research_page_analysis, doc1_analysis, doc2_analysis, avatar):
        """Create a comprehensive research prompt"""
        try:
            prompt = f"""
            Now that you understand how to conduct research, create a full, best-practice prompt for Deep Research tool to research products from {sales_page_url} according to the sections below. 
            Please only return the actual prompt that directly can be used in the Deep Research tool, no other text or return questions.
            Do not ask to add any appendices, everything should be text and in a single document.
            
            Avatar:
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
    
    def rewrite_swipe_file(
        self,
        angle: str,
        avatar_sheet: str,
        deep_research_output: str,
        offer_brief: str,
        necessary_beliefs: str,
        schema_json: str,
        original_swipe_file_path_html: str    ):  
        # Model configuration
        MODEL = "claude-haiku-4-5-20251001"
        MAX_TOKENS = 10000
        
        # Extract clean text from HTML swipe file
        raw_swipe_file_text = extract_clean_text_from_html(original_swipe_file_path_html)
        
        # Build messages list manually - we'll append to this for each turn
        messages: List[Dict[str, Any]] = []
        
        # ============================================================
        # Turn 1: Familiarize with documents
        # ============================================================
        logger.info("Turn 1: Familiarizing with documents")
        field_prompt = f"""Hey, Claude, I want you to please analyze the four documents that I've attached to this message. I've done a significant amount of research of a product that I'm going to be selling, and it's your role as my direct response copywriter to understand this research, the avatar document, the offer brief, and the necessary beliefs document to an extremely high degree. So please familiarize yourself with these documents before we proceed with writing anything.
        """
        system_prompt = [{
                "type": "text",
                "text": f"""
                Docs:
                {avatar_sheet}
                {deep_research_output}
                {offer_brief}
                {necessary_beliefs}
                """,
                "cache_control": {"type": "ephemeral"}
        }]
        
        # Add first user message
        messages.append({
            "role": "user",
            "content": field_prompt
        })
        
        # Get first response using streaming
        first_response_text, first_usage = make_streaming_request_with_retry(
            messages=messages,
            max_tokens=MAX_TOKENS,
            model=MODEL,
            anthropic_client=self.anthropic_client,
            system_prompt=system_prompt
        )
        
        # Add assistant response to messages
        messages.append({
            "role": "assistant",
            "content": first_response_text
        })
        
        logger.info(f"Turn 1 completed. Response length: {len(first_response_text)} chars")
        logger.info(f"Turn 1 usage: {first_usage}")
        
        # ============================================================
        # Turn 2: Analyze competitor advertorial with PDF
        # ============================================================
        logger.info("Turn 2: Analyzing competitor advertorial with PDF")
        generate_content_prompt = f"""Excellent work. Now we're going to be writing an advertorial, which is a type of pre-sales page designed to nurture customers before they actually see the main product offer page. I'm going to send you an indirect competitor with a very successful advertorial, and I want you to please analyze this advertorial and let me know your thoughts
        Raw text from the pdf advertorial:
        {raw_swipe_file_text}
        """
        
        # Load PDF file and create content with PDF
        # pdf_file_data = load_pdf_file(original_swipe_file_path_pdf)
        user_content_with_pdf = [
            {"type": "text", "text": generate_content_prompt},
            # {
            #     "type": "document",
            #     "source": {
            #         "type": "base64",
            #         "media_type": "application/pdf",
            #         "data": pdf_file_data
            #     }
            # }
        ]
        
        # Add second user message with PDF
        messages.append({
            "role": "user",
            "content": user_content_with_pdf
        })
        
        # Get second response using streaming
        second_response_text, second_usage = make_streaming_request_with_retry(
            messages=messages,
            max_tokens=MAX_TOKENS,
            model=MODEL,
            anthropic_client=self.anthropic_client,
            system_prompt=system_prompt
        )
        
        # Add assistant response to messages
        messages.append({
            "role": "assistant",
            "content": second_response_text
        })
        
        logger.info(f"Turn 2 completed. Response length: {len(second_response_text)} chars")
        logger.info(f"Turn 2 usage: {second_usage}")
        # ============================================================
        # Turn 3: Write advertorial with structured output
        # ============================================================
        logger.info("Turn 3: Writing advertorial with structured output")
        third_query_prompt = f"""You are an expert copywriter creating a complete, polished advertorial for the NewAura Seborrheic Dermatitis & Psoriasis Cream.

        Your task:
        1. Rewrite the advertorial using ALL the relevant information about the new product.  
        2. Focus specifically on the marketing angle: {angle}.  
        3. Generate **a full and complete output** following the schema provided below.  
        4. DO NOT skip or leave out any fields — every field in the schema must be filled.  
        5. Please make sure that the length of each field matches the length of the description of the field.
        6. If any data is missing, intelligently infer or create realistic content that fits the schema.  
        7. Write fluently and naturally, with complete sentences. Do not stop mid-thought or end with ellipses (“...”).  
        8. At the end, verify your own output is **100% complete** — all schema fields filled.

        When ready, output ONLY the completed schema with all fields filled in. Do not include explanations or notes.
        """
        # Add third user message
        messages.append({
            "role": "user",
            "content": third_query_prompt
        })
        
        # Prepare schema for tool use
        tool_name, tool_description, tool_schema = prepare_schema_for_tool_use(schema_json)
        
        # Get structured response
        full_advertorial, third_usage = make_structured_request_with_retry(
            messages=messages,
            tool_name=tool_name,
            tool_description=tool_description,
            tool_schema=tool_schema,
            max_tokens=25000,
            model=MODEL,
            anthropic_client=self.anthropic_client,
            system_prompt=system_prompt
        )
        
        logger.info(f"Turn 3 completed. Received {len(full_advertorial) if isinstance(full_advertorial, dict) else 0} fields in structured output")
        logger.info(f"Turn 3 usage: {third_usage}")
        # Check if enough fields are present, else retry
        if len(full_advertorial) < 10:
            logger.info(f"Less then 10 fields, rerunning...")
            return self.rewrite_swipe_file(angle, avatar_sheet, deep_research_output, offer_brief, necessary_beliefs, schema_json, original_swipe_file_path_html)
        # ============================================================
        # Turn 4: Quality check (commented out for now)
        # ============================================================
        # fifth_query_prompt = f"""Amazing! I'm going to send you the full advertorial that I just completed. I want you to please analyze it and let me know your thoughts. I would specifically analyze how in line all of the copy is in relation to all the research amongst the avatar, the competitors, the research, necessary beliefs, levels of consciousness, the objections, etc., that you did earlier.
        #
        # Please include the deep research output such that you can verify whether all factual information is used.
        #
        # Rate the advertorial and provide me with a quality metrics.
        #
        # Find all research content can be found above and verify whether all factual information is used.
        #
        # Here is the full advertorial:
        #
        # {full_advertorial}"""
        # 
        # # Use only the first turn for quality check (reset messages to first turn only)
        # first_turn_messages = [
        #     messages[0],  # First user message
        #     messages[1],  # First assistant response
        #     {"role": "user", "content": fifth_query_prompt}
        # ]
        # 
        # quality_report, quality_usage = make_streaming_request_with_retry(
        #     messages=first_turn_messages,
        #     max_tokens=MAX_TOKENS,
        #     model=MODEL,
        #     anthropic_client=self.anthropic_client
        # )
        
        return full_advertorial, None
    
    
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
        content_dir = event.get("content_dir", "src/pipeline/content/")
        # swipe_file_id = event.get("swipe_file_id")
        # logger.info(
        #     f"Pipeline inputs: project_name={project_name}, sales_page_url={sales_page_url}, "
        #     f"swipe_file_id={swipe_file_id}, content_dir={content_dir}"
        # )

        # # Require swipe_file_id when not provided return 400
        # if not swipe_file_id:
        #     error_msg = "Missing required input: swipe_file_id"
        #     logger.error(error_msg)
        #     try:
        #         generator.update_job_status(job_id, "FAILED", {"error": error_msg})
        #     except Exception:
        #         pass
        #     return {
        #         "statusCode": 400,
        #         "body": {"error": error_msg}
        #     }

        # try:
            # load both the html as the json file
            # Try both spellings: "original" and "orginal" (typo in some files)
            # s3_key_html_correct = f"content_library/{swipe_file_id}_original.html"
            # s3_key_json = f"content_library/{swipe_file_id}.json"
            
            # Try the correct spelling first, then the typo
            # obj_html = generator.s3_client.get_object(Bucket=s3_bucket, Key=s3_key_html_correct)
            
            # html_bytes = obj_html["Body"].read()
            # save to local file and pass path to rewrite method. Check if directory exists, if not create it.
            # if not os.path.exists("content"):
            #     os.makedirs("content")
            # original_swipe_file_path_html = f"content/{swipe_file_id}_original.html"
            # with open(original_swipe_file_path_html, "wb") as f:
            #     f.write(html_bytes)
            
            # obj_json = generator.s3_client.get_object(Bucket=s3_bucket, Key=s3_key_json)
            # json_bytes = obj_json["Body"].read()
            # swipe_file_model = json_bytes.decode("utf-8")
            
            
        # except Exception as e:
        #     # Check if it's a file not found error (NoSuchKey)
        #     raise e
        
        
        
        # Load pre-computed results from comprehensive_results JSON file
        logger.info("Loading pre-computed results from JSON file")
        comprehensive_results_path = f"{content_dir}test_results.json"
        
        with open(comprehensive_results_path, "r") as f:
            comprehensive_data = json.load(f)
            results = comprehensive_data.get("results", {})
        
        # Extract all variables from the JSON
        research_page_analysis = results.get("research_page_analysis")
        doc1_analysis = results.get("doc1_analysis")
        doc2_analysis = results.get("doc2_analysis")
        deep_research_prompt = results.get("deep_research_prompt")
        deep_research_output = results.get("deep_research_output")
        avatar_sheet = results.get("avatar_sheet")
        offer_brief = results.get("offer_brief")
        marketing_philosophy_analysis = results.get("marketing_philosophy_analysis")
        summary = results.get("summary")
        angles = results.get("marketing_angles", [])
        
        # # Get customer avatars from event
        # customer_avatars = event.get("customer_avatars", [])
        # # Step 1: Analyze research page
        # logger.info("Step 1: Analyzing research page")
        # research_page_analysis = generator.analyze_research_page(sales_page_url, customer_avatars)
        
        # # Step 2: Analyze research documents
        # logger.info("Step 2: Analyzing research documents")
        
        
        # doc1_analysis = open(f"{content_dir}doc1_analysis.txt", "r").read()
        # doc2_analysis = open(f"{content_dir}doc2_analysis.txt", "r").read()

        
        # # Step 3: Create deep research prompt
        # logger.info("Step 3: Creating deep research prompt")
        # deep_research_prompt = generator.create_deep_research_prompt(
        #     sales_page_url, research_page_analysis, doc1_analysis, doc2_analysis, customer_avatars
        # )
        
        # # Step 4: Execute deep research
        # logger.info("Step 4: Executing deep research")
        # deep_research_output = generator.execute_deep_research(deep_research_prompt)
        
        # # Step 5: Complete avatar sheet
        # logger.info("Step 5: Completing avatar sheet")
        # avatar_parsed, avatar_sheet = generator.complete_avatar_sheet(deep_research_output)
        # angles = avatar_parsed.marketing_angles
        
        # # Step 6: Complete offer brief
        # logger.info("Step 6: Completing offer brief")
        offer_brief_parsed, offer_brief = generator.complete_offer_brief(deep_research_output)
        
        # # Step 7: Analyze marketing philosophy
        # logger.info("Step 7: Analyzing marketing philosophy")
        # marketing_philosophy_analysis = generator.analyze_marketing_philosophy(
        #     avatar_sheet, offer_brief, deep_research_output
        # )
        
        # # Step 8: Create summary
        # logger.info("Step 8: Creating summary")
        # summary = generator.create_summary(
        #     avatar_sheet, offer_brief, deep_research_output, marketing_philosophy_analysis
        # )
    
        
        # # Step 10: Rewrite swipe files
        # logger.info("Step 9: Rewriting swipe files")
        # # use max 3 angles for now.
        # angles = angles[:1]
        # swipe_results = []
        # for angle in angles:
        #     full_advertorial, quality_report = generator.rewrite_swipe_file(
        #         angle, avatar_sheet, deep_research_output, offer_brief, marketing_philosophy_analysis, swipe_file_model, original_swipe_file_path_html
        #     )
        #     swipe_results.append({"angle": angle, "content": json.dumps(full_advertorial)})

        
        # Step 10: Save all results
        logger.info("Step 10: Saving results")
        all_results = {
            "research_page_analysis": research_page_analysis,
            "doc1_analysis": doc1_analysis,
            "doc2_analysis": doc2_analysis,
            "deep_research_prompt": deep_research_prompt,
            "deep_research_output": deep_research_output,
            "avatar_sheet": avatar_sheet,
            "offer_brief": offer_brief_parsed.model_dump() if hasattr(offer_brief_parsed, 'model_dump') else offer_brief,
            "marketing_philosophy_analysis": marketing_philosophy_analysis,
            "summary": summary,
            # "swipe_results": swipe_results,
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
                # "swipe_files_generated": len(swipe_results),
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
    

# Add pdfs for swipe files
# change to better models
