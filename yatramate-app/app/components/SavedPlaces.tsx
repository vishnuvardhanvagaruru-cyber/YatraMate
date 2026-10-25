"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "../../lib/supabase/client";
import AddPlaceToTrip from "./AddPlaceToTrip";

type Place = {
  id: string;
  destination: string;
  name: string;
  description: string;
  address: string;
  maps_query: string;
};

type SavedPlaceRow = {
  place_id: string;
  places: Place;
};

type Props = {
  userId: string;
};

function directionsUrl(place: Place) {
  const parameters = new URLSearchParams({
    api: "1",
    destination: place.maps_query,
  });

  return `https://www.google.com/maps/dir/?${parameters.toString()}`;
}

export default function SavedPlaces({ userId }: Props) {
  const [places, setPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const mounted = useRef(false);
  const removing = useRef(false);

  useEffect(() => {
    let active = true;
    mounted.current = true;

    async function loadPlaces() {
      try {
        const supabase = createClient();

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (!active) return;

        if (authError || user?.id !== userId) {
          throw new Error(
            "Could not verify your account. Sign in again if needed."
          );
        }

        const collected: Place[] = [];

        for (let from = 0; ; from += 500) {
          const { data, error: queryError } = await supabase
            .from("saved_places")
            .select(
              `
                place_id,
                places!inner(
                  id,
                  destination,
                  name,
                  description,
                  address,
                  maps_query
                )
              `
            )
            .eq("user_id", userId)
            .eq("places.published", true)
            .order("created_at", { ascending: false })
            .order("place_id")
            .range(from, from + 499);

          if (!active) return;

          if (queryError) {
            throw new Error(
              "Could not load your saved places. Try Refresh places."
            );
          }

          const rows = (data ?? []) as unknown as SavedPlaceRow[];

          collected.push(...rows.map((row) => row.places));

          if (rows.length < 500) break;
        }

        if (!active) return;

        setPlaces(collected);
        setError("");
      } catch (caught) {
        if (!active) return;

        setPlaces([]);
        setError(
          caught instanceof Error
            ? caught.message
            : "Could not load your saved places."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPlaces();

    return () => {
      active = false;
      mounted.current = false;
    };
  }, [userId, refresh]);

  function refreshPlaces() {
    if (removing.current || loading) return;

    setLoading(true);
    setError("");
    setActionError("");
    setNotice("");
    setRefresh((current) => current + 1);
  }

  async function removePlace(place: Place) {
    if (removing.current || loading) return;

    removing.current = true;
    setBusyId(place.id);
    setActionError("");
    setNotice("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!mounted.current) return;

      if (authError || user?.id !== userId) {
        throw new Error(
          "Your login has changed. Refresh your profile before trying again."
        );
      }

      const { error: deleteError } = await supabase
        .from("saved_places")
        .delete()
        .eq("user_id", userId)
        .eq("place_id", place.id);

      if (!mounted.current) return;

      if (deleteError) {
        throw new Error("Could not remove this place. Please try again.");
      }

      const { data: remaining, error: checkError } = await supabase
        .from("saved_places")
        .select("place_id")
        .eq("user_id", userId)
        .eq("place_id", place.id)
        .maybeSingle();

      if (!mounted.current) return;

      if (checkError || remaining) {
        throw new Error(
          "Could not confirm removal. Use Refresh places to check."
        );
      }

      setPlaces((current) =>
        current.filter((saved) => saved.id !== place.id)
      );
      setNotice(`${place.name} removed from your saved places.`);
    } catch (caught) {
      if (!mounted.current) return;

      setActionError(
        caught instanceof Error
          ? caught.message
          : "Could not remove this place."
      );
    } finally {
      removing.current = false;

      if (mounted.current) setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="saved-places-title" className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="saved-places-title" className="text-2xl font-bold">
            My saved places
          </h2>
          <p className="mt-2 text-slate-600">
            Places you want to include in a future journey.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={refreshPlaces}
            disabled={loading || busyId !== null}
            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh places"}
          </button>

          <Link
            href="/explore"
            className="font-semibold text-teal-700 hover:underline"
          >
            Explore more →
          </Link>
        </div>
      </div>

      {notice && (
        <p
          role="status"
          className="mt-4 rounded-xl bg-teal-50 p-4 text-sm text-teal-800"
        >
          {notice}
        </p>
      )}

      {(error || actionError) && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error || actionError}
        </p>
      )}

      {loading ? (
        <p role="status" className="mt-6 text-slate-600">
          Loading your saved places…
        </p>
      ) : !error && places.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <h3 className="text-lg font-semibold">Start your wishlist</h3>
          <p className="mt-2 text-slate-600">
            Open Explore and select Save place on a place you like.
          </p>
          <Link
            href="/explore"
            className="mt-5 inline-flex rounded-full bg-teal-700 px-6 py-3 font-semibold text-white hover:bg-teal-800"
          >
            Explore places
          </Link>
        </div>
      ) : !error ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {places.map((place) => (
            <article
              key={place.id}
              className="flex flex-col rounded-3xl border border-sky-100 bg-white p-6 shadow-sm"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                {place.destination}
              </p>

              <h3 className="mt-2 break-words text-xl font-bold">
                {place.name}
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                {place.address}
              </p>

              <p className="mt-4 flex-1 text-sm leading-7 text-slate-600">
                {place.description}
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={directionsUrl(place)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Get directions to ${place.name} in Google Maps`}
                  className="rounded-full bg-gradient-to-r from-cyan-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white hover:from-cyan-700 hover:to-teal-700"
                >
                  Directions ↗
                </a>

                <button
                  type="button"
                  onClick={() => void removePlace(place)}
                  disabled={busyId !== null}
                  aria-label={`Remove ${place.name} from saved places`}
                  className="rounded-full border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                >
                  {busyId === place.id ? "Removing…" : "Remove"}
                </button>
              </div>
              <AddPlaceToTrip key={`${userId}:${place.id}`} place={place} />
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}