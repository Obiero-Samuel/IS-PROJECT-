/**
 * Email OTP verification and resend flow.
 */
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { resendVerificationOtp, verifyEmailOtp } from "@/lib/api";
import { setAuth } from "@/lib/auth";
import { defaultRouteForRole } from "@/lib/roleRouting";

// Read query values safely when running in browser.
const getQueryParam = (key: string, fallback = "") => {
    if (typeof window === "undefined") return fallback;
    return new URLSearchParams(window.location.search).get(key) || fallback;
};

export default function VerifyEmailPage() {
    const router = useRouter();
    // `next` is optional destination after successful verification.
    const nextPath = getQueryParam("next", "");
    // Email is expected in query string from register/login handoff.
    const email = getQueryParam("email", "");

    // OTP input and action states.
    const [otp, setOtp] = useState("");
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
        // Avoid full page refresh and keep SPA verification flow.
        event.preventDefault();
        setError(null);
        setMessage(null);

        if (!email) {
            setError("Email is missing from this verification link. Please register or login again.");
            return;
        }

        setLoading(true);

        try {
            // Successful verify returns session payload.
            const result = await verifyEmailOtp(email, otp);
            // Save session and redirect into user workspace.
            setAuth({ user: result.user });
            router.push(nextPath || defaultRouteForRole(result.user.role));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to verify OTP.");
        } finally {
            setLoading(false);
        }
    };

    const handleResend = async () => {
        // Reset prior messages before sending a new request.
        setError(null);
        setMessage(null);

        if (!email) {
            setError("Email is missing from this verification link. Please register or login again.");
            return;
        }

        setResending(true);

        try {
            // Dev responses may include debug OTP metadata.
            const result = await resendVerificationOtp(email);
            const debugOtp = result.debug?.otp;
            const smtpResponse = result.debug?.smtpResponse;

            if (debugOtp) {
                // In dev mode we show debug OTP to speed up local testing.
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
                        {/* Clear instructions for users completing email verification. */}
                        <h1 className="title">Verify your email</h1>
                        <p className="subtitle">
                            Enter the 6-digit OTP sent to your email.
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

                            <button type="submit" className="primary" disabled={loading}>
                                {loading ? "Verifying..." : "Verify and continue"}
                            </button>
                        </form>

                        <button type="button" className="ghost" onClick={handleResend} disabled={resending}>
                            {resending ? "Sending OTP..." : "Resend OTP"}
                        </button>
                    </section>
                </div>
            </main>
        </>
    );
}
