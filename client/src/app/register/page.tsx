"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { register } from "@/lib/api";
import { setAuth } from "@/lib/auth";

export default function RegisterPage() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const result = await register(username, email, password);
            setAuth(result);
            router.push("/my-reports");
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
