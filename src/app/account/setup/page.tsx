"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? ""
);

interface BillingAddress {
  name: string;
  line1: string;
  line2: string;
  city: string;
  postalCode: string;
  country: string;
}

function SetupForm({
  clientSecret,
  billingAddress,
}: {
  clientSecret: string;
  billingAddress: BillingAddress;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError("");

    const { setupIntent, error: stripeError } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/account/setup/confirm`,
        payment_method_data: {
          billing_details: {
            name: billingAddress.name,
            address: {
              line1: billingAddress.line1,
              line2: billingAddress.line2 || undefined,
              city: billingAddress.city,
              postal_code: billingAddress.postalCode,
              country: billingAddress.country,
            },
          },
        },
      },
      redirect: "if_required",
    });

    if (stripeError) {
      setError(stripeError.message ?? "Zahlung fehlgeschlagen");
      setLoading(false);
      return;
    }

    if (setupIntent?.payment_method) {
      // Save to our DB
      const res = await fetch("/api/billing/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingAddress,
          paymentMethodId: setupIntent.payment_method,
        }),
      });
      if (res.ok) {
        router.push("/doc-gen");
      } else {
        setError("Speichern fehlgeschlagen. Bitte erneut versuchen.");
      }
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Zahlungsmethode
        </label>
        <div className="border border-gray-300 rounded-lg p-3">
          <PaymentElement
            options={{ layout: "tabs" }}
          />
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Wird gespeichert..." : "Zahlungsmethode speichern & weiter"}
      </button>
    </form>
  );
}

export default function AccountSetupPage() {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [step, setStep] = useState<"address" | "payment">("address");
  const [billingAddress, setBillingAddress] = useState<BillingAddress>({
    name: "",
    line1: "",
    line2: "",
    city: "",
    postalCode: "",
    country: "DE",
  });
  const [loadingSetup, setLoadingSetup] = useState(false);
  const [error, setError] = useState("");

  async function fetchSetupIntent() {
    setLoadingSetup(true);
    const res = await fetch("/api/billing/setup", { method: "POST", body: JSON.stringify({}) });
    const data = await res.json();
    if (data.clientSecret) {
      setClientSecret(data.clientSecret);
      setStep("payment");
    } else {
      setError("Fehler beim Laden des Zahlungsformulars.");
    }
    setLoadingSetup(false);
  }

  function handleAddressSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchSetupIntent();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Zahlungsmethode einrichten</h1>
            <p className="text-sm text-gray-500 mt-1">
              Du wirst nur für tatsächlich genutzte KI-Leistung berechnet. Du kannst ein Limit pro Dokumentgenerierung festlegen.
            </p>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                step === "address" ? "bg-blue-600 text-white" : "bg-green-500 text-white"
              }`}
            >
              {step === "address" ? "1" : "✓"}
            </div>
            <div className="flex-1 h-px bg-gray-200" />
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                step === "payment" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
              }`}
            >
              2
            </div>
          </div>

          {step === "address" && (
            <form onSubmit={handleAddressSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vollständiger Name</label>
                <input
                  required
                  value={billingAddress.name}
                  onChange={(e) => setBillingAddress((a) => ({ ...a, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresszeile 1</label>
                <input
                  required
                  value={billingAddress.line1}
                  onChange={(e) => setBillingAddress((a) => ({ ...a, line1: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Adresszeile 2 <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  value={billingAddress.line2}
                  onChange={(e) => setBillingAddress((a) => ({ ...a, line2: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PLZ</label>
                  <input
                    required
                    value={billingAddress.postalCode}
                    onChange={(e) => setBillingAddress((a) => ({ ...a, postalCode: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stadt</label>
                  <input
                    required
                    value={billingAddress.city}
                    onChange={(e) => setBillingAddress((a) => ({ ...a, city: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Land</label>
                <select
                  value={billingAddress.country}
                  onChange={(e) => setBillingAddress((a) => ({ ...a, country: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="DE">Deutschland</option>
                  <option value="AT">Österreich</option>
                  <option value="CH">Schweiz</option>
                  <option value="US">Vereinigte Staaten</option>
                  <option value="GB">Vereinigtes Königreich</option>
                </select>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loadingSetup}
                className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loadingSetup ? "Laden..." : "Weiter zur Zahlungsmethode"}
              </button>
            </form>
          )}

          {step === "payment" && clientSecret && (
            <Elements
              stripe={stripePromise}
              options={{ clientSecret, appearance: { theme: "stripe" } }}
            >
              <SetupForm clientSecret={clientSecret} billingAddress={billingAddress} />
            </Elements>
          )}

          <p className="text-xs text-gray-400 text-center mt-4">
            Zahlungsabwicklung gesichert durch Stripe. Du wirst erst nach dem Download eines Dokuments belastet.
          </p>
        </div>
      </div>
    </div>
  );
}
