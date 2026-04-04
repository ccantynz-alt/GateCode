import { html } from "hono/html";
import type { Context } from "hono";
import type { Env } from "../types";
import {
  getPendingPermissions,
  getRules,
  getAuditLog,
} from "../db/queries";
import type { Permission, Rule, AuditEntry } from "../db/queries";

export const dashboardPage = async (c: Context<Env & { Variables: { user: { id: number; username: string; avatar_url: string | null; plan: string } } }>) => {
  const user = c.get("user");
  const db = c.env.DB;

  const [pending, rules, auditLog] = await Promise.all([
    getPendingPermissions(db, user.id),
    getRules(db, user.id),
    getAuditLog(db, user.id, { limit: 50, offset: 0 }),
  ]);

  const pendingJson = JSON.stringify(pending);
  const rulesJson = JSON.stringify(rules);
  const auditJson = JSON.stringify(auditLog);

  return c.html(
    html`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Dashboard — GateCode</title>
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
      --yellow: #eab308;
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
      min-height: 100vh;
    }

    /* ── Header ──────────────────────────────── */
    .header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 1rem 1.5rem;
      background: rgba(10,10,15,.9);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--border);
      position: sticky; top: 0; z-index: 100;
    }
    .header-logo {
      font-size: 1.15rem; font-weight: 700; color: var(--text);
      text-decoration: none; letter-spacing: -.02em;
    }
    .header-logo span { color: var(--blue); }
    .header-user {
      display: flex; align-items: center; gap: .75rem;
    }
    .header-avatar {
      width: 32px; height: 32px; border-radius: 50%;
      border: 2px solid var(--border);
    }
    .header-username {
      font-size: .9rem; font-weight: 500; color: var(--text-dim);
    }
    .header-plan {
      font-family: var(--mono);
      font-size: .65rem;
      text-transform: uppercase;
      letter-spacing: .1em;
      padding: .15rem .5rem;
      border-radius: 4px;
      background: rgba(139,92,246,.15);
      color: var(--purple);
    }
    .btn-logout {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-dim);
      padding: .4rem .9rem;
      border-radius: 6px;
      font-size: .8rem;
      cursor: pointer;
      transition: border-color .2s, color .2s;
    }
    .btn-logout:hover { border-color: var(--red); color: var(--red); }

    /* ── Tabs ─────────────────────────────────── */
    .tabs {
      display: flex;
      border-bottom: 1px solid var(--border);
      padding: 0 1.5rem;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .tab {
      padding: .9rem 1.25rem;
      font-size: .9rem;
      font-weight: 500;
      color: var(--text-dim);
      cursor: pointer;
      border: none;
      border-bottom: 2px solid transparent;
      transition: color .2s, border-color .2s;
      white-space: nowrap;
      background: none;
    }
    .tab:hover { color: var(--text); }
    .tab.active {
      color: var(--blue);
      border-bottom-color: var(--blue);
    }

    /* ── Container ────────────────────────────── */
    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 1.5rem;
    }

    .tab-panel { display: none; }
    .tab-panel.active { display: block; }

    /* ── Pending Cards ────────────────────────── */
    .empty-state {
      text-align: center;
      padding: 4rem 1rem;
      color: var(--text-dim);
      font-size: 1.1rem;
    }
    .empty-state .emoji { font-size: 2.5rem; margin-bottom: 1rem; display: block; }

    .request-card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      margin-bottom: 1rem;
      transition: border-color .2s, opacity .3s, transform .3s;
      animation: fadeIn .3s ease-out;
    }
    .request-card:hover { border-color: #2a2a3e; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

    .request-header {
      display: flex; align-items: center; justify-content: space-between;
      flex-wrap: wrap; gap: .5rem;
      margin-bottom: .75rem;
    }
    .request-agent {
      font-family: var(--mono);
      font-size: .9rem;
      font-weight: 600;
    }
    .request-time {
      font-size: .8rem;
      color: var(--text-dim);
    }
    .request-meta {
      display: flex; align-items: center; gap: .5rem; flex-wrap: wrap;
      margin-bottom: .75rem;
    }
    .badge {
      display: inline-block;
      font-family: var(--mono);
      font-size: .7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .05em;
      padding: .2rem .6rem;
      border-radius: 4px;
    }
    .badge-repo {
      background: rgba(59,130,246,.12);
      color: var(--blue);
    }
    .badge-read {
      background: rgba(34,197,94,.12);
      color: var(--green);
    }
    .badge-write {
      background: rgba(234,179,8,.12);
      color: var(--yellow);
    }
    .badge-pending { background: rgba(234,179,8,.12); color: var(--yellow); }
    .badge-approved { background: rgba(34,197,94,.12); color: var(--green); }
    .badge-denied { background: rgba(239,68,68,.12); color: var(--red); }
    .badge-auto_approved { background: rgba(59,130,246,.12); color: var(--blue); }
    .badge-auto_denied { background: rgba(139,92,246,.12); color: var(--purple); }

    .request-reason {
      font-size: .9rem;
      color: var(--text-dim);
      margin-bottom: 1rem;
      font-style: italic;
    }

    .request-actions {
      display: flex; gap: .75rem;
    }
    .btn-approve, .btn-deny {
      flex: 1;
      padding: .85rem 1rem;
      border: none;
      border-radius: 8px;
      font-size: .95rem;
      font-weight: 600;
      cursor: pointer;
      transition: transform .1s, box-shadow .2s, opacity .2s;
      min-height: 48px;
    }
    .btn-approve:hover, .btn-deny:hover { transform: translateY(-1px); }
    .btn-approve:active, .btn-deny:active { transform: translateY(0); }
    .btn-approve:disabled, .btn-deny:disabled { opacity: .5; cursor: not-allowed; transform: none; }
    .btn-approve {
      background: var(--green);
      color: #fff;
      box-shadow: 0 4px 16px rgba(34,197,94,.25);
    }
    .btn-approve:hover:not(:disabled) { box-shadow: 0 6px 24px rgba(34,197,94,.35); }
    .btn-deny {
      background: var(--red);
      color: #fff;
      box-shadow: 0 4px 16px rgba(239,68,68,.2);
    }
    .btn-deny:hover:not(:disabled) { box-shadow: 0 6px 24px rgba(239,68,68,.3); }

    /* ── Connection indicator ─────────────────── */
    .sse-indicator {
      display: flex; align-items: center; gap: .4rem;
      font-size: .75rem; color: var(--text-dim);
      margin-bottom: 1rem;
    }
    .sse-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--yellow);
      transition: background .3s;
    }
    .sse-dot.connected { background: var(--green); animation: pulse 2s ease-in-out infinite; }
    .sse-dot.disconnected { background: var(--red); animation: none; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }

    /* ── Rules ────────────────────────────────── */
    .rule-item {
      display: flex; align-items: center; justify-content: space-between;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 1rem 1.25rem;
      margin-bottom: .75rem;
      transition: border-color .2s;
    }
    .rule-item:hover { border-color: #2a2a3e; }
    .rule-info { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
    .rule-pattern {
      font-family: var(--mono);
      font-size: .9rem;
      font-weight: 600;
    }
    .btn-delete-rule {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--red);
      padding: .4rem .75rem;
      border-radius: 6px;
      font-size: .8rem;
      cursor: pointer;
      transition: background .2s, border-color .2s;
      white-space: nowrap;
    }
    .btn-delete-rule:hover { background: rgba(239,68,68,.1); border-color: var(--red); }

    .rule-form {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      margin-top: 1.5rem;
    }
    .rule-form h3 {
      font-size: 1rem; font-weight: 600; margin-bottom: 1rem;
    }
    .form-row {
      display: grid;
      grid-template-columns: 1fr;
      gap: .75rem;
      margin-bottom: 1rem;
    }
    .form-field label {
      display: block;
      font-size: .8rem;
      color: var(--text-dim);
      margin-bottom: .35rem;
      font-weight: 500;
    }
    .form-field input,
    .form-field select {
      width: 100%;
      padding: .65rem .85rem;
      background: var(--bg-input);
      border: 1px solid var(--border);
      border-radius: 6px;
      color: var(--text);
      font-size: .9rem;
      font-family: var(--mono);
      transition: border-color .2s;
    }
    .form-field input:focus,
    .form-field select:focus {
      outline: none;
      border-color: var(--blue);
    }
    .form-field select {
      cursor: pointer;
      -webkit-appearance: none;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238888a0' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right .75rem center;
      padding-right: 2rem;
    }
    .btn-add-rule {
      background: linear-gradient(135deg, var(--blue), var(--purple));
      color: #fff;
      border: none;
      padding: .7rem 1.5rem;
      border-radius: 8px;
      font-size: .9rem;
      font-weight: 600;
      cursor: pointer;
      transition: box-shadow .2s;
    }
    .btn-add-rule:hover { box-shadow: 0 4px 16px rgba(59,130,246,.3); }
    .pro-note {
      font-size: .8rem;
      color: var(--yellow);
      margin-top: 1rem;
      padding: .75rem;
      background: rgba(234,179,8,.06);
      border: 1px solid rgba(234,179,8,.15);
      border-radius: 6px;
    }

    /* ── Audit Log ────────────────────────────── */
    .audit-table-wrap {
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .audit-table {
      width: 100%;
      border-collapse: collapse;
      font-size: .85rem;
    }
    .audit-table th {
      text-align: left;
      padding: .75rem .5rem;
      font-size: .75rem;
      text-transform: uppercase;
      letter-spacing: .08em;
      color: var(--text-dim);
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    .audit-table td {
      padding: .65rem .5rem;
      border-bottom: 1px solid var(--border);
      white-space: nowrap;
    }
    .audit-table tr:hover td {
      background: rgba(255,255,255,.02);
    }
    .audit-table .mono {
      font-family: var(--mono);
      font-size: .8rem;
    }

    .btn-load-more {
      display: block;
      width: 100%;
      padding: .75rem;
      margin-top: 1rem;
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text-dim);
      font-size: .9rem;
      cursor: pointer;
      transition: border-color .2s, color .2s;
    }
    .btn-load-more:hover { border-color: var(--blue); color: var(--text); }
    .btn-load-more:disabled { opacity: .4; cursor: not-allowed; }

    /* ── API Keys ──────────────────────────────── */
    .key-item {
      display: flex; align-items: center; justify-content: space-between;
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 8px; padding: 1rem 1.25rem; margin-bottom: .75rem;
    }
    .key-item:hover { border-color: #2a2a3e; }
    .key-name { font-weight: 600; font-size: .95rem; }
    .key-prefix { font-family: var(--mono); font-size: .85rem; color: var(--text-dim); }
    .key-meta { font-size: .8rem; color: var(--text-dim); margin-top: .25rem; }
    .new-key-display {
      background: rgba(34,197,94,.08); border: 1px solid rgba(34,197,94,.25);
      border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;
      font-family: var(--mono); font-size: .85rem; word-break: break-all;
    }
    .new-key-display strong { color: var(--green); }
    .new-key-warning { font-size: .8rem; color: var(--yellow); margin-top: .5rem; font-family: var(--font); }
    .key-form {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 12px; padding: 1.5rem; margin-top: 1.5rem;
    }
    .key-form h3 { font-size: 1rem; font-weight: 600; margin-bottom: 1rem; }
    .btn-create-key {
      background: linear-gradient(135deg, var(--blue), var(--purple));
      color: #fff; border: none; padding: .7rem 1.5rem;
      border-radius: 8px; font-size: .9rem; font-weight: 600; cursor: pointer;
      margin-top: .75rem;
    }
    .btn-copy {
      background: var(--bg-card); border: 1px solid var(--border);
      color: var(--text-dim); padding: .3rem .6rem; border-radius: 4px;
      font-size: .75rem; cursor: pointer; margin-left: .5rem;
    }
    .btn-copy:hover { border-color: var(--blue); color: var(--blue); }

    /* ── Stats bar ────────────────────────────── */
    .stats-row {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 1rem; margin-bottom: 1.5rem;
    }
    .stat-card {
      background: var(--bg-card); border: 1px solid var(--border);
      border-radius: 10px; padding: 1rem; text-align: center;
    }
    .stat-card-num {
      font-size: 1.75rem; font-weight: 800; letter-spacing: -.02em;
    }
    .stat-card-num.blue { color: var(--blue); }
    .stat-card-num.green { color: var(--green); }
    .stat-card-num.red { color: var(--red); }
    .stat-card-num.yellow { color: var(--yellow); }
    .stat-card-label { font-size: .75rem; color: var(--text-dim); margin-top: .25rem; }

    /* ── Mobile ────────────────────────────────── */
    @media (min-width: 520px) {
      .form-row {
        grid-template-columns: 2fr 1fr 1fr;
      }
    }
    @media (max-width: 640px) {
      .header { padding: .75rem 1rem; }
      .container { padding: 1rem; }
      .header-username { display: none; }
      .tabs { padding: 0 1rem; }
      .audit-table { font-size: .75rem; }
      .audit-table th, .audit-table td { padding: .5rem .35rem; }
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header">
    <a href="/" class="header-logo">Gate<span>Code</span></a>
    <div class="header-user">
      <span class="header-plan">${user.plan}</span>
      <span class="header-username">@${user.username}</span>
      ${user.avatar_url
        ? html`<img class="header-avatar" src="${user.avatar_url}" alt="${user.username}" />`
        : html`<div class="header-avatar" style="background:var(--border);"></div>`
      }
      <button class="btn-logout" onclick="logout()">Logout</button>
    </div>
  </div>

  <!-- Tabs -->
  <div class="tabs">
    <button class="tab active" data-tab="pending">Pending Requests</button>
    <button class="tab" data-tab="rules">Rules</button>
    <button class="tab" data-tab="audit">Audit Log</button>
    <button class="tab" data-tab="keys">API Keys</button>
  </div>

  <div class="container">

    <!-- Stats -->
    <div class="stats-row" id="stats-row">
      <div class="stat-card"><div class="stat-card-num yellow" id="stat-pending">${pending.length}</div><div class="stat-card-label">Pending</div></div>
      <div class="stat-card"><div class="stat-card-num green" id="stat-approved">-</div><div class="stat-card-label">Approved (24h)</div></div>
      <div class="stat-card"><div class="stat-card-num red" id="stat-denied">-</div><div class="stat-card-label">Denied (24h)</div></div>
      <div class="stat-card"><div class="stat-card-num blue" id="stat-rules">${rules.length}</div><div class="stat-card-label">Active Rules</div></div>
    </div>

    <!-- Pending Requests -->
    <div id="panel-pending" class="tab-panel active">
      <div class="sse-indicator">
        <div class="sse-dot" id="sse-dot"></div>
        <span id="sse-status">Connecting...</span>
      </div>
      <div id="pending-list"></div>
    </div>

    <!-- Rules -->
    <div id="panel-rules" class="tab-panel">
      <div id="rules-list"></div>

      <div class="rule-form">
        <h3>Add Rule</h3>
        <div class="form-row">
          <div class="form-field">
            <label for="rule-pattern">Pattern</label>
            <input id="rule-pattern" type="text" placeholder="org/* or exact/repo" />
          </div>
          <div class="form-field">
            <label for="rule-scope">Scope</label>
            <select id="rule-scope">
              <option value="read">read</option>
              <option value="write">write</option>
            </select>
          </div>
          <div class="form-field">
            <label for="rule-action">Action</label>
            <select id="rule-action">
              <option value="auto_approve">auto_approve</option>
              <option value="auto_deny">auto_deny</option>
              <option value="ask">ask</option>
            </select>
          </div>
        </div>
        <button class="btn-add-rule" onclick="addRule()">Add Rule</button>
        ${user.plan === "free"
          ? html`<div class="pro-note">Auto-approve and auto-deny rules require the Pro plan. Rules with action &quot;ask&quot; work on all plans.</div>`
          : ""
        }
      </div>
    </div>

    <!-- Audit Log -->
    <div id="panel-audit" class="tab-panel">
      <div class="audit-table-wrap">
        <table class="audit-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Agent</th>
              <th>Repo</th>
              <th>Scope</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="audit-body"></tbody>
        </table>
      </div>
      <button class="btn-load-more" id="btn-load-more" onclick="loadMoreAudit()">Load More</button>
    </div>

    <!-- API Keys -->
    <div id="panel-keys" class="tab-panel">
      <div id="new-key-banner"></div>
      <div id="keys-list"></div>
      <div class="key-form">
        <h3>Create API Key</h3>
        <div class="form-field" style="margin-bottom:.75rem">
          <label for="key-name">Key Name</label>
          <input id="key-name" type="text" placeholder="e.g. claude-code-laptop" />
        </div>
        <button class="btn-create-key" onclick="createKey()">Generate Key</button>
      </div>
    </div>

  </div>

  <script>
    // ── Data from server ────────────────────────
    var pendingRequests = ${pendingJson};
    var currentRules = ${rulesJson};
    var auditEntries = ${auditJson};
    var auditOffset = auditEntries.length;
    var userPlan = '${user.plan}';

    // ── Helpers ─────────────────────────────────
    function timeAgo(dateStr) {
      var now = Date.now();
      var then = new Date(dateStr).getTime();
      var diff = Math.floor((now - then) / 1000);
      if (diff < 60) return diff + 's ago';
      if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
      if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
      return Math.floor(diff / 86400) + 'd ago';
    }

    function esc(str) {
      var d = document.createElement('div');
      d.textContent = str || '';
      return d.innerHTML;
    }

    function scopeBadgeClass(scope) {
      return scope === 'write' ? 'badge-write' : 'badge-read';
    }

    function actionBadgeClass(action) {
      if (action === 'approved') return 'badge-approved';
      if (action === 'denied') return 'badge-denied';
      if (action === 'auto_approved') return 'badge-auto_approved';
      if (action === 'auto_denied') return 'badge-auto_denied';
      return 'badge-pending';
    }

    // ── Tab switching ───────────────────────────
    document.querySelectorAll('.tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
        document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.remove('active'); });
        tab.classList.add('active');
        document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
      });
    });

    // ── Render pending requests ─────────────────
    function renderPending() {
      var list = document.getElementById('pending-list');
      if (pendingRequests.length === 0) {
        list.innerHTML = '<div class="empty-state"><span class="emoji">&#127881;</span>No pending requests. Your AI agents are behaving!</div>';
        return;
      }
      list.innerHTML = pendingRequests.map(function(p) {
        return '<div class="request-card" id="req-' + p.id + '">' +
          '<div class="request-header">' +
            '<span class="request-agent">' + esc(p.agent_id) + '</span>' +
            '<span class="request-time">' + timeAgo(p.created_at) + '</span>' +
          '</div>' +
          '<div class="request-meta">' +
            '<span class="badge badge-repo">' + esc(p.repo) + '</span>' +
            '<span class="badge ' + scopeBadgeClass(p.scope) + '">' + p.scope + '</span>' +
          '</div>' +
          (p.reason ? '<div class="request-reason">&ldquo;' + esc(p.reason) + '&rdquo;</div>' : '') +
          '<div class="request-actions">' +
            '<button class="btn-approve" onclick="resolveRequest(' + p.id + ', \'approve\', this)">Allow</button>' +
            '<button class="btn-deny" onclick="resolveRequest(' + p.id + ', \'deny\', this)">Deny</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }

    renderPending();

    // ── Render rules ────────────────────────────
    function renderRules() {
      var list = document.getElementById('rules-list');
      if (currentRules.length === 0) {
        list.innerHTML = '<p style="color:var(--text-dim);padding:1rem 0;">No rules configured yet.</p>';
        return;
      }
      list.innerHTML = currentRules.map(function(r) {
        return '<div class="rule-item" id="rule-' + r.id + '">' +
          '<div class="rule-info">' +
            '<span class="rule-pattern">' + esc(r.pattern) + '</span>' +
            '<span class="badge ' + scopeBadgeClass(r.scope) + '">' + r.scope + '</span>' +
            '<span class="badge ' + actionBadgeClass(r.action) + '">' + r.action.replace('_', ' ') + '</span>' +
          '</div>' +
          '<button class="btn-delete-rule" onclick="deleteRule(' + r.id + ')">Delete</button>' +
        '</div>';
      }).join('');
    }

    renderRules();

    // ── Render audit log ────────────────────────
    function renderAudit(entries, append) {
      var tbody = document.getElementById('audit-body');
      var rows = entries.map(function(e) {
        return '<tr>' +
          '<td class="mono">' + new Date(e.timestamp).toLocaleString() + '</td>' +
          '<td class="mono">' + esc(e.agent_id) + '</td>' +
          '<td class="mono">' + esc(e.repo) + '</td>' +
          '<td><span class="badge ' + scopeBadgeClass(e.scope) + '">' + e.scope + '</span></td>' +
          '<td><span class="badge ' + actionBadgeClass(e.action) + '">' + e.action.replace('_', ' ') + '</span></td>' +
        '</tr>';
      }).join('');
      if (append) {
        tbody.innerHTML += rows;
      } else {
        tbody.innerHTML = rows;
      }
    }

    renderAudit(auditEntries, false);

    // ── SSE connection ──────────────────────────
    var sseSource = null;

    function connectSSE() {
      if (sseSource) { sseSource.close(); }
      sseSource = new EventSource('/api/pending');
      var dot = document.getElementById('sse-dot');
      var status = document.getElementById('sse-status');

      sseSource.onopen = function() {
        dot.className = 'sse-dot connected';
        status.textContent = 'Live';
      };

      sseSource.onerror = function() {
        dot.className = 'sse-dot disconnected';
        status.textContent = 'Reconnecting...';
      };

      sseSource.addEventListener('new_request', function(e) {
        var p = JSON.parse(e.data);
        // Avoid duplicates
        var exists = pendingRequests.some(function(r) { return r.id === p.id; });
        if (!exists) {
          pendingRequests.unshift(p);
          renderPending();
        }
      });

      sseSource.addEventListener('request_resolved', function(e) {
        var data = JSON.parse(e.data);
        pendingRequests = pendingRequests.filter(function(r) { return r.id !== data.id; });
        // Animate out
        var card = document.getElementById('req-' + data.id);
        if (card) {
          card.style.opacity = '0';
          card.style.transform = 'translateX(30px)';
          setTimeout(function() { renderPending(); }, 300);
        } else {
          renderPending();
        }
      });

      sseSource.addEventListener('approved', function(e) {
        var data = JSON.parse(e.data);
        pendingRequests = pendingRequests.filter(function(r) { return r.id !== data.id; });
        renderPending();
      });

      sseSource.addEventListener('denied', function(e) {
        var data = JSON.parse(e.data);
        pendingRequests = pendingRequests.filter(function(r) { return r.id !== data.id; });
        renderPending();
      });
    }

    connectSSE();

    // ── Approve / Deny ──────────────────────────
    function resolveRequest(id, action, btn) {
      var url = action === 'approve'
        ? '/api/approve/' + id
        : '/api/deny/' + id;

      // Disable both buttons in the card
      var card = document.getElementById('req-' + id);
      if (card) {
        var buttons = card.querySelectorAll('button');
        buttons.forEach(function(b) { b.disabled = true; });
      }
      btn.textContent = '...';

      fetch(url, { method: 'POST', credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          pendingRequests = pendingRequests.filter(function(r) { return r.id !== id; });
          if (card) {
            card.style.opacity = '0';
            card.style.transform = action === 'approve' ? 'translateX(-30px)' : 'translateX(30px)';
            setTimeout(function() { renderPending(); }, 300);
          } else {
            renderPending();
          }
        })
        .catch(function(err) {
          console.error('Failed to ' + action, err);
          if (card) {
            var buttons = card.querySelectorAll('button');
            buttons.forEach(function(b) { b.disabled = false; });
          }
          btn.textContent = action === 'approve' ? 'Allow' : 'Deny';
        });
    }

    // ── Rules CRUD ──────────────────────────────
    function addRule() {
      var pattern = document.getElementById('rule-pattern').value.trim();
      var scope = document.getElementById('rule-scope').value;
      var action = document.getElementById('rule-action').value;
      if (!pattern) return;

      fetch('/api/rules', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: pattern, scope: scope, action: action })
      })
        .then(function(r) { return r.json(); })
        .then(function(rule) {
          if (rule.error) { alert(rule.error); return; }
          currentRules.unshift(rule);
          renderRules();
          document.getElementById('rule-pattern').value = '';
        })
        .catch(function(err) { console.error('Failed to add rule', err); });
    }

    function deleteRule(id) {
      fetch('/api/rules/' + id, { method: 'DELETE', credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function() {
          currentRules = currentRules.filter(function(r) { return r.id !== id; });
          renderRules();
        })
        .catch(function(err) { console.error('Failed to delete rule', err); });
    }

    // ── Audit Log Loading ───────────────────────
    function loadMoreAudit() {
      var btn = document.getElementById('btn-load-more');
      btn.textContent = 'Loading...';
      btn.disabled = true;

      fetch('/api/audit?limit=50&offset=' + auditOffset, { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var entries = Array.isArray(data) ? data : (data.entries || data.data || []);
          if (entries.length === 0) {
            btn.textContent = 'No more entries';
            return;
          }
          renderAudit(entries, true);
          auditOffset += entries.length;
          btn.textContent = 'Load More';
          btn.disabled = false;
        })
        .catch(function(err) {
          console.error('Failed to load audit', err);
          btn.textContent = 'Load More';
          btn.disabled = false;
        });
    }

    // ── API Keys ─────────────────────────────────
    var apiKeys = [];

    function loadKeys() {
      fetch('/api/keys', { credentials: 'same-origin' })
        .then(function(r) { return r.json(); })
        .then(function(keys) {
          apiKeys = keys;
          renderKeys();
        });
    }

    function renderKeys() {
      var list = document.getElementById('keys-list');
      if (apiKeys.length === 0) {
        list.innerHTML = '<p style="color:var(--text-dim);padding:1rem 0;">No API keys. Create one to let your AI agents authenticate.</p>';
        return;
      }
      list.innerHTML = apiKeys.map(function(k) {
        return '<div class="key-item">' +
          '<div>' +
            '<div class="key-name">' + esc(k.name) + '</div>' +
            '<div class="key-prefix">' + esc(k.key_prefix) + '...' + '</div>' +
            '<div class="key-meta">Created ' + timeAgo(k.created_at) +
              (k.last_used_at ? ' · Last used ' + timeAgo(k.last_used_at) : ' · Never used') +
            '</div>' +
          '</div>' +
          '<button class="btn-delete-rule" onclick="deleteKey(' + k.id + ')">Revoke</button>' +
        '</div>';
      }).join('');
    }

    function createKey() {
      var name = document.getElementById('key-name').value.trim();
      if (!name) { alert('Enter a name for this key'); return; }
      fetch('/api/keys', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name })
      })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          if (data.error) { alert(data.error); return; }
          document.getElementById('new-key-banner').innerHTML =
            '<div class="new-key-display">' +
              '<strong>Your new API key (copy it now!):</strong><br>' +
              '<code>' + esc(data.key) + '</code>' +
              '<button class="btn-copy" onclick="navigator.clipboard.writeText(\'' + data.key + '\');this.textContent=\'Copied!\'">Copy</button>' +
              '<div class="new-key-warning">This key will not be shown again. Store it securely.</div>' +
            '</div>';
          document.getElementById('key-name').value = '';
          loadKeys();
        });
    }

    function deleteKey(id) {
      if (!confirm('Revoke this API key? Any agents using it will lose access.')) return;
      fetch('/api/keys/' + id, { method: 'DELETE', credentials: 'same-origin' })
        .then(function() { loadKeys(); });
    }

    // Load keys when tab is clicked
    document.querySelector('[data-tab="keys"]').addEventListener('click', function() {
      loadKeys();
    });

    // ── Stats ───────────────────────────────────
    fetch('/api/audit?limit=100', { credentials: 'same-origin' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var entries = data.data || data || [];
        var cutoff = Date.now() - 86400000;
        var approved = 0, denied = 0;
        entries.forEach(function(e) {
          var t = new Date(e.timestamp).getTime();
          if (t > cutoff) {
            if (e.action === 'approved' || e.action === 'auto_approved') approved++;
            if (e.action === 'denied' || e.action === 'auto_denied') denied++;
          }
        });
        document.getElementById('stat-approved').textContent = approved;
        document.getElementById('stat-denied').textContent = denied;
      });

    // ── Logout ──────────────────────────────────
    function logout() {
      document.cookie = 'session=; Max-Age=0; path=/;';
      window.location.href = '/';
    }
  </script>

</body>
</html>`
  );
};
