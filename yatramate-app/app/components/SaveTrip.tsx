"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type Trip = {
  destination: string;
  startDate: string;
  days: number;
  travelers: number;
  budget: number;
  itinerary: string[];
};

export default function SaveTrip({ trip }: { trip: Trip }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [savedVersion, setSavedVersion] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  const saving = useRef(false);

  // Keep the same ID when retrying the same draft.
  const pendingSave = useRef<{
    version: string;
    id: string;
    userId: string;
  } | null>(null);

  const currentVersion = JSON.stringify(trip);
  const isSaved = savedVersion === currentVersion;

  async function saveTrip() {
    if (saving.current) return;

    saving.current = true;
    setBusy(true);
    setError("");
    setNeedsLogin(false);

    // Save a snapshot, even if the user edits while saving.
    const snapshot = {
      ...trip,
      itinerary: [...trip.itinerary],
    };
    const version = JSON.stringify(snapshot);

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        setNeedsLogin(true);
        throw new Error("Please sign in before saving your trip.");
      }

      if (
        pendingSave.current?.version !== version ||
        pendingSave.current?.userId !== user.id
      ) {
        pendingSave.current = {
          version,
          userId: user.id,
          id: crypto.randomUUID(),
        };
      }

      const { error: saveError } = await supabase
        .from("trips")
        .upsert(
          {
            id: pendingSave.current.id,
            user_id: user.id,
            destination: snapshot.destination,
            start_date: snapshot.startDate,
            days: snapshot.days,
            travelers: snapshot.travelers,
            budget: snapshot.budget,
            itinerary: snapshot.itinerary,
          },
          { onConflict: "id" }
        )
        .select("id")
        .single();

      if (saveError) {
        throw new Error(saveError.message);
      }

      setSavedVersion(version);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save your trip. Please try again."
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 rounded-2xl border border-teal-200 bg-white p-5">
      <button
        type="button"
        onClick={saveTrip}
        disabled={busy || isSaved}
        className="rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Saving…" : isSaved ? "Copy saved" : "Save a copy"}
      </button>

      <p role="status" className="mt-3 text-sm text-slate-600">
        {isSaved
          ? "This version is saved to your account."
          : "Save a copy before leaving. Saving an edited draft creates a new copy."}
      </p>

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {needsLogin && (
        <Link
          href="/login"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-semibold text-teal-700 underline"
        >
          Sign in in a new tab, then return here to save
        </Link>
      )}
    </div>
  );
}