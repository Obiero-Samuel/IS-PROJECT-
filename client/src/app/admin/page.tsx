"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import { apiRequest, loadStoredToken, storeToken } from "@/lib/api";
import styles from "./page.module.css";

type UserRow = {
    id: number;
    username: string;
    email: string;
    role: "resident" | "authority" | "admin";
};

type WardRow = {
    id: number;
    name: string;
    county: string;
    constituency: string | null;
};

type CategoryRow = {
    id: number;
    name: string;
    description: string | null;
};

type AuthorityRow = {
    id: number;
    name: string;
    type: string;
    jurisdiction: string | null;
};

export default function AdminPage() {
    const [token, setToken] = useState(() => loadStoredToken());
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const [users, setUsers] = useState<UserRow[]>([]);
    const [wards, setWards] = useState<WardRow[]>([]);
    const [categories, setCategories] = useState<CategoryRow[]>([]);
    const [authorities, setAuthorities] = useState<AuthorityRow[]>([]);

    const [newCategory, setNewCategory] = useState({ name: "", description: "" });
    const [newWard, setNewWard] = useState({ name: "", county: "", constituency: "" });
    const [newAuthority, setNewAuthority] = useState({ name: "", type: "", jurisdiction: "" });

    const totals = useMemo(
        () => ({
            users: users.length,
            admins: users.filter((user) => user.role === "admin").length,
            officers: users.filter((user) => user.role === "authority").length,
            wards: wards.length,
            categories: categories.length,
            authorities: authorities.length,
        }),
        [users, wards.length, categories.length, authorities.length],
    );

    const messageClass = useMemo(() => {
        const lowered = message.toLowerCase();
        if (!lowered || lowered.includes("loading")) return "";
        if (
            lowered.includes("failed") ||
            lowered.includes("required") ||
            lowered.includes("invalid") ||
            lowered.includes("forbidden") ||
            lowered.includes("error")
        ) {
            return styles.feedbackError;
        }
        return styles.feedbackSuccess;
    }, [message]);

    const saveToken = () => {
        storeToken(token);
        setMessage("Token saved locally.");
    };

    const loadAll = async () => {
        setLoading(true);
        setMessage("Loading admin data...");

        try {
            const [usersRes, wardsRes, categoriesRes, authoritiesRes] = await Promise.all([
                apiRequest<{ users: UserRow[] }>("/admin/users", { token }),
                apiRequest<{ wards: WardRow[] }>("/admin/wards", { token }),
                apiRequest<{ categories: CategoryRow[] }>("/admin/categories", { token }),
                apiRequest<{ authorities: AuthorityRow[] }>("/admin/authorities", { token }),
            ]);

            setUsers(usersRes.users);
            setWards(wardsRes.wards);
            setCategories(categoriesRes.categories);
            setAuthorities(authoritiesRes.authorities);
            setMessage("Admin data refreshed.");
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to load admin data.";
            setMessage(msg);
        } finally {
            setLoading(false);
        }
    };

    const updateRole = async (userId: number, role: UserRow["role"]) => {
        try {
            await apiRequest(`/admin/users/${userId}`, {
                method: "PATCH",
                token,
                body: { role },
            });
            setMessage(`Updated user #${userId}.`);
            await loadAll();
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Role update failed.";
            setMessage(msg);
        }
    };

    const createCategory = async () => {
        if (!newCategory.name.trim()) {
            setMessage("Category name is required.");
            return;
        }

        try {
            await apiRequest("/admin/categories", {
                method: "POST",
                token,
                body: {
                    name: newCategory.name,
                    description: newCategory.description,
                },
            });
            setNewCategory({ name: "", description: "" });
            setMessage("Category created.");
            await loadAll();
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Create category failed.";
            setMessage(msg);
        }
    };

    const createWard = async () => {
        if (!newWard.name.trim() || !newWard.county.trim()) {
            setMessage("Ward name and county are required.");
            return;
        }

        try {
            await apiRequest("/admin/wards", {
                method: "POST",
                token,
                body: {
                    name: newWard.name,
                    county: newWard.county,
                    constituency: newWard.constituency,
                },
            });
            setNewWard({ name: "", county: "", constituency: "" });
            setMessage("Ward created.");
            await loadAll();
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Create ward failed.";
            setMessage(msg);
        }
    };

    const createAuthority = async () => {
        if (!newAuthority.name.trim() || !newAuthority.type.trim()) {
            setMessage("Authority name and type are required.");
            return;
        }

        try {
            await apiRequest("/admin/authorities", {
                method: "POST",
                token,
                body: {
                    name: newAuthority.name,
                    type: newAuthority.type,
                    jurisdiction: newAuthority.jurisdiction,
                },
            });
            setNewAuthority({ name: "", type: "", jurisdiction: "" });
            setMessage("Authority created.");
            await loadAll();
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Create authority failed.";
            setMessage(msg);
        }
    };

    return (
        <DashboardShell
            title="Admin Panel"
            subtitle="Manage users, categories, wards, and authorities from one command surface."
            token={token}
            onTokenChange={setToken}
            onSaveToken={saveToken}
        >
            <div className={styles.topBar}>
                <button className={styles.refreshButton} onClick={loadAll} disabled={loading}>
                    {loading ? "Refreshing..." : "Refresh all datasets"}
                </button>
                <p className={`${styles.feedback} ${messageClass}`}>
                    {message || "Use refresh to load admin datasets."}
                </p>
            </div>

            <section className={styles.statsGrid}>
                <article className={styles.statCard}>
                    <p className={styles.statLabel}>Users</p>
                    <p className={styles.statValue}>{totals.users}</p>
                    <p className={styles.itemMeta}>
                        {totals.admins} admin · {totals.officers} officers
                    </p>
                </article>

                <article className={styles.statCard}>
                    <p className={styles.statLabel}>Wards</p>
                    <p className={styles.statValue}>{totals.wards}</p>
                    <p className={styles.itemMeta}>Administrative geography units</p>
                </article>

                <article className={styles.statCard}>
                    <p className={styles.statLabel}>Categories</p>
                    <p className={styles.statValue}>{totals.categories}</p>
                    <p className={styles.itemMeta}>Issue routing classifications</p>
                </article>

                <article className={styles.statCard}>
                    <p className={styles.statLabel}>Authorities</p>
                    <p className={styles.statValue}>{totals.authorities}</p>
                    <p className={styles.itemMeta}>Assigned response organizations</p>
                </article>
            </section>

            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2>Users</h2>
                    <span className={styles.countBadge}>{users.length}</span>
                </div>

                <div className={styles.tableWrap}>
                    <table className={styles.dataTable}>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Username</th>
                                <th>Email</th>
                                <th>Current role</th>
                                <th>Role</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className={styles.tableEmpty}>
                                        No users loaded. Click &quot;Refresh all datasets&quot;.
                                    </td>
                                </tr>
                            ) : (
                                users.map((user) => (
                                    <tr key={user.id}>
                                        <td>{user.id}</td>
                                        <td>{user.username}</td>
                                        <td>{user.email}</td>
                                        <td>
                                            <span
                                                className={`${styles.roleBadge} ${user.role === "admin"
                                                        ? styles.roleAdmin
                                                        : user.role === "authority"
                                                            ? styles.roleAuthority
                                                            : styles.roleResident
                                                    }`}
                                            >
                                                {user.role}
                                            </span>
                                        </td>
                                        <td>
                                            <select
                                                aria-label={`Set role for ${user.username}`}
                                                title={`Set role for ${user.username}`}
                                                className={styles.roleSelect}
                                                value={user.role}
                                                onChange={(event) => updateRole(user.id, event.target.value as UserRow["role"])}
                                            >
                                                <option value="resident">resident</option>
                                                <option value="authority">authority</option>
                                                <option value="admin">admin</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <div className={styles.sectionGrid}>
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2>Categories</h2>
                        <span className={styles.countBadge}>{categories.length}</span>
                    </div>

                    <div className={styles.createRow}>
                        <input
                            placeholder="Name"
                            value={newCategory.name}
                            onChange={(event) => setNewCategory((prev) => ({ ...prev, name: event.target.value }))}
                        />
                        <input
                            placeholder="Description"
                            value={newCategory.description}
                            onChange={(event) => setNewCategory((prev) => ({ ...prev, description: event.target.value }))}
                        />
                        <button onClick={createCategory}>Add category</button>
                    </div>

                    {categories.length === 0 ? (
                        <p className={styles.emptyState}>No categories yet.</p>
                    ) : (
                        <ul className={styles.list}>
                            {categories.map((item) => (
                                <li key={item.id}>
                                    <strong>{item.name}</strong>
                                    <span className={styles.itemMeta}>{item.description || "No description"}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2>Wards</h2>
                        <span className={styles.countBadge}>{wards.length}</span>
                    </div>

                    <div className={styles.createRow}>
                        <input
                            placeholder="Ward name"
                            value={newWard.name}
                            onChange={(event) => setNewWard((prev) => ({ ...prev, name: event.target.value }))}
                        />
                        <input
                            placeholder="County"
                            value={newWard.county}
                            onChange={(event) => setNewWard((prev) => ({ ...prev, county: event.target.value }))}
                        />
                        <input
                            placeholder="Constituency"
                            value={newWard.constituency}
                            onChange={(event) => setNewWard((prev) => ({ ...prev, constituency: event.target.value }))}
                        />
                        <button onClick={createWard}>Add ward</button>
                    </div>

                    {wards.length === 0 ? (
                        <p className={styles.emptyState}>No wards yet.</p>
                    ) : (
                        <ul className={styles.list}>
                            {wards.map((item) => (
                                <li key={item.id}>
                                    <strong>{item.name}</strong>
                                    <span className={styles.itemMeta}>
                                        {item.county}
                                        {item.constituency ? ` / ${item.constituency}` : ""}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2>Authorities</h2>
                        <span className={styles.countBadge}>{authorities.length}</span>
                    </div>

                    <div className={styles.createRow}>
                        <input
                            placeholder="Authority name"
                            value={newAuthority.name}
                            onChange={(event) => setNewAuthority((prev) => ({ ...prev, name: event.target.value }))}
                        />
                        <input
                            placeholder="Type"
                            value={newAuthority.type}
                            onChange={(event) => setNewAuthority((prev) => ({ ...prev, type: event.target.value }))}
                        />
                        <input
                            placeholder="Jurisdiction"
                            value={newAuthority.jurisdiction}
                            onChange={(event) => setNewAuthority((prev) => ({ ...prev, jurisdiction: event.target.value }))}
                        />
                        <button onClick={createAuthority}>Add authority</button>
                    </div>

                    {authorities.length === 0 ? (
                        <p className={styles.emptyState}>No authorities yet.</p>
                    ) : (
                        <ul className={styles.list}>
                            {authorities.map((item) => (
                                <li key={item.id}>
                                    <strong>{item.name}</strong>
                                    <span className={styles.itemMeta}>
                                        {item.type}
                                        {item.jurisdiction ? ` / ${item.jurisdiction}` : ""}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
        </DashboardShell>
    );
}
