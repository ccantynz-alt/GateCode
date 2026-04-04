// GateCode — Stripe billing routes

import { Hono } from "hono";
import type { Env } from "../types";
import { authMiddleware } from "../middleware/auth";
import {
  createStripeCustomer,
  createCheckoutSession,
  createPortalSession,
  verifyWebhookSignature,
  PRICE_IDS,
  PLAN_BY_PRICE,
} from "../lib/stripe";

const billing = new Hono<Env>();

// ── POST /api/billing/checkout — Create Stripe Checkout Session ────
billing.post("/api/billing/checkout", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = await c.req.json<{ plan: string }>();
  const plan = body.plan;

  if (!plan || !PRICE_IDS[plan]) {
    return c.json({ error: "Invalid plan. Must be one of: pro, team, enterprise" }, 400);
  }

  let customerId = user.stripe_customer_id;

  // Create Stripe customer if needed
  if (!customerId) {
    const customer = await createStripeCustomer(
      c.env.STRIPE_SECRET_KEY,
      user.email ?? `${user.username}@users.noreply.github.com`,
      user.username
    );
    customerId = customer.id;

    await c.env.DB.prepare(
      "UPDATE users SET stripe_customer_id = ? WHERE id = ?"
    )
      .bind(customerId, user.id)
      .run();
  }

  const session = await createCheckoutSession(c.env.STRIPE_SECRET_KEY, {
    customerId,
    priceId: PRICE_IDS[plan],
    successUrl: `${c.env.APP_URL}/dashboard?billing=success`,
    cancelUrl: `${c.env.APP_URL}/dashboard?billing=cancelled`,
  });

  return c.json({ url: session.url });
});

// ── POST /api/billing/portal — Create Stripe Customer Portal session ──
billing.post("/api/billing/portal", authMiddleware, async (c) => {
  const user = c.get("user");

  if (!user.stripe_customer_id) {
    return c.json({ error: "No billing account found. Subscribe to a plan first." }, 400);
  }

  const session = await createPortalSession(
    c.env.STRIPE_SECRET_KEY,
    user.stripe_customer_id,
    `${c.env.APP_URL}/dashboard`
  );

  return c.json({ url: session.url });
});

// ── POST /api/billing/webhook — Stripe webhook (NO auth, verify signature) ──
billing.post("/api/billing/webhook", async (c) => {
  const signature = c.req.header("Stripe-Signature");
  if (!signature) {
    return c.json({ error: "Missing Stripe-Signature header" }, 400);
  }

  const payload = await c.req.text();
  const valid = await verifyWebhookSignature(
    payload,
    signature,
    c.env.STRIPE_WEBHOOK_SECRET
  );

  if (!valid) {
    return c.json({ error: "Invalid webhook signature" }, 400);
  }

  const event = JSON.parse(payload) as {
    type: string;
    data: { object: Record<string, any> };
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const customerId = session.customer as string;

      // Look up the subscription to find the price ID
      const subscriptionId = session.subscription as string;
      if (subscriptionId) {
        // We need to determine the plan from the checkout session
        // The metadata or line items tell us the plan
        // For now, look up user and update based on the subscription
        await updatePlanByCustomer(c.env.DB, c.env.STRIPE_SECRET_KEY, customerId, subscriptionId);
      }
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const customerId = subscription.customer as string;
      const priceId = subscription.items?.data?.[0]?.price?.id as string;

      if (priceId) {
        const plan = PLAN_BY_PRICE[priceId] ?? "free";
        await c.env.DB.prepare(
          "UPDATE users SET plan = ? WHERE stripe_customer_id = ?"
        )
          .bind(plan, customerId)
          .run();
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId = subscription.customer as string;

      await c.env.DB.prepare(
        "UPDATE users SET plan = 'free' WHERE stripe_customer_id = ?"
      )
        .bind(customerId)
        .run();
      break;
    }
  }

  return c.json({ received: true });
});

// ── GET /api/billing/status — Current billing status ──────────────
billing.get("/api/billing/status", authMiddleware, async (c) => {
  const user = c.get("user");

  return c.json({
    plan: user.plan,
    stripe_customer_id: !!user.stripe_customer_id,
    has_subscription: user.plan !== "free",
  });
});

// ── Helper: Update plan from a subscription ID ───────────────────
async function updatePlanByCustomer(
  db: D1Database,
  secretKey: string,
  customerId: string,
  subscriptionId: string
): Promise<void> {
  // Fetch the subscription from Stripe to get the price ID
  const res = await fetch(
    `https://api.stripe.com/v1/subscriptions/${subscriptionId}`,
    {
      headers: { Authorization: `Bearer ${secretKey}` },
    }
  );
  const subscription = (await res.json()) as Record<string, any>;
  const priceId = subscription.items?.data?.[0]?.price?.id as string;

  if (priceId) {
    const plan = PLAN_BY_PRICE[priceId] ?? "free";
    await db
      .prepare("UPDATE users SET plan = ? WHERE stripe_customer_id = ?")
      .bind(plan, customerId)
      .run();
  }
}

export default billing;
