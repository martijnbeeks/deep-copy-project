"""
Central prompt repository for write_swipe Lambda.

All LLM prompts are defined here for maintainability, versioning, and easy iteration.
Each function returns a formatted prompt string ready for LLM consumption.
"""

def get_style_guide_analysis_prompt(raw_swipe_file_text: str) -> str:
    """
    Generate prompt for analyzing an advertorial's style.
    
    Args:
        raw_swipe_file_text: The raw text of the swipe file to analyze.
        
    Returns:
        Formatted prompt string for style analysis.
    """
    return f"""
        You are an expert copywriter analyzing an advertorial's style to create a detailed style guide for rewriting.
        YOUR TASK:
        Analyze the provided original advertorial and output a comprehensive style guide in JSON format. This guide will be used by a second process to generate new copy that matches the original's style exactly.

        ANALYSIS REQUIREMENTS:
        1. Sentence Structure Analysis
        Count and analyze:

        Average words per sentence in body sections (calculate across all section bodies)
        Shortest sentence length (in words)
        Longest sentence length (in words)
        Fragment frequency (count intentional fragments like "No X. Just Y.")
        Fragment examples (list 3-5 examples from original)

        2. White Space & Line Break Analysis
        Map the formatting:
        <br> tag count in story intro
        Average <br> tags per section body (count across sections 1-11)
        Line break pattern (describe: frequent breaks between every 2-3 sentences, or longer paragraphs?)
        White space philosophy (dense prose vs. scannable chunks)

        3. Tone & Voice Markers
        Identify:
        Formality level (casual/conversational or formal/authoritative - choose one)
        Contraction frequency (count contractions like "you're", "don't" and calculate per 100 words)
        Direct address frequency (count uses of "you/your" per 100 words)
        Energy level (punchy/urgent or calm/educational - choose one)
        Confidence style (assertive claims or hedged language - choose one)

        4. Repetition & Rhythm Devices
        Catalog patterns:
        Parallel structure examples (find patterns like "Ditch X, ditch Y" - list 3-5)
        Rule of threes (find "X, Y, and Z" patterns - list examples)
        Rhetorical questions (count and list examples)
        Repeated phrases (any phrases that appear multiple times)

        5. Pacing & Information Density
        Measure:
        Facts per section body (average number of specific claims/facts per section)
        Explanation depth (light touch with benefits only, or detailed mechanisms? - describe)
        Speed variation (where does copy speed up with short sentences vs. slow down? - note patterns)

        6. Formatting & CTA Patterns
        Document:
        HTML elements used (list all: <br>, <b>, <strong>, <ul>, <ol>, etc.)
        Bold/emphasis frequency (count uses of <b> or <strong> tags)
        Inline CTA presence (yes/no)
        Inline CTA sections (if yes, list which section numbers have them: e.g., 3, 5, 7, 9, 11)
        CTA format (if present, show exact format like "👉 [Text]")
        Emoji usage (list any emojis used, or "none")

        7. Punctuation & Special Characters
        Identify:
        Ellipsis usage (count "..." occurrences)
        Exclamation points (count and note if used sparingly or frequently)

        8. Section-Specific Patterns
        Analyze structure:
        Story intro word count
        Story intro sentence count
        Story intro structure (describe the flow: problem → agitation → hope, or other pattern)
        Average section body word count (calculate across sections 1-11)
        Average section body sentence count
        Section body structure (describe pattern: benefit → detail → proof, or other)


        OUTPUT FORMAT:
        Return your analysis as style report that can be used to rewrite the advertorial.

        CRITICAL INSTRUCTIONS:
        Be precise with counts - actually count, don't estimate
        Calculate averages accurately - show your math if needed
        Provide specific examples - use exact quotes from original
        Fill every field - no null or empty values
        Set hard rules in criticalRules - based on your analysis, set the limits for Call 2


        INPUT:
        Original Advertorial:
        {raw_swipe_file_text}

        """

def get_advertorial_rewrite_prompt(
    style_guide: str,
    angle: str,
    deep_research_output: str,
    offer_brief: str,
    marketing_philosophy_analysis: str,
    avatar_info: str = ""
) -> str:
    """
    Generate prompt for rewriting an advertorial based on style guide and research.
    
    Args:
        style_guide: The style guide generated from the analysis step.
        angle: The marketing angle to use.
        deep_research_output: Foundational research data.
        offer_brief: Offer details.
        marketing_philosophy_analysis: Marketing philosophy context.
        avatar_info: Detailed avatar profile information.
        
    Returns:
        Formatted prompt string for advertorial generation.
    """
    return f"""
        You are an expert copywriter creating a complete advertorial for a new product, following an exact style guide.
        YOUR TASK:
        Write a complete advertorial using:

        The style specifications from the provided style guide (from Call 1)
        All relevant product information from the product data
        The specified marketing angle (focus the copy around this emotional driver)
        The target avatar profile (speak directly to their pains/desires)
        The output schema structure

        CRITICAL: The marketing angle should be woven throughout the copy, not just stated once. It should drive the emotional arc, headline choices, and benefit framing.
        Generate a full and complete output with every schema field filled. Do NOT skip or leave out any fields.

        STYLE GUIDE (FROM CALL 1):
        {style_guide}

        CRITICAL WRITING RULES (EXTRACT FROM STYLE GUIDE):
        Read the style guide above carefully and extract these key values:
        Sentence Construction

        MAXIMUM sentence length: Extract from "Maximum sentence length" in Critical Rules section - NO EXCEPTIONS
        Fragment requirement: Extract from "Fragments required" in Critical Rules section
        Fragment patterns to use: Use examples from "Fragment examples" in Sentence Structure section
        Average target: Extract from "Average words per sentence" in Sentence Structure section
        Before writing each sentence: Count the words. If over max, split it.

        White Space & Line Breaks
        Story intro <br> tags: Extract from "<br> tags in story intro" in White Space section
        Section body <br> tags: Extract from "Mandatory <br> tags per section" in Critical Rules section
        Placement pattern: Extract from "Line break pattern" in White Space section
        Philosophy: Extract from "White space philosophy" in White Space section
        Format: Use <br><br> to separate idea chunks (double break for visual space)
        Add new lines between paragraphs as needed and to make to paragraphs easy to read.

        Tone & Voice
        Formality: Extract from "Formality level" in Tone & Voice section.
        Contractions: Extract rate from "Contractions per 100 words" in Tone & Voice section
        Direct address: Extract rate from "Direct address per 100 words" in Tone & Voice section
        Energy: Extract from "Energy level" in Tone & Voice section
        Confidence: Extract from "Confidence style" in Tone & Voice section

        Rhythm & Repetition
        Use parallel structures: Extract examples from "Parallel structure examples" in Rhythm & Repetition section
        Rule of threes: Extract examples from "Rule of threes examples" in Rhythm & Repetition section
        Rhetorical questions: Extract frequency from "Rhetorical questions found" in Rhythm & Repetition section

        Pacing & Density
        Facts per section: Extract from "Average facts/claims per section" in Pacing section
        Explanation depth: Extract from "Explanation depth" in Pacing section

        Formatting & CTAs
        HTML elements allowed: Extract from "HTML elements used" in Formatting section
        Inline CTAs:
        Required: Extract from "Inline CTAs required" in Critical Rules section
        If yes, sections: Extract from "If yes, which sections" in Formatting section
        Format: Extract from "CTA format" in Formatting section


        Emojis: Extract from "Emojis used" in Formatting section
        Punctuation
        Do not allow em dashes. Use commas, periods, or rewrite differently.
        If normal dashes are used, please use appropriate spacing around them, never use dashes without spaces.
        Preferred dash style: Extract from "Preferred dash style" in Punctuation section

        Section Targets
        Story intro word count: Extract from "Target intro word count" in Critical Rules section (±20 words)
        Story intro sentences: Extract from "Story intro sentence count" in Section-Specific Patterns
        Story intro flow: Extract from "Story intro structure" in Section-Specific Patterns
        Section body word count: Extract from "Target section word count" in Critical Rules section (±15 words)
        Section body sentences: Extract from "Average section body sentence count" in Section-Specific Patterns
        Section body flow: Extract from "Section body structure" in Section-Specific Patterns


        PRODUCT INFORMATION:
        Marketing Angle:
        {angle}
        
        Target Avatar:
        {avatar_info}
        
        Product Data:
        Deep research output:
        {deep_research_output}
        Offer brief:
        {offer_brief}
        Marketing philosophy analysis:
        {marketing_philosophy_analysis}



        PRE-SUBMISSION VERIFICATION CHECKLIST:
        STOP. Before submitting, verify these items:
        1. Sentence Length Audit
        Every sentence in story intro ≤ [Max from Critical Rules section] words
        Every sentence in sections 1-11 ≤ [Max from Critical Rules section] words
        If any exceed limit, they are split into shorter sentences or fragments

        2. Line Break Audit
        Story intro contains ≥ [Number from White Space section] <br><br> tags
        Each section body contains ≥ [Number from Critical Rules section] <br><br> tags
        Line breaks separate distinct ideas/emotional beats

        3. Inline CTA Audit
        If inline CTAs required per Critical Rules section, CTAs are added
        CTAs appear in correct sections per Formatting section
        CTA format matches example in Formatting section

        4. Punctuation Audit
        Do not allow em dashes. Use commas, periods, or rewrite differently.
        If normal dashes are used, please use appropriate spacing around them, never use dashes without spaces.
        Ellipses (...) avoided unless Punctuation section shows usage
        Exclamation points match original frequency from Punctuation section

        5. Fragment Audit
        If fragments required per Critical Rules section, fragments included
        Fragment style matches examples from Sentence Structure section
        Used for emphasis and rhythm

        6. Word Count Audit
        Story intro: [Target from Critical Rules section] ±20 words
        Each section body: [Target from Critical Rules section] ±15 words
        Staying within targets = stronger, more scannable copy

        7. Schema Audit
        Every required field is filled
        Character counts fall within minLength/maxLength
        No placeholder text or incomplete thoughts

        If you cannot verify all 7 audits above, DO NOT SUBMIT. Fix first.

        OUTPUT INSTRUCTIONS:
        Output ONLY the completed JSON schema with all fields filled.
        Do not include:

        Explanations or process notes
        Style guide references
        Meta-commentary
        Preambles or conclusions

        Just the raw JSON schema, fully populated and verified against all checklists.
        """
