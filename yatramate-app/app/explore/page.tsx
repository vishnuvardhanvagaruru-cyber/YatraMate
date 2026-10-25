"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AccountHeader from "../components/AccountHeader";
import AddPlaceToTrip from "../components/AddPlaceToTrip";
import { createClient } from "../../lib/supabase/client";

type Place = {
  id: string;
  destination: string;
  name: string;
  category: string;
  description: string;
  address: string;
  maps_query: string;
};

type ExploreData = {
  loading: boolean;
  userId: string | null;
  places: Place[];
  savedIds: string[];
  error: string;
};

const initialData: ExploreData = {
  loading: true,
  userId: null,
  places: [],
  savedIds: [],
  error: "",
};

const categories: Record<string, { label: string; icon: string }> = {
  attraction: { label: "Attractions", icon: "🏛️" },
  food: { label: "Food", icon: "🍽️" },
  hotel: { label: "Hotels", icon: "🏨" },
  temple: { label: "Temples", icon: "🛕" },
  shopping: { label: "Shopping", icon: "🛍️" },
  transport: { label: "Transport", icon: "🚌" },
};

const inputStyle =
  "mt-2 w-full rounded-2xl border border-sky-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100";

function directionsUrl(place: Place) {
  const parameters = new URLSearchParams({
    api: "1",
    destination: place.maps_query,
  });

  // Google Maps supplies the starting location when available.
  // Otherwise, the traveler can enter it there.
  return `https://www.google.com/maps/dir/?${parameters.toString()}`;
}

export default function ExplorePage() {
  const [data, setData] = useState<ExploreData>(initialData);
  const [destination, setDestination] = useState("All");
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [actionError, setActionError] = useState("");

  const mounted = useRef(false);
  const generation = useRef(0);
  const owner = useRef<string | null>(null);
  const mutationBusy = useRef(false);

  useEffect(() => {
    mounted.current = true;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribe = () => {};

    try {
      const supabase = createClient();

      async function load() {
        const request = ++generation.current;

        const isCurrent = () =>
          active && request === generation.current;

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
            throw new Error("Could not check your account.");
          }

          owner.current = user?.id ?? null;

          // Read in pages so the collection isn't silently cut off.
          const places: Place[] = [];

          for (let from = 0; ; from += 500) {
            const { data: rows, error } = await supabase
              .from("places")
              .select(
                "id,destination,name,category,description,address,maps_query"
              )
              .eq("published", true)
              .order("id")
              .range(from, from + 499);

            if (!isCurrent()) return;

            if (error) {
              throw new Error("Could not load places. Please try again.");
            }

            const batch = (rows ?? []) as Place[];
            places.push(...batch);

            if (batch.length < 500) break;
          }

          const savedIds: string[] = [];

          if (user) {
            for (let from = 0; ; from += 500) {
              const { data: rows, error } = await supabase
                .from("saved_places")
                .select("place_id")
                .eq("user_id", user.id)
                .order("place_id")
                .range(from, from + 499);

              if (!isCurrent()) return;

              if (error) {
                throw new Error(
                  "Could not load your favorites. Please try again."
                );
              }

              const batch = rows ?? [];
              savedIds.push(...batch.map((row) => row.place_id));

              if (batch.length < 500) break;
            }
          }

          if (!isCurrent()) return;

          places.sort(
            (a, b) =>
              a.destination.localeCompare(b.destination) ||
              a.name.localeCompare(b.name)
          );

          setData({
            loading: false,
            userId: user?.id ?? null,
            places,
            savedIds,
            error: "",
          });
        } catch (error) {
          if (!isCurrent()) return;

          setData({
            ...initialData,
            loading: false,
            error:
              error instanceof Error
                ? error.message
                : "Could not load Explore. Please try again.",
          });
        }
      }

      const { data: subscription } =
        supabase.auth.onAuthStateChange((event, session) => {
          if (!active || event === "INITIAL_SESSION") return;

          const nextOwner = session?.user.id ?? null;

          if (
            event !== "SIGNED_OUT" &&
            nextOwner === owner.current
          ) {
            return;
          }

          // Immediately invalidate requests from the previous account.
          generation.current++;
          owner.current = nextOwner;

          setData(initialData);
          setNotice("");
          setActionError("");

          if (timer) clearTimeout(timer);

          timer = setTimeout(() => {
            if (active) void load();
          }, 0);
        });

      unsubscribe = () => subscription.subscription.unsubscribe();

      void load();
    } catch {
      queueMicrotask(() => {
        if (!active) return;

        setData({
          ...initialData,
          loading: false,
          error: "Check your Supabase connection settings.",
        });
      });
    }

    return () => {
  active = false;
  mounted.current = false;
  if (timer) clearTimeout(timer);
  unsubscribe();
};
  }, [refresh]);

  function reload() {
    if (mutationBusy.current) return;

    generation.current++;
    setData(initialData);
    setNotice("");
    setActionError("");
    setRefresh((value) => value + 1);
  }

  async function toggleSaved(place: Place) {
    if (mutationBusy.current || data.loading || data.error) return;

    if (!data.userId) {
      setActionError("Please log in to save places to your account.");
      return;
    }

    const expectedOwner = data.userId;
    const request = generation.current;
    const wasSaved = data.savedIds.includes(place.id);

    const isCurrent = () =>
      mounted.current &&
      request === generation.current &&
      owner.current === expectedOwner;

    mutationBusy.current = true;
    setBusyId(place.id);
    setNotice("");
    setActionError("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (!isCurrent()) return;

      if (authError || user?.id !== expectedOwner) {
        throw new Error(
          "Your login has changed. Refresh this page and try again."
        );
      }

      if (wasSaved) {
        const { error } = await supabase
          .from("saved_places")
          .delete()
          .eq("user_id", expectedOwner)
          .eq("place_id", place.id);

        if (error) {
          throw new Error("Could not remove this favorite. Try again.");
        }
      } else {
        // Duplicate saves are ignored instead of creating extra rows.
        const { error } = await supabase
          .from("saved_places")
          .upsert(
            {
              user_id: expectedOwner,
              place_id: place.id,
            },
            {
              onConflict: "user_id,place_id",
              ignoreDuplicates: true,
            }
          );

        if (error) {
          throw new Error("Could not save this place. Try again.");
        }
      }

      if (!isCurrent()) return;

      // Confirm the final state before displaying success.
      const { data: saved, error: checkError } = await supabase
        .from("saved_places")
        .select("place_id")
        .eq("user_id", expectedOwner)
        .eq("place_id", place.id)
        .maybeSingle();

      if (!isCurrent()) return;

      if (checkError || Boolean(saved) === wasSaved) {
        throw new Error(
          "Could not confirm the change. Refresh before trying again."
        );
      }

      setData((current) => {
        if (current.userId !== expectedOwner) return current;

        return {
          ...current,
          savedIds: wasSaved
            ? current.savedIds.filter((id) => id !== place.id)
            : [...new Set([...current.savedIds, place.id])],
        };
      });

      setNotice(
        wasSaved
          ? `${place.name} removed from saved places.`
          : `${place.name} saved to your account.`
      );
    } catch (error) {
      if (!isCurrent()) return;

      setActionError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again."
      );
    } finally {
      mutationBusy.current = false;

      if (mounted.current) {
        setBusyId(null);
      }
    }
  }

  const destinations = [
    ...new Set(data.places.map((place) => place.destination)),
  ].sort();

  const availableCategories = Object.entries(categories).filter(
    ([key]) =>
      data.places.some(
        (place) =>
          place.category === key &&
          (destination === "All" ||
            place.destination === destination)
      )
  );

  const query = search.trim().toLocaleLowerCase();

  const visiblePlaces = data.places.filter((place) => {
    const matchesDestination =
      destination === "All" || place.destination === destination;

    const matchesCategory =
      category === "all" || place.category === category;

    const matchesSearch =
      !query ||
      [
        place.name,
        place.destination,
        place.description,
        place.address,
      ]
        .join(" ")
        .toLocaleLowerCase()
        .includes(query);

    const matchesSaved =
      !savedOnly || data.savedIds.includes(place.id);

    return (
      matchesDestination &&
      matchesCategory &&
      matchesSearch &&
      matchesSaved
    );
  });

  return (
    <div className="min-h-screen bg-[#eef8ff] font-sans text-slate-900">
      <AccountHeader />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="rounded-[2rem] bg-gradient-to-br from-sky-950 via-sky-800 to-teal-700 p-7 text-white sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-cyan-200">
            EXPLORE YATRAMATE
          </p>

          <h1 className="mt-3 text-3xl font-bold sm:text-5xl">
            Find places for your next journey
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-sky-100">
            Browse our curated destination collection, save places you
            like, and open directions in Google Maps.
          </p>

          <p className="mt-4 text-sm text-sky-100">
            A starter collection of attractions and temples. More
            categories will appear as places are added.
          </p>
        </section>

        <section
          aria-label="Explore filters"
          className="mt-6 rounded-3xl border border-sky-100 bg-white p-5 sm:p-7"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold">
              Destination
              <select
                value={destination}
                disabled={data.loading}
                onChange={(event) => {
                  setDestination(event.target.value);
                  setCategory("all");
                }}
                className={inputStyle}
              >
                <option value="All">All destinations</option>
                {destinations.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-semibold">
              Search places
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search name, city, or description"
                className={inputStyle}
              />
            </label>
          </div>

          <div
            aria-label="Place categories"
            className="mt-5 flex flex-wrap gap-2"
          >
            <button
              type="button"
              aria-pressed={category === "all"}
              onClick={() => setCategory("all")}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                category === "all"
                  ? "bg-teal-700 text-white"
                  : "bg-sky-50 text-slate-700"
              }`}
            >
              All categories
            </button>

            {availableCategories.map(([key, item]) => (
              <button
                key={key}
                type="button"
                aria-pressed={category === key}
                onClick={() => setCategory(key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  category === key
                    ? "bg-teal-700 text-white"
                    : "bg-sky-50 text-slate-700"
                }`}
              >
                <span aria-hidden="true">{item.icon}</span>{" "}
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={savedOnly}
                onChange={(event) => setSavedOnly(event.target.checked)}
                className="h-4 w-4 accent-teal-700"
              />
              Show only my saved places
            </label>

            <button
              type="button"
              onClick={reload}
              disabled={data.loading || busyId !== null}
              className="rounded-full border border-sky-200 px-4 py-2 text-sm font-semibold text-sky-800 disabled:opacity-50"
            >
              {data.loading ? "Loading…" : "Refresh"}
            </button>
          </div>
        </section>

        {!data.loading && !data.error && !data.userId && (
          <div className="mt-5 rounded-2xl border border-sky-200 bg-white p-4 text-sm text-slate-700">
            You can browse places and get directions without logging in.{" "}
            <Link
              href="/login"
              className="font-semibold text-teal-700 underline"
            >
              Log in to save favorites
            </Link>
            . After signing in, return to Explore.
          </div>
        )}

        <p aria-live="polite" className="mt-4 text-sm text-teal-800">
          {notice}
        </p>

        {actionError && (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 p-4 text-sm text-red-700">
            {actionError}
          </p>
        )}

        {data.loading ? (
          <p role="status" className="mt-6 rounded-3xl bg-white p-8">
            Loading places and favorites…
          </p>
        ) : data.error ? (
          <p role="alert" className="mt-6 rounded-3xl bg-white p-8 text-red-700">
            {data.error}
          </p>
        ) : (
          <section aria-labelledby="results-title" className="mt-6">
            <h2 id="results-title" className="text-xl font-bold">
              {savedOnly ? "Your saved places" : "Places to explore"}
              <span className="ml-2 text-base font-normal text-slate-500">
                ({visiblePlaces.length})
              </span>
            </h2>

            {visiblePlaces.length === 0 ? (
              <div className="mt-4 rounded-3xl border border-sky-100 bg-white p-8">
                <p className="font-semibold">
                  {savedOnly && !data.userId
                    ? "Log in to see your saved places."
                    : savedOnly
                      ? "No saved places match these filters."
                      : "No places match these filters."}
                </p>

                <p className="mt-2 text-sm text-slate-600">
                  {data.places.length === 0
                    ? "The published collection is empty. Add the starter entries in Supabase."
                    : "Try another destination, clear the search, or turn off the saved-places filter."}
                </p>
              </div>
            ) : (
              <div className="mt-4 grid gap-5 md:grid-cols-2">
                {visiblePlaces.map((place) => {
                  const saved = data.savedIds.includes(place.id);
                  const item = categories[place.category];
                  const busy = busyId === place.id;

                  return (
                    <article
                      key={place.id}
                      className="flex flex-col rounded-3xl border border-sky-100 bg-white p-6 shadow-sm"
                    >
                      <div className="flex items-start gap-4">
                        <span
                          aria-hidden="true"
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sky-50 text-3xl"
                        >
                          {item?.icon ?? "📍"}
                        </span>

                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                            {place.destination}
                          </p>
                          <h3 className="mt-1 break-words text-xl font-bold">
                            {place.name}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">
                            {place.address}
                          </p>
                        </div>
                      </div>

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

                        {data.userId ? (
                          <button
                            type="button"
                            aria-pressed={saved}
                            aria-label={`${saved ? "Remove" : "Save"} ${place.name}${saved ? " from favorites" : " to favorites"}`}
                            onClick={() => void toggleSaved(place)}
                            disabled={busyId !== null}
                            className={`rounded-full border px-5 py-2.5 text-sm font-semibold disabled:opacity-50 ${
                              saved
                                ? "border-rose-200 bg-rose-50 text-rose-700"
                                : "border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            {busy
                              ? "Updating…"
                              : saved
                                ? "♥ Saved"
                                : "♡ Save place"}
                          </button>
                        ) : (
                          <Link
                            href="/login"
                            className="rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700"
                          >
                            Log in to save
                          </Link>
                        )}
                      </div>
                      <AddPlaceToTrip key={`${data.userId ?? "guest"}:${place.id}`} place={place} />
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <p className="mt-8 text-sm leading-6 text-slate-600">
          Directions open in Google Maps. Allow location access there
          to use your current location, or enter a starting point.
          Confirm the destination shown before starting your journey.
          Opening hours, entry rules, and access can change.
        </p>
      </main>
    </div>
  );
}