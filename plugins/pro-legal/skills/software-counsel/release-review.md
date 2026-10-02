# Release review procedure

Use this when something is about to ship.
The input is a diff, branch, commit range, tag, release, package publish, production deploy or PR.
A hook may dispatch you with a reproduce command such as `git -C <root> diff v1.2.0..HEAD` and the kind of release: `tag`, `release`, `publish`, `deploy`, `pr` or `commit-deps`.
The goal is to catch legal problems before they reach users or a public registry, where they are hard to take back.

Read [legal-landscape.md](./legal-landscape.md) and check its `Last verified` date before you start.

## 1. Get the release

- Run the reproduce command you were given. If you were given none, use the forms below.
- Staged changes: `git diff --cached`.
- Branch: `git diff $(git merge-base HEAD <base>)...HEAD`, where `<base>` is the default branch.
- Range or tag: `git diff <previous-tag>..HEAD` or the range as given.
- Package publish: the files the package will contain. `npm pack --dry-run`, `python -m build` output or `cargo package --list` show it without publishing.
- Deploy: the commit being deployed against the one currently live.

Read each changed file in full and not only the hunks.
Note the release kind.
It sets what matters most: a `publish` puts your license and attribution in front of the world, a `deploy` puts data handling and consent in front of users and a `commit-deps` is mostly a license question about what just entered the tree.

## 2. Ask the exposure question first

Before the checklists, decide what changed about how the project meets the law.

- Does it ship to more people, a new country or a new kind of user?
- Does it collect, infer, share or store new data?
- Does it add a dependency, a forked file, a dataset or a model?
- Does it add an AI feature, a payment flow, a subscription, a marketing channel or a scraper?
- Does it change the license, the name or the terms?

A release that adds exposure needs the matching document or control in the same release.
If a new analytics call lands and the privacy policy is untouched, that is a finding even when every line of code is clean.

## 3. Run the hygiene checks

Run only the checks the release touches.
Quote the line that motivates each finding.

### License and attribution

- A LICENSE file exists at the root of the repo and at the root of each published package.
- The manifest `license` fields match it: `package.json`, `pyproject.toml`, `Cargo.toml`, `*.gemspec`, `plugin.json` and similar. A mismatch or a missing field on a published package is a finding.
- Find declared licenses in the tree:
  - `grep -rn "SPDX-License-Identifier" . --exclude-dir=node_modules --exclude-dir=.git | head -50`
  - `git ls-files | grep -iE "(LICENSE|COPYING|NOTICE)"`
- Third-party code and forked files keep their copyright notice, license text and attribution. Check NOTICE files and per-file footers and check that a fork of a permissive upstream still carries the upstream notice.
- Code pasted from elsewhere with no license is a finding. Look for large new blocks with a different style or header comments naming another project.
- The license you publish under is compatible with every dependency you ship (see the next check).

### Dependency licenses

Find what is new:

- `git diff <range> -- package.json package-lock.json pnpm-lock.yaml yarn.lock requirements.txt pyproject.toml poetry.lock Cargo.toml Cargo.lock go.mod Gemfile.lock composer.json`

Read each new dependency's license from the installed copy:

- Node: `node -e "console.log(require('./node_modules/<pkg>/package.json').license)"` or `grep '"license"' node_modules/<pkg>/package.json`. If `license-checker` or `pnpm licenses list` is available, use it for the whole tree: `npx license-checker --summary` or `pnpm licenses list`.
- Python: `pip show <pkg>` (the `License` and `Classifiers` lines) or `pip-licenses` if installed.
- Rust: `cargo license` or `cargo deny check licenses` if installed. Otherwise read `Cargo.toml`.
- Go: `go-licenses report ./...` if installed. Otherwise read the LICENSE in the module cache.
- Anything else: read the LICENSE file in the vendored or cached copy.

Decide how the project ships, because it changes the answer:

- Distributed software (binary, npm or PyPI package, app, container image given to customers): GPL and LGPL obligations trigger on distribution.
- SaaS only: GPL generally does not trigger on hosting and AGPL does. The AGPL network clause requires offering source to remote users of a modified version.
- Library others will import: your license choice constrains your users and a copyleft dependency can force it.
- Internal tool: most obligations do not trigger but the license still matters if the tool later ships.

Flag these:

- Copyleft (GPL, LGPL, AGPL, MPL, EPL) combined with proprietary code in a way the ship model triggers.
- Non-commercial (CC BY-NC, PolyForm Noncommercial) or source-available (BSL, SSPL, Elastic, Commons Clause) licenses in a commercial product.
- No license at all, which means all rights reserved.
- Licenses that disagree with the manifest's `license` field.
- Dual-licensed packages where you have not chosen a side.
- Dependency licenses that changed in the new version. Compare the old and new `license` fields.

Do not guess a package's license from its name.
Read it or label the finding `unverified`.

### Privacy, consent and policies

- A privacy policy exists and is linked where users sign up and from the app. Search the repo: `git ls-files | grep -iE "(privacy|terms|tos|cookie)"`, then grep the UI for the links.
- The policy covers each new collection, tracking tool, analytics vendor, processor and sharing the diff introduces. Grep the diff for new SDKs and calls: analytics, session replay, pixels, error trackers, ad networks, `fetch` to third-party hosts, new fields written to a database.
- Terms of service exist where users accept them and how assent is captured is visible in the code.
- Consent for cookies and similar storage where required: non-essential scripts load only after consent. Look for tags that load before the banner resolves.
- New personal data has a retention rule and a delete path. Check for deletion handling next to the new write.
- New data leaving the country or going to a new vendor is reflected in the policy and the vendor paperwork.
- Sensitive data (health, biometric, precise location, financial, children's) has its extra controls and consent path.
- Logs and error reports do not carry personal data the policy never mentioned.
- A session replay or chat widget SDK added (rrweb, FullStory, LogRocket, Intercom, Crisp and similar): CIPA and wiretap exposure in California and consent rules elsewhere. The script loads only after consent where required and the vendor contract limits use of what it records.
- An iOS or Android release: the privacy manifest (`PrivacyInfo.xcprivacy`) and the store privacy labels (Apple nutrition label, Google Play Data safety form) match the SDKs and permissions in the diff. Tracking permissions (`NSUserTrackingUsageDescription`, advertising ID) have a matching prompt and label. Account deletion is available in the app if it has sign-up.
- User uploads or posts added: a DMCA designated agent is registered, a takedown path exists and the terms cover uploaded content.

### AI features

- Interaction with an AI is disclosed where required.
- AI-generated content that could be taken for real (deepfakes, voice clones) is labeled or consented as the rules require.
- The model provider's terms are respected: allowed use, no training on prohibited inputs, no competing-model use, required attribution, age limits and no use of outputs the terms forbid.
- User data sent to a model is covered by the policy and by any customer contract.
- Automated decisions about people have notice and a human path.
- AI-assisted code in a published package is checked like any other incoming code for license problems.

### Scraping and third-party API terms

- Any new scraper or crawler: which sites, whether robots.txt and the site terms allow it, whether it goes behind a login and what rate it runs at. Grep the diff for HTTP clients and user-agent strings.
- Stored or republished third-party content and personal or contact data collected from it.
- New API integrations: the provider's terms on caching, display, attribution, resale and rate limits. Check that keys are not shared in a way the terms forbid.

### Consumer protection and marketing

- Subscription and trial flows: clear price and renewal disclosure before purchase, affirmative consent, a receipt and an easy cancel path. Compare the cancel path to the signup path in the code.
- Dark patterns in the changed UI: pre-checked boxes, hidden fees, confirmshaming.
- Reviews and testimonials: fake, incentivized or undisclosed endorsements.
- Email and SMS: consent capture, unsubscribe handling, sender identity and consent records. Grep for new send paths and templates.

### Accessibility

- Public-facing UI changes meet the project's stated standard. Look for missing alt text, unlabeled form controls, color-only state, keyboard traps and missing focus handling in the changed components.
- If the product is in scope of accessibility law for its market, a gap is Required. Otherwise Advisory.

### Export control

- Encryption added to a binary or package that will be distributed: look for new crypto libraries or custom crypto in the diff. Note what classification or notification step the project owes, after verifying the current rule.
- Sanctions: payment or access paths that could serve embargoed regions.

### Trademarks and naming

- New product, package, plugin or domain names against known marks in the same field.
- Third-party names or logos used in a way that implies endorsement.

### Client work

- A deliverable release: the license notices handed over match the open source included and no client data or secrets are in the artifacts.
- Client data appears in fixtures, logs, screenshots or test data in the repo.
- Content under the client's confidentiality terms is not going to a public registry or a public repo.

## 4. Verify what is time-sensitive

For each finding that turns on a law's status, a date, a threshold, a penalty or a vendor's current terms, search and read the primary source.
Record the URL and the date read.
Label what you could not verify as `unverified`.
If the baseline is more than 90 days old, say so at the top of the report.

## 5. Write each finding

For every finding:

- Severity: `Blocking`, `Required` or `Advisory`, using the rubric in [SKILL.md](./SKILL.md).
- Confidence: `verified`, `likely` or `unverified`.
- Area: the check it came from.
- Location: `file:line`.
- Evidence: the quoted line or lines.
- Why it matters: the law or contract, the jurisdiction and the consequence, in one or two sentences.
- Fix: the smallest change that closes it.

```
### [Blocking] AGPL dependency in a closed SaaS - likely
Area: dependency licenses
Location: package.json:42, node_modules/some-lib/package.json:5
Evidence: `"some-lib": "^3.1.0"` and `"license": "AGPL-3.0-only"`
Why it matters: The service lets remote users interact with a modified copy over a network. The AGPL network clause requires offering them the corresponding source (a license term so it applies wherever you operate). Source: <URL>, read 2026-10-02.
Fix: Replace the library with a permissively licensed one, buy a commercial license or publish the service source under AGPL.
```

A finding you cannot quote from the code or the repo files is unverified and does not go above Required.
Check whether the control already exists before claiming it is missing.

## 6. Verdict

End with one of:

- `Ship`: nothing at Required or above.
- `Ship with changes`: Required items only. List them in priority order and each must be doable before or shortly after release.
- `Hold`: at least one Blocking item. Do not tag, publish or deploy until it is resolved.

For a `publish` or `tag`, be stricter than for a `pr`: a published package cannot be recalled and a tag is a public claim about what the code is.
For a `pr`, fix Blocking findings before merge and track Required findings.

Keep the report short and put findings in priority order.
Where a lawyer's answer is genuinely needed, add a short `Questions for counsel` list with the facts a lawyer would need.
Close with one line saying this is issue spotting and not legal advice.
Do not add a disclaimer anywhere else.
