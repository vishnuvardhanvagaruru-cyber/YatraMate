"use client";

import { useRef, useState, type FormEvent } from "react";
import { createClient } from "../../lib/supabase/client";

export type SavedTrip = {
  id: string;
  destination: string;
  start_date: string;
  days: number;
  travelers: number;
  budget: number;
  itinerary: string[];
  created_at: string;
};

export const tripColumns =
  "id, destination, start_date, days, travelers, budget, itinerary, created_at";

export function formatDate(value: string) {
  const date = new Date(
    value.length === 10 ? `${value}T00:00:00` : value
  );

  if (Number.isNaN(date.getTime())) return "Not available";

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

type Props = {
  trip: SavedTrip;
  ownerId: string;
  locked: boolean;
  onActiveChange: (active: boolean) => void;
  onSaved: (trip: SavedTrip) => void;
  onDeleted: (id: string) => void;
};

const inputStyle =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

const primaryButton =
  "rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50";

const secondaryButton =
  "rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50";

export default function TripCard({
  trip,
  ownerId,
  locked,
  onActiveChange,
  onSaved,
  onDeleted,
}: Props) {
  const [mode, setMode] = useState<"view" | "edit" | "delete">(
    "view"
  );
  const [days, setDays] = useState(String(trip.days));
  const [plans, setPlans] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const pending = useRef(false);

  const requestedDays = Number(days);

  const validDays =
    Number.isInteger(requestedDays) &&
    requestedDays >= 1 &&
    requestedDays <= 30;

  const visibleDays = validDays ? requestedDays : trip.days;

  function startEditing() {
    setDays(String(trip.days));

    setPlans(
      Array.from(
        { length: 30 },
        (_, index) => trip.itinerary[index] ?? ""
      )
    );

    setError("");
    setMessage("");
    setMode("edit");
    onActiveChange(true);
  }

  function startDeleting() {
    setError("");
    setMessage("");
    setMode("delete");
    onActiveChange(true);
  }

  function cancel() {
    if (pending.current) return;

    setMode("view");
    setError("");
    setMessage("");
    onActiveChange(false);
  }

  async function verifyAccount() {
    const supabase = createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user || user.id !== ownerId) {
      throw new Error(
        "Your account session changed. Please log in again."
      );
    }

    return { supabase, user };
  }

  async function saveChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (pending.current) return;

    const form = new FormData(event.currentTarget);

    const startDate = String(form.get("startDate") ?? "");
    const travelersText = String(form.get("travelers") ?? "");
    const budgetText = String(form.get("budget") ?? "");

    const travelers = Number(travelersText);
    const budget = Number(budgetText);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      !validDays ||
      !travelersText ||
      !Number.isInteger(travelers) ||
      travelers < 1 ||
      travelers > 50 ||
      !budgetText ||
      !Number.isFinite(budget) ||
      budget < 0 ||
      budget > 100000000
    ) {
      setError("Please check your trip details.");
      return;
    }

    const itinerary = plans
      .slice(0, requestedDays)
      .map((text) => text.trim());

    if (
      itinerary.length !== requestedDays ||
      itinerary.some((text) => !text || text.length > 3000)
    ) {
      setError(
        "Enter a plan for every day, using up to 3,000 characters per day."
      );
      return;
    }

    const removesPlans = plans
      .slice(requestedDays)
      .some((text) => text.trim());

    if (
      removesPlans &&
      !window.confirm(
        `Saving ${requestedDays} days will remove the plans for later days. Continue?`
      )
    ) {
      return;
    }

    pending.current = true;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const { supabase, user } = await verifyAccount();

      const { data, error } = await supabase
        .from("trips")
        .update({
          start_date: startDate,
          days: requestedDays,
          travelers,
          budget,
          itinerary,
        })
        .eq("id", trip.id)
        .eq("user_id", user.id)
        .select(tripColumns)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error("The update could not be confirmed.");
      }

      onSaved(data as SavedTrip);
      setMode("view");
      onActiveChange(false);
      setMessage("Your trip changes have been saved.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save. Please try again."
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function deleteTrip() {
    if (pending.current) return;

    pending.current = true;
    setBusy(true);
    setError("");

    try {
      const { supabase, user } = await verifyAccount();

      const { data, error } = await supabase
        .from("trips")
        .delete()
        .eq("id", trip.id)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error(
          "This trip was not found or is no longer accessible. Cancel and refresh your profile."
        );
      }

      onActiveChange(false);
      onDeleted(data.id);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not delete. Please try again."
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="break-words text-xl font-bold">
            {trip.destination}
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {formatDate(trip.start_date)} · {trip.days}{" "}
            {trip.days === 1 ? "day" : "days"} · {trip.travelers}{" "}
            {trip.travelers === 1 ? "traveler" : "travelers"}
          </p>
        </div>

        <div className="rounded-xl bg-teal-50 px-4 py-3">
          <p className="text-xs text-slate-500">Total budget</p>

          <p className="mt-1 font-bold text-teal-800">
            ₹{Number(trip.budget).toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {message && (
        <p role="status" className="mt-4 text-sm text-teal-700">
          {message}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-700">
          {error}
        </p>
      )}

      {mode === "edit" && (
        <form onSubmit={saveChanges} className="mt-6">
          <fieldset disabled={busy} className="space-y-5">
            <legend className="sr-only">Edit trip details</legend>

            <p className="text-sm text-slate-600">
              Update the details and daily plans for your{" "}
              {trip.destination} trip.
            </p>

            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Start date
                <input
                  name="startDate"
                  type="date"
                  defaultValue={trip.start_date}
                  required
                  className={inputStyle}
                />
              </label>

              <label className="text-sm font-semibold">
                Number of days
                <input
                  name="days"
                  type="number"
                  min={1}
                  max={30}
                  step={1}
                  required
                  value={days}
                  onChange={(event) => setDays(event.target.value)}
                  className={inputStyle}
                />
              </label>

              <label className="text-sm font-semibold">
                Travelers
                <input
                  name="travelers"
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  required
                  defaultValue={trip.travelers}
                  className={inputStyle}
                />
              </label>

              <label className="text-sm font-semibold">
                Total budget (₹)
                <input
                  name="budget"
                  type="number"
                  min={0}
                  max={100000000}
                  step="0.01"
                  required
                  defaultValue={trip.budget}
                  className={inputStyle}
                />
              </label>
            </div>

            {validDays && requestedDays < trip.days && (
              <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
                Saving a shorter trip removes the extra days.
                Increasing the number again before saving restores
                their text.
              </p>
            )}

            {Array.from({ length: visibleDays }, (_, index) => (
              <label
                key={index}
                className="block rounded-xl bg-slate-50 p-4"
              >
                <span className="font-semibold text-teal-800">
                  Day {index + 1}
                </span>

                <textarea
                  value={plans[index] ?? ""}
                  onChange={(event) => {
                    const value = event.target.value;

                    setPlans((current) =>
                      current.map((plan, dayIndex) =>
                        dayIndex === index ? value : plan
                      )
                    );
                  }}
                  required
                  maxLength={3000}
                  rows={4}
                  placeholder="Add your plans for this day"
                  className={`${inputStyle} resize-y font-normal leading-7`}
                />
              </label>
            ))}

            <div className="flex flex-wrap gap-3">
              <button type="submit" className={primaryButton}>
                {busy ? "Saving…" : "Save changes"}
              </button>

              <button
                type="button"
                onClick={cancel}
                className={secondaryButton}
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      )}

      {mode === "delete" && (
        <div
          role="group"
          aria-label="Confirm trip deletion"
          className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5"
        >
          <h4 className="font-bold text-red-800">
            Delete this trip?
          </h4>

          <p className="mt-2 text-sm leading-6 text-red-700">
            This permanently deletes your {trip.destination} trip
            and its daily plans. You cannot undo this.
          </p>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={deleteTrip}
              disabled={busy}
              className="rounded-xl bg-red-700 px-5 py-3 font-semibold text-white hover:bg-red-800 disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Yes, delete trip"}
            </button>

            <button
              type="button"
              onClick={cancel}
              disabled={busy}
              className={secondaryButton}
            >
              Keep trip
            </button>
          </div>
        </div>
      )}

      {mode === "view" && (
        <>
          <details className="mt-5 border-t border-slate-100 pt-4">
            <summary className="cursor-pointer font-semibold text-teal-700">
              View itinerary
            </summary>

            <ol className="mt-5 space-y-4">
              {trip.itinerary.map((activity, index) => (
                <li
                  key={index}
                  className="rounded-xl bg-slate-50 p-4"
                >
                  <h4 className="font-semibold text-teal-800">
                    Day {index + 1}
                  </h4>

                  <p className="mt-2 whitespace-pre-wrap break-words leading-7 text-slate-700">
                    {activity}
                  </p>
                </li>
              ))}
            </ol>
          </details>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startEditing}
              disabled={locked}
              className={secondaryButton}
            >
              Edit trip
            </button>

            <button
              type="button"
              onClick={startDeleting}
              disabled={locked}
              className="rounded-xl border border-red-200 px-5 py-3 font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Delete trip
            </button>
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Originally saved {formatDate(trip.created_at)}
      </p>
    </article>
  );
}