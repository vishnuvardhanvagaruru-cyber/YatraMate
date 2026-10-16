"use client";

import Link from "next/link";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { User } from "@supabase/supabase-js";
import AccountHeader from "../components/AccountHeader";
import ProfileEditor from "../components/ProfileEditor";
import { createClient } from "../../lib/supabase/client";

type SavedTrip = {
  id: string;
  destination: string;
  start_date: string;
  days: number;
  travelers: number;
  budget: number;
  itinerary: string[];
  created_at: string;
};

type ProfileData = {
  user: User | null;
  trips: SavedTrip[];
  loading: boolean;
  error: string;
};

const tripColumns =
  "id, destination, start_date, days, travelers, budget, itinerary, created_at";

function formatDate(value: string) {
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

type TripCardProps = {
  trip: SavedTrip;
  ownerId: string;
  editing: boolean;
  anotherTripIsEditing: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
  onSaved: (trip: SavedTrip) => void;
};

function TripCard({
  trip,
  ownerId,
  editing,
  anotherTripIsEditing,
  onStartEditing,
  onStopEditing,
  onSaved,
}: TripCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const saving = useRef(false);

  function startEditing() {
    setError("");
    setMessage("");
    onStartEditing();
  }

  function cancelEditing() {
    setError("");
    setMessage("");
    onStopEditing();
  }

  async function saveChanges(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving.current) return;

    const form = new FormData(event.currentTarget);

    const itinerary = trip.itinerary.map((_, index) =>
      String(form.get(`day-${index}`) ?? "").trim()
    );

    if (
      itinerary.length !== trip.days ||
      itinerary.some((text) => !text || text.length > 3000)
    ) {
      setError(
        "Enter a plan for every day, using no more than 3,000 characters per day."
      );
      return;
    }

    saving.current = true;
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user || user.id !== ownerId) {
        throw new Error(
          "Your account session changed. Please log in again before saving."
        );
      }

      const { data, error: updateError } = await supabase
        .from("trips")
        .update({ itinerary })
        .eq("id", trip.id)
        .eq("user_id", user.id)
        .select(tripColumns)
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (!data) {
        throw new Error(
          "The update could not be confirmed. Please try again."
        );
      }

      onSaved(data as SavedTrip);
      onStopEditing();
      setMessage("Your trip changes have been saved.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save your changes. Please try again."
      );
    } finally {
      saving.current = false;
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

      {editing ? (
        <form onSubmit={saveChanges} className="mt-6">
          <p className="mb-5 text-sm text-slate-600">
            Edit your daily plans below. Changes are saved only when
            you click Save changes.
          </p>

          <fieldset disabled={busy} className="space-y-4">
            <legend className="sr-only">
              Edit daily itinerary for {trip.destination}
            </legend>

            {trip.itinerary.map((activity, index) => (
              <label
                key={index}
                className="block rounded-xl bg-slate-50 p-4"
              >
                <span className="font-semibold text-teal-800">
                  Day {index + 1}
                </span>

                <textarea
                  name={`day-${index}`}
                  defaultValue={activity}
                  required
                  maxLength={3000}
                  rows={4}
                  className="mt-3 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 leading-7 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
                />
              </label>
            ))}

            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save changes"}
              </button>

              <button
                type="button"
                onClick={cancelEditing}
                className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </fieldset>
        </form>
      ) : (
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

          <button
            type="button"
            onClick={startEditing}
            disabled={anotherTripIsEditing}
            className="mt-5 rounded-xl border border-teal-700 px-5 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Edit trip
          </button>
        </>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Originally saved {formatDate(trip.created_at)}
      </p>
    </article>
  );
}

export default function ProfilePage() {
  const [refresh, setRefresh] = useState(0);
  const [editingTripId, setEditingTripId] = useState<string | null>(
    null
  );

  const [profile, setProfile] = useState<ProfileData>({
    user: null,
    trips: [],
    loading: true,
    error: "",
  });

  useEffect(() => {
    let active = true;
    let requestNumber = 0;
    let knownUserId: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe = () => {};

    async function loadProfile() {
      const currentRequest = ++requestNumber;

      try {
        const supabase = createClient();

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!active || currentRequest !== requestNumber) return;

        if (authError || !user) {
          knownUserId = null;
          setEditingTripId(null);

          setProfile({
            user: null,
            trips: [],
            loading: false,
            error:
              authError &&
              authError.name !== "AuthSessionMissingError"
                ? "Could not verify your account. Please try again."
                : "",
          });
          return;
        }

        knownUserId = user.id;

        setProfile({
          user,
          trips: [],
          loading: true,
          error: "",
        });

        const { data, error } = await supabase
          .from("trips")
          .select(tripColumns)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (!active || currentRequest !== requestNumber) return;

        setProfile({
          user,
          trips: error ? [] : ((data ?? []) as SavedTrip[]),
          loading: false,
          error: error
            ? `Could not load your trips: ${error.message}`
            : "",
        });
      } catch {
        if (!active || currentRequest !== requestNumber) return;

        knownUserId = null;
        setEditingTripId(null);

        setProfile({
          user: null,
          trips: [],
          loading: false,
          error:
            "Could not connect. Check your connection and try again.",
        });
      }
    }

    try {
      const supabase = createClient();

      const { data } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (!active || event === "INITIAL_SESSION") return;

          if (event === "SIGNED_OUT") {
            requestNumber++;
            knownUserId = null;

            if (timer) clearTimeout(timer);

            setEditingTripId(null);
            setProfile({
              user: null,
              trips: [],
              loading: false,
              error: "",
            });
            return;
          }

          if (!session?.user) return;

          if (
            event === "SIGNED_IN" &&
            session.user.id !== knownUserId
          ) {
            requestNumber++;
            knownUserId = session.user.id;

            setEditingTripId(null);
            setProfile({
              user: null,
              trips: [],
              loading: true,
              error: "",
            });

            if (timer) clearTimeout(timer);
            timer = setTimeout(() => void loadProfile(), 0);
            return;
          }

          if (event === "USER_UPDATED") {
            const updatedUser = session.user;

            setProfile((current) =>
              current.user?.id === updatedUser.id
                ? { ...current, user: updatedUser }
                : current
            );
          }
        }
      );

      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      // loadProfile displays connection errors.
    }

    void loadProfile();

    return () => {
      active = false;
      requestNumber++;

      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [refresh]);

  const { user, trips, loading, error } = profile;

  function reloadProfile() {
    if (editingTripId) return;

    setProfile({
      user: null,
      trips: [],
      loading: true,
      error: "",
    });

    setRefresh((current) => current + 1);
  }

  return (
    <div className="min-h-screen w-full bg-[#f7faf9] text-slate-900">
      <AccountHeader />

      <main className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">
              YOUR YATRAMATE ACCOUNT
            </p>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
              My profile
            </h1>
          </div>

          <button
            type="button"
            onClick={reloadProfile}
            disabled={loading || editingTripId !== null}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {editingTripId && (
          <p className="mt-4 text-sm text-slate-600">
            Save or cancel your trip edits before refreshing or
            leaving this page.
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        {loading && !user && (
          <p role="status" className="mt-8 text-slate-600">
            Loading your profile…
          </p>
        )}

        {!loading && !user && (
          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-8">
            <h2 className="text-xl font-semibold">
              Sign in to view your profile
            </h2>

            <p className="mt-3 text-slate-600">
              Your account information and saved trips will appear
              here.
            </p>

            <Link
              href="/login"
              className="mt-6 inline-block rounded-xl bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800"
            >
              Login / Sign up
            </Link>
          </section>
        )}

        {user && (
          <>
            <section
              aria-labelledby="account-title"
              className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"
            >
              <ProfileEditor
                key={user.id}
                user={user}
                onSaved={(updatedUser) => {
                  setProfile((current) =>
                    current.user?.id === updatedUser.id
                      ? { ...current, user: updatedUser }
                      : current
                  );
                }}
              />

              <dl className="mt-8 grid gap-6 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-slate-500">
                    Email address
                  </dt>
                  <dd className="mt-1 break-all font-medium">
                    {user.email ?? "Not available"}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-slate-500">
                    Email verification
                  </dt>
                  <dd className="mt-1 font-medium text-teal-700">
                    {user.email_confirmed_at
                      ? "Verified"
                      : "Not yet verified"}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-slate-500">
                    Member since
                  </dt>
                  <dd className="mt-1 font-medium">
                    {formatDate(user.created_at)}
                  </dd>
                </div>

                <div>
                  <dt className="text-sm text-slate-500">
                    Saved trips
                  </dt>
                  <dd className="mt-1 font-medium">
                    {loading
                      ? "Loading…"
                      : error
                        ? "Unavailable"
                        : trips.length}
                  </dd>
                </div>
              </dl>
            </section>

            <section
              aria-labelledby="trips-title"
              className="mt-10"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 id="trips-title" className="text-2xl font-bold">
                  My trips
                </h2>

                <Link
                  href="/#planner"
                  className="font-semibold text-teal-700 hover:underline"
                >
                  Plan another trip →
                </Link>
              </div>

              <p className="mt-2 text-slate-600">
                View your saved itineraries or edit their daily plans.
              </p>

              {loading && (
                <p role="status" className="mt-6 text-slate-600">
                  Loading your saved trips…
                </p>
              )}

              {!loading && !error && trips.length === 0 && (
                <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <h3 className="text-lg font-semibold">
                    Your next journey starts here
                  </h3>
                  <p className="mt-2 text-slate-600">
                    Create an itinerary and click Save a copy.
                    It will appear here.
                  </p>
                </div>
              )}

              <div className="mt-6 grid gap-5">
                {trips.map((trip) => (
                  <TripCard
                    key={`${user.id}:${trip.id}`}
                    trip={trip}
                    ownerId={user.id}
                    editing={editingTripId === trip.id}
                    anotherTripIsEditing={
                      editingTripId !== null &&
                      editingTripId !== trip.id
                    }
                    onStartEditing={() =>
                      setEditingTripId(trip.id)
                    }
                    onStopEditing={() =>
                      setEditingTripId((current) =>
                        current === trip.id ? null : current
                      )
                    }
                    onSaved={(updatedTrip) => {
                      setProfile((current) => {
                        if (current.user?.id !== user.id) {
                          return current;
                        }

                        return {
                          ...current,
                          trips: current.trips.map((savedTrip) =>
                            savedTrip.id === updatedTrip.id
                              ? updatedTrip
                              : savedTrip
                          ),
                        };
                      });
                    }}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}