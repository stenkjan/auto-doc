import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { isAdminUser } from "@/lib/admin-auth";

/**
 * POST /api/billing/setup
 * Creates a Stripe SetupIntent so the client can collect a payment method.
 * On confirm, saves stripeCustomerId + defaultPaymentMethodId to the User row.
 */
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (isAdminUser(session)) {
    return NextResponse.json({ error: "Admins do not need billing setup" }, { status: 400 });
  }

  const { billingAddress, paymentMethodId } = (await request.json()) as {
    billingAddress?: {
      name: string;
      line1: string;
      line2?: string;
      city: string;
      postalCode: string;
      country: string;
    };
    paymentMethodId?: string;
  };

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { stripeCustomerId: true, email: true, name: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let customerId = user.stripeCustomerId;

  // Create Stripe customer if not exists
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      name: user.name ?? undefined,
    });
    customerId = customer.id;
  }

  if (paymentMethodId && billingAddress) {
    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
    // Set as default
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
    // Save to DB
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        stripeCustomerId: customerId,
        defaultPaymentMethodId: paymentMethodId,
        billingAddress,
      },
    });
    return NextResponse.json({ success: true });
  }

  // Return a SetupIntent client secret for the payment element
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
  });

  // Save customer ID even before payment method is confirmed
  await prisma.user.update({
    where: { id: session.user.id },
    data: { stripeCustomerId: customerId },
  });

  return NextResponse.json({ clientSecret: setupIntent.client_secret });
}
