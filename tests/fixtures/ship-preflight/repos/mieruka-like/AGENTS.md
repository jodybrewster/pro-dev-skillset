# Agents

## Ship

How this repo ships.

```yaml
targets:
  - id: mieruka
    kind: tag-release
    env: production
    packages: [apps/web, packages/cli, apps/desktop]
    rollback:
      triggers:
        - a release build fails to start
      steps:
        - check out the previous tag
      rto: 15 minutes
last_deploy: tag
```

## Other notes

Nothing else here.
