"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import SaveTrip from "./components/SaveTrip";
import AccountHeader from "./components/AccountHeader";
import { createClient } from "../lib/supabase/client";

type Trip = {
  destination: string;
  startDate: string;
  days: number;
  travelers: number;
  budget: number;
  itinerary: string[];
};

type SavedTripSummary = {
  id: string;
  destination: string;
  start_date: string;
  days: number;
  travelers: number;
  budget: number;
};

type DashboardData = {
  loading: boolean;
  signedIn: boolean;
  name: string;
  count: number;
  trips: SavedTripSummary[];
  error: string;
};

const emptyDashboard: DashboardData = {
  loading: true,
  signedIn: false,
  name: "",
  count: 0,
  trips: [],
  error: "",
};

const destinations = [
  { name: "Manali", description: "Mountains & slow mornings", icon: "🏔️" },
  { name: "Goa", description: "Coastal walks & sunsets", icon: "🌴" },
  { name: "Jaipur", description: "Architecture & local culture", icon: "🏰" },
  { name: "Munnar", description: "Green hills & fresh air", icon: "🍃" },
];

const inputStyle =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100";

const primaryButton =
  "inline-flex items-center justify-center rounded-full bg-gradient-to-r from-cyan-600 to-teal-600 px-6 py-3 font-semibold text-white transition hover:from-cyan-700 hover:to-teal-700 disabled:opacity-50";

function formatDate(value: string) {
  const date = new Date(`${value}T12:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function Home() {
  const [destination, setDestination] = useState("");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [dashboard, setDashboard] =
    useState<DashboardData>(emptyDashboard);

  useEffect(() => {
    let active = true;
    let requestNumber = 0;
    let currentUserId: string | null | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe = () => {};

    try {
      const supabase = createClient();

      async function loadDashboard() {
        const request = ++requestNumber;

        const isCurrent = () =>
          active && request === requestNumber;

        try {
          const {
            data: { user },
            error: authError,
          } = await supabase.auth.getUser();

          if (!isCurrent()) return;

          if (
            authError &&
            authError.name !== "AuthSessionMissingError"
          ) {
            throw authError;
          }

          if (!user) {
            currentUserId = null;
            setDashboard({
              ...emptyDashboard,
              loading: false,
            });
            return;
          }

          currentUserId = user.id;

          const rawName = user.user_metadata?.full_name;
          const name =
            typeof rawName === "string" && rawName.trim()
              ? rawName.trim()
              : "traveler";

          setDashboard({
            loading: true,
            signedIn: true,
            name,
            count: 0,
            trips: [],
            error: "",
          });

          const { data, count, error: tripsError } = await supabase
            .from("trips")
            .select(
              "id,destination,start_date,days,travelers,budget",
              { count: "exact" }
            )
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(3);

          if (!isCurrent()) return;

          if (tripsError) {
            setDashboard({
              loading: false,
              signedIn: true,
              name,
              count: 0,
              trips: [],
              error: "Your saved trips could not load. Try Refresh.",
            });
            return;
          }

          setDashboard({
            loading: false,
            signedIn: true,
            name,
            count: count ?? 0,
            trips: (data ?? []) as SavedTripSummary[],
            error: "",
          });
        } catch {
          if (!isCurrent()) return;

          currentUserId = undefined;
          setDashboard({
            ...emptyDashboard,
            loading: false,
            error: "Could not load your account. Try Refresh.",
          });
        }
      }

      const { data } = supabase.auth.onAuthStateChange(
        (event, session) => {
          if (!active || event === "INITIAL_SESSION") return;

          if (event === "SIGNED_OUT") {
            requestNumber++;
            currentUserId = null;
            if (timer) clearTimeout(timer);

            setDashboard({
              ...emptyDashboard,
              loading: false,
            });
            setTrip(null);
            return;
          }

          if (
            event === "USER_UPDATED" &&
            session?.user.id === currentUserId
          ) {
            const rawName = session.user.user_metadata?.full_name;

            setDashboard((current) => ({
              ...current,
              name:
                typeof rawName === "string" && rawName.trim()
                  ? rawName.trim()
                  : "traveler",
            }));
            return;
          }

          if (
            session?.user &&
            session.user.id !== currentUserId
          ) {
            requestNumber++;
            currentUserId = session.user.id;
            setDashboard(emptyDashboard);
            setTrip(null);

            if (timer) clearTimeout(timer);

            // Load outside the authentication callback.
            timer = setTimeout(() => {
              if (active) void loadDashboard();
            }, 0);
          }
        }
      );

      unsubscribe = () => data.subscription.unsubscribe();

      void loadDashboard();
    } catch {
      queueMicrotask(() => {
        if (!active) return;

        setDashboard({
          ...emptyDashboard,
          loading: false,
          error: "Check your Supabase connection settings.",
        });
      });
    }

    return () => {
      active = false;
      requestNumber++;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [refresh]);

  function refreshTrips() {
    setDashboard((current) => ({
      ...current,
      loading: true,
      error: "",
    }));
    setRefresh((current) => current + 1);
  }

  function selectDestination(place: string) {
    setDestination(place);
    document
      .getElementById("planner")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function createTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const startDate = String(form.get("startDate") ?? "");
    const days = Number(form.get("days"));
    const travelers = Number(form.get("travelers"));
    const budget = Number(form.get("budget"));
    const place = destination.trim();

    const date = new Date(`${startDate}T12:00:00`);

    if (
      !place ||
      place.length > 100 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(startDate) ||
      Number.isNaN(date.getTime()) ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > 30 ||
      !Number.isInteger(travelers) ||
      travelers < 1 ||
      travelers > 50 ||
      !Number.isFinite(budget) ||
      budget < 0 ||
      budget > 100000000
    ) {
      setError("Please check your destination, date, and trip details.");
      return;
    }

    if (
      trip &&
      !window.confirm(
        "Replace your current draft? Any unsaved edits will be lost."
      )
    ) {
      return;
    }

    const itinerary = Array.from({ length: days }, (_, index) => {
      if (days === 1) {
        return `Explore ${place}, plan a meal stop, and allow time for your return journey.`;
      }

      if (index === 0) {
        return `Arrive in ${place}, check in, and explore your surroundings.`;
      }

      if (index === days - 1) {
        return "Enjoy a relaxed morning, check out, and leave time for your return journey.";
      }

      return `Choose an activity in ${place}, add a meal stop, and leave time to rest.`;
    });

    setError("");
    setTrip({
      destination: place,
      startDate,
      days,
      travelers,
      budget,
      itinerary,
    });
  }

  function updateDay(index: number, value: string) {
    setTrip((current) => {
      if (!current) return current;

      return {
        ...current,
        itinerary: current.itinerary.map((activity, dayIndex) =>
          dayIndex === index ? value : activity
        ),
      };
    });
  }

  return (
    <div className="min-h-screen w-full bg-[#eef8ff] font-sans text-slate-900">
      <AccountHeader />

      <main className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-sky-900 to-teal-800 p-7 text-white sm:p-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full border-[36px] border-white/5"
          />

          <div className="relative grid gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <p className="text-sm font-semibold uppercase tracking-widest text-cyan-200">
                YOUR JOURNEY, YOUR WAY
              </p>

              <h1 className="mt-4 break-words text-3xl font-bold tracking-tight sm:text-5xl">
                {dashboard.loading
                  ? "Welcome to YatraMate"
                  : dashboard.signedIn
                    ? `Hello, ${dashboard.name}`
                    : "Your next journey starts here"}
              </h1>

              <p className="mt-4 max-w-xl text-lg leading-8 text-sky-100">
                Bring your destinations, daily plans, and saved trips
                together in one place.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <a
                  href="#planner"
                  className="rounded-full bg-white px-6 py-3 font-semibold text-sky-950 hover:bg-cyan-50"
                >
                  ✈️ Plan a trip
                </a>

                <Link
                  href="/profile"
                  className="rounded-full border border-white/30 bg-white/10 px-6 py-3 font-semibold hover:bg-white/20"
                >
                  My profile & trips →
                </Link>
              </div>
            </div>

            <div className="rounded-3xl border border-white/20 bg-white/10 p-6">
              <p className="text-sm text-sky-100">Your saved trips</p>

              <p className="mt-3 text-5xl font-bold">
                {dashboard.loading || dashboard.error
                  ? "—"
                  : dashboard.signedIn
                    ? dashboard.count
                    : "—"}
              </p>

              <p className="mt-4 text-sm leading-6 text-sky-100">
                {dashboard.loading
                  ? "Loading your travel collection…"
                  : dashboard.error
                    ? "Your travel collection is temporarily unavailable."
                    : dashboard.signedIn
                      ? "Your saved itineraries are available in your profile."
                      : "Sign in to save trips and access them on other devices."}
              </p>
            </div>
          </div>
        </section>

        <section aria-label="Quick actions" className="grid gap-4 sm:grid-cols-3">
          <a
            href="#planner"
            className="rounded-3xl bg-gradient-to-br from-sky-500 to-cyan-600 p-6 text-white shadow-sm transition hover:shadow-md"
          >
            <span aria-hidden="true" className="text-3xl">✈️</span>
            <h2 className="mt-4 text-lg font-bold">Plan my trip</h2>
            <p className="mt-1 text-sm text-white/90">
              Dates, budget, and daily activities
            </p>
          </a>

          <a
            href="#saved-trips"
            className="rounded-3xl bg-gradient-to-br from-teal-500 to-teal-700 p-6 text-white shadow-sm transition hover:shadow-md"
          >
            <span aria-hidden="true" className="text-3xl">📖</span>
            <h2 className="mt-4 text-lg font-bold">My journeys</h2>
            <p className="mt-1 text-sm text-white/90">
              Find your recently saved trips
            </p>
          </a>

          <Link
            href="/profile"
            className="rounded-3xl bg-gradient-to-br from-violet-500 to-indigo-700 p-6 text-white shadow-sm transition hover:shadow-md"
          >
            <span aria-hidden="true" className="text-3xl">👤</span>
            <h2 className="mt-4 text-lg font-bold">My profile</h2>
            <p className="mt-1 text-sm text-white/90">
              Manage your account and itineraries
            </p>
          </Link>
        </section>

        <section id="saved-trips" className="scroll-mt-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold">My recent trips</h2>
              <p className="mt-1 text-sm text-slate-600">
                Your three most recently saved itineraries.
              </p>
            </div>

            <button
              type="button"
              onClick={refreshTrips}
              disabled={dashboard.loading}
              className="rounded-full border border-sky-200 bg-white px-5 py-2.5 text-sm font-semibold text-sky-800 hover:bg-sky-50 disabled:opacity-50"
            >
              {dashboard.loading ? "Loading…" : "Refresh"}
            </button>
          </div>

          <div className="mt-5" aria-live="polite">
            {dashboard.loading ? (
              <div className="rounded-3xl border border-sky-100 bg-white p-7 text-slate-600">
                Loading your saved trips…
              </div>
            ) : dashboard.error ? (
              <p role="alert" className="rounded-3xl bg-white p-7 text-red-700">
                {dashboard.error}
              </p>
            ) : !dashboard.signedIn ? (
              <div className="rounded-3xl border border-sky-100 bg-white p-7">
                <h3 className="text-lg font-bold">Keep your plans together</h3>
                <p className="mt-2 text-slate-600">
                  Sign in to save itineraries to your account.
                </p>
                <Link href="/login" className={`${primaryButton} mt-5`}>
                  Login / Sign up
                </Link>
              </div>
            ) : dashboard.trips.length === 0 ? (
              <div className="rounded-3xl border border-sky-100 bg-white p-7">
                <h3 className="text-lg font-bold">Your first journey awaits</h3>
                <p className="mt-2 text-slate-600">
                  Create an itinerary below, then save it to your profile.
                </p>
                <a href="#planner" className={`${primaryButton} mt-5`}>
                  Plan a trip
                </a>
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {dashboard.trips.map((saved) => (
                  <article
                    key={saved.id}
                    className="overflow-hidden rounded-3xl border border-sky-100 bg-white shadow-sm"
                  >
                    <div className="bg-gradient-to-br from-sky-900 to-teal-700 p-6 text-white">
                      <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                        Saved itinerary
                      </span>
                      <h3 className="mt-5 break-words text-2xl font-bold">
                        {saved.destination}
                      </h3>
                    </div>

                    <div className="p-6">
                      <p className="text-sm text-slate-600">
                        Starts {formatDate(saved.start_date)}
                      </p>
                      <p className="mt-2 text-sm text-slate-600">
                        {saved.days} {saved.days === 1 ? "day" : "days"}
                        {" · "}
                        {saved.travelers}{" "}
                        {saved.travelers === 1 ? "traveler" : "travelers"}
                      </p>

                      <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Planned total budget
                      </p>
                      <p className="mt-1 text-xl font-bold text-teal-700">
                        {money(Number(saved.budget))}
                      </p>

                      <Link
                        href="/profile"
                        className="mt-5 inline-flex font-semibold text-sky-700 hover:underline"
                      >
                        Manage in profile →
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="destinations-title">
          <h2 id="destinations-title" className="text-2xl font-bold">
            Where would you like to go?
          </h2>
          <p className="mt-2 text-slate-600">
            Choose a destination or enter your own in the planner.
          </p>

          <div className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {destinations.map((place) => (
              <button
                key={place.name}
                type="button"
                aria-pressed={destination === place.name}
                onClick={() => selectDestination(place.name)}
                className={`rounded-3xl border p-5 text-left transition hover:border-cyan-500 hover:shadow-md ${
                  destination === place.name
                    ? "border-cyan-500 bg-cyan-50"
                    : "border-sky-100 bg-white"
                }`}
              >
                <span aria-hidden="true" className="text-4xl">
                  {place.icon}
                </span>
                <h3 className="mt-4 text-lg font-bold">{place.name}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {place.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section
          id="planner"
          aria-labelledby="planner-title"
          className="scroll-mt-6 rounded-[2rem] border border-sky-100 bg-white p-6 shadow-sm sm:p-9"
        >
          <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">
            PLAN MY TRIP
          </p>
          <h2 id="planner-title" className="mt-3 text-3xl font-bold">
            Make room for your next adventure
          </h2>
          <p className="mt-3 text-slate-600">
            Set your dates and budget, then customize your daily itinerary.
          </p>

          <form onSubmit={createTrip} className="mt-8">
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <label className="text-sm font-semibold">
                Destination
                <input
                  name="destination"
                  required
                  maxLength={100}
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder="e.g. Manali, India"
                  className={inputStyle}
                />
              </label>

              <label className="text-sm font-semibold">
                Start date
                <input
                  name="startDate"
                  type="date"
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
                  defaultValue={3}
                  required
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
                  defaultValue={1}
                  required
                  className={inputStyle}
                />
              </label>

              <label className="text-sm font-semibold">
                Total trip budget for all travelers (₹)
                <input
                  name="budget"
                  type="number"
                  min={0}
                  max={100000000}
                  step={0.01}
                  defaultValue={10000}
                  required
                  className={inputStyle}
                />
              </label>
            </div>

            {error && (
              <p role="alert" className="mt-5 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-4">
              <button type="submit" className={primaryButton}>
                {trip ? "Replace current draft" : "Create itinerary"}
              </button>
              <p className="text-sm text-slate-500">
                {trip
                  ? "Save your current draft before replacing it."
                  : "Create a template you can edit and save."}
              </p>
            </div>
          </form>
        </section>

        {trip && (
          <section
            aria-labelledby="itinerary-title"
            className="rounded-[2rem] border border-teal-200 bg-teal-50 p-6 sm:p-9"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-teal-700">
                  YOUR TRIP DRAFT
                </p>
                <h2
                  id="itinerary-title"
                  className="mt-2 break-words text-3xl font-bold"
                >
                  {trip.destination}
                </h2>
                <p className="mt-3 text-slate-600">
                  {trip.days} {trip.days === 1 ? "day" : "days"}
                  {" · "}
                  {trip.travelers}{" "}
                  {trip.travelers === 1 ? "traveler" : "travelers"}
                  {" · Starts "}
                  {formatDate(trip.startDate)}
                </p>
              </div>

              <div className="rounded-2xl bg-white px-5 py-3">
                <p className="text-sm text-slate-500">Total planned budget</p>
                <p className="mt-1 text-xl font-bold text-teal-800">
                  {money(trip.budget)}
                </p>
              </div>
            </div>

            <p className="mt-6 text-sm leading-6 text-slate-600">
              This is a general planning template, not an AI-generated or
              verified destination guide. Edit each day with your own
              activities. Unsaved changes are lost when you refresh or
              leave this page.
            </p>

            <div className="mt-6 space-y-4">
              {trip.itinerary.map((activity, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-teal-100 bg-white p-5"
                >
                  <label
                    htmlFor={`day-${index}`}
                    className="font-semibold text-teal-800"
                  >
                    Day {index + 1}
                  </label>

                  <textarea
                    id={`day-${index}`}
                    value={activity}
                    maxLength={3000}
                    onChange={(event) =>
                      updateDay(index, event.target.value)
                    }
                    rows={3}
                    className={`${inputStyle} resize-y font-normal leading-7`}
                  />
                </div>
              ))}
            </div>

            <SaveTrip trip={trip} />

            <p className="mt-4 text-sm text-slate-600">
              After saving successfully, use Refresh in My recent trips
              to update the dashboard.
            </p>
          </section>
        )}
      </main>

      <footer className="border-t border-sky-100 bg-white px-5 py-6 text-center text-sm text-slate-500">
        YatraMate · Make space for the journey.
      </footer>
    </div>
  );
}