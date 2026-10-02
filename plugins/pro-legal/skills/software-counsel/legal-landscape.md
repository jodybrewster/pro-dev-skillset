# Software legal landscape

Last verified: 2026-10-02

This file is a dated baseline of the laws, cases and contract terms that most often affect software plans and releases.
It is a starting point only and the counsel must re-verify anything time-sensitive by searching primary sources before relying on it.
Dates and status here can be overtaken by events and this is issue spotting for engineers and product owners, not legal advice.

## Conventions

- Every entry carries a status line dated 2026-10-02.
- Dates and status marked "verified" were checked against at least one source during the 2026-10-02 refresh.
- "Statutory text, not re-fetched" means the date comes from the enacted text or settled background knowledge and was not re-checked in that refresh.
- "Unverified as of 2026-10-02" means the claim could not be confirmed and must be checked before use.
- Where sources disagreed the entry says so.
- Fine amounts are statutory maximums and rarely the practical exposure.

## AI regulation

### EU AI Act: prohibited practices and AI literacy

- Jurisdiction: EU (applies to providers and deployers outside the EU whose output is used in the EU)
- Covers: Regulation (EU) 2024/1689 bans specific AI uses (social scoring, untargeted facial image scraping, emotion inference at work and school, manipulative techniques, certain biometric categorisation and predictive policing)
- Triggers: building features that infer emotions from employees or students, scrape faces for recognition databases or exploit vulnerable users; any EU-facing AI feature
- Key dates: in force 1 Aug 2024; prohibitions and AI literacy duty applied from 2 Feb 2025 (statutory text, not re-fetched)
- Key dates: new prohibition on AI systems built to generate non-consensual intimate imagery and child sexual abuse material applies from 2 Dec 2026 (verified, added by the Digital Omnibus on AI)
- Status as of 2026-10-02: in force and enforceable by national authorities
- Status as of 2026-10-02: the AI literacy duty was softened by the omnibus from an organisational guarantee to a duty to support staff AI literacy (verified, secondary source)
- Status as of 2026-10-02: prohibited-practice fines reach EUR 35 million or 7% of worldwide turnover (statutory text, not re-fetched)
- Primary source: https://eur-lex.europa.eu/eli/reg/2024/1689/oj

### EU AI Act: general-purpose AI model obligations

- Jurisdiction: EU
- Covers: providers of general-purpose AI (GPAI) models must keep technical documentation, publish a training data summary and keep a copyright policy that respects text-and-data-mining opt-outs; models with systemic risk carry extra duties
- Triggers: training or fine-tuning a model and placing it on the EU market; substantially modifying someone else's model; downstream apps that only call a model API are usually deployers, not GPAI providers (guidance-dependent, unsettled at the edges)
- Key dates: obligations applied from 2 Aug 2025
- Key dates: AI Office enforcement powers (information requests, evaluations, fines) apply from 2 Aug 2026 (verified)
- Key dates: models placed on the market before 2 Aug 2025 have until 2 Aug 2027 (verified, secondary source)
- Status as of 2026-10-02: not delayed by the omnibus; the GPAI Code of Practice was published 10 July 2025 and gives a presumption of conformity for signatories (verified, secondary source)
- Status as of 2026-10-02: fines up to EUR 15 million or 3% of worldwide turnover (verified, secondary source)
- Primary source: https://eur-lex.europa.eu/eli/reg/2024/1689/oj

### EU AI Act: transparency obligations (Article 50)

- Jurisdiction: EU
- Covers: tell users they are talking to an AI; machine-readable marking of synthetic audio, image, video and text; disclosure of deepfakes and AI-written public-interest text; notice for emotion recognition and biometric categorisation
- Triggers: shipping an AI chatbot or voice agent to EU users; generating images, video or audio; publishing AI-generated news-style text
- Key dates: applies from 2 Aug 2026 (verified)
- Key dates: the Article 50(2) machine-readable marking duty has a grace period to 2 Dec 2026 for generative systems placed on the market before 2 Aug 2026 (verified)
- Status as of 2026-10-02: in force; chatbot disclosure under Article 50(1) applies to all systems from 2 Aug 2026
- Status as of 2026-10-02: a Code of Practice on marking and labelling exists with a signatory date of 22 July 2026 (secondary source; contents not reviewed)
- Status as of 2026-10-02: penalties up to EUR 15 million or 3% of worldwide turnover (verified, secondary source)
- Primary source: https://eur-lex.europa.eu/eli/reg/2026/1744/oj

### EU AI Act: high-risk systems and the Digital Omnibus on AI

- Jurisdiction: EU
- Covers: Annex III use cases (hiring, credit scoring, education, essential services, law enforcement, migration) and AI embedded in regulated products need risk management, data governance, logging, human oversight and conformity assessment
- Triggers: ranking candidates, scoring creditworthiness, grading students or shipping AI inside a medical device, machine or toy
- Key dates: Regulation (EU) 2026/1744 of 8 July 2026, published in the Official Journal on 24 July 2026 and in force 27 July 2026 (verified)
- Key dates: Annex III stand-alone high-risk obligations moved from 2 Aug 2026 to 2 Dec 2027 (verified)
- Key dates: Annex I product-embedded high-risk obligations moved to 2 Aug 2028 (verified)
- Status as of 2026-10-02: the delay is law and no longer a proposal
- Status as of 2026-10-02: SME relief was extended to small mid-caps; the omnibus changed 36 articles and added six new ones (secondary source)
- Status as of 2026-10-02: harmonised standards are still late. Expect further guidance rather than further statutory delay (unverified as of 2026-10-02)
- Primary source: https://eur-lex.europa.eu/eli/reg/2026/1744/oj

### Colorado AI Act (SB 24-205) and its replacement SB 26-189

- Jurisdiction: Colorado
- Covers: duties for developers and deployers of AI used in consequential decisions (employment, lending, housing, health, education, insurance, legal services)
- Triggers: any automated decision or decision support that materially affects a Colorado resident's job, credit, housing or care
- Key dates: SB 24-205 was due 30 June 2026 and never took effect as written
- Key dates: SB 26-189 signed 14 May 2026 repeals and reenacts it with an effective date of 1 Jan 2027 (verified)
- Status as of 2026-10-02: the replacement is notice-based; it drops impact assessments and AG disclosures and keeps technical documentation from developers, notice at the point of interaction, post-adverse-decision explanation, data correction and human review (verified, secondary source)
- Status as of 2026-10-02: 60-day notice-and-cure period; the AG must finish rulemaking by 1 Jan 2027
- Status as of 2026-10-02: xAI sued and DOJ intervened on 24 Apr 2026; a stipulated order of 27 Apr 2026 holds off enforcement and further motions until after rulemaking; xAI and DOJ are expected to challenge SB 26-189 too (verified, secondary source)
- Primary source: https://leg.colorado.gov/bills/sb26-189

### California AI laws (AB 2013, SB 942, SB 53, SB 243)

- Jurisdiction: California
- Covers: AB 2013 requires public training data documentation for generative AI systems; SB 942 (AI Transparency Act) requires a free detection tool and latent disclosures from large generative AI providers; SB 53 (Transparency in Frontier AI Act) requires safety frameworks and incident reporting from frontier developers; SB 243 regulates companion chatbots
- Triggers: releasing or materially updating a generative model for Californians; operating a frontier model developer with over USD 500 million revenue; shipping a chatbot designed to meet users' social needs
- Key dates: AB 2013, SB 53 and SB 243 took effect 1 Jan 2026 (verified)
- Key dates: SB 942 was moved by AB 853 (signed 13 Oct 2025) from 1 Jan 2026 to 2 Aug 2026 (verified)
- Key dates: SB 243 annual reporting to the Office of Suicide Prevention starts 1 Jul 2027 (verified, secondary source)
- Status as of 2026-10-02: all four are operative
- Status as of 2026-10-02: xAI challenged AB 2013 and lost its preliminary injunction motion; the appeal is pending in the Ninth Circuit (verified, secondary source)
- Status as of 2026-10-02: SB 243 carries a private right of action and disclosure, self-harm protocol and minor-protection duties (secondary source; details unverified)
- Primary source: https://leginfo.legislature.ca.gov

### Texas Responsible AI Governance Act (TRAIGA, HB 149)

- Jurisdiction: Texas
- Covers: bans AI developed or deployed with intent to manipulate toward self-harm, discriminate unlawfully, infringe constitutional rights or produce child sexual abuse material; disclosure duties apply mainly to government agencies and healthcare
- Triggers: any AI product offered to Texas residents; intent evidence (internal docs and marketing) matters
- Key dates: effective 1 Jan 2026 (verified)
- Status as of 2026-10-02: in force; AG-only enforcement with a 60-day cure period; safe harbor for substantial compliance with NIST AI RMF or a similar framework; regulatory sandbox through the Department of Information Resources (verified, secondary source)
- Primary source: https://capitol.texas.gov/BillLookup/History.aspx?LegSess=89R&Bill=HB149

### Other US state AI laws and federal preemption

- Jurisdiction: New York, Illinois, Maine, Utah and federal
- Covers: New York RAISE Act (frontier developer safety and incident reporting); New York Algorithmic Pricing Disclosure Act (personalised-price notice); Illinois HB 3773 (AI in employment decisions); Maine chatbot disclosure; Utah AI mental-health chatbot rules
- Triggers: dynamic pricing from personal data; AI hiring tools; chatbots that could pass as human; mental-health chatbots
- Key dates: NY algorithmic pricing notice in effect 10 Nov 2025; Illinois HB 3773 effective 1 Jan 2026; Maine chatbot disclosure effective 24 Sep 2025; Utah HB 452 effective 7 May 2025; NY RAISE Act signed 19 Dec 2025 and effective 1 Jan 2027 (all verified, secondary sources)
- Status as of 2026-10-02: an 11 Dec 2025 executive order directs DOJ to challenge state AI laws and an AI Litigation Task Force began work in January 2026 (verified, secondary source)
- Status as of 2026-10-02: no federal preemption statute has passed; the NDAA omitted a moratorium and a preemption bill has stalled (secondary source)
- Status as of 2026-10-02: state laws stay enforceable unless a court blocks them. Do not plan around preemption
- Primary source: https://www.skadden.com/insights/publications/2026/01/new-york-enacts-ai-transparency-law

### California AB 1008, AB 3030 and the California bot disclosure law (SB 1001)

- Jurisdiction: California
- Covers: AB 1008 says personal information under the CCPA includes AI systems capable of outputting personal information; AB 3030 requires clinics, health facilities and physician offices to disclose generative AI patient communications about clinical information unless a licensed provider reviewed them; SB 1001 (Bus. & Prof. Code 17940-17943) bars using a bot to deceive someone about its artificial identity to incentivise a sale or influence a vote
- Triggers: a model or embedding store trained on or able to emit user data when a deletion request arrives; a patient messaging tool that drafts replies with a model; a sales or support chatbot that presents as a human
- Key dates: AB 1008 (Chapter 802) and AB 3030 (Chapter 848) approved 28 Sep 2024 (verified, leginfo); effective 1 Jan 2025 (secondary source)
- Key dates: SB 1001 effective 1 Jul 2019 (secondary source)
- Status as of 2026-10-02: all three operative; a clear and conspicuous bot disclosure is a safe harbor under section 17941 (verified, leginfo); the carve-out for service providers of platforms over 10 million monthly US visitors is from a secondary source
- Status as of 2026-10-02: AB 1008 also added neural data to sensitive personal information (verified, leginfo summary)
- Status as of 2026-10-02: AB 3030 requires a disclaimer plus instructions for reaching a human and exempts messages a licensed provider reviewed (verified, leginfo); the scheduling and billing exemption is from a secondary source
- Status as of 2026-10-02: SB 243 and SB 942 are covered in the entry above; other 2026 California AI bills were not surveyed (unverified as of 2026-10-02)
- Primary source: https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB1008
- Primary source: https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB3030
- Primary source: https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=17941
- Secondary source: https://epic.org/california-legislative-session-roundup-which-key-privacy-and-ai-bills-were-enacted-and-which-were-vetoed/
- Secondary source: https://perkinscoie.com/insights/update/i-am-robot-californias-new-law-requires-disclosure-use-bots

## Product security and liability

### EU Cyber Resilience Act (CRA)

- Jurisdiction: EU (manufacturers, importers and distributors of products with digital elements, wherever based)
- Covers: Regulation (EU) 2024/2847 sets security-by-design, vulnerability handling, SBOM, support period and CE marking duties for hardware and software placed on the EU market in the course of commercial activity
- Triggers: selling or distributing installable software, firmware or connected devices to EU users; monetising an open-source project; bundling open-source components in a commercial product
- Key dates: in force 10 Dec 2024 (statutory text, not re-fetched)
- Key dates: notified-body framework (Chapter IV) applied 11 Jun 2026 (verified)
- Key dates: vulnerability and incident reporting applies from 11 Sep 2026 (verified)
- Key dates: full application 11 Dec 2027 (verified)
- Status as of 2026-10-02: reporting is live; report actively exploited vulnerabilities and severe incidents through ENISA's Single Reporting Platform with an early warning in 24 hours, notification in 72 hours and a final report after 14 days (vulnerabilities) or one month (incidents) (verified)
- Status as of 2026-10-02: reporting covers products already on the market; no retroactive reporting for exploitation known before 11 Sep 2026; fines up to EUR 15 million or 2.5% of turnover (verified)
- Status as of 2026-10-02: pure SaaS is mostly outside the CRA unless it is a remote data processing solution of a product; non-commercial open source is outside it
- Status as of 2026-10-02: open-source stewards (foundations that systematically support commercial-use FOSS) carry lighter duties: a security policy, cooperation with authorities and vulnerability reporting
- Status as of 2026-10-02: the Commission published guidance on 27 Jul 2026, described as draft by one source and final by another, on "placing on the market" and the steward role (unsettled)
- Primary source: https://eur-lex.europa.eu/eli/reg/2024/2847/oj

### Revised EU Product Liability Directive (2024/2853)

- Jurisdiction: EU member states (strict liability for defective products)
- Covers: software, firmware, apps and AI systems are now "products"; damage includes data loss or corruption for non-professional users; courts can order disclosure and presume defect in complex cases; lack of security updates can be a defect
- Triggers: shipping software that can cause personal injury, property damage or data destruction to EU consumers; ending updates on a connected product
- Key dates: transposition deadline 9 Dec 2026; applies to products placed on the market after 8 Dec 2026 (verified; a corrigendum fixed the original 9 Dec date)
- Status as of 2026-10-02: only Hungary, Croatia and Lithuania had completed transposition; Germany, the Netherlands and Slovakia lead a group of about twelve with advanced drafts (verified, secondary source)
- Status as of 2026-10-02: free and open-source software developed or supplied outside commercial activity is exempt (Directive text, not re-fetched)
- Primary source: https://eur-lex.europa.eu/eli/dir/2024/2853/oj

### EU Data Act

- Jurisdiction: EU
- Covers: user access to data from connected products and related services; data sharing with third parties; cloud and data-processing switching rights; unfair-term controls on B2B data contracts; limits on international government access
- Triggers: shipping IoT or connected devices with companion apps; offering cloud, SaaS or PaaS to EU customers; holding user-generated product data
- Key dates: applies since 12 Sep 2025 (verified)
- Key dates: Article 3(1) design obligation (data accessible by default) applies to products placed on the market after 12 Sep 2026 (verified)
- Key dates: unfair-terms chapter reaches older long-running contracts from 12 Sep 2027 (verified)
- Status as of 2026-10-02: in force; the Digital Omnibus proposes to fold in and trim parts of it but is not law
- Status as of 2026-10-02: cloud switching charges fully abolished from 12 Jan 2027 (statutory text, not re-fetched; unverified as of 2026-10-02)
- Primary source: https://eur-lex.europa.eu/eli/reg/2023/2854/oj

### NIS2 Directive

- Jurisdiction: EU member states (Directive (EU) 2022/2555 as transposed nationally; in force differs by country)
- Covers: essential and important entities in listed sectors must apply risk management measures including supply chain security and report incidents; in scope are cloud computing, data centre, DNS, managed service and managed security service providers, plus online marketplaces, search engines and social networks above medium size; vendors of those entities face contractual flow-down
- Triggers: selling SaaS, hosting or managed services to EU companies in energy, health, transport, finance or digital infrastructure; being a medium or large cloud or managed service provider yourself; receiving a customer security questionnaire citing NIS2
- Key dates: transposition deadline 17 Oct 2024; incident reporting is an early warning within 24 hours, an incident notification within 72 hours and a final report within one month (statutory text, not re-fetched)
- Status as of 2026-10-02: 23 member states had transposed by May 2026 with Luxembourg the latest on 10 May 2026 and four still outstanding (verified, secondary source; the four were not named)
- Status as of 2026-10-02: Germany's law took effect 6 Dec 2025 with no transition period and BSI registration due 6 Mar 2026; scope grew to about 29,500 entities (secondary source)
- Status as of 2026-10-02: the Commission opened infringement proceedings and sent reasoned opinions in May 2025 (secondary source); check the national law of each customer country because scope and fines vary
- Primary source: https://eur-lex.europa.eu/eli/dir/2022/2555/oj (not fetched: EUR-Lex returned empty content)
- Secondary source: https://www.cullen-international.com/news/2026/05/How-are-EU-member-states-transposing-NIS2-.html (23 transposed; fetched)
- Secondary source: https://www.reedsmith.com/articles/germany-implements-nis2-immediate-effect-broad-scope-near-term-registration/ (Germany; not fetched, from search)

### UK Product Security and Telecommunications Infrastructure Act (PSTI)

- Jurisdiction: United Kingdom (manufacturers, importers and distributors of consumer connectable products; enforced by OPSS)
- Covers: no universal or easily guessable default passwords; a public vulnerability reporting contact; a stated minimum security update period
- Triggers: shipping a smart device, wearable or router with a companion app to UK consumers; reselling imported IoT hardware
- Key dates: security requirements in force 29 Apr 2024 (verified, secondary source)
- Status as of 2026-10-02: fines up to GBP 10 million or 4% of worldwide revenue with daily penalties (secondary source); standalone apps are not products under the regime but the device they control is; 2026 enforcement actions unverified as of 2026-10-02
- Primary source: https://www.gov.uk/guidance/regulations-consumer-connectable-product-security (fetched; confirms 29 Apr 2024)
- Secondary source: https://burges-salmon.com/news-and-insight/legal-updates/technology-and-communications/product-security-and-telecommunications-infrastructure-act-2022-an-overview (penalties; not fetched, from search)

### UK Computer Misuse Act reform

- Jurisdiction: United Kingdom (Computer Misuse Act 1990)
- Covers: unauthorised access is an offence with no general research defence; the government committed in Dec 2025 to a statutory defence for good-faith vulnerability research
- Triggers: shipping a scanner, pentest tool or bug-bounty workflow; research on third-party UK systems without written permission
- Key dates: Security Minister Dan Jarvis announced the commitment on 3 Dec 2025 (secondary source)
- Status as of 2026-10-02: no enacted change found; critics call the proposal narrow and limited to known-vulnerability scanning (secondary source); bill and commencement status unverified as of 2026-10-02
- Primary source: https://www.legislation.gov.uk/ukpga/1990/18/contents (fetched; shows no reform enacted as of 1 Oct 2026)
- Secondary source: https://therecord.media/uk-plans-for-cybercrime-law-reform-limited-protections (reform plans; not fetched, from search)

## Privacy and data protection (EU and UK)

### GDPR and ePrivacy (cookies and similar tech)

- Jurisdiction: EU and EEA (extraterritorial for anyone offering services to or monitoring people in the EU)
- Covers: lawful basis, transparency, data subject rights, DPIAs, processor contracts, 72-hour breach notice, transfer rules; ePrivacy Article 5(3) requires consent before storing or reading information on a device unless strictly necessary
- Triggers: any analytics, ad pixel, SDK or session replay in a web or mobile app; sending EU data to a US vendor; training or fine-tuning on personal data; profiling
- Key dates: GDPR applied 25 May 2018; no GDPR commencement is pending (statutory text, not re-fetched)
- Status as of 2026-10-02: unchanged in force; the Digital Omnibus (data) was proposed 19 Nov 2025 and would narrow the personal data definition, state a legitimate interest for AI training, add a 96-hour breach deadline and move cookie rules into the GDPR with browser signals (verified as proposals)
- Status as of 2026-10-02: the omnibus (procedure 2025/0360(COD)) is still in Parliament and Council, with EDPB and EDPS Joint Opinion 2/2026 of February 2026 raising concerns; do not rely on any of it (verified)
- Status as of 2026-10-02: EU-US Data Privacy Framework stands; the General Court upheld it on 3 Sep 2025 and the appeal (Case C-703/25 P) is pending (verified)
- Primary source: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- Primary source: https://eur-lex.europa.eu/eli/dir/2002/58/oj

### EU Digital Services Act (DSA) for small apps

- Jurisdiction: EU
- Covers: Regulation (EU) 2022/2065 sets tiered duties for intermediary services: hosting providers need notice-and-action; online platforms add complaint handling, trader traceability and ad transparency
- Triggers: letting users post content others can see (comments, listings, uploads); marketplaces; any non-EU provider serving EU users
- Key dates: fully applicable since 17 Feb 2024 (statutory text, not re-fetched)
- Status as of 2026-10-02: micro and small enterprises (under 50 staff and EUR 10 million) are exempt from most platform duties but still need clear terms and a point of contact (verified, secondary source)
- Status as of 2026-10-02: non-EU providers must appoint a legal representative in the EU (verified, secondary source)
- Status as of 2026-10-02: Commission guidelines on protecting minors under Article 28 (14 Jul 2025) are non-binding and exclude micro and small platforms (verified, secondary source)
- Primary source: https://eur-lex.europa.eu/eli/reg/2022/2065/oj

### UK GDPR and the Data (Use and Access) Act 2025

- Jurisdiction: United Kingdom
- Covers: UK GDPR and PECR as amended; recognised legitimate interests, relaxed automated decision-making rules, a new transfer test, cookie exceptions for low-risk analytics, GDPR-level PECR fines
- Triggers: UK users; cookies and marketing emails or texts; automated decisions about people; sending UK data abroad
- Key dates: Royal Assent 19 Jun 2025; most provisions in force 5 Feb 2026; the controller complaints procedure from 19 Jun 2026 (verified)
- Status as of 2026-10-02: in force; PECR fines now up to GBP 17.5 million or 4% of worldwide turnover (verified)
- Status as of 2026-10-02: advertising and social media cookies still need consent; only low-risk uses (some analytics, security, functionality) are excepted (verified, secondary source)
- Status as of 2026-10-02: controllers need a specific channel for complaints and a 30-day acknowledgement (verified, secondary source)
- Primary source: https://www.legislation.gov.uk/ukpga/2025/18/contents

### UK Online Safety Act

- Jurisdiction: United Kingdom (services with UK users, regulated by Ofcom, wherever based)
- Covers: user-to-user and search services must assess and mitigate illegal content and child-safety risks; services with pornographic content or children at risk need highly effective age assurance
- Triggers: user-generated content, chat, dating, forums, AI chat that shares user content; any adult content; reaching UK children
- Key dates: illegal-content duties from March 2025 and child-safety duties from July 2025 (not re-fetched; unverified as of 2026-10-02)
- Status as of 2026-10-02: Ofcom is fining; 2026 penalties include GBP 1.35 million (8579 LLC, Feb 2026), GBP 800,000 (Kick Online Entertainment, Feb 2026), GBP 630,000 (fapello.com), GBP 600,000 (Youngtek) and GBP 450,000 (4chan) (verified, secondary source)
- Status as of 2026-10-02: Ofcom signals self-declaration age gates do not meet the standard (verified, secondary source)
- Status as of 2026-10-02: categorised-service register and extra duties status unverified as of 2026-10-02
- Primary source: https://www.ofcom.org.uk/online-safety

### European Accessibility Act (EAA)

- Jurisdiction: EU member states (national laws implementing Directive 2019/882)
- Covers: accessibility for consumer e-commerce, banking and payment services, e-books, e-communications, audiovisual media services, passenger transport ticketing and consumer devices and operating systems
- Triggers: selling online to EU consumers; a consumer banking or payments app; an e-reader; ticketing
- Key dates: applies from 28 Jun 2025 (verified)
- Status as of 2026-10-02: in force and enforcement is ramping up; the harmonised standard is EN 301 549 (WCAG 2.1 AA) (verified, secondary source)
- Status as of 2026-10-02: microenterprises (fewer than 10 staff and at most EUR 2 million turnover or balance sheet) are exempt for services only, not for products (verified, secondary source)
- Primary source: https://eur-lex.europa.eu/eli/dir/2019/882/oj

### UK Online Safety Act: categorised services (update)

- Jurisdiction: United Kingdom
- Covers: Category 1, 2A and 2B services carry extra transparency, user empowerment and terms-of-service duties on top of the base duties
- Triggers: a large UK social or sharing platform with a recommender system; a growing app near the user thresholds
- Key dates: Ofcom published the register on 10 Jul 2026 per two law-firm sources; Ofcom's own page, seen only in search results, says 30 Jun 2026 and last updated 28 Sep 2026 (sources disagree)
- Key dates: on 28 Sep 2026 Ofcom moved Quora from the Category 1 register to Category 2B (search result for the Ofcom page; not fetched)
- Status as of 2026-10-02: eleven Category 1 services; the threshold is 34 million UK monthly users with a recommender system or 7 million with a recommender and content sharing (verified, secondary source)
- Status as of 2026-10-02: providers owed records or confirmations to Ofcom by October 2026 and summaries by November 2026 (secondary source); consultation on draft Category 1 codes closes 2 Oct 2026 with final decisions expected mid-2027; the illegal-content and child-safety start dates in the main entry are still not re-fetched
- Primary source: https://www.ofcom.org.uk/online-safety/illegal-and-harmful-content/register-of-categorised-services-and-list-emerging-category-1-services (not fetched: 403)
- Secondary source: https://www.globalpolicywatch.com/2026/07/uk-online-safety-update-ofcoms-category-1-proposals-and-dsits-latest-response-to-growing-up-in-an-online-world/ (fetched)

### UK PECR analytics cookie exemption (update)

- Jurisdiction: United Kingdom
- Covers: Data (Use and Access) Act 2025 added PECR exceptions for statistical analytics and appearance preferences
- Triggers: running first-party analytics with no cookie banner; sharing analytics data with an ad vendor; using GA-style tools
- Key dates: in force 5 Feb 2026 through Commencement No. 6 Regulations (verified, secondary source)
- Status as of 2026-10-02: the exemption needs clear information and a simple opt-out and does not cover tools that share data with third parties or track across sites (secondary source; ICO guidance wording not re-fetched)
- Primary source: https://www.legislation.gov.uk/ukpga/2025/18/contents (fetched; Act text only, commencement regulations not located)
- Secondary source: https://www.cliffordchance.com/insights/resources/blogs/talking-tech/en/articles/2025/09/uk-ico-s-updated-guidance-for-new-exceptions-to-cookie-consents-.html (ICO guidance; not fetched, from search)

### eIDAS 2 and the EU Digital Identity Wallet

- Jurisdiction: EU (Regulation (EU) 2024/1183 amending eIDAS)
- Covers: member states must offer a wallet; relying parties that must use strong user authentication (banking and similar regulated sectors) and very large platforms must accept it later
- Triggers: building login or KYC for EU banking, telecom, energy or health customers; being a very large online platform
- Key dates: wallet availability due 24 Dec 2026 and most private acceptance duties around late 2027 (secondary source)
- Status as of 2026-10-02: exact acceptance dates and the relying-party registration steps are unverified as of 2026-10-02; offering wallet login is voluntary for most small apps
- Primary source: https://eur-lex.europa.eu/eli/reg/2024/1183/oj (not fetched: EUR-Lex returned empty content)
- Secondary source: https://fintech.global/2026/07/13/eidas-2-0-deadlines-loom-two-tracks-one-trust-chain/ (deadlines; not fetched, from search)

## Privacy and data protection (US)

### CCPA/CPRA and the 2026 CPPA regulations

- Jurisdiction: California
- Covers: consumer rights, opt-out of sale or sharing, sensitive data limits, service-provider contracts, dark pattern limits on consent; new regulations on automated decision-making technology (ADMT), risk assessments and cybersecurity audits
- Triggers: using ADMT for significant decisions (finance, housing, employment, education, health); selling or sharing data; processing sensitive data; training ADMT on personal data; being a data broker
- Key dates: regulations approved by OAL and announced 23 Sep 2025, effective 1 Jan 2026 (verified)
- Key dates: ADMT compliance by 1 Jan 2027 for existing uses or before first use if later (verified)
- Key dates: risk assessments required for covered activity from 1 Jan 2026 with existing activity assessed by 31 Dec 2027 and an attestation due 1 Apr 2028 (verified, secondary sources differ slightly on wording)
- Key dates: cybersecurity audit certifications due 1 Apr 2028 (revenue over USD 100 million), 1 Apr 2029 (USD 50 to 100 million) and 1 Apr 2030 (under USD 50 million) (verified)
- Status as of 2026-10-02: in force on the schedule above; new data broker registration requirements start 1 Aug 2026 (verified, secondary source)
- Status as of 2026-10-02: current revenue and consumer-count thresholds are adjusted for inflation and were not re-checked (unverified as of 2026-10-02)
- Primary source: https://cppa.ca.gov/regulations/

### Other US state comprehensive privacy laws

- Jurisdiction: US states
- Covers: access, deletion, correction, opt-out of targeted ads, sale and profiling; opt-in for sensitive data; data protection assessments; many honour universal opt-out signals
- Triggers: processing residents' data above state thresholds (some states now have no threshold for sensitive data or sales)
- Key dates: California (1 Jan 2020, CPRA 1 Jan 2023), Virginia (1 Jan 2023), Colorado (1 Jul 2023), Connecticut (1 Jul 2023), Utah (31 Dec 2023), Texas (1 Jul 2024), Oregon (1 Jul 2024), Montana (1 Oct 2024), Florida (1 Jul 2024, narrow), Delaware (1 Jan 2025), Iowa (1 Jan 2025), Nebraska (1 Jan 2025), New Hampshire (1 Jan 2025), New Jersey (15 Jan 2025), Tennessee (1 Jul 2025), Minnesota (31 Jul 2025), Maryland (1 Oct 2025) (statutory text, not re-fetched)
- Key dates: Indiana, Kentucky and Rhode Island took effect 1 Jan 2026 (verified)
- Key dates: Oklahoma (signed March 2026) effective 1 Jan 2027; Alabama (signed 17 Apr 2026) effective 1 May 2027 (verified, secondary source)
- Status as of 2026-10-02: 2026 amendments include Connecticut SB 1295 (1 Jul 2026: 35,000-consumer threshold plus no-threshold triggers for sensitive data or sales, profiling and minors rules, with a profiling impact-assessment trigger on 1 Aug 2026), Virginia (1 Jul 2026: no sale of precise geolocation), Oregon (1 Jan 2026: no sale of minors' data or of geolocation within 1,750 feet) and Kentucky HB 692 (1 Jul 2027: opt-in for automated content recognition data from smart TVs) (verified, secondary sources)
- Status as of 2026-10-02: tracker counts differ (20 or 21 laws) depending on whether Florida and the 2026 additions are counted; there is no federal comprehensive law
- Status as of 2026-10-02: Arkansas and Utah July 2026 changes concern minors and were not examined (unverified as of 2026-10-02)
- Primary source: https://www.multistate.us/insider/2026/2/4/all-of-the-comprehensive-privacy-laws-that-take-effect-in-2026

### Washington My Health My Data Act

- Jurisdiction: Washington (reaches anyone collecting data about Washington consumers)
- Covers: consumer health data broadly defined (including inferences, location near clinics and wellness app data) with opt-in consent to collect or share and separate consent to sell; private right of action under the Consumer Protection Act
- Triggers: fitness, fertility, mental-health or wellness apps; ad SDKs in such apps; geofencing near health facilities
- Key dates: effective 31 Mar 2024 for regulated entities and 30 Jun 2024 for small businesses (statutory text, not re-fetched)
- Status as of 2026-10-02: in force; the first class action, Maxwell v. Amazon.com (W.D. Wash., filed 10 Feb 2025), targets an SDK in third-party apps and had no ruling found in the refresh (verified, secondary source)
- Primary source: https://app.leg.wa.gov/RCW/default.aspx?cite=19.373

### Illinois BIPA and other biometric laws

- Jurisdiction: Illinois, with Texas CUBI and Washington RCW 19.375 as the other dedicated statutes
- Covers: BIPA requires a written policy, informed written consent and no sale of biometric identifiers; private right of action
- Triggers: face, voice or fingerprint login; liveness checks; voice cloning; emotion or demographic analysis from faces
- Key dates: BIPA 2008; damages amendment signed Aug 2024 (limits recovery to one per person per collection method)
- Status as of 2026-10-02: the Seventh Circuit held on 1 Apr 2026 that the 2024 amendment applies retroactively to pending cases (verified, secondary source)
- Status as of 2026-10-02: consent flows are still mandatory and exposure remains per person; the Texas and Washington statutes are enforced by their AGs (statutory text, not re-fetched)
- Primary source: https://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=3004

### CalOPPA (California Online Privacy Protection Act)

- Jurisdiction: California (reaches any operator collecting personally identifiable information from California residents)
- Covers: Bus. & Prof. Code 22575-22579 require a conspicuously posted privacy policy that names the categories of data collected and the third parties it is shared with, explains how users review and change their data, says how policy changes are announced and discloses how the service responds to Do Not Track signals
- Triggers: launching a website or mobile app that collects emails, names or other contact data from California users; adding a third-party tracker that changes what the policy must say; shipping an app with no in-app or store-listing privacy policy link
- Key dates: operative 1 Jul 2004 (verified against leginfo)
- Status as of 2026-10-02: in force; an operator has 30 days to cure after notice of non-compliance and a violation also covers failing to follow your own posted policy (verified, leginfo)
- Status as of 2026-10-02: the AG enforces it against mobile apps and has an app-store agreement requiring a policy to be reachable before download (secondary source; agreement date not checked)
- Status as of 2026-10-02: the AG's latest app privacy settlement found was Jam City, USD 1.4 million, announced 21 Nov 2025, under the CCPA for missing in-app opt-outs (secondary source)
- Primary source: https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=BPC&division=8.&title=&part=&chapter=22.&article=
- Secondary source: https://www.winston.com/en/blogs-and-podcasts/privacy-law-corner/your-smartphone-app-needs-a-privacy-policy-says-ca-ag-app-stores-to-implement (app store agreement; the Jam City figure came from a search summary with no alert URL, unverified as of 2026-10-02)

### CIPA litigation over session replay, chat widgets, pixels and SDKs (SB 690)

- Jurisdiction: California (Penal Code 631 wiretapping, 632.7 recording of cellular and cordless calls, 638.51 pen register and trap and trace), with a private right of action of USD 5,000 per violation for the wiretap sections
- Covers: plaintiffs claim that session replay scripts, chat widgets, Meta and TikTok pixels and analytics SDKs intercept communications or act as pen registers without consent
- Triggers: adding a session replay script, a third-party chat widget, an ad pixel or an analytics SDK to a site or app with California visitors; routing chat transcripts to a vendor that can use them for its own purposes
- Key dates: Ninth Circuit, Mikulsky v. Bloomingdale's, 20 Jun 2025 (unpublished) reversed a dismissal of a session replay claim under section 631(a) (verified, secondary source)
- Key dates: SB 690 passed the Legislature unanimously on 28 Aug 2026 (secondary source) and was approved by the Governor on 30 Sep 2026 as Chapter 976, Statutes of 2026 (verified, leginfo chaptered text)
- Status as of 2026-10-02: the chaptered text amends Penal Code 637.2 so that an action against a private actor for a violation of 638.51 arising from conduct on a website, online application or mobile application may be brought only by the Attorney General (verified, leginfo text)
- Status as of 2026-10-02: the text has no urgency clause so the default 1 Jan 2027 operative date applies (California Constitution art. IV, sec. 8(c); inferred, the bill text states no date)
- Status as of 2026-10-02: retroactivity clause quoted from the text: the amendments "apply retroactively to any pending claim in an action commenced within two years before the operative date" so suits filed from about 1 Jan 2025 are reached (verified, leginfo text; the two-year window arithmetic is mine)
- Status as of 2026-10-02: section 631 and the damages remedy of USD 5,000 per violation for other violations of the chapter are untouched (verified, leginfo text)
- Status as of 2026-10-02: the broad "commercial business purpose" exemption was dropped from the bill in July 2026 so section 631 wiretap claims against replay tools, chat widgets and pixels stay live (verified, secondary source)
- Status as of 2026-10-02: no California appellate decision settling whether session replay or pixels are wiretaps was found; trial courts and federal districts remain split (unverified as of 2026-10-02 beyond the Ninth Circuit item above)
- Primary source: https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260SB690
- Primary source: https://leginfo.legislature.ca.gov/faces/billStatusClient.xhtml?bill_id=202520260SB690
- Secondary source: https://www.fenwick.com/insights/publications/california-legislature-passes-sb-690-narrowing-private-rights-action-under
- Secondary source: https://www.loeb.com/en/insights/passle/2025/06/ninth-circuit-favors-robust-privacy-protections-under-cipa (Mikulsky)

### Delete Act (SB 362), DROP and data broker registration

- Jurisdiction: California (CPPA enforces; reaches businesses that knowingly collect and sell personal information of consumers they have no direct relationship with)
- Covers: a single deletion request made through the CPPA's Delete Request and Opt-Out Platform (DROP) must be honoured by every registered data broker; brokers must register each year and disclose more categories under SB 361
- Triggers: buying, enriching or reselling personal data about people who are not your customers; selling a lead list or audience segment; reselling SDK-collected data
- Key dates: DROP opened to consumers 1 Jan 2026 (verified, cppa.ca.gov)
- Key dates: from 1 Aug 2026 registered brokers must retrieve DROP deletion lists at least every 45 days and process them (verified, secondary source)
- Key dates: SB 361 broker disclosures were due 31 Jan 2026 (verified, secondary source)
- Status as of 2026-10-02: the daily fine for failing to register is USD 200 per consumer per day after SB 361 (secondary source); more than 600 brokers are registered and over 300,000 requests were reported by spring 2026 (secondary source)
- Status as of 2026-10-02: whether a first-party SaaS vendor counts as a broker depends on direct relationship facts and is a fact question (unverified as of 2026-10-02)
- Primary source: https://cppa.ca.gov/data_broker_registry/ (fetched; confirms annual registration in January and DROP open to residents from 1 Jan 2026)
- Secondary source: https://www.alstonprivacy.com/drop-is-coming-due-what-californias-delete-act-means-for-data-brokers-in-august/
- Secondary source: https://www.malwarebytes.com/blog/news/2026/08/californians-can-tell-data-brokers-to-drop-their-information

### California opt-out preference signal (AB 566) and location privacy (AB 45)

- Jurisdiction: California
- Covers: AB 566 (Opt Me Out Act) requires browsers sold in California to offer an easy setting that sends an opt-out preference signal; businesses already must honour such signals under the CCPA; AB 45 bars collecting or selling personal information from people at or near family planning centers
- Triggers: shipping a web browser or a browser-engine product; running ad tech or analytics that ignores Global Privacy Control; geofencing or using location data near clinics
- Key dates: AB 566 approved 8 Oct 2025 as Chapter 465 and operative 1 Jan 2027 (verified, leginfo)
- Key dates: AB 45 approved 26 Sep 2025 (verified, leginfo); operative date unverified as of 2026-10-02
- Status as of 2026-10-02: AB 45 also bans geofencing health care entities to track people and sets civil penalties of USD 25,000 per occurrence (verified, leginfo summary)
- Status as of 2026-10-02: AB 566 gives browser makers liability protection when a site ignores the signal; site operators carry the duty to honour it
- Primary source: https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260AB566
- Primary source: https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260AB45
- Secondary source: https://iapp.org/news/a/california-governor-signs-new-law-requiring-in-browser-opt-out-preference-signal

### State data breach notification laws and SEC incident disclosure

- Jurisdiction: all 50 states, DC and US territories (the law of the residents' state applies wherever you are based)
- Covers: notice to residents after unauthorised acquisition of defined personal information; many states add notice to the AG or a regulator above a resident-count threshold; encryption is usually a safe harbor
- Triggers: a leaked database, a compromised API key that exposed user records, a ransomware event on a system holding user data, a misconfigured storage bucket
- Key dates: California SB 446 (Chapter 319, approved 3 Oct 2025) requires notice to residents within 30 calendar days and a sample notice to the AG within 15 days when more than 500 residents are notified; it took effect 1 Jan 2026 (verified, leginfo)
- Key dates: Oklahoma SB 626 (wider data definition) took effect 1 Jan 2026 (verified, secondary source)
- Key dates: the SEC adopted its cyber incident rule on 26 Jul 2023 (effective 5 Sep 2023) and Form 8-K Item 1.05 requires disclosure within four business days of deciding an incident is material (adoption date verified at sec.gov; the four-day figure is from a secondary source)
- Status as of 2026-10-02: most states still use "without unreasonable delay" with outer limits of 30 to 60 days in a growing group; Florida, Colorado, New York and Texas already used 30 days (secondary source; a full 50-state table was not rebuilt)
- Status as of 2026-10-02: no rescission of the SEC rule was found (secondary source)
- Primary source: https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202520260SB446
- Primary source: https://www.sec.gov/rules-regulations/2023/07/s7-09-22
- Secondary source: https://www.sheppard.com/insights/blogs/2026-data-breach-law-updates-california-and-oklahoma
- Secondary source: https://sec-api.io/resources/cybersecurity-incidents-item-1-05-form-8-k

## Children and minors

### COPPA and the amended COPPA Rule

- Jurisdiction: US federal (FTC)
- Covers: verifiable parental consent before collecting personal information from children under 13 on child-directed services or with actual knowledge
- Triggers: a kids' app or game; knowing a user is under 13; collecting voice, photos, persistent identifiers or geolocation from likely children
- Key dates: final amendments published 22 Apr 2025; effective 23 Jun 2025; operator compliance by 22 Apr 2026 (verified)
- Status as of 2026-10-02: the compliance date has passed and the FTC says enforcement is a priority
- Status as of 2026-10-02: new duties include separate parental consent for third-party disclosures (including for ad targeting), a written data retention policy, a written security program, plus biometric identifiers, government IDs and more geolocation counted as personal information (verified, secondary source)
- Primary source: https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule

### App store age verification and age signal laws

- Jurisdiction: Texas, Utah, Louisiana, Alabama and California
- Covers: app stores verify age and get parental consent for minors; developers use age signals, set age ratings and handle minors' access
- Triggers: publishing a mobile app in these states; apps with adult content or social features; in-app purchases by minors
- Key dates: Texas SB 2420 was due 1 Jan 2026 but enjoined by a district court on 23 Dec 2025 (verified)
- Key dates: Utah moved to 6 May 2027 by HB 498 and Louisiana to 1 Jul 2027 by HB 977, signed 15 May 2026 (verified)
- Key dates: Alabama's act (enacted February 2026) takes effect 1 Jan 2027 per one source (verified, secondary source)
- Key dates: California AB 1043 (Digital Age Assurance Act, signed 13 Oct 2025) applies 1 Jan 2027 and makes operating systems send an age-bracket signal to apps (verified)
- Status as of 2026-10-02: Texas is operative because the Fifth Circuit stayed the injunction (an administrative stay was reported 28 May 2026 and a formal stay in June 2026; sources differ on the date) and the Supreme Court denied an emergency application to vacate in July 2026; the merits appeal is pending (verified, secondary sources)
- Status as of 2026-10-02: Utah removed AG enforcement and relies on private suits; CCIA dismissed its Utah challenge on 21 Apr 2026 (verified, secondary source)
- Status as of 2026-10-02: Texas is the only one of these with live developer duties today; plan for the others in 2027
- Primary source: https://fpf.org/blog/comparing-enacted-app-store-accountability-acts/

### Age-appropriate design codes and minors' social media laws

- Jurisdiction: California, Maryland, Vermont, Nebraska, Virginia and others
- Covers: default privacy settings, data protection impact assessments, limits on profiling and dark patterns for minors, addictive-feed limits, time limits
- Triggers: services likely accessed by under-18s; algorithmic feeds; notifications to minors at night; engagement-driven design
- Key dates: California SB 976 addictive-feed provisions effective 1 Feb 2025; AG regulations due 1 Jan 2027 (verified, secondary source)
- Key dates: Nebraska AADC effective 1 Jan 2026 (verified, secondary source)
- Key dates: Vermont AADC dates conflict between sources (1 Jan 2027 and 1 Jul 2026) (unverified as of 2026-10-02)
- Status as of 2026-10-02: the Ninth Circuit on 12 Mar 2026 narrowed the injunction against California's AADC; the coverage definition and age-estimation provision may proceed while the data-use and dark-pattern provisions stay enjoined as likely vague (verified, secondary source)
- Status as of 2026-10-02: a federal court enjoined Virginia's one-hour limit for under-16s on 27 Feb 2026 and Virginia appealed (verified, secondary source)
- Status as of 2026-10-02: unsettled; First Amendment challenges succeed against content-based rules and often fail against pure design and data rules
- Primary source: https://techpolicy.press/tracker

### TAKE IT DOWN Act

- Jurisdiction: US federal (FTC)
- Covers: covered platforms must offer a notice process and remove non-consensual intimate imagery, including deepfakes, within 48 hours of a valid request
- Triggers: any site or app hosting user-posted images or video, including messaging and gaming
- Key dates: platform duties took effect 19 May 2026 (verified)
- Status as of 2026-10-02: the FTC launched a complaint site and sent warning letters on 20 May 2026; violations are treated as FTC rule violations with civil penalties of USD 53,088 each (verified, secondary source)
- Primary source: https://www.insideprivacy.com/united-states/federal-trade-commission/the-take-it-down-acts-notice-and-removal-requirements-enter-into-effect/

## Consumer protection, subscriptions and marketing

### FTC negative option rule and ROSCA

- Jurisdiction: US federal
- Covers: the 2024 "click-to-cancel" amendments would have required clear disclosure, express consent and cancellation as easy as sign-up; ROSCA separately requires clear terms, informed consent and simple cancellation for online negative option offers
- Triggers: free trials that convert, auto-renewing plans, cancellation behind a phone call or chat, pre-checked boxes
- Key dates: the Eighth Circuit vacated the 2024 amendments on 8 Jul 2025 in Custom Communications v. FTC
- Key dates: the FTC issued a new ANPRM on 11 Mar 2026, published 13 Mar 2026, with comments due 13 Apr 2026 (verified)
- Status as of 2026-10-02: no federal click-to-cancel rule is in force and a new rule is at an early stage
- Status as of 2026-10-02: ROSCA and Section 5 remain the enforcement tools (Amazon Prime 2023 and Uber 2025 actions) (verified, secondary source)
- Primary source: https://www.gtlaw.com/en/insights/2026/3/ftc-seeks-comment-on-potential-updates-to-negative-option-rule

### State automatic renewal laws

- Jurisdiction: California, New York, Colorado and about half the states
- Covers: clear disclosure beside the consent request, express affirmative consent, an acknowledgment, a cancellation path matching sign-up, renewal reminders
- Triggers: any subscription sold to consumers in those states, including free-to-paid conversions and price increases
- Key dates: California AB 2863 effective 1 Jul 2025; New York amendments effective 5 Nov 2025 (verified)
- Status as of 2026-10-02: California requires proof of consent kept three years, an online "click to cancel" for online sign-ups and save-offer limits; New York requires a 15 to 45 day reminder before renewal of plans of a year or longer and an always-available cancellation mechanism (verified, secondary sources)
- Status as of 2026-10-02: Colorado also updated its law; details not reviewed (unverified as of 2026-10-02)
- Primary source: https://www.dwt.com/insights/2024/10/ab-2863-updates-california-automatic-renewal-law

### CAN-SPAM

- Jurisdiction: US federal
- Covers: commercial email needs accurate headers, non-deceptive subjects, ad identification, a physical address, a working opt-out honoured within 10 business days
- Triggers: marketing, lifecycle or promotional email; purchased lists; sending on behalf of customers
- Key dates: enacted 2003; penalty cap adjusted for inflation
- Status as of 2026-10-02: unchanged; up to USD 53,088 per violating email per the FTC guide (verified, penalty figure from a guide edited Jan 2024 so likely adjusted since)
- Primary source: https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business

### TCPA (calls and SMS)

- Jurisdiction: US federal (FCC and private suits) plus state mini-TCPAs
- Covers: prior express written consent for marketing texts and autodialed or prerecorded calls; revocation handling; quiet hours and Do Not Call
- Triggers: SMS marketing, OTP-adjacent promos, appointment texts mixed with marketing, buying leads
- Key dates: revocation rule effective 11 Apr 2025 (honour opt-outs by reasonable means within 10 business days)
- Key dates: the "revoke all" extension was moved from 11 Apr 2026 to 31 Jan 2027 (verified, secondary source)
- Status as of 2026-10-02: the Eleventh Circuit vacated the FCC's one-to-one consent rule and the FCC removed it (verified, secondary source)
- Status as of 2026-10-02: state mini-TCPAs (Florida, Oklahoma and others) are stricter on timing and consent (unverified as of 2026-10-02)
- Primary source: https://activeprospect.com/blog/fcc-tcpa/

### Dark patterns and other FTC rules

- Jurisdiction: US federal and state
- Covers: Section 5 unfairness and deception, the consumer-reviews rule (fake reviews), CPRA's rule that consent from dark patterns is invalid, fee-disclosure rules
- Triggers: confusing opt-outs, hidden fees, fake urgency, incentivised or fabricated reviews, buried cancellation
- Key dates: fake reviews rule effective 21 Oct 2024; fee rule effective 12 May 2025 (statutory text, not re-fetched; unverified as of 2026-10-02)
- Status as of 2026-10-02: unverified as of 2026-10-02 for any 2026 changes
- Primary source: https://www.ftc.gov/business-guidance

### UK DMCC Act: subscription contracts regime

- Jurisdiction: United Kingdom (Digital Markets, Competition and Consumers Act 2024, Part 4 Chapter 2)
- Covers: pre-contract information at sign-up; reminder notices before a trial converts to paid and during long contracts; a 14-day cooling-off right after sign-up and after a trial or a renewal of 12 months or more; cancellation that is easy and online if sign-up was online
- Triggers: a UK subscription with a free trial that rolls into paid; auto-renewing annual plans; cancellation that needs a call or a chat
- Key dates: the official gov.uk consultation response of 2 Apr 2026 says the regime is anticipated to commence in spring 2027 (verified)
- Key dates: law firm sources report the Prime Minister brought the start forward to January 2027 in an August 2026 announcement; no gov.uk or CMA page dating it was found; the January 2027 start is therefore secondary-source only (secondary source; exact day not fixed)
- Key dates: announcement dates differ by source (9 Aug, 10 Aug, 17 Aug and 3 Sep 2026 all appear, the later ones likely being article dates) (sources disagree)
- Status as of 2026-10-02: secondary legislation and statutory guidance had still to be laid at the announcement; whether they have now been laid is unverified as of 2026-10-02
- Status as of 2026-10-02: a consultation this autumn will test banning misleading "was" prices and fake discounts; CMA fines reach 10% of worldwide turnover or GBP 300,000 (secondary source)
- Primary source: https://www.legislation.gov.uk/ukpga/2024/13/contents (fetched)
- Primary source: https://www.gov.uk/government/consultations/consultation-on-the-implementation-of-the-new-subscription-contracts-regime/outcome/government-response-to-consultation-on-the-implementation-of-the-new-subscription-contracts-regime-web-accessible-version (fetched)
- Secondary source: https://www.twobirds.com/en/insights/2026/uk/subscription-contract-changes-to-be-brought-forward-to-january-2027 (10 Aug announcement; not fetched, from search)
- Secondary source: https://connectontech.bakermckenzie.com/uk-government-accelerates-dmcca-subscription-reforms-to-january-2027/ (fetched; dates it 17 Aug)

### UK CMA direct consumer enforcement: drip pricing and fake reviews

- Jurisdiction: United Kingdom (CMA, under the DMCC Act)
- Covers: the CMA can find breaches and fine without going to court; banned practices include drip pricing (mandatory fees added late), fake or hidden-incentive reviews and misleading choice architecture
- Triggers: a booking or checkout flow that adds fees after the headline price; review widgets that filter out negative reviews; countdown timers and default opt-ins
- Key dates: powers began April 2025 (verified, secondary source)
- Status as of 2026-10-02: first fine in April 2026 against the AA driving school brands, GBP 4.2 million after a 40% settlement discount plus about GBP 760,000 refunds for a mandatory GBP 3 booking fee (verified, secondary source)
- Status as of 2026-10-02: in year one the CMA opened 14 investigations and fines approached GBP 6 million; five fake-review investigations opened in March 2026 (verified, secondary source)
- Primary source: https://www.gov.uk/government/news/cma-orders-the-aa-and-bsm-driving-schools-to-refund-learner-drivers-over-drip-pricing (fetched; confirms 15 Apr 2026, GBP 4.2 million, 40% discount, over GBP 760,000 refunds)
- Secondary source: https://www.osborneclarke.com/insights/cma-issues-first-fines-under-its-new-uk-direct-consumer-enforcement-powers (year-one statistics; not fetched, from search)

### EU Digital Fairness Act (proposal pending)

- Jurisdiction: EU
- Covers: expected rules on dark patterns, subscription traps, addictive design, influencer marketing and unfair personalisation; the text is not public so scope is unknown
- Triggers: engagement-driven features such as infinite scroll and streaks; hard-to-cancel EU subscriptions; personalised pricing
- Key dates: Commission work programme lists a proposal for Q4 2026 (verified, secondary source)
- Status as of 2026-10-02: not yet tabled; MLex reported on 23 Sep 2026 that November is likely with 18 Nov among the dates considered (secondary source; tentative)
- Status as of 2026-10-02: plan against existing rules (Unfair Commercial Practices Directive and DSA) until text appears
- Primary source: https://digital-strategy.ec.europa.eu/en/consultations/commission-launches-open-consultation-forthcoming-digital-fairness-act (fetched; consultation ran 17 Jul to 24 Oct 2025, no proposal text)
- Secondary source: https://www.mlex.com/mlex/articles/2529049/eu-digital-fairness-act-on-consumer-protection-tentatively-eyed-for-november (fetched; November timing)

### ESIGN, UETA and clickwrap versus browsewrap enforceability

- Jurisdiction: US federal (15 U.S.C. 7001) and state UETA (49 states and DC) plus court case law
- Covers: electronic signatures and records are valid if the user intends to sign and consents to electronic delivery; terms bind a user only on reasonably conspicuous notice and unambiguous assent
- Triggers: sign-up flows that say "by continuing you agree"; a terms update pushed by email only; arbitration clauses in terms; consumer disclosures delivered only in-app
- Key dates: Chabolla v. ClassPass (Ninth Circuit, 27 Feb 2025) held a sign-in wrap not an enforceable contract (verified, secondary source)
- Status as of 2026-10-02: a checkbox or button that states agreement beside a link is the safe pattern; sign-in wraps and change-of-terms notices are the weak ones (secondary source)
- Status as of 2026-10-02: ESIGN consumer-consent rules and 2026 case law were not re-surveyed (unverified as of 2026-10-02)
- Primary source: https://www.law.cornell.edu/uscode/text/15/chapter-96 (fetched as a table of contents; consent provision text not read)
- Secondary source: https://www.lcwlegal.com/news/dont-just-click-browsewrap-or-clickwrap-agreements-for-arbitration-provisions-can-be-enforceable/
- Secondary source: https://www.beneschlaw.com/insight/navigating-the-fine-print-ninth-circuit-tightens-scrutiny-on-digital-arbitration-agreements/pdf/

## Accessibility

### ADA Title II web rule (public entities)

- Jurisdiction: US (state and local governments and their vendors)
- Covers: web content and mobile apps must meet WCAG 2.1 AA
- Triggers: selling software to a school, city, county or state agency; building portals for them
- Key dates: the original 24 Apr 2026 deadline was extended by a DOJ interim final rule published 20 Apr 2026 to 26 Apr 2027 (entities with 50,000 or more people) and 26 Apr 2028 (smaller entities and special districts) (verified, secondary source)
- Status as of 2026-10-02: government buyers will demand WCAG 2.1 AA conformance claims (VPATs) well before the new dates
- Primary source: https://www.ada.gov/resources/2024-03-08-web-rule/

### ADA Title III and private websites

- Jurisdiction: US (private businesses, litigated state by state)
- Covers: no technical regulation; courts apply the ADA to some websites and apps, using WCAG as the working yardstick; California's Unruh Act adds damages
- Triggers: e-commerce and consumer apps; checkout flows; video without captions
- Key dates: none; this is case law
- Status as of 2026-10-02: unsettled; circuits split on whether a site needs a link to a physical place of business and serial demand letters and suits continue (statutory text and case law, not re-fetched; unverified as of 2026-10-02)
- Primary source: https://www.ada.gov/resources/web-guidance/

## Open-source licensing and AI model licenses

### Copyleft and permissive licenses (GPL, LGPL, AGPL, MPL, MIT, Apache)

- Jurisdiction: global (copyright and contract)
- Covers: GPL requires source for distributed derivative works; LGPL allows dynamic linking with relinking rights; AGPL adds a network clause that covers users interacting over a network; MPL is file-level copyleft; MIT and BSD require the copyright notice; Apache 2.0 requires the license copy, change notices and carrying forward NOTICE file attributions plus grants patents
- Triggers: shipping a binary, container, mobile app or on-prem installer that includes GPL code; running modified AGPL software as a SaaS backend; vendoring MIT or Apache code without notices
- Key dates: license texts are stable; GPL-3.0 2007, AGPL-3.0 2007, Apache-2.0 2004 (statutory text, not re-fetched)
- Status as of 2026-10-02: Apache-2.0 section 4 obligations confirmed (license text, verified)
- Status as of 2026-10-02: Software Freedom Conservancy v. Vizio (Orange County Superior Court) tests whether a recipient can enforce GPL source-offer duties as a third-party beneficiary; a trial was reported for late 2026; the court has let the theory proceed (verified, secondary source; unsettled)
- Status as of 2026-10-02: internal use and SaaS without distribution generally does not trigger GPL; AGPL does trigger on modified versions offered over a network
- Primary source: https://www.gnu.org/licenses/gpl-faq.html
- Primary source: https://www.apache.org/licenses/LICENSE-2.0.txt

### Source-available relicensing (SSPL, BSL, Commons Clause, Elastic License)

- Jurisdiction: global
- Covers: SSPL requires offering the service's whole stack as source if you provide it as a service; BSL and the Elastic and Redis source-available licenses limit competing or hosted use for a time or by field; the Commons Clause bars selling the software
- Triggers: depending on a project that relicensed mid-life; building a managed service on a source-available database; relicensing your own project
- Key dates: MongoDB SSPL 2018, Elastic 2021, HashiCorp BSL 2023, Redis RSAL and SSPL 2024 (secondary source)
- Status as of 2026-10-02: Redis 8 added AGPL as an option and the common pattern is a relicense followed by a community fork (OpenTofu, Valkey, OpenSearch) (verified, secondary source)
- Status as of 2026-10-02: these licenses are not OSI open source; check the exact license for the exact version you pin and note that a relicense usually applies only to new releases
- Primary source: https://opensource.org/licenses

### Creative Commons on code and assets

- Jurisdiction: global
- Covers: CC BY and CC BY-SA require attribution; BY-SA adds share-alike; NC and ND limit commercial use and modification; CC advises against using CC licenses for software
- Triggers: using CC-licensed icons, fonts, datasets, images or docs in a product or training set
- Key dates: version 4.0 licenses from 2013
- Status as of 2026-10-02: one-way compatibility of CC BY-SA 4.0 into GPLv3 exists; NC assets are a problem for any commercial product (license text and FAQ, not re-fetched)
- Primary source: https://creativecommons.org/faq/

### AI model licenses (Llama, OpenRAIL, open-weights definitions)

- Jurisdiction: global (contract)
- Covers: the Llama 4 Community License grants a non-exclusive license with a 700 million monthly-active-user cap (a separate license from Meta at its sole discretion above that), "Built with Llama" display, a "Llama" prefix on derived model names, an incorporated acceptable use policy and termination if you sue Meta over IP
- Covers: OpenRAIL licenses attach behavioural use restrictions that must flow down to downstream users (license text, not re-fetched)
- Covers: the OSI Open Source AI Definition requires information on data, code and parameters; Llama does not meet it and OSI says so
- Triggers: fine-tuning or embedding a "free" model in a commercial product; distributing weights; using outputs to train another model
- Key dates: Llama 4 released April 2025
- Status as of 2026-10-02: Llama license terms verified against the license page
- Status as of 2026-10-02: press reports say Llama 4 multimodal use is withheld from EU-domiciled entities (secondary source; not found in the license text fetched)
- Status as of 2026-10-02: whether model weights are copyrightable and whether use restrictions bind third parties is unsettled
- Primary source: https://www.llama.com/llama4/license/

## Copyright, AI training and AI output

### US Copyright Office guidance and AI authorship

- Jurisdiction: US federal
- Covers: purely AI-generated output has no copyright; human selection, arrangement and modification can be protected; Part 3 of the Office's AI report addresses training and fair use
- Triggers: shipping AI-generated art, code or text and claiming ownership; registering such works; promising customers exclusive rights to generated output
- Key dates: Part 3 (generative AI training) pre-publication version released 9 May 2025 (verified)
- Key dates: the Supreme Court denied certiorari in Thaler v. Perlmutter on 2 Mar 2026, leaving the D.C. Circuit's human-author rule intact (verified, secondary source)
- Status as of 2026-10-02: Part 3 is a pre-publication staff view and the Register of Copyrights was dismissed the day after its release. Its weight is contested; courts are not bound by it (verified, secondary source)
- Status as of 2026-10-02: Part 2 on copyrightability (January 2025) not re-checked (unverified as of 2026-10-02)
- Primary source: https://www.copyright.gov/ai/

### AI training copyright cases

- Jurisdiction: US, UK and Germany
- Covers: whether training on copyrighted works is fair use or infringement; whether pirated sources taint training; whether models "contain" copies; whether outputs reproduce works
- Triggers: training or fine-tuning on scraped, purchased or pirated data; using shadow-library datasets; shipping a model that can regurgitate lyrics or articles
- Status as of 2026-10-02: unsettled overall, with several first-instance rulings pulling different ways
- Status as of 2026-10-02: Thomson Reuters v. Ross (non-generative AI): the Third Circuit reportedly affirmed on 29 or 30 Sep 2026, rejecting fair use; the news says the reasoning is narrow and tied to a direct competitor; the opinion text was not reviewed (verified from news only)
- Status as of 2026-10-02: Bartz v. Anthropic: a $1.5 billion class settlement over pirated books received final approval on 20 Jul 2026, with payments in two stages through Sep 2027 (verified)
- Status as of 2026-10-02: Kadrey v. Meta: fair use on that record, with the judge stressing the result is narrow and a market-dilution theory with better evidence could win (verified, secondary source)
- Status as of 2026-10-02: In re OpenAI Copyright Litigation (S.D.N.Y. 25-md-3143, includes NYT): no merits ruling; DOJ filed a statement of interest on 1 Sep 2026 saying training is not categorically infringing (verified, secondary source)
- Status as of 2026-10-02: Getty v. Stability AI (UK): the High Court rejected secondary infringement because model weights do not store copies; Getty got permission to appeal on that point of law and the appeal is pending with no hearing date found (verified, secondary source)
- Status as of 2026-10-02: GEMA v. OpenAI (Munich Regional Court, 11 Nov 2025): memorised lyrics in a model are reproductions; OpenAI appealed (verified, secondary source)
- Status as of 2026-10-02: other pending suits (Concord v. Anthropic, Disney v. Midjourney and more) were not re-checked (unverified as of 2026-10-02)
- Primary source: https://www.courtlistener.com
- Primary source: https://www.niemanlab.org/2026/09/federal-appeals-court-upholds-thomson-reuters-landmark-ai-copyright-win/

### EU DSM Copyright Directive: text-and-data-mining exceptions and Article 17

- Jurisdiction: EU member states (Directive (EU) 2019/790 as implemented nationally; applies to acts of reproduction in the EU)
- Covers: Article 3 allows research organisations and cultural heritage institutions to mine lawfully accessed works for scientific research; Article 4 allows anyone to mine lawfully accessible works unless the rightholder reserves rights in an appropriate manner, which for online content means machine-readable means; Article 17 makes online content-sharing platforms liable for user uploads unless they made best efforts to get licences and to block notified works
- Covers: the AI Act GPAI copyright policy duty requires model providers to identify and honour Article 4 reservations; the GPAI Code of Practice copyright chapter turns that into measures such as respecting robots.txt
- Triggers: training a model on scraped EU web pages that carry a robots.txt block or a TDM-reservation header; building a crawler that ignores opt-outs; running a platform where users upload video, audio or images at scale
- Key dates: Directive in force 6 Jun 2019 (statutory text, not re-fetched)
- Key dates: Hamburg Higher Regional Court (OLG Hamburg, 5 U 104/24) dismissed Kneschke's appeal against LAION on 10 Dec 2025 (verified, secondary source)
- Key dates: CJEU Grand Chamber hearing in Like Company v Google (C-250/25) on 10 Mar 2026; Advocate General Szpunar's opinion was scheduled for 3 Sep 2026 (verified, secondary sources)
- Status as of 2026-10-02: OLG Hamburg held that LAION's dataset work was covered by the research exception in German law (section 60d) and that a natural-language opt-out is not machine-readable under section 44b(3); a further appeal to the Federal Court of Justice is possible but none was confirmed in the sources found (verified, secondary source)
- Status as of 2026-10-02: whether the Advocate General opinion was delivered and what it says is unverified as of 2026-10-02; the CJEU judgment will decide whether LLM training is a reproduction and whether Article 4 covers it
- Status as of 2026-10-02: until that judgment the scope of Article 4 for generative training is unsettled
- Status as of 2026-10-02: treat Article 4 as available only if you honour every reservation you can detect; a natural-language terms-of-service opt-out is risky to ignore because courts have not agreed on what counts as machine-readable
- Primary source: https://eur-lex.europa.eu/eli/dir/2019/790/oj (not fetched: EUR-Lex returned empty content)
- Primary source: https://eur-lex.europa.eu/eli/C/2025/3039/oj/eng (Like Company referral notice, C-250/25; not fetched: not requested directly, found via search; infocuria case page at https://infocuria.curia.europa.eu/tabs/affair?lang=en&publishedId=C-250%2F25 fetched but returned no usable content)
- Secondary source: https://grunecker.de/insights/ai-and-copyright-hamburg-court-of-appeal-rejects-appeal-in-laion-case/ (Hamburg ruling)
- Secondary source: https://www.twobirds.com/en/insights/2026/like-company-v-google-cjeu-holds-first-ever-hearing-on-generative-ai-and-copyright-on-10-march-2026 (hearing and opinion date; not fetched, from search)

### GEMA v OpenAI and GEMA v Suno (Munich)

- Jurisdiction: Germany (Munich Regional Court I), with reasoning that other EU courts may borrow
- Covers: memorisation of protected works in model weights is a reproduction that the TDM exception does not cover; the provider and not the user is liable for outputs that reproduce works
- Triggers: shipping a music, lyrics or text model that can regurgitate protected works; training outside the EU on works and then offering the model to German users
- Key dates: GEMA v OpenAI judgment 11 Nov 2025; GEMA v Suno judgment 31 Jul 2026, case 42 O 763/25 (verified, secondary source)
- Status as of 2026-10-02: the Suno court held that training without a licence infringes even where training took place outside the EU; memorisation in models hosted on German servers is an infringing reproduction (verified, secondary source)
- Status as of 2026-10-02: the OpenAI judgment is on appeal to the Munich Court of Appeal and neither German ruling has been tested on appeal (verified, secondary source)
- Primary source: none located (no official judgment page for either Munich ruling was found)
- Secondary source: https://www.reedsmith.com/our-insights/blogs/viewpoints/102nfis/gema-notches-a-second-transatlantic-ai-copyright-win-in-germany/

### EU GPAI Code of Practice signatories (update)

- Jurisdiction: EU
- Covers: voluntary code giving a presumption of conformity with the AI Act GPAI duties (transparency, copyright plus safety and security for systemic-risk models)
- Triggers: choosing a foundation model vendor for an EU-facing product; fine-tuning a model enough to become a provider yourself
- Key dates: code published 10 Jul 2025 (see the GPAI entry above)
- Status as of 2026-10-02: the official page lists 21 signatories including OpenAI, Google, Microsoft and Anthropic (verified)
- Status as of 2026-10-02: full signatories include Amazon, IBM, Mistral AI, Aleph Alpha, Cohere and Black Forest Labs; xAI signed only the safety and security chapter; Meta declined to sign (secondary source, mid-2026 list)
- Status as of 2026-10-02: a downstream app that only calls a model API inherits no signatory duty but should ask the vendor for its copyright policy and training data summary; the full current list was not checked against the Commission page (unverified as of 2026-10-02)
- Primary source: https://digital-strategy.ec.europa.eu/en/policies/gpai-code-practice (fetched)
- Secondary source: https://casrai.org/wp/?p=3321 (signatory split; not fetched, from search)

### UK copyright and AI: the March 2026 report

- Jurisdiction: United Kingdom
- Covers: sections 135 to 137 of the Data (Use and Access) Act 2025 required an economic impact assessment, a report on AI training and copyright and a progress statement; there is still no UK commercial text-and-data-mining exception (the existing one covers non-commercial research only)
- Triggers: training a model on UK copyright works; selling an AI product to UK creative businesses; relying on a UK opt-out that does not exist yet
- Key dates: report and impact assessment published 18 Mar 2026, meeting the statutory deadline (verified)
- Status as of 2026-10-02: the government dropped its preferred broad exception with opt-out and now has no preferred option; 11,520 consultation responses were mostly against it (verified, secondary source)
- Status as of 2026-10-02: four technical working groups cover control and standards, transparency, licensing and wider creator protections; a digital replicas consultation was promised for summer 2026 and its status is unverified as of 2026-10-02
- Status as of 2026-10-02: no legislation is pending; UK law is unchanged and the Getty v Stability appeal (see the AI training cases entry) is the nearest source of new rules
- Primary source: https://www.gov.uk/government/publications/report-and-impact-assessment-on-copyright-and-artificial-intelligence (fetched; confirms 18 Mar 2026)
- Secondary source: https://www.scl.org/uk-government-issues-report-on-ai-and-copyright/ (no preferred option and working groups; not fetched, from search)

### DMCA 1201 anti-circumvention exemptions for software

- Jurisdiction: US federal (17 U.S.C. 1201)
- Covers: it is unlawful to circumvent access controls on copyrighted works; the Librarian of Congress grants three-year exemptions, including for security research, device repair, software preservation and some video game uses
- Triggers: building a tool that bypasses DRM, licence checks or encryption on third-party software or devices; security research against locked firmware; reverse engineering a game server
- Key dates: ninth triennial final rule 25 Oct 2024, effective 28 Oct 2024 (verified, copyright.gov 2024 page confirms 28 Oct 2024; the 25 Oct date is from a secondary source)
- Key dates: tenth proceeding opened 9 Jun 2026; petitions were due 24 Aug 2026 and renewal comments are due 28 Sep 2026; new exemptions would run Oct 2027 to Oct 2030 (verified, copyright.gov)
- Status as of 2026-10-02: the 2024 exemptions are in force until the 2027 rule; the specific 2024 software classes were not re-fetched (unverified as of 2026-10-02)
- Primary source: https://www.copyright.gov/1201/2027/index.html
- Primary source: https://www.copyright.gov/1201/2024/ (fetched; the exemption classes sit in linked PDFs not opened)
- Secondary source: https://copyright.gov/newsnet/2024/1057.html (not fetched)

## Scraping and third-party terms

### Scraping, the CFAA and site terms

- Jurisdiction: US (federal and state), with contract law doing most of the work
- Covers: the CFAA covers access "without authorization" or exceeding it; after Van Buren (2021) it targets gates-up-or-down access, not misuse of data one may access; contract, trespass and copyright claims fill the gap
- Triggers: scraping logged-in or rate-limited sites; evading blocks or CAPTCHAs; training on scraped content; reselling scraped data
- Key dates: hiQ v. LinkedIn settled in December 2022 with a consent judgment, USD 500,000 and data destruction (verified)
- Key dates: Meta v. Bright Data: summary judgment for Bright Data on 23 Jan 2024 because logged-out scraping was not covered by Meta's terms (verified)
- Status as of 2026-10-02: X Corp v. Bright Data was dismissed, with the court finding state contract and unfair-competition claims preempted by the Copyright Act (verified, secondary source)
- Status as of 2026-10-02: Reddit v. Anthropic (five state claims including breach of contract and trespass to chattels) was remanded to California state court in March 2026 and the judge signalled doubts about Anthropic's defences in August 2026 (verified, secondary source)
- Status as of 2026-10-02: Google v. SerpApi (DMCA 1201 theory against scraping search results) was dismissed (verified, secondary source)
- Status as of 2026-10-02: practical point: public-page scraping is usually not a CFAA crime but terms you accepted (or API terms) bind you; logging in or circumventing technical blocks raises risk sharply
- Primary source: https://www.supremecourt.gov/opinions/20pdf/19-783_k53l.pdf

### Model-provider usage policies and API terms

- Jurisdiction: contract
- Covers: Anthropic's Usage Policy (effective 15 Sep 2025) bars listed harmful uses and requires, for high-risk domains (legal, health, insurance, finance, employment and housing, academic testing, journalism), qualified-professional review of outputs and disclosure that AI helped; consumer chatbots must disclose they are AI; products for minors need extra safeguards
- Covers: commercial and API terms bar using the service to build competing AI products or train rival models and the term "competing" is not defined (secondary source)
- Triggers: building an AI feature on a model API; selling to regulated industries; training a model on API outputs; serving minors; reselling access
- Key dates: Anthropic Usage Policy effective 15 Sep 2025 (verified); consumer plans train on chats by default unless the user opts out, since 28 Sep 2025 (secondary source)
- Status as of 2026-10-02: OpenAI's usage policies page could not be fetched; unverified as of 2026-10-02; API data is not used for training by default (secondary source)
- Status as of 2026-10-02: breaching these terms can end API access and is a contract claim and the downstream rules (AI disclosure, human review) often match the EU and state laws above
- Primary source: https://www.anthropic.com/legal/aup

### EU Database Directive and scraping

- Jurisdiction: EU member states (Directive 96/9/EC)
- Covers: the sui generis right lets a database maker with substantial investment stop extraction or re-utilisation of a substantial part for 15 years; Ryanair v PR Aviation (C-30/14, 2015) held that where a database has neither copyright nor the sui generis right the Directive's limits do not apply and a site's terms can ban scraping by contract
- Triggers: scraping a catalogue, price list or listings site for resale or comparison; training on a curated dataset; building a vertical search or aggregator on a competitor's data
- Key dates: Directive in force since 1996; Ryanair judgment 15 Jan 2015 (statutory text and case law, not re-fetched)
- Status as of 2026-10-02: settled in principle; contract terms and the database right are separate routes and both are used against scrapers (secondary source)
- Status as of 2026-10-02: no 2026 CJEU ruling was found applying the database right to AI training; any such ruling is unverified as of 2026-10-02
- Primary source: https://eur-lex.europa.eu/eli/dir/1996/9/oj (not fetched: EUR-Lex returned empty content)
- Secondary source: https://www.pinsentmasons.com/out-law/news/website-operators-can-prohibit-screen-scraping-of-unprotected-data-via-terms-and-conditions-says-eu-court-in-ryanair-case (Ryanair; not fetched, from search)

## Export controls and sanctions

### US EAR encryption controls

- Jurisdiction: US (BIS); reaches exports, reexports and in-country transfers of US-origin or US-controlled items
- Covers: software with encryption functions is generally ECCN 5D002; most commercial software qualifies for License Exception ENC or mass-market treatment (5D992); publicly available encryption source code is not subject to the EAR once published but non-standard cryptography needs an email notice to BIS and the ENC coordinator
- Triggers: adding encryption beyond standard TLS use; open-sourcing code with custom or non-standard crypto; shipping apps to embargoed countries
- Key dates: 742.15(b) notification replaced the old TSU notice and the ERN pre-registration was dropped in the 2016 revision (verified, secondary source)
- Status as of 2026-10-02: 734.3(b)(3) excludes published information and software from the EAR. Electronic encryption source code stays subject to the EAR unless 742.15(b) is satisfied; publicly available object code is covered only when its source qualifies (verified in the eCFR)
- Status as of 2026-10-02: the AI Diffusion Rule and its model-weights control (ECCN 4E091) were rescinded in May 2025 and not enforced; any replacement was not found (verified, secondary source; unverified as of 2026-10-02 for newer rules)
- Primary source: https://www.ecfr.gov/current/title-15/subtitle-B/chapter-VII/subchapter-C/part-742/section-742.15

### OFAC sanctions for SaaS and online services

- Jurisdiction: US (Treasury OFAC)
- Covers: US persons and US-nexus services cannot provide services to sanctioned persons or comprehensively sanctioned regions; general licenses cover some personal-communications tools (31 CFR 560.540 for Iran)
- Triggers: signing up users or customers from sanctioned regions; accepting payments from them; cloud or enterprise software for Russian entities
- Key dates: OFAC's Russia IT and cloud services determination prohibits enterprise-management and design and manufacturing software, IT consulting and support and SaaS for these categories from 12 Sep 2024 (verified, secondary source)
- Status as of 2026-10-02: OFAC has settled cases where collected IP address data showed users in sanctioned jurisdictions. Self-reported location is not enough (verified, secondary source)
- Status as of 2026-10-02: the current country and program list was not re-checked and Syria and other programs shifted in 2025 (unverified as of 2026-10-02)
- Primary source: https://ofac.treasury.gov/faqs

## Sector rules

### HIPAA (Privacy, Security and Breach Notification Rules)

- Jurisdiction: US federal (HHS OCR)
- Covers: covered entities and business associates must safeguard protected health information (PHI) and sign business associate agreements
- Triggers: handling PHI for a provider, plan or their vendor; adding analytics or AI to a patient portal; storing PHI in a cloud service
- Key dates: the Security Rule overhaul NPRM was published 6 Jan 2025 (verified)
- Status as of 2026-10-02: the NPRM would make encryption, MFA, segmentation and annual testing mandatory; it is not final and reports point to a final rule around July 2027 (verified, secondary source; unverified as of 2026-10-02 beyond that)
- Status as of 2026-10-02: the current Security Rule applies and OCR focuses on risk-analysis failures (secondary source)
- Primary source: https://www.hhs.gov/hipaa/for-professionals/security/index.html

### GLBA Safeguards Rule (financial data)

- Jurisdiction: US federal (FTC for non-bank financial institutions)
- Covers: a written information security program, a qualified individual, risk assessment, encryption, MFA, monitoring, incident response and an FTC notice for large breaches
- Triggers: fintech, lending, tax prep, payment apps or software serving financial institutions
- Key dates: breach-notification amendment effective 13 May 2024 (statutory text, not re-fetched)
- Status as of 2026-10-02: unverified as of 2026-10-02 for any 2026 changes
- Primary source: https://www.ecfr.gov/current/title-16/chapter-I/subchapter-C/part-314

### PCI DSS 4.0.1 (card data)

- Jurisdiction: global contractual standard enforced through card brands and acquirers
- Covers: security controls for anyone storing, processing or transmitting cardholder data
- Triggers: handling card numbers directly instead of using a hosted payment page; scripts on payment pages
- Key dates: version 4.0 retired 31 Dec 2024; future-dated requirements mandatory from 31 Mar 2025 (not re-fetched; unverified as of 2026-10-02)
- Status as of 2026-10-02: unverified as of 2026-10-02 whether a newer version has been announced
- Primary source: https://www.pcisecuritystandards.org/document_library/

### EU DORA (financial sector ICT resilience)

- Jurisdiction: EU (Regulation (EU) 2022/2554; reaches ICT providers to EU financial entities wherever based)
- Covers: financial entities must keep a register of ICT third-party contracts and include mandatory clauses; Article 30 clauses cover service descriptions, locations of data, security and incident assistance, audit and access rights, exit strategies and termination rights; designated critical providers face direct oversight by the European Supervisory Authorities
- Triggers: selling SaaS, cloud or analytics to an EU bank, insurer, payment firm or investment firm; being asked for audit rights, subcontractor lists, incident SLAs or exit plans in a procurement
- Key dates: applies since 17 Jan 2025 (statutory text, not re-fetched)
- Key dates: the ESAs published the first list of critical ICT third-party providers on 18 Nov 2025 (verified)
- Status as of 2026-10-02: the list has 19 providers, mainly large cloud and platform vendors including AWS, Google Cloud, Microsoft, Oracle, SAP and Deutsche Telekom (verified, secondary source)
- Status as of 2026-10-02: being off the list does not remove the duty; your financial customers must still flow Article 30 terms down to you (statutory text, not re-fetched)
- Primary source: https://eur-lex.europa.eu/eli/reg/2022/2554/oj (not fetched: EUR-Lex returned empty content)
- Primary source: https://www.esma.europa.eu/press-news/esma-news/european-supervisory-authorities-designate-critical-ict-third-party-providers (fetched; confirms 18 Nov 2025 designation but names no providers)
- Secondary source: https://www.morganlewis.com/zh-tw/blogs/sourcingatmorganlewis/2025/11/dora-eu-regulators-announce-list-of-critical-ict-third-party-providers (19 providers; not fetched, from search)

## International (outside the EU, UK and US)

These regimes matter once a product has users, staff, servers or vendors in the listed countries.
Most reach foreign companies.
Where the company is incorporated rarely decides whether a regime applies.

### Canada: PIPEDA and Bill C-36

- Jurisdiction: Canada federal (organisations in commercial activity; provinces with substantially similar laws, such as Quebec, Alberta and British Columbia, displace PIPEDA for in-province data)
- Covers: PIPEDA requires meaningful consent, purpose limitation, safeguards, breach reporting and access rights; Bill C-36 (Protecting Privacy and Consumer Data Act) would replace Part 1 of PIPEDA with a new regulator, a higher standard for children's data, automated-decision disclosure, pre-transfer risk assessment for data leaving Canada and penalties up to the greater of CAD 10 million or 3% of global revenue
- Triggers: collecting Canadian users' data for a commercial app; hosting Canadian data abroad; automated decisions with legal or similarly significant effect; assuming the old C-27 and AIDA will come back
- Key dates: C-27 (with AIDA) died when Parliament was prorogued in January 2025; C-36 had first reading on 15 Jun 2026 (verified, secondary sources)
- Status as of 2026-10-02: PIPEDA remains the operative federal law and C-36 is a bill at an early stage with no commencement date (verified, secondary source)
- Status as of 2026-10-02: C-36 has no AI-specific part like AIDA; the government says AI risk will be handled by targeted laws (verified, secondary source)
- Status as of 2026-10-02: whether PIPEDA stays in force during any transition is not stated in the sources read (unverified as of 2026-10-02)
- Primary source: https://www.parl.ca/legisinfo/en/bill/45-1/c-36
- Primary source: https://laws-lois.justice.gc.ca/eng/acts/p-8.6/
- Secondary source: https://www.dlapiper.com/en/insights/publications/2026/06/canada-tables-bill-c36-the-protecting-privacy-and-consumer-data-act

### Canada: Quebec Law 25

- Jurisdiction: Quebec (any private-sector enterprise handling personal information of Quebec residents)
- Covers: the Act respecting the protection of personal information in the private sector as amended by Law 25 requires a privacy officer, a privacy impact assessment for projects and for transfers outside Quebec, express consent for sensitive data, privacy-by-default settings, an opt-in for tracking and profiling functions, notice of automated decisions, a portability right and incident reporting
- Triggers: pre-checked consent boxes or tracking on by default for Quebec users; sending Quebec data to a US vendor without a documented assessment; profiling or automated decisions; a bundled consent buried in terms
- Key dates: phases took effect 22 Sep 2022, 22 Sep 2023 and 22 Sep 2024 (portability); all provisions apply since 22 Sep 2024 (verified, secondary source)
- Status as of 2026-10-02: administrative penalties reach CAD 10 million or 2% of worldwide turnover and penal fines reach CAD 25 million or 4% (secondary source)
- Status as of 2026-10-02: no administrative monetary penalty had been imposed as of December 2025 per one source and nothing newer was found; the regulator says enforcement will step up from 2026 (secondary source; unverified as of 2026-10-02 for 2026 decisions)
- Primary source: https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1 (not fetched: HTTP 403; CanLII copy also returned 403)
- Secondary source: https://www.osler.com/en/insights/updates/law-25-a-new-enforcement-scheme-for-protection-of-personal-information-in-the-private-sector-in-que/ (search result only, not fetched)

### Canada: CASL (anti-spam and software installation)

- Jurisdiction: Canada (messages sent from or accessed in Canada; software installed on devices in Canada)
- Covers: commercial electronic messages need consent, sender identification and an unsubscribe mechanism; installing a computer program on another person's device in the course of commercial activity needs express consent with prescribed disclosure and updates need consent too
- Triggers: emailing or texting Canadians for marketing; shipping an installer or auto-updater to Canadian users; software that changes settings or collects data after install
- Key dates: message rules July 2014; software installation rules January 2015 (secondary sources)
- Status as of 2026-10-02: in force; penalties reach CAD 10 million for organisations (secondary source)
- Status as of 2026-10-02: the private right of action was suspended before it started and remains not in force (secondary source; unverified as of 2026-10-02 for any 2026 change)
- Primary source: https://laws-lois.justice.gc.ca/eng/acts/E-1.6/
- Primary source: https://crtc.gc.ca/eng/internet/install.htm (not fetched: HTTP 403)
- Secondary source: https://www.zwillgen.com/privacy/canadian-regulator-provides-guidance-installation-computer-program-provisions-casl/ (search result only, not fetched)

### Brazil: LGPD, ANPD and international transfers

- Jurisdiction: Brazil (processing in Brazil or of people in Brazil or to offer goods and services there)
- Covers: Law 13.709/2018 (LGPD) sets legal bases, data subject rights, DPO duties and breach notice; ANPD Resolution CD/ANPD 19/2024 sets transfer mechanisms (adequacy, standard contractual clauses that must be adopted verbatim, binding corporate rules)
- Triggers: sending Brazilian users' data to servers or vendors abroad; training AI on Brazilian users' posts; operating without a named DPO
- Key dates: Resolution 19 issued 23 Aug 2024 with a 12-month window to bring existing contracts onto the standard clauses, which ended 23 Aug 2025 (verified, secondary sources)
- Status as of 2026-10-02: the standard-clause deadline has passed so any transfer relying on older bespoke contracts is exposed
- Status as of 2026-10-02: the ANPD 2026-2027 priorities list data subject rights, children's data under the Digital ECA, public sector and AI oversight; the ANPD has acted against Meta over AI training on posts (secondary source)
- Primary source: https://www.gov.br/anpd/pt-br/assuntos/assuntos-internacionais/transferencia-internacional-de-dados/international-affairs
- Primary source: https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm (not fetched: connection reset)
- Secondary source: https://www.littler.com/news-analysis/asap/brazil-standard-contractual-clauses-sccs-may-be-required-starting-august-23-2025 (search result only, not fetched)

### Brazil: ECA Digital (children online) and the AI bill PL 2338

- Jurisdiction: Brazil (foreign providers included)
- Covers: Law 15.211/2025 (ECA Digital) covers services aimed at or likely accessed by minors: reliable age verification (self-declaration is not enough), accounts of under-16s linked to a guardian, protective defaults, no profiling of minors for ads, no manipulative design, restrictions on loot boxes; PL 2338/2023 is the risk-based AI bill with fines up to BRL 50 million per violation
- Triggers: a game, social or messaging app or marketplace Brazilian children can reach; loot boxes; ad targeting by age; shipping a high-risk AI feature to Brazil once PL 2338 passes
- Key dates: ECA Digital enforceable from 17 Mar 2026; ANPD preliminary age assurance guidelines 20 Mar 2026 (verified, secondary sources)
- Key dates: ANPD enforcement timeline per one law-firm alert: final guidelines Aug 2026, administrative sanctions from Nov 2026, compliance verification from Jan 2027 (secondary source; unverified as of 2026-10-02 whether kept)
- Status as of 2026-10-02: ECA Digital is live; fines reach BRL 50 million or 10% of Brazilian revenue and a service can be suspended (secondary source)
- Status as of 2026-10-02: PL 2338 passed the Senate on 10 Dec 2024 and sat in a Chamber special committee awaiting the rapporteur's opinion with no vote scheduled as of mid-2026 (secondary source; unverified as of 2026-10-02 for later movement)
- Primary source: https://www25.senado.leg.br/web/atividade/materias/-/materia/157233 (PL 2338/2023 Senate record)
- Primary source: https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/L15211.htm (not fetched: connection reset)
- Secondary source: https://www.mayerbrown.com/ja/insights/publications/2026/04/enforcement-of-brazils-eca-digital-introduces-new-obligations-for-companies

### China: PIPL and cross-border data transfers

- Jurisdiction: China (processing in China; also processing abroad to provide services to people in China or analyse their behaviour)
- Covers: PIPL needs a legal basis (separate consent for sensitive data and for cross-border transfer), impact assessments and an overseas representative; export of personal data needs a CAC security assessment, a filed standard contract or a certification unless exempt
- Triggers: storing Chinese users' personal data on servers outside China; letting an overseas team or vendor access it; running analytics or an AI vendor abroad; exporting data of 100,000 or more people in a year
- Key dates: the March 2024 provisions (22 Mar 2024) exempt transfers needed for contracts or HR and low volumes; non-sensitive data of under 100,000 people a year needs no filing; 100,000 to under 1 million (or under 10,000 sensitive) needs a standard contract or certification; 1 million or more needs a security assessment (verified, secondary sources)
- Key dates: Compliance Audit Measures effective 1 May 2025 (a protection officer and a provincial filing above one million individuals); Certification Measures for cross-border transfer effective 1 Jan 2026 (verified, secondary sources)
- Status as of 2026-10-02: in force; "important data" has its own stricter export track and free trade zone negative lists can lift some requirements (secondary source)
- Primary source: https://www.cac.gov.cn/2024-03/22/c_1712776611775634.htm (Provisions on Promoting and Regulating Cross-Border Data Flows, in Chinese)
- Secondary source: https://www.aoshearman.com/en/insights/china-passes-provisions-to-relax-the-cross-border-data-transfer-regime (search result only, not fetched)
- Secondary source: https://www.arnoldporter.com/en/perspectives/advisories/2026/02/china-data-privacy-and-cybersecurity-2025-year-in-review (search result only, not fetched)

### China: AI rules (generative AI, labeling, algorithm filing, companions)

- Jurisdiction: China (services offered to the public in China)
- Covers: Interim Measures for Generative AI Services (lawful training data, content duties, a security assessment and algorithm filing for services with public opinion attributes); the AI-generated content labeling measures need visible labels and embedded metadata labels and make app stores ask whether an app provides generative AI; the Interim Measures for Anthropomorphic AI Interaction Services regulate emotional companion features
- Triggers: shipping a chatbot or image generator to users in China; publishing an app with generative features to a Chinese app store; an AI companion or character feature; training on Chinese user content
- Key dates: generative AI measures effective 15 Aug 2023; labeling measures effective 1 Sep 2025; anthropomorphic AI measures issued 10 Apr 2026 and effective 15 Jul 2026 (verified, secondary sources)
- Status as of 2026-10-02: the anthropomorphic measures bar virtual intimate relationships for minors and need guardian consent under 14 plus anti-addiction features; a security assessment applies at launch and above 1 million registered or 100,000 monthly active users (secondary source)
- Status as of 2026-10-02: algorithm filing with the CAC applies within 10 business days of launch for recommendation and similar algorithms (secondary source)
- Status as of 2026-10-02: there is no comprehensive Chinese AI statute (unverified as of 2026-10-02)
- Primary source: https://www.cac.gov.cn/2025-03/14/c_1743654685896173.htm (AI-generated content labeling measures, in Chinese)
- Primary source: official CAC pages for the generative AI measures and the anthropomorphic AI measures were not located (not fetched)
- Secondary source: https://www.hlc.com/en/publications/chinas-interim-measures-for-the-administration-of-anthropomorphic-ai-interaction-services (search result only, not fetched)
- Secondary source: https://www.mofo.com/resources/insights/230724-china-interim-measures-governing-generative-ai (search result only, not fetched)

### China: Cybersecurity Law amendment and Network Data Security Regulations

- Jurisdiction: China
- Covers: the amended Cybersecurity Law adds an AI governance article and raises penalties for data and cross-border violations; the Network Data Security Management Regulations add duties for processors of over 10 million individuals' personal information (security body and officer, treated as important data handlers) and for platform providers
- Triggers: operating a large Chinese user base; platform features that process user content; incident handling without a reporting path to Chinese regulators
- Key dates: Network Data Security Regulations effective 1 Jan 2025; Cybersecurity Law amendment adopted 28 Oct 2025 and effective 1 Jan 2026 (verified, secondary sources)
- Status as of 2026-10-02: in force; fines in the worst cases reach RMB 10 million (secondary source)
- Primary source: https://www.cac.gov.cn/2025-10/29/c_1763461514768457.htm (NPC Standing Committee decision amending the Cybersecurity Law, in Chinese)
- Primary source: the official text of the Network Data Security Management Regulations was not located (not fetched; two guessed gov.cn URLs returned 404)
- Secondary source: https://www.china-briefing.com/news/china-issues-new-regulations-on-network-data-security-management-effective-january-1-2025 (search result only, not fetched)
- Secondary source: https://www.reedsmith.com/en/perspectives/2025/11/china-approves-major-amendments-to-cybersecurity-law (search result only, not fetched)

### India: DPDP Act and Rules

- Jurisdiction: India (processing in India; processing abroad to offer goods or services to people in India)
- Covers: the Digital Personal Data Protection Act 2023 and the DPDP Rules 2025 require itemised plain-language notice, consent that can be withdrawn as easily as given, verifiable parental consent for under-18s with no tracking or targeted ads to children, 72-hour breach reporting, erasure on withdrawal and extra duties for significant data fiduciaries; consent managers register with the Data Protection Board
- Triggers: any app with Indian users; collecting data from under-18s; behavioural ads to minors; keeping data after consent is withdrawn
- Key dates: Rules notified 13 Nov 2025; Board provisions in force 14 Nov 2025; consent manager rule (Rule 4) from 13 Nov 2026; remaining obligations from 13 or 14 May 2027 (sources differ by a day) (verified, secondary sources)
- Status as of 2026-10-02: no change to those dates found; penalties reach INR 250 crore per instance (secondary source)
- Status as of 2026-10-02: transfers abroad are allowed unless the government restricts a country by notification, with the Rules letting government set conditions and sectoral localisation rules still applying (secondary source; unverified as of 2026-10-02 for any country restriction)
- Primary source: https://static.pib.gov.in/WriteReadData/specificdocs/documents/2025/nov/doc20251117695301.pdf (PIB document on the Rules; commencement dates are in linked material, not in the fetched text)
- Primary source: https://www.meity.gov.in/data-protection-framework (not fetched: HTTP 403)
- Secondary source: https://www.mondaq.com/dpdp-act-and-rules-2025-the-2026-compliance-milestones-businesses-cant-afford-to-miss/1830402

### India: IT Rules amendment on synthetic content

- Jurisdiction: India (intermediaries and platforms that enable creating or sharing synthetic media)
- Covers: the 2026 amendments to the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules define synthetically generated information, require prominent labels and persistent metadata where technically feasible, ban removal of those markers and cut takedown time for flagged unlawful content to three hours
- Triggers: shipping an image, video or voice generator in India; letting users post AI media; slow moderation workflows
- Key dates: notified 10 Feb 2026 and effective 20 Feb 2026 (verified, secondary sources)
- Status as of 2026-10-02: in force; some reports say platforms were given time to integrate labeling technology (secondary source; unverified as of 2026-10-02 for the exact grace terms)
- Primary source: https://www.meity.gov.in/static/uploads/2026/02/550681ab908f8afb135b0ad42816a1c9.pdf (not fetched: HTTP 403; URL taken from a law-firm alert)
- Secondary source: https://ssrana.in/articles/government-notifies-information-technology-amendment-rules-2026/

### Japan: APPI amendment and AI Promotion Act

- Jurisdiction: Japan (foreign businesses handling personal information of people in Japan to supply goods or services)
- Covers: the 2026 amendment adds administrative surcharges tied to the gain from serious violations, guardian consent and notice for under-16s, a best-interests duty for children, biometric data rules and a consent exemption for statistical analysis that includes AI development; the AI Promotion Act is a promotion law with no direct fines
- Triggers: collecting data from Japanese teenagers; training models on Japanese personal data; sharing data with third parties for statistics or AI
- Key dates: bill approved by Cabinet 7 Apr 2026; passed the Diet 10 Jul 2026; promulgated 17 Jul 2026 as Act No. 56 of 2026 (verified, secondary sources)
- Key dates: effective within two years of promulgation with surcharges expected by July 2028 (secondary source; implementing rules pending)
- Status as of 2026-10-02: the current APPI still governs and the new rules are not yet live; the AI Basic Plan was published 23 Dec 2025 (secondary source)
- Status as of 2026-10-02: the AI Promotion Act in-force date and its duties were not re-checked (unverified as of 2026-10-02)
- Primary source: https://www.ppc.go.jp/en/legal/ (PPC page linking the English APPI; fetched text is the consolidated version as of 1 Apr 2023 and predates the 2026 amendment)
- Primary source: https://www.japaneselawtranslation.go.jp/en/laws/view/4241 (APPI English translation, amendments through Act No. 37 of 2021)
- Secondary source: https://www.bakermckenzie.com/en/insight/publications/2026/05/japan-appi-reform-key-changes
- Secondary source: https://www.aoshearman.com/en/insights/ao-shearman-on-data/amendments-to-the-act-on-the-protection-of-personal-information-promulgated (search result only, not fetched; PwC Japan page returned 403)

### South Korea: PIPA

- Jurisdiction: South Korea (foreign operators handling Koreans' data)
- Covers: Personal Information Protection Act needs consent or another basis, separate consent for sensitive data and cross-border transfer disclosure; the March 2026 amendment lifts the surcharge cap from 3% to 10% of revenue for repeat or intentional violations, breaches affecting 10 million or more people and ignored corrective orders
- Triggers: a breach of a large Korean user base; transferring Korean data abroad; ignoring a regulator order; lacking a domestic representative above the thresholds
- Key dates: amended 10 Mar 2026 with most provisions effective 11 Sep 2026 (secondary source)
- Key dates: a foreign operator needs a domestic representative above KRW 1 trillion revenue or 1 million daily Korean users (secondary source)
- Status as of 2026-10-02: the 10% tier is live as of 11 Sep 2026 per that source (verified, secondary source; check the effective-date text)
- Primary source: the official text of the March 2026 PIPA amendment was not located (not fetched)
- Secondary source: https://www.yulchon.com/en/resources/publications/newsletter-view/45132/page.do (search result only, not fetched)
- Secondary source: https://www.koreajoongangdaily.com/business/companies-to-be-fined-up-to-10-of-total-revenue-after-data-leaks-under-revised-protection-law/12600153 (search result only, not fetched)

### South Korea: AI Basic Act

- Jurisdiction: South Korea (extraterritorial for AI affecting Korean users)
- Covers: duties for high-impact AI (risk management and human oversight), advance notice that AI is used, labeling and watermarks on generative output that is hard to tell from human work and a domestic representative for foreign operators above thresholds
- Triggers: shipping a generative AI feature to users in Korea; AI in hiring or lending or health or critical infrastructure; deepfake-capable features
- Key dates: effective 22 Jan 2026 (verified, secondary sources)
- Status as of 2026-10-02: administrative fines up to KRW 30 million are held off until 22 Jan 2027 but corrective orders and investigations are not (secondary source)
- Status as of 2026-10-02: the representative threshold is KRW 1 trillion revenue or KRW 10 billion AI revenue or 1 million daily users (secondary source)
- Primary source: https://elaw.klri.re.kr/eng_service/lawViewContent.do?hseq=73499 (English text; enters into force one year after promulgation)
- Secondary source: https://www.cooley.com/news/insight/2026/2026-01-27-south-koreas-ai-basic-act-overview-and-key-takeaways (search result only, not fetched)

### Australia: Privacy Act reforms and the Children's Online Privacy Code

- Jurisdiction: Australia (entities with an Australian link)
- Covers: the Privacy and Other Legislation Amendment Act 2024 added a statutory tort for serious privacy invasions, automated decision disclosure in privacy policies and a children's online privacy code
- Triggers: a consumer app with Australian children; automated decisions that significantly affect people; surveillance-like features
- Key dates: statutory tort from 10 Jun 2025 (secondary source)
- Key dates: automated decision transparency from 10 Dec 2026 (secondary source)
- Key dates: the OAIC must finalise and register the Children's Online Privacy Code by 10 Dec 2026 (verified on the OAIC page)
- Status as of 2026-10-02: the code is still in development after consultation ending June 2026 and covers social media and other online services likely accessed by children
- Primary source: https://www.oaic.gov.au/privacy/privacy-registers/privacy-codes/childrens-online-privacy-code
- Primary source: https://www.legislation.gov.au/C2024A00128/latest/text (Privacy and Other Legislation Amendment Act 2024)
- Secondary source: https://www.minterellison.com/articles/oaics-childrens-online-privacy-code-what-to-expect (search result only, not fetched)

### Australia: social media minimum age and the Spam Act

- Jurisdiction: Australia
- Covers: the Online Safety Amendment (Social Media Minimum Age) requires age-restricted social media platforms to take reasonable steps to stop under-16s holding accounts; messaging, email, calls, online games, education and health services are generally exempt; the Spam Act 2003 requires consent, sender identification and an unsubscribe on commercial electronic messages
- Triggers: an app that lets under-16 Australians hold accounts; a social feature added to a game; marketing email or SMS to Australians
- Key dates: ban effective 10 Dec 2025 with civil penalties up to AUD 49.5 million (verified, secondary sources)
- Status as of 2026-10-02: eSafety lists Facebook, Instagram, Threads, Snapchat, TikTok, YouTube, X, Reddit, Twitch and Kick and is investigating suspected non-compliance at five of them (secondary source)
- Status as of 2026-10-02: the government announced a plan to double the fine to AUD 99 million; passage is unverified as of 2026-10-02
- Status as of 2026-10-02: Spam Act obligations are long-standing (statutory text, not re-fetched; unverified as of 2026-10-02 for current penalty figures)
- Primary source: https://www.legislation.gov.au/C2024A00127/latest/text (Online Safety Amendment (Social Media Minimum Age) Act 2024)
- Primary source: https://www.legislation.gov.au/C2021A00076/latest/text (Online Safety Act 2021)
- Primary source: https://www.legislation.gov.au/C2004A01214/latest/text (Spam Act 2003)
- Primary source: https://www.esafety.gov.au/about-us/industry-regulation/social-media-minimum-age (not fetched: timeout)
- Secondary source: https://mccullough.com.au/2025/12/10/australias-social-media-ban-under-16/ (search result only, not fetched)
- Secondary source: https://www.cyberdaily.au/culture/13821-australia-doubles-social-media-ban-fines-as-esafety-gets-greater-powers (search result only, not fetched)

### Switzerland: revised FADP

- Jurisdiction: Switzerland (also acts abroad that affect people in Switzerland)
- Covers: the Federal Act on Data Protection needs transparent processing, a record of processing for larger firms, impact assessments for high risk, breach notice to the FDPIC and a Swiss representative for some foreign controllers; individuals can face fines up to CHF 250,000
- Triggers: Swiss users; sending Swiss data abroad without an adequacy basis; large-scale profiling
- Key dates: in force 1 Sep 2023 with no transition period; last amended 7 Jul 2025 (secondary source)
- Status as of 2026-10-02: the EU recognises Swiss adequacy; Switzerland plans to ratify the Council of Europe AI Convention with sector-specific rules and a draft bill expected by the end of 2026 (secondary source)
- Primary source: https://www.edoeb.admin.ch/edoeb/en/home/datenschutz/international/angemessenheit.html (FDPIC page on FADP adequacy)
- Primary source: https://www.fedlex.admin.ch/eli/cc/2022/491/en (not fetched: page needs JavaScript)
- Secondary source: https://www.legal500.com/guides/chapter/switzerland-artificial-intelligence/ (search result only, not fetched)

### Singapore: PDPA and AI governance

- Jurisdiction: Singapore (organisations collecting or using data of people in Singapore)
- Covers: PDPA consent, notification, purpose limitation, data breach notification and a DPO; AI governance is voluntary guidance from IMDA and the PDPC
- Triggers: using Singapore users' data to train a model; shipping an autonomous AI agent; failing to report a notifiable breach
- Key dates: IMDA Model AI Governance Framework for Agentic AI published 22 Jan 2026 and updated 20 May 2026 (secondary sources)
- Status as of 2026-10-02: no binding AI statute; PDPC guidance on personal data in model training applies under the PDPA (secondary source)
- Status as of 2026-10-02: specific PDPA fine levels and any 2026 amendment were not checked (unverified as of 2026-10-02)
- Primary source: https://www.pdpc.gov.sg/overview-of-pdpa/the-legislation/personal-data-protection-act (PDPC page on the PDPA)
- Primary source: https://sso.agc.gov.sg/Act/PDPA2012 (not fetched: HTTP 403)
- Secondary source: https://www.klgates.com/Singapores-New-Model-AI-Governance-Framework-for-Agentic-AI-2026-Client-Alert-2-9-2026 (search result only, not fetched)

### Vietnam: Personal Data Protection Law, Decree 356 and AI Law

- Jurisdiction: Vietnam (foreign organisations included)
- Covers: the Personal Data Protection Law and Decree 356/2025/ND-CP require processing and cross-border transfer impact assessments filed with the authority; the Law on Artificial Intelligence (No. 134/2025/QH15) sets risk-based duties
- Triggers: storing or moving Vietnamese users' data abroad; launching an AI feature in Vietnam; collecting sensitive data
- Key dates: data protection law and Decree 356 effective 1 Jan 2026 (verified, secondary sources)
- Key dates: AI Law effective 1 Mar 2026 with grace to 1 Mar 2027 (and to 1 Sep 2027 for health or education or finance) for existing systems (secondary source)
- Status as of 2026-10-02: small enterprises and startups get a five-year grace from 1 Jan 2026 for some duties; the authority decides on a transfer dossier within 15 days (secondary source)
- Primary source: https://english.luatvietnam.vn/decree-no-356-2025-nd-cp-dated-december-31-2025-of-the-government-detailing-a-number-of-articles-and-measures-for-the-implementation-of-the-law-on-p-422896-doc1.html (unofficial English translation of Decree 356)
- Primary source: the official gazette text of the AI Law (No. 134/2025/QH15) was not located (not fetched)
- Secondary source: https://www.tilleke.com/insights/new-decree-provides-guidance-for-vietnams-personal-data-protection-law (search result only, not fetched)
- Secondary source: https://www.bakermckenzie.com/en/insight/publications/2026/02/vietnam-artificial-intelligence-law-foundation-and-outlook (search result only, not fetched)

### Other regimes worth a check

- Jurisdiction: Turkey, Saudi Arabia, UAE, South Africa, Israel, Indonesia and New Zealand
- Covers: Turkey KVKK (standard contracts for transfers must be notified to the authority within five working days; the March 2024 reform created this); Saudi PDPL (August 2024 transfer regulation with adequacy, safeguards and transfer risk assessment); UAE PDPL (Federal Decree-Law 45 of 2021); South Africa POPIA (regulations amended 17 Apr 2025 on rights and direct marketing consent); Israel Amendment 13 (in force 14 Aug 2025 with DPO duties for some organisations enforced from 31 Oct 2025); Indonesia PDP Law (Government Regulation 33 of 2026 promulgated 16 Jul 2026 with sanctions from 16 Jan 2027); New Zealand IPP 3A (notice when collecting data indirectly)
- Triggers: sending Turkish or Saudi data to a foreign cloud without the transfer paperwork; indirect collection of New Zealand data such as bought leads; a large-scale data business in Israel; Indonesian users once the agency starts
- Key dates: New Zealand IPP 3A in force 1 May 2026 (secondary source)
- Status as of 2026-10-02: UAE PDPL executive regulations are reported as both issued and pending; sources conflict (unverified as of 2026-10-02)
- Status as of 2026-10-02: Indonesia's data protection agency is expected to start in 2026 or 2027 (secondary source)
- Primary source: https://www.privacy.org.nz/resources-and-learning/a-z-topics/ipp3a/ (New Zealand IPP 3A)
- Primary source: http://www.kvkk.gov.tr/en (Turkey KVKK; links to Law 6698 and the standard contract notification module)
- Primary source: https://inforegulator.org.za/popia/ (South Africa POPIA)
- Primary source: SDAIA Saudi PDPL transfer regulation, Israel Amendment 13 and the UAE PDPL pages were not fetched (SDAIA request rejected; gov.il HTTP 403; UAE and Indonesia official pages not located)
- Secondary source: https://thelens.slaughterandmay.com/post/102jxqd/navigating-turkiyes-updated-international-data-transfer-rules-what-you-need-to (search result only, not fetched)
- Secondary source: https://www.rajahtannasia.com/viewpoints/pdp-law-updates-the-pdp-implementing-regulation-is-out-and-it-clarifies-some-key-questions-under-indonesias-pdp-law/ (search result only, not fetched)
- Secondary source: https://www.pearlcohen.com/major-amendment-to-israeli-privacy-law-set-to-take-effect/ (search result only, not fetched)

### Picking the regimes that apply

- Start with three lists: where your users are, where your company and staff are and where data is stored or accessed.
- A user-location trigger ("offering goods or services to" or "monitoring behaviour") usually applies regardless of where you are incorporated.
- China, India, Vietnam, Brazil, Korea and Turkey all reach foreign providers serving their residents.
- Storage and vendor location add transfer rules: China, Vietnam, Brazil, Turkey and Saudi Arabia attach paperwork to sending data out.
- Company location adds home-country rules and a registered presence (Korea and Switzerland representatives; Chinese entities) at some thresholds.
- Children's rules key on likely access by minors and not on your target market; check Australia, Brazil, Canada, China and India for any consumer app.
- AI rules key on where output is used: Korea, China, Vietnam and India labeling apply to generated content reaching their users.
- Re-check each date above before launch; several are 2026 to 2027 and sources differ.

## User content and platforms

### Section 230 for apps hosting user content and AI output

- Jurisdiction: US federal (47 U.S.C. 230) and state tort and product liability law
- Covers: protects a service from being treated as the publisher of content provided by others; does not cover the service's own content or federal criminal law and intellectual property claims
- Triggers: letting users upload files or posts that others can see; ranking or recommending user content with an algorithm; shipping a chatbot whose output could injure a user; building features like infinite scroll or autoplay aimed at minors
- Key dates: enacted 1996; no amendment in force
- Status as of 2026-10-02: plaintiffs now win by pleading defective design (infinite scroll, autoplay, notifications) rather than content; a Los Angeles jury returned a USD 6 million verdict against social media defendants in March 2026 (verified, secondary source)
- Status as of 2026-10-02: Senators Durbin and Graham introduced a Sunset Section 230 Act that would repeal the law two years after enactment; it has not passed (verified, secondary source)
- Status as of 2026-10-02: in Garcia v. Character Technologies (M.D. Fla. 2025) the court declined to dismiss on 230 or First Amendment grounds at the pleading stage and treated chatbot output as the company's own product; no appellate ruling on 230 and generative output was found (verified, secondary source)
- Primary source: https://www.law.cornell.edu/uscode/text/47/230
- Secondary source: https://rollcall.com/2026/04/20/social-media-verdicts-could-buoy-online-regulatory-bills/
- Secondary source: https://www.softwareseni.com/beyond-section-230-why-ai-chatbots-face-product-liability-instead-of-platform-immunity/

### DMCA 512 safe harbors (notice-and-takedown, designated agent, repeat infringers)

- Jurisdiction: US federal (17 U.S.C. 512)
- Covers: hosting services avoid monetary liability for user-uploaded infringing material if they register a designated agent with the Copyright Office, act on valid takedown notices, offer counter-notice and adopt and enforce a repeat infringer policy
- Triggers: any feature that stores user uploads, images, repositories, comments or generated files that other people can see; accepting takedown emails with no process
- Key dates: a designation expires and becomes invalid three years after it is registered unless renewed (verified, 37 CFR 201.38(c)(4))
- Status as of 2026-10-02: a lapsed designation is shown as terminated in the Copyright Office directory and the safe harbor is lost for the gap (verified, secondary source)
- Status as of 2026-10-02: Copyright Office fee and directory details were not re-fetched (unverified as of 2026-10-02)
- Primary source: https://www.copyright.gov/title37/201/37cfr201-38.html
- Secondary source: https://www.zwillgen.com/general/time-re-register-dmca-agent

## App stores and platform terms

### Apple App Store review rules that block launches

- Jurisdiction: contract (Apple developer terms) with state law overlays
- Covers: Guideline 5.1.1(v) requires in-app account deletion when the app supports account creation; 5.1.2 requires App Tracking Transparency permission before tracking; privacy manifests with approved reasons are required for listed "required reason" APIs and listed third-party SDKs need a manifest and a signature; privacy nutrition labels must match actual data use; age rating questions must be answered honestly
- Triggers: an iOS app that creates accounts; adding an ad or analytics SDK; reading file timestamps or user defaults APIs; adding a third-party SDK from Apple's list as a binary
- Key dates: required reason API declarations enforced from 1 May 2024 (secondary source)
- Key dates: Xcode 26 and iOS 26 SDK required for uploads from 28 Apr 2026 (verified, developer.apple.com)
- Key dates: updated age rating answers (new 13+, 16+ and 18+ tiers) were due 31 Jan 2026 (verified, developer.apple.com)
- Key dates: uploads must target iOS 13 or later from 9 Sep 2026 (verified, developer.apple.com)
- Status as of 2026-10-02: in the US storefront apps may link to external purchase options without an entitlement (verified, guidelines text)
- Status as of 2026-10-02: Epic v. Apple: the Ninth Circuit in Dec 2025 upheld the contempt finding but let Apple seek a fee tied to costs genuinely and reasonably necessary; the Supreme Court denied a stay in May 2026 and took Apple's contempt appeal for its term that starts in October; the remand on the fee is open (verified, secondary source)
- Status as of 2026-10-02: Texas app store age law is live; see the app store age verification entry above
- Primary source: https://developer.apple.com/app-store/review/guidelines/
- Primary source: https://developer.apple.com/news/upcoming-requirements/
- Secondary source: https://developer.apple.com/forums/thread/748765 (privacy manifests and required reason APIs; the guidelines page fetched did not mention them)
- Secondary source: https://courthousenews.com/apples-fight-over-commissions-for-linked-out-app-store-purchases-continues-in-federal-court/
- Secondary source: https://thenextweb.com/news/supreme-court-apple-epic-contempt-stay-denial

### Google Play policies and Android developer verification

- Jurisdiction: contract (Play developer policies) with state law overlays
- Covers: the Data safety form must match real data use; apps with account creation need in-app and web account deletion links; target API level minimums apply to new apps and updates; age and content ratings are required; Android developer verification ties app installs on certified devices to a verified developer
- Triggers: publishing an Android app or an update after the target API deadline; changing SDKs without updating the Data safety form; shipping accounts without a web deletion URL
- Key dates: new apps and updates must target Android 16 (API 36) from 31 Aug 2026 with a one-time extension to 1 Nov 2026 on request (verified, developer.android.com)
- Key dates: existing apps must target API 35 to stay visible to new users on newer devices (verified, developer.android.com)
- Key dates: developer verification enforcement starts 30 Sep 2026 in Brazil, Indonesia, Singapore and Thailand with a global rollout in 2027 (verified, developer.android.com)
- Status as of 2026-10-02: Data safety deletion questions date from 2023 and 2024 (secondary source; current Play wording not re-fetched, unverified as of 2026-10-02)
- Primary source: https://developer.android.com/google/play/requirements/target-sdk
- Primary source: https://developer.android.com/developer-verification/guides
- Secondary source: https://www.androidauthority.com/google-play-data-safety-3309792/ (Data safety deletion questions)

## Team IP and contributions

### Work made for hire, invention assignment and California Labor Code 2870

- Jurisdiction: US federal copyright and patent law plus state employment statutes
- Covers: code written by an employee within the scope of employment is a work made for hire; code written by a contractor is only a work made for hire if it fits the nine categories in 17 U.S.C. 101 and a signed writing says so (most software does not) so a written assignment is needed; California Labor Code 2870 makes unenforceable any assignment of an invention developed entirely on the employee's own time without employer equipment or trade secrets unless it relates to the employer's business or results from work for the employer
- Triggers: hiring a contractor to write core code without a written assignment; an employee side project in a related field; copying an employee agreement from another state; accepting code from a freelancer who used their own templates
- Key dates: Labor Code 2870 text verified on leginfo, with the on-own-time carve-out and the unenforceability clause as described; similar statutes exist in Washington (RCW 49.44.140), Illinois (765 ILCS 1060/2), Delaware (19 Del. C. 805), Kansas, Minnesota, North Carolina and Utah (secondary source)
- Status as of 2026-10-02: California requires written notice of the 2870 limit to employees (Labor Code 2872; text not fetched, unverified as of 2026-10-02)
- Status as of 2026-10-02: the 2870-style statutes also bar blanket assignments of unrelated inventions so a one-size agreement may be partly void (secondary source)
- Primary source: https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=LAB&sectionNum=2870
- Secondary source: https://www.fisherphillips.com/Non-Compete-and-Trade-Secrets/Statutory-Requirements-for-Invention-Assignment-Provisions (other states; statutes not fetched)

### Open-source contributions (CLA or DCO) and hiring limits

- Jurisdiction: contract and state employment law
- Covers: a CLA is a signed contract that can give the project broad rights (including relicensing); the DCO is a per-commit "Signed-off-by" attestation under an inbound-equals-outbound model; the FTC noncompete rule was vacated in Aug 2024 and the FTC dropped its appeal. Noncompetes are governed by state law; California Business & Professions Code 16600 voids most employee noncompetes
- Triggers: accepting outside pull requests to a project you may later relicense; accepting AI-assisted commits; hiring a California employee from a competitor under an out-of-state noncompete; asking a California hire to sign a noncompete
- Key dates: Fifth Circuit dismissed the FTC appeal 8 Sep 2025 (secondary source)
- Key dates: California 16600 voids a contract restraining a lawful profession, trade or business "to that extent" (verified, leginfo)
- Status as of 2026-10-02: a trend away from CLAs to DCO continues, for example ownCloud in May 2026 (secondary source)
- Status as of 2026-10-02: the Linux kernel policy says an AI tool must not add Signed-off-by and a human certifies the DCO (secondary source)
- Status as of 2026-10-02: California 16600.5 (hiring from out-of-state employers) was not re-fetched (unverified as of 2026-10-02)
- Primary source: https://bestpractices.linuxfoundation.org/ip/contribution-mechanisms.html
- Primary source: https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=16600
- Secondary source: https://www.ftc.gov/node/297790 (not fetched)
- Secondary source: https://owncloud.com/blogs/we-killed-our-own-cla-heres-why-thats-a-good-thing/
- Secondary source: https://texxr.com/posts/the-standard-linux-kernel-ai-code

### US software patents: Alice, section 101 and AI-assisted inventions

- Jurisdiction: US federal (USPTO and Federal Circuit)
- Covers: abstract-idea software claims face Alice step-one and step-two rejection; only natural persons can be inventors
- Triggers: filing a software patent on a model or workflow; using an AI tool to help conceive an invention; relying on a patent to block a competitor
- Key dates: USPTO page lists an advance notice of MPEP change for Ex parte Desjardins (5 Dec 2025) and section 101 reminders (4 Aug 2025) (verified, uspto.gov)
- Key dates: Desjardins designated precedential 4 Nov 2025 and revised AI-assisted inventorship guidance issued 28 Nov 2025 (secondary source)
- Key dates: the same page lists subject matter eligibility declaration memos of 4 Dec 2025 and 30 Apr 2026 and a further memo dated 29 Sep 2026 (verified, uspto.gov; memo contents not read)
- Status as of 2026-10-02: Alice itself is unchanged; USPTO examiners now treat machine-learning improvements more favourably per Desjardins (secondary source; later 2026 changes not checked, unverified as of 2026-10-02)
- Primary source: https://www.uspto.gov/patents/laws/examination-policy/subject-matter-eligibility
- Secondary source: https://www.jdsupra.com/topics/patents/artificial-intelligence/uspto

## Cross-cutting items teams trip over

- The Digital Omnibus on AI is law and delays high-risk duties. The data omnibus (GDPR and ePrivacy changes) is not.
- App store age laws moved a lot in 2026: Utah and Louisiana slipped to 2027 while Texas went live. Check each state's current date.
- Many 2026 state laws are in court. Re-check an injunction before treating a state duty as live or dead.
- A model-provider term can be stricter than the law. Read it before choosing a provider for regulated use.
- California SB 690 (Chapter 976, Statutes of 2026) leaves pen-register claims against websites and apps to the Attorney General. Section 631 wiretap claims over session replay, chat widgets and pixels stay live.
- Several AI regimes outside the EU are already live: Korea's AI Basic Act (22 Jan 2026), China's AI content labeling measures (1 Sep 2025), India's IT Rules labeling amendment (20 Feb 2026) and Vietnam's AI Law (1 Mar 2026).
- Canada's C-36 is only a bill. PIPEDA still governs federally and Quebec Law 25 applies in full.
- The UK subscription contracts regime is reported for January 2027 but the official text still says spring 2027. Design for it now.
- NIS2 is transposed in most member states. EU customers in covered sectors will push its supply-chain duties into SaaS contracts.
- App store rules move faster than statutes: Android developer verification started 30 Sep 2026 in four countries and Apple's external-link rules are still in litigation.
- Anything not marked verified in this file needs a primary-source check before it drives a decision.
