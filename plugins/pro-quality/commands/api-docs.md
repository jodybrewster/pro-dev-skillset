---
description: Write or correct API reference docs from the real handlers, schemas, and serializers - including the error and auth models most references skip.
argument-hint: '[endpoint, route file, or spec path]'
---

Document the API surface at `$ARGUMENTS` using the `api-documenter` subagent. If `$ARGUMENTS` is empty, cover the API surface that changed in this session.

If no harness subagent mechanism is available, read `agents/api-documenter.md` in this plugin and follow it directly.

Start from the route table rather than the existing docs - the existing docs are what is being checked, so they cannot be the source of truth. For each endpoint, resolve router, middleware, handler, schema, and serializer before writing anything.

The reference is not done until it covers, per endpoint:

- Request and response shapes matching code and schema truth, including nullability.
- One working example and one realistic error example, with real field values.
- Auth: which scheme, which scopes, and how expiry differs from insufficient permission.
- Pagination, rate limits, and whether a retry is safe.
- Deprecations with a migration path and a removal signal.

Where code and schema disagree, surface the disagreement rather than documenting whichever looks right. Name any endpoint whose behavior could not be confirmed statically and needs a live call.
