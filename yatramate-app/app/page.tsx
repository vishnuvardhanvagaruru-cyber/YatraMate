"use client";

import { useState, type FormEvent } from "react";

type Trip = {
  destination: string;
  startDate: string;
  days: number;
  travelers: number;
  budget: number;
  itinerary: string[];
};

const destinations = [
  { name: "Manali", description: "Mountains & slow mornings", icon: "🏔️" },
  { name: "Goa", description: "Coastal walks & sunsets", icon: "🌴" },
  { name: "Jaipur", description: "Architecture & local culture", icon: "🏰" },
  { name: "Munnar", description: "Green hills & fresh air", icon: "🍃" },
];

const inputStyle =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100";

export default function Home() {
  const [destination, setDestination] = useState("");
  const [trip, setTrip] = useState<Trip | null>(null);
  const [error, setError] = useState("");

  function createTrip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);
    const startDate = String(form.get("startDate") ?? "");
    const days = Number(form.get("days"));
    const travelers = Number(form.get("travelers"));
    const budget = Number(form.get("budget"));
    const place = destination.trim();

    if (
      !place ||
      !startDate ||
      !Number.isInteger(days) ||
      days < 1 ||
      days > 30 ||
      !Number.isInteger(travelers) ||
      travelers < 1 ||
      travelers > 50 ||
      !Number.isFinite(budget) ||
      budget < 0
    ) {
      setError("Please check your destination, dates, and trip details.");
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
        itinerary: current.itinerary.map((item, dayIndex) =>
          dayIndex === index ? value : item
        ),
      };
    });
  }

  return (
    <div className="min-h-screen w-full bg-[#f7faf9] font-sans text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
          <a
            href="#"
            aria-label="YatraMate home"
            className="flex items-center gap-2 text-xl font-bold tracking-tight"
          >
            <span
              aria-hidden="true"
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white"
            >
              Y
            </span>
            YatraMate
          </a>

          <a
            href="#planner"
            className="rounded-full bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            Plan a trip
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-16">
        <section className="grid items-center gap-10 py-12 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">
              A little planning. A better journey.
            </p>

            <h1 className="mt-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Your next adventure,
              <span className="text-teal-700"> thoughtfully planned.</span>
            </h1>

            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
              Bring your destination, dates, and ideas together. Make room for
              the places you love—and the moments you discover along the way.
            </p>

            <a
              href="#planner"
              className="mt-8 inline-flex rounded-xl bg-teal-700 px-6 py-3.5 font-semibold text-white transition hover:bg-teal-800"
            >
              Start planning →
            </a>
          </div>

          <div className="relative overflow-hidden rounded-3xl bg-teal-950 p-8 text-white sm:p-10">
            <div
              aria-hidden="true"
              className="absolute -right-12 -top-12 h-52 w-52 rounded-full bg-teal-800"
            />

            <div className="relative">
              <p className="text-sm font-medium text-teal-200">
                YOUR JOURNEY, YOUR PACE
              </p>

              <div aria-hidden="true" className="my-8 text-7xl">
                🏔️
              </div>

              <h2 className="text-3xl font-semibold">
                Less scattered.
                <br />
                More explored.
              </h2>

              <p className="mt-4 leading-7 text-teal-100">
                One place for your daily plans, travel notes, and trip budget.
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                {["Daily itinerary", "Your budget", "Travel notes"].map(
                  (feature) => (
                    <span
                      key={feature}
                      className="rounded-full border border-teal-700 px-3 py-1.5 text-sm text-teal-100"
                    >
                      {feature}
                    </span>
                  )
                )}
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="destinations-title">
          <h2 id="destinations-title" className="text-2xl font-bold">
            Where would you like to go?
          </h2>

          <p className="mt-2 text-slate-600">
            Pick a starting point, or enter your own destination below.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {destinations.map((place) => (
              <button
                key={place.name}
                type="button"
                aria-pressed={destination === place.name}
                onClick={() => {
                  setDestination(place.name);
                  document
                    .getElementById("planner")
                    ?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`rounded-2xl border p-5 text-left transition hover:border-teal-600 hover:shadow-sm ${
                  destination === place.name
                    ? "border-teal-600 bg-teal-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <span aria-hidden="true" className="text-3xl">
                  {place.icon}
                </span>
                <h3 className="mt-4 text-lg font-semibold">{place.name}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {place.description}
                </p>
              </button>
            ))}
          </div>
        </section>

        <section
          id="planner"
          aria-labelledby="planner-title"
          className="mt-14 scroll-mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-9"
        >
          <p className="text-sm font-semibold text-teal-700">
            MAKE IT YOUR JOURNEY
          </p>

          <h2 id="planner-title" className="mt-2 text-3xl font-bold">
            Start with the essentials
          </h2>

          <p className="mt-3 text-slate-600">
            Create a starting itinerary, then edit each day to suit you.
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
                Total trip budget (₹)
                <input
                  name="budget"
                  type="number"
                  min={0}
                  max={100000000}
                  step={1}
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
              <button
                type="submit"
                className="rounded-xl bg-teal-700 px-6 py-3.5 font-semibold text-white transition hover:bg-teal-800"
              >
                {trip ? "Create replacement itinerary" : "Create itinerary"}
              </button>

              <p className="text-sm text-slate-500">
                {trip
                  ? "Creating another itinerary replaces your current edits."
                  : "Your first draft starts here."}
              </p>
            </div>
          </form>
        </section>

        {trip && (
          <section
            aria-labelledby="itinerary-title"
            className="mt-10 rounded-3xl border border-teal-200 bg-teal-50 p-6 sm:p-9"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-teal-700">
                  YOUR TRIP DRAFT
                </p>
                <h2 id="itinerary-title" className="mt-2 text-3xl font-bold">
                  {trip.destination}
                </h2>
                <p className="mt-3 text-slate-600">
                  {trip.days} {trip.days === 1 ? "day" : "days"} ·{" "}
                  {trip.travelers}{" "}
                  {trip.travelers === 1 ? "traveler" : "travelers"} · Starts{" "}
                  {trip.startDate}
                </p>
              </div>

              <div className="rounded-xl bg-white px-5 py-3">
                <p className="text-sm text-slate-500">Your total budget</p>
                <p className="mt-1 text-xl font-bold">
                  ₹{trip.budget.toLocaleString("en-IN")}
                </p>
              </div>
            </div>

            <p className="mt-6 text-sm leading-6 text-slate-600">
              This is a general planning template, not an AI-generated or
              verified destination guide. Edit each day with your own
              activities.
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

            <p role="status" className="mt-6 text-sm font-medium text-teal-900">
              Not saved yet. Refreshing or closing this page will clear your
              draft.
            </p>
          </section>
        )}
      </main>

      <footer className="border-t border-slate-200 px-5 py-6 text-center text-sm text-slate-500">
        YatraMate · Make space for the journey.
      </footer>
    </div>
  );
}