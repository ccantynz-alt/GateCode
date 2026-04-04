// Stripe API helper — zero dependencies, just fetch

const STRIPE_API = 'https://api.stripe.com/v1';

// Helper to make Stripe API calls with form-encoded body
async function stripeRequest(
  secretKey: string,
  method: string,
  path: string,
  body?: Record<string, string>
): Promise<any> {
  const headers: Record<string, string> = {
    'Authorization': `Bearer ${secretKey}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  const options: RequestInit = { method, headers };

  if (body) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(body)) {
      params.append(key, value);
    }
    options.body = params.toString();
  }

  const res = await fetch(`${STRIPE_API}${path}`, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(
      `Stripe API error ${res.status}: ${(data as any)?.error?.message ?? JSON.stringify(data)}`
    );
  }

  return data;
}

// Create a Stripe customer
export async function createStripeCustomer(
  secretKey: string,
  email: string,
  username: string
): Promise<{ id: string }> {
  return stripeRequest(secretKey, 'POST', '/customers', {
    email,
    'metadata[username]': username,
  });
}

// Create a Checkout Session for subscription
export async function createCheckoutSession(
  secretKey: string,
  opts: {
    customerId: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
  }
): Promise<{ url: string }> {
  return stripeRequest(secretKey, 'POST', '/checkout/sessions', {
    customer: opts.customerId,
    'line_items[0][price]': opts.priceId,
    'line_items[0][quantity]': '1',
    mode: 'subscription',
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
  });
}

// Create a Customer Portal session (for managing subscription)
export async function createPortalSession(
  secretKey: string,
  customerId: string,
  returnUrl: string
): Promise<{ url: string }> {
  return stripeRequest(secretKey, 'POST', '/billing_portal/sessions', {
    customer: customerId,
    return_url: returnUrl,
  });
}

// Map plan names to Stripe price IDs (placeholder — user sets real ones)
export const PRICE_IDS: Record<string, string> = {
  pro: 'price_pro_monthly',
  team: 'price_team_monthly',
  enterprise: 'price_enterprise_monthly',
};

// Reverse lookup: price ID -> plan name
export const PLAN_BY_PRICE: Record<string, string> = Object.fromEntries(
  Object.entries(PRICE_IDS).map(([plan, priceId]) => [priceId, plan])
);

// Verify Stripe webhook signature
// Uses the Stripe-Signature header format: t=timestamp,v1=signature
// Computes HMAC-SHA256 of `${timestamp}.${payload}` using the webhook secret
// Compares with the v1 signature from the header
// Uses Web Crypto API (available in Workers)
export async function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    // Parse signature header: t=timestamp,v1=sig1,v1=sig2,...
    const parts: Record<string, string[]> = {};
    for (const item of signature.split(',')) {
      const [key, ...rest] = item.split('=');
      const value = rest.join('=');
      if (!parts[key]) parts[key] = [];
      parts[key].push(value);
    }

    const timestamp = parts['t']?.[0];
    const signatures = parts['v1'] ?? [];

    if (!timestamp || signatures.length === 0) {
      return false;
    }

    // Compute expected signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signedPayload = `${timestamp}.${payload}`;
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(signedPayload)
    );

    // Convert to hex
    const expectedSig = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time comparison against any of the v1 signatures
    return signatures.some((sig) => timingSafeEqual(expectedSig, sig));
  } catch {
    return false;
  }
}

// Constant-time string comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
