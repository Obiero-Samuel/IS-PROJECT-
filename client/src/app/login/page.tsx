"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { getWards, login } from "@/lib/api";
import { getToken, setAuth } from "@/lib/auth";
import type { Ward } from "@/lib/types";

const getQueryParam = (key: string, fallback = "") => {
    if (typeof window === "undefined") return fallback;
    return new URLSearchParams(window.location.search).get(key) || fallback;
};

export default function LoginPage() {
    const router = useRouter();
    const nextPath = getQueryParam("next", "/my-profile");
    const initialEmail = getQueryParam("email", "");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState(initialEmail);
    const [password, setPassword] = useState("");
    const [wardId, setWardId] = useState("");
    const [wards, setWards] = useState<Ward[]>([]);
    const [loadingWards, setLoadingWards] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (getToken()) {
            router.replace("/my-profile");
        }
    }, [router]);

    useEffect(() => {
        const run = async () => {
            try {
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
        event.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const result = await login(username, email, password, Number(wardId));
            setAuth(result);
            router.push(nextPath);
        } catch (err) {
            const message = err instanceof Error ? err.message : "Login failed.";
            setError(message);

            if (message.toLowerCase().includes("not verified") || message.toLowerCase().includes("otp")) {
                router.push(`/verify-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent(nextPath)}`);
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
                        <h1 className="title">Login</h1>
                        <p className="subtitle">Access your resident account to submit and track reports.</p>

                        {error && <p className="message error">{error}</p>}

                        <form onSubmit={handleSubmit}>
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
