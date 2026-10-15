"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "../../lib/supabase/client";

export default function AccountHeader() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let changed = false;
    let unsubscribe = () => {};

    try {
      const supabase = createClient();

      const { data } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (!active || event === "INITIAL_SESSION") return;

          changed = true;
          setUser(session?.user ?? null);
          setLoading(false);
        }
      );

      unsubscribe = () => data.subscription.unsubscribe();

      void supabase.auth
        .getUser()
        .then(({ data, error }) => {
          if (!active || changed) return;

          setUser(data.user ?? null);

          if (error && error.name !== "AuthSessionMissingError") {
            setError("Could not check your account. Please reload.");
          }

          setLoading(false);
        })
        .catch(() => {
          if (!active || changed) return;

          setError("Could not connect. Please reload.");
          setLoading(false);
        });
    } catch {
      // Defer state updates until after the effect setup.
      queueMicrotask(() => {
        if (!active) return;
        setError("Check your Supabase connection settings.");
        setLoading(false);
      });
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function logout() {
    setBusy(true);
    setError("");

    try {
      const { error } = await createClient().auth.signOut({
        scope: "local",
      });

      if (error) throw error;

      // Reload the page so account-specific screen data is cleared.
      window.location.assign("/");
    } catch {
      setError("Could not log out. Please try again.");
      setBusy(false);
    }
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900"
        >
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white"
          >
            Y
          </span>
          YatraMate
        </Link>

        <nav
          aria-label="Main navigation"
          className="flex flex-wrap items-center gap-3"
        >
          <Link
            href="/#planner"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Plan a trip
          </Link>

          {loading ? (
            <span className="text-sm text-slate-500">
              Checking account…
            </span>
          ) : user ? (
            <>
              <Link
                href="/profile"
                className="rounded-full bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
              >
                Profile
              </Link>

              <button
                type="button"
                onClick={logout}
                disabled={busy}
                className="rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {busy ? "Logging out…" : "Logout"}
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
            >
              Login / Sign up
            </Link>
          )}
        </nav>
      </div>

      {error && (
        <p
          role="alert"
          className="mx-auto max-w-6xl px-5 pb-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
    </header>
  );
}