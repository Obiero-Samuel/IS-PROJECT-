/**
 * New report submission form.
 */
"use client";

import dynamic from "next/dynamic";
import { FormEvent, useEffect, useMemo, useState } from "react";
import NavBar from "@/components/NavBar";
import RequireAuth from "@/components/RequireAuth";
import { createReport, getCategories } from "@/lib/api";
import type { Category } from "@/lib/types";
import styles from "./page.module.css";

const LeafletMapPicker = dynamic(() => import("@/components/map/LeafletMapPicker"), {
    ssr: false,
});

export default function NewReportPage() {
    // Controlled input states for report payload fields.
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [locationAddress, setLocationAddress] = useState("");
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);
    const [photo, setPhoto] = useState<File | null>(null);

    // Supporting UI/state for options + async feedback.
    const [categories, setCategories] = useState<Category[]>([]);
    const [loadingCategories, setLoadingCategories] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    useEffect(() => {
        const run = async () => {
            try {
                // Load category options once for form submit.
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

    // Resolve selected category details for inline helper text.
    const selectedCategory = useMemo(
        () => categories.find((item) => String(item.id) === categoryId) ?? null,
        [categories, categoryId],
    );

    // Curated hints to reduce category confusion for common resident issues.
    const categoryHints = useMemo(
        () => [
            {
                title: "Road damage or potholes",
                suggested: ["Roads & Potholes", "Drainage & Flooding"],
            },
            {
                title: "No power or dark streets",
                suggested: ["Street Lighting", "Public Safety"],
            },
            {
                title: "Garbage or sewage issues",
                suggested: ["Waste Management", "Sanitation & Sewage"],
            },
        ],
        [],
    );

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        // Prevent default browser submit to keep React control.
        event.preventDefault();

        setError(null);
        setSuccess(null);
        setSubmitting(true);

        try {
            // Multipart payload bundles fields + optional photo.
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

            const result = await createReport(formData);
            setSuccess(`Report submitted successfully. Tracking Number: ${result.report.tracking_number}`);

            // Reset for quick next submission.
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
        <RequireAuth>
            <NavBar />
            <main className="main">
                <div className={`container ${styles.layout}`}>
                    <section className={styles.hero}>
                        {/* Form intro section. */}
                        <p className={styles.badge}>REPORT SUBMISSION</p>
                        <h1 className={styles.heroTitle}>Submit a new report</h1>
                        <p className={styles.heroLead}>
                            Tell us what happened, where it happened, and add a photo if available.
                            Pick the closest matching category so your report reaches the right authority faster.
                        </p>
                    </section>

                    {error && <p className="message error">{error}</p>}
                    {success && <p className="message success">{success}</p>}

                    <section className={`card ${styles.formCard}`}>
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
                                    // Use dropdown when backend categories are available.
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

                            {/* Selected-category helper gives residents confidence before submit. */}
                            {categories.length > 0 && (
                                <div className={styles.categoryAssist}>
                                    {!categoryId ? (
                                        <p className={styles.categoryPrompt}>
                                            Select a category to see what kinds of issues it covers.
                                        </p>
                                    ) : selectedCategory ? (
                                        <>
                                            <p className={styles.categoryLabel}>Selected category</p>
                                            <h3>{selectedCategory.name}</h3>
                                            <p className="muted">
                                                {selectedCategory.description ||
                                                    "This category is currently active for resident report routing."}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="message error">Selected category is no longer available. Please choose again.</p>
                                    )}
                                </div>
                            )}

                            {categories.length > 0 && (
                                <section className={styles.categoryHints} aria-label="Category guidance">
                                    {categoryHints.map((hint) => (
                                        <article key={hint.title} className={styles.hintCard}>
                                            <h3>{hint.title}</h3>
                                            <p className="muted">Suggested categories: {hint.suggested.join(" • ")}</p>
                                        </article>
                                    ))}
                                </section>
                            )}

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
                                        // Save picked coordinates into form state.
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

                            <button type="submit" className="primary" disabled={submitting}>
                                {submitting ? "Submitting..." : "Submit report"}
                            </button>
                        </form>
                    </section>
                </div>
            </main>
        </RequireAuth>
    );
}
