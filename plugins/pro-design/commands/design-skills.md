---
description: "Check, install, or update the seven external design-skill collections that pro-design bridges to or forks from (emil, jakub, garden, mengto, tastemaker, elaya, owl). Reports which skills are installed and where, installs or updates them in place, and diffs the local catalog against the live upstream. Usage: /design-skills [check|install|update] [collection] [skill-name]"
argument-hint: "[check|install|update] [collection] [skill-name]"
allowed-tools:
  - "Bash(npx -y skills add emilkowalski/skills*)"
  - "Bash(npx -y skills add jakubkrehel/skills*)"
  - "Bash(npx -y skills add ConardLi/garden-skills*)"
  - "Bash(npx -y skills add MengTo/Skills*)"
  - "Bash(npx -y skills add codeswithroh/tastemaker*)"
  - "Bash(npx -y skills add elayadesign/ai-design-skills*)"
  - "Bash(npx -y skills add Owl-Listener/designer-skills*)"
  - "Bash(ls ~/.claude/skills*)"
  - "Bash(ls .claude/skills*)"
  - "Bash(gh api repos/emilkowalski/skills/*)"
  - "Bash(gh api repos/jakubkrehel/skills/*)"
  - "Bash(gh api repos/ConardLi/garden-skills/*)"
  - "Bash(gh api repos/MengTo/Skills/*)"
  - "Bash(gh api repos/codeswithroh/tastemaker/*)"
  - "Bash(gh api repos/elayadesign/ai-design-skills/*)"
  - "Bash(gh api repos/Owl-Listener/designer-skills/*)"
  - "Bash(curl -s https://api.github.com/repos/emilkowalski/skills/*)"
  - "Bash(curl -s https://api.github.com/repos/jakubkrehel/skills/*)"
  - "Bash(curl -s https://api.github.com/repos/ConardLi/garden-skills/*)"
  - "Bash(curl -s https://api.github.com/repos/MengTo/Skills/*)"
  - "Bash(curl -s https://api.github.com/repos/codeswithroh/tastemaker/*)"
  - "Bash(curl -s https://api.github.com/repos/elayadesign/ai-design-skills/*)"
  - "Bash(curl -s https://api.github.com/repos/Owl-Listener/designer-skills/*)"
  - "Bash(git clone https://github.com/codeswithroh/tastemaker*)"
---

Manage the seven external design-skill collections that `pro-design` either bridges to or forks individual skills from.
These collections are **not vendored** into this marketplace (apart from the named forks listed below, which ship as normal pro-design skills); this command manages the external installs in place via the [`npx skills add`](https://github.com/vercel-labs/agent-skills) CLI.

Parse the action from `$ARGUMENTS` (default `check`), an optional collection alias, and an optional skill name.
With no collection, `check` covers all seven and `install` asks which one rather than installing everything.

## Collections

| Alias | Repo | Already in pro-design | External install names |
| --- | --- | --- | --- |
| `emil` | `emilkowalski/skills` | forked: `emil-design-eng`, `animate`, `apple-design`, `animation-vocabulary` | `animate-expo`, `animate`, `animation-vocabulary`, `apple-design`, `ask-sonner`, `emil-design-eng`, `find-animation-opportunities`, `improve-animations`, `pick-ui-library`, `prototype`, `review-animations`, `write-swift` |
| `jakub` | `jakubkrehel/skills` | forked: `interface-review`, `better-interface`, `better-layout` | `better-accessibility`, `better-colors`, `better-interface`, `better-layout`, `better-typography`, `better-ui`, `better-writing`, `break`, `explain-interface`, `interface-review`, `variant` |
| `garden` | `ConardLi/garden-skills` | bridge: `web-design-engineer-bridge` | `web-design-engineer`, `beautiful-article`, `web-video-presentation`, `gpt-image-2`, `kb-retriever` |
| `mengto` | `MengTo/Skills` | bridge: `mengto-skills-bridge`; forked: `build-awwwards-quality-sites` | 130 skills across `web-design`, `codex`, `game-development`, `media`, `ui`. Notable: `video-to-superprompt`, `html-to-interaction-prompts`, `cinematic-scroll-storytelling`, `build-threejs-scroll-worlds`, `cinematic-gsap-lenis-motion-system`, `progressive-blur`, `optimize-web-animations`. Full list: the upstream README and `agent-skills/web-design/WEB-DESIGN-SKILLS.md` |
| `tastemaker` | `codeswithroh/tastemaker` | bridge: `tastemaker-bridge` | `tastemaker` (carries the `ideagram` sub-skill inside its folder) |
| `elaya` | `elayadesign/ai-design-skills` | forked: `landing-page-design` | `landing-page-design` |
| `owl` | `Owl-Listener/designer-skills` | forked: `accessibility-audit`, `design-token`, `motion-system`, `typography-scale`, `screen-critique`, `perception-laws` | 107 skills across `design-research`, `design-systems`, `ux-strategy`, `ui-design`, `interaction-design`, `prototyping-testing`, `design-ops`, `designer-toolkit`, `visual-critique` |

Install names come from each skill's `name:` frontmatter, which is what the CLI installs under.
For all seven collections here the frontmatter name matches the folder name.

## 1. `check` (default)

- List `~/.claude/skills/` (user scope, applies to every project) and `.claude/skills/` (project scope), and report which install names from the requested collection - or from all seven, when no collection is given - are present and at which scope.
  Read each installed skill's `name:` frontmatter rather than trusting the directory name.
- Report installed vs missing per collection.
- **Say clearly which update path applies to what.**
  The skills pro-design forks (the "Already in pro-design" column) ship inside this marketplace and update with `claude plugin update`.
  The external installs listed here update through `/design-skills update`.
  A skill can legitimately exist in both places at once; that is redundant, not broken.
- **Upstream catalog diff** (only when a collection is named).
  Pull the live skill list and compare it against the table above:
  1. `gh api repos/<owner>/<repo>/git/trees/HEAD?recursive=1 --jq '.tree[] | select(.path | endswith("SKILL.md")) | .path'`
  2. Fallback without `gh`: `curl -s https://api.github.com/repos/<owner>/<repo>/git/trees/HEAD?recursive=1 | jq -r '.tree[] | select(.path | endswith("SKILL.md")) | .path'`
  3. Derive the skill name from the second-to-last path segment (`skills/<name>/SKILL.md` for emil, jakub, garden, elaya, tastemaker; `agent-skills/<group>/<name>/SKILL.md` for mengto; `<group>/skills/<name>/SKILL.md` for owl).
  4. Report **upstream-only names** (new skills missing from the table above - suggest updating this command and the matching bridge skill, which needs a pro-design version bump) and **local-only names** (renamed or removed upstream - flag as stale).
  - If any of these calls fail (no network, no `gh`/`curl`/`jq`, rate limit), say the upstream diff was skipped and continue.
    That is a skip, not an error.
- Do **not** change anything on `check`.

## 2. `install [collection] [skill]`

All commands below are verified against the `npx skills add` CLI.
They install at **project scope**, into `./.claude/skills/<install-name>/`, and write a `skills-lock.json` in the current directory.
Add `-g` to install at user scope (`~/.claude/skills/`) instead.
`-a claude-code -y` keeps the run non-interactive; the CLI also auto-detects an agent session, but pass the flags anyway so the command behaves the same in a terminal.

| Collection | Command |
| --- | --- |
| `garden` | `npx -y skills add ConardLi/garden-skills -s web-design-engineer -a claude-code -y` |
| `mengto` | `npx -y skills add MengTo/Skills -s <install-name> -a claude-code -y` (e.g. `-s video-to-superprompt`) |
| `tastemaker` | `npx -y skills add codeswithroh/tastemaker -a claude-code -y` |
| `emil` | `npx -y skills add emilkowalski/skills -s <install-name> -a claude-code -y` |
| `jakub` | `npx -y skills add jakubkrehel/skills -s <install-name> -a claude-code -y` |
| `elaya` | `npx -y skills add elayadesign/ai-design-skills -a claude-code -y` |
| `owl` | `npx -y skills add Owl-Listener/designer-skills -s <install-name> -a claude-code -y` |

Drop `-s <install-name>` to install every skill in a collection.
Do that for `elaya` (one skill) and `garden` (five) if you want them all; do **not** do it for `mengto` (130) or `owl` (107) without the user asking.

**Per-collection notes.**

- **`tastemaker`.** Install the whole repo with no `-s` filter.
  The CLI discovers one skill, `tastemaker`, and copies the folder whole: `references/`, `scripts/`, `assets/`, and the nested `ideagram/` sub-skill all land intact (70 files, about 620 KB).
  Verified - the skill is useless without those, and they do come across.
  Do **not** pass `--full-depth`: it splits `ideagram` out as a second top-level skill, which is not how the upstream expects it to be loaded.
  The scripts need **Python 3** (Pillow for the image paths).
  If `npx` is unavailable, the upstream README's Claude-plugin path works too: `/plugin marketplace add codeswithroh/tastemaker` then `/plugin install tastemaker@codeswithroh`.
  Last-resort manual fallback: `git clone https://github.com/codeswithroh/tastemaker` and copy `skills/tastemaker` into `~/.claude/skills/` or `.claude/skills/`.
- **`mengto`.** The repo has no top-level `skills/` directory - skills live at `agent-skills/<group>/<name>/`.
  The CLI discovers the nested layout without `--full-depth`, and `-s <install-name>` filters correctly.
  Verified with `-s video-to-superprompt`.
- **`owl`.** Same nested pattern (`<group>/skills/<name>/`), and `-s` works the same way.
  Verified with `-s color-system`.
  This collection is also installable as Claude plugins: `/plugin marketplace add Owl-Listener/designer-skills`.
- **`garden`.** `-s web-design-engineer` brings the whole 39-file tree, including `references/style-recipes/` and the acceptance harness.
- **`jakub`.** `better-interface` is the router for the `better-*` family, and it reports any domain whose `better-*` skill is not installed as `Not reviewed`.
  So `/design-skills install jakub` (no `-s`, all 11 skills) is the way to get full coverage out of `interface-review`; installing only the three pro-design forks leaves most domains unreviewed.
- **Redundant installs are harmless.** Installing a collection's already-forked skills externally as well just gives you two copies with the same `name:`.
  It is redundant rather than broken, but prefer the forked pro-design version so it stays on the marketplace update path.

After installing, re-check presence and report the resulting install names and scope.

## 3. `update [collection] [skill]`

- Re-run the same install command.
  The newer `SKILL.md` and sidecars replace the older ones in place.
  Install names are stable across versions, so nothing downstream needs renaming.
- `npx -y skills update` also works for skills already recorded in `skills-lock.json`, but re-running the install is the path this command documents because it works whether or not a lock file exists.
- Report before -> after for the affected skills.

## Notes

- This command manages the **external skills**.
  The bridge skills in this plugin - `web-design-engineer-bridge`, `tastemaker-bridge`, `mengto-skills-bridge`, `taste-skills-bridge`, `impeccable-bridge` - are thin routers: they catch the intent and hand off to whichever external skill is installed.
- Nothing from these repos is committed to this marketplace except the individually forked skills listed in the table above, each of which carries an attribution footer.
- All seven upstream repos are MIT licensed.
  Install and license terms are governed by the upstream repos, not by this marketplace.
- `/taste-skills` is the equivalent command for the `Leonxlnx/taste-skill` library, which is managed separately.
