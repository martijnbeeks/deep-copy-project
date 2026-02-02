# Deep Copy System Flow & Prompt Reference

This document details the end-to-end flow of the Deep Copy system. It is divided into three main phases:
1.  **Market Research** (Analyzing the product and market)
2.  **Creative Generation** (Creating visual ad creatives)
3.  **Copywriting** (Rewriting successful advertorials)

For each step, the expected inputs, outputs, and the **exact full prompt** used by the AI are provided.

---

# Phase 1: Market Research

**Goal:** To deeply understand the product, market, and potential customers (avatars), and to generate strategic marketing angles.

## Step 1: Analyze Research Page
The system starts by "looking" at the provided sales page (screenshot or text) to understand what is being sold.

*   **Input**: Sales Page Screenshot or Text
*   **Output**: An initial analysis of the product, claims, and potential audience.

### Prompt
```text
You are my expert copywriter and you specialise in writing highly persuasive direct response style copy.

I've attached my current sales page.    

Analyze this page and please let me know your thoughts on the product, the claims, the proof, and the overall offer.
Identify what kind of customers this product might appeal to.
```

---

## Step 2: Deep Research
The system executes a massive, comprehensive research task to gather raw data from across the internet (Reddit, Amazon, Forums, etc.).

*   **Inputs**:
    *   `{sales_page_url}`: URL of the product
    *   `{gender}`: Target gender
    *   `{location}`: Target market location
    *   `{research_requirements}`: Any specific constraints
    *   `{language_of_output}`: Output language
    *   `{research_page_analysis}`: The output from Step 1
*   **Output**: A massive markdown document containing raw research data (pain points, quotes, failed solutions, etc.).

### Prompt
```text
You are the Deep Research tool. Conduct comprehensive, unbiased, full-spectrum research ONLY (no marketing, no copywriting) using the inputs and requirements below.

===============================================================================
INPUTS (PLACEHOLDERS — DO NOT ASK QUESTIONS)
===============================================================================
- sales_page_url: {sales_page_url}
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
```

---

## Step 3: Identify Avatars
The system scans the Deep Research output to identify distinct customer personas ("avatars").

*   **Input**: `{deep_research_output}` (From Step 2)
*   **Output**: A list of identified avatar names and descriptions.

### Prompt
```text
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
```

---

## Step 4: Complete Avatar Details
For each identified avatar, the system generates a detailed profile.

*   **Inputs**:
    *   `{avatar_name}`: Name of the identified avatar
    *   `{avatar_description}`: Description of the avatar
    *   `{deep_research_output}`: Full research data
*   **Output**: A detailed avatar profile (Bio, Pain Points, Desires, etc.).

### Prompt
```text
Amazing work! Now I want you to please complete the detailed Avatar sheet template for the following specific avatar, using the deep research output.

Target Avatar:
Name: {avatar_name}
Description: {avatar_description}

Deep research output:
{deep_research_output}
```

---

## Step 5: Necessary Beliefs (The 6-Belief Hierarchy)
For each avatar, the system defines the logical chain of beliefs required for them to buy. This is based on the "Belief Transformation" marketing framework.

*   **Inputs**:
    *   `{avatar_name}`: Name of the identified avatar
    *   `{avatar_description}`: Description of the avatar
    *   `{deep_research_output}`: Full research data
*   **Output**: A list of 6 sequential beliefs (Problem, Category, Mechanism, Product, Timing, Risk) to shift the user's mindset.

### Prompt
```text
Marketing is fundamentally about BELIEF TRANSFORMATION — taking prospects from 
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
```

---

## Step 6: Marketing Angles
The system generates specific "hooks" or "angles" to attract the avatar's attention.

*   **Inputs**:
    *   `{avatar_name}`: Name of the identified avatar
    *   `{avatar_json}`: Full avatar profile details
    *   `{deep_research_output}`: Full research data
*   **Output**: A list of 5-7 marketing angles (Pain-lead, Desire-lead, etc.) and a "Top 3" selection.

### Prompt
```text
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

─────────────────────────────────────────────────────────────────────────────
ANGLE: [ANGLE TITLE]
─────────────────────────────────────────────────────────────────────────────

Angle Subtitle:
[A short tagline that captures the angle's promise]

Angle Type:
[Pain-Lead / Desire-Lead / Enemy / Secret / Mechanism / Identity / etc.]

Emotional Driver:
[Fear / Hope / Anger / Shame / Desire]

Risk Level:
[Low / Medium / High]

Core Argument:
[The single-sentence logical argument this angle makes]

Target Age Range:
[The age bracket this angle speaks to]

Target Audience:
[A refined description of who this specific angle is for]

Pain Points (List 2-3):
- [Frustration 1]
- [Frustration 2]

Desires (List 2-3):
- [Goal 1]
- [Goal 2]

Common Objections (List 2-3):
- [Reason to say no 1]
- [Reason to say no 2]

Failed Alternatives (List 2-3):
- [Previous attempt 1]
- [Previous attempt 2]

Raw Language - Pain Quotes (List 2+):
- "[Quote 1]"
- "[Quote 2]"

Raw Language - Desire Quotes (List 2+):
- "[Quote 1]"
- "[Quote 2]"

Raw Language - Objection Quotes (List 2+):
- "[Quote 1]"
- "[Quote 2]"

─────────────────────────────────────────────────────────────────────────────

═══════════════════════════════════════════════════════════════════════════════
STEP 2: ANGLE DIFFERENTIATION CHECK
═══════════════════════════════════════════════════════════════════════════════

Verify angles are MEANINGFULLY DIFFERENT using the 
Andromeda Difference Threshold. Each angle must change at least 3 of 5:

| Dimension                        | Angle 1 | Angle 2 | Angle 3 | Angle 4 | Angle 5 |
|----------------------------------|---------|---------|---------|---------|---------|
| Opening Moment / Hook            |         |         |         |         |         |
| Primary Emotion                  |         |         |         |         |         |
| Core Argument                    |         |         |         |         |         |
| Proof / Evidence Type            |         |         |         |         |         |
| Entry Point (Pain/Desire/Enemy)  |         |         |         |         |         |

If two angles are too similar, merge or replace one.

═══════════════════════════════════════════════════════════════════════════════
STEP 3: TOP 3 ANGLES PER AVATAR
═══════════════════════════════════════════════════════════════════════════════

Select the top 3 angles for this avatar based on:

SELECTION CRITERIA:
- Pain/Desire Intensity: Does this hit their hottest button?
- Differentiation: Is this angle ownable and different from competitors?
- Proof Availability: Do we have evidence to back this angle?
- Scalability: Can this angle sustain multiple ad variations?
- Compliance: Can this run without platform rejection?

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AVATAR: {avatar_name} — TOP 3 ANGLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

#1 PRIMARY ANGLE: [Name]
- Type: [Angle type]
- Core Argument: [One sentence]
- Why Selected: [Reason this is the strongest]
- Primary Hook: "[Hook]"
- Emotional Driver: [Emotion]
- Risk Level: [Low / Medium / High — compliance or proof risk]

#2 SECONDARY ANGLE: [Name]
- Type: [Angle type]
- Core Argument: [One sentence]
- Why Selected: [Reason]
- Primary Hook: "[Hook]"
- Emotional Driver: [Emotion]
- Risk Level: [Low / Medium / High]

#3 TEST ANGLE: [Name]
- Type: [Angle type]
- Core Argument: [One sentence]
- Why Selected: [Reason — often a contrarian or unexpected approach]
- Primary Hook: "[Hook]"
- Emotional Driver: [Emotion]
- Risk Level: [Low / Medium / High]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

═══════════════════════════════════════════════════════════════════════════════
CRITICAL RULES
═══════════════════════════════════════════════════════════════════════════════

1. ARGUMENTS, NOT WORDS — Each angle is a different argument, not a 
different way to say the same thing.

2. AVATAR-GROUNDED — Every angle must connect to a specific dimension 
from the avatar profile. No generic angles.

3. RESEARCH-BACKED — Angles should be validated by raw language from 
the research. If no one in the research expressed this pain/desire, 
flag as [SPECULATIVE].

4. MEANINGFULLY DIFFERENT — Use the Andromeda threshold. If angles are 
too similar, they're not worth testing separately.

5. EXECUTABLE — Every angle must be specific enough to hand to a 
copywriter or creative team and produce an ad.

6. COMPLIANT — Flag any angle with potential platform compliance issues.

═══════════════════════════════════════════════════════════════════════════════
NOW GENERATE ANGLES FOR THIS AVATAR
═══════════════════════════════════════════════════════════════════════════════
```

---

## Step 7: Offer Brief
The system synthesizes the research, avatars, and angles into a cohesive "Offer Brief" — a strategic logic document for copywriters.

*   **Inputs**:
    *   `{avatars_summary}`: Summary of relevant avatars and angles
    *   `{deep_research_output}`: Full research data
*   **Output**: A strategic document defining the "Big Idea", Unique Mechanism, and Funnel Strategy.

### Prompt
```text
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
```

---

## Step 8: Summary
Consolidates all the generated outputs into a simple summary for human review.

*   **Inputs**: Avatars, Angles, Beliefs
*   **Output**: A summarized report.

### Prompt
```text
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
```

---

# Phase 2: Creative Generation

**Goal:** Create visual advertising creatives that match the identified marketing angles and avatars.

## Step 1: Detect Product (Uploaded Reference)
If you upload your own reference images, the system first checks if they already contain a product, to strictly avoid adding a *second* product image during generation.

*   **Input**: Uploaded Image
*   **Output**: Boolean (True if visible product is present, False if not)

### Prompt
```text
Analyze this reference image for advertising/creative purposes. Does this image contain a visible product image, product photo, or product packaging? A product image would be a clear photo of a physical product (like a bottle, package, box, etc.) that is distinct from the background or other elements. Text-only ads, lifestyle images without products, or abstract designs should have has_product=False. Provide a brief reasoning for your decision.
```

## Step 2: Summarize Research (Optional)
If foundational research docs were provided, they are summarized to give the image generator context on what matters to the customer.

*   **Input**: Research Text
*   **Output**: A structured summary of Pains and Desires in JSON.

### Prompt
```text
Summarize this research into: pains, desires, objections, proof points, hooks. Output JSON with keys pains, desires, objections, proofs, hooks. Language: {language}.

{text}
```

## Step 3: Match Angles to Visuals
The system matches the Marketing Angles (generated in Phase 1) with available Reference Images (visual templates) to find the best fit.

*   **Inputs**:
    *   `{selected_avatar}`: Target Avatar
    *   `Library`: List of available reference images and descriptions.
    *   `Slots`: Which angles need images.
*   **Output**: JSON mapping of `Angle -> Image ID`.

### System Prompt
```text
You assign reference creative image IDs to marketing angles.
Rules:
- Return ONLY valid JSON.
- For each requested slot, choose one image_id from the provided library.
- Avoid duplicates across all slots.
- Output shape: {"assignments":[{"angle_num":"1","variation_num":"1","image_id":"12.png"},...]}
```

### User Prompt
```text
Selected avatar: {selected_avatar}
Already used image_ids (do not reuse): {sorted_used_ids}
Slots needing assignment:
{slots_desc}

Library (imageId: description):
{images_json}
```

## Step 4: Generate Images
The system generates the final creative using DALL-E 3 or Gemini. It constructs a prompt combining the Angle, Avatar, Product Info, and specific constraints based on the reference image type.

*   **Inputs**:
    *   `{language}`: Output language
    *   `{avatar}`: Target Avatar Description
    *   `{angle}`: Marketing Angle
    *   `{product_name}`: Name of your product
    *   `Reference Image`: The visual style template
*   **Output**: A generated image.

### Main Prompt Construction
The final prompt is built by combining these sections:

**Part A: Base Instruction**
```text
Generate a high-converting static ad image in {language}.
Target avatar: {avatar}
Marketing angle: {angle}
Product name: {product_name}
IMPORTANT: Replace ALL product names, brand names, and website URLs visible in the reference image with '{product_name}'. Do NOT copy any product names, brand names, or URLs from the reference image.
Research summary (JSON/text): {analysis_json_or_text}
```

**Part B: Instruction (IF reference image supports product insertion)**
*Added when a product shot is provided and the layout allows it.*
```text
Use the provided reference creative image as the layout/style template. If a product image is provided, incorporate it naturally. For the color theme: intelligently decide whether to use colors from the product image or preserve the reference image's color scheme. Use product image colors when they enhance the ad's appeal and conversion potential, but preserve the reference image's color theme when it already works well and fits the product. Prioritize creating a cohesive, high-converting ad that balances visual appeal with brand consistency. Return only the final image.
```

**Part C: Instruction (IF reference image DOES NOT support product insertion)**
*Added when the layout is text-only or abstract.*
```text
CRITICAL: This reference image does NOT support product images. DO NOT include, merge, add, or reference any product images in the generated image. Use ONLY the reference creative image as provided. Ignore and do not copy any product images that may be visible in the reference image itself. Generate the image using only the reference template without any product imagery.

Use the provided reference creative image as the layout/style template. For the color theme and visual style, intelligently decide what works best: you may preserve the color theme from the reference image if it fits well, or choose a color scheme that better matches the target avatar and marketing angle. Prioritize creating a high-converting ad that resonates with the target audience. Return only the final image.
```

---

# Phase 3: Copywriting (Write Swipe)

**Goal:** Cleanly rewrite a proven "swipe file" (advertorial) to sell *your* product, while rigidly adhering to the structural style of the original.

## Step 1: Style Guide Analysis
The system analyzes the *original* swipe file text to create a mathematical blueprint of its writing style (sentence length, tone, punctuation, structure).

*   **Input**: `{raw_swipe_file_text}` (The original text)
*   **Output**: A highly detailed JSON Style Guide.

### Prompt
```text
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
```

## Step 2: Advertorial Rewrite
The system writes the new copy using the Style Guide as strict rules.

*   **Inputs**:
    *   `{style_guide}`: The blueprint from Step 1
    *   `{angle}`: Selected Marketing Angle
    *   `{deep_research_output}`: Research Data
    *   `{offer_brief}`: Structure/Strategy Info
*   **Output**: A complete, rewritten advertorial in JSON format.

### Prompt
```text
You are an expert copywriter creating a complete advertorial for a new product, following an exact style guide.
YOUR TASK:
Write a complete advertorial using:

The style specifications from the provided style guide (from Call 1)
All relevant product information from the product data
The specified marketing angle (focus the copy around this emotional driver)
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

Tone & Voice
Formality: Extract from "Formality level" in Tone & Voice section
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
```
