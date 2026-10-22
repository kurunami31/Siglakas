"use client";

import { Suspense } from "react";
import { CrewSignIn } from "@/components/crew-sign-in";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md py-8">
      <Suspense fallback={<div className="panel rounded-2xl p-6 text-sm text-foam/70">Loading sign-in…</div>}>
        <CrewSignIn />
      </Suspense>
    </div>
  );
}
