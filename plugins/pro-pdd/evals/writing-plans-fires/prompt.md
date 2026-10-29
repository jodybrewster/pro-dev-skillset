---
description: A multi-step feature with a short spec and a request for a written plan before any code. The skill should fire and the reply should follow the plan structure.
expected_outcome: The reply is a plan document with a header (goal, architecture, tech stack), exact file paths per task and test-first steps with commands. It writes no implementation yet.
max_turns: 12
allowed_tools: [Read, Glob, Grep, Skill]
---

We want to add CSV export to the reports page. Spec: a new `GET /api/reports/:id/export.csv` endpoint streams the report rows as CSV; the reports page gets an "Export" button that downloads it; rows with commas or quotes must be escaped; exports over 50,000 rows must be refused with a 413. The backend is Express with jest and the frontend is React with Testing Library.

Please write up the implementation plan for this before anyone touches code.
