"""
Central prompt repository for process_job_v2 Lambda.

LEGACY/REFERENCE ONLY: Primary prompts are now stored in the Neon PostgreSQL database
and loaded via PromptService. This file is kept as a reference for the original prompt
content and structure. The database tables `prompts` and `prompt_versions` contain
the authoritative versions of all prompts.

See: services/prompt_service.py for the database-backed implementation.

All LLM prompts are defined here for maintainability, versioning, and easy iteration.
Each function returns a formatted prompt string ready for LLM consumption.
"""


def get_analyze_research_page_prompt() -> str:
    """
    Generate prompt for analyzing a sales page using vision.
    
    This prompt is used with a screenshot of the page, so no URL interpolation needed.
    
    Returns:
        Formatted prompt string for sales page analysis.
    """
    return """
You are my expert copywriter and you specialise in writing highly persuasive direct response style copy.

I've attached my current sales page.    

Analyze this page and please let me know your thoughts on the product, the claims, the proof, and the overall offer.
Identify what kind of customers this product might appeal to.
"""


def get_deep_research_prompt(
    sales_page_url: str,
    gender: str,
    location: str,
    research_requirements: str,
    language_of_output: str,
    research_page_analysis: str,
    target_product_name: str = "Not specified",
) -> str:
    """
    Generate comprehensive deep research prompt for Perplexity.
    
    This is the largest prompt (~270 lines) that instructs the Deep Research tool
    to conduct full-spectrum market research.
    
    Args:
        sales_page_url: URL of the product sales page
        gender: Target gender (e.g., "Female", "Male", "Mixed", "Not specified")
        location: Target location/market (country/region/city or "Not specified")
        research_requirements: Specific research requirements or "None"
        language_of_output: Output language (e.g., "English")
        research_page_analysis: Prior analysis of the research/sales page
        
    Returns:
        Formatted prompt string for deep research execution.
    """
    return f"""
You are the Deep Research tool. Conduct comprehensive, unbiased, full-spectrum research ONLY (no marketing, no copywriting) using the inputs and requirements below.

===============================================================================
INPUTS (PLACEHOLDERS — DO NOT ASK QUESTIONS)
===============================================================================
- sales_page_url: {sales_page_url}
- target_product_name: {target_product_name}               (the exact product name to use; "Not specified" means infer from sales page)
- gender: {gender}                                         (e.g., "Female", "Male", "Mixed", "Not specified")
- location: {location}                                     (country/region/city; "Not specified" allowed)
- specific_research_requirements: {research_requirements}   ("None" allowed)
- language_of_output: {language_of_output}                 (e.g., "English")
- Product Page analysis: {research_page_analysis}

===============================================================================
NON-NEGOTIABLE RULES (RESEARCH ONLY)
===============================================================================
This is RESEARCH ONLY. Do NOT:
- Choose marketing angles or hooks
- Identify "avatars to target" as recommendations
- Make positioning recommendations
- Suggest creative direction
- Write any marketing copy (ads, landing copy, headlines, email copy, scripts)

You MUST:
- When target_product_name is provided (not "Not specified"), always refer to the product by this exact name throughout your research output
- Mine real customer language from actual sources
- Document the complete emotional landscape
- Extract exact quotes, phrases, and words people use (no paraphrasing for quotes)
- Map all failed solutions and why they failed
- Identify patterns across large volumes of data
- Cover multiple potential customer avatars AND multiple marketing angles ONLY as OBSERVATIONS found in the data (no recommendations)

If any instruction conflicts, obey "RESEARCH ONLY" and "NO RECOMMENDATIONS".

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
If "Not specified", broaden the search and then report what the evidence shows.

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
- Google "People Also Ask" queries (capture the query language verbatim)
- Independent review sites, niche communities, and reputable publications where relevant
- Competitor sites and competitor review pages

For every claim, pattern, or notable point, provide source evidence. For every quote, provide attribution details.

===============================================================================
EVIDENCE, QUOTATION, AND ATTRIBUTION REQUIREMENTS
===============================================================================
- Quotes must be copied verbatim. Do not "clean up" grammar.
- For each quote include:
- Source type (Reddit/Amazon/YouTube/etc.)
- Identifier (subreddit + thread title, product listing name, video title/channel, forum name/thread)
- Date (if available)
- Link/reference (as available in the environment)
- Distinguish between:
- (A) Customer-reported experiences
- (B) Opinions/beliefs/narratives (including conspiratorial or suppression claims)
- (C) Clinically or scientifically supported statements (only when backed by reputable sources)

Do not validate misinformation. Document it as "observed narrative" with attribution.

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
- What would they be able to do that they can't do now?
- What identity do they want to reclaim or achieve?

4. VICTORIES AND FAILURES
- Small wins
- Crushing defeats
- The moment they realized it was a real problem
- "Rock bottom" stories (quote-heavy)

5. OUTSIDE FORCES THEY BLAME
- Who/what they blame: doctors, system, genetics, age, society, employers, family, etc.
- Past bad advice
- Companies/products that failed them

6. PREJUDICES AND BIASES
- Skepticism triggers
- What they've been burned by
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
- "Default" solutions and the most popular ones
- Differences by {location} where observed

9. EXPERIENCE WITH CURRENT SOLUTIONS
- What they like
- What they hate
- What's missing from everything they tried
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
    - "Before modern solutions" behaviors
    - Clearly separate history vs anecdote; cite sources

13. SUPPRESSION OR CONSPIRACY NARRATIVES
    - "Hidden solutions" beliefs
    - Suppression/cover-up narratives
    - "They don't want you to know" themes
    - Present as observed narratives only; do not endorse; attribute sources

PART 4: "FALL FROM EDEN" RESEARCH
14. WHEN DID THIS PROBLEM NOT EXIST?
    - Historical prevalence or when it was rarer
    - What changed and when
    - Epidemiology or credible historical data (cite reputable sources)

15. CORRUPTING FORCES
    - Environmental/diet/lifestyle shifts
    - Policies/industry changes blamed
    - "Real reason this is happening now" (separate evidence vs narrative)

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
- "People Also Ask" queries (verbatim)

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
    - What "success" language looks like vs "failure" language (quote-supported)

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


def get_identify_avatars_prompt(deep_research_output: str, target_product_name: str = "Not specified") -> str:
    """
    Generate prompt for identifying distinct avatars from research.
    
    Args:
        deep_research_output: The raw deep research document
        
    Returns:
        Formatted prompt string for avatar identification.
    """
    return f"""
Now you must identify the DISTINCT AVATARS within this research — not invented 
personas, but real segments that emerged from the language patterns. These are 
people who experience the same problem but from different life circumstances, 
with different emotional drivers, and different buying psychology.

Extract 3-5 distinct avatars from the research based on patterns in how 
different people experience, describe, and seek solutions for this problem.
Review the research and identify avatar clusters based on:

1. LIFE CIRCUMSTANCE PATTERNS
- What different life situations do people mention?
- Age, career, family, lifestyle differences

2. PAIN EXPRESSION PATTERNS
- How do different people describe the SAME problem differently?
- Who experiences it as embarrassment vs. physical discomfort vs. inconvenience?

3. TRIGGER EVENT PATTERNS
- What made different people start searching for a solution?

4. FAILED SOLUTION PATTERNS
- What have different groups already tried?

5. OBJECTION PATTERNS
- What do different groups worry about most?


    
Deep research output:
{deep_research_output}
"""


def get_complete_avatar_details_prompt(
    avatar_name: str,
    avatar_description: str,
    deep_research_output: str,
    target_product_name: str = "Not specified",
) -> str:
    """
    Generate prompt for completing detailed avatar sheet.
    
    Args:
        avatar_name: Name of the identified avatar
        avatar_description: Description of the identified avatar
        deep_research_output: The raw deep research document
        
    Returns:
        Formatted prompt string for avatar detail completion.
    """
    return f"""
Amazing work! Now I want you to please complete the detailed Avatar sheet template for the following specific avatar, using the deep research output.

Please take into account the following when writing:
    - Do not use scientific and academic jargon
    - Write content in simple, sales-oriented language
    - Make explanations benefit-driven instead of descriptive
    - Limit paragraphs to one or two short lines
    - Optimize content for fast scanning, not deep reading


Target Avatar:
Name: {avatar_name}
Description: {avatar_description}

Deep research output:
{deep_research_output}
"""


def get_necessary_beliefs_prompt(
    avatar_name: str,
    avatar_description: str,
    deep_research_output: str,
    target_product_name: str = "Not specified",
) -> str:
    """
    Generate prompt for extracting necessary beliefs for an avatar.
    
    This prompt implements the 6-belief hierarchy framework for belief transformation
    marketing, based on Todd Brown's teachings.
    
    Args:
        avatar_name: Name of the target avatar
        avatar_description: Description of the target avatar
        deep_research_output: The raw deep research document
        
    Returns:
        Formatted prompt string for necessary beliefs extraction.
    """
    return f"""Marketing is fundamentally about BELIEF TRANSFORMATION — taking prospects from 
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


def get_marketing_angles_prompt(
    avatar_name: str,
    avatar_json: str,
    deep_research_output: str,
    target_product_name: str = "Not specified",
) -> str:
    """
    Generate prompt for creating marketing angles for an avatar.
    
    Args:
        avatar_name: Name of the avatar
        avatar_json: JSON string of the full avatar profile (from model_dump_json)
        deep_research_output: The raw deep research document
        
    Returns:
        Formatted prompt string for marketing angle generation.
    """
    return f"""
ANGLE GENERATION PROMPT
═══════════════════════════════════════════════════════════════════════════════

CONTEXT
═══════════════════════════════════════════════════════════════════════════════

You have extracted 3-5 distinct avatars from deep research, each with complete 
profiles including pain dimensions, desire dimensions, objections, buying 
psychology, awareness levels, and raw language.

Now you must generate MARKETING ANGLES for each avatar — distinct entry points 
into the conversation that grab their attention and lead them toward the sale.

Remember: Angles are not word variations. Each angle is a fundamentally 
different ARGUMENT — a different door into the same room. Different angles 
emphasize different pains, desires, mechanisms, or proof points to connect 
with the prospect.

═══════════════════════════════════════════════════════════════════════════════
DOCUMENTS PROVIDED
═══════════════════════════════════════════════════════════════════════════════

- Deep Research Document
{deep_research_output}

- Avatar Profile
{avatar_json}

═══════════════════════════════════════════════════════════════════════════════
TASK
═══════════════════════════════════════════════════════════════════════════════

For this avatar, generate 5-7 distinct marketing angles. Then identify the 
top 3 angles for testing.

═══════════════════════════════════════════════════════════════════════════════
ANGLE TYPES TO CONSIDER
═══════════════════════════════════════════════════════════════════════════════

Generate angles across these categories:

1. PAIN-LEAD ANGLES
Lead with a specific pain point that hits hard for this avatar.
"Still dealing with [specific pain]?"

2. DESIRE-LEAD ANGLES
Lead with the outcome they desperately want.
"Finally [desire] without [sacrifice]"

3. ENEMY/VILLAIN ANGLES
Blame something external for their problem.
"The hidden [enemy] that's causing your [problem]"

4. SECRET/DISCOVERY ANGLES
Reveal something they don't know.
"The [surprising truth] about [problem] that [authority] won't tell you"

5. MECHANISM ANGLES
Lead with the unique way your solution works.
"The [mechanism name] method that [benefit] in [timeframe]"

6. IDENTITY ANGLES
Speak to who they are or want to become.
"For [identity] who refuse to [accept problem]"

7. SOCIAL PROOF ANGLES
Lead with proof and results.
"[Number] [people like them] have already [achieved result]"

8. FEAR/CONSEQUENCE ANGLES
Highlight what happens if they don't act.
"Why [problem] gets worse after [age/event] (and what to do now)"

9. MYTH-BUSTING ANGLES
Attack a misconception they hold.
"Why [common solution] is actually making your [problem] worse"

10. COMPARISON/ALTERNATIVE ANGLES
    Position against what they've tried.
    "Tried [failed solution]? Here's why it didn't work"

11. URGENCY/TIMING ANGLES
    Create a reason to act now.
    "The [window/age/season] when [solution] works best"

12. PERMISSION ANGLES
    Give them permission to want what they want.
    "It's not [self-blame] — it's [external factor]"

═══════════════════════════════════════════════════════════════════════════════
STEP 1: ANGLE GENERATION PER AVATAR
═══════════════════════════════════════════════════════════════════════════════

Generate 5-7 angles using this format:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVATAR: {avatar_name}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Please take into account the following when writing:
    - Do not use scientific and academic jargon
    - Write content in simple, sales-oriented language
    - Make explanations benefit-driven instead of descriptive
    - Limit paragraphs to one or two short lines
    - Optimize content for fast scanning, not deep reading

═══════════════════════════════════════════════════════════════════════════════
NOW GENERATE ANGLES FOR THIS AVATAR
═══════════════════════════════════════════════════════════════════════════════
"""


def get_offer_brief_prompt(
    avatars_summary: str,
    deep_research_output: str,
    target_product_name: str = "Not specified",
) -> str:
    """
    Generate prompt for creating strategic offer brief.
    
    Args:
        avatars_summary: JSON string of marketing avatars list
        deep_research_output: The raw deep research document
        
    Returns:
        Formatted prompt string for offer brief generation.
    """
    return f"""
STRATEGIC OFFER BRIEF GENERATION
═══════════════════════════════════════════════════════════════════════════════

You are a world-class direct response strategist. Your goal is to synthesize 
all the research and avatar work into a cohesive OFFER BRIEF.

This brief will serve as the "bible" for the copywriter, defining the product 
strategy, hook, mechanism, and funnel architecture.

═══════════════════════════════════════════════════════════════════════════════
INPUTS PROVIDED
═══════════════════════════════════════════════════════════════════════════════

1. DEEP RESEARCH (The raw market reality):
{deep_research_output}

2. MARKETING AVATARS & ANGLES (The specific targets):
{avatars_summary}

═══════════════════════════════════════════════════════════════════════════════
TASK
═══════════════════════════════════════════════════════════════════════════════

Create a comprehensive Offer Brief that unifies the strongest elements from 
the research.

KEY STRATEGIC DECISIONS TO MAKE:

1. MARKET SOPHISTICATION (Crucial):
   Determine if this market is skeptical/crowded (Level 3-5) or open (Level 1-2).
   This dictates whether we lead with a "Mechanism" or a "Promise".
   
2. THE "BIG IDEA":
   Find the one transformative concept that makes this offer feels new, 
   different, and inevitable.
   
3. UNIQUE MECHANISM:
   Define the "Unique Mechanism of the Problem" (why they failed before) 
   and "Unique Mechanism of the Solution" (why this works).
   
4. BELIEF CHAIN:
   Map the sequence of beliefs required to close the sale.
   
5. FUNNEL ARCHITECTURE:
   Recommend the best funnel flow (e.g., VSL vs. Long-form Sales Page vs. 
   Quiz vs. E-comm PDP) based on the avatar's sophistication and buying style.

═══════════════════════════════════════════════════════════════════════════════
OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════════════════

Fill every field in the OfferBrief schema with high-strategic value content.

- Product Names: Creative, benefit-driven, or mechanism-driven names.
- Headlines: Punchy, high-CTR, appropriate for the awareness level.
- Metaphors: Vivid analogies to explain the problem/solution.
- Story: A compelling origin or discovery narrative.

Be specific. Be bold. Do not be generic.

Please take into account the following when writing:
    - Do not use scientific and academic jargon, use simple language on B2 level!
    - Write content in simple, sales-oriented language, with short sentences
    - Make explanations benefit-driven instead of descriptive
    - Limit paragraphs to one or two short lines
    - Optimize content for fast scanning, not deep reading
    - Write in the language of the research document
"""


def get_summary_prompt(
    marketing_avatars_str: str,
    deep_research_output: str
) -> str:
    """
    Generate prompt for creating a summary of all outputs.
    
    Args:
        marketing_avatars_str: String representation of marketing avatars list
        deep_research_output: The raw deep research document
        
    Returns:
        Formatted prompt string for summary creation.
    """
    return f"""
Great work! Please summarize the following outputs in a way that is easy to understand and use for a copywriter:

Marketing Avatars (list of dicts with keys: avatar, angles, necessary_beliefs):
{marketing_avatars_str}

Deep research output:
{deep_research_output}

Instructions:
- Extract the "avatar" key from each dict in the list to understand the customer profiles
- Extract the "angles" key from each dict to see the marketing angles generated for each avatar
- Extract the "necessary_beliefs" key from each dict to understand the belief transformation required
- Provide a comprehensive summary that helps a copywriter understand all avatars, their marketing angles, and the necessary beliefs for each
"""


def get_template_prediction_prompt(
    avatar_summary: str,
    angle_summary: str,
    library_summaries: str
) -> str:
    """
    Generate prompt for predicting which landing page templates best match an avatar+angle.

    Args:
        avatar_summary: Condensed summary of the avatar profile
        angle_summary: Condensed summary of the marketing angle
        library_summaries: JSON string of available template summaries

    Returns:
        Formatted prompt string for template prediction.
    """
    return f"""You are matching a marketing avatar and angle to pre-lander landing page templates based on STYLE and FORMAT fit — NOT product content.

Templates are reusable across any product. What matters is whether the template's writing style, narrative structure, and persuasion approach serve the given avatar+angle combination well.

## Avatar Profile:
{avatar_summary}

## Marketing Angle:
{angle_summary}

## Available Landing Page Templates (Style Profiles):
{library_summaries}

## Scoring Instructions:

Score each template on these dimensions (0.0 to 1.0):

1. **format_fit** (weight: 0.40): How well does the template's format and structure serve this avatar+angle?
   - Consider: Does the writing_perspective match the angle type? (e.g., first_person POV works well for story-based angles, authority_expert for mechanism angles)
   - Consider: Does the content_density match the avatar's awareness level? (unaware audiences need denser content to educate; product_aware audiences need lighter, more direct content)
   - Consider: Does the article_structure_flow support the angle's emotional journey?
   - 1.0 = Format is ideal for this avatar+angle combination
   - 0.5 = Format is workable but not optimal
   - 0.0 = Format would actively work against the angle's goals

2. **persuasion_fit** (weight: 0.40): How well do the template's persuasion techniques and emotional approach align with the angle?
   - Consider: Do the persuasion_techniques match the angle's emotional_driver? (e.g., fear_of_inaction for fear-based angles, emotional_storytelling for story angles)
   - Consider: Does the emotional_approach match the angle's emotional journey?
   - Consider: Do the engagement_devices support the avatar's needs? (e.g., expert_quotes for skeptical audiences, personal_anecdote for empathy-driven angles)
   - Consider: Does the cta_style match the angle's risk_level? (soft_discovery for low-risk, urgent_action for high-risk)
   - 1.0 = Persuasion approach perfectly supports this angle
   - 0.5 = Some techniques align, others are neutral
   - 0.0 = Persuasion approach would undermine the angle

3. **tone_fit** (weight: 0.20): How well does the template's tone and energy level match the angle's approach?
   - Consider: tone, energy_level, and the angle's emotional_driver
   - 1.0 = Identical tone and energy match
   - 0.5 = Compatible but different intensity
   - 0.0 = Conflicting tones that would confuse the reader

Also check best_for_awareness_levels and best_for_angle_types as strong signals — if the avatar's awareness level or the angle type appears in these lists, that's a significant positive indicator.

Calculate **overall_fit_score** as:
(format_fit * 0.40) + (persuasion_fit * 0.40) + (tone_fit * 0.20)

## Output Requirements:

Return the top 5 templates ranked by overall_fit_score (highest first).
For each template, provide:
- template_id
- overall_fit_score
- format_fit
- persuasion_fit
- tone_fit
- reasoning (2-3 sentences explaining why this template's STYLE fits the avatar+angle, focusing on structural and persuasion alignment)

Use the structured output tool to return your analysis.
"""
