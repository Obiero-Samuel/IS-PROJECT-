/**
 * This file handles profile viewing and profile update actions.
 */
"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import NavBar from "@/components/NavBar";
import RequireAuth from "@/components/RequireAuth";
import { getMyProfile, toPublicAssetUrl, updateMyProfile } from "@/lib/api";
import { getAuth, setAuth } from "@/lib/auth";
import type { ProfileEditsMeta, UserProfile } from "@/lib/types";
import styles from "./profile.module.css";

// Safe default edit-metadata while real profile data is still loading.
const EMPTY_EDIT_META: ProfileEditsMeta = {
    used: 0,
    max: 0,
    remaining: 0,
};

export default function MyProfilePage() {
    // Read current auth user for fallback display values (e.g., avatar initial).
    const authUser = getAuth()?.user;

    // Profile data and request-status states.
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [editMeta, setEditMeta] = useState<ProfileEditsMeta>(EMPTY_EDIT_META);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    // Controlled inputs for profile edit form.
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [residence, setResidence] = useState("");
    const [bio, setBio] = useState("");
    const [photoFile, setPhotoFile] = useState<File | null>(null);

    // Derived UI values from loaded profile/edit metadata.
    const canEdit = editMeta.remaining > 0;
    const joinedOn = profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "-";

    useEffect(() => {
        const run = async () => {
            setLoading(true);
            setError(null);

            try {
                // Load profile + edit counters from backend.
                const result = await getMyProfile();
                setProfile(result.profile);
                setEditMeta(result.profileEdits);

                // Pre-fill form controls using loaded profile values.
                setFullName(result.profile.full_name ?? "");
                setEmail(result.profile.email ?? "");
                setPhoneNumber(result.profile.phone_number ?? "");
                setDateOfBirth(result.profile.date_of_birth ?? "");
                setResidence(result.profile.residence ?? "");
                setBio(result.profile.bio ?? "");
            } catch (err) {
                setError(err instanceof Error ? err.message : "Failed to load your profile.");
            } finally {
                setLoading(false);
            }
        };

        void run();
    }, []);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        // Keep form submit in React flow (no page refresh).
        event.preventDefault();
        setError(null);
        setMessage(null);

        if (!canEdit) {
            setError("You have reached your profile edit limit.");
            return;
        }

        setSaving(true);

        try {
            // Send latest edited fields and optional photo upload.
            const result = await updateMyProfile({
                full_name: fullName,
                email,
                phone_number: phoneNumber,
                date_of_birth: dateOfBirth,
                residence,
                bio,
                photo: photoFile,
            });

            // Backend can return refreshed auth user info; keep local auth store synchronized.
            setAuth({ user: result.user });
            // Refresh profile card and edit counter details from response.
            setProfile(result.profile);
            setEditMeta(result.profileEdits);
            setMessage(result.message);
            // Clear selected file after successful upload.
            setPhotoFile(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update profile.");
        } finally {
            setSaving(false);
        }
    };

    // Resolve backend photo path into a full URL usable by Next/Image.
    const photoUrl = toPublicAssetUrl(profile?.profile_photo_url);

    return (
        <RequireAuth>
            <NavBar />
            <main className="main">
                <div className="container stack">
                    <section className="card stack">
                        <div className="row">
                            <div>
                                <h1 className="title">My Profile</h1>
                                <p className="subtitle">
                                    Manage your personal details. You have <strong>{editMeta.remaining}</strong> edits remaining
                                    out of <strong>{editMeta.max}</strong>.
                                </p>
                            </div>
                            <span className="badge">Joined {joinedOn}</span>
                        </div>

                        {loading && <p className="message">Loading profile...</p>}
                        {!loading && error && <p className="message error">{error}</p>}
                        {!loading && message && <p className="message success">{message}</p>}

                        {!loading && (
                            <div className={styles.profileLayout}>
                                {/* Left card shows compact profile summary + avatar. */}
                                <aside className={`${styles.summaryCard} card`}>
                                    <div className={styles.avatarWrap}>
                                        {photoUrl ? (
                                            <Image
                                                src={photoUrl}
                                                alt="Profile"
                                                width={132}
                                                height={132}
                                                className={styles.avatar}
                                                sizes="132px"
                                                unoptimized
                                            />
                                        ) : (
                                            // Fallback avatar is first letter of name/username.
                                            <div className={styles.avatarFallback}>
                                                {(profile?.full_name || authUser?.username || "U")
                                                    .trim()
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </div>
                                        )}
                                    </div>

                                    <div className="stack">
                                        {/* Read-only summary facts for quick reference. */}
                                        <h2>{profile?.full_name || authUser?.username}</h2>
                                        <p className="muted">{profile?.email}</p>
                                        <p className="muted">Role: {profile?.role}</p>
                                        <p className="muted">Edits used: {editMeta.used}</p>
                                        <p className="muted">Edits left: {editMeta.remaining}</p>
                                    </div>
                                </aside>

                                {/* Right card contains editable profile form fields. */}
                                <section className={`${styles.formCard} card stack`}>
                                    <h2>Edit profile</h2>
                                    <form onSubmit={handleSubmit}>
                                        <label>
                                            Name
                                            <input
                                                type="text"
                                                required
                                                maxLength={120}
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                                disabled={!canEdit || saving}
                                            />
                                        </label>

                                        <label>
                                            Email
                                            <input
                                                type="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                disabled={!canEdit || saving}
                                            />
                                        </label>

                                        <label>
                                            Phone number
                                            <input
                                                type="tel"
                                                value={phoneNumber}
                                                onChange={(e) => setPhoneNumber(e.target.value)}
                                                placeholder="+254..."
                                                disabled={!canEdit || saving}
                                            />
                                        </label>

                                        <label>
                                            Date of birth
                                            <input
                                                type="date"
                                                value={dateOfBirth}
                                                onChange={(e) => setDateOfBirth(e.target.value)}
                                                disabled={!canEdit || saving}
                                            />
                                        </label>

                                        <label>
                                            Place of residence
                                            <input
                                                type="text"
                                                maxLength={255}
                                                value={residence}
                                                onChange={(e) => setResidence(e.target.value)}
                                                placeholder="Neighborhood, estate, landmark"
                                                disabled={!canEdit || saving}
                                            />
                                        </label>

                                        <label>
                                            Bio
                                            <textarea
                                                maxLength={500}
                                                value={bio}
                                                onChange={(e) => setBio(e.target.value)}
                                                placeholder="Tell us about yourself"
                                                disabled={!canEdit || saving}
                                            />
                                        </label>

                                        <label>
                                            Profile photo
                                            <input
                                                type="file"
                                                accept=".jpg,.jpeg,.png,.gif,.webp"
                                                onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
                                                disabled={!canEdit || saving}
                                            />
                                        </label>

                                        {!canEdit && (
                                            <p className="message error">
                                                You have reached the maximum number of profile edits allowed.
                                            </p>
                                        )}

                                        <button type="submit" className="primary" disabled={!canEdit || saving}>
                                            {saving ? "Saving changes..." : "Save profile"}
                                        </button>
                                    </form>
                                </section>
                            </div>
                        )}
                    </section>
                </div>
            </main>
        </RequireAuth>
    );
}
