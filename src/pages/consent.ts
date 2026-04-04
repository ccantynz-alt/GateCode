// GateCode — OAuth consent page for MCP authorization

export function consentPage(params: {
  clientName: string;
  scopes: string[];
  authorizeUrl: string;
  denyUrl: string;
}): string {
  const scopeItems = params.scopes
    .map(
      (s) =>
        `<li style="padding:8px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:6px;font-family:var(--mono);font-size:0.9rem;">${escapeHtml(s)}</li>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Authorize — GateCode</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    :root {
      --bg: #0a0a0f;
      --bg-card: #12121a;
      --bg-card-hover: #1a1a28;
      --bg-input: #0e0e16;
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

    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 40px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }

    .logo {
      font-size: 1.5rem;
      font-weight: 700;
      background: linear-gradient(135deg, var(--blue), var(--purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 24px;
    }

    .prompt {
      font-size: 1.1rem;
      margin-bottom: 8px;
    }

    .client-name {
      font-weight: 600;
      color: var(--blue);
    }

    .sub {
      color: var(--text-dim);
      font-size: 0.9rem;
      margin-bottom: 24px;
    }

    .scopes-label {
      text-align: left;
      font-size: 0.85rem;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }

    .scopes {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 32px;
      text-align: left;
    }

    .actions {
      display: flex;
      gap: 12px;
    }

    .btn {
      flex: 1;
      padding: 12px 20px;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      font-family: var(--font);
      transition: opacity 0.15s;
    }

    .btn:hover { opacity: 0.85; }

    .btn-allow {
      background: linear-gradient(135deg, var(--blue), var(--purple));
      color: #fff;
    }

    .btn-deny {
      background: var(--bg-input);
      color: var(--text-dim);
      border: 1px solid var(--border);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">GateCode</div>
    <div class="prompt">
      <span class="client-name">${escapeHtml(params.clientName)}</span> is requesting access to your GateCode account
    </div>
    <div class="sub">This application will be able to act on your behalf.</div>
    <div class="scopes-label">Requested scopes</div>
    <ul class="scopes">${scopeItems}</ul>
    <div class="actions">
      <form method="POST" action="${escapeHtml(params.authorizeUrl)}" style="flex:1;display:flex;">
        <button type="submit" class="btn btn-allow" style="flex:1;">Allow</button>
      </form>
      <form method="GET" action="${escapeHtml(params.denyUrl)}" style="flex:1;display:flex;">
        <button type="submit" class="btn btn-deny" style="flex:1;">Deny</button>
      </form>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}
