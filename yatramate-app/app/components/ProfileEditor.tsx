"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "../../lib/supabase/client";

type Props = {
  user: User;
  onSaved: (user: User) => void;
};

const MAX_FILE_SIZE = 2 * 1024 * 1024;

const extensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export default function ProfileEditor({ user, onSaved }: Props) {
  const storedName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : "";

  const avatarPath =
    typeof user.user_metadata?.avatar_path === "string"
      ? user.user_metadata.avatar_path
      : "";

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(storedName);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [photoError, setPhotoError] = useState("");

  const [photo, setPhoto] = useState<{
    path: string;
    url: string;
  } | null>(null);

  const fileInput = useRef<HTMLInputElement>(null);
  const saving = useRef(false);

  useEffect(() => {
    let active = true;
    let objectUrl: string | undefined;

    async function loadPhoto() {
      try {
        if (!avatarPath) return;

        const { data, error } = await createClient()
          .storage.from("avatars")
          .download(avatarPath);

        if (!active) return;

        if (error) {
          setPhotoError("Your photo could not be loaded. Try refreshing.");
          return;
        }

        objectUrl = URL.createObjectURL(data);

        setPhoto({
          path: avatarPath,
          url: objectUrl,
        });

        setPhotoError("");
      } catch {
        if (active) {
          setPhotoError("Your photo could not be loaded. Try refreshing.");
        }
      }
    }

    void loadPhoto();

    return () => {
      active = false;

      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [avatarPath]);

  function startEditing() {
    setName(storedName);
    setFile(null);
    setError("");
    setMessage("");
    setEditing(true);
  }

  function chooseFile(selected: File | undefined) {
    setError("");
    setMessage("");
    setFile(null);

    if (!selected) return;

    if (!extensions[selected.type]) {
      setError("Please choose a JPG, PNG, or WebP image.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setError("Your photo must be 2 MB or smaller.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }

    if (selected.size === 0) {
      setError("This file is empty. Choose another photo.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }

    setFile(selected);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving.current) return;

    const fullName = name.trim();

    if (!fullName || fullName.length > 80) {
      setError("Enter a name between 1 and 80 characters.");
      return;
    }

    saving.current = true;
    setBusy(true);
    setError("");
    setMessage("");

    let newPath: string | null = null;
    let profileUpdated = false;

    try {
      const supabase = createClient();

      const {
        data: { user: currentUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !currentUser || currentUser.id !== user.id) {
        throw new Error("Please log in again before editing your profile.");
      }

      if (file) {
        // Check that the selected file can actually be decoded as an image.
        try {
          const bitmap = await createImageBitmap(file);
          bitmap.close();
        } catch {
          throw new Error(
            "This photo could not be opened. Please choose another image."
          );
        }

        newPath =
          `${currentUser.id}/${crypto.randomUUID()}.` +
          extensions[file.type];

        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(newPath, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(uploadError.message);
        }
      }

      const metadata: {
        full_name: string;
        avatar_path?: string;
      } = {
        full_name: fullName,
      };

      if (newPath) {
        metadata.avatar_path = newPath;
      }

      const { data, error: updateError } =
        await supabase.auth.updateUser({
          data: metadata,
        });

      if (updateError) {
        throw new Error(updateError.message);
      }

      if (!data.user) {
        throw new Error("The profile update could not be confirmed.");
      }

      profileUpdated = true;

      setEditing(false);
      setFile(null);
      setMessage("Your profile has been saved.");

      onSaved(data.user);
    } catch (error) {
      // Remove a new upload if the profile update failed.
      // Existing profile photos are never removed here.
      if (newPath && !profileUpdated) {
        try {
          await createClient()
            .storage.from("avatars")
            .remove([newPath]);
        } catch {
          // Preserve the original error.
        }
      }

      setError(
        error instanceof Error
          ? error.message
          : "Could not save your profile. Please try again."
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  const currentPhoto =
    avatarPath && photo?.path === avatarPath ? photo.url : null;

  const initial = (
    storedName.trim()[0] ??
    user.email?.[0] ??
    "Y"
  ).toUpperCase();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div className="flex min-w-0 items-center gap-4">
          {currentPhoto ? (
            <Image
              src={currentPhoto}
              alt="Your profile photo"
              width={80}
              height={80}
              unoptimized
              className="h-20 w-20 shrink-0 rounded-full object-cover ring-4 ring-teal-50"
            />
          ) : (
            <div
              aria-hidden="true"
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-teal-100 text-3xl font-bold text-teal-800"
            >
              {initial}
            </div>
          )}

          <div className="min-w-0">
            <h2
              id="account-title"
              className="break-words text-2xl font-bold"
            >
              {storedName.trim() || "YatraMate traveler"}
            </h2>
            <p className="mt-1 text-slate-500">
              Account information
            </p>
          </div>
        </div>

        {!editing && (
          <button
            type="button"
            onClick={startEditing}
            className="rounded-xl border border-teal-700 px-5 py-2.5 text-sm font-semibold text-teal-700 hover:bg-teal-50"
          >
            Edit profile
          </button>
        )}
      </div>

      {photoError && avatarPath && (
        <p role="status" className="mt-3 text-sm text-slate-600">
          {photoError}
        </p>
      )}

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

      {editing && (
        <form
          onSubmit={saveProfile}
          className="mt-6 space-y-5 rounded-2xl bg-slate-50 p-5"
        >
          <label className="block text-sm font-semibold">
            Your name
            <input
              type="text"
              autoComplete="name"
              required
              maxLength={80}
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
              placeholder="Enter your name"
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
          </label>

          <label className="block text-sm font-semibold">
            Profile photo
            <input
              ref={fileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(event) =>
                chooseFile(event.target.files?.[0])
              }
              className="mt-2 block w-full rounded-xl border border-slate-300 bg-white p-3 text-sm"
            />
          </label>

          <p className="text-sm text-slate-500">
            JPG, PNG, or WebP. Maximum size: 2 MB.
            Leave this empty to keep your current photo.
          </p>

          {file && (
            <p className="break-all text-sm text-teal-700">
              Selected: {file.name}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save profile"}
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setFile(null);
                setError("");
              }}
              className="rounded-xl border border-slate-300 bg-white px-5 py-3 font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}