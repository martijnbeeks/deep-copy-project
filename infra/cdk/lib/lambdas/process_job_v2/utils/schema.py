"""
JSON Schema to Pydantic model conversion utilities.

Provides functions to dynamically create Pydantic models from JSON schemas.
"""

import json
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, create_model


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
    Load a JSON schema string and create a Pydantic BaseModel.
    
    Args:
        schema: JSON schema as a string
        
    Returns:
        Pydantic BaseModel class
    """
    schema_dict = json.loads(schema)
    
    # Get definitions
    definitions = schema_dict.get("$defs", {})
    
    # Get model name from schema or use default
    model_name = schema_dict.get("title", "GeneratedModel")
    
    # Create the main model
    return create_model_from_schema(model_name, schema_dict, definitions)
