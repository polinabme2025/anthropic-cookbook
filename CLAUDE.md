# Claude Cookbooks

A collection of Jupyter notebooks and Python examples for building with the Claude API.

## Quick Start

```bash
# Install dependencies
uv sync --all-extras

# Install pre-commit hooks
uv run pre-commit install

# Set up API key
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

## Development Commands

```bash
make format        # Format code with ruff
make lint          # Run linting
make check         # Run format-check + lint
make fix           # Auto-fix issues + format
make test          # Run pytest
```

Or directly with uv:

```bash
uv run ruff format .           # Format
uv run ruff check .            # Lint
uv run ruff check --fix .      # Auto-fix
uv run pre-commit run --all-files
```

## Code Style

- **Line length:** 100 characters
- **Quotes:** Double quotes
- **Formatter:** Ruff
- **Python:** 3.11–3.12 (pinned in pyproject.toml)

Notebooks have relaxed rules for mid-file imports (E402), redefinitions (F811), and variable naming (N803, N806).

## Testing

### Fast structural tests (no API calls)

```bash
make test-notebooks                                              # All notebooks
make test-notebooks NOTEBOOK=tool_use/calculator_tool.ipynb     # Single notebook
make test-notebooks NOTEBOOK_DIR=capabilities                   # Directory
```

### Full execution tests (requires ANTHROPIC_API_KEY)

```bash
make test-notebooks-exec
make test-notebooks-exec NOTEBOOK=tool_use/calculator_tool.ipynb
```

### Tox environments

| Environment        | Description                                    |
|--------------------|------------------------------------------------|
| `structure`        | Fast structural tests, no API calls            |
| `structure-single` | Structural test for a single notebook          |
| `execution`        | Full notebook execution (needs API key)        |
| `execution-single` | Execute a single notebook                      |
| `registry`         | Test only notebooks listed in registry.yaml    |
| `quick`            | Smoke test on core `capabilities/` notebooks   |
| `third-party`      | Third-party integration notebooks              |
| `lint`             | Run ruff checks                                |
| `format`           | Run ruff format                                |

```bash
uv run tox -e structure
uv run tox -e quick
uv run tox -e structure-single -- tool_use/calculator_tool.ipynb
```

### Pytest options

```
--notebook PATH         Test a specific notebook
--notebook-dir DIR      Test all notebooks in a directory
--execute-notebooks     Actually run notebooks (needs API key)
--notebook-timeout N    Execution timeout in seconds (default: 300)
--skip-third-party      Skip third_party/ directory
--registry-only         Only test notebooks in registry.yaml
```

## Git Workflow

**Branch naming:** `<username>/<feature-description>`

**Commit format (conventional commits):**
```
feat(scope): add new feature
fix(scope): fix bug
docs(scope): update documentation
style: lint/format
```

## Key Rules

1. **API Keys:** Never commit `.env` files. Always use `os.environ.get("ANTHROPIC_API_KEY")`

2. **Dependencies:** Use `uv add <package>` or `uv add --dev <package>`. Never edit pyproject.toml directly.

3. **Models:** Use current Claude models. Check docs.anthropic.com for latest versions.
   - Sonnet: `claude-sonnet-4-6`
   - Haiku: `claude-haiku-4-5`
   - Opus: `claude-opus-4-6`
   - **Never use dated model IDs** (e.g., `claude-sonnet-4-6-20250514`). Always use the non-dated alias.
   - **Bedrock model IDs** follow a different format. Use the base Bedrock model ID from the docs:
     - Opus 4.6: `anthropic.claude-opus-4-6-v1`
     - Sonnet 4.5: `anthropic.claude-sonnet-4-5-20250929-v1:0`
     - Haiku 4.5: `anthropic.claude-haiku-4-5-20251001-v1:0`
     - Prepend `global.` for global endpoints (recommended): `global.anthropic.claude-opus-4-6-v1`
     - Note: Bedrock models before Opus 4.6 require dated IDs in their Bedrock model ID.

4. **Notebooks:**
   - Keep outputs in notebooks (intentional for demonstration)
   - One concept per notebook
   - Test that notebooks run top-to-bottom without errors
   - No empty cells; no error outputs in saved state
   - Install cells should use `%%capture` or `pip -q` to suppress noisy output

5. **Quality checks:** Run `make check` before committing. Pre-commit hooks validate formatting and notebook structure.

6. **Authors:** When adding a new contributor, add an entry to `authors.yaml`. The file must remain sorted alphabetically — run `make sort-authors` to fix ordering.

## Pre-commit Hooks

Four hooks run automatically on `git commit`:

| Hook                      | What it checks                                                    |
|---------------------------|-------------------------------------------------------------------|
| `ruff-check`              | Linting of `.py` and `.ipynb` files (auto-fix enabled)            |
| `ruff-format`             | Code formatting of `.py` and `.ipynb` files                       |
| `validate-notebooks`      | No empty cells, no error outputs in `.ipynb` files                |
| `validate-authors-sorted` | `authors.yaml` is sorted alphabetically                           |

## Slash Commands

These commands are available in Claude Code and CI:

- `/notebook-review` - Review notebook quality against style guide
- `/model-check` - Validate Claude model references (no dated IDs)
- `/link-review` - Check links in changed files for quality/security issues
- `/add-registry` - Add a new notebook entry to registry.yaml
- `/review-pr` - Interactive PR review (posts comment to GitHub)
- `/review-pr-ci` - Automated PR review used by CI workflow
- `/review-issue` - Review and respond to a GitHub issue

## CI/CD Workflows

| Workflow                    | Trigger                    | Purpose                               |
|-----------------------------|----------------------------|---------------------------------------|
| `lint-format.yml`           | push/PR                    | Ruff lint and format checks           |
| `notebook-quality.yml`      | `*.ipynb` changes          | Structural notebook validation        |
| `notebook-tests.yml`        | `*.ipynb` changes          | Notebook execution tests              |
| `notebook-diff-comment.yml` | PR                         | Posts notebook diff as PR comment     |
| `claude-pr-review.yml`      | PR on `.ipynb`/`.py` files | Claude-powered code review            |
| `claude-model-check.yml`    | PR                         | Validates model IDs are non-dated     |
| `claude-link-review.yml`    | PR                         | Reviews links in changed files        |
| `links.yml`                 | push/schedule              | Lychee link checker                   |
| `verify-authors.yml`        | `authors.yaml` changes     | Validates and sorts author entries    |

## Project Structure

```
capabilities/              # Core Claude capabilities
  classification/          # Classification with RAG and chain-of-thought
  contextual-embeddings/   # Contextual retrieval for RAG
  retrieval_augmented_generation/
  summarization/
  text_to_sql/

claude_agent_sdk/          # Agent SDK tutorial series
  00_The_one_liner_research_agent.ipynb
  01_The_chief_of_staff_agent.ipynb
  02_The_observability_agent.ipynb
  research_agent/          # Standalone research agent implementation
  chief_of_staff_agent/    # Multi-agent orchestration with audit/reporting
  observability_agent/     # Agent with Docker + MCP server integration

coding/                    # Code generation and frontend aesthetics
patterns/                  # Agent design patterns
  agents/                  # basic_workflows, evaluator_optimizer, orchestrator_workers

skills/                    # Skill-based notebooks and utilities
  custom_skills/           # Example custom skill implementations
  notebooks/               # Skill demonstration notebooks
  skill_utils.py           # Shared skill utilities
  file_utils.py            # File operation helpers

tool_use/                  # Tool use and integration patterns
  calculator_tool.ipynb
  customer_service_agent.ipynb
  extracting_structured_json.ipynb
  memory_cookbook.ipynb
  parallel_tools.ipynb
  programmatic_tool_calling_ptc.ipynb
  tool_use_with_pydantic.ipynb
  vision_with_tools.ipynb
  automatic-context-compaction.ipynb

multimodal/                # Vision and image processing
extended_thinking/         # Extended reasoning notebooks
misc/                      # Batch processing, caching, utilities
  batch_processing.ipynb
  building_evals.ipynb
  metaprompt.ipynb
  prompt_caching.ipynb
  session_memory_compaction.ipynb
  using_citations.ipynb

observability/             # API usage and cost tracking
finetuning/                # Fine-tuning examples (AWS Bedrock)
tool_evaluation/           # Tool evaluation methodology

third_party/               # Third-party integrations
  Deepgram/                # Speech recognition
  ElevenLabs/              # Text-to-speech
  LlamaIndex/
  MongoDB/
  Pinecone/
  VoyageAI/
  Wikipedia/
  WolframAlpha/

scripts/                   # Validation and utility scripts
  validate_notebooks.py    # Check for empty cells and error outputs
  validate_authors_sorted.py
  test_notebooks.py

tests/                     # Pytest test suite
  conftest.py              # Fixtures and custom pytest options
  notebook_tests/
    test_notebooks.py      # Structural + execution tests
    utils.py               # Helper functions

.claude/                   # Claude Code configuration
  commands/                # Slash command definitions (.md files)
  skills/cookbook-audit/   # Cookbook audit skill with style guide
  agents/code-reviewer.md  # Code reviewer subagent definition
```

## registry.yaml Format

Every published notebook must be registered. Add an entry with:

```yaml
- title: Short descriptive title
  description: One or two sentence description of what the notebook demonstrates.
  path: directory/notebook_name.ipynb
  authors:
    - github-username
  date: 'YYYY-MM-DD'
  categories:
    - Category1
    - Category2
```

Available categories include: `Multimodal`, `Tools`, `RAG & Retrieval`, `Agent Patterns`, `Integrations`, `Responses`, `Skills`.

## Adding a New Cookbook

1. Create notebook in the appropriate directory
2. Ensure the notebook runs top-to-bottom without errors
3. Add entry to `registry.yaml` with title, description, path, authors, categories, and date
4. Add author info to `authors.yaml` if new contributor, then run `make sort-authors`
5. Run `make check` and fix any issues
6. Run `make test-notebooks NOTEBOOK=path/to/your_notebook.ipynb`
7. Submit PR — CI will run `/notebook-review`, `/model-check`, and `/link-review` automatically

## Notebook Quality Standards

Notebooks should follow these pedagogical standards (enforced by `/notebook-review`):

- **Introduction:** Hook with the *problem being solved*, not the machinery. List 2–4 Terminal Learning Objectives (TLOs) as bullet points.
- **Prerequisites:** List required packages and API keys. Use `%%capture` for install output.
- **Structure:** One concept per section. Use markdown headers to guide the reader.
- **Conclusion:** Maps back to the TLOs; suggests next steps or related notebooks.
- **Security:** No hardcoded API keys. Use `os.environ.get("ANTHROPIC_API_KEY")`.
- **Code:** Readable, documented where logic is non-obvious. Avoid premature abstraction.
