import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { updateDocRunStatus } from "@/lib/billing/run-tracker";

/**
 * POST /api/billing/webhook
 * Handles async Stripe events (payment confirmation, failure).
 * Configure in Stripe Dashboard: https://dashboard.stripe.com/webhooks
 */
export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature or webhook secret" }, { status: 400 });
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent> extends Promise<infer T> ? T : ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object as { metadata?: { sessionId?: string }; id: string };
      const sessionId = pi.metadata?.sessionId;
      if (sessionId) {
        await updateDocRunStatus(sessionId, "paid", pi.id);
      }
      break;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object as { metadata?: { sessionId?: string } };
      const sessionId = pi.metadata?.sessionId;
      if (sessionId) {
        await updateDocRunStatus(sessionId, "abandoned");
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

export const config = {
  api: { bodyParser: false },
};
