# CLAUDE.md — GateCode Development Rules

## Priority #1: Nothing Broken

**If you find something broken, fix it immediately.** Do not ask, do not wait, do not log it for later. A broken feature on the website is the worst possible customer experience. Fix first, explain after.

This includes:
- Broken routes returning wrong status codes
- TypeScript compilation errors
- Middleware interfering with unrelated routes
- Missing error handling that could crash the worker
- UI elements that don't work (buttons, forms, tabs, SSE connections)
- Broken links or dead endpoints

## Development Rules

### Code Quality
- `npx tsc --noEmit` must always pass with zero errors before committing
- `bun test` must always pass with zero failures before committing
- If a change breaks tests, fix the tests or the code — never commit broken
- Never leave TODO comments in production code — either do it now or don't

### Architecture
- Server: Cloudflare Workers + Hono + D1 SQLite + KV Sessions
- CLI/SDK: Zero-dependency TypeScript package at `/cli`
- All server code in `/src`, tests in `/src/__tests__`
- Auth middleware must be scoped to specific route prefixes, never `use("*")`

### Git
- Branch: `claude/npm-publish-pvyld`
- Commit messages: conventional commits (feat:, fix:, chore:, etc.)
- Push after every meaningful commit
- Never force push

### Testing
- Run `bun test` after any route, middleware, or query change
- Mock D1 and KV in tests using helpers from `src/__tests__/helpers.ts`
- Every new API endpoint needs at least one happy path and one error test

### Security
- Never expose API key hashes, full tokens, or secrets in responses
- Validate all user input with zod schemas
- Rate limit all public endpoints
- HMAC-verify all webhook signatures (Stripe, generic)
- Session tokens are httpOnly, secure, sameSite

### What to Fix Without Asking
- TypeScript errors
- Broken tests
- Routes returning wrong status codes
- Middleware scope leaks (auth middleware catching unrelated routes)
- Missing error responses (should never return raw 500)
- Dead code or unused imports
- Security vulnerabilities (XSS, injection, exposed secrets)
