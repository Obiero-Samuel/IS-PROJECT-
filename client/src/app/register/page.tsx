/**
 * Registration flow for residents and authority officers.
 */
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { getWards, register } from "@/lib/api";
import { getAuth, getToken } from "@/lib/auth";
import { defaultRouteForRole } from "@/lib/roleRouting";
import type { Ward } from "@/lib/types";

// Browser-only query helper used for optional return path.
const getQueryParam = (key: string, fallback = "") => {
    if (typeof window === "undefined") return fallback;
    return new URLSearchParams(window.location.search).get(key) || fallback;
};

export default function RegisterPage() {
    const router = useRouter();
    // `next` keeps track of intended page after auth/verification flow.
    const nextPath = getQueryParam("next", "/my-profile");
    // Selected registration role controls whether ward is required.
    const [portalRole, setPortalRole] = useState<"resident" | "authority">("resident");
    // Controlled field states.
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [wardId, setWardId] = useState("");
    // Preloaded ward options for resident registrations.
    const [wards, setWards] = useState<Ward[]>([]);
    const [loadingWards, setLoadingWards] = useState(true);
    // Submission feedback states.
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Existing sessions skip registration.
        if (getToken()) {
            router.replace(defaultRouteForRole(getAuth()?.user?.role));
        }
    }, [router]);

    useEffect(() => {
        const run = async () => {
            try {
                // Load ward options used in resident onboarding.
                const wardList = await getWards({ county: "Nairobi", focus: "nairobi-west" });
                setWards(wardList);
            } catch {
                setWards([]);
            } finally {
                setLoadingWards(false);
            }
        };

        void run();
    }, []);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        // Keep SPA flow by preventing default HTML form submit reload.
        event.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setLoading(true);

        try {
            // Account is created first; OTP verification follows.
            await register(username, email, password, {
                role_context: portalRole,
                ward_id: portalRole === "resident" ? Number(wardId) : undefined,
            });
            // Inform user and route them to login/verification continuation.
            setSuccessMessage("Registration successful. Check your email for OTP verification, then login and verify.");
            router.push(`/login?next=${encodeURIComponent(nextPath)}&email=${encodeURIComponent(email)}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Registration failed.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <NavBar />
            <main className="main">
                <div className="container">
                    <section className="card stack auth-card">
                        {/* Intro section explains what this form is for. */}
                        <h1 className="title">Create account</h1>
                        <p className="subtitle">Join as a resident or authority officer and start using the platform.</p>

                        {successMessage && <p className="message success">{successMessage}</p>}
                        {error && <p className="message error">{error}</p>}

                        <form onSubmit={handleSubmit}>
                            <label>
                                Signup role
                                <select
                                    required
                                    value={portalRole}
                                    onChange={(e) => setPortalRole(e.target.value as "resident" | "authority")}
                                >
                                    <option value="resident">Resident</option>
                                    <option value="authority">Authority Officer</option>
                                </select>
                            </label>

                            <label>
                                Username
                                <input
                                    type="text"
                                    required
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="jane_doe"
                                />
                            </label>

                            <label>
                                Email
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="you@example.com"
                                />
                            </label>

                            <label>
                                Password
                                <input
                                    type="password"
                                    required
                                    minLength={8}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="At least 8 characters"
                                />
                            </label>

                            {portalRole === "resident" ? (
                                <label>
                                    Ward
                                    {loadingWards ? (
                                        <input value="Loading wards..." readOnly />
                                    ) : wards.length === 0 ? (
                                        <input
                                            type="number"
                                            required
                                            value={wardId}
                                            onChange={(e) => setWardId(e.target.value)}
                                            placeholder="Enter ward ID"
                                        />
                                    ) : (
                                        // Resident role picks from known wards when list is available.
                                        <select
                                            required
                                            value={wardId}
                                            onChange={(e) => setWardId(e.target.value)}
                                        >
                                            <option value="">Select your ward</option>
                                            {wards.map((ward) => (
                                                <option key={ward.id} value={ward.id}>
                                                    {ward.name}
                                                    {ward.constituency ? ` — ${ward.constituency}` : ""}
                                                    {ward.code ? ` (${ward.code})` : ""}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                </label>
                            ) : (
                                // Authority signup does not ask for ward.
                                <p className="muted">Ward is not required for authority officer signup.</p>
                            )}

                            <button type="submit" className="primary" disabled={loading}>
                                {loading ? "Creating account..." : "Register"}
                            </button>
                        </form>
                    </section>
                </div>
            </main>
        </>
    );
}
