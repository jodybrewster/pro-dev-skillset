# pro-spdd Usage

Use the canonical OpenSPDD command flow:

```text
/spdd-story <business requirement>
/spdd-analysis @requirements/[User-story-N]...
/spdd-reasons-canvas @spdd/analysis/...
/spdd-generate @spdd/prompt/...
```

When requirements change before or during implementation:

```text
/spdd-prompt-update @spdd/prompt/... <changed requirement>
```

When implementation changes first and the prompt needs to be brought back in sync:

```text
/spdd-sync @spdd/prompt/...
```

Optional workflows:

```text
/spdd-api-test @spdd/prompt/...        # Generate API test script
/spdd-code-review @spdd/prompt/...     # Review code against REASONS Canvas
/spdd-reverse @src/or/feature/path      # Codify existing implementation into REASONS Canvas
```

Default artifact directories:

```text
requirements/
spdd/
  analysis/
  prompt/
scripts/
```

