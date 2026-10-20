"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import AccountHeader from "../components/AccountHeader";
import ProfileEditor from "../components/ProfileEditor";
import SavedPlaces from "../components/SavedPlaces";
import TripCard, {
  formatDate,
  tripColumns,
  type SavedTrip,
} from "../components/TripCard";
import { createClient } from "../../lib/supabase/client";

type ProfileData = {
  user: User | null;
  trips: SavedTrip[];
  loading: boolean;
  error: string;
};

export default function ProfilePage() {
  const [refresh, setRefresh] = useState(0);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

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
          setActiveTripId(null);
          setNotice("");
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
        setActiveTripId(null);
        setNotice("");
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

      const { data } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (!active || event === "INITIAL_SESSION") return;

          if (event === "SIGNED_OUT") {
            requestNumber++;
            knownUserId = null;
            if (timer) clearTimeout(timer);

            setActiveTripId(null);
            setNotice("");
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

            setActiveTripId(null);
            setNotice("");
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
    if (activeTripId) return;

    setNotice("");
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
            disabled={loading || activeTripId !== null}
            className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        {activeTripId && (
          <p className="mt-4 text-sm text-slate-600">
            Finish or cancel the current trip action before
            refreshing. Unsaved edits are lost if you leave this page.
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
            <SavedPlaces key={user.id} userId={user.id} />
            <section aria-labelledby="trips-title" className="mt-10">
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
                View, update, and manage your saved journeys.
              </p>

              {notice && (
                <p
                  role="status"
                  className="mt-4 rounded-xl bg-teal-50 p-4 text-sm text-teal-800"
                >
                  {notice}
                </p>
              )}

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
                    locked={
                      activeTripId !== null &&
                      activeTripId !== trip.id
                    }
                    onActiveChange={(isActive) => {
                      setActiveTripId((current) =>
                        isActive
                          ? trip.id
                          : current === trip.id
                            ? null
                            : current
                      );
                      if (isActive) setNotice("");
                    }}
                    onSaved={(updatedTrip) => {
                      setProfile((current) =>
                        current.user?.id === user.id
                          ? {
                              ...current,
                              trips: current.trips.map((savedTrip) =>
                                savedTrip.id === updatedTrip.id
                                  ? updatedTrip
                                  : savedTrip
                              ),
                            }
                          : current
                      );
                    }}
                    onDeleted={(deletedId) => {
                      setProfile((current) =>
                        current.user?.id === user.id
                          ? {
                              ...current,
                              trips: current.trips.filter(
                                (savedTrip) => savedTrip.id !== deletedId
                              ),
                            }
                          : current
                      );
                      setNotice("The trip has been deleted.");
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