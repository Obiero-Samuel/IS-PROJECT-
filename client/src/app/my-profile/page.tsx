"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import NavBar from "@/components/NavBar";
import RequireAuth from "@/components/RequireAuth";
import { getMyProfile, toPublicAssetUrl, updateMyProfile } from "@/lib/api";
import { getAuth, getToken, setAuth } from "@/lib/auth";
import type { ProfileEditsMeta, UserProfile } from "@/lib/types";
import styles from "./profile.module.css";

const EMPTY_EDIT_META: ProfileEditsMeta = {
    used: 0,
    max: 0,
    remaining: 0,
};

export default function MyProfilePage() {
    const router = useRouter();
    const authUser = getAuth()?.user;

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [editMeta, setEditMeta] = useState<ProfileEditsMeta>(EMPTY_EDIT_META);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [dateOfBirth, setDateOfBirth] = useState("");
    const [residence, setResidence] = useState("");
    const [bio, setBio] = useState("");
    const [photoFile, setPhotoFile] = useState<File | null>(null);

    const canEdit = editMeta.remaining > 0;
    const joinedOn = profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "-";

    useEffect(() => {
        const run = async () => {
            const token = getToken();
            if (!token) {
                router.replace("/register?next=%2Fmy-profile");
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const result = await getMyProfile(token);
                setProfile(result.profile);
                setEditMeta(result.profileEdits);

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
    }, [router]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setMessage(null);

        if (!canEdit) {
            setError("You have reached your profile edit limit.");
            return;
        }

        const token = getToken();
        if (!token) {
            router.replace("/register?next=%2Fmy-profile");
            return;
        }

        setSaving(true);

        try {
            const result = await updateMyProfile(token, {
                full_name: fullName,
                email,
                phone_number: phoneNumber,
                date_of_birth: dateOfBirth,
                residence,
                bio,
                photo: photoFile,
            });

            setAuth({ token: result.token, user: result.user });
            setProfile(result.profile);
            setEditMeta(result.profileEdits);
            setMessage(result.message);
            setPhotoFile(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update profile.");
        } finally {
            setSaving(false);
        }
    };

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
                                            />
                                        ) : (
                                            <div className={styles.avatarFallback}>
                                                {(profile?.full_name || authUser?.username || "U")
                                                    .trim()
                                                    .charAt(0)
                                                    .toUpperCase()}
                                            </div>
                                        )}
                                    </div>

                                    <div className="stack">
                                        <h2>{profile?.full_name || authUser?.username}</h2>
                                        <p className="muted">{profile?.email}</p>
                                        <p className="muted">Role: {profile?.role}</p>
                                        <p className="muted">Edits used: {editMeta.used}</p>
                                        <p className="muted">Edits left: {editMeta.remaining}</p>
                                    </div>
                                </aside>

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
