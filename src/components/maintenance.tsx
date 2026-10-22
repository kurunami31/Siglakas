"use client";

import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { CrewSignIn } from "@/components/crew-sign-in";

/**
 * The holding screen shown while the maintenance switch is on.
 *
 * It deliberately carries the sign-in form: maintenance closes `/login` along
 * with everything else, and the crew still has to be able to get back in to
 * finish the correction they closed the board for.
 *
 * It is `fixed` and opaque so that it also covers a viewer who already had the
 * board open — the provider mounts this on top of the page the instant the
 * switch flips, rather than trusting the render this component mounted with.
 */
export function MaintenanceScene({ competitionName }: { competitionName?: string }) {
  return (
    <main className="fixed inset-0 z-50 overflow-y-auto bg-ink/95 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-3 py-10 sm:px-5">
        <div className="panel rounded-2xl p-6 text-center">
          <p className="font-display flex items-center justify-center gap-2 text-3xl text-parchment">
            <Icon name="anchor" size={26} className="text-straw" /> Board under correction
          </p>
          <p className="mt-3 text-sm text-foam/85">
            The Secretariat is reconciling the tally{competitionName ? ` for ${competitionName}` : ""}. Every
            result and every medal at stake is being checked against the official sheets, so the board stays
            hidden until that is finished — a wrong number is worse than no number.
          </p>
          <p className="mt-3 text-sm text-foam/70">
            The Grand Line reopens as soon as the figures are signed off. Thanks for your patience.
          </p>
        </div>

        <Suspense fallback={null}>
          <CrewSignIn defaultNext="/admin" />
        </Suspense>

        <p className="text-center text-xs text-foam/55">
          Crew: signing in shows you the live board while the public board is closed.
        </p>
      </div>
    </main>
  );
}
