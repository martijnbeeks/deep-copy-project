#!/usr/bin/env python3
"""Replace {{placeholders}} in the advertorial HTML template with values from a JSON file.

Placeholders use dot-notation paths that are resolved dynamically against the JSON data.
E.g. {{product.name}} looks up data["product"]["name"], falling back to flattened key
matching (PRODUCT_NAME, product_name, etc.) for flat JSON structures.
"""

import json
import sys
import re


def json_encode(value):
    """Encode a Python value as a JS literal for insertion into the CONFIG block."""
    return json.dumps(value, ensure_ascii=False)


def resolve_path(data: dict, path: str):
    """Resolve a dot-notation path against the data dict.

    Tries in order:
    1. Nested traversal: data["product"]["name"]
    2. Exact key: data["product.name"]
    3. UPPER_SNAKE_CASE: "product.name" -> "PRODUCT_NAME"
    4. Case-insensitive match on top-level keys
    """
    # 1. Nested traversal
    parts = path.split(".")
    current = data
    try:
        for part in parts:
            current = current[part]
        return current
    except (KeyError, TypeError):
        pass

    # 2. Exact key
    if path in data:
        return data[path]

    # 3. UPPER_SNAKE_CASE conversion: "product.name" -> "PRODUCT_NAME"
    #    Also handles camelCase: "article.authorName" -> "AUTHOR_NAME"
    def to_snake(s):
        # Insert underscore before uppercase letters, then uppercase everything
        return re.sub(r'(?<=[a-z0-9])(?=[A-Z])', '_', s).upper()

    snake_key = "_".join(to_snake(p) for p in parts).upper()
    if snake_key in data:
        return data[snake_key]

    # 4. Case-insensitive match on full snake key
    lower = snake_key.lower()
    for k, v in data.items():
        if k.lower() == lower:
            return v

    # 5. Try last segment only: "article.headline" -> "HEADLINE"
    last_snake = to_snake(parts[-1])
    if last_snake in data:
        return data[last_snake]
    for k, v in data.items():
        if k.lower() == last_snake.lower():
            return v

    # 6. Try without first segment: "reviews.sidebar" -> "SIDEBAR_REVIEWS" etc.
    #    Reverse the remaining parts for common naming patterns
    if len(parts) > 1:
        for combo in [
            "_".join(to_snake(p) for p in parts[1:] + parts[:1]),  # SIDEBAR_REVIEWS
            "_".join(to_snake(p) for p in parts[1:]),              # SIDEBAR
            to_snake(parts[0]),                                     # REVIEWS (first segment only)
        ]:
            combo_upper = combo.upper()
            if combo_upper in data:
                return data[combo_upper]
            for k, v in data.items():
                if k.lower() == combo_upper.lower():
                    return v

    return None


def unwrap_nested(data: dict) -> dict:
    """Auto-unwrap nested JSON until we find the object with the actual config keys.

    Handles structures like {"LD0001": {"full_advertorial": { ...keys... }}}
    by drilling into single-child dicts until we hit one with multiple keys
    or non-dict values.
    """
    while isinstance(data, dict) and len(data) == 1:
        only_value = next(iter(data.values()))
        if isinstance(only_value, dict):
            data = only_value
        else:
            break
    return data


def fill_template(template_path: str, data_path: str, output_path: str):
    with open(data_path, "r", encoding="utf-8") as f:
        data = unwrap_nested(json.load(f))

    with open(template_path, "r", encoding="utf-8") as f:
        html = f.read()

    def replace_placeholder(match):
        path = match.group(1).strip()
        value = resolve_path(data, path)
        if value is None:
            print(f"Warning: could not resolve '{path}', leaving as-is")
            return match.group(0)
        return json_encode(value)

    filled = re.sub(r"\{\{(.+?)\}\}", replace_placeholder, html)

    with open(output_path, "w", encoding="utf-8") as f:
        f.write(filled)

    print(f"Written to {output_path}")


if __name__ == "__main__":
    template = sys.argv[1] if len(sys.argv) > 1 else "advertorial-template-v3 (1).html"
    data_file = sys.argv[2] if len(sys.argv) > 2 else "output.json"
    output = sys.argv[3] if len(sys.argv) > 3 else "filled-advertorial.html"
    fill_template(template, data_file, output)
