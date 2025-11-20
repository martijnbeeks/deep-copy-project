#!/usr/bin/env python3

"""
Render an HTML template using variables from a JSON file.

Works best with Jinja2 (if installed). If Jinja2 isn't available,
it falls back to a simple {{ dotted.path }} replacer.

Supports HTML components in JSON data (e.g., <b>, <ul>, <li>, <br> tags).
HTML tags in the JSON are preserved and rendered as HTML (not escaped).
Newline characters (\n) are automatically converted to <br> tags.

Usage:
  python render.py --json /mnt/data/test.json --template /mnt/data/A00002.html --out /mnt/data/output.html
"""

import json
import re
from pathlib import Path
from typing import Any, Dict

def _dotted_lookup(data: Dict[str, Any], path: str):
    """Resolve 'a.b.c' against nested dicts/lists; return '' if not found."""
    cur: Any = data
    for part in path.split("."):
        part = part.strip()
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        elif isinstance(cur, list) and part.isdigit():
            idx = int(part)
            cur = cur[idx] if 0 <= idx < len(cur) else ""
        else:
            return ""
    # Convert non-str scalars to string for HTML
    result = "" if cur is None else str(cur)
    # Convert newlines to <br> tags for proper HTML rendering
    # HTML tags in the result are preserved (not escaped) due to autoescape=False
    if isinstance(result, str):
        result = result.replace('\n', '<br>')
    return result

def _fallback_render(template_str: str, context: Dict[str, Any]) -> str:
    """
    Extremely small {{ dotted.path }} renderer for when Jinja2 isn't installed.
    - Supports dot-path lookups into dicts/lists.
    - Leaves unknown placeholders blank.
    - Does not do loops/ifs/filters.
    """
    pattern = re.compile(r"{{\s*([^}]+?)\s*}}")

    def repl(match):
        key = match.group(1)
        return _dotted_lookup(context, key)

    return pattern.sub(repl, template_str)

def render(template_str: str, content_data: Dict[str, Any]) -> str:
    """
    Try Jinja2 first (for full-featured templating). If unavailable, fall back.
    We expose the JSON as the variable name 'content' to match the template.
    """
    try:
        from jinja2 import Environment, BaseLoader, StrictUndefined
        
        def nl2br(value: Any) -> str:
            """Convert newlines to <br> tags for HTML rendering, preserving existing HTML."""
            if value is None:
                return ""
            text = str(value)
            # Convert \n to <br> - HTML tags in the text are preserved (not escaped)
            return text.replace('\n', '<br>')
        
        # Use StrictUndefined to surface missing keys during development;
        # change to Undefined() if you prefer blanks silently.
        env = Environment(
            loader=BaseLoader(),
            undefined=StrictUndefined,
            autoescape=False,  # your HTML already expects raw strings
            keep_trailing_newline=True,
        )
        # Add custom filter to convert newlines to <br> tags
        env.filters['nl2br'] = nl2br
        
        # Process content_data to convert newlines to <br> in all string values
        # Preserves existing HTML tags in the JSON data (e.g., <b>, <ul>, <li>, etc.)
        def process_value(value: Any) -> Any:
            """Recursively process dict/list values to convert newlines to <br>, preserving HTML."""
            if isinstance(value, dict):
                return {k: process_value(v) for k, v in value.items()}
            elif isinstance(value, list):
                return [process_value(item) for item in value]
            elif isinstance(value, str):
                # Convert \n to <br> - HTML tags in the string are preserved (not escaped)
                # due to autoescape=False in the Jinja2 environment
                return value.replace('\n', '<br>')
            else:
                return value
        
        processed_data = process_value(content_data)
        tmpl = env.from_string(template_str)
        return tmpl.render(content=processed_data)
    except Exception:
        # Either Jinja2 isn't installed or rendering failed—fallback to simple replacer.
        # For the fallback, we must expose a dict that has top-level 'content'.
        context = {"content": content_data}
        return _fallback_render(template_str, context)

def main():
    json_path = Path("/Users/martijnbeeks/Development/Personal/deep-copy/deep-copy-infra/ai_pipeline/test.json")
    tmpl_path = Path("/Users/martijnbeeks/Development/Personal/deep-copy/deep-copy-infra/A00002.html")
    # Generate output path version based on files already in the directory
    def get_next_versioned_path(base_path: Path) -> Path:
        # Look for files named like base_rendered_v{N}.html
        parent = base_path.parent
        stem = base_path.stem
        # Remove any previous _rendered_v* if present in stem
        import re
        m = re.match(r"^(.*)_rendered_v(\d+)$", stem)
        if m:
            plain_stem = m.group(1)
        else:
            plain_stem = stem
        # glob exact name pattern
        existing = list(parent.glob(f"{plain_stem}_rendered_v*.html"))
        version_nums = []
        pat = re.compile(rf"{re.escape(plain_stem)}_rendered_v(\d+)\.html$")
        for f in existing:
            match = pat.match(f.name)
            if match:
                version_nums.append(int(match.group(1)))
        next_version = max(version_nums, default=0) + 1
        return parent / f"{plain_stem}_rendered_v{next_version}.html"

    out_path = get_next_versioned_path(tmpl_path)

    # Load JSON
    with json_path.open("r", encoding="utf-8") as f:
        raw = json.load(f)

    # Your JSON already has keys like topbar/alert/hero/etc.
    # The template expects {{content.*}}, so pass the whole JSON as 'content'.
    content_data: Dict[str, Any] = raw if isinstance(raw, dict) else {}

    # Load template
    with tmpl_path.open("r", encoding="utf-8") as f:
        template_str = f.read()

    # Render
    html = render(template_str, content_data)

    # Write output
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        f.write(html)

    print(f"Rendered HTML written to: {out_path}")
    
    
if __name__ == "__main__":
    main()