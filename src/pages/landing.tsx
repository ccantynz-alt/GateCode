import { html } from "hono/html";
import type { Context } from "hono";
import type { Env } from "../types";

export const landingPage = async (c: Context<Env>) => {
  return c.html(
    html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GateCode — Gate your code.</title>
  <meta name="description" content="OAuth-style permission gateway for AI coding agents. Your AI asks, you approve, it codes. Real-time approvals, scoped tokens, audit logging." />
  <meta name="theme-color" content="#0a0a0f" />
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#x1f6e1;</text></svg>" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://gatecode.sh" />
  <meta property="og:title" content="GateCode — Gate your code." />
  <meta property="og:description" content="OAuth-style permission gateway for AI coding agents. Your AI asks, you approve, it codes." />
  <meta property="og:image" content="https://gatecode.sh/og.png" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="GateCode — Gate your code." />
  <meta name="twitter:description" content="OAuth-style permission gateway for AI coding agents. Real-time approvals, scoped tokens, audit logging." />
  <meta name="twitter:image" content="https://gatecode.sh/og.png" />
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg: #0a0a0f;
      --bg-card: #12121a;
      --bg-card-hover: #1a1a28;
      --border: #1e1e2e;
      --text: #e2e2f0;
      --text-dim: #8888a0;
      --blue: #3b82f6;
      --purple: #8b5cf6;
      --green: #22c55e;
      --red: #ef4444;
      --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --mono: 'SF Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace;
    }

    html { scroll-behavior: smooth; }

    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
    }

    a { color: var(--blue); text-decoration: none; }
    a:hover { text-decoration: underline; }

    /* ── Nav ────────────────────────────────────── */
    nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 2rem;
      background: rgba(10,10,15,.85);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
    }
    .nav-logo {
      font-size: 1.25rem; font-weight: 700; color: var(--text);
      letter-spacing: -.02em;
    }
    .nav-logo span { color: var(--blue); }
    .nav-links { display: flex; gap: 1.5rem; align-items: center; }
    .nav-links a { color: var(--text-dim); font-size: .9rem; transition: color .2s; }
    .nav-links a:hover { color: var(--text); text-decoration: none; }

    /* ── Hero ───────────────────────────────────── */
    .hero {
      min-height: 100vh;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center;
      padding: 6rem 1.5rem 4rem;
      position: relative;
      overflow: hidden;
    }
    .hero::before {
      content: '';
      position: absolute; top: -40%; left: 50%; transform: translateX(-50%);
      width: 800px; height: 800px;
      background: radial-gradient(circle, rgba(59,130,246,.12) 0%, rgba(139,92,246,.06) 40%, transparent 70%);
      pointer-events: none;
    }
    .hero h1 {
      font-size: clamp(3rem, 8vw, 6rem);
      font-weight: 800;
      letter-spacing: -.04em;
      line-height: 1;
      background: linear-gradient(135deg, #fff 0%, #a5b4fc 50%, var(--blue) 100%);
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
      animation: fadeUp .8s ease-out;
    }
    .hero .tagline {
      font-size: clamp(1.25rem, 3vw, 1.75rem);
      font-family: var(--mono);
      color: var(--purple);
      margin-top: .75rem;
      animation: fadeUp .8s ease-out .1s both;
    }
    .hero .subtext {
      max-width: 560px;
      font-size: 1.1rem;
      color: var(--text-dim);
      margin-top: 1.5rem;
      animation: fadeUp .8s ease-out .2s both;
    }
    .hero-buttons {
      display: flex; gap: 1rem; margin-top: 2.5rem; flex-wrap: wrap; justify-content: center;
      animation: fadeUp .8s ease-out .3s both;
    }
    .btn {
      display: inline-flex; align-items: center; gap: .5rem;
      padding: .8rem 1.75rem;
      border-radius: 8px;
      font-size: 1rem; font-weight: 600;
      border: none; cursor: pointer;
      transition: transform .15s, box-shadow .15s;
    }
    .btn:hover { transform: translateY(-1px); text-decoration: none; }
    .btn-primary {
      background: linear-gradient(135deg, var(--blue), var(--purple));
      color: #fff;
      box-shadow: 0 4px 24px rgba(59,130,246,.3);
    }
    .btn-primary:hover { box-shadow: 0 6px 32px rgba(59,130,246,.45); }
    .btn-secondary {
      background: transparent;
      color: var(--text);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover { border-color: var(--text-dim); }

    /* ── Terminal ───────────────────────────────── */
    .terminal-wrap {
      width: 100%; max-width: 640px;
      margin-top: 3rem;
      animation: fadeUp .8s ease-out .45s both;
    }
    .terminal {
      background: #0d0d14;
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 24px 64px rgba(0,0,0,.5);
    }
    .terminal-header {
      display: flex; align-items: center; gap: 6px;
      padding: .75rem 1rem;
      background: #111118;
      border-bottom: 1px solid var(--border);
    }
    .terminal-dot { width: 10px; height: 10px; border-radius: 50%; }
    .terminal-dot.r { background: #ff5f57; }
    .terminal-dot.y { background: #febc2e; }
    .terminal-dot.g { background: #28c840; }
    .terminal-body {
      padding: 1.25rem;
      font-family: var(--mono);
      font-size: .85rem;
      line-height: 1.9;
      color: var(--text-dim);
      overflow-x: auto;
    }
    .terminal-body .prompt { color: var(--green); }
    .terminal-body .cmd { color: var(--text); }
    .terminal-body .comment { color: #555570; }
    .terminal-body .highlight { color: var(--blue); }
    .terminal-body .success { color: var(--green); }
    .terminal-line {
      opacity: 0;
      animation: typeIn .4s ease-out forwards;
    }
    .terminal-line:nth-child(1) { animation-delay: .8s; }
    .terminal-line:nth-child(2) { animation-delay: 1.2s; }
    .terminal-line:nth-child(3) { animation-delay: 1.6s; }
    .terminal-line:nth-child(4) { animation-delay: 2.0s; }
    .terminal-line:nth-child(5) { animation-delay: 2.4s; }
    .terminal-line:nth-child(6) { animation-delay: 2.8s; }
    .terminal-line:nth-child(7) { animation-delay: 3.2s; }

    @keyframes typeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }

    /* ── Sections ───────────────────────────────── */
    section { padding: 5rem 1.5rem; }
    .section-inner { max-width: 1100px; margin: 0 auto; }
    .section-label {
      font-family: var(--mono);
      font-size: .8rem;
      text-transform: uppercase;
      letter-spacing: .15em;
      color: var(--purple);
      margin-bottom: .5rem;
    }
    .section-title {
      font-size: clamp(1.75rem, 4vw, 2.5rem);
      font-weight: 700;
      letter-spacing: -.03em;
      margin-bottom: 3rem;
    }

    /* ── How it works ──────────────────────────── */
    .steps {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 2rem;
    }
    .step {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2rem;
      transition: border-color .2s, transform .2s;
      opacity: 0;
      animation: fadeUp .6s ease-out forwards;
    }
    .step:nth-child(1) { animation-delay: .1s; }
    .step:nth-child(2) { animation-delay: .25s; }
    .step:nth-child(3) { animation-delay: .4s; }
    .step:hover { border-color: var(--blue); transform: translateY(-2px); }
    .step-icon { font-size: 2.5rem; margin-bottom: 1rem; }
    .step-num {
      font-family: var(--mono);
      font-size: .75rem;
      color: var(--blue);
      margin-bottom: .5rem;
    }
    .step h3 { font-size: 1.15rem; font-weight: 600; margin-bottom: .5rem; }
    .step p { color: var(--text-dim); font-size: .95rem; }

    /* ── Features ──────────────────────────────── */
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 1.25rem;
    }
    .feature {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.5rem;
      transition: border-color .2s, transform .2s;
      opacity: 0;
      animation: fadeUp .5s ease-out forwards;
    }
    .feature:nth-child(1) { animation-delay: .05s; }
    .feature:nth-child(2) { animation-delay: .1s; }
    .feature:nth-child(3) { animation-delay: .15s; }
    .feature:nth-child(4) { animation-delay: .2s; }
    .feature:nth-child(5) { animation-delay: .25s; }
    .feature:nth-child(6) { animation-delay: .3s; }
    .feature:hover { border-color: var(--purple); transform: translateY(-2px); }
    .feature-title { font-size: 1rem; font-weight: 600; margin-bottom: .35rem; }
    .feature-tag {
      display: inline-block;
      font-family: var(--mono);
      font-size: .7rem;
      padding: .15rem .5rem;
      border-radius: 4px;
      background: rgba(59,130,246,.15);
      color: var(--blue);
      margin-bottom: .5rem;
    }
    .feature p { color: var(--text-dim); font-size: .9rem; }

    /* ── Pricing ───────────────────────────────── */
    .pricing-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 1.5rem;
    }
    .price-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 2rem;
      display: flex; flex-direction: column;
      transition: border-color .3s, transform .3s;
      opacity: 0;
      animation: fadeUp .5s ease-out forwards;
    }
    .price-card:nth-child(1) { animation-delay: .05s; }
    .price-card:nth-child(2) { animation-delay: .15s; }
    .price-card:nth-child(3) { animation-delay: .25s; }
    .price-card:nth-child(4) { animation-delay: .35s; }
    .price-card:hover { border-color: var(--purple); transform: translateY(-3px); }
    .price-card.featured {
      border-color: var(--blue);
      box-shadow: 0 0 40px rgba(59,130,246,.1);
      position: relative;
    }
    .price-card.featured::before {
      content: 'Popular';
      position: absolute; top: -10px; right: 1.5rem;
      background: linear-gradient(135deg, var(--blue), var(--purple));
      color: #fff;
      font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .08em;
      padding: .25rem .75rem; border-radius: 4px;
    }
    .price-tier {
      font-family: var(--mono);
      font-size: .8rem;
      text-transform: uppercase;
      letter-spacing: .1em;
      color: var(--purple);
    }
    .price-amount {
      font-size: 2.5rem; font-weight: 800; margin: .5rem 0;
      letter-spacing: -.03em;
    }
    .price-amount span { font-size: 1rem; font-weight: 400; color: var(--text-dim); }
    .price-features {
      list-style: none;
      margin: 1.5rem 0;
      flex: 1;
    }
    .price-features li {
      padding: .35rem 0;
      font-size: .9rem;
      color: var(--text-dim);
    }
    .price-features li::before {
      content: '\u2713';
      color: var(--green);
      margin-right: .5rem;
      font-weight: 700;
    }
    .btn-price {
      display: block;
      text-align: center;
      padding: .75rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: .9rem;
      border: 1px solid var(--border);
      background: transparent;
      color: var(--text);
      cursor: pointer;
      transition: background .2s, border-color .2s;
    }
    .btn-price:hover { background: var(--bg-card-hover); border-color: var(--text-dim); text-decoration: none; }
    .btn-price.primary {
      background: linear-gradient(135deg, var(--blue), var(--purple));
      border: none;
      color: #fff;
    }
    .btn-price.primary:hover { box-shadow: 0 4px 20px rgba(59,130,246,.3); }
    .btn-price:disabled {
      opacity: .4;
      cursor: not-allowed;
    }
    .btn-price:disabled:hover {
      background: transparent;
      box-shadow: none;
    }

    /* ── Code examples ────────────────────────────── */
    .code-tabs {
      display: flex; gap: 0; border-bottom: 1px solid var(--border); margin-bottom: 0;
    }
    .code-tab {
      padding: .6rem 1.25rem; font-size: .85rem; font-family: var(--mono);
      color: var(--text-dim); cursor: pointer; border-bottom: 2px solid transparent;
      transition: all .15s;
    }
    .code-tab:hover { color: var(--text); }
    .code-tab.active { color: var(--blue); border-bottom-color: var(--blue); }
    .code-block-wrap {
      max-width: 720px; margin: 0 auto;
      border: 1px solid var(--border); border-radius: 12px; overflow: hidden;
      background: #0d0d14; box-shadow: 0 16px 48px rgba(0,0,0,.4);
    }
    .code-panel { display: none; }
    .code-panel.active { display: block; }
    .code-block {
      padding: 1.5rem; font-family: var(--mono); font-size: .82rem;
      line-height: 1.8; color: var(--text-dim); overflow-x: auto; white-space: pre;
    }
    .code-block .kw { color: var(--purple); }
    .code-block .fn { color: var(--blue); }
    .code-block .str { color: var(--green); }
    .code-block .cm { color: #555570; }
    .code-block .num { color: #f59e0b; }
    .code-block .op { color: var(--text); }

    /* ── Integrations ──────────────────���───────────── */
    .integrations-row {
      display: flex; gap: 2rem; justify-content: center; flex-wrap: wrap;
      margin-top: 2rem;
    }
    .integration-badge {
      display: flex; align-items: center; gap: .6rem;
      padding: .75rem 1.5rem;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 10px; font-size: .9rem; font-weight: 500;
      transition: border-color .2s, transform .2s;
    }
    .integration-badge:hover { border-color: var(--blue); transform: translateY(-2px); }
    .integration-badge svg { width: 22px; height: 22px; }

    /* ── Stats bar ────────────────────────────────── */
    .stats-bar {
      display: flex; justify-content: center; gap: 4rem; flex-wrap: wrap;
      padding: 3rem 1.5rem;
      border-bottom: 1px solid var(--border);
    }
    .stat { text-align: center; }
    .stat-num {
      font-size: 2.5rem; font-weight: 800; letter-spacing: -.03em;
      background: linear-gradient(135deg, var(--blue), var(--purple));
      -webkit-background-clip: text; -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .stat-label { font-size: .85rem; color: var(--text-dim); margin-top: .25rem; }

    @media (max-width: 640px) {
      .stats-bar { gap: 2rem; }
      .stat-num { font-size: 1.75rem; }
      .integrations-row { gap: 1rem; }
      .integration-badge { padding: .6rem 1rem; font-size: .8rem; }
    }

    /* ── Footer ─────────────────────────────────── */
    footer {
      border-top: 1px solid var(--border);
      padding: 3rem 1.5rem;
      text-align: center;
    }
    .footer-inner { max-width: 1100px; margin: 0 auto; }
    .footer-tagline {
      font-size: .95rem;
      color: var(--text-dim);
      margin-bottom: 1rem;
    }
    .footer-links {
      display: flex; gap: 1.5rem; justify-content: center; flex-wrap: wrap;
    }
    .footer-links a { color: var(--text-dim); font-size: .85rem; }
    .footer-links a:hover { color: var(--text); }
    .footer-copy {
      margin-top: 1.5rem;
      font-size: .8rem;
      color: #444460;
    }

    /* ── Mobile ─────────────────────────────────── */
    @media (max-width: 640px) {
      nav { padding: .75rem 1rem; }
      .nav-links { gap: 1rem; }
      section { padding: 3.5rem 1rem; }
      .terminal-body { font-size: .75rem; padding: 1rem; }
      .pricing-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

  <nav>
    <div class="nav-logo">Gate<span>Code</span></div>
    <div class="nav-links">
      <a href="#how-it-works">How it Works</a>
      <a href="#features">Features</a>
      <a href="/docs">Docs</a>
      <a href="#pricing">Pricing</a>
      <a href="/auth/github" class="btn btn-primary" style="padding:.5rem 1.25rem;font-size:.85rem;">Sign In</a>
    </div>
  </nav>

  <!-- Hero -->
  <section class="hero">
    <h1>GateCode</h1>
    <p class="tagline">Gate your code.</p>
    <p class="subtext">OAuth-style permission gateway for AI coding agents. Your AI asks, you approve, it codes.</p>
    <div class="hero-buttons">
      <a href="/auth/github" class="btn btn-primary">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
        Get Started with GitHub
      </a>
      <a href="/docs" class="btn btn-secondary">View Docs</a>
    </div>

    <div class="terminal-wrap">
      <div class="terminal">
        <div class="terminal-header">
          <div class="terminal-dot r"></div>
          <div class="terminal-dot y"></div>
          <div class="terminal-dot g"></div>
        </div>
        <div class="terminal-body">
          <div class="terminal-line"><span class="comment"># AI agent requests access to your repo</span></div>
          <div class="terminal-line"><span class="prompt">agent $</span> <span class="cmd">gatecode request --repo acme/api --scope write</span></div>
          <div class="terminal-line"><span class="highlight">Waiting for approval...</span></div>
          <div class="terminal-line"><span class="comment"># You approve on your phone in seconds</span></div>
          <div class="terminal-line"><span class="success">&#10003; Approved by @you (scoped: write, expires: 1h)</span></div>
          <div class="terminal-line"><span class="prompt">agent $</span> <span class="cmd">git push origin feat/new-endpoint</span></div>
          <div class="terminal-line"><span class="success">&#10003; Push succeeded. Token expired.</span></div>
        </div>
      </div>
    </div>
  </section>

  <!-- How it Works -->
  <section id="how-it-works">
    <div class="section-inner">
      <div class="section-label">How it works</div>
      <h2 class="section-title">Three steps. Full control.</h2>
      <div class="steps">
        <div class="step">
          <div class="step-icon">&#129302;</div>
          <div class="step-num">01</div>
          <h3>AI Agent Requests Access</h3>
          <p>Your coding agent hits the GateCode API with the repo, scope, and reason. A permission request is created instantly.</p>
        </div>
        <div class="step">
          <div class="step-icon">&#9989;</div>
          <div class="step-num">02</div>
          <h3>You Approve in Real-Time</h3>
          <p>Get notified on your phone or browser. Review the request and approve or deny with one tap. SSE keeps everything live.</p>
        </div>
        <div class="step">
          <div class="step-icon">&#128274;</div>
          <div class="step-num">03</div>
          <h3>Scoped Token, Time-Limited</h3>
          <p>The agent receives a narrowly scoped token that auto-expires. Every action is logged in your audit trail.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Features -->
  <section id="features" style="background:#08080d;">
    <div class="section-inner">
      <div class="section-label">Features</div>
      <h2 class="section-title">Everything you need to stay in control.</h2>
      <div class="features-grid">
        <div class="feature">
          <span class="feature-tag">SSE</span>
          <div class="feature-title">Real-Time Approvals</div>
          <p>Server-Sent Events push requests to your browser the instant an agent asks. No polling, no delays.</p>
        </div>
        <div class="feature">
          <span class="feature-tag">Rules</span>
          <div class="feature-title">Auto-Approve Rules</div>
          <p>Set glob patterns to auto-approve trusted agents on specific repos. Skip the prompt when you trust the flow.</p>
        </div>
        <div class="feature">
          <span class="feature-tag">Audit</span>
          <div class="feature-title">Audit Logging</div>
          <p>Every request, approval, and denial is recorded with timestamps, IP addresses, and agent identifiers.</p>
        </div>
        <div class="feature">
          <span class="feature-tag">Tokens</span>
          <div class="feature-title">Scoped Tokens</div>
          <p>Tokens are limited to the exact repo and permission level requested. No over-provisioned access.</p>
        </div>
        <div class="feature">
          <span class="feature-tag">Mobile</span>
          <div class="feature-title">Mobile-Friendly</div>
          <p>Approve requests from anywhere. The dashboard is designed mobile-first with large touch targets.</p>
        </div>
        <div class="feature">
          <span class="feature-tag">Expiry</span>
          <div class="feature-title">Time-Limited Access</div>
          <p>Tokens auto-expire after a configurable window. No lingering credentials. Access ends when the task does.</p>
        </div>
      </div>
    </div>
  </section>

  <!-- Stats -->
  <div class="stats-bar">
    <div class="stat"><div class="stat-num">&lt;50ms</div><div class="stat-label">Approval latency</div></div>
    <div class="stat"><div class="stat-num">0</div><div class="stat-label">Dependencies (CLI)</div></div>
    <div class="stat"><div class="stat-num">1hr</div><div class="stat-label">Default token TTL</div></div>
    <div class="stat"><div class="stat-num">100%</div><div class="stat-label">Edge-deployed</div></div>
  </div>

  <!-- Code Examples -->
  <section id="developers">
    <div class="section-inner">
      <div class="section-label">For developers</div>
      <h2 class="section-title">Integrate in minutes.</h2>
      <div class="code-block-wrap">
        <div class="code-tabs">
          <div class="code-tab active" data-panel="sdk">TypeScript SDK</div>
          <div class="code-tab" data-panel="cli">CLI</div>
          <div class="code-tab" data-panel="curl">cURL</div>
        </div>
        <div class="code-panel active" id="panel-sdk"><div class="code-block"><span class="kw">import</span> { <span class="fn">GateCode</span> } <span class="kw">from</span> <span class="str">'gatecode'</span>;

<span class="kw">const</span> gate = <span class="kw">new</span> <span class="fn">GateCode</span>({
  <span class="op">apiKey</span>: process.env.<span class="op">GATECODE_API_KEY</span>,
  <span class="op">username</span>: <span class="str">'your-github-handle'</span>
});

<span class="cm">// Request access and wait for approval</span>
<span class="kw">const</span> { token, expires_at } = <span class="kw">await</span> gate.<span class="fn">requestAndWait</span>({
  <span class="op">repo</span>: <span class="str">'acme/api'</span>,
  <span class="op">scope</span>: <span class="str">'write'</span>,
  <span class="op">reason</span>: <span class="str">'Deploy hotfix to production'</span>
});

<span class="cm">// Use the scoped token</span>
console.<span class="fn">log</span>(<span class="str">'Token expires:'</span>, expires_at);</div></div>
        <div class="code-panel" id="panel-cli"><div class="code-block"><span class="cm"># Install globally or use npx</span>
<span class="prompt">$</span> <span class="cmd">npm install -g gatecode</span>

<span class="cm"># Login with your API key</span>
<span class="prompt">$</span> <span class="cmd">gatecode login</span>
<span class="str">? API Key: gk_a1b2c3d4...</span>
<span class="success">&#10003; Saved to ~/.gatecode/config.json</span>

<span class="cm"># Request access (waits for approval)</span>
<span class="prompt">$</span> <span class="cmd">gatecode request acme/api --scope write --wait</span>
<span class="highlight">&#9679; Waiting for approval...</span>
<span class="success">&#10003; Approved! Token: ghp_xxx (expires in 1h)</span>

<span class="cm"># Check status of a request</span>
<span class="prompt">$</span> <span class="cmd">gatecode status 42</span>
<span class="success">approved</span> | token: ghp_xxx | expires: 2026-04-04T08:30:00Z</div></div>
        <div class="code-panel" id="panel-curl"><div class="code-block"><span class="cm"># Request access via API</span>
<span class="prompt">$</span> <span class="cmd">curl -X POST https://gatecode.sh/api/request \</span>
  <span class="cmd">  -H "X-GateCode-Key: gk_your_key" \</span>
  <span class="cmd">  -H "Content-Type: application/json" \</span>
  <span class="cmd">  -d '{</span>
    <span class="str">"agent_id"</span>: <span class="str">"claude-code"</span>,
    <span class="str">"repo"</span>: <span class="str">"acme/api"</span>,
    <span class="str">"scope"</span>: <span class="str">"write"</span>,
    <span class="str">"reason"</span>: <span class="str">"Deploy hotfix"</span>,
    <span class="str">"username"</span>: <span class="str">"your-handle"</span>
  <span class="cmd">}'</span>

<span class="cm"># Response</span>
{ <span class="str">"id"</span>: <span class="num">42</span>, <span class="str">"status"</span>: <span class="str">"pending"</span> }

<span class="cm"># Poll for result</span>
<span class="prompt">$</span> <span class="cmd">curl https://gatecode.sh/api/status/42</span>
{ <span class="str">"id"</span>: <span class="num">42</span>, <span class="str">"status"</span>: <span class="str">"approved"</span>, <span class="str">"token"</span>: <span class="str">"ghp_..."</span> }</div></div>
      </div>
    </div>
  </section>

  <!-- Integrations -->
  <section style="background:#08080d;">
    <div class="section-inner" style="text-align:center">
      <div class="section-label">Integrations</div>
      <h2 class="section-title">Works with your AI tools.</h2>
      <div class="integrations-row">
        <div class="integration-badge">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
          GitHub Copilot
        </div>
        <div class="integration-badge">
          <svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 12h8M12 8v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Claude Code
        </div>
        <div class="integration-badge">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.325 3.05L8.667 20.432l1.932.518 4.658-17.382-1.932-.518zM7.612 18.36l1.36-1.448-.024-.024-5.545-5.214 5.545-5.236-1.336-1.42-6.89 6.656 6.89 6.686zM16.388 18.36l6.89-6.686-6.89-6.656-1.336 1.42 5.545 5.236-5.545 5.214-.024.024 1.36 1.448z"/></svg>
          Cursor
        </div>
        <div class="integration-badge">
          <svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 8h10M7 12h6M7 16h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Any MCP Client
        </div>
      </div>
    </div>
  </section>

  <!-- Pricing -->
  <section id="pricing">
    <div class="section-inner">
      <div class="section-label">Pricing</div>
      <h2 class="section-title">Start free. Scale when ready.</h2>
      <div class="pricing-grid">

        <div class="price-card">
          <div class="price-tier">Free</div>
          <div class="price-amount">$0<span> /mo</span></div>
          <ul class="price-features">
            <li>3 repositories</li>
            <li>Manual approval only</li>
            <li>Audit log (7 days)</li>
            <li>Community support</li>
          </ul>
          <a href="/auth/github" class="btn-price primary">Get Started</a>
        </div>

        <div class="price-card featured">
          <div class="price-tier">Pro</div>
          <div class="price-amount">$9<span> /mo</span></div>
          <ul class="price-features">
            <li>Unlimited repositories</li>
            <li>Auto-approve rules</li>
            <li>Audit log export</li>
            <li>Priority support</li>
          </ul>
          <a href="/auth/github" class="btn-price primary">Start Free Trial</a>
        </div>

        <div class="price-card">
          <div class="price-tier">Team</div>
          <div class="price-amount">$29<span> /mo</span></div>
          <ul class="price-features">
            <li>Everything in Pro</li>
            <li>Multiple users</li>
            <li>Org-wide policies</li>
            <li>Shared rules</li>
          </ul>
          <a href="/auth/github" class="btn-price">Start Free Trial</a>
        </div>

        <div class="price-card">
          <div class="price-tier">Enterprise</div>
          <div class="price-amount">$99<span> /mo</span></div>
          <ul class="price-features">
            <li>Everything in Team</li>
            <li>SSO integration</li>
            <li>Compliance reporting</li>
            <li>Custom policies &amp; SLA</li>
          </ul>
          <a href="mailto:hello@gatecode.sh" class="btn-price">Contact Us</a>
        </div>

      </div>
    </div>
  </section>

  <!-- Footer -->
  <footer>
    <div class="footer-inner">
      <p class="footer-tagline">Built for the AI-native development workflow.</p>
      <div class="footer-links">
        <a href="#how-it-works">How it Works</a>
        <a href="#features">Features</a>
        <a href="#pricing">Pricing</a>
        <a href="/auth/github">Sign In</a>
        <a href="https://github.com/gatecode">GitHub</a>
      </div>
      <p class="footer-copy">&copy; 2026 GateCode. All rights reserved.</p>
    </div>
  </footer>

  <script>
    document.querySelectorAll('.code-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.code-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.code-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('panel-' + tab.dataset.panel).classList.add('active');
      });
    });
  </script>
</body>
</html>`
  );
};
