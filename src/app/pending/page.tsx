"use client";

import { useEffect, useState } from "react";

export default function PendingPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      for (let i = 0; i < 20; i++) {
        if (cancelled) return;
        try {
          const res = await fetch("/api/check-role");
          const data = await res.json();
          if (data.role) {
            setReady(true);
            return;
          }
        } catch {
          // ignore fetch errors, keep polling
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    poll();
    return () => { cancelled = true; };
  }, []);

  function handleContinue() {
    window.location.href = "/player/deposits";
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center space-y-6 max-w-md mx-4">
        <h1 className="text-3xl font-bold tracking-tight text-black">
          Welcome to VRB Cashier
        </h1>
        <p className="text-gray-600 text-base leading-relaxed">
          Here you&apos;ll be able to make deposits through multiple payment
          methods and request your payouts quickly and safely — all in one
          place.
        </p>
        <p className="text-sm text-gray-400">
          {ready ? "Your account is ready." : "Finishing account setup…"}
        </p>
        <button
          onClick={handleContinue}
          disabled={!ready}
          className="inline-block bg-black text-white px-8 py-3 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
