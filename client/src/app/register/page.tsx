"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { getWards, register } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Ward } from "@/lib/types";

const getQueryParam = (key: string, fallback = "") => {
    if (typeof window === "undefined") return fallback;
    return new URLSearchParams(window.location.search).get(key) || fallback;
};

export default function RegisterPage() {
    const router = useRouter();
    const nextPath = getQueryParam("next", "/my-profile");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [wardId, setWardId] = useState("");
    const [wards, setWards] = useState<Ward[]>([]);
    const [loadingWards, setLoadingWards] = useState(true);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
        setSuccessMessage(null);
        setLoading(true);

        try {
            await register(username, email, password, Number(wardId));
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
                        <h1 className="title">Create account</h1>
                        <p className="subtitle">Join as a resident and start reporting local issues.</p>

                        {successMessage && <p className="message success">{successMessage}</p>}
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
