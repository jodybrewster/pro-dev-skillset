# Install profiles

A profile is one answer to "what kind of project is this".
It decides the optional engines for you.
Before profiles, `/pro-core:pro-dev install` asked a yes or no question for every optional engine row, which is more than a dozen questions on a fresh machine.
Now it asks one, applies the profile and only then asks the two or three questions that carry real consent.

The profiles live in `plugins/pro-core/registry/engines.json` under `profiles`, so that file is the source of truth and this page follows it.

## The profiles

| Profile | What it is | Engines it turns on |
|---|---|---|
| `landing-page` | A few sections, a hero, strong visual craft and no product behind it. | `elaya`, `taste-skill`, `mengto`, `tastemaker`, `garden`, `owl`, `vercel-react`, `vercel` |
| `website` (default) | Several pages, a CMS or MDX, where SEO and speed matter. The default when nothing else fits. | `taste-skill`, `garden`, `owl`, `playwright`, `vercel-react`, `vercel-skills`, `vercel` |
| `web-app` | Something people sign in to: forms, state and a backend behind it. | `taste-skill`, `owl`, `jakub`, `playwright`, `vercel-react`, `vercel-skills`, `vercel` |
| `dashboard` | Charts, tables, filters and dense screens read by analysts. | `owl`, `jakub`, `garden`, `playwright`, `vercel-react`, `vercel-skills` |
| `mobile-app` | React Native, Expo or a hybrid shell around a web view. | `taste-skill`, `owl`, `emil`, `playwright` |
| `desktop-app` | Electron or another packaged desktop shell. | `owl`, `jakub`, `playwright` |
| `service` | No UI of its own, so none of the design or browser engines apply. | none |
| `custom` | One question per optional engine, which is what the install used to do. | whatever you answer yes to |

A profile only ever turns on an engine whose owner plugin is installed for this repo.
The `on` list the install prints is the profile's list filtered that way, so a `landing-page` repo without `pro-nextjs` never sees `vercel`.
Every optional engine the profile does not name is answered no, which is what keeps the install quiet.
The default rows (`lavish`, `impeccable`, `qa-skills` and the rest) are not part of a profile; they install whenever their owner plugin is there.

## The three questions a profile never answers

These are asked one at a time whatever the profile, because each one is a decision about more than taste.

- `spec-kit` writes files into the repo and sets up GitHub spec-kit's own flow, so it changes the project rather than the machine.
- `codex` runs the Codex CLI as a second reviewer on high-tier pull requests.
  The yes is also the consent to send the diff to OpenAI when a review runs.
- `vercel-deploy` can put a site live, so the consent belongs to the person, not to a project type.

## Where the answer lives and how to change it

The install writes the profile and one yes or no per optional engine into `.claude/pro-dev.json`.
That file is meant to be committed, so a team shares the same engine set and nobody is asked again.

Change the profile with the registry script in the installed pro-core:

```bash
python3 "<pro-core install path>/scripts/pro-dev.py" profile web-app --force
```

`--force` is what lets it replace a profile that is already saved; without it the script refuses, so a stray call cannot rewrite a team's choice.
Changing the profile rewrites the answers it decides, then `/pro-core:pro-dev install` installs what is newly on.
An engine already installed is left alone when a new profile answers it no; nothing is uninstalled.

Turn one engine on or off by hand with the same script:

```bash
python3 "<pro-core install path>/scripts/pro-dev.py" answer tastemaker yes
python3 "<pro-core install path>/scripts/pro-dev.py" answer mengto no
```

Then run `/pro-core:pro-dev install` again to install what the new answer turned on.

## Why figma is on no profile

`figma` needs a Figma account and a connector the person has to authorize, so no project type can decide it.
It stays off until someone asks for it:

```bash
python3 "<pro-core install path>/scripts/pro-dev.py" answer figma yes
```
