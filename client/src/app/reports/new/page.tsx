"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import NavBar from "@/components/NavBar";
import { createReport, getCategories } from "@/lib/api";
import { getToken } from "@/lib/auth";
import type { Category } from "@/lib/types";

const LeafletMapPicker = dynamic(() => import("@/components/map/LeafletMapPicker"), {
    ssr: false,
});

export default function NewReportPage() {
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [locationAddress, setLocationAddress] = useState("");
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [photo, setPhoto] = useState<File | null>(null);

    const [categories, setCategories] = useState<Category[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const hasToken = useMemo(() => Boolean(getToken()), []);

    useEffect(() => {
        const run = async () => {
            try {
                const result = await getCategories();
                setCategories(result);
            } catch {
                setCategories([]);
            } finally {
                setLoadingCategories(false);
            }
        };

        void run();
    }, []);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        const token = getToken();
        if (!token) {
            setError("Please login first to submit a report.");
            return;
        }

        setError(null);
        setSuccess(null);
        setSubmitting(true);

        try {
            const formData = new FormData();
            formData.append("title", title);
            formData.append("description", description);
            formData.append("category_id", categoryId);

            if (locationAddress.trim()) {
                formData.append("location_address", locationAddress.trim());
            }
            if (latitude != null) {
                formData.append("latitude", String(latitude));
            }
            if (longitude != null) {
                formData.append("longitude", String(longitude));
            }
            if (photo) {
                formData.append("photo", photo);
            }

            const result = await createReport(token, formData);
            setSuccess(`Report submitted successfully. Tracking Number: ${result.report.tracking_number}`);

            setTitle("");
            setDescription("");
            setCategoryId("");
            setLocationAddress("");
            setLatitude(null);
            setLongitude(null);
            setPhoto(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Submission failed.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <NavBar />
            <main className="main">
                <div className="container stack">
                    <section className="card stack">
                        <h1 className="title">Submit a new report</h1>
                        <p className="subtitle">Tell us what happened, where it happened, and add a photo if available.</p>
                        {!hasToken && (
                            <p className="message error">
                                You need to <Link href="/login">login</Link> before submitting a report.
                            </p>
                        )}
                    </section>

                    {error && <p className="message error">{error}</p>}
                    {success && <p className="message success">{success}</p>}

                    <section className="card">
                        <form onSubmit={handleSubmit}>
                            <label>
                                Title
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Broken streetlight near school"
                                />
                            </label>

                            <label>
                                Description
                                <textarea
                                    required
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Describe the issue and impact..."
                                />
                            </label>

                            <label>
                                Category
                                {loadingCategories ? (
                                    <input value="Loading categories..." readOnly />
                                ) : categories.length > 0 ? (
                                    <select
                                        required
                                        value={categoryId}
                                        onChange={(e) => setCategoryId(e.target.value)}
                                    >
                                        <option value="">Select category</option>
                                        {categories.map((category) => (
                                            <option key={category.id} value={category.id}>
                                                {category.name}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="number"
                                        required
                                        value={categoryId}
                                        onChange={(e) => setCategoryId(e.target.value)}
                                        placeholder="Category ID"
                                    />
                                )}
                            </label>

                            <label>
                                Location address (optional)
                                <input
                                    type="text"
                                    value={locationAddress}
                                    onChange={(e) => setLocationAddress(e.target.value)}
                                    placeholder="Street / landmark"
                                />
                            </label>

                            <div className="stack">
                                <p><strong>Pick location on map (optional)</strong></p>
                                <p className="muted">Click on the map to place your issue marker.</p>
                                <LeafletMapPicker
                                    latitude={latitude}
                                    longitude={longitude}
                                    onPick={(lat, lng) => {
                                        setLatitude(lat);
                                        setLongitude(lng);
                                    }}
                                />
                                <p className="muted">
                                    Selected: {latitude != null && longitude != null ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : "No coordinates selected"}
                                </p>
                            </div>

                            <label>
                                Photo (optional)
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                                />
                            </label>

                            <button type="submit" className="primary" disabled={submitting || !hasToken}>
                                {submitting ? "Submitting..." : "Submit report"}
                            </button>
                        </form>
                    </section>
                </div>
            </main>
        </>
    );
}
