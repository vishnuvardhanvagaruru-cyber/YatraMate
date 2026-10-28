"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";

type Place = {
  id: string;
  name: string;
  destination: string;
};

type TripOption = {
  id: string;
  destination: string;
  start_date: string;
  days: number;
  version: number;
};

type Props = {
  place: Place;
};

const fieldStyle =
  "mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-slate-900";

function tripDate(startDate: string, offset = 0) {
  const date = new Date(startDate + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

function dateRange(trip: TripOption) {
  const start = tripDate(trip.start_date);
  return trip.days === 1 ? start : start + " – " + tripDate(trip.start_date, trip.days - 1);
}

function dayLabel(startDate: string, day: number) {
  return "Day " + day + " · " + tripDate(startDate, day - 1);
}

function tripLabel(trip: TripOption, trips: TripOption[]) {
  const similar = trips.filter(
    (item) => item.destination === trip.destination &&
      item.start_date === trip.start_date && item.days === trip.days
  );
  const reference = similar.length > 1
    ? " · Trip " + (similar.findIndex((item) => item.id === trip.id) + 1)
    : "";
  return trip.destination + " · " + dateRange(trip) + " · " +
    trip.days + (trip.days === 1 ? " day" : " days") + reference;
}

export default function AddPlaceToTrip({ place }: Props) {
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [tripId, setTripId] = useState("");
  const [day, setDay] = useState("");
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const mounted = useRef(false);
  const pending = useRef(false);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  const matchingTrips = trips;

  const selectedTrip = matchingTrips.find((trip) => trip.id === tripId);
  const selectedDay = Number(day);
  const hasValidDay = !!selectedTrip && day !== "" &&
    Number.isInteger(selectedDay) && selectedDay >= 1 &&
    selectedDay <= selectedTrip.days;


  async function loadTrips() {
    if (pending.current) return;

    pending.current = true;
    setOpen(true);
    setLoading(true);
    setError("");
    setMessage("");
    setNeedsLogin(false);
    setOwnerId(null);
    setTrips([]);
    setTripId("");
    setDay("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!mounted.current) return;

      if (authError && authError.name !== "AuthSessionMissingError") {
        throw new Error(
          "Could not check your account. Please try again."
        );
      }

      if (!user) {
        setNeedsLogin(true);
        return;
      }

      const results: TripOption[] = [];
      const pageSize = 500;

      for (let from = 0; ; from += pageSize) {
        const { data, error: queryError } = await supabase
          .rpc("matching_trips_for_place", {
            p_place_id: place.id,
          })
          .order("start_date", { ascending: false })
          .order("id")
          .range(from, from + pageSize - 1);

        if (!mounted.current) return;

        if (queryError) {
          throw new Error(
            "Could not load matching trips. Please try again."
          );
        }

        const page = (data ?? []) as TripOption[];
        results.push(...page);

        if (page.length < pageSize) break;
      }

      const { data: account, error: accountError } =
        await supabase.auth.getUser();

      if (!mounted.current) return;

      if (accountError || account.user?.id !== user.id) {
        throw new Error(
          "Your account changed. Reload your trips."
        );
      }

      setOwnerId(user.id);
      setTrips(results);
    } catch (caught) {
      if (mounted.current) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load your trips."
        );
      }
    } finally {
      pending.current = false;

      if (mounted.current) {
        setLoading(false);
      }
    }
  }

  async function addPlace() {
    if (pending.current || !selectedTrip || !ownerId) return;

    const selectedDay = Number(day);

    if (
      !Number.isInteger(selectedDay) ||
      selectedDay < 1 ||
      selectedDay > selectedTrip.days
    ) {
      setError("Choose a valid day.");
      return;
    }

    pending.current = true;
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!mounted.current) return;

      if (authError || !user || user.id !== ownerId) {
        throw new Error(
          "Your account changed. Reload your trips."
        );
      }

      const { data, error: addError } = await supabase.rpc(
        "add_place_to_trip",
        {
          p_trip_id: selectedTrip.id,
          p_place_id: place.id,
          p_day: selectedDay,
          p_expected_version: selectedTrip.version,
        }
      );

      if (!mounted.current) return;

      if (addError) {
        throw new Error(addError.message);
      }

      if (data !== "added" && data !== "already_added") {
        throw new Error(
          "The result could not be confirmed. You can retry safely."
        );
      }

      setMessage(
        data === "already_added"
          ? `${place.name} is already in Day ${selectedDay}.`
          : `${place.name} was added to Day ${selectedDay} of your ${selectedTrip.destination} trip.`
      );
    } catch (caught) {
      if (mounted.current) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not add this place. Please try again."
        );
      }
    } finally {
      pending.current = false;

      if (mounted.current) {
        setSaving(false);
      }
    }
  }

  return (
    <div className="mt-4">
      {!open ? (
        <button
          type="button"
          onClick={() => void loadTrips()}
          className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800"
        >
          Add to trip
        </button>
      ) : (
        <section
          aria-label={`Add ${place.name} to a trip`}
          className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-slate-900"
        >
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-semibold">
              Add to your itinerary
            </h4>

            <button
              type="button"
              disabled={loading || saving}
              onClick={() => setOpen(false)}
              className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-white disabled:opacity-50"
            >
              Close
            </button>
          </div>

          {loading && (
            <p role="status" className="mt-3 text-sm text-slate-600">
              Loading your trips…
            </p>
          )}

          {error && (
            <p role="alert" className="mt-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {message && (
            <div
              role="status"
              className="mt-3 text-sm text-teal-800"
            >
              <p>{message}</p>

              <Link
                href="/profile#saved-trips"
                className="mt-2 inline-block font-semibold underline"
              >
                View in my profile
              </Link>
            </div>
          )}

          {!loading && needsLogin && (
            <p className="mt-3 text-sm text-slate-700">
              <Link
                href="/login"
                className="font-semibold text-teal-800 underline"
              >
                Log in
              </Link>{" "}
              to add places to your trips.
            </p>
          )}

          {!loading && !error && ownerId && matchingTrips.length === 0 && (
            <p className="mt-3 text-sm text-slate-700">
              No saved trips match {place.destination}. Save a trip using this
              destination name or a recognised variant.{" "}
              <Link
                href="/#planner"
                className="font-semibold text-teal-800 underline"
              >
                Plan a trip
              </Link>
            </p>
          )}

          {!loading && matchingTrips.length > 0 && (
            <fieldset
              disabled={saving}
              className="mt-4 space-y-4"
            >
              <legend className="sr-only">
                Choose trip and day
              </legend>

              <label className="block text-sm font-semibold">
                Saved trip to {place.destination}
                <select
                  value={tripId}
                  onChange={(event) => {
                    setTripId(event.target.value);
                    setDay("");
                    setError("");
                    setMessage("");
                  }}
                  className={fieldStyle}
                >
                  <option value="">Choose a trip</option>

                  {matchingTrips.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {tripLabel(trip, matchingTrips)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedTrip && (
                <>
                  <label className="block text-sm font-semibold">
                    Day
                    <select
                      value={day}
                      onChange={(event) => {
                        setDay(event.target.value);
                        setError("");
                        setMessage("");
                      }}
                      className={fieldStyle}
                    >
                      <option value="">Choose a day</option>
                      {Array.from(
                        { length: selectedTrip.days },
                        (_, index) => (
                          <option key={index} value={index + 1}>
                            {dayLabel(
                              selectedTrip.start_date,
                              index + 1
                            )}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  {hasValidDay ? (
                    <div className="rounded-xl border border-teal-200 bg-white p-4 text-sm">
                      <p className="font-semibold text-teal-900">Check your selection</p>
                      <dl className="mt-3 space-y-3">
                        <div>
                          <dt className="text-slate-500">Place</dt>
                          <dd className="break-words font-semibold">{place.name} · {place.destination}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Saved trip</dt>
                          <dd className="break-words">{tripLabel(selectedTrip, matchingTrips)}</dd>
                        </div>
                        <div>
                          <dt className="text-slate-500">Visit day</dt>
                          <dd className="font-semibold">{dayLabel(selectedTrip.start_date, selectedDay)}</dd>
                        </div>
                      </dl>
                      <p className="mt-3 text-slate-600">
                        This visit will be appended to this day’s existing plan.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600">
                      Choose the day you want to visit {place.name}.
                    </p>
                  )}

                  <button
                    type="button"
                    onClick={() => void addPlace()}
                    disabled={saving || !hasValidDay}
                    className="rounded-xl bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
                  >
                    {saving ? "Adding…" : "Add place to this day"}
                  </button>
                </>
              )}
            </fieldset>
          )}

          {!loading && !needsLogin && (
            <button
              type="button"
              disabled={saving}
              onClick={() => void loadTrips()}
              className="mt-4 text-sm font-semibold text-teal-800 underline disabled:opacity-50"
            >
              Reload my trips
            </button>
          )}
        </section>
      )}
    </div>
  );
}