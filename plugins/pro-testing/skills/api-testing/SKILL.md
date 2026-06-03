---
name: api-testing
description: >-
  Test REST and GraphQL APIs with Playwright APIRequestContext, Supertest, or standalone
  HTTP clients. Covers schema validation with Zod/AJV, contract testing patterns,
  auth flow testing, CRUD lifecycle tests, error response validation, and performance
  assertions. Use when: "API test," "endpoint test," "REST test," "GraphQL test,"
  "schema validation," "Postman replacement."
  Related: contract-testing, test-data-management, ci-cd-integration, playwright-automation.
---

# api-testing

Follow `../../upstream/qa-skills/skills/api-testing/SKILL.md` and its `references/`.

- Adapt upstream tool names to the current session's capabilities.
- Do not run any upstream CLI bootstrap, install flow, or `.agents/` provisioning unless the user explicitly asks.
- Sibling QA skills the upstream doc points to live under `../../upstream/qa-skills/skills/` — consult them there even if they don't auto-trigger here.
- CROSS-REF: this is general / standalone API testing. For SPDD Phase-4 cURL tests bound to acceptance criteria, use `spdd-api-test-lead` (pro-spdd) instead. For consumer-driven contracts, use `contract-testing`.

_Vendored from [petrkindlmann/qa-skills](https://github.com/petrkindlmann/qa-skills) — MIT. See plugin `LICENSE` and `../../upstream/qa-skills/LICENSE`._
