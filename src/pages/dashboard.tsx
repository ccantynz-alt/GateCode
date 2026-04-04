import { html } from "hono/html";
import type { Context } from "hono";
import type { Env } from "../types";
import type { Permission } from "../db/queries";

export const dashboardPage = async (c: Context<Env>) => {
  const user = c.get("user");
  const { results: pending } = await c.env.DB.prepare(
    `SELECT * FROM permissions WHERE user_id = ? AND status = 'pending' ORDER BY created_at DESC`
  )
    .bind(user.id)
    .all<Permission>();

  const pendingJson = JSON.stringify(pending);

  return c.html(
    html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GateCode — Dashboard</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --bg: #0a0a0f;
      --bg-card: #12121a;
      --border: #1e1e2e;
      --text: #e4e4e7;
      --text-dim: #71717a;
      --blue: #3b82f6;
      --green: #22c55e;
      --red: #ef4444;
      --yellow: #eab308;
      --purple: #8b5cf6;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      border-bottom: 1px solid var(--border);
      background: var(--bg-card);
    }
    .header-left { display: flex; align-items: center; gap: 0.75rem; }
    .logo { font-size: 1.25rem; font-weight: 700; color: var(--blue); text-decoration: none; }
    .header-right { display: flex; align-items: center; gap: 1rem; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; }
    .username { font-size: 0.875rem; color: var(--text-dim); }
    .logout-btn {
      background: none; border: 1px solid var(--border); color: var(--text-dim);
      padding: 0.375rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem;
    }
    .logout-btn:hover { border-color: var(--red); color: var(--red); }

    .tabs {
      display: flex; gap: 0; border-bottom: 1px solid var(--border);
      background: var(--bg-card); padding: 0 1.5rem; overflow-x: auto;
    }
    .tab {
      padding: 0.875rem 1.25rem; cursor: pointer; font-size: 0.9rem;
      color: var(--text-dim); border-bottom: 2px solid transparent;
      white-space: nowrap; transition: all 0.15s;
    }
    .tab:hover { color: var(--text); }
    .tab.active { color: var(--blue); border-bottom-color: var(--blue); }

    .tab-content { display: none; padding: 1.5rem; max-width: 900px; margin: 0 auto; }
    .tab-content.active { display: block; }

    .empty-state {
      text-align: center; padding: 4rem 1rem; color: var(--text-dim); font-size: 1.1rem;
    }

    .request-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem;
      transition: border-color 0.15s;
    }
    .request-card:hover { border-color: #2e2e40; }
    .request-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
    .request-repo { font-size: 1.1rem; font-weight: 600; font-family: monospace; }
    .badge {
      display: inline-block; padding: 0.2rem 0.6rem; border-radius: 999px;
      font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
    }
    .badge-read { background: rgba(59,130,246,0.15); color: var(--blue); }
    .badge-write { background: rgba(234,179,8,0.15); color: var(--yellow); }
    .request-meta { font-size: 0.85rem; color: var(--text-dim); margin-bottom: 0.5rem; }
    .request-reason { font-size: 0.9rem; color: var(--text); margin-bottom: 1rem; font-style: italic; }
    .request-actions { display: flex; gap: 0.75rem; }
    .btn {
      flex: 1; padding: 0.875rem; border: none; border-radius: 8px;
      font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
      min-height: 48px;
    }
    .btn-allow { background: var(--green); color: #000; }
    .btn-allow:hover { background: #16a34a; }
    .btn-allow:active { transform: scale(0.97); }
    .btn-deny { background: var(--red); color: #fff; }
    .btn-deny:hover { background: #dc2626; }
    .btn-deny:active { transform: scale(0.97); }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* Rules tab */
    .rule-form {
      display: flex; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap;
    }
    .rule-form input, .rule-form select {
      background: var(--bg-card); border: 1px solid var(--border); color: var(--text);
      padding: 0.625rem 0.875rem; border-radius: 8px; font-size: 0.9rem;
    }
    .rule-form input { flex: 1; min-width: 150px; }
    .rule-form select { min-width: 120px; }
    .btn-add {
      background: var(--blue); color: #fff; border: none; padding: 0.625rem 1.25rem;
      border-radius: 8px; cursor: pointer; font-weight: 600; font-size: 0.9rem;
    }
    .btn-add:hover { background: #2563eb; }
    .rule-item {
      display: flex; align-items: center; justify-content: space-between;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 8px; padding: 1rem; margin-bottom: 0.5rem;
    }
    .rule-info { font-family: monospace; font-size: 0.9rem; }
    .rule-action-badge {
      display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px;
      font-size: 0.75rem; margin-left: 0.5rem;
    }
    .rule-action-badge.auto_approve { background: rgba(34,197,94,0.15); color: var(--green); }
    .rule-action-badge.auto_deny { background: rgba(239,68,68,0.15); color: var(--red); }
    .rule-action-badge.ask { background: rgba(234,179,8,0.15); color: var(--yellow); }
    .btn-delete {
      background: none; border: 1px solid var(--border); color: var(--text-dim);
      padding: 0.375rem 0.75rem; border-radius: 6px; cursor: pointer; font-size: 0.8rem;
    }
    .btn-delete:hover { border-color: var(--red); color: var(--red); }
    .plan-notice {
      background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.3);
      border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem; font-size: 0.9rem;
    }

    /* Audit tab */
    .audit-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .audit-table th {
      text-align: left; padding: 0.75rem; border-bottom: 1px solid var(--border);
      color: var(--text-dim); font-weight: 500;
    }
    .audit-table td { padding: 0.75rem; border-bottom: 1px solid var(--border); }
    .action-approved { color: var(--green); }
    .action-denied { color: var(--red); }
    .action-auto_approved { color: var(--blue); }
    .action-auto_denied { color: var(--yellow); }
    .btn-loadmore {
      display: block; margin: 1rem auto; background: var(--bg-card);
      border: 1px solid var(--border); color: var(--text-dim);
      padding: 0.625rem 1.5rem; border-radius: 8px; cursor: pointer; font-size: 0.9rem;
    }
    .btn-loadmore:hover { border-color: var(--blue); color: var(--blue); }

    .connected-badge {
      display: inline-block; width: 8px; height: 8px; border-radius: 50%;
      background: var(--green); margin-left: 0.5rem; animation: pulse 2s infinite;
    }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

    @media (max-width: 600px) {
      .header { padding: 0.75rem 1rem; }
      .tab-content { padding: 1rem; }
      .rule-form { flex-direction: column; }
      .audit-table { font-size: 0.75rem; }
      .audit-table th, .audit-table td { padding: 0.5rem 0.375rem; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <a href="/" class="logo">GateCode</a>
      <span class="connected-badge" id="sse-indicator" title="Live connection"></span>
    </div>
    <div class="header-right">
      <img class="avatar" src="${user.avatar_url ?? ""}" alt="" />
      <span class="username">${user.username}</span>
      <form action="/auth/logout" method="POST" style="display:inline">
        <button type="submit" class="logout-btn">Logout</button>
      </form>
    </div>
  </div>

  <div class="tabs">
    <div class="tab active" data-tab="pending">Pending Requests</div>
    <div class="tab" data-tab="rules">Rules</div>
    <div class="tab" data-tab="audit">Audit Log</div>
  </div>

  <div id="tab-pending" class="tab-content active">
    <div id="requests-container"></div>
    <div id="empty-state" class="empty-state" style="display:none">
      No pending requests. Your AI agents are behaving! 🎉
    </div>
  </div>

  <div id="tab-rules" class="tab-content">
    <div id="plan-notice" class="plan-notice" style="display:${user.plan === "free" ? "block" : "none"}">
      Auto-approve/deny rules require the <strong>Pro plan</strong> or above.
      <a href="/" style="color:var(--purple)">Upgrade</a>
    </div>
    <form id="rule-form" class="rule-form">
      <input type="text" name="pattern" placeholder="repo pattern (e.g. myorg/*)" required />
      <select name="scope">
        <option value="read">read</option>
        <option value="write">write</option>
      </select>
      <select name="action">
        <option value="auto_approve">auto approve</option>
        <option value="auto_deny">auto deny</option>
        <option value="ask">ask</option>
      </select>
      <button type="submit" class="btn-add">Add Rule</button>
    </form>
    <div id="rules-container"></div>
  </div>

  <div id="tab-audit" class="tab-content">
    <table class="audit-table">
      <thead>
        <tr><th>Time</th><th>Agent</th><th>Repo</th><th>Scope</th><th>Action</th></tr>
      </thead>
      <tbody id="audit-body"></tbody>
    </table>
    <button class="btn-loadmore" id="audit-loadmore">Load more</button>
  </div>

  <script>
    // ── State ──
    let requests = ${pendingJson};
    let auditOffset = 0;
    const userPlan = "${user.plan}";

    // ── Tab switching ──
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
        if (tab.dataset.tab === 'rules') loadRules();
        if (tab.dataset.tab === 'audit' && auditOffset === 0) loadAudit();
      });
    });

    // ── Render pending requests ──
    function renderRequests() {
      const container = document.getElementById('requests-container');
      const empty = document.getElementById('empty-state');
      if (requests.length === 0) {
        container.innerHTML = '';
        empty.style.display = 'block';
        return;
      }
      empty.style.display = 'none';
      container.innerHTML = requests.map(r => {
        const ago = timeAgo(r.created_at);
        return '<div class="request-card" id="req-' + r.id + '">' +
          '<div class="request-header">' +
            '<span class="request-repo">' + esc(r.repo) + '</span>' +
            '<span class="badge badge-' + r.scope + '">' + r.scope + '</span>' +
          '</div>' +
          '<div class="request-meta">Agent: <strong>' + esc(r.agent_id) + '</strong> · ' + ago + '</div>' +
          (r.reason ? '<div class="request-reason">"' + esc(r.reason) + '"</div>' : '') +
          '<div class="request-actions">' +
            '<button class="btn btn-allow" onclick="approve(' + r.id + ', this)">Allow</button>' +
            '<button class="btn btn-deny" onclick="deny(' + r.id + ', this)">Deny</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
    renderRequests();

    // ── SSE connection ──
    const indicator = document.getElementById('sse-indicator');
    function connectSSE() {
      const es = new EventSource('/api/pending');
      es.addEventListener('init', (e) => {
        requests = JSON.parse(e.data);
        renderRequests();
      });
      es.addEventListener('new_request', (e) => {
        const r = JSON.parse(e.data);
        requests.unshift(r);
        renderRequests();
      });
      es.addEventListener('approved', (e) => {
        const r = JSON.parse(e.data);
        requests = requests.filter(p => p.id !== r.id);
        renderRequests();
      });
      es.addEventListener('denied', (e) => {
        const r = JSON.parse(e.data);
        requests = requests.filter(p => p.id !== r.id);
        renderRequests();
      });
      es.onopen = () => { indicator.style.background = '#22c55e'; };
      es.onerror = () => {
        indicator.style.background = '#ef4444';
        setTimeout(connectSSE, 3000);
        es.close();
      };
    }
    connectSSE();

    // ── Approve / Deny ──
    async function approve(id, btn) {
      btn.disabled = true;
      btn.textContent = '...';
      try {
        await fetch('/api/approve/' + id, { method: 'POST' });
        requests = requests.filter(r => r.id !== id);
        renderRequests();
      } catch(e) { btn.disabled = false; btn.textContent = 'Allow'; }
    }
    async function deny(id, btn) {
      btn.disabled = true;
      btn.textContent = '...';
      try {
        await fetch('/api/deny/' + id, { method: 'POST' });
        requests = requests.filter(r => r.id !== id);
        renderRequests();
      } catch(e) { btn.disabled = false; btn.textContent = 'Deny'; }
    }

    // ── Rules ──
    async function loadRules() {
      const res = await fetch('/api/rules');
      const rules = await res.json();
      const container = document.getElementById('rules-container');
      if (rules.length === 0) {
        container.innerHTML = '<p style="color:var(--text-dim)">No rules configured.</p>';
        return;
      }
      container.innerHTML = rules.map(r =>
        '<div class="rule-item">' +
          '<div class="rule-info">' + esc(r.pattern) + ' <span class="badge badge-' + r.scope + '">' + r.scope + '</span>' +
          ' <span class="rule-action-badge ' + r.action + '">' + r.action.replace('_', ' ') + '</span></div>' +
          '<button class="btn-delete" onclick="deleteRule(' + r.id + ')">Delete</button>' +
        '</div>'
      ).join('');
    }

    document.getElementById('rule-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: fd.get('pattern'), scope: fd.get('scope'), action: fd.get('action') })
      });
      if (res.ok) { e.target.reset(); loadRules(); }
      else {
        const err = await res.json();
        alert(err.error || 'Failed to create rule');
      }
    });

    async function deleteRule(id) {
      await fetch('/api/rules/' + id, { method: 'DELETE' });
      loadRules();
    }

    // ── Audit ──
    async function loadAudit(append) {
      const res = await fetch('/api/audit?limit=50&offset=' + auditOffset);
      const { data, pagination } = await res.json();
      const body = document.getElementById('audit-body');
      const rows = data.map(a =>
        '<tr>' +
          '<td>' + new Date(a.timestamp + 'Z').toLocaleString() + '</td>' +
          '<td>' + esc(a.agent_id) + '</td>' +
          '<td style="font-family:monospace">' + esc(a.repo) + '</td>' +
          '<td>' + a.scope + '</td>' +
          '<td class="action-' + a.action + '">' + a.action.replace('_', ' ') + '</td>' +
        '</tr>'
      ).join('');
      if (append) body.innerHTML += rows;
      else body.innerHTML = rows;
      auditOffset += data.length;
      document.getElementById('audit-loadmore').style.display =
        auditOffset >= pagination.total ? 'none' : 'block';
    }
    document.getElementById('audit-loadmore').addEventListener('click', () => loadAudit(true));

    // ── Helpers ──
    function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
    function timeAgo(iso) {
      const s = Math.floor((Date.now() - new Date(iso + 'Z').getTime()) / 1000);
      if (s < 60) return s + 's ago';
      if (s < 3600) return Math.floor(s/60) + 'm ago';
      if (s < 86400) return Math.floor(s/3600) + 'h ago';
      return Math.floor(s/86400) + 'd ago';
    }
  </script>
</body>
</html>`
  );
};
