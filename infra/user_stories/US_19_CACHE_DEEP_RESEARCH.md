# Story 19 — Implement caching for deep research step

**Status:** 🟠 CODE WRITTEN (NEEDS TESTING)

**Role:** Backend Developer

---

## Context

The `process_job_v2` pipeline executes expensive operations (page analysis + Perplexity deep research) every time a job runs. When testing or iterating on the same sales page URL, this results in:
- Unnecessary API costs (Perplexity deep research is expensive)
- Long execution times (~1-2 minutes for deep research alone)
- Rate limiting risks with Perplexity API

Currently, there is no caching mechanism, so every run repeats Steps 1-3 regardless of whether the sales page URL has been processed before.

---

## Goal

Implement a caching mechanism that stores and reuses the output of Steps 1-3 (page analysis → prompt creation → deep research execution) when the `sales_page_url` is the same as a previous run.

Cache should:
1. Key on `sales_page_url` (normalized/hashed)
2. Store: `research_page_analysis`, `deep_research_prompt`, `deep_research_output`
3. Be stored in S3 for persistence across Lambda invocations
4. Steps 4+ (avatars, marketing, offer brief) should always execute fresh

---

## Dependency

None

---

## Current Implementation (must change)

### 1) `cdk/lib/lambdas/process_job_v2/pipeline/orchestrator.py`

Lines 237-253 - Steps 1-3 always execute without checking cache:

```python
# Step 1: Analyze research page
logger.info("Step 1: Analyzing research page")
research_page_analysis = self.analyze_page_step.execute(config.sales_page_url)

# Step 2: Create deep research prompt
logger.info("Step 2: Creating deep research prompt")
deep_research_prompt = self.deep_research_step.create_prompt(
    sales_page_url=config.sales_page_url,
    research_page_analysis=research_page_analysis,
    gender=config.gender,
    location=config.location,
    research_requirements=config.research_requirements
)

# Step 3: Execute deep research
logger.info("Step 3: Executing deep research")
deep_research_output = self.deep_research_step.execute(deep_research_prompt)
```

### 2) `cdk/lib/lambdas/process_job_v2/services/aws.py`

No cache-related functionality exists. Currently only saves final results to S3.

---

## Desired Implementation (target state)

### 1) New cache service module

Create `cdk/lib/lambdas/process_job_v2/services/cache.py`:
- `ResearchCacheService` class with methods:
  - `get_cache_key(sales_page_url: str) -> str` - Create deterministic hash from URL
  - `get_cached_research(cache_key: str) -> Optional[CachedResearchData]` - Check S3 for cached data
  - `save_research_cache(cache_key: str, data: CachedResearchData) -> None` - Save to S3
- Cache storage path: `cache/research/{cache_key}/research_cache.json`

### 2) New data model for cached data

Add to `cdk/lib/lambdas/process_job_v2/data_models.py`:

```python
class CachedResearchData(BaseModel):
    """Cached output from Steps 1-3 (page analysis through deep research)."""
    sales_page_url: str
    research_page_analysis: str
    deep_research_prompt: str
    deep_research_output: str
    cached_at: str  # ISO timestamp
    cache_version: str = "1.0"  # For future cache invalidation
```

### 3) Update orchestrator

Modify `PipelineOrchestrator.run()` in orchestrator.py:
- Before Step 1: Check cache for `sales_page_url`
- If cache hit: Load cached data, log "Using cached research", skip Steps 1-3
- If cache miss: Execute Steps 1-3, save results to cache
- Steps 4+ continue as normal

### 4) Cache naming convention

- Cache key: SHA256 hash of normalized URL (lowercase, strip trailing slash)
- Path: `cache/research/{hash}/research_cache.json`

---

## Execution Phases

### Phase 1: Implementation (code written)

#### Task 1: Add CachedResearchData model
- File: `cdk/lib/lambdas/process_job_v2/data_models.py`
- Add new Pydantic model at the end of the file

#### Task 2: Create cache service
- File: `cdk/lib/lambdas/process_job_v2/services/cache.py` (new file)
- Implement `ResearchCacheService` class

#### Task 3: Update orchestrator to use cache
- File: `cdk/lib/lambdas/process_job_v2/pipeline/orchestrator.py`
- Add cache service initialization
- Add cache check before Step 1
- Add cache save after Step 3
- Add cache hit/miss logging

#### Task 4: Update services __init__.py
- File: `cdk/lib/lambdas/process_job_v2/services/__init__.py`
- Export new cache service

### Phase 2: Testing / Verification

#### Task 5: Local test - first run (cache miss)
- Run pipeline with a new sales page URL
- Verify: Full pipeline executes (all steps logged)
- Verify: Cache file created in S3 at `cache/research/{hash}/research_cache.json`

#### Task 6: Local test - second run (cache hit)
- Run pipeline again with the SAME sales page URL
- Verify: Log shows "Using cached research"
- Verify: Steps 1-3 are skipped (no Perplexity call)
- Verify: Steps 4+ still execute
- Verify: Results are still correct

---

## Constraints

- Cache must be stored in S3 (not local filesystem) for Lambda persistence
- Cache key must be deterministic (same URL = same key always)
- Do NOT cache avatar/marketing steps (only Steps 1-3)
- Cache should NOT expire automatically (manual invalidation only for now)

---

## Acceptance Criteria

- [ ] First run with a URL executes full pipeline and creates cache
- [ ] Second run with same URL uses cache and skips Steps 1-3
- [ ] Different URL = cache miss = full execution
- [ ] Avatar and marketing steps always execute fresh
- [ ] Cache stored at `cache/research/{hash}/research_cache.json` in S3
- [ ] Log messages clearly indicate cache hit/miss status

---

## Files to Edit (Expected)

1. `cdk/lib/lambdas/process_job_v2/data_models.py` - Add CachedResearchData model
2. `cdk/lib/lambdas/process_job_v2/services/cache.py` - New file for cache service
3. `cdk/lib/lambdas/process_job_v2/services/__init__.py` - Export cache service
4. `cdk/lib/lambdas/process_job_v2/pipeline/orchestrator.py` - Integrate cache logic
