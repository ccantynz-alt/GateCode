# CLAUDE.md — GateCode Development Guide

## Product Vision

GateCode must be the most advanced permission gateway for AI agents on the market. This is non-negotiable.

## Pre-Build Checklist (REQUIRED before every session)

Before writing any code, ask yourself:

1. **Competitive audit**: What are the latest tools, products, and patterns in the AI agent permissions/auth space? Has anything new shipped since the last session?
2. **Technology scan**: Are there new APIs, protocols, or standards (e.g., OAuth extensions, agent-to-agent protocols, MCP updates) that GateCode should adopt or integrate with?
3. **Feature gap analysis**: Is there anything a competitor offers that GateCode doesn't? If so, plan to close that gap.
4. **Architecture review**: Does the current architecture support the most advanced use cases, or does it need to evolve?

## Product Strategy

- **GateCode (Product 1)**: The most advanced runtime permission gateway for AI agents accessing external resources. GitHub today, every platform tomorrow.
- **Agent Memory/Context Layer (Product 2)**: A separate product (separate repo, separate revenue stream) for AI agent conversation continuity and context persistence. To be built after GateCode ships.

## Engineering Principles

- Ship fast, but never ship mediocre. Every endpoint should be best-in-class.
- Security is a feature, not an afterthought. Token scoping, rate limiting, audit trails — always.
- API design matters. Agents are our users. The API must be intuitive, well-documented, and rich in context.
- Monitor the ecosystem daily. AI agent tooling moves fast. If a new standard emerges, adopt it before competitors do.
- Every feature must answer: "Does this make GateCode the clear best choice for teams deploying AI agents?"

## Tech Stack

- Hono framework on Cloudflare Workers
- Cloudflare D1 (SQLite), KV for sessions
- GitHub OAuth + fine-grained tokens
- TypeScript throughout
- Bun for local dev, Wrangler for deployment

## Current Priorities

1. Enhance `GET /api/status/:id` — richer responses, expiry detection, rate limiting
2. Align SDK and CLI with API improvements
3. Continuous competitive and technology scanning
