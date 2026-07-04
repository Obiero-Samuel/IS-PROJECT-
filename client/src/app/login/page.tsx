/**
 * Login flow with role context and OTP fallback.
 */
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { getWards, login } from "@/lib/api";
import { getAuth, getToken, setAuth } from "@/lib/auth";
import { defaultRouteForRole } from "@/lib/roleRouting";
import type { Ward } from "@/lib/types";

// Small helper to read query string safely in browser-only context.
const getQueryParam = (key: string, fallback = "") => {
    if (typeof window === "undefined") return fallback;
    return new URLSearchParams(window.location.search).get(key) || fallback;
};

export default function LoginPage() {
    const router = useRouter();
    // Optional deep-link destination after successful login.
    const requestedNextPath = getQueryParam("next", "");
    // Selected portal role controls backend role-context validation.
    const [portalRole, setPortalRole] = useState<"resident" | "authority" | "admin">("resident");
    // Controlled input states.
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [wardId, setWardId] = useState("");
    // Ward list is preloaded for resident role selection.
    const [wards, setWards] = useState<Ward[]>([]);
    const [loadingWards, setLoadingWards] = useState(true);
    // UI feedback states.
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Skip login if session already exists.
        if (getToken()) {
            const currentRole = getAuth()?.user?.role;
            router.replace(requestedNextPath || defaultRouteForRole(currentRole));
        }
    }, [requestedNextPath, router]);

    useEffect(() => {
        const run = async () => {
            try {
                // Preload ward options for resident login.
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
        // Prevent browser form reload so we can handle async login in React.
        event.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // role_context lets backend enforce portal-role alignment.
            const result = await login(username, email, password, {
                role_context: portalRole,
                ward_id: portalRole === "resident" ? Number(wardId) : undefined,
            });
            // Persist auth payload for shared session-aware components.
            setAuth(result);
            // Go to requested path (if present) or role default dashboard.
            router.push(requestedNextPath || defaultRouteForRole(result.user.role));
        } catch (err) {
            const message = err instanceof Error ? err.message : "Login failed.";
            setError(message);

            // Route unverified users to OTP verification.
            if (message.toLowerCase().includes("not verified") || message.toLowerCase().includes("otp")) {
                const nextForVerification = requestedNextPath || defaultRouteForRole(portalRole);
                router.push(`/verify-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent(nextForVerification)}`);
            }
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
                        {/* Header text gives user context for role-aware login. */}
                        <h1 className="title">Login</h1>
                        <p className="subtitle">Sign in as resident, authority officer, or administrator.</p>

                        {error && <p className="message error">{error}</p>}

                        <form onSubmit={handleSubmit}>
                            <label>
                                Login portal
                                <select
                                    required
                                    value={portalRole}
                                    onChange={(e) => setPortalRole(e.target.value as "resident" | "authority" | "admin")}
                                >
                                    <option value="resident">Resident</option>
                                    <option value="authority">Authority Officer</option>
                                    <option value="admin">Administrator</option>
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
                                        // Resident flow requires selecting ward when options are available.
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
                                // Authority/admin flows do not require ward selection.
                                <p className="muted">Ward is not required for this portal role.</p>
                            )}

                            <label>
                                Password
                                <input
                                    type="password"
                                    required
                                    minLength={8}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                />
                            </label>

                            <button type="submit" className="primary" disabled={loading}>
                                {loading ? "Signing in..." : "Login"}
                            </button>
                        </form>
                    </section>
                </div>
            </main>
        </>
    );
}
