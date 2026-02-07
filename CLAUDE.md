# Project Rules

## API Documentation Verification (MANDATORY)

Before writing or modifying ANY code that touches Gradium or World Labs APIs, you MUST re-fetch and verify the current documentation first. Do not rely on memory or cached knowledge — these are new APIs and details change.

- **Gradium docs:** https://gradium.ai/api_docs.html
- **World Labs docs:** https://docs.worldlabs.ai/api
- **SparkJS docs:** https://sparkjs.dev/docs/

Verify: endpoint URLs, request/response schemas, auth headers, audio formats, message types. If anything in the code doesn't match the docs, fix it immediately.

## Project Docs

All project context lives in `docs/`:
- `docs/PRD.md` — Product requirements
- `docs/TECHNICAL.md` — Architecture and API integration details
- `docs/ROADMAP.md` — Execution checklist
- `docs/CHANGELOG.md` — Log every change with justification and file paths
