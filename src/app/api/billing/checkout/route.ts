import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { getDocRun, updateDocRunStatus } from "@/lib/billing/run-tracker";
import { isAdminUser } from "@/lib/admin-auth";

const MIN_CHARGE_EUR = 0.50; // Stripe minimum charge

/**
 * POST /api/billing/checkout
 * Charges the user for their current DocRun and returns confirmation.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isAdminUser(session)) {
    return NextResponse.json({ error: "Admins are not billed" }, { status: 400 });
  }

  const { sessionId } = (await request.json()) as { sessionId: string };
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }

  const run = await getDocRun(sessionId);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }
  if (run.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (run.status === "paid") {
    return NextResponse.json({ alreadyPaid: true, costEur: run.estimatedCostEur });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true, defaultPaymentMethodId: true },
  });

  if (!user?.stripeCustomerId || !user?.defaultPaymentMethodId) {
    return NextResponse.json(
      { error: "No payment method on file. Please complete billing setup." },
      { status: 402 }
    );
  }

  const chargeEur = Math.max(run.estimatedCostEur, MIN_CHARGE_EUR);
  const amountCents = Math.round(chargeEur * 100);

  await updateDocRunStatus(sessionId, "checked_out");

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "eur",
    customer: user.stripeCustomerId,
    payment_method: user.defaultPaymentMethodId,
    confirm: true,
    automatic_payment_methods: { enabled: true, allow_redirects: "never" },
    metadata: { sessionId, userId: session.user.id },
    description: `Auto Doc generation – session ${sessionId}`,
  });

  if (paymentIntent.status === "succeeded") {
    await updateDocRunStatus(sessionId, "paid", paymentIntent.id);
    return NextResponse.json({
      success: true,
      costEur: run.estimatedCostEur,
      chargedEur: chargeEur,
      paymentIntentId: paymentIntent.id,
    });
  }

  // Requires further action (3DS etc.) — return client_secret for frontend confirmation
  return NextResponse.json({
    requiresAction: true,
    clientSecret: paymentIntent.client_secret,
    costEur: run.estimatedCostEur,
  });
}
