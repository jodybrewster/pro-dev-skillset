import { Reveal } from "@/components/Reveal";
import {
  PHASES,
  PLUGINS,
  BRIDGES,
  USE_CASES,
  INSTALL_STEPS,
} from "@/components/data";

const GITHUB = "https://github.com/jodybrewster/pro-dev-skillset";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Lifecycle />
        <Plugins />
        <Bridges />
        <UseCases />
        <Install />
      </main>
      <Footer />
    </>
  );
}

/* ── Nav ─────────────────────────────────────────────────────────────────── */
function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-bg/80 backdrop-blur">
      <nav className="mx-auto flex max-w-content items-center justify-between px-6 py-4">
        <a href="#main" className="flex items-center gap-2 font-mono text-sm font-semibold">
          <Logo />
          <span>pro-dev-skillset</span>
        </a>
        <div className="hidden items-center gap-8 text-sm text-muted sm:flex">
          <a className="transition-colors hover:text-ink" href="#lifecycle">Lifecycle</a>
          <a className="transition-colors hover:text-ink" href="#plugins">Plugins</a>
          <a className="transition-colors hover:text-ink" href="#install">Install</a>
        </div>
        <a
          href={GITHUB}
          className="rounded-lg border border-border bg-elevated px-4 py-2 text-sm font-medium transition-colors hover:border-accent/60 hover:text-accent"
        >
          GitHub →
        </a>
      </nav>
    </header>
  );
}

/* ── Hero ────────────────────────────────────────────────────────────────── */
function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-12rem] h-[36rem] w-[60rem] -translate-x-1/2 animate-pulse-glow rounded-full bg-accent/20 blur-[120px]"
      />
      <div className="mx-auto max-w-content px-6 pb-24 pt-24 text-center sm:pt-32">
        <Reveal>
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-medium text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-2" />
            For Claude Code &amp; OpenAI Codex
          </span>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="mx-auto mt-8 max-w-3xl text-balance text-5xl font-bold leading-[1.05] tracking-tight sm:text-7xl">
            One install. Your <span className="text-gradient">entire dev lifecycle</span>.
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted">
            A portable skill marketplace that maps every task to the right phase and
            skill — from first idea to ship. Install once; it works in every repo.
          </p>
        </Reveal>
        <Reveal delay={240}>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#install"
              className="rounded-xl bg-accent px-6 py-3 font-semibold text-bg transition-transform hover:scale-[1.03]"
            >
              Install in 2 commands
            </a>
            <a
              href={GITHUB}
              className="rounded-xl border border-border bg-surface px-6 py-3 font-semibold transition-colors hover:border-accent/60"
            >
              View source
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Lifecycle ───────────────────────────────────────────────────────────── */
function Lifecycle() {
  return (
    <Section id="lifecycle" eyebrow="The map" title="Eight phases, one router">
      <p className="mx-auto mb-14 max-w-2xl text-center text-muted">
        The <span className="font-mono text-ink">using-pro-dev</span> skill routes
        an incoming task to the right phase so you never wonder what to invoke next.
      </p>
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PHASES.map((phase, i) => (
          <Reveal key={phase.name} delay={i * 50}>
            <li className="group h-full rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/50">
              <div className="font-mono text-xs text-accent-2">{String(i + 1).padStart(2, "0")}</div>
              <div className="mt-2 text-lg font-semibold">{phase.name}</div>
              <div className="mt-1 text-sm text-muted">{phase.tagline}</div>
              <div className="mt-4 truncate font-mono text-xs text-muted/80 group-hover:text-accent">
                {phase.skill}
              </div>
            </li>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}

/* ── Plugins ─────────────────────────────────────────────────────────────── */
function Plugins() {
  return (
    <Section id="plugins" eyebrow="What's inside" title="A plugin per concern">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLUGINS.map((plugin, i) => (
          <Reveal key={plugin.name} delay={(i % 4) * 60}>
            <article className="flex h-full flex-col rounded-xl border border-border bg-surface p-5 transition-colors hover:border-accent/50">
              <h3 className="font-mono text-sm font-semibold text-accent">{plugin.name}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{plugin.blurb}</p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {plugin.skills.map((s) => (
                  <li key={s} className="rounded-md bg-elevated px-2 py-1 font-mono text-[11px] text-muted">
                    {s}
                  </li>
                ))}
              </ul>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ── Bridges ─────────────────────────────────────────────────────────────── */
function Bridges() {
  return (
    <Section id="bridges" eyebrow="Bridges, not bloat" title="Heavy engines, installed on demand">
      <p className="mx-auto mb-14 max-w-2xl text-center text-muted">
        Some skills are thin routers to a bigger engine living outside the
        marketplace. They ship an install command and only do work once the
        engine is present — so the core install stays lean.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        {BRIDGES.map((bridge, i) => (
          <Reveal key={bridge.name} delay={i * 70}>
            <article className="h-full rounded-xl border border-border bg-surface p-6 transition-colors hover:border-accent-2/50">
              <div className="flex items-center gap-2 font-mono text-sm">
                <span className="text-ink">{bridge.name}</span>
                <span aria-hidden className="text-muted">→</span>
                <span className="text-accent-2">{bridge.engine}</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted">{bridge.blurb}</p>
              <code className="mt-4 inline-block rounded-md bg-elevated px-2.5 py-1 font-mono text-xs text-accent">
                {bridge.command}
              </code>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ── Use cases ───────────────────────────────────────────────────────────── */
function UseCases() {
  return (
    <Section id="use-cases" eyebrow="Two ways to drive it" title="Solo or with a client">
      <div className="grid gap-4 md:grid-cols-2">
        {USE_CASES.map((uc, i) => (
          <Reveal key={uc.title} delay={i * 80}>
            <article className="h-full rounded-2xl border border-border bg-surface p-7">
              <h3 className="text-xl font-semibold">{uc.title}</h3>
              <p className="mt-1 text-sm text-muted">{uc.who}</p>
              <ol className="mt-6 flex flex-wrap items-center gap-2 font-mono text-xs">
                {uc.path.map((step, j) => (
                  <li key={step} className="flex items-center gap-2">
                    <span className="rounded-md border border-border bg-elevated px-2.5 py-1.5 text-muted">
                      {step}
                    </span>
                    {j < uc.path.length - 1 && <span aria-hidden className="text-accent">→</span>}
                  </li>
                ))}
              </ol>
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* ── Install ─────────────────────────────────────────────────────────────── */
function Install() {
  return (
    <Section id="install" eyebrow="Get started" title="Two commands, every repo">
      <Reveal>
        <div className="mx-auto max-w-2xl overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="h-3 w-3 rounded-full bg-[#ff5f56]" />
            <span className="h-3 w-3 rounded-full bg-[#ffbd2e]" />
            <span className="h-3 w-3 rounded-full bg-[#27c93f]" />
            <span className="ml-2 font-mono text-xs text-muted">terminal</span>
          </div>
          <pre className="overflow-x-auto p-6 font-mono text-sm leading-loose">
            {INSTALL_STEPS.map((step) => (
              <div key={step}>
                <span className="select-none text-accent-2">$ </span>
                <span className="text-ink">{step}</span>
              </div>
            ))}
          </pre>
        </div>
      </Reveal>
      <p className="mt-6 text-center text-sm text-muted">
        Then run <span className="font-mono text-accent">/pro-dev-doctor</span> to
        verify the install and routing.
      </p>
    </Section>
  );
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-border/60">
      <div className="mx-auto flex max-w-content flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-muted sm:flex-row">
        <span className="flex items-center gap-2 font-mono">
          <Logo /> pro-dev-skillset
        </span>
        <span>Built live through the pro-dev lifecycle. MIT-forked skills, original glue.</span>
      </div>
    </footer>
  );
}

/* ── Shared bits ─────────────────────────────────────────────────────────── */
function Section({
  id,
  eyebrow,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="border-t border-border/40 py-24">
      <div className="mx-auto max-w-content px-6">
        <Reveal>
          <p className="text-center font-mono text-xs uppercase tracking-widest text-accent">{eyebrow}</p>
          <h2 className="mt-3 text-center text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
        </Reveal>
        <div className="mt-14">{children}</div>
      </div>
    </section>
  );
}

function Logo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="rgb(var(--accent))" />
      <path d="M7 12.5l3.2 3.2L17 9" stroke="rgb(var(--bg))" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
