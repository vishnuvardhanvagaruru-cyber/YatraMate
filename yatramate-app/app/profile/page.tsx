"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import AccountHeader from "../components/AccountHeader";
import { createClient } from "../../lib/supabase/client";
import ProfileEditor from "../components/ProfileEditor";
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

function formatDate(value: string) {
  // Date-only values use local midnight to avoid timezone shifts.
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

export default function ProfilePage() {
  const [refresh, setRefresh] = useState(0);

  const [profile, setProfile] = useState<ProfileData>({
    user: null,
    trips: [],
    loading: true,
    error: "",
  });

  useEffect(() => {
    let active = true;
    let requestNumber = 0;
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

        setProfile({
          user,
          trips: [],
          loading: true,
          error: "",
        });

        const { data, error } = await supabase
          .from("trips")
          .select(
            "id, destination, start_date, days, travelers, budget, itinerary, created_at"
          )
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (!active || currentRequest !== requestNumber) return;

        if (error) {
          setProfile({
            user,
            trips: [],
            loading: false,
            error: `Could not load your trips: ${error.message}`,
          });
          return;
        }

        setProfile({
          user,
          trips: (data ?? []) as SavedTrip[],
          loading: false,
          error: "",
        });
      } catch {
        if (!active || currentRequest !== requestNumber) return;

        setProfile({
          user: null,
          trips: [],
          loading: false,
          error: "Could not connect. Check your connection and try again.",
        });
      }
    }

    try {
      const supabase = createClient();

      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (!active || event === "INITIAL_SESSION") return;

        if (event === "SIGNED_OUT") {
          requestNumber++;

          if (timer) clearTimeout(timer);

          setProfile({
            user: null,
            trips: [],
            loading: false,
            error: "",
          });
          return;
        }

        if (event === "SIGNED_IN" || event === "USER_UPDATED") {
          // Run Supabase requests outside the auth callback.
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => void loadProfile(), 0);
        }
      });

      unsubscribe = () => data.subscription.unsubscribe();
    } catch {
      // loadProfile displays the connection error.
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
            disabled={loading}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

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
              Your account information and saved trips will appear here.
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
                Your saved itineraries, together in one place.
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
                  <article
                    key={trip.id}
                    className="rounded-2xl border border-slate-200 bg-white p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h3 className="break-words text-xl font-bold">
                          {trip.destination}
                        </h3>

                        <p className="mt-2 text-sm leading-6 text-slate-600">
                          {formatDate(trip.start_date)} ·{" "}
                          {trip.days}{" "}
                          {trip.days === 1 ? "day" : "days"} ·{" "}
                          {trip.travelers}{" "}
                          {trip.travelers === 1
                            ? "traveler"
                            : "travelers"}
                        </p>
                      </div>

                      <div className="rounded-xl bg-teal-50 px-4 py-3">
                        <p className="text-xs text-slate-500">
                          Total budget
                        </p>
                        <p className="mt-1 font-bold text-teal-800">
                          ₹
                          {Number(trip.budget).toLocaleString(
                            "en-IN"
                          )}
                        </p>
                      </div>
                    </div>

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

                    <p className="mt-4 text-xs text-slate-500">
                      Saved {formatDate(trip.created_at)}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}