"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { resendVerificationOtp, verifyEmailOtp } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { defaultRouteForRole } from "@/lib/roleRouting";

const getQueryParam = (key: string, fallback = "") => {
    if (typeof window === "undefined") return fallback;
    return new URLSearchParams(window.location.search).get(key) || fallback;
};

export default function VerifyEmailPage() {
    const router = useRouter();
    const nextPath = getQueryParam("next", "");
    const email = getQueryParam("email", "");

    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        setMessage(null);
        setLoading(true);

        try {
            const result = await verifyEmailOtp(email, otp);
            setAuth(result);
            router.push(nextPath || defaultRouteForRole(result.user.role));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to verify OTP.");
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        setError(null);
        setMessage(null);
        setResending(true);

        try {
            const result = await resendVerificationOtp(email);
            const debugOtp = result.debug?.otp;
            const smtpResponse = result.debug?.smtpResponse;

            if (debugOtp) {
                setMessage(
                    `${result.message} (DEV OTP available: ${debugOtp})${smtpResponse ? ` — Provider: ${smtpResponse}` : ""}`
                );
            } else {
                setMessage(`${result.message}${smtpResponse ? ` — Provider: ${smtpResponse}` : ""}`);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to resend OTP.");
        } finally {
            setResending(false);
        }
    };

    return (
        <>
            <NavBar />
            <main className="main">
                <div className="container">
                    <section className="card stack auth-card">
                        <h1 className="title">Verify your email</h1>
                        <p className="subtitle">
                            Enter the 6-digit OTP sent to <strong>{email || "your email"}</strong>.
                        </p>

                        {message && <p className="message success">{message}</p>}
                        {error && <p className="message error">{error}</p>}

                        <form onSubmit={handleVerify}>
                            <label>
                                OTP code
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]{6}"
                                    minLength={6}
                                    maxLength={6}
                                    required
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                                    placeholder="123456"
                                />
                            </label>

                            <button type="submit" className="primary" disabled={loading || !email}>
                                {loading ? "Verifying..." : "Verify and continue"}
                            </button>
                        </form>

                        <button type="button" className="ghost" onClick={handleResend} disabled={resending || !email}>
                            {resending ? "Sending OTP..." : "Resend OTP"}
                        </button>
                    </section>
                </div>
            </main>
        </>
    );
}
