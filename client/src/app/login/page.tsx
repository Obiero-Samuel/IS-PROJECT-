"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { login } from "@/lib/api";
import { setAuth } from "@/lib/auth";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const result = await login(email, password);
            setAuth(result);
            router.push("/my-reports");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed.");
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
