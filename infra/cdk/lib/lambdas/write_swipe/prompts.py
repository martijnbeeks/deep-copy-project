"""
Central prompt repository for write_swipe Lambda.

All LLM prompts are defined here for maintainability, versioning, and easy iteration.
Each function returns a formatted prompt string ready for LLM consumption.
"""
from typing import Literal

ImageStyle = Literal["realistic", "photorealistic", "illustration"]

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
    avatar_info: str = ""
) -> str:
    """
    Generate prompt for rewriting an advertorial based on style guide and research.
    
    Args:
        style_guide: The style guide generated from the analysis step.
        angle: The marketing angle to use.
        deep_research_output: Foundational research data.
        offer_brief: Offer details.
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



def get_advertorial_image_prompt(
    offer_brief: str,
    completed_advertorial_copy: str,
    ):
    return """
    # ADVERTORIAL IMAGE SOP: Complete Visual Strategy

    ## OVERVIEW

    This SOP generates emotionally resonant images for EVERY section of advertorial copy. The advertorial is 2,100-3,600 words — walls of text are death on mobile. Every section gets visual support.

    **The Mix:** Emotional photographs + Mechanism diagrams + Comparison visuals + Product infographics

    **Outputs:** IMAGE-PROMPTS for 8-10 images per advertorial

    **Inputs Required:** Offer Brief + Completed Advertorial Copy. See at the bottom of the input.

    ---

    # PART 1: THE COMPLETE IMAGE MAP

    ## Every Section Gets Visual Support

    | Section | Content | Image Type | Visual Style |
    |---------|---------|------------|--------------|
    | **HERO** | After headline | Recognition Portrait | Emotional photograph |
    | **Section 1** | Hook/Lead | Wound Moment | Emotional photograph |
    | **Section 2** | Education/UMP | Problem Mechanism | **DIAGRAM — anatomical attack** |
    | **Section 3** | Discredit | Failed Solutions | **DIAGRAM — comparison** |
    | **Section 4** | Mechanism/UMS | Solution Mechanism | **DIAGRAM — how it works** |
    | **Section 5** | Product | Product + Benefits | **INFOGRAPHIC — ingredients/timeline** |
    | **Section 6** | FAQ | Credibility | Expert portrait OR skip |
    | **Section 7** | Transformation | Identity Reclaimed | Emotional photograph (action) |
    | **Section 8** | Offer | Product Shot | **CLEAN PRODUCT PHOTO** |

    **Total: 8-10 images** (mix of photos + diagrams + infographics) Please depend the number of images on the Completed Advertorial Copy with placeholders.

    ---

    ## The Visual Mix Explained

    | Type | Sections | Purpose | Tool |
    |------|----------|---------|------|
    | **Emotional Portraits** | Hero, S1, S7 | Feel the pain/transformation | Nanobanan / Soul |
    | **Mechanism Diagrams** | S2, S4 | Understand problem/solution | Nanobanan |
    | **Comparison Diagrams** | S3 | See why other solutions fail | Nanobanan |
    | **Product Infographics** | S5 | Trust the instrument | Nanobanan |
    | **Timeline Graphics** | S5 (optional) | See the progression | Nanobanan |

    ---

    ## Why This Works

    **Mobile Reality:** 70%+ traffic is mobile. A 3,000-word article with 2 images is a wall of grey text. With 7-9 images, every scroll reveals something new.
    **Visual Variety:** Alternating between emotional photographs and educational diagrams keeps attention fresh. The reader never knows what's coming next.
    **Diagram Power:** Mechanism sections (UMP/UMS) are ABSTRACT. Diagrams make them CONCRETE. "Inflammation attacking your joints" is words. A diagram showing red invaders destroying cartilage is VISCERAL.

    ---

    # PART 2: RESEARCH EXTRACTION

    ## 2.1 Demographics for Images

    ```
    Target Market: [UK, Netherlands, Israel, Germany, etc.]
    Primary Gender: [e.g., 70% female]
    Age Range: [e.g., 55-75, sweet spot 62]
    Ethnicity: [Match target — British, Dutch, Israeli, German]
    Appearance: [e.g., "natural grey hair, warm complexion, soft features"]
    Clothing Style: [e.g., "practical British casual — soft jumpers, comfortable trousers"]
    ```

    ## 2.2 Cultural Context

    ```
    Home Settings: [British cottage kitchen, Dutch apartment, Israeli balcony]
    Outdoor Settings: [English garden path, Dutch park bench, Mediterranean terrace]
    Family Markers: [Grandchildren's drawings on fridge, family photos, dog lead by door]
    Activities: [Morning tea ritual, garden tending, dog walking]
    ```

    ## 2.3 Emotional Triggers

    ```
    PRIMARY FEAR (for Hero + Wound images):
    [e.g., "Becoming invisible to my family — present but not participating"]

    SECONDARY FEARS:
    1. [e.g., "Being a burden to my children"]
    2. [e.g., "Missing my grandchildren growing up"]
    3. [e.g., "Losing my independence"]

    PRIMARY DESIRE (for Transformation images):
    [e.g., "Being the grandmother who gets on the floor to play"]

    IDENTITY PRISON (who they were forced to become):
    [e.g., "The fragile one. The one who needs help. The one they plan around."]

    IDENTITY RESTORATION (who they reclaim):
    [e.g., "The capable one. The adventurous one. The one they call for fun."]
    ```

    ## 2.4 Mechanism Visuals

    ```
    UMP (Unique Mechanism of Problem):
    [e.g., "Chronic inflammation destroying joints from inside"]
    Visual Translation: [e.g., "Red armies attacking cartilage, healthy tissue retreating"]
    Anatomy: [e.g., "Knee joint cross-section"]

    UMS (Unique Mechanism of Solution):
    [e.g., "Blocking inflammatory cascade at the source"]
    Visual Translation: [e.g., "Golden shield protecting healthy tissue, attackers blocked"]
    Key Ingredients: [e.g., "Curcumin, Boswellia, Collagen Type II"]
    ```

    ---

    # PART 3: TOOL SELECTION

    | Tool | Strength | Use For |
    |------|----------|---------|
    | **Nanobanan** | Static portraits, editorial, anatomical, diagrams, infographics | Hero (types 1-2), Wound, Diagrams, Product |

    **Decision Rule:** Active movement needed? → Soul. Everything else → Nanobanan.

    ---

    ## Visual Standards (ALL Images)

    - **NO TEXT** except: Stat badges, diagram labels, infographic text
    - **Eyes:** Natural only — "soft blue," "warm brown" — NEVER "bright/piercing/vivid"
    - **Expressions:** Dignified emotion — NOT theatrical pain or fake smiles
    - **Demographics:** EXACT match to research
    - **Settings:** CULTURALLY APPROPRIATE to target market
    - **Format:** 16:9 for Hero, 1:1 for all section images
    - **Diagram Labels:** In TARGET LANGUAGE

    ---

    # PART 4: HERO IMAGE (16:9)

    ## Always Output 3 Versions

    1. **Recognition Hero** — Hits deepest fear (RECOMMENDED for cold traffic)
    2. **Transformation Hero** — Shows mechanism/proof (good for retargeting)
    3. **Aspiration Hero** — Shows desire achieved (A/B test for solution-aware)

    ---

    ## HERO TYPE 1: Recognition Heroes

    **Tool:** Nanobanan | **Format:** 16:9

    | Primary Fear | Concept | The Gut-Punch |
    |--------------|---------|---------------|
    | Missing moments | **1A: Missed Moment** | POV from armchair — grandchildren reaching up |
    | Being a burden | **1B: The Look** | Daughter's exhausted face, forcing a smile |
    | Losing independence | **1C: The Pause** | Bottom of stairs, looking UP |
    | Being left out | **1D: The Window** | Hands on glass, watching life outside |
    | Fear of decline | **1E: The Shadow** | Mobility walker in corner — your FUTURE |
    | Family isolation | **1F: Empty Chair** | Family dinner, one chair empty |

    ### 1A: THE MISSED MOMENT
    ```
    Photorealistic POV image. 16:9 format.

    CAMERA: First-person POV looking DOWN from seated position in armchair.

    FOREGROUND: Your own hands — [AGE]-appropriate, [ETHNICITY] skin tone — GRIPPING armrest. Knuckles showing tension. Wedding ring visible.

    THE FLOOR: [CULTURALLY APPROPRIATE — British carpet, Dutch hardwood]. Grandchildren's toys scattered. Building blocks. Picture book open.

    THE CHILDREN: Two grandchildren on floor, looking UP at camera. Arms REACHING. Faces hopeful. "Come play with us."

    THE GAP: 3 feet between you and everything that matters.

    LIGHTING: Warm golden light on children. Cooler where you are. The warmth doesn't reach you.

    EMOTION: Make viewer's hands ACHE with need to let go.

    No text. No product.
    ```

    ### 1B: THE LOOK
    ```
    Photorealistic image. 16:9 format.

    COMPOSITION: Over-shoulder shot. Back of [DEMOGRAPHIC]'s head (grey hair, bowed) in soft focus foreground.

    THE FACE: Adult daughter, 40-45, [ETHNICITY]. SHARP FOCUS.

    HER EXPRESSION:
    - Smile: Present. Forced. A mask.
    - Eyes: EXHAUSTED. Dark circles hidden with makeup.
    - Jaw: Tight. Holding back.
    - Truth: Terrified. For you. You're the CAUSE.

    SETTING: [CULTURALLY APPROPRIATE kitchen]. Normal backdrop to private devastation.

    LIGHTING: Flat, honest. Lighting of difficult conversations.

    EMOTION: Worst pain isn't your body. It's knowing you put that look on your child's face.

    No text. No product.
    ```

    ### 1C: THE PAUSE
    ```
    Photorealistic image. 16:9 format.

    SUBJECT: [DEMOGRAPHIC] standing at BOTTOM of staircase.

    THE STAIRS: 12-14 steps. Normal stairs that LOOM.

    BODY LANGUAGE:
    - Hand on banister — resting, preparing
    - Weight shifted, testing
    - Head tilted UP, measuring
    - Micro-hesitation before what used to be NOTHING

    EXPRESSION: Not pain. DETERMINATION. Quiet daily courage. Natural [eye color].

    SETTING: [CULTURALLY APPROPRIATE hallway]. Family photos going up stairs.

    LIGHTING: Light from above. Destination bright. Bottom in shadows.

    EMOTION: Everyone with this problem knows this EXACT moment.

    No text. No product.
    ```

    ### 1D: THE WINDOW
    ```
    Photorealistic image. 16:9 format.

    SUBJECT: [DEMOGRAPHIC] standing at large window. Profile view.

    THE GLASS: Dominates image. A barrier. Prison of transparency.

    INSIDE: Darker, muted. Chair they spend too much time in visible.

    OUTSIDE (through window, VIBRANT):
    - Grandchildren playing in garden
    - OR: Neighbors walking together
    - World moving without them

    BODY LANGUAGE: Hands FLAT against glass. Leaning toward life.

    EXPRESSION: Wistful. Hungry. Grief of watching life without you. Natural [eye color].

    LIGHTING: Dark interior, bright exterior. Contrast IS the story.

    No text. No product.
    ```

    ### 1E: THE SHADOW
    ```
    Photorealistic image. 16:9 format.

    COMPOSITION: [DEMOGRAPHIC] foreground, in focus. THE THING in background, unmistakable.

    THE THING: Mobility walker. Clean, new. "Gift" from family. NOT YET.

    SUBJECT: Seated or standing, turned toward it. Can't stop looking.

    EXPRESSION — layers:
    - Defiance: "Not yet. Not me."
    - Fear: "But maybe soon."
    - Determination: "I won't let this happen."
    - Despair: "Will I have a choice?"
    Natural [eye color].

    SETTING: [CULTURALLY APPROPRIATE living room]. Otherwise LIVED IN.

    LIGHTING: Walker slightly shadowed — lurking. Waiting.

    No text. No product.
    ```

    ### 1F: THE EMPTY CHAIR
    ```
    Photorealistic image. 16:9 format.

    COMPOSITION: Family dinner scene, elevated angle.

    THE TABLE: [CULTURALLY APPROPRIATE meal]. 4-5 family members, multiple generations. Engaged. ALIVE.

    THE FAMILY: Passing dishes. Laughing. Eye contact. Connection.

    THE EMPTY CHAIR: One place at table. Chair pushed back. CONSPICUOUSLY empty.

    THE SUBJECT:
    - OPTION A: Visible in doorway, watching but not joining
    - OPTION B: Not visible — empty chair IS them

    LIGHTING: Warm over table. Cooler at edges. Empty chair where warmth fades.

    EMOTION: Fear isn't dying alone. It's being alive and watching family learn to live without you.

    No text. No product.
    ```

    ---

    ## HERO TYPE 2: Transformation Heroes

    **Tool:** Nanobanan | **Format:** 16:9

    ### 2A: SYMBOLIC METAPHOR (Brain, energy, mood)
    ```
    Split image. 16:9 format. Clean gradient background.

    LEFT SIDE — THE PRISON:
    Human head silhouette in profile.
    INSIDE: [Match research problem]
    - Fog → Dense grey fog, suffocating
    - Exhaustion → Dim, flickering lightbulb
    - Memory → Scattered puzzle pieces
    - No energy → Drained battery, cracked
    Muted greys, heavy.

    RIGHT SIDE — THE FREEDOM:
    SAME silhouette.
    INSIDE: [Match desire]
    - Clarity → Golden neural network, electricity flowing
    - Energy → Radiant sun, beams extending
    - Memory → Completed puzzle, glowing
    - Vitality → Fully charged battery, radiating
    Vibrant gold, ALIVE.

    TRANSITION: Clean line between sides.

    ZERO TEXT. No product.
    ```

    ### 2B: ANATOMICAL CROSS-SECTION (Joints, arteries)
    ```
    Split image. 16:9 format. Dark medical background.

    LEFT SIDE — THE DAMAGE:
    Medical illustration of [ANATOMY]:
    - Joint: Cartilage rough, inflamed, eroded. RED inflammation.
    - Artery: Yellow plaque CHOKING passage.
    Sickly yellows, angry reds, bruise purples.

    RIGHT SIDE — THE RESTORATION:
    SAME anatomy:
    - Joint: Smooth cartilage, healthy cushion. Blue/gold glow.
    - Artery: Clear passage, smooth flow.
    Healthy pinks, vibrant blues, golden energy.

    STYLE: Medical illustration — realistic but EMOTIONAL.

    ZERO TEXT. No product.
    ```

    ### 2C: REAL SYMPTOM BEFORE/AFTER
    ```
    Split image. 16:9 format.

    LEFT — THE STRUGGLE:
    [DEMOGRAPHIC] in difficulty:
    - Hands pressing armrests, trying to stand
    - Sitting on bed edge, dreading first steps
    Expression: Dignified struggle.
    Desaturated tones.

    RIGHT — THE FREEDOM:
    SAME person, SAME setting:
    - Rising easily, natural movement
    - Standing with ease
    Expression: Simple contentment.
    Warmer tones.

    ZERO TEXT. No product.
    ```

    ---

    ## HERO TYPE 3: Aspiration Heroes

    **Tool:** Nanobanan | **Format:** 16:9

    ### 3A: LIVING THE DESIRE
    ```
    Cinematic photograph. 16:9 format. MOTION visible.

    SUBJECT: [DEMOGRAPHIC] in FLUID MOVEMENT during [PRIMARY DESIRE]:
    - Playing on floor with grandchildren — DOWN there, MOVING
    - Walking the dog — STRIDING, not shuffling
    - Tending garden — kneeling, hands in soil
    - Dancing with spouse — spontaneous kitchen dance

    MOVEMENT: Effortless. Natural. Body that WORKS.

    EXPRESSION: Genuine joy. Happiness of CAPABILITY restored. Natural [eye color].

    SETTING: [CULTURALLY APPROPRIATE]. Where desire lives.

    LIGHTING: Warm, natural, ALIVE.

    No text. No product.
    ```

    ---

    # PART 5: SECTION 1 — WOUND IMAGE (1:1)

    **Purpose:** Visualize the pain the copy describes. Deepen the emotional hook.

    **Tool:** Nanobanan | **Format:** 1:1

    ## When to Use
    - Always use unless hero already shows same scenario
    - Choose concept that matches the SPECIFIC pain in Section 1 copy

    ## Wound Concepts

    | Code | Name | Use When | The Moment |
    |------|------|----------|------------|
    | W1 | Three Feet Away | Missing moments | Subject in background, life in foreground — close but separated |
    | W2 | The Secret | Daily pain, morning stiffness | 5:47am moment — sitting on bed edge, gathering courage |
    | W3 | The Grave | Lost activities | Abandoned hobby — garden wild, instrument dusty |
    | W4 | The Lie | Hiding pain | Smile that doesn't reach eyes at gathering |
    | W5 | The Math | Trade-offs | Looking at grandchildren weighing joy vs aftermath |

    ### WOUND Prompt Template
    ```
    Photorealistic image. 1:1 format.

    THE MOMENT: [Specific private moment — the one they never show anyone]

    DEMOGRAPHIC: [From research — exact age, ethnicity, appearance]

    EXPRESSION: Raw, unguarded — exhaustion, grief, resignation. NOT theatrical. Natural [eye color].

    SETTING: [CULTURALLY APPROPRIATE private space]

    LIGHTING: Harsh, real, unflattering — the light of truth.

    This should feel like witnessing something private.

    No text. No product.
    ```

    ---

    # PART 6: SECTION 2 — UMP DIAGRAM (1:1)

    **Purpose:** Make the PROBLEM MECHANISM visible. Abstract becomes concrete.

    **Tool:** Nanobanan | **Format:** 1:1

    ## This is NOT Optional

    Section 2 explains WHY they have the problem. A diagram showing the mechanism is worth 500 words of explanation.

    ## Diagram Types

    | Type | Use When | Visual |
    |------|----------|--------|
    | **D1: Anatomical Attack** | Physical condition (joints, arteries, gut) | Cross-section showing damage in progress |
    | **D2: Process Diagram** | Cascade/chain reaction | Flow showing how problem develops |
    | **D3: Symbolic Attack** | Abstract problem (stress, fatigue) | Visual metaphor of what's being destroyed |

    ### D1: ANATOMICAL ATTACK
    ```
    Medical illustration. 1:1 format. Dark background.

    ANATOMY: [Specific body part from UMP — joint, artery, gut, brain region]

    THE ATTACK VISIBLE:
    - Inflammation: RED markers, swelling, heat indicators
    - Damage: Eroded tissue, rough surfaces, breakdown
    - Progression: Arrows showing spread/worsening

    COLOR CODING:
    - Healthy tissue: Blues, healthy pinks
    - Damage: Angry reds, sick yellows
    - Attack vectors: Sharp red arrows

    LABELS (in [TARGET LANGUAGE]):
    - "[Problem mechanism]" pointing to damage
    - "[Result]" pointing to symptoms
    - "Healthy vs Damaged" comparison if split view

    STYLE: Medical textbook meets emotional impact. Viewer should feel VIOLATED.

    Professional but alarming.
    ```

    ### D2: PROCESS DIAGRAM
    ```
    Process flow illustration. 1:1 format. Clean background.

    THE CASCADE:
    Step 1: [Trigger] → 
    Step 2: [Initial response] → 
    Step 3: [Escalation] → 
    Step 4: [Damage] → 
    Step 5: [Symptoms they feel]

    VISUAL FLOW:
    - Arrows connecting each stage
    - Each stage gets worse (colors darken, imagery intensifies)
    - Final stage shows the symptom they recognize

    COLOR PROGRESSION:
    - Start: Neutral greys
    - Middle: Warning yellows/oranges
    - End: Angry reds, damage visible

    LABELS (in [TARGET LANGUAGE]):
    - Each stage labeled simply
    - Time indicators if relevant ("Within hours...", "Over weeks...")

    STYLE: Clean, educational, but ALARMING progression.
    ```

    ### D3: SYMBOLIC ATTACK
    ```
    Symbolic illustration. 1:1 format.

    THE METAPHOR: [Match to abstract problem]
    - Energy drain → Battery being drained by dark tendrils
    - Mental fog → Clear head being clouded over
    - Vitality theft → Light being pulled from body
    - Stress damage → Pressure crushing/cracking

    VISUAL:
    - Clear "before" state (healthy, bright, intact)
    - Active destruction happening (not aftermath — IN PROGRESS)
    - Sense of urgency — this is happening NOW

    COLOR:
    - Healthy: Golds, vibrant blues, healthy pinks
    - Attacker: Dark, shadowy, consuming
    - Damage: Fading, draining, cracking

    EMOTION: Something precious being destroyed. Urgency to stop it.

    No text labels needed — visual is self-explanatory.
    ```

    ---

    # PART 7: SECTION 3 — COMPARISON DIAGRAM (1:1)

    **Purpose:** Show WHY other solutions failed. Visual proof they weren't crazy — they were misled.

    **Tool:** Nanobanan | **Format:** 1:1

    ## The Concept

    Section 3 discredits failed solutions. The diagram shows WHAT those solutions target vs WHAT actually causes the problem.

    ### C1: TARGETING COMPARISON
    ```
    Comparison diagram. 1:1 format. Clean split or layered design.

    LAYOUT: Two-panel or overlay showing contrast

    LEFT/TOP — WHAT THEY TARGET:
    - Failed Solution 1: [e.g., "Glucosamine"] → Points to [wrong target, e.g., "Cartilage"]
    - Failed Solution 2: [e.g., "Painkillers"] → Points to [wrong target, e.g., "Pain signals"]
    - Failed Solution 3: [e.g., "Rest"] → Points to [wrong target, e.g., "Symptoms"]

    RIGHT/BOTTOM — WHAT ACTUALLY CAUSES IT:
    - The REAL problem: [e.g., "Inflammatory cascade"] — UNTOUCHED by above solutions
    - Arrows showing failed solutions missing the target
    - Root cause glowing/highlighted as the IGNORED culprit

    COLOR CODING:
    - Failed solutions: Greyed out, ineffective
    - Wrong targets: Faded, secondary
    - Real cause: Angry red, highlighted, ACTIVE
    - Miss indicators: Dotted lines, X marks

    LABELS (in [TARGET LANGUAGE]):
    - "What [failed solution] targets"
    - "What's ACTUALLY causing the damage"
    - "MISSED" or "IGNORED" markers

    STYLE: Clear, damning comparison. Viewer should feel angry at wasted years/money.
    ```

    ### C2: THE SHIELD GAP
    ```
    Diagram showing protection failure. 1:1 format.

    VISUAL CONCEPT:
    - Multiple failed solutions shown as weak/partial shields
    - Each shield has GAPS where the real problem gets through
    - Arrows showing problem bypassing each "solution"

    THE REAL PROBLEM:
    - Shown as attacker easily passing through all defenses
    - Reaching the target (their health) unimpeded

    THE MESSAGE:
    - "They never protected you from THIS"
    - Gap in every failed solution visible

    LABELS (in [TARGET LANGUAGE]):
    - Each failed solution named on its weak shield
    - "Unprotected" or "Vulnerable" at the target

    EMOTION: Realization that they were never actually protected.
    ```

    ---

    # PART 8: SECTION 4 — UMS DIAGRAM (1:1)

    **Purpose:** Show HOW the solution mechanism works. Hope made visible.

    **Tool:** Nanobanan | **Format:** 1:1

    ## This is the TURN

    Section 4 is where despair becomes hope. The diagram shows the mechanism WORKING.

    ### M1: THE SHIELD (Protection Mechanism)
    ```
    Medical illustration. 1:1 format.

    THE SCENE: [ANATOMY] being PROTECTED by the mechanism.

    VISUAL:
    - Golden/blue energy shield surrounding healthy tissue
    - Inflammatory attackers being BLOCKED, bouncing off
    - Healthy tissue thriving BEHIND protection
    - Clear contrast: chaos OUTSIDE, peace INSIDE

    COLOR:
    - Protection: Golden light, healthy blues
    - Attackers: Faded, weakened, held at bay
    - Protected tissue: Vibrant, healthy pinks

    LABELS (in [TARGET LANGUAGE]):
    - "[Key ingredient]" → protection mechanism
    - "Blocked" → attackers
    - "Protected" → healthy tissue

    EMOTION: RELIEF. Safety. The cavalry arrived.
    ```

    ### M2: THE RESTORATION (Healing Mechanism)
    ```
    Medical illustration. 1:1 format.

    THE SCENE: [ANATOMY] being REBUILT.

    VISUAL:
    - Damaged tissue being replaced with healthy growth
    - Golden light spreading through damaged area
    - Inflammation retreating
    - Clear progression: damage → healing → restored

    STYLE: Timelapse feeling — transformation in progress.

    COLOR:
    - Healing: Golden glow, healthy pinks returning
    - Damage: Retreating, fading
    - New tissue: Vibrant, strong

    LABELS (in [TARGET LANGUAGE]):
    - "Before" / "During" / "After" stages
    - Key ingredient action points

    EMOTION: HOPE. Renewal. Body remembering how to be healthy.
    ```

    ### M3: THE INTERRUPTION (Cascade Blocker)
    ```
    Process diagram. 1:1 format.

    THE CONCEPT: Same cascade from D2 (UMP diagram) but NOW INTERRUPTED.

    VISUAL:
    - Same process flow as problem diagram
    - But NOW: Intervention point clearly marked
    - Solution STOPS the cascade mid-flow
    - Downstream damage PREVENTED

    BEFORE INTERVENTION: Red, angry, progressing
    AFTER INTERVENTION: Calm, blue, stopped

    LABELS (in [TARGET LANGUAGE]):
    - "The [Product] Intervention"
    - "Cascade STOPPED"
    - "Damage PREVENTED"

    EMOTION: Control. Finally something that works at the SOURCE.
    ```

    ---

    # PART 9: SECTION 5 — PRODUCT INFOGRAPHIC (1:1)

    **Purpose:** Show the product as the delivery system. Build trust through transparency.

    **Tool:** Nanobanan | **Format:** 1:1

    ## Two Options (Choose One or Both)

    ### P1: INGREDIENTS INFOGRAPHIC
    ```
    Product infographic. 1:1 format.

    [PRODUCT NAME] bottle CENTER — realistic (30-40% frame height).

    BACKGROUND: Clean gradient appropriate to THEME:
    - Health: Soft greens to white
    - Medical: Clinical blue gradient
    - Beauty: Dusty rose to cream
    - Energy: Warm orange to white
    - Calm: Soft lavender to white

    INGREDIENTS: 3-4 key ingredients with icons radiating from bottle:
    - [Ingredient 1]: "[Benefit — 1-6 words]" + simple icon
    - [Ingredient 2]: "[Benefit]" + icon
    - [Ingredient 3]: "[Benefit]" + icon
    - [Ingredient 4]: "[Benefit]" + icon

    CALLOUTS:
    - Dosage/potency if impressive
    - "Clinically studied" if applicable
    - Key differentiator

    STYLE: Professional photography meets clean infographic. Premium aesthetic.

    TEXT IN [TARGET LANGUAGE].
    ```

    ### P2: RESULTS TIMELINE
    ```
    Timeline infographic. 1:1 format.

    VISUAL: Horizontal or vertical timeline showing progression

    STAGES:
    - Day 1-3: [Initial effect — what they notice first]
    - Week 1: [Building benefit]
    - Week 2: [Noticeable change]
    - Week 4: [Significant results]
    - Week 8+: [Full transformation]

    VISUAL PROGRESSION:
    - Early stages: Smaller, subtle indicators
    - Later stages: Larger, more vibrant indicators
    - Progress bar or growing visual element

    COLOR PROGRESSION:
    - Start: Neutral
    - End: Vibrant, healthy, goal achieved

    LABELS (in [TARGET LANGUAGE]):
    - Each stage clearly labeled with timeframe
    - Specific benefits at each stage

    STYLE: Clean, professional, builds anticipation.
    ```

    ---

    # PART 10: SECTION 6 — FAQ IMAGE (1:1)

    **Purpose:** Add credibility. Usually SKIP — text-heavy section.

    **Tool:** Nanobanan | **Format:** 1:1

    ## When to Include
    - Only if you have a strong expert quote to visualize
    - Or if section is unusually long and needs visual break

    ### F1: EXPERT PORTRAIT (Optional)
    ```
    Professional portrait. 1:1 format.

    SUBJECT: [Expert type relevant to mechanism]
    - Doctor in white coat
    - Researcher in lab setting
    - Nutritionist in professional setting

    APPEARANCE:
    - Professional, trustworthy
    - Appropriate age (45-65)
    - [ETHNICITY matching target market]
    - Warm but authoritative expression

    SETTING: Professional but not sterile
    - Office with books/credentials visible
    - Lab with equipment
    - Clinical but welcoming

    LIGHTING: Professional, flattering, trustworthy.

    SMALL TEXT OVERLAY (optional):
    - Name and credentials
    - Or: Key quote excerpt

    EMOTION: "You can trust this information."
    ```

    ### SKIP RATIONALE
    ```
    Section 6 is FAQ — text-heavy Q&A format. Images can distract from objection-handling. Skip unless:
    - Section is very long (5+ FAQs)
    - You have specific expert quote to feature
    - Visual break is needed for flow
    ```

    ---

    # PART 11: SECTION 7 — TRANSFORMATION IMAGE (1:1)

    **Purpose:** Show WHO they've become. Identity marketing visualized. This is the emotional CLIMAX.

    **Tool:** Nanobanan (portrait) | **Format:** 1:1

    ## Always Include — Choose Best Fit

    ### T1: THE RECLAMATION (Action)

    **Tool:** Nanobanan
    ```
    Cinematic photograph. 1:1 format. MOTION and JOY.

    SUBJECT: [DEMOGRAPHIC] DOING the thing they couldn't do. FULLY ENGAGED.

    THE ACTIVITY: [PRIMARY DESIRE]
    - On floor with grandchildren — not watching, PLAYING
    - In garden — kneeling, digging, ALIVE
    - Walking with spouse — MATCHING pace, hand in hand
    - At family gathering — STANDING, CENTER of life

    BODY LANGUAGE:
    - FLUID movement — no hesitation
    - Open posture — expansive
    - Engaged with others — PARTICIPATING

    EXPRESSION: Unguarded joy. Happiness of CAPABILITY restored. Natural [eye color].

    SETTING: [CULTURALLY APPROPRIATE]. Location of desire.

    LIGHTING: Warm, golden, ALIVE.

    No text. Small product in corner optional.
    ```

    ### T2: THE RECOGNITION (Portrait)

    **Tool:** Nanobanan
    ```
    Portrait photograph. 1:1 format.

    SUBJECT: [DEMOGRAPHIC] in moment of quiet PRIDE.

    THE MOMENT: Looking at camera OR mirror — RECOGNIZING themselves.

    EXPRESSION:
    - Pride: "I did this. I'm back."
    - Peace: No longer fighting every day
    - Confidence: Knowing they can
    - Vitality: Light in eyes
    Natural [eye color].

    NOT manic happiness. QUIET STRENGTH. Dignity of reclaimed identity.

    SETTING: [CULTURALLY APPROPRIATE home]. Their space.

    LIGHTING: Warm, flattering. Lighting of good days.

    WARDROBE: [CULTURALLY APPROPRIATE]. Intentional — dressed like someone with PLANS.

    No text. Small product optional.
    ```

    ### T3: THE WITNESS (Family Recognition)

    **Tool:** Nanobanan
    ```
    Photorealistic image. 1:1 format.

    COMPOSITION: [DEMOGRAPHIC] foreground. Family member reacting in background.

    THE SUBJECT: Doing something they couldn't before. Rising easily. Coming downstairs. Joining activity.

    THE WITNESS: Adult child or spouse watching. Expression of:
    - Surprise
    - Relief
    - Joy
    - "They're BACK"

    Subject may not notice being watched. Just LIVING.

    EMOTION: Transformation witnessed. Family seeing who returned.

    No text. No product.
    ```

    ---

    # PART 12: SECTION 8 — PRODUCT IMAGE (1:1)

    **Purpose:** Clean, professional product shot. Reinforces what they're getting before CTA.

    **Tool:** Nanobanan | **Format:** 1:1

    ## Always Include

    Section 8 is the offer. Show them exactly what they're getting — clean, aspirational, premium.

    ### O1: CLEAN PRODUCT SHOT
    ```
    Product photography. 1:1 format.

    [PRODUCT NAME] bottle as HERO — centered, prominent (50-60% frame height).

    BACKGROUND: Clean, premium, matches THEME:
    - Health: Soft green gradient or white with subtle green accents
    - Medical: Clean white/light blue, clinical but warm
    - Beauty: Dusty rose gradient, elegant
    - Energy: Warm cream/orange tones
    - Calm: Soft lavender/white gradient

    LIGHTING: Professional studio lighting
    - Soft shadows
    - Slight reflection on surface
    - Premium, aspirational feel

    COMPOSITION:
    - Bottle slightly angled (not flat front)
    - Label clearly visible
    - Clean negative space around product

    OPTIONAL ELEMENTS (subtle):
    - Single ingredient element (leaf, herb) if natural product
    - Soft glow/highlight around bottle
    - Premium surface (marble, clean white)

    STYLE: E-commerce hero shot meets lifestyle premium. This is what arrives at their door.

    NO text overlays. NO price. NO badges. Just the product looking its best.
    ```

    ---

    # PART 13: OUTPUT FORMAT

    ```markdown
    # IMAGE PROMPTS: [PRODUCT_NAME] Advertorial

    ## Research Summary
    - Target Market: [Country]
    - Language: [Language]  
    - Demographic: [Age] [Gender] [Ethnicity]
    - Primary Fear: [Fear] → Hero Type Selection
    - Primary Desire: [Desire] → Transformation Type Selection
    - UMP: [Problem mechanism]
    - UMS: [Solution mechanism]
    - Key Ingredients: [List]

    ---

    ## HERO VERSION 1 — Recognition (RECOMMENDED)
    **Tool:** Nanobanan | **16:9    **Type:** [1A-1F]
    **Fear:** [Specific fear]

    [Full prompt]

    ---

    ## HERO VERSION 2 — Transformation
    **Tool:** Nanobanan | **16:9    **Type:** [2A-2C]
    **Mechanism:** [UMP visual]

    [Full prompt]

    ---

    ## HERO VERSION 3 — Aspiration (A/B Test)
    **Tool:** Nanobanan | **16:9    **Desire:** [Primary desire]

    [Full prompt]

    ---

    ## SECTION 1: Hook/Wound
    **Tool:** Nanobanan | **1:1    **Type:** [W1-W5]
    **Pain Point:** [From Section 1 copy]

    [Full prompt]

    ---

    ## SECTION 2: Education/UMP — DIAGRAM
    **Tool:** Nanobanan | **1:1    **Type:** [D1-D3]
    **Mechanism:** [UMP]

    [Full prompt]

    ---

    ## SECTION 3: Discredit — COMPARISON DIAGRAM
    **Tool:** Nanobanan | **1:1    **Type:** [C1-C2]
    **Failed Solutions:** [From copy]

    [Full prompt]

    ---

    ## SECTION 4: Mechanism/UMS — DIAGRAM
    **Tool:** Nanobanan | **1:1    **Type:** [M1-M3]
    **Mechanism:** [UMS]

    [Full prompt]

    ---

    ## SECTION 5: Product — INFOGRAPHIC
    **Tool:** Nanobanan | **1:1    **Type:** [P1 and/or P2]

    [Full prompt for ingredients]

    [Full prompt for timeline — if using both]

    ---

    ## SECTION 6: FAQ
    **SKIP** — Text-heavy objection handling. [OR include F1 if needed]

    ---

    ## SECTION 7: Transformation
    **Tool:** Nanobanan | **1:1    **Type:** [T1-T3]
    **Identity:** [From Section 7 copy]

    [Full prompt]

    ---

    ## SECTION 8: Offer — PRODUCT SHOT
    **Tool:** Nanobanan | **1:1    **Type:** O1

    [Full prompt]
    ```

    ---

    # PART 14: QUICK REFERENCE

    ## Complete Image Map

    | Section | Image Type | Format | Tool |
    |---------|------------|--------|------|
    | Hero | Recognition/Transform/Aspire | 16:9 | Nano/Nano/Soul |
    | Section 1 | Wound portrait | 1:1 | Nanobanan |
    | Section 2 | UMP Diagram | 1:1 | Nanobanan |
    | Section 3 | Comparison Diagram | 1:1 | Nanobanan |
    | Section 4 | UMS Diagram | 1:1 | Nanobanan |
    | Section 5 | Product Infographic | 1:1 | Nanobanan |
    | Section 6 | Skip (or Expert) | 1:1 | Nanobanan |
    | Section 7 | Transformation | 1:1 | Soul/Nanobanan |
    | Section 8 | Clean Product Shot | 1:1 | Nanobanan |

    ## Diagram Type Selection

    | UMP Type | Diagram |
    |----------|---------|
    | Physical damage (joints, arteries) | D1: Anatomical Attack |
    | Process/cascade (inflammation, oxidation) | D2: Process Diagram |
    | Abstract (stress, fatigue, brain fog) | D3: Symbolic Attack |

    | UMS Type | Diagram |
    |----------|---------|
    | Protection/blocking | M1: The Shield |
    | Repair/restoration | M2: The Restoration |
    | Interruption/stopping cascade | M3: The Interruption |

    ## Fear → Hero Mapping

    | Fear | Hero |
    |------|------|
    | Missing moments | 1A: Missed Moment |
    | Being a burden | 1B: The Look |
    | Losing independence | 1C: The Pause |
    | Being left out | 1D: The Window |
    | Fear of decline | 1E: The Shadow |
    | Family isolation | 1F: Empty Chair |

    ---

    ## Final Checklist

    **Research Extracted:    - [ ] Demographics exact (age, ethnicity, appearance)
    - [ ] Cultural context documented
    - [ ] Primary fear → Hero selection
    - [ ] Primary desire → Transformation selection
    - [ ] UMP → Diagram type selected
    - [ ] UMS → Diagram type selected
    - [ ] Key ingredients listed

    **Images Generated:    - [ ] 3 Hero versions (Recognition, Transformation, Aspiration)
    - [ ] Section 1: Wound image
    - [ ] Section 2: UMP Diagram
    - [ ] Section 3: Comparison Diagram
    - [ ] Section 4: UMS Diagram
    - [ ] Section 5: Product Infographic (+ Timeline optional)
    - [ ] Section 6: Skip justified (or Expert if needed)
    - [ ] Section 7: Transformation image
    - [ ] Section 8: Clean Product Shot

    **Quality Standards:    - [ ] All demographics EXACT match
    - [ ] All settings culturally appropriate
    - [ ] All eye colors natural
    - [ ] All diagram labels in TARGET LANGUAGE
    - [ ] No "bright/piercing/vivid" eyes
    - [ ] No theatrical expressions
    - [ ] Formats correct (16:9 hero, 1:1 sections)

    **Total Images: 8-10** (3 hero options + 6-7 section images)

    ---
    Offer Brief: 
    {offer_brief}
    Completed Advertorial Copy:
    {completed_advertorial_copy}

    ## END OF ADVERTORIAL IMAGE SOP

    """


def get_advertorial_rewrite_prompt_customer_pov(avatar_info: str, angle_info: str, offer_brief: str):
    return f"""

    Folder highlights
    Advertorial content includes an HTML template and detailed SOPs for generating emotionally resonant imagery and a customer-focused narrative, centering on a joint pain solution.

    # AI ADVERTORIAL SOP
    ## By Owen Clary | Manual Revision 1/29

    ---

    ## CRITICAL: STRATEGIC INTELLIGENCE BRIEF REQUIREMENT

    **PREREQUISITE:** You MUST be provided with a completed Strategic Intelligence Brief (created using the Synthesis & Strategy SOP). This brief contains all strategic decisions already made.

    ### THE INPUT CONTAINS (DO NOT RECREATE):
    Avatar_info:
    - ✓ THE ONE AVATAR (already identified and scored)

    Angle_info:
    - ✓ THE ONE ANGLE (already forced/selected from research)

    Offer_brief:
    - ✓ THE DESIRE (already forced/selected from research)
    - ✓ THE ONE (already forced/selected from research)
    - ✓ THE ONE PROBLEM (already forced/selected from research)
    - ✓ Sophistication Stage (3, 4 or 5 - already determined)
    - ✓ All proof points, studies, quotes (from actual research)
    - ✓ UMP (Unique Mechanism of Problem) - already defined
    - ✓ UMS (Unique Mechanism of Solution) - already defined
    - ✓ Product-mechanism connection - already mapped

    This is given as input at the end of this prompt.

    ### YOUR ROLE:
    Execute the advertorial structure using the intelligence provided in the Strategic Intelligence Brief as your PRIMARY source.

    **DO NOT:**
    - ❌ Create new angles or pivot from the forced angle
    - ❌ Deviate from the UMP/UMS definitions
    - ❌ Ignore the sophistication stage determination

    **DO:**
    - ✅ Use quotes from the brief's quote library
    - ✅ Follow the forced angle mechanism exactly as defined
    - ✅ Use documented failed solutions
    - ✅ Start with the provided proof points (you may add supporting statistics)
    - ✅ Match the sophistication approach (Stage 3, 4 or 5)
    - ✅ Pull from avatar's exact fears/desires in the brief
    - ✅ Use the brief's transformation timeline
    - ✅ Follow the brief's copy direction guidance

    ### WHERE TO FIND EACH ELEMENT:
    | Element | Location |
    |---------|----------|
    | Avatar details | Avatar_info |
    | Forced angle/mechanism | Angle_info |
    | Proof points | Offer_brief (use these + add supporting stats) |
    | Big Ideas | Offer_brief |
    | Stage-specific approach | Offer_brief |
    | Transformation details | Offer_brief |
    | Product connection | Offer_brief |
    | Copy direction | Offer_brief |
    | Quote library | Offer_brief |

    ---

    ## INTERPRETING THE STRATEGIC BRIEF

    The Strategic Brief provides scored Avatar, Angle, Stage, and ranked research data. Your job is to combine these elements intelligently:

    **THE FORMULA:** Avatar + Angle + Stage = What to emphasize

    The Fear/Desire Ranking Tables show INTENSITY and breadth of research, not necessarily what to lead with. Filter all ranked data through the Avatar-Angle-Stage lens to determine copy direction.

    **Key Principle:** Use the ranking tables as DATA to pull from, informed by what the Avatar-Angle-Stage combination tells you to emphasize. If a secondary symptom ranks #1 in fear intensity BUT the Avatar is about a different primary issue and the Angle addresses that primary issue, then the secondary symptom is a SUPPORTING detail that proves the problem is serious, not the primary hook.

    ---

    ## TONE

    ### UGC Customer Story (Default, Priority Option)
    - **Narrator:** Customer who discovered the product
    - **Tone:** Personal blog post / testimonial
    - **Best for:** Most health supplements, mass market offers, relatability-driven sales
    - **Use:** "I" and "you" constantly
    - **Structure:** "I struggled with [problem] for years until I found this..."

    Framework A (Customer Story): Write as a personal story from YOUR perspective. Tell the reader about your pain, what you discovered, what failed, what finally worked, and how you feel now. Use "I" and "you" constantly. Write so simply that a 3rd grader could understand every sentence.

    ---

    ## STEP 1: EXTRACT FROM STRATEGIC INTELLIGENCE BRIEF (Do This First)

    Before writing a single word, extract these elements from your Strategic Intelligence Brief:

    ### A. THE FORCED ANGLE
    ```
    Angle Name: [Extract from brief]
    UMP (Unique Mechanism of Problem): [Extract exact wording from Section 2.1]
    UMS (Unique Mechanism of Solution): [Extract exact wording from Section 7.1]
    One-Sentence Mechanism: [Copy verbatim from Section 2.1]
    Child-Friendly Analogy: [Copy verbatim from Section 2.1]
    ```

    ### B. THE ONE AVATAR
    ```
    Top Fear: [Extract from Section 1.3 - Fear Ranking Table]
    Top Desire: [Extract from Section 1.4 - Desire Ranking Table]
    Top 5 Failed Solutions: [Extract from Section 1.5]
    Demographics: [Extract from Section 1.1 - age, gender, life stage]
    ```

    ### C. SOPHISTICATION APPROACH (Executive Summary of Brief)
    ```
    Lead with: [New Mechanism (State 3) or Mechanism-first (Stage 4) or Identification-first (Stage 5) per brief]
    ```

    ### D. AVATAR BELIEFS
    ```
    ANSWER: What are the current beliefs of the market?
    ANSWER: What are the current beliefs around your product?
    ANSWER: What are the most common objections?
    ANSWER: What are the claims that sound too good to be true?
    ```

    ### E. KEY PROOF POINTS
    ```
    Top Study:
    Top Expert:
    Top Statistic:
    Top 10 Proof Points/Supporting Statistics
    ```

    DO NOT proceed until you've confirmed you have the Strategic Intelligence Brief and can extract these elements. Save this to use when needed in the advertorial.

    ---

    ## STEP 2: REFERENCE BRIEF INTELLIGENCE THROUGHOUT

    As you write each section, take note of this data and use it when necessary, from the Strategic Intelligence Brief:

    → "Identification Markers" for "That's Me" triggers
    → Quotes from "Fear Quotes"
    → Follow sophistication approach
    → "UMP" definition - this is your enemy
    → "Proof Points" for studies
    → "Mechanism Language Bank" for terminology
    → Add supporting statistics to reinforce the UMP
    → "Failed Solutions" - these are what they tried
    → "Failure Explanation Matrix" for why each failed
    → Exact quotes from "Failure Quotes"
    → "UMS" definition - this is your solution mechanism
    → "How Product Addresses Mechanism"
    → Supporting data and statistics to validate the UMS
    → "Product-Mechanism Connection"
    → "Ingredient-Mechanism Map"
    → "Transformation Timeline" for benefits/timeline
    → "Competitive Differentiation"
    → "Current State" for before state
    → "Future State" for after state
    → Exact quotes from quote banks
    → "Pre-Purchase Objections"
    → "Belief System" for belief shifts needed
    → Reference avatar's skepticism patterns
    → Counter specific objections listed in brief

    ---

    ## PSYCHOLOGY RULES

    We follow the rule of one, ONE desire, ONE avatar, ONE angle, ONE outcome, ONE problem, ONE mechanism. Sticking to the rule of one creates the strongest argument.

    What is the role your product offers to your prospect? We all have an image of ourselves, or a sense of who we are; this is called our self-image. We don't just buy objects, we buy roles. We identify the identity of potential customer is and leverage that in our marketing, using our product as a bridge to who they want to be.

    Your customers' mental picture of the world they live in. People believe in certain ways. These beliefs form a filter through which your product must pass or be rejected. The advertorial MUST fit in with your customers version of "facts".

    We leverage our CUSTOMERS logic, not our own, to prove that the product works, to prove that people with their belief system rely on your product, and prove no other product satisfies his specific needs as well.

    - Channel their beliefs
    - The dominant Desire makes up the content for our advertorial
    - The Identity in which they define themselves will determine the picture we paint in their head
    - The Beliefs of your customer will determine the development of the advertorial
    - The customer must have conviction that the desires & identity you are claiming/showing will in fact come true through your product. (If your customer does not have BELIEF … they will NOT buy.)

    ---

    ## CRITICAL RULE: HIDE THE MECHANISM IN THE HOOK/LEAD

    In the Hook and Lead sections, NEVER reveal what the mechanism/solution actually is.

    Only refer to it as:
    - "this"
    - "it"
    - "a simple method"
    - "what I discovered"
    - "a breakthrough"
    - "the real cause"
    - "the missing piece"

    Why? This creates a curiosity gap. Readers MUST keep reading to find out what "it" is.

    ---

    ## ⚠️ CRITICAL RULE: PRODUCT NAME SATURATION AFTER PRODUCT REVEAL

    Once the product is introduced in Section 5, use the product name whenever you're talking about the solution, the product, or the mechanism. Tie benefits directly to the product name — never orphan a benefit.

    **Examples:**

    **❌ WRONG (Orphaned Benefits):**
    - "It reduces [problem] in the [body part]."
    - "This supplement cleared my [symptom]."
    - "The formula contains high-dose [ingredient]."

    **✅ RIGHT (Product-Tied Benefits):**
    - "[PRODUCT NAME] reduces [problem] in the [body part]."
    - "[PRODUCT NAME] cleared my [symptom] in just 2 weeks."
    - "[PRODUCT NAME]'s formula contains high-dose [ingredient]."

    ---

    ## STEP 3: ADVERTORIAL STRUCTURE

    Each section has ONE job: Pull them into the next section while reinforcing the Big Idea.

    ---

    ### SECTION 1: THE HOOK (Most Critical Section)

    **Structure:** Main Headline → Subheadline → Opening Lead

    **The Hook Must Do 3 Things:**
    1. STOP THE SCROLL – Pattern interrupt with shocking claim
    2. CREATE CURIOSITY GAP – Tease transformation without revealing how
    3. ESTABLISH CREDIBILITY – New research, doctor discovery, clinical study

    ⚠️ IMPORTANT: Do NOT reveal the mechanism here. Only tease it.

    #### OPENING HOOK

    - Enter an existing desire or fear the reader already feels
    - Speak in the reader's own internal language
    - Begin at their current level of awareness
    - Intensify emotion, do not explain
    - Hint at a vital cause or answer without revealing it
    - Create curiosity by withholding resolution
    - Remember: the hook's sole purpose is to force the reader to read the next line

    #### LEAD (After Headline)

    ⚠️ REMINDER: Keep referring to the solution as "this," "it," or "what I discovered." Do NOT name the mechanism yet.

    The lead section immediately follows your headline. Its job is to hook them emotionally, validate their pain, establish your credibility, and open the curiosity loop. Use short, punchy sentences mixed with complete sentences for rhythm.

    **1. CALL OUT THE PAIN / YES TRAIN**

    Ask a question that makes them say "Yes, that's me!" Make it specific and relatable.

    Stack 2-5 more pain questions. Use exact experiences from Section 1.8 of your brief. Each question should feel increasingly specific and personal.

    Example:
    ```
    "Are you struggling to get to the gym every day?
    Feel like you don't have time to get a good workout in?
    Tired of being judged or stared at in commercial gyms
    Don't want to spend $1,000's on at-home equipment?
    So you just give up on your fitness goals entirely?
    Then you've experienced what millions of others have"
    ```

    **2. SYMPTOMS**

    Detail the symptoms or problems that are customers' reasons for NEEDING your product. Prove that you have been there yourself, therefore your recommendations will help answer their problems - your shared problems.

    Example:
    ```
    "Every time I would put on my sock I debated whether or not to even wear them.
    That's if they didn't stink out the entire locker room first, of course.
    The thin socks supposedly provide more grip
    But all they ever do is rip.
    And then as soon as you try thicker socks.
    They suffocate your feet & you feel like you're wearing clown shoes on the ice."
    ```

    **3. AUTHORITY**

    Come out bluntly & Acknowledge the current beliefs, but be prepared to show with strong authority the new beliefs you wish to instill onto your customer.

    You are not looking for agreement, you are loosening previous beliefs to create new ones - that serve your customer better.

    Share your research journey (time spent, studies read, things tested) or share your professional credentials and experience. Make them trust that you've done the work to find the answer.

    Example:
    ```
    "Forget everything you've ever heard or read about what age "must-do" to your appearance.
    Forget everything you have ever believed about how "old" you look at thirty, forty, fifty, or even sixty…
    Because you are about to enter a new world of aging.
    A world where scientific studies
    $2,000,000 of my own money
    and evidence that shows how aging can not only be slowed…
    But reversed"
    ```

    **4. HINT AT THE SOLUTION**

    Make them NEED to keep reading. Promise to show them the mechanism to get to their specific desire.

    ---

    ### SECTION 2: EDUCATION / LOGIC (1 Headline)

    **Purpose:** Shift their beliefs with BULLET PROOF LOGICAL THINKING. Reveal the UMP (Unique Mechanism of PROBLEM). Validate their instincts. Make them understand WHY they have this problem.

    Now you can name what the problem actually is. Educate them on science with lots of data backing it up.

    **Reveal the UMP (Unique Mechanism of PROBLEM)**

    Call out the specific problem. Prove WHY they have the problem works through bulletproof logical thinking. One statement leading seamlessly into another. Each statement progressively makes it more clear.

    The reader has not only been told why they have the problem, they have been shown PROOF why they have it. Explain it at a 5th grade reading level.

    **Include specific data/studies**

    Use Tier 1 proof points from Section 3.1 of your brief. Add supporting statistics to reinforce the explanation of the problem. Include study size, results, and timeframe, statistics proving how common this problem is or how important the mechanism of the problem is to WHY they have the problem. This should be 4-5 bullet points of claims about the problem with statistical data backing them up.

    **Validate Their Instincts**

    After revealing the UMP, immediately add empowerment validation. Tell them their instincts were right all along. List the things they knew were wrong (it didn't feel like "just aging," the supplements weren't working, something deeper was going on). Then validate: "You were RIGHT. The problem wasn't you. The problem was everyone was looking in the wrong place."

    Why this works: Builds trust and shifts from "I'm broken" to "I was right, the system failed me."

    **Show the danger of ignoring it**

    Make a claim why they should not ignore this problem then show data proving the risks if they don't solve it. Include specific timeframes and measurable worsening. This should be 4-5 bullet points of threats each with statistical data backing them up.

    **Tease about the solution to this problem they now understand**

    Tease them to read the next paragraph to learn about the unique way to solve this problem they now understand.

    ---

    ### SECTION 3: DISCREDIT OTHER SOLUTIONS (1 Headline)

    **Purpose:** Close off escape routes. Show why everything they've tried has failed. Make them feel they must keep reading to find the right solution.

    **Systematic Debunking Structure**

    For EACH failed solution, use this exact 4-part pattern:
    1. Name it
    2. Specific flaw
    3. Tie to UMP ("Doesn't address [UMP]")
    4. Build frustration

    Example: "[Solution]? [Specific flaw]. Doesn't address [UMP]. [Consequence]."

    Pull failed solutions from Section 1.5 of your Strategic Intelligence Brief. Pull "why it failed" explanations from Section 2.3 (Failure Explanation Matrix) of your brief. Do this for 3-4 solutions rapid-fire.

    After debunking each solution, show potential harm. Explain how some solutions actually made the problem worse or had negative side effects. Use quotes from Appendix A.3 of your brief.

    You needed something different that actually addressed the UMP. Keep connecting back to the Big Idea and the UMP.

    Don't completely shut down every solution though, show some respect to them and validate where they were right, but make it clear it wasn't the best approach. Showing some respect to competition maintains trust.

    Proceed to hint at the one solution you found that works where these specifically failed in the next paragraph.

    ---

    ### SECTION 4: INTRODUCE THE UNIQUE MECHANISM (1 Headline)

    This is where you go DEEP on the unique mechanism — but NOT the product yet.

    **Purpose:** Close the curiosity loop on the mechanism. Reveal the UMS (Unique Mechanism of SOLUTION). Make the reader fully buy into WHY this specific mechanism is the answer. Build logical inevitability before introducing the product.

    **NO PRODUCT NAME IN THIS SECTION.** You're selling the MECHANISM first. The product comes next.

    **Structure:**

    **Reveal the Unique Mechanism**

    NAME AND INTRODUCE THE UNIQUE MECHANISM from Section 7.1 of your Strategic Intelligence Brief. This must DIRECTLY solve the UMP from Section 2. Prove WHY this mechanism solves the problem works through bulletproof logical thinking. One statement leading seamlessly into another. Each statement progressively makes it more clear. Connecting perfectly back to why they have the problem.

    The reader has not only been told why this mechanism solves the problem they understand they have been shown PROOF why it solves it. Explain it at a 5th grade reading level.

    **Include specific data/studies**

    Add supporting statistics to reinforce the explanation of the problem. Include study size, results, and timeframe, statistics proving why and how this mechanism solves this problem. This should be 4-5 bullet points of claims about the mechanism with statistical data backing them up. Pull from Section 3.1 and 3.2 of your brief (Tier 1 and Tier 2 proof points). Add supporting statistics to validate the mechanism. Include study size, institution, results, timeframe. Quote experts from Section 3.1 (Tier 2) who validate this mechanism.

    **Explain Why This UMS Is Different**

    Pull from Section 7.3 (Competitive Differentiation) of your brief. Position against generic solutions. Explain why most approaches miss this entirely and why this mechanism targets the actual root cause.

    **Bullet proof benefits of this mechanism**

    Make claims about how benefits this mechanism is to their life. Include specific timeframes and measurable benefits. This should be 4-5 bullet points of benefits and outcomes each with statistical data backing them up. These benefits / outcomes should relate to the core desire of your avatar or describe who they want to be (identification).

    **Curiosity Bridge to the Product**

    Set up the natural question: "How do you actually get this?" Most solutions don't use this mechanism or the ones that do don't contain enough to matter. Hint at the reader your about to reveal where to actually get this.

    **Key Rules for Section 4:**
    - Go DEEP on the UMS - make them fully understand and believe in it
    - Use data, studies, and expert quotes to build credibility
    - Make it feel like discovering the mechanism was the breakthrough
    - Add the "Professional Secret" angle for David vs. Goliath positioning
    - End with natural bridge to "how do I actually get this?" - setting up the product
    - NO product name yet - this section is mechanism-focused

    ---

    ### SECTION 5: INTRODUCE THE PRODUCT (1 Headline)

    **THIS IS WHERE PRODUCT NAME SATURATION BEGINS.**

    **Purpose:** Position the product as THE best delivery system for the mechanism they now believe in. Close the loop. Show proof it works.

    From this point forward, use [PRODUCT NAME] whenever discussing the solution. Tie every benefit, every mechanism, every proof point directly to [PRODUCT NAME].

    **Structure:**

    **1. Introduce the Product**

    Introduce the product as the best delivery for the unique mechanism you found X time searching.

    **2. What [PRODUCT NAME] Is + Why It's the Best Delivery of [UMS]**

    Immediately connect the product to the UMS they now believe in. Show that [PRODUCT NAME] is the ONLY formula that delivers this specific solution.

    **3. How [PRODUCT NAME] Works (Connect to Mechanism)**

    Show the mechanism in action through the product. Reference the UMP again and explain how [PRODUCT NAME] addresses it directly.

    Explain the delivery system or technology that ensures absorption/effectiveness.

    Show the progression: within days, within weeks (2 weeks max), long-term. Emphasize that it fixes at the source, not just masks symptoms.

    Prove your product works through bulletproof logical thinking. One statement leading seamlessly into another.

    The reader has not only been told that it works, he has been shown PROOF that it works.

    **4. Why [PRODUCT NAME] Is Better (Aggressive Comparison)**

    Explain what makes it succeed where other products went wrong as explained in section 3. Pull from Section 7.3 (Competitive Differentiation) of your brief. Be direct and confident. Compare to cheap alternatives and show the specific advantage (dosage, technology, formulation quality, what others miss).

    **6. [PRODUCT NAME] Benefits List (Use Bullets Here)**

    Create a bulleted list showing specific improvements with timeframes 4-6 major benefits. Each bullet should include: specific outcome in x days or weeks (2 weeks max) using X unique mechanism statistic. All tied to main desire. Make each benefit aggressive and specific.

    **7. Hint At the Objections they have**

    Validate their specific skepticism and questions (pull from strategy doc) and tell them you will counter their objections or answer their questions in the next paragraph.

    ---

    ### SECTION 6: FAQ / OBJECTION HANDLING (1 Headline)

    **Purpose:** Answer doubts. Crush objections. Increase perceived value. Be confident – not defensive.

    Pull objections from Section 1.7 (Pre-Purchase Objections) of your Strategic Intelligence Brief.

    **Transition Into Section:**
    "But here's what people always ask me..."

    **Address 4-7 Common Objections**

    Format each as: Q: [Question including product name] followed by a confident, aggressive answer.

    Pull objection types from Section 1.7 of your brief. Common objections or questions to address:
    - Answer questions about both the problem mechanism, solution mechanism and the product.
    - Come out bluntly & Acknowledge the current beliefs, questions or objection,
    - For each answer, be confident and direct. Include specific data, percentages, or proof. Don't be defensive.

    Answer the objection or answer through bulletproof logical thinking. One statement leading seamlessly into another.

    The reader has not only been told the answers, he has been shown PROOF for the answer.

    ---

    ### SECTION 7: YOUR TRANSFORMATION (Identification Outcome) (1 Headline)

    **Purpose:** Paint a picture of your avatar becoming who they want to become, with your product as the bridge to that identity. Make them FEEL the outcome. Write this as your personal story (If Framework A) or describing their story (Framework B).

    **Ask Yourself:**
    - What is the role your product offers to your prospect?
    - How do I associate & turn my product into an "instrument" for my customer to use in order to achieve that role?
    - Where does my ideal customer want to be? (environment to show in the visual)
    - What does my ideal customer want to look like? (The model)
    - What does my ideal customer want to feel? (the story of the ad)
    - What self image do my customers want to portray? (The expression)

    **DEFINITION OF IDENTIFICATION:**

    The desire of your customer to act out certain roles in their life. How your customer defines themselves to the world as a specific kind of person. It is the desire, not for satisfaction, but for recognition & expression.

    Identity marketing is about showcasing WHO your product helps your customer become.

    Identification marketing is how we communicate the feelings our customer desires, without words.

    We all have an image of ourselves, or a sense of who we are; this is called our self-image. We don't just buy objects, we buy roles.

    Your ability to identify who your potential customer is and leverage that in your marketing unspokenly will determine your success.

    - A woman buys low calorie food to become thinner, but in so doing she also becomes a more attractive, youthful looking women without having to say it.
    - A Man buys a car for power, speed, and transportation, equally as much as for the projection of prestige, success, and wealth that communicates without words.

    **Structure:**

    **1. Identity Prison (Who They Were Trapped Being)**

    Call out the problem you had and the problem mechanism (why you had it).

    State your identity at the time:
    - Don't say: "I was tired and achy"
    - Say: "I was invisible... the person people looked past, dismissed as 'just getting old'"

    What role were they forced into? (the sick one, the fragile one, the one who can't keep up)
    What labels defined them? (the grandma who needs help, the retiree who's declining)
    What social identity did they lose? (the active one, the capable one, the young-spirited one)

    Make it about who they stopped being, not what they couldn't do.

    **2. The Instrument of Reinvention (Product as Identity Bridge)**

    Position the product as the tool of identity change.
    - Frame the product as the instrument they used to reclaim their role
    - Describe them experience the effects of the unique mechanism
    - Show them wielding the product to reconstruct their identity

    **3. The New Identity (Who They've Become)**

    - Don't say: "Now I can play with my grandkids"
    - Say: "I'm the grandmother who gets on the floor, who races them to the park, who they call when they want adventure"

    Role examples: "I'm the friend who says yes," "I'm the wife who initiates," "I'm the traveler, not the tourist"

    Social recognition: How do OTHERS see them now? (What compliments do they get? What assumptions do people make?)

    Self-expression: What do they DO now that broadcasts their identity? (wardrobe, activities, social presence)

    Use visual identity markers:
    - "I'm the woman in yoga pants who actually goes to yoga"
    - "I'm the guy who doesn't need the handrail"

    Credit [PRODUCT] as the instrument: "Thanks to [PRODUCT] using [THE UNIQUE MECHANISM], I'm..."

    **4. Identity Rebellion – The Role You Deserve**

    Reframe what identity is NORMAL for their age/stage.

    - Current framing: "You shouldn't feel this way"
    - New framing: "You shouldn't have to BE this person"

    Challenge the identity resignation: "At 60, you're supposed to be [adventurous/vital/sharp/desired]"

    Expose the false role assignment: "Society handed you the 'declining senior' badge – you never had to wear it"

    List the identities they should still hold:
    - "You should still be the capable one"
    - "You should still be the attractive one"
    - "You should still be the one others look up to"

    Reframe suffering as identity theft: "Your [deficiency] didn't just take your energy – it took who you are. You spent X years being someone you're not."

    Set the tone like you want the best for them and you care about them, you want them to feel this transformation too.

    **5. Identity Restoration (The Labels Shed & Claimed)**

    Show the identity stripping and rebuilding:

    Who I'm NOT Anymore:
    - "I'm not the woman who..."
    - "I'm no longer the person they..."
    - "I stopped being the one who..."

    Who I've Become (Thanks to [PRODUCT]):
    - "I'm now the woman who..."
    - "I'm the person who gets recognized as..."
    - "I've reclaimed my identity as..."

    Connect to core identity desire from Section 1.4: "I wanted to feel like [MYSELF/A WOMAN/YOUNG/CAPABLE] again – [PRODUCT] using [MECHANISM] gave me the instrument to rebuild that person."

    **6. Your Identity Waiting (Second-Person Role Visualization)**

    Create role-based future pacing:

    "If [PRODUCT] could turn me from [OLD IDENTITY] into [NEW IDENTITY], imagine who you could become..."

    - Don't say: "Imagine having more energy"
    - Say: "Imagine being the person who..."

    Use identification language:
    - "Imagine walking into a room and being seen as..."
    - "Imagine introducing yourself without..."
    - "Imagine your family seeing you as... again"
    - "Imagine looking in the mirror and recognizing..."

    End with role assignment: "The question isn't whether [PRODUCT] works – it's whether you're ready to stop being [OLD ROLE] and step back into being [TRUE IDENTITY]."

    **KEY SHIFT:**
    - FROM: Problem → Solution → Result
    - TO: False Identity → Identity Instrument → True Identity Reclaimed

    Every sentence should answer: "Who does this make me?" not "What does this give me?"

    ---

    ### SECTION 8: THE OFFER (1 Headline)

    **Purpose:** Present the deal. Create urgency. Remove risk. Write this with the tone like you're not the one running this offer but you're talking about the brand that is. You're recommending this offer because it changed your life and you want the best for the reader.

    Refer to the product/brand not as "We" but as "They" and "[Product name]"

    Use the product name throughout. Make the offer feel like a no-brainer.

    **Structure:**

    **1. Risk Reversal (remove ALL friction)**

    Present the guarantee. State they let you try it for 90 days, you can feel X mechanism, feel X outcome, and if for whatever reason if you're not satisfied they will give you a full refund no questions asked. Make it crystal clear: they either get results or get their money back. Remove all purchase friction.

    **2. Offer the product only through this page**

    State the product you're talking about is only direct through the consumer, it is not on Amazon and it is not in stores. Reinforce limited availability. Include the link and emphasize checking if it's still in stock.

    **3. Urgency and Scarcity (aggressive – make them act NOW)**

    State that this product often sells out, and it sells out fast! NO pricing language. Explain why [PRODUCT NAME] sells out (quality ingredients hard to source, limited production batches, very high demand). Create conditional urgency: if the link works, it's in stock; if not, they'll have to wait.

    **4. Limited Discount (Act Now)**

    Explain that right now, [PRODUCT NAME] is available with a limited-time discount reserved for the first 100 people coming from Facebook.

    Explain they do this intentionally, to reward early viewers who took the time to learn why [PRODUCT NAME] works instead of impulse-buying some random product online.

    This isn't a public promotion and it's not something you'll find elsewhere.

    Once the first 100 Facebook viewers claim it, the discount is removed automatically. No extensions. No exceptions. If you're seeing this and the link still works, you're early and you got the discount.

    ---

    ### SECTION 9: TWO PATHS FORWARD (1 Headline)

    **Purpose:** Final push. Show contrast between action and inaction. Make inaction feel painful.

    Pull from Section 6.1 (Current State) and 6.2 (Future State) of your Strategic Intelligence Brief.

    **Structure:**

    **Path 1: Do Nothing (make it hurt) - Enhanced with Paradigm Shift Callback**

    Paint the picture of closing the page and going back to their current identity they don't want. List what they'll keep experiencing (pull from Section 6.1). Show the progression getting worse. Include the paradigm shift callback: emphasize they're accepting what they DON'T have to accept. Remind them they just didn't know about the UMP and [PRODUCT NAME]. End with: "That's one option."

    **Path 2: Take Action with [PRODUCT NAME] (make it inspiring)**

    Create the alternative: try [PRODUCT NAME] today, risk-free. Include a social proof number (how many people have chosen this path, 17,000+). Paint the transformation they could experience (pull from Section 6.2). List specific outcomes with [PRODUCT NAME]. Connect to identity restoration. Show [PRODUCT NAME] helping them become who they know is still there. The tone of this is like you want them to experience the transformation because you care about them.

    **End with aggressive action:**

    Make the choice for them and tell them to just click to checkout the product. Create FOMO: don't let this moment pass.

    ---

    ### SECTION 10: COMMENTS

    **Purpose:** Social proof. Counter objections. Build hype. Create FOMO.

    Output this in a separate section in the output.

    **Generate 7 Product-Specific Comments (Include [PRODUCT NAME] in each)**

    These directly name and praise the product. Make them feel real and varied. Include different types:
    - Curious/investigating comment asking if anyone has tried it
    - Success story with timeframe and specific result
    - Bought for family member, reporting results
    - Skeptic who tried because of guarantee
    - Comparison to other products that didn't work
    - Multi-bottle purchase, emphasizing guarantee makes it no-brainer
    - Long-term user reporting sustained results

    Make each comment 1-2 sentences. Include [PRODUCT NAME] in most. Vary the tone (excited, factual, grateful, comparative). Make them feel like real people, not marketing copy.

    Format: Natural comment language, no quotation marks needed

    ---

    ### SECTION 12: SIDEBAR REVIEWS

    **Purpose:** Social proof that appears alongside the article. These are SHORT user reviews visible in the sidebar on desktop.

    ⚠️ CRITICAL: These are REAL CUSTOMER reviews, not expert endorsements. Same format as bottom reviews but shorter (1-2 sentences).

    **Generate 3 Sidebar Reviews. Each Must:**
    - Be 1-2 sentences ONLY (short and punchy)
    - Include name + age (matches target demographic)
    - Include star rating (mostly 5 stars)
    - Mention specific result or timeframe
    - Feel authentic and conversational
    - Reference [PRODUCT NAME] naturally

    **Good Sidebar Review Examples:**
    - "2 weeks with [PRODUCT] and I'm finally sleeping through the night. Wish I'd found this years ago." — Margaret T., 64
    - "My daughter noticed the difference before I did. That says everything." — Robert K., 71
    - "Threw away my old supplements. This actually works." — Susan M., 58

    **Bad Sidebar Review Examples:**
    - "This product is amazing and changed my life!" (too generic, no specifics)
    - "Dr. Smith recommends this..." (wrong format — this is for users, not experts)

    **Where Expert Quotes Go Instead:**
    Embed expert endorsements in body copy within Section 4 (Mechanism) or Section 5 (Product). Use the `<div class="quote-box">` element for prominent expert quotes.

    ---

    ## STEP 4: WRITING RULES (Non-Negotiable)

    ### Paragraph Headlines

    Each major paragraph or section gets 1 headline.

    **Subheadline Strategy - State Facts with Outcomes:**

    Headlines should:
    - State specific outcomes, facts, or revelations (not questions)
    - Include numbers and results when possible
    - Build progressive story beats
    - Create urgency to keep reading
    - Work as standalone story elements

    Format: BIG and BOLD (under 100 characters)

    Avoid generic headlines like "The Discovery That Changed Everything." Instead use specific outcomes like "[X]% [Result] in [Timeframe] - Here's What Changed" or "The Hidden [Problem] Destroying Your Results" or "[Number] Users Report [Specific Outcome] Within [Timeframe]."

    ### Simplicity Rules

    - 3rd grade reading level – If a 9-year-old wouldn't understand, rewrite it
    - 50% short sentences (under 35 words)
    - 50% normal complete sentences
    - One idea per sentence
    - One idea per paragraph
    - No jargon without immediate explanation
    - Break up text every 2-5 sentences

    ### Formatting Rules

    - Use "..." to create curiosity breaks
    - Use line breaks liberally
    - Bold key phrases for scanning
    - Bullets for feature/benefit lists
    - No walls of text (3 sentences max per block)
    - Don't output any long dividers

    ### Bolding Instructions

    - Make 12-17% of the text bold.
    - Bold only high-impact marketing points:
    - Strong emotional triggers
    - Key logical reasons / mechanisms
    - Major proof or credibility claims
    - Do not bold filler, transitions, or full paragraphs.
    - Never exceed 20% bold usage.

    ### Content Rules

    - Use product name often whenever discussing the solution, product, or mechanism (from Section 5 onward)
    - Comment and Review must not contain a trademark symbol (™) - remove it if there is any
    - No hyphens or dashes used in the ADV copy - remove them if there are any
    - Never orphan a benefit – always tie it to [PRODUCT NAME]
    - Use "you" more than "we" or "I"
    - Include specific data (percentages, study sizes, timeframes) - add supporting statistics liberally
    - Cite sources for credibility
    - Stay realistic – no miracle claims
    - Guarantee is 90 days
    - 17,000+ customers already love it (or actual number from brief)

    ### Total Word Count

    | Awareness Level | Word Count | Focus |
    |-----------------|------------|-------|
    | Unaware | 3,000–3,600 | Symptoms, problem development, mechanism |
    | Problem Aware | 2,600–3,200 | Problem development, mechanism |
    | Solution Aware | 2,100–2,600 | Failed solutions, mechanism, product |

    **Unaware:** They don't know what the real problem is, why it's happening, or that they should care yet. Spend more time on the symptoms, problem development, and unique mechanism development.

    **Problem Aware:** They already feel the pain. Spend more time on the problem development, and unique mechanism development. This is persuasion, not education — so slightly shorter than unaware.

    **Solution Aware:** They already believe solutions exist. They're asking: Why this one? Why now? Why trust you? Spend more time on the failed solutions, and unique mechanism development and product development.

    ### What to Avoid

    - Going off-topic from the Big Idea
    - Multiple benefit angles (stick to ONE)
    - Multiple desires
    - Multiple avatars
    - Multiple unique mechanisms
    - Multiple problem mechanisms
    - Violate the customer beliefs
    - Complex explanations
    - Cheesy, infomercial language
    - Dramatic movie-plot writing
    - Do not add CTA buttons, ex: "[Check if [Product name] is still available here]" anywhere
    - Vague claims without proof
    - Revealing the mechanism before the Education section
    - Using "it" or "the supplement" instead of [PRODUCT NAME] after Section 5
    - Weak, timid, or defensive language in the back half
    - Testimonials that don't counter specific objections

    ---

    ## OUTPUT FORMAT: DUAL VERSION DELIVERY

    After completing the advertorial, output TWO versions:

    ### VERSION 1: FULL ADVERTORIAL (CONFIG FORMAT)

    Output the complete advertorial as a CONFIG object for the HTML template (see Step 5 below).

    ### VERSION 2: CONDENSED SUMMARY

    After the full advertorial, output a condensed structural summary with:
    - Every headline in sequential order
    - Short summary of each paragraph/section under 300 characters
    - Maintains exact section order from full version

    **Format for Condensed Summary:**
    ```
    CONDENSED ADVERTORIAL SUMMARY

    SECTION NAME
    [Headline 1]
    Summary of Paragraph: [Brief summary of this section - under 300 characters]
    (Repeat for each section)
    ```

    List out the total word count.

    ---

    ## STEP 5: CONFIG OUTPUT FORMAT

    **Output the advertorial as a JavaScript CONFIG object that can be directly pasted into the HTML template.**

    ### THEME SELECTION

    | Theme | Color | Use For |
    |-------|-------|---------|
    | `health` | Green | Supplements, wellness, joint, heart, general health |
    | `medical` | Blue | Devices, monitors, clinical tech |
    | `beauty` | Rose | Skincare, anti-aging, beauty supplements |
    | `energy` | Orange | Energy, performance, metabolism, weight |
    | `calm` | Purple | Sleep, stress, anxiety, mental wellness |

    ### SECTION MAPPING

    Map the advertorial sections to the SECTIONS array:

    | SOP Section | CONFIG Location | Notes |
    |-------------|-----------------|-------|
    | Section 1: Hook (Main Headline) | `HEADLINE` | Main headline |
    | Section 1: Hook (Subheadline) | `SUBHEADLINE` | Curiosity teaser |
    | Section 1: Hook (Lead) | `SECTIONS[0]` | Opening lead copy |
    | Section 2: Education | `SECTIONS[1]` | UMP reveal |
    | Section 3: Discredit | `SECTIONS[2]` | Use `<p class="failed-solution">` |
    | Section 4: Mechanism | `SECTIONS[3]` | Use `<div class="quote-box">` and `<div class="mechanism-box">` |
    | Section 5: Product | `SECTIONS[4]` | Product saturation begins, use `<p class="timeline-item">` |
    | Section 6: FAQ | `SECTIONS[5]` | Q&A format |
    | Section 7: Transformation | `SECTIONS[6]` | Use `<div class="validation-box">` |
    | Section 8: Offer | `SECTIONS[7]` | Risk reversal, urgency |
    | Section 9: Two Paths | `SECTIONS[8]` | Can merge with Section 8 |
    | Section 10: Comments | `REVIEWS` array | 7 user comments |
    | Section 12: Expert Recs | Body copy quotes | Embed in Section 4 or 5 |

    **SIDEBAR_REVIEWS:** 3 user reviews (same format as bottom reviews, displayed in sidebar)

    ### BODY HTML ELEMENTS

    | Element | Usage | Code |
    |---------|-------|------|
    | Regular paragraph | Standard text | `<p>Text here</p>` |
    | Short paragraph | Quick punches, fragments | `<p class="short">Text</p>` |
    | Bold text | Key phrases, emphasis | `<strong>text</strong>` |
    | Highlighted text | Critical revelations | `<span class="highlight">text</span>` |
    | Quote box | Peer quotes, UMP reveal | `<div class="quote-box"><p>Quote</p></div>` |
    | Mechanism box | UMP/UMS explanation | `<div class="mechanism-box"><p>Text</p></div>` |
    | Validation box | "You're not broken" | `<div class="validation-box"><p>Text</p></div>` |
    | Failed solution | Discredited alternatives | `<p class="failed-solution"><strong>X</strong> — why</p>` |
    | Timeline item | Results progression | `<p class="timeline-item"><strong>Day 3:</strong> Result</p>` |

    ### CRITICAL FORMATTING RULE

    **NO LINE BREAKS inside body strings.** All content must be on one line using HTML tags.

    ```javascript
    // ❌ WRONG
    body: "First paragraph.
    Second paragraph."

    // ✅ CORRECT  
    body: `<p>First paragraph.</p><p>Second paragraph.</p>`
    ```

    ### AUTO-GENERATED FIELDS (Do NOT include in CONFIG)

    The template automatically generates:
    - Author image (fixed placeholder)
    - "By" prefix before author name
    - Article date (today's date)
    - Reading time (calculated from word count)
    - CTA text ("Check Availability →")
    - CTA subtext ("90-Day Money-Back Guarantee • Free Shipping")
    - Disclaimer (standard FDA disclaimer)
    - Footer copyright

    ---

    Avatar info: 
    {avatar_info}

    Angle info: 
    {angle_info}
    
    Offer brief: 
    {offer_brief}

    ## END OF AI ADVERTORIAL SOP

    """
    

def get_advertorial_image_generation_prompt(
    offer_brief: str,
    advertorial_copy: str,
    image_style: ImageStyle = "realistic",
) -> str:

    if image_style == "realistic":
        return f"""
    # ADVERTORIAL IMAGE SOP: Complete Visual Strategy

    ## OVERVIEW

    **GLOBAL IMAGE STYLE: {image_style}**
    All image prompts MUST use {image_style} style unless a specific section requires a diagram or infographic.

    This SOP generates emotionally resonant images for EVERY section of advertorial copy. The advertorial is 2,100-3,600 words — walls of text are death on mobile. Every section gets visual support.

    **The Mix:** Emotional photographs + Mechanism diagrams + Comparison visuals + Product infographics

    **Outputs:** IMAGE-PROMPTS for 8-10 images per advertorial

    **Inputs Required:** Offer Brief + Completed Advertorial Copy. These can be found at the bottom of this prompt.

    ---

    # PART 1: THE COMPLETE IMAGE MAP

    ## Every Section Gets Visual Support

    | Section | Content | Image Type | Visual Style |
    |---------|---------|------------|--------------|
    | **HERO** | After headline | Recognition Portrait | Emotional photograph |
    | **Section 1** | Hook/Lead | Wound Moment | Emotional photograph |
    | **Section 2** | Education/UMP | Problem Mechanism | **DIAGRAM — anatomical attack** |
    | **Section 3** | Discredit | Failed Solutions | **DIAGRAM — comparison** |
    | **Section 4** | Mechanism/UMS | Solution Mechanism | **DIAGRAM — how it works** |
    | **Section 5** | Product | Product + Benefits | **INFOGRAPHIC — ingredients/timeline** |
    | **Section 6** | FAQ | Credibility | Expert portrait OR skip |
    | **Section 7** | Transformation | Identity Reclaimed | Emotional photograph (action) |
    | **Section 8** | Offer | Product Shot | **CLEAN PRODUCT PHOTO** |

    **Total: 8-10 images** (mix of photos + diagrams + infographics)

    ---

    ## The Visual Mix Explained

    | Type | Sections | Purpose | Tool |
    |------|----------|---------|------|
    | **Emotional Portraits** | Hero, S1, S7 | Feel the pain/transformation | Nanobanan / Soul |
    | **Mechanism Diagrams** | S2, S4 | Understand problem/solution | Nanobanan |
    | **Comparison Diagrams** | S3 | See why other solutions fail | Nanobanan |
    | **Product Infographics** | S5 | Trust the instrument | Nanobanan |
    | **Timeline Graphics** | S5 (optional) | See the progression | Nanobanan |

    ---

    ## Why This Works

    **Mobile Reality:** 70%+ traffic is mobile. A 3,000-word article with 2 images is a wall of grey text. With 7-9 images, every scroll reveals something new.

    **Visual Variety:** Alternating between emotional photographs and educational diagrams keeps attention fresh. The reader never knows what's coming next.

    **Diagram Power:** Mechanism sections (UMP/UMS) are ABSTRACT. Diagrams make them CONCRETE. "Inflammation attacking your joints" is words. A diagram showing red invaders destroying cartilage is VISCERAL.

    ---

    # PART 2: RESEARCH EXTRACTION

    ## 2.1 Demographics for Images

    ```
    Target Market: [UK, Netherlands, Israel, Germany, etc.]
    Primary Gender: [e.g., 70% female]
    Age Range: [e.g., 55-75, sweet spot 62]
    Ethnicity: [Match target — British, Dutch, Israeli, German]
    Appearance: [e.g., "natural grey hair, warm complexion, soft features"]
    Clothing Style: [e.g., "practical British casual — soft jumpers, comfortable trousers"]
    ```

    ## 2.2 Cultural Context

    ```
    Home Settings: [British cottage kitchen, Dutch apartment, Israeli balcony]
    Outdoor Settings: [English garden path, Dutch park bench, Mediterranean terrace]
    Family Markers: [Grandchildren's drawings on fridge, family photos, dog lead by door]
    Activities: [Morning tea ritual, garden tending, dog walking]
    ```

    ## 2.3 Emotional Triggers

    ```
    PRIMARY FEAR (for Hero + Wound images):
    [e.g., "Becoming invisible to my family — present but not participating"]

    SECONDARY FEARS:
    1. [e.g., "Being a burden to my children"]
    2. [e.g., "Missing my grandchildren growing up"]
    3. [e.g., "Losing my independence"]

    PRIMARY DESIRE (for Transformation images):
    [e.g., "Being the grandmother who gets on the floor to play"]

    IDENTITY PRISON (who they were forced to become):
    [e.g., "The fragile one. The one who needs help. The one they plan around."]

    IDENTITY RESTORATION (who they reclaim):
    [e.g., "The capable one. The adventurous one. The one they call for fun."]
    ```

    ## 2.4 Mechanism Visuals

    ```
    UMP (Unique Mechanism of Problem):
    [e.g., "Chronic inflammation destroying joints from inside"]
    Visual Translation: [e.g., "Red armies attacking cartilage, healthy tissue retreating"]
    Anatomy: [e.g., "Knee joint cross-section"]

    UMS (Unique Mechanism of Solution):
    [e.g., "Blocking inflammatory cascade at the source"]
    Visual Translation: [e.g., "Golden shield protecting healthy tissue, attackers blocked"]
    Key Ingredients: [e.g., "Curcumin, Boswellia, Collagen Type II"]
    ```

    ---

    # PART 3: TOOL SELECTION

    | Tool | Strength | Use For |
    |------|----------|---------|
    | **Nanobanan** | Static portraits, editorial, anatomical, diagrams, infographics | Hero (types 1-2), Wound, Diagrams, Product |
    | **Higgsfield Soul** | Motion, action, dynamic movement | Hero (type 3), Transformation (action) |

    **Decision Rule:** Active movement needed? → Soul. Everything else → Nanobanan.

    ---

    ## Visual Standards (ALL Images)

    - **NO TEXT** except: Stat badges, diagram labels, infographic text
    - **Eyes:** Natural only — "soft blue," "warm brown" — NEVER "bright/piercing/vivid"
    - **Expressions:** Dignified emotion — NOT theatrical pain or fake smiles
    - **Demographics:** EXACT match to research
    - **Settings:** CULTURALLY APPROPRIATE to target market
    - **Format:** 16:9 for Hero, 1:1 for all section images
    - **Diagram Labels:** In TARGET LANGUAGE

    ---

    # PART 4: HERO IMAGE (16:9)

    ## Always Output 3 Versions

    1. **Recognition Hero** — Hits deepest fear (RECOMMENDED for cold traffic)
    2. **Transformation Hero** — Shows mechanism/proof (good for retargeting)
    3. **Aspiration Hero** — Shows desire achieved (A/B test for solution-aware)

    ---

    ## HERO TYPE 1: Recognition Heroes

    **Tool:** Nanobanan | **Format:** 16:9

    | Primary Fear | Concept | The Gut-Punch |
    |--------------|---------|---------------|
    | Missing moments | **1A: Missed Moment** | POV from armchair — grandchildren reaching up |
    | Being a burden | **1B: The Look** | Daughter's exhausted face, forcing a smile |
    | Losing independence | **1C: The Pause** | Bottom of stairs, looking UP |
    | Being left out | **1D: The Window** | Hands on glass, watching life outside |
    | Fear of decline | **1E: The Shadow** | Mobility walker in corner — your FUTURE |
    | Family isolation | **1F: Empty Chair** | Family dinner, one chair empty |

    ### 1A: THE MISSED MOMENT
    ```
    Photorealistic POV image. 16:9 format.

    CAMERA: First-person POV looking DOWN from seated position in armchair.

    FOREGROUND: Your own hands — [AGE]-appropriate, [ETHNICITY] skin tone — GRIPPING armrest. Knuckles showing tension. Wedding ring visible.

    THE FLOOR: [CULTURALLY APPROPRIATE — British carpet, Dutch hardwood]. Grandchildren's toys scattered. Building blocks. Picture book open.

    THE CHILDREN: Two grandchildren on floor, looking UP at camera. Arms REACHING. Faces hopeful. "Come play with us."

    THE GAP: 3 feet between you and everything that matters.

    LIGHTING: Warm golden light on children. Cooler where you are. The warmth doesn't reach you.

    EMOTION: Make viewer's hands ACHE with need to let go.

    No text. No product.
    ```

    ### 1B: THE LOOK
    ```
    Photorealistic image. 16:9 format.

    COMPOSITION: Over-shoulder shot. Back of [DEMOGRAPHIC]'s head (grey hair, bowed) in soft focus foreground.

    THE FACE: Adult daughter, 40-45, [ETHNICITY]. SHARP FOCUS.

    HER EXPRESSION:
    - Smile: Present. Forced. A mask.
    - Eyes: EXHAUSTED. Dark circles hidden with makeup.
    - Jaw: Tight. Holding back.
    - Truth: Terrified. For you. You're the CAUSE.

    SETTING: [CULTURALLY APPROPRIATE kitchen]. Normal backdrop to private devastation.

    LIGHTING: Flat, honest. Lighting of difficult conversations.

    EMOTION: Worst pain isn't your body. It's knowing you put that look on your child's face.

    No text. No product.
    ```

    ### 1C: THE PAUSE
    ```
    Photorealistic image. 16:9 format.

    SUBJECT: [DEMOGRAPHIC] standing at BOTTOM of staircase.

    THE STAIRS: 12-14 steps. Normal stairs that LOOM.

    BODY LANGUAGE:
    - Hand on banister — resting, preparing
    - Weight shifted, testing
    - Head tilted UP, measuring
    - Micro-hesitation before what used to be NOTHING

    EXPRESSION: Not pain. DETERMINATION. Quiet daily courage. Natural [eye color].

    SETTING: [CULTURALLY APPROPRIATE hallway]. Family photos going up stairs.

    LIGHTING: Light from above. Destination bright. Bottom in shadows.

    EMOTION: Everyone with this problem knows this EXACT moment.

    No text. No product.
    ```

    ### 1D: THE WINDOW
    ```
    Photorealistic image. 16:9 format.

    SUBJECT: [DEMOGRAPHIC] standing at large window. Profile view.

    THE GLASS: Dominates image. A barrier. Prison of transparency.

    INSIDE: Darker, muted. Chair they spend too much time in visible.

    OUTSIDE (through window, VIBRANT):
    - Grandchildren playing in garden
    - OR: Neighbors walking together
    - World moving without them

    BODY LANGUAGE: Hands FLAT against glass. Leaning toward life.

    EXPRESSION: Wistful. Hungry. Grief of watching life without you. Natural [eye color].

    LIGHTING: Dark interior, bright exterior. Contrast IS the story.

    No text. No product.
    ```

    ### 1E: THE SHADOW
    ```
    Photorealistic image. 16:9 format.

    COMPOSITION: [DEMOGRAPHIC] foreground, in focus. THE THING in background, unmistakable.

    THE THING: Mobility walker. Clean, new. "Gift" from family. NOT YET.

    SUBJECT: Seated or standing, turned toward it. Can't stop looking.

    EXPRESSION — layers:
    - Defiance: "Not yet. Not me."
    - Fear: "But maybe soon."
    - Determination: "I won't let this happen."
    - Despair: "Will I have a choice?"
    Natural [eye color].

    SETTING: [CULTURALLY APPROPRIATE living room]. Otherwise LIVED IN.

    LIGHTING: Walker slightly shadowed — lurking. Waiting.

    No text. No product.
    ```

    ### 1F: THE EMPTY CHAIR
    ```
    Photorealistic image. 16:9 format.

    COMPOSITION: Family dinner scene, elevated angle.

    THE TABLE: [CULTURALLY APPROPRIATE meal]. 4-5 family members, multiple generations. Engaged. ALIVE.

    THE FAMILY: Passing dishes. Laughing. Eye contact. Connection.

    THE EMPTY CHAIR: One place at table. Chair pushed back. CONSPICUOUSLY empty.

    THE SUBJECT:
    - OPTION A: Visible in doorway, watching but not joining
    - OPTION B: Not visible — empty chair IS them

    LIGHTING: Warm over table. Cooler at edges. Empty chair where warmth fades.

    EMOTION: Fear isn't dying alone. It's being alive and watching family learn to live without you.

    No text. No product.
    ```

    ---

    ## HERO TYPE 2: Transformation Heroes

    **Tool:** Nanobanan | **Format:** 16:9

    ### 2A: SYMBOLIC METAPHOR (Brain, energy, mood)
    ```
    Split image. 16:9 format. Clean gradient background.

    LEFT SIDE — THE PRISON:
    Human head silhouette in profile.
    INSIDE: [Match research problem]
    - Fog → Dense grey fog, suffocating
    - Exhaustion → Dim, flickering lightbulb
    - Memory → Scattered puzzle pieces
    - No energy → Drained battery, cracked
    Muted greys, heavy.

    RIGHT SIDE — THE FREEDOM:
    SAME silhouette.
    INSIDE: [Match desire]
    - Clarity → Golden neural network, electricity flowing
    - Energy → Radiant sun, beams extending
    - Memory → Completed puzzle, glowing
    - Vitality → Fully charged battery, radiating
    Vibrant gold, ALIVE.

    TRANSITION: Clean line between sides.

    ZERO TEXT. No product.
    ```

    ### 2B: ANATOMICAL CROSS-SECTION (Joints, arteries)
    ```
    Split image. 16:9 format. Dark medical background.

    LEFT SIDE — THE DAMAGE:
    Medical illustration of [ANATOMY]:
    - Joint: Cartilage rough, inflamed, eroded. RED inflammation.
    - Artery: Yellow plaque CHOKING passage.
    Sickly yellows, angry reds, bruise purples.

    RIGHT SIDE — THE RESTORATION:
    SAME anatomy:
    - Joint: Smooth cartilage, healthy cushion. Blue/gold glow.
    - Artery: Clear passage, smooth flow.
    Healthy pinks, vibrant blues, golden energy.

    STYLE: Medical illustration — realistic but EMOTIONAL.

    ZERO TEXT. No product.
    ```

    ### 2C: REAL SYMPTOM BEFORE/AFTER
    ```
    Split image. 16:9 format.

    LEFT — THE STRUGGLE:
    [DEMOGRAPHIC] in difficulty:
    - Hands pressing armrests, trying to stand
    - Sitting on bed edge, dreading first steps
    Expression: Dignified struggle.
    Desaturated tones.

    RIGHT — THE FREEDOM:
    SAME person, SAME setting:
    - Rising easily, natural movement
    - Standing with ease
    Expression: Simple contentment.
    Warmer tones.

    ZERO TEXT. No product.
    ```

    ---

    ## HERO TYPE 3: Aspiration Heroes

    **Tool:** Higgsfield Soul | **Format:** 16:9

    ### 3A: LIVING THE DESIRE
    ```
    Cinematic photograph. 16:9 format. MOTION visible.

    SUBJECT: [DEMOGRAPHIC] in FLUID MOVEMENT during [PRIMARY DESIRE]:
    - Playing on floor with grandchildren — DOWN there, MOVING
    - Walking the dog — STRIDING, not shuffling
    - Tending garden — kneeling, hands in soil
    - Dancing with spouse — spontaneous kitchen dance

    MOVEMENT: Effortless. Natural. Body that WORKS.

    EXPRESSION: Genuine joy. Happiness of CAPABILITY restored. Natural [eye color].

    SETTING: [CULTURALLY APPROPRIATE]. Where desire lives.

    LIGHTING: Warm, natural, ALIVE.

    No text. No product.
    ```

    ---

    # PART 5: SECTION 1 — WOUND IMAGE (1:1)

    **Purpose:** Visualize the pain the copy describes. Deepen the emotional hook.

    **Tool:** Nanobanan | **Format:** 1:1

    ## When to Use
    - Always use unless hero already shows same scenario
    - Choose concept that matches the SPECIFIC pain in Section 1 copy

    ## Wound Concepts

    | Code | Name | Use When | The Moment |
    |------|------|----------|------------|
    | W1 | Three Feet Away | Missing moments | Subject in background, life in foreground — close but separated |
    | W2 | The Secret | Daily pain, morning stiffness | 5:47am moment — sitting on bed edge, gathering courage |
    | W3 | The Grave | Lost activities | Abandoned hobby — garden wild, instrument dusty |
    | W4 | The Lie | Hiding pain | Smile that doesn't reach eyes at gathering |
    | W5 | The Math | Trade-offs | Looking at grandchildren weighing joy vs aftermath |

    ### WOUND Prompt Template
    ```
    Photorealistic image. 1:1 format.

    THE MOMENT: [Specific private moment — the one they never show anyone]

    DEMOGRAPHIC: [From research — exact age, ethnicity, appearance]

    EXPRESSION: Raw, unguarded — exhaustion, grief, resignation. NOT theatrical. Natural [eye color].

    SETTING: [CULTURALLY APPROPRIATE private space]

    LIGHTING: Harsh, real, unflattering — the light of truth.

    This should feel like witnessing something private.

    No text. No product.
    ```

    ---

    # PART 6: SECTION 2 — UMP DIAGRAM (1:1)

    **Purpose:** Make the PROBLEM MECHANISM visible. Abstract becomes concrete.

    **Tool:** Nanobanan | **Format:** 1:1

    ## This is NOT Optional

    Section 2 explains WHY they have the problem. A diagram showing the mechanism is worth 500 words of explanation.

    ## Diagram Types

    | Type | Use When | Visual |
    |------|----------|--------|
    | **D1: Anatomical Attack** | Physical condition (joints, arteries, gut) | Cross-section showing damage in progress |
    | **D2: Process Diagram** | Cascade/chain reaction | Flow showing how problem develops |
    | **D3: Symbolic Attack** | Abstract problem (stress, fatigue) | Visual metaphor of what's being destroyed |

    ### D1: ANATOMICAL ATTACK
    ```
    Medical illustration. 1:1 format. Dark background.

    ANATOMY: [Specific body part from UMP — joint, artery, gut, brain region]

    THE ATTACK VISIBLE:
    - Inflammation: RED markers, swelling, heat indicators
    - Damage: Eroded tissue, rough surfaces, breakdown
    - Progression: Arrows showing spread/worsening

    COLOR CODING:
    - Healthy tissue: Blues, healthy pinks
    - Damage: Angry reds, sick yellows
    - Attack vectors: Sharp red arrows

    LABELS (in [TARGET LANGUAGE]):
    - "[Problem mechanism]" pointing to damage
    - "[Result]" pointing to symptoms
    - "Healthy vs Damaged" comparison if split view

    STYLE: Medical textbook meets emotional impact. Viewer should feel VIOLATED.

    Professional but alarming.
    ```

    ### D2: PROCESS DIAGRAM
    ```
    Process flow illustration. 1:1 format. Clean background.

    THE CASCADE:
    Step 1: [Trigger] → 
    Step 2: [Initial response] → 
    Step 3: [Escalation] → 
    Step 4: [Damage] → 
    Step 5: [Symptoms they feel]

    VISUAL FLOW:
    - Arrows connecting each stage
    - Each stage gets worse (colors darken, imagery intensifies)
    - Final stage shows the symptom they recognize

    COLOR PROGRESSION:
    - Start: Neutral greys
    - Middle: Warning yellows/oranges
    - End: Angry reds, damage visible

    LABELS (in [TARGET LANGUAGE]):
    - Each stage labeled simply
    - Time indicators if relevant ("Within hours...", "Over weeks...")

    STYLE: Clean, educational, but ALARMING progression.
    ```

    ### D3: SYMBOLIC ATTACK
    ```
    Symbolic illustration. 1:1 format.

    THE METAPHOR: [Match to abstract problem]
    - Energy drain → Battery being drained by dark tendrils
    - Mental fog → Clear head being clouded over
    - Vitality theft → Light being pulled from body
    - Stress damage → Pressure crushing/cracking

    VISUAL:
    - Clear "before" state (healthy, bright, intact)
    - Active destruction happening (not aftermath — IN PROGRESS)
    - Sense of urgency — this is happening NOW

    COLOR:
    - Healthy: Golds, vibrant blues, healthy pinks
    - Attacker: Dark, shadowy, consuming
    - Damage: Fading, draining, cracking

    EMOTION: Something precious being destroyed. Urgency to stop it.

    No text labels needed — visual is self-explanatory.
    ```

    ---

    # PART 7: SECTION 3 — COMPARISON DIAGRAM (1:1)

    **Purpose:** Show WHY other solutions failed. Visual proof they weren't crazy — they were misled.

    **Tool:** Nanobanan | **Format:** 1:1

    ## The Concept

    Section 3 discredits failed solutions. The diagram shows WHAT those solutions target vs WHAT actually causes the problem.

    ### C1: TARGETING COMPARISON
    ```
    Comparison diagram. 1:1 format. Clean split or layered design.

    LAYOUT: Two-panel or overlay showing contrast

    LEFT/TOP — WHAT THEY TARGET:
    - Failed Solution 1: [e.g., "Glucosamine"] → Points to [wrong target, e.g., "Cartilage"]
    - Failed Solution 2: [e.g., "Painkillers"] → Points to [wrong target, e.g., "Pain signals"]
    - Failed Solution 3: [e.g., "Rest"] → Points to [wrong target, e.g., "Symptoms"]

    RIGHT/BOTTOM — WHAT ACTUALLY CAUSES IT:
    - The REAL problem: [e.g., "Inflammatory cascade"] — UNTOUCHED by above solutions
    - Arrows showing failed solutions missing the target
    - Root cause glowing/highlighted as the IGNORED culprit

    COLOR CODING:
    - Failed solutions: Greyed out, ineffective
    - Wrong targets: Faded, secondary
    - Real cause: Angry red, highlighted, ACTIVE
    - Miss indicators: Dotted lines, X marks

    LABELS (in [TARGET LANGUAGE]):
    - "What [failed solution] targets"
    - "What's ACTUALLY causing the damage"
    - "MISSED" or "IGNORED" markers

    STYLE: Clear, damning comparison. Viewer should feel angry at wasted years/money.
    ```

    ### C2: THE SHIELD GAP
    ```
    Diagram showing protection failure. 1:1 format.

    VISUAL CONCEPT:
    - Multiple failed solutions shown as weak/partial shields
    - Each shield has GAPS where the real problem gets through
    - Arrows showing problem bypassing each "solution"

    THE REAL PROBLEM:
    - Shown as attacker easily passing through all defenses
    - Reaching the target (their health) unimpeded

    THE MESSAGE:
    - "They never protected you from THIS"
    - Gap in every failed solution visible

    LABELS (in [TARGET LANGUAGE]):
    - Each failed solution named on its weak shield
    - "Unprotected" or "Vulnerable" at the target

    EMOTION: Realization that they were never actually protected.
    ```

    ---

    # PART 8: SECTION 4 — UMS DIAGRAM (1:1)

    **Purpose:** Show HOW the solution mechanism works. Hope made visible.

    **Tool:** Nanobanan | **Format:** 1:1

    ## This is the TURN

    Section 4 is where despair becomes hope. The diagram shows the mechanism WORKING.

    ### M1: THE SHIELD (Protection Mechanism)
    ```
    Medical illustration. 1:1 format.

    THE SCENE: [ANATOMY] being PROTECTED by the mechanism.

    VISUAL:
    - Golden/blue energy shield surrounding healthy tissue
    - Inflammatory attackers being BLOCKED, bouncing off
    - Healthy tissue thriving BEHIND protection
    - Clear contrast: chaos OUTSIDE, peace INSIDE

    COLOR:
    - Protection: Golden light, healthy blues
    - Attackers: Faded, weakened, held at bay
    - Protected tissue: Vibrant, healthy pinks

    LABELS (in [TARGET LANGUAGE]):
    - "[Key ingredient]" → protection mechanism
    - "Blocked" → attackers
    - "Protected" → healthy tissue

    EMOTION: RELIEF. Safety. The cavalry arrived.
    ```

    ### M2: THE RESTORATION (Healing Mechanism)
    ```
    Medical illustration. 1:1 format.

    THE SCENE: [ANATOMY] being REBUILT.

    VISUAL:
    - Damaged tissue being replaced with healthy growth
    - Golden light spreading through damaged area
    - Inflammation retreating
    - Clear progression: damage → healing → restored

    STYLE: Timelapse feeling — transformation in progress.

    COLOR:
    - Healing: Golden glow, healthy pinks returning
    - Damage: Retreating, fading
    - New tissue: Vibrant, strong

    LABELS (in [TARGET LANGUAGE]):
    - "Before" / "During" / "After" stages
    - Key ingredient action points

    EMOTION: HOPE. Renewal. Body remembering how to be healthy.
    ```

    ### M3: THE INTERRUPTION (Cascade Blocker)
    ```
    Process diagram. 1:1 format.

    THE CONCEPT: Same cascade from D2 (UMP diagram) but NOW INTERRUPTED.

    VISUAL:
    - Same process flow as problem diagram
    - But NOW: Intervention point clearly marked
    - Solution STOPS the cascade mid-flow
    - Downstream damage PREVENTED

    BEFORE INTERVENTION: Red, angry, progressing
    AFTER INTERVENTION: Calm, blue, stopped

    LABELS (in [TARGET LANGUAGE]):
    - "The [Product] Intervention"
    - "Cascade STOPPED"
    - "Damage PREVENTED"

    EMOTION: Control. Finally something that works at the SOURCE.
    ```

    ---

    # PART 9: SECTION 5 — PRODUCT INFOGRAPHIC (1:1)

    **Purpose:** Show the product as the delivery system. Build trust through transparency.

    **Tool:** Nanobanan | **Format:** 1:1

    ## Two Options (Choose One or Both)

    ### P1: INGREDIENTS INFOGRAPHIC
    ```
    Product infographic. 1:1 format.

    [PRODUCT NAME] bottle CENTER — realistic (30-40% frame height).

    BACKGROUND: Clean gradient appropriate to THEME:
    - Health: Soft greens to white
    - Medical: Clinical blue gradient
    - Beauty: Dusty rose to cream
    - Energy: Warm orange to white
    - Calm: Soft lavender to white

    INGREDIENTS: 3-4 key ingredients with icons radiating from bottle:
    - [Ingredient 1]: "[Benefit — 1-6 words]" + simple icon
    - [Ingredient 2]: "[Benefit]" + icon
    - [Ingredient 3]: "[Benefit]" + icon
    - [Ingredient 4]: "[Benefit]" + icon

    CALLOUTS:
    - Dosage/potency if impressive
    - "Clinically studied" if applicable
    - Key differentiator

    STYLE: Professional photography meets clean infographic. Premium aesthetic.

    TEXT IN [TARGET LANGUAGE].
    ```

    ### P2: RESULTS TIMELINE
    ```
    Timeline infographic. 1:1 format.

    VISUAL: Horizontal or vertical timeline showing progression

    STAGES:
    - Day 1-3: [Initial effect — what they notice first]
    - Week 1: [Building benefit]
    - Week 2: [Noticeable change]
    - Week 4: [Significant results]
    - Week 8+: [Full transformation]

    VISUAL PROGRESSION:
    - Early stages: Smaller, subtle indicators
    - Later stages: Larger, more vibrant indicators
    - Progress bar or growing visual element

    COLOR PROGRESSION:
    - Start: Neutral
    - End: Vibrant, healthy, goal achieved

    LABELS (in [TARGET LANGUAGE]):
    - Each stage clearly labeled with timeframe
    - Specific benefits at each stage

    STYLE: Clean, professional, builds anticipation.
    ```

    ---

    # PART 10: SECTION 6 — FAQ IMAGE (1:1)

    **Purpose:** Add credibility. Usually SKIP — text-heavy section.

    **Tool:** Nanobanan | **Format:** 1:1

    ## When to Include
    - Only if you have a strong expert quote to visualize
    - Or if section is unusually long and needs visual break

    ### F1: EXPERT PORTRAIT (Optional)
    ```
    Professional portrait. 1:1 format.

    SUBJECT: [Expert type relevant to mechanism]
    - Doctor in white coat
    - Researcher in lab setting
    - Nutritionist in professional setting

    APPEARANCE:
    - Professional, trustworthy
    - Appropriate age (45-65)
    - [ETHNICITY matching target market]
    - Warm but authoritative expression

    SETTING: Professional but not sterile
    - Office with books/credentials visible
    - Lab with equipment
    - Clinical but welcoming

    LIGHTING: Professional, flattering, trustworthy.

    SMALL TEXT OVERLAY (optional):
    - Name and credentials
    - Or: Key quote excerpt

    EMOTION: "You can trust this information."
    ```

    ### SKIP RATIONALE
    ```
    Section 6 is FAQ — text-heavy Q&A format. Images can distract from objection-handling. Skip unless:
    - Section is very long (5+ FAQs)
    - You have specific expert quote to feature
    - Visual break is needed for flow
    ```

    ---

    # PART 11: SECTION 7 — TRANSFORMATION IMAGE (1:1)

    **Purpose:** Show WHO they've become. Identity marketing visualized. This is the emotional CLIMAX.

    **Tool:** Higgsfield Soul (action) or Nanobanan (portrait) | **Format:** 1:1

    ## Always Include — Choose Best Fit

    ### T1: THE RECLAMATION (Action)

    **Tool:** Higgsfield Soul
    ```
    Cinematic photograph. 1:1 format. MOTION and JOY.

    SUBJECT: [DEMOGRAPHIC] DOING the thing they couldn't do. FULLY ENGAGED.

    THE ACTIVITY: [PRIMARY DESIRE]
    - On floor with grandchildren — not watching, PLAYING
    - In garden — kneeling, digging, ALIVE
    - Walking with spouse — MATCHING pace, hand in hand
    - At family gathering — STANDING, CENTER of life

    BODY LANGUAGE:
    - FLUID movement — no hesitation
    - Open posture — expansive
    - Engaged with others — PARTICIPATING

    EXPRESSION: Unguarded joy. Happiness of CAPABILITY restored. Natural [eye color].

    SETTING: [CULTURALLY APPROPRIATE]. Location of desire.

    LIGHTING: Warm, golden, ALIVE.

    No text. Small product in corner optional.
    ```

    ### T2: THE RECOGNITION (Portrait)

    **Tool:** Nanobanan
    ```
    Portrait photograph. 1:1 format.

    SUBJECT: [DEMOGRAPHIC] in moment of quiet PRIDE.

    THE MOMENT: Looking at camera OR mirror — RECOGNIZING themselves.

    EXPRESSION:
    - Pride: "I did this. I'm back."
    - Peace: No longer fighting every day
    - Confidence: Knowing they can
    - Vitality: Light in eyes
    Natural [eye color].

    NOT manic happiness. QUIET STRENGTH. Dignity of reclaimed identity.

    SETTING: [CULTURALLY APPROPRIATE home]. Their space.

    LIGHTING: Warm, flattering. Lighting of good days.

    WARDROBE: [CULTURALLY APPROPRIATE]. Intentional — dressed like someone with PLANS.

    No text. Small product optional.
    ```

    ### T3: THE WITNESS (Family Recognition)

    **Tool:** Nanobanan
    ```
    Photorealistic image. 1:1 format.

    COMPOSITION: [DEMOGRAPHIC] foreground. Family member reacting in background.

    THE SUBJECT: Doing something they couldn't before. Rising easily. Coming downstairs. Joining activity.

    THE WITNESS: Adult child or spouse watching. Expression of:
    - Surprise
    - Relief
    - Joy
    - "They're BACK"

    Subject may not notice being watched. Just LIVING.

    EMOTION: Transformation witnessed. Family seeing who returned.

    No text. No product.
    ```

    ---

    # PART 12: SECTION 8 — PRODUCT IMAGE (1:1)

    **Purpose:** Clean, professional product shot. Reinforces what they're getting before CTA.

    **Tool:** Nanobanan | **Format:** 1:1

    ## Always Include

    Section 8 is the offer. Show them exactly what they're getting — clean, aspirational, premium.

    ### O1: CLEAN PRODUCT SHOT
    ```
    Product photography. 1:1 format.

    [PRODUCT NAME] bottle as HERO — centered, prominent (50-60% frame height).

    BACKGROUND: Clean, premium, matches THEME:
    - Health: Soft green gradient or white with subtle green accents
    - Medical: Clean white/light blue, clinical but warm
    - Beauty: Dusty rose gradient, elegant
    - Energy: Warm cream/orange tones
    - Calm: Soft lavender/white gradient

    LIGHTING: Professional studio lighting
    - Soft shadows
    - Slight reflection on surface
    - Premium, aspirational feel

    COMPOSITION:
    - Bottle slightly angled (not flat front)
    - Label clearly visible
    - Clean negative space around product

    OPTIONAL ELEMENTS (subtle):
    - Single ingredient element (leaf, herb) if natural product
    - Soft glow/highlight around bottle
    - Premium surface (marble, clean white)

    STYLE: E-commerce hero shot meets lifestyle premium. This is what arrives at their door.

    NO text overlays. NO price. NO badges. Just the product looking its best.
    ```

    ---

    # PART 13: OUTPUT FORMAT

    ```markdown
    # IMAGE PROMPTS: [PRODUCT_NAME] Advertorial

    ## Research Summary
    - Target Market: [Country]
    - Language: [Language]  
    - Demographic: [Age] [Gender] [Ethnicity]
    - Primary Fear: [Fear] → Hero Type Selection
    - Primary Desire: [Desire] → Transformation Type Selection
    - UMP: [Problem mechanism]
    - UMS: [Solution mechanism]
    - Key Ingredients: [List]

    ---

    ## HERO VERSION 1 — Recognition (RECOMMENDED)
    **Tool:** Nanobanan | **16:9**
    **Type:** [1A-1F]
    **Fear:** [Specific fear]

    [Full prompt]

    ---

    ## HERO VERSION 2 — Transformation
    **Tool:** Nanobanan | **16:9**
    **Type:** [2A-2C]
    **Mechanism:** [UMP visual]

    [Full prompt]

    ---

    ## HERO VERSION 3 — Aspiration (A/B Test)
    **Tool:** Higgsfield Soul | **16:9**
    **Desire:** [Primary desire]

    [Full prompt]

    ---

    ## SECTION 1: Hook/Wound
    **Tool:** Nanobanan | **1:1**
    **Type:** [W1-W5]
    **Pain Point:** [From Section 1 copy]

    [Full prompt]

    ---

    ## SECTION 2: Education/UMP — DIAGRAM
    **Tool:** Nanobanan | **1:1**
    **Type:** [D1-D3]
    **Mechanism:** [UMP]

    [Full prompt]

    ---

    ## SECTION 3: Discredit — COMPARISON DIAGRAM
    **Tool:** Nanobanan | **1:1**
    **Type:** [C1-C2]
    **Failed Solutions:** [From copy]

    [Full prompt]

    ---

    ## SECTION 4: Mechanism/UMS — DIAGRAM
    **Tool:** Nanobanan | **1:1**
    **Type:** [M1-M3]
    **Mechanism:** [UMS]

    [Full prompt]

    ---

    ## SECTION 5: Product — INFOGRAPHIC
    **Tool:** Nanobanan | **1:1**
    **Type:** [P1 and/or P2]

    [Full prompt for ingredients]

    [Full prompt for timeline — if using both]

    ---

    ## SECTION 6: FAQ
    **SKIP** — Text-heavy objection handling. [OR include F1 if needed]

    ---

    ## SECTION 7: Transformation
    **Tool:** [Higgsfield Soul / Nanobanan] | **1:1**
    **Type:** [T1-T3]
    **Identity:** [From Section 7 copy]

    [Full prompt]

    ---

    ## SECTION 8: Offer — PRODUCT SHOT
    **Tool:** Nanobanan | **1:1**
    **Type:** O1

    [Full prompt]
    ```

    ---

    # PART 14: QUICK REFERENCE

    ## Complete Image Map

    | Section | Image Type | Format | Tool |
    |---------|------------|--------|------|
    | Hero | Recognition/Transform/Aspire | 16:9 | Nano/Nano/Soul |
    | Section 1 | Wound portrait | 1:1 | Nanobanan |
    | Section 2 | UMP Diagram | 1:1 | Nanobanan |
    | Section 3 | Comparison Diagram | 1:1 | Nanobanan |
    | Section 4 | UMS Diagram | 1:1 | Nanobanan |
    | Section 5 | Product Infographic | 1:1 | Nanobanan |
    | Section 6 | Skip (or Expert) | 1:1 | Nanobanan |
    | Section 7 | Transformation | 1:1 | Soul/Nanobanan |
    | Section 8 | Clean Product Shot | 1:1 | Nanobanan |

    ## Diagram Type Selection

    | UMP Type | Diagram |
    |----------|---------|
    | Physical damage (joints, arteries) | D1: Anatomical Attack |
    | Process/cascade (inflammation, oxidation) | D2: Process Diagram |
    | Abstract (stress, fatigue, brain fog) | D3: Symbolic Attack |

    | UMS Type | Diagram |
    |----------|---------|
    | Protection/blocking | M1: The Shield |
    | Repair/restoration | M2: The Restoration |
    | Interruption/stopping cascade | M3: The Interruption |

    ## Fear → Hero Mapping

    | Fear | Hero |
    |------|------|
    | Missing moments | 1A: Missed Moment |
    | Being a burden | 1B: The Look |
    | Losing independence | 1C: The Pause |
    | Being left out | 1D: The Window |
    | Fear of decline | 1E: The Shadow |
    | Family isolation | 1F: Empty Chair |

    ---

    ## Final Checklist

    **Research Extracted:**
    - [ ] Demographics exact (age, ethnicity, appearance)
    - [ ] Cultural context documented
    - [ ] Primary fear → Hero selection
    - [ ] Primary desire → Transformation selection
    - [ ] UMP → Diagram type selected
    - [ ] UMS → Diagram type selected
    - [ ] Key ingredients listed

    **Images Generated:**
    - [ ] 3 Hero versions (Recognition, Transformation, Aspiration)
    - [ ] Section 1: Wound image
    - [ ] Section 2: UMP Diagram
    - [ ] Section 3: Comparison Diagram
    - [ ] Section 4: UMS Diagram
    - [ ] Section 5: Product Infographic (+ Timeline optional)
    - [ ] Section 6: Skip justified (or Expert if needed)
    - [ ] Section 7: Transformation image
    - [ ] Section 8: Clean Product Shot

    **Quality Standards:**
    - [ ] All demographics EXACT match
    - [ ] All settings culturally appropriate
    - [ ] All eye colors natural
    - [ ] All diagram labels in TARGET LANGUAGE
    - [ ] No "bright/piercing/vivid" eyes
    - [ ] No theatrical expressions
    - [ ] Formats correct (16:9 hero, 1:1 sections)

    **Total Images: 8-10** (3 hero options + 6-7 section images)

    ---

    ## CRITICAL: COMPLETE EVERY FIELD

    You MUST generate an image prompt for EVERY imagePrompt field in the output schema — no exceptions.
    Even if a section in the advertorial copy below has empty or missing body text, you still MUST generate a relevant image prompt for that section based on the overall context from the offer brief, the surrounding sections, and the product being advertised.
    Do NOT leave any imagePrompt field empty or blank.

    ---
    Input:
    Offer Brief:
    {offer_brief}

    Advertorial Copy:
    {advertorial_copy}

    ## END OF ADVERTORIAL IMAGE SOP
    """