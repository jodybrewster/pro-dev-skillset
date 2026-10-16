# Full install test

Moved from `CLAUDE.md`, whose "Verifying your work" block keeps steps 1 and 2.
Run all five steps.
All must pass - don't commit if any fail.

```bash
# 3. Install into demo/app and build + vitest
./demo/setup.sh

# 4. Test pro-starter (the user-facing meta-install) from inside demo/app
cd demo/app
claude plugin install pro-starter@pro-dev-skillset --scope project

# 5. Codex install smoke test (requires Codex access — run after 6:10 PM if at daily limit)
#    Install the touched plugin(s) via Codex and confirm skills load without errors.
#    Use the .agents/plugins/marketplace.json Codex marketplace, not the Claude one.
```

Step 4 installs `pro-starter` on top of the individual plugins already put down by `setup.sh`.
It exercises the dependency resolution cascade (`pro-core`, `pro-design`, `pro-nextjs`, etc.) and confirms that the meta-plugin resolves cleanly without loader rejection.
Verify the output shows all plugins loaded with no errors.

Step 5 is gated on Codex access - `check.mjs` already catches static Codex parity failures (non-portable frontmatter keys, Claude-Code-only tool names, missing `.codex-plugin/plugin.json`, version drift between Claude and Codex manifests) so steps 1-4 are sufficient for a quick check.
Run step 5 whenever Codex access is available before pushing.

If step 4 fails, check: version-bump law violated, `*` version constraint on a cross-marketplace dep (they report `"unknown"` - drop the hard dep instead) or a missing sidecar file.
