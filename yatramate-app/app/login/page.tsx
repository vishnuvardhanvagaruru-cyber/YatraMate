"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function checkAccount() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.getUser();

        if (!active) return;

        if (!error && data.user) {
          setSignedInEmail(data.user.email ?? "Your account");
        }

        const confirmation = new URLSearchParams(
          window.location.search
        ).get("confirmation");

        if (confirmation === "success") {
          setMessage("Email confirmed. You can now use your account.");
        } else if (confirmation === "failed") {
          setError(
            "The confirmation link could not complete sign-in. Try logging in. If your email is still unconfirmed, request a new confirmation email."
          );
        }
      } catch {
        if (active) {
          setError("Could not connect. Check your Supabase settings.");
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    }

    void checkAccount();

    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const supabase = createClient();

      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) throw error;

        if (data.session) {
          setSignedInEmail(data.user?.email ?? email.trim());
          setMessage("Your account is ready.");
        } else {
          setMessage(
            "Check your inbox for a confirmation email. Open the link in this same browser, then return here to log in. If you already have an account, use Log in."
          );
        }
      } else {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          });

        if (error) throw error;

        setSignedInEmail(data.user.email ?? email.trim());
        setMessage("You are signed in.");
      }

      setPassword("");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const { error } = await createClient().auth.resend({
        type: "signup",
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) throw error;

      setMessage("Confirmation email requested. Check your inbox.");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Please try again."
      );
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const { error } = await createClient().auth.signOut();

      if (error) throw error;

      setSignedInEmail(null);
      setPassword("");
      setMessage("You have signed out.");
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const inputStyle =
    "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-teal-50 px-5 py-12 text-slate-900">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <Link href="/" className="text-xl font-bold text-teal-700">
          YatraMate
        </Link>

        <h1 className="mt-7 text-3xl font-bold">
          {checking
            ? "Checking your account…"
            : signedInEmail
              ? "You’re signed in"
              : mode === "signup"
                ? "Start your journey"
                : "Welcome back"}
        </h1>

        {message && (
          <p
            role="status"
            className="mt-5 text-sm leading-6 text-teal-800"
          >
            {message}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-5 text-sm leading-6 text-red-700"
          >
            {error}
          </p>
        )}

        {!checking && signedInEmail && (
          <div className="mt-6 space-y-5">
            <p className="break-all text-slate-600">
              {signedInEmail}
            </p>

            <Link
              href="/"
              className="block rounded-xl bg-teal-700 px-5 py-3 text-center font-semibold text-white hover:bg-teal-800"
            >
              Go to trip planner
            </Link>

            <button
              type="button"
              onClick={signOut}
              disabled={busy}
              className="w-full rounded-xl border border-slate-300 px-5 py-3 disabled:opacity-50"
            >
              {busy ? "Please wait…" : "Sign out"}
            </button>
          </div>
        )}

        {!checking && !signedInEmail && (
          <>
            <form onSubmit={submit} className="mt-7 space-y-5">
              <label className="block text-sm font-semibold">
                Email address
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  disabled={busy}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className={inputStyle}
                />
              </label>

              <label className="block text-sm font-semibold">
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete={
                    mode === "signup"
                      ? "new-password"
                      : "current-password"
                  }
                  minLength={mode === "signup" ? 8 : undefined}
                  required
                  disabled={busy}
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  className={inputStyle}
                />
              </label>

              {mode === "signup" && (
                <p className="text-sm text-slate-500">
                  Use at least 8 characters.
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {busy
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create account"
                    : "Log in"}
              </button>
            </form>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode(mode === "login" ? "signup" : "login");
                setPassword("");
                setError("");
                setMessage("");
              }}
              className="mt-6 w-full text-sm font-semibold text-teal-700 disabled:opacity-50"
            >
              {mode === "login"
                ? "New to YatraMate? Create an account"
                : "Already have an account? Log in"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={resendConfirmation}
              className="mt-4 w-full text-sm text-slate-600 underline disabled:opacity-50"
            >
              Resend confirmation email
            </button>
          </>
        )}
      </section>
    </main>
  );
}