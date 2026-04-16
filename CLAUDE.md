# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
uv sync --all-extras          # Install all dependencies (Python 3.11–3.12)
make check                    # Format check + lint (run before committing)
make fix                      # Auto-fix lint issues + format
make test                     # Run pytest suite
make sort-authors             # Sort authors.yaml alphabetically

# Notebook testing
make test-notebooks                                          # Structure tests (fast, no API calls)
make test-notebooks-exec                                     # Execute notebooks (slow, requires API key)
make test-notebooks NOTEBOOK=tool_use/calculator_tool.ipynb  # Single notebook
make test-notebooks NOTEBOOK_DIR=capabilities                # Specific directory

# Tox environments
uv run tox -e structure           # Structural validation only
uv run tox -e execution-single -- tool_use/calculator_tool.ipynb
```

## Architecture

This repo is a collection of standalone Jupyter notebooks organized by capability. The key moving parts:

**Registry system:** `registry.yaml` is the source of truth for what notebooks exist — it maps each notebook to its authors, categories, and description. `authors.yaml` (alphabetically sorted) maps GitHub usernames to contributor details. Adding a notebook requires updating both files.

**Validation pipeline:** `scripts/validate_notebooks.py` (pre-commit hook) checks notebook structure. `scripts/validate_all_notebooks.py` runs comprehensive validation including secret detection. `tests/notebook_tests/test_notebooks.py` drives pytest-based structural and execution tests.

**Claude Code integration:** `.claude/commands/` holds slash commands (`/notebook-review`, `/model-check`, `/link-review`, `/review-pr`, `/add-registry`). `.claude/agents/code-reviewer.md` is a subagent invoked automatically after significant code changes. `.claude/skills/cookbook-audit/` contains the rubric and validator for notebook auditing.

**CI:** Workflows in `.github/workflows/` only run on changed files. `notebook-tests.yml` runs structure tests on every PR and execution tests for changed notebooks. `claude-pr-review.yml` posts an AI-generated review on every PR.

## Code Style

- Line length: 100 characters, double quotes (Ruff v0.14+)
- Lint rules: E, F, I, W, UP, S, B
- Notebooks get relaxed rules: E402 (mid-file imports), F811 (redefinitions), N803/N806 (naming)

## Models

Always use non-dated aliases. Define a `MODEL` constant at the top of each notebook.

| Alias | Use |
|-------|-----|
| `claude-opus-4-6` | Most capable |
| `claude-sonnet-4-6` | Default |
| `claude-haiku-4-5` | Fast/cheap |

Bedrock uses dated IDs: `anthropic.claude-opus-4-6-v1`, `anthropic.claude-sonnet-4-5-20250929-v1:0`, `anthropic.claude-haiku-4-5-20251001-v1:0`. Prepend `global.` for global endpoints.

## Notebook Conventions

**Required structure:** Introduction (problem hook + learning objectives) → Prerequisites (setup, installs) → Sections with explanatory text *before and after* each code block → Conclusion (maps back to objectives).

- Use `%%capture` for pip install cells
- Load env vars with `dotenv.load_dotenv()`, never `os.environ` directly
- Keep cell outputs (intentional for demonstration)

**registry.yaml entry:**
```yaml
- title: "Notebook Title"
  description: "What problem this solves"
  path: "directory/notebook.ipynb"
  authors:
    - github_username
  date: "YYYY-MM-DD"
  categories:
    - Category1
```

## Pre-commit Hooks

Runs automatically on `git commit`: ruff-check (lint + fix), ruff-format, validate-notebooks, validate-authors-sorted.

## Environment Variables

```
ANTHROPIC_API_KEY   # Required for execution tests
OPENAI_API_KEY      # OpenAI integrations
VOYAGE_API_KEY      # Voyage embeddings
PINECONE_API_KEY    # Pinecone integrations
MONGODB_URI         # MongoDB integrations
DEEPGRAM_API_KEY    # Deepgram integrations
ELEVENLABS_API_KEY  # ElevenLabs integrations
WOLFRAM_APP_ID      # Wolfram integrations
```
