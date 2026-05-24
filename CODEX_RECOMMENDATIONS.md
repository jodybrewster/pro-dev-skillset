# Codex Recommendations

Feedback from the Codex review on 2026-05-24.

## Summary

The research supports this repo's current direction, but the repo should stay curated rather than expanding into a large all-purpose frontend framework. The current marketplace is strongest as a personal/team methodology stack with focused plugins, not as an ECC-style kitchen sink.

## Recommendations

1. **Keep `pro-starter` lean.**
   The current split into `pro-core`, `pro-quality`, `pro-design`, `pro-testing`, `pro-data`, `pro-spec`, and `pro-nextjs` is coherent. Avoid adding `pro-meta`, `pro-vite-react`, or `pro-observability` until repeated real project demand makes them worth the extra surface area.

2. **Decide whether `pro-nextjs` stays a marker or becomes real.**
   The research describes a richer `pro-nextjs` plugin with App Router, React Server Components, Server Actions, Vercel, and v0 handoff guidance. The repo currently treats `pro-nextjs` as a marker plugin. That is fine, but it should be intentional. If most target projects are Next.js apps, graduating `pro-nextjs` into a real stack plugin is probably the next highest-value addition.

3. **Add upstream provenance metadata.**
   Per-plugin `LICENSE` files and SKILL footers are useful, but quarterly drift audits would be easier with explicit source metadata. Add either per-plugin `UPSTREAM.md` files or per-skill `UPSTREAM` files containing source repo, path, commit, and local modification notes.

4. **Keep companion plugins opt-in for now.**
   The research recommends cross-marketplace dependencies, but this repo intentionally avoids them because missing cross-marketplace deps can silently disable plugins. Keep the companion-script approach unless current Claude Code behavior is re-tested and confirmed to be safer.

5. **Consider `pro-meta` only for maintenance.**
   A small maintenance plugin or script collection could help this repo scale: upstream checks, release checklist helpers, Codex parity smoke instructions, and marketplace audit tooling. Do not install it by default through `pro-starter`.

6. **Add a drift-audit script.**
   The biggest recurring risk is documentation and manifest drift. Add a script that checks:
   - marketplace and plugin version consistency
   - `SKILL.md` count used in docs
   - legacy `superpowers:` references
   - missing sidecar files referenced by skills
   - dependency ranges after version bumps
   - stale private-repo install commands

7. **Do not import gstack or ECC wholesale.**
   Treat gstack and ECC as reference libraries. Cherry-pick small, pure-markdown ideas such as adversarial review, careful/freeze/guard style commands, and security scan patterns. Avoid daemon or CLI-dependent commands unless the full runtime is vendored and tested.

## Practical Next Steps

1. Add upstream provenance metadata.
2. Add a drift-audit script and wire it into CI.
3. Decide whether `pro-nextjs` should become a real stack plugin.
4. Re-test cross-marketplace dependency behavior before replacing companion scripts with plugin dependencies.
