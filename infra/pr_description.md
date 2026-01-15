## 🚀 Pull Request: Refactoring & System Documentation

### 📝 Summary
This PR implements a major refactoring of the `image_gen_process` and `write_swipe` Lambda functions, moving them from monolithic handlers to a modular, pipeline-based architecture. Additionally, it creates comprehensive system documentation detailing the end-to-end flows and all LLM prompts used across the core Lambdas.

### 🏗️ Key Changes

#### 1. Refactor: `image_gen_process` Lambda
*   **Modularization**: Decomposed the single `handler.py` into a clear directory structure:
    *   `pipeline/`: Contains the orchestrator and individual steps (Product Detection, Angle Matching, Image Generation).
    *   `services/`: Encapsulates external service logic (AWS, Cloudflare, Gemini, OpenAI).
    *   `utils/`: Helper functions for image processing and logging.
    *   `prompts.py`: Centralized location for all LLM prompts.
*   **Clean Up**: Reduced `handler.py` to a lightweight entry point.

#### 2. Refactor: `write_swipe` Lambda
*   **Modularization**: Similar to the above, decomposed `handler.py` and `swipe_file_writer.py` into:
    *   `pipeline/`: Orchestrator and steps (Template Selection, Swipe Generation).
    *   `services/`: Encapsulates logic for Anthropic and AWS interactions.
    *   `utils/`: Helpers for HTML/PDF handling and retries.
    *   `prompts.py`: Centralized location for Style Analysis and Rewrite prompts.
*   **Deletion**: Removed the obsolete `swipe_file_writer.py`.

#### 3. 📚 Documentation (`system_flow_documentation.md`)
*   Created a new master documentation file that serves as an onboarding guide and system reference.
*   **Content**:
    *   **Process Job V2**: Detailed breakdown of the research pipeline (Deep Research, Avatars, Beliefs, Angles, etc.).
    *   **Image Gen Process**: Explains the flow from product detection to image generation.
    *   **Write Swipe**: Details the style analysis and rewriting process.
    *   **Prompts**: Includes the **exact, full-text prompts** for every step in these pipelines, removing Python jargon for easier reading by non-technical stakeholders.

### 🎯 Objective
*   Improve code maintainability and testability by separating concerns.
*   Centralize prompt management.
*   Provide clear, accessible documentation for new team members and stakeholders.
