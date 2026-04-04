// GateCode — Webhook notification system

// ── Generic webhook delivery ───────────────────────────────────────────

export async function sendWebhook(
  url: string,
  secret: string,
  event: string,
  payload: any
): Promise<boolean> {
  try {
    const body = JSON.stringify(payload);

    // Compute HMAC-SHA256 signature using Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const signature = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-GateCode-Event": event,
        "X-GateCode-Signature": `sha256=${signature}`,
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

// ── Slack Block Kit notification ───────────────────────────────────────

export interface NotificationData {
  agent_id: string;
  repo: string;
  scope: string;
  reason?: string;
  approveUrl: string;
  denyUrl: string;
}

export async function sendSlackNotification(
  webhookUrl: string,
  event: string,
  data: NotificationData
): Promise<boolean> {
  try {
    const blocks = [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: "New Permission Request",
          emoji: true,
        },
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Agent:*\n${data.agent_id}` },
          { type: "mrkdwn", text: `*Repo:*\n${data.repo}` },
          { type: "mrkdwn", text: `*Scope:*\n${data.scope}` },
          {
            type: "mrkdwn",
            text: `*Reason:*\n${data.reason || "No reason provided"}`,
          },
        ],
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: { type: "plain_text", text: "Approve", emoji: true },
            style: "primary",
            url: data.approveUrl,
          },
          {
            type: "button",
            text: { type: "plain_text", text: "Deny", emoji: true },
            style: "danger",
            url: data.denyUrl,
          },
        ],
      },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

// ── Discord embed notification ─────────────────────────────────────────

export async function sendDiscordNotification(
  webhookUrl: string,
  event: string,
  data: NotificationData
): Promise<boolean> {
  try {
    const embed = {
      title: "New Permission Request",
      color: 0x3b82f6,
      fields: [
        { name: "Agent", value: data.agent_id, inline: true },
        { name: "Repo", value: data.repo, inline: true },
        { name: "Scope", value: data.scope, inline: true },
        {
          name: "Reason",
          value: data.reason || "No reason provided",
          inline: false,
        },
      ],
      timestamp: new Date().toISOString(),
    };

    const components = [
      {
        type: 1, // Action Row
        components: [
          {
            type: 2, // Button
            style: 5, // Link
            label: "Approve",
            url: data.approveUrl,
          },
          {
            type: 2,
            style: 5,
            label: "Deny",
            url: data.denyUrl,
          },
        ],
      },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: [embed], components }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}
