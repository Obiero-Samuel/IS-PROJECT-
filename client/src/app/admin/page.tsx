/**
 * Admin dashboard for users, reports, mappings, and exports.
 */
"use client";

import { useMemo, useState } from "react";
import { DashboardShell } from "@/components/dashboard-shell";
import RequireAuth from "@/components/RequireAuth";
import {
    API_BASE_URL,
    apiRequest,
    deleteCategoryAuthorityMapping,
    downloadAdminWeeklyExport,
    getAdminReports,
    getAdminUsers,
    getAdminWeeklyExports,
    getCategoryAuthorityMappings,
    generateAdminWeeklyExport,
    overrideCloseAdminReport,
    reassignAdminReport,
    saveCategoryAuthorityDeadline,
    updateAdminUserLifecycle,
} from "@/lib/api";
import type {
    AdminReportItem,
    AdminUserRow,
    AdminWeeklyExportItem,
    CategoryAuthorityDeadlineMapping,
    WeeklyExportFormat,
} from "@/lib/types";
import styles from "./page.module.css";

// Alias keeps admin user table type concise in component logic.
type UserRow = AdminUserRow;

// Local shape for ward rows returned by admin wards endpoint.
type WardRow = {
    id: number;
    name: string;
    county: string;
    constituency: string | null;
};

// Local shape for category rows returned by admin categories endpoint.
type CategoryRow = {
    id: number;
    name: string;
    description: string | null;
};

// Local shape for authority rows returned by admin authorities endpoint.
type AuthorityRow = {
    id: number;
    name: string;
    type: string;
    jurisdiction: string | null;
};

// Filter form state for reports management table.
type ReportsFilterState = {
    status: string;
    ward_id: string;
    category_id: string;
    authority_id: string;
    from_date: string;
    to_date: string;
    search: string;
};

// Per-report draft state for reassignment form controls.
type ReassignDraft = {
    authority_id: string;
    category_id: string;
    note: string;
};

export default function AdminPage() {
    // Global status feedback.
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    // Keep datasets isolated so one failure doesn't break all admin tools.
    const [users, setUsers] = useState<UserRow[]>([]);
    const [wards, setWards] = useState<WardRow[]>([]);
    const [categories, setCategories] = useState<CategoryRow[]>([]);
    const [authorities, setAuthorities] = useState<AuthorityRow[]>([]);
    const [categoryAuthorityMappings, setCategoryAuthorityMappings] = useState<CategoryAuthorityDeadlineMapping[]>([]);
    const [weeklyExports, setWeeklyExports] = useState<AdminWeeklyExportItem[]>([]);
    const [reports, setReports] = useState<AdminReportItem[]>([]);
    const [reportsLoading, setReportsLoading] = useState(false);
    const [mappingsLoading, setMappingsLoading] = useState(false);
    const [weeklyExportsLoading, setWeeklyExportsLoading] = useState(false);
    const [reportsPage, setReportsPage] = useState(1);
    const [reportsLimit] = useState(20);
    const [reportsPagination, setReportsPagination] = useState({ page: 1, limit: 20, total: 0, totalPages: 1 });

    // Controlled state for reports filter controls.
    const [reportsFilters, setReportsFilters] = useState<ReportsFilterState>({
        status: "",
        ward_id: "",
        category_id: "",
        authority_id: "",
        from_date: "",
        to_date: "",
        search: "",
    });

    // Per-row draft values for admin actions.
    const [reassignDrafts, setReassignDrafts] = useState<Record<number, ReassignDraft>>({});
    const [overrideNotes, setOverrideNotes] = useState<Record<number, string>>({});
    const [deactivationReasons, setDeactivationReasons] = useState<Record<number, string>>({});
    const [mappingDeadlineDrafts, setMappingDeadlineDrafts] = useState<Record<string, string>>({});

    // Controlled values for "create" forms.
    const [newCategory, setNewCategory] = useState({ name: "", description: "" });
    const [newWard, setNewWard] = useState({ name: "", county: "", constituency: "" });
    const [newAuthority, setNewAuthority] = useState({ name: "", type: "", jurisdiction: "" });
    const [newMapping, setNewMapping] = useState({
        category_id: "",
        authority_id: "",
        response_deadline_days: "7",
    });
    const [newWeeklyExport, setNewWeeklyExport] = useState<{
        authority_id: string;
        ward_id: string;
        format: WeeklyExportFormat;
        period_start: string;
        period_end: string;
    }>({
        authority_id: "",
        ward_id: "",
        format: "csv",
        period_start: "",
        period_end: "",
    });

    const totals = useMemo(
        () => ({
            // Header KPI counters.
            users: users.length,
            admins: users.filter((user) => user.role === "admin").length,
            officers: users.filter((user) => user.role === "authority").length,
            inactiveUsers: users.filter((user) => user.is_active === false).length,
            wards: wards.length,
            categories: categories.length,
            authorities: authorities.length,
        }),
        [users, wards.length, categories.length, authorities.length],
    );

    const reportsSummary = useMemo(
        () => ({
            // Report KPIs from current filtered payload.
            total: reportsPagination.total,
            open: reports.filter((report) => report.status !== "resolved").length,
            overdue: reports.filter((report) => report.overdue_escalation_count > 0).length,
            adminClosed: reports.filter((report) => report.closed_by_admin).length,
        }),
        [reports, reportsPagination.total],
    );

    // Color message pill based on success/error text content.
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

    const loadReports = async (page = reportsPage) => {
        setReportsLoading(true);
        try {
            // Convert form-string filters to typed query params.
            const data = await getAdminReports({
                page,
                limit: reportsLimit,
                status: reportsFilters.status || undefined,
                ward_id: reportsFilters.ward_id ? Number(reportsFilters.ward_id) : undefined,
                category_id: reportsFilters.category_id ? Number(reportsFilters.category_id) : undefined,
                authority_id: reportsFilters.authority_id ? Number(reportsFilters.authority_id) : undefined,
                from_date: reportsFilters.from_date || undefined,
                to_date: reportsFilters.to_date || undefined,
                search: reportsFilters.search || undefined,
            });

            setReports(data.reports);
            setReportsPagination(data.pagination);
            setReportsPage(data.pagination.page);
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to load reports management data.";
            setMessage(msg);
        } finally {
            setReportsLoading(false);
        }
    };

    const refreshCategoryAuthorityMappings = async () => {
        setMappingsLoading(true);
        try {
            const response = await getCategoryAuthorityMappings();
            setCategoryAuthorityMappings(response.mappings);
            setMessage("Category-authority deadlines refreshed.");
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to refresh category-authority mappings.";
            setMessage(msg);
        } finally {
            setMappingsLoading(false);
        }
    };

    const refreshWeeklyExports = async () => {
        setWeeklyExportsLoading(true);
        try {
            const response = await getAdminWeeklyExports({ limit: 50 });
            setWeeklyExports(response.exports);
            setMessage("Weekly exports refreshed.");
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to refresh weekly exports.";
            setMessage(msg);
        } finally {
            setWeeklyExportsLoading(false);
        }
    };

    const loadAll = async () => {
        setLoading(true);
        setMessage("Loading admin data...");

        try {
            // Prime core admin datasets in parallel.
            const [usersRes, wardsRes, categoriesRes, authoritiesRes, mappingsRes, weeklyExportsRes] = await Promise.all([
                getAdminUsers(),
                apiRequest<{ wards: WardRow[] }>("/admin/wards"),
                apiRequest<{ categories: CategoryRow[] }>("/admin/categories"),
                apiRequest<{ authorities: AuthorityRow[] }>("/admin/authorities"),
                getCategoryAuthorityMappings(),
                getAdminWeeklyExports({ limit: 50 }),
            ]);

            setUsers(usersRes.users);
            setWards(wardsRes.wards);
            setCategories(categoriesRes.categories);
            setAuthorities(authoritiesRes.authorities);
            setCategoryAuthorityMappings(mappingsRes.mappings);
            setWeeklyExports(weeklyExportsRes.exports);
            await loadReports(1);
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
                body: { role },
            });
            // Reload all datasets so role-related tables and stats stay in sync.
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
                body: {
                    name: newCategory.name,
                    description: newCategory.description,
                },
            });
            // Clear form after successful create.
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
                body: {
                    name: newWard.name,
                    county: newWard.county,
                    constituency: newWard.constituency,
                },
            });
            // Clear form after successful create.
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
                body: {
                    name: newAuthority.name,
                    type: newAuthority.type,
                    jurisdiction: newAuthority.jurisdiction,
                },
            });
            // Clear form after successful create.
            setNewAuthority({ name: "", type: "", jurisdiction: "" });
            setMessage("Authority created.");
            await loadAll();
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Create authority failed.";
            setMessage(msg);
        }
    };

    const updateUserActiveState = async (user: UserRow, nextIsActive: boolean) => {
        const reason = String(deactivationReasons[user.id] || "").trim();

        // Deactivation requires an explicit reason.
        if (!nextIsActive && !reason) {
            setMessage("Deactivation reason is required before disabling an account.");
            return;
        }

        try {
            await updateAdminUserLifecycle(user.id, {
                is_active: nextIsActive,
                deactivation_reason: nextIsActive ? undefined : reason,
            });

            setDeactivationReasons((prev) => ({
                ...prev,
                [user.id]: "",
            }));

            // Message text reflects target lifecycle action.
            setMessage(
                nextIsActive
                    ? `Reactivated ${user.username}.`
                    : `Deactivated ${user.username}.`
            );
            await loadAll();
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to update user lifecycle.";
            setMessage(msg);
        }
    };

    const saveNewCategoryAuthorityMapping = async () => {
        const category_id = Number(newMapping.category_id);
        const authority_id = Number(newMapping.authority_id);
        const response_deadline_days = Number(newMapping.response_deadline_days);

        // Validate IDs before API call.
        if (!Number.isInteger(category_id) || category_id <= 0) {
            setMessage("Select a valid category before saving deadline mapping.");
            return;
        }

        if (!Number.isInteger(authority_id) || authority_id <= 0) {
            setMessage("Select a valid authority before saving deadline mapping.");
            return;
        }

        if (!Number.isInteger(response_deadline_days) || response_deadline_days <= 0) {
            setMessage("Deadline days must be a positive integer.");
            return;
        }

        try {
            await saveCategoryAuthorityDeadline({
                category_id,
                authority_id,
                response_deadline_days,
            });
            setNewMapping({ category_id: "", authority_id: "", response_deadline_days: "7" });
            setMessage("Category-authority deadline saved.");
            await loadAll();
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to save category-authority deadline.";
            setMessage(msg);
        }
    };

    const saveExistingMappingDeadline = async (mapping: CategoryAuthorityDeadlineMapping) => {
        const key = `${mapping.category_id}-${mapping.authority_id}`;
        const response_deadline_days = Number(
            mappingDeadlineDrafts[key] ?? String(mapping.response_deadline_days)
        );

        if (!Number.isInteger(response_deadline_days) || response_deadline_days <= 0) {
            setMessage("Deadline days must be a positive integer.");
            return;
        }

        try {
            await saveCategoryAuthorityDeadline({
                category_id: mapping.category_id,
                authority_id: mapping.authority_id,
                response_deadline_days,
            });
            // Refresh list so displayed deadline matches saved value.
            setMessage(`Updated deadline for ${mapping.category_name} → ${mapping.authority_name}.`);
            await loadAll();
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to update mapping deadline.";
            setMessage(msg);
        }
    };

    const removeMapping = async (mapping: CategoryAuthorityDeadlineMapping) => {
        try {
            await deleteCategoryAuthorityMapping({
                category_id: mapping.category_id,
                authority_id: mapping.authority_id,
            });
            // Reload list to remove deleted row from UI.
            setMessage(`Removed mapping ${mapping.category_name} → ${mapping.authority_name}.`);
            await loadAll();
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to remove category-authority mapping.";
            setMessage(msg);
        }
    };

    const generateWeeklyExportFile = async () => {
        const authority_id = Number(newWeeklyExport.authority_id);
        const ward_id = newWeeklyExport.ward_id ? Number(newWeeklyExport.ward_id) : undefined;

        // Exports are authority-scoped.
        if (!Number.isInteger(authority_id) || authority_id <= 0) {
            setMessage("Select an authority before generating weekly exports.");
            return;
        }

        if (newWeeklyExport.ward_id && (!Number.isInteger(ward_id) || Number(ward_id) <= 0)) {
            setMessage("Ward selection is invalid.");
            return;
        }

        try {
            await generateAdminWeeklyExport({
                authority_id,
                ward_id,
                format: newWeeklyExport.format,
                period_start: newWeeklyExport.period_start || undefined,
                period_end: newWeeklyExport.period_end || undefined,
            });

            // Reload history table so newly created export appears immediately.
            setMessage(`Weekly ${newWeeklyExport.format.toUpperCase()} export generated.`);
            await loadAll();
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to generate weekly export.";
            setMessage(msg);
        }
    };

    const downloadWeeklyExportFile = async (item: AdminWeeklyExportItem) => {
        try {
            // Download via object URL to avoid page navigation.
            const { blob, filename } = await downloadAdminWeeklyExport(item.id);
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = objectUrl;
            anchor.download = filename || `weekly-export-${item.id}.${item.report_file_type || "csv"}`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            // Free memory used by temporary object URL.
            URL.revokeObjectURL(objectUrl);
            setMessage(`Downloaded export #${item.id}.`);
        } catch (error) {
            // Fallback: direct browser download navigation if blob-based flow fails.
            const directUrl = `${API_BASE_URL}/admin/weekly-exports/${item.id}/download`;
            window.location.assign(directUrl);
            const msg = error instanceof Error
                ? `${error.message} Retrying with direct download...`
                : "Retrying with direct download...";
            setMessage(msg);
        }
    };

    const applyReportsFilters = async () => {
        // Filters always restart at first page for predictable results.
        setReportsPage(1);
        await loadReports(1);
    };

    const handleReassign = async (report: AdminReportItem) => {
        const draft = reassignDrafts[report.id];
        const authority_id = Number(draft?.authority_id);
        const category_id = draft?.category_id ? Number(draft.category_id) : undefined;
        const note = String(draft?.note || "").trim();

        if (!Number.isInteger(authority_id) || authority_id <= 0) {
            setMessage("Select a target authority before reassigning.");
            return;
        }

        // Reassignment requires a note.
        if (!note) {
            setMessage("Reassign note is required.");
            return;
        }

        try {
            await reassignAdminReport(report.id, {
                authority_id,
                category_id,
                note,
            });
            // Reload current page to reflect new assignment values.
            setMessage(`Report ${report.tracking_number} reassigned.`);
            await loadReports(reportsPage);
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to reassign report.";
            setMessage(msg);
        }
    };

    const handleOverrideClose = async (report: AdminReportItem) => {
        const note = String(overrideNotes[report.id] || "").trim();

        // Override close requires justification.
        if (!note) {
            setMessage("Override close note is required.");
            return;
        }

        try {
            await overrideCloseAdminReport(report.id, { note });
            // Reload current page to reflect closed status and metadata.
            setMessage(`Report ${report.tracking_number} override-closed.`);
            await loadReports(reportsPage);
        } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to override-close report.";
            setMessage(msg);
        }
    };

    return (
        <RequireAuth allowedRoles={["admin"]}>
            {/* Dashboard shell provides shared page frame and navigation. */}
            <DashboardShell
                title="Admin Panel"
                subtitle="Manage users, categories, wards, and authorities from one command surface."
                showEyebrow={false}
            >
                {/* Top toolbar: reload everything + show latest operation message. */}
                <div className={styles.topBar}>
                    <button className={styles.refreshButton} onClick={loadAll} disabled={loading}>
                        {loading ? "Refreshing..." : "Refresh all datasets"}
                    </button>
                    <p className={`${styles.feedback} ${messageClass}`}>
                        {message || "Use refresh to load admin datasets."}
                    </p>
                </div>

                {/* High-level metrics give quick system snapshot. */}
                <section className={styles.statsGrid}>
                    <article className={styles.statCard}>
                        <p className={styles.statLabel}>Users</p>
                        <p className={styles.statValue}>{totals.users}</p>
                        <p className={styles.itemMeta}>
                            {totals.admins} admin · {totals.officers} officers · {totals.inactiveUsers} inactive
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

                    <article className={styles.statCard}>
                        <p className={styles.statLabel}>Reports (filtered)</p>
                        <p className={styles.statValue}>{reportsSummary.total}</p>
                        <p className={styles.itemMeta}>{reportsSummary.open} open · {reportsSummary.overdue} overdue</p>
                    </article>

                    <article className={styles.statCard}>
                        <p className={styles.statLabel}>Admin closed (filtered)</p>
                        <p className={styles.statValue}>{reportsSummary.adminClosed}</p>
                        <p className={styles.itemMeta}>Override close actions</p>
                    </article>
                </section>

                {/* Reports management includes filters, pagination, and intervention actions. */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2>Reports management</h2>
                        <span className={styles.countBadge}>{reportsPagination.total}</span>
                    </div>

                    <div className={styles.formGridThree}>
                        <input
                            placeholder="Search tracking/title"
                            aria-label="Search reports by tracking number or title"
                            title="Search reports by tracking number or title"
                            value={reportsFilters.search}
                            onChange={(event) =>
                                setReportsFilters((prev) => ({ ...prev, search: event.target.value }))
                            }
                        />

                        <select
                            aria-label="Filter reports by status"
                            title="Filter reports by status"
                            value={reportsFilters.status}
                            onChange={(event) =>
                                setReportsFilters((prev) => ({ ...prev, status: event.target.value }))
                            }
                        >
                            <option value="">All statuses</option>
                            <option value="pending">pending</option>
                            <option value="in-progress">in-progress</option>
                            <option value="resolved">resolved</option>
                        </select>

                        <select
                            aria-label="Filter reports by ward"
                            title="Filter reports by ward"
                            value={reportsFilters.ward_id}
                            onChange={(event) =>
                                setReportsFilters((prev) => ({ ...prev, ward_id: event.target.value }))
                            }
                        >
                            <option value="">All wards</option>
                            {wards.map((ward) => (
                                <option key={ward.id} value={ward.id}>
                                    {ward.name}
                                </option>
                            ))}
                        </select>

                        <select
                            aria-label="Filter reports by category"
                            title="Filter reports by category"
                            value={reportsFilters.category_id}
                            onChange={(event) =>
                                setReportsFilters((prev) => ({ ...prev, category_id: event.target.value }))
                            }
                        >
                            <option value="">All categories</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>

                        <select
                            aria-label="Filter reports by authority"
                            title="Filter reports by authority"
                            value={reportsFilters.authority_id}
                            onChange={(event) =>
                                setReportsFilters((prev) => ({ ...prev, authority_id: event.target.value }))
                            }
                        >
                            <option value="">All authorities</option>
                            {authorities.map((authority) => (
                                <option key={authority.id} value={authority.id}>
                                    {authority.name}
                                </option>
                            ))}
                        </select>

                        <div className={styles.formGridTwo}>
                            <input
                                type="date"
                                aria-label="Filter reports from date"
                                title="Filter reports from date"
                                value={reportsFilters.from_date}
                                onChange={(event) =>
                                    setReportsFilters((prev) => ({ ...prev, from_date: event.target.value }))
                                }
                            />
                            <input
                                type="date"
                                aria-label="Filter reports to date"
                                title="Filter reports to date"
                                value={reportsFilters.to_date}
                                onChange={(event) =>
                                    setReportsFilters((prev) => ({ ...prev, to_date: event.target.value }))
                                }
                            />
                        </div>
                    </div>

                    <div className={styles.topBar}>
                        <button className={styles.refreshButton} onClick={applyReportsFilters} disabled={reportsLoading}>
                            {reportsLoading ? "Loading reports..." : "Apply report filters"}
                        </button>
                        <p className={styles.feedback}>
                            Page {reportsPagination.page} of {reportsPagination.totalPages}
                        </p>
                    </div>

                    <div className={styles.tableWrap}>
                        <table className={styles.dataTable}>
                            <thead>
                                <tr>
                                    <th>Tracking</th>
                                    <th>Title</th>
                                    <th>Status</th>
                                    <th>Category / Ward</th>
                                    <th>Authority</th>
                                    <th>Created</th>
                                    <th>Overdue esc.</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {reports.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className={styles.tableEmpty}>
                                            No reports match current filters.
                                        </td>
                                    </tr>
                                ) : (
                                    reports.map((report) => {
                                        const draft = reassignDrafts[report.id] || {
                                            authority_id: report.authority_id ? String(report.authority_id) : "",
                                            category_id: report.category_id ? String(report.category_id) : "",
                                            note: "",
                                        };

                                        return (
                                            <tr key={report.id}>
                                                <td>{report.tracking_number}</td>
                                                <td>
                                                    <strong>{report.title}</strong>
                                                    {report.closed_by_admin ? (
                                                        <div className={styles.itemMeta}>Closed by admin</div>
                                                    ) : null}
                                                </td>
                                                <td>
                                                    <span className={`${styles.roleBadge} ${report.status === "resolved"
                                                        ? styles.roleAuthority
                                                        : report.status === "in-progress"
                                                            ? styles.roleResident
                                                            : styles.roleAdmin
                                                        }`}>
                                                        {report.status}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div>{report.category_name || "Uncategorized"}</div>
                                                    <div className={styles.itemMeta}>{report.ward_name || "No ward"}</div>
                                                </td>
                                                <td>{report.authority_name || "Unassigned"}</td>
                                                <td>{new Date(report.created_at).toLocaleDateString()}</td>
                                                <td>{report.overdue_escalation_count}</td>
                                                <td>
                                                    <div className={styles.formGridThree}>
                                                        <select
                                                            aria-label={`Select target authority for report ${report.tracking_number}`}
                                                            title={`Select target authority for report ${report.tracking_number}`}
                                                            value={draft.authority_id}
                                                            onChange={(event) =>
                                                                setReassignDrafts((prev) => ({
                                                                    ...prev,
                                                                    [report.id]: { ...draft, authority_id: event.target.value },
                                                                }))
                                                            }
                                                        >
                                                            <option value="">Target authority</option>
                                                            {authorities.map((authority) => (
                                                                <option key={authority.id} value={authority.id}>
                                                                    {authority.name}
                                                                </option>
                                                            ))}
                                                        </select>

                                                        <select
                                                            aria-label={`Select category override for report ${report.tracking_number}`}
                                                            title={`Select category override for report ${report.tracking_number}`}
                                                            value={draft.category_id}
                                                            onChange={(event) =>
                                                                setReassignDrafts((prev) => ({
                                                                    ...prev,
                                                                    [report.id]: { ...draft, category_id: event.target.value },
                                                                }))
                                                            }
                                                        >
                                                            <option value="">Keep category</option>
                                                            {categories.map((category) => (
                                                                <option key={category.id} value={category.id}>
                                                                    {category.name}
                                                                </option>
                                                            ))}
                                                        </select>

                                                        <input
                                                            placeholder="Reassign note"
                                                            value={draft.note}
                                                            onChange={(event) =>
                                                                setReassignDrafts((prev) => ({
                                                                    ...prev,
                                                                    [report.id]: { ...draft, note: event.target.value },
                                                                }))
                                                            }
                                                        />

                                                        <button
                                                            type="button"
                                                            className={styles.addButton}
                                                            onClick={() => handleReassign(report)}
                                                        >
                                                            Reassign
                                                        </button>

                                                        <input
                                                            placeholder="Override close note"
                                                            value={overrideNotes[report.id] || ""}
                                                            onChange={(event) =>
                                                                setOverrideNotes((prev) => ({
                                                                    ...prev,
                                                                    [report.id]: event.target.value,
                                                                }))
                                                            }
                                                        />

                                                        <button
                                                            type="button"
                                                            className={styles.addButton}
                                                            onClick={() => handleOverrideClose(report)}
                                                        >
                                                            Override close
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className={styles.topBar}>
                        <button
                            className={styles.refreshButton}
                            onClick={() => loadReports(Math.max(1, reportsPage - 1))}
                            disabled={reportsLoading || reportsPage <= 1}
                        >
                            Previous
                        </button>
                        <button
                            className={styles.refreshButton}
                            onClick={() => loadReports(Math.min(reportsPagination.totalPages, reportsPage + 1))}
                            disabled={reportsLoading || reportsPage >= reportsPagination.totalPages}
                        >
                            Next
                        </button>
                    </div>
                </section>

                {/* User table supports role updates and activate/deactivate lifecycle actions. */}
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
                                    <th>Authority</th>
                                    <th>Current role</th>
                                    <th>Role update</th>
                                    <th>Account status</th>
                                    <th>Lifecycle action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className={styles.tableEmpty}>
                                            No users loaded. Click &quot;Refresh all datasets&quot;.
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((user) => (
                                        <tr key={user.id}>
                                            <td>{user.id}</td>
                                            <td>{user.username}</td>
                                            <td>{user.email}</td>
                                            <td>{user.authority_id ?? "—"}</td>
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

                                            <td>
                                                <span
                                                    className={`${styles.statusBadge} ${user.is_active ? styles.statusActive : styles.statusInactive
                                                        }`}
                                                >
                                                    {user.is_active ? "active" : "inactive"}
                                                </span>
                                                {!user.is_active && user.deactivation_reason ? (
                                                    <div className={styles.itemMeta}>{user.deactivation_reason}</div>
                                                ) : null}
                                            </td>

                                            <td>
                                                <div className={styles.actionRow}>
                                                    {user.is_active ? (
                                                        <>
                                                            <input
                                                                className={styles.input}
                                                                placeholder="Deactivation reason"
                                                                aria-label={`Deactivation reason for ${user.username}`}
                                                                title={`Deactivation reason for ${user.username}`}
                                                                value={deactivationReasons[user.id] || ""}
                                                                onChange={(event) =>
                                                                    setDeactivationReasons((prev) => ({
                                                                        ...prev,
                                                                        [user.id]: event.target.value,
                                                                    }))
                                                                }
                                                            />

                                                            <button
                                                                type="button"
                                                                className={styles.dangerButton}
                                                                onClick={() => updateUserActiveState(user, false)}
                                                            >
                                                                Deactivate
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className={styles.addButton}
                                                            onClick={() => updateUserActiveState(user, true)}
                                                        >
                                                            Reactivate
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Category-authority SLA section manages escalation deadline mappings. */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2>Category-authority deadlines</h2>
                        <span className={styles.countBadge}>{categoryAuthorityMappings.length}</span>
                    </div>

                    <div className={styles.formGridThree}>
                        <select
                            aria-label="Select category for deadline mapping"
                            title="Select category for deadline mapping"
                            value={newMapping.category_id}
                            onChange={(event) =>
                                setNewMapping((prev) => ({ ...prev, category_id: event.target.value }))
                            }
                        >
                            <option value="">Select category</option>
                            {categories.map((category) => (
                                <option key={category.id} value={category.id}>
                                    {category.name}
                                </option>
                            ))}
                        </select>

                        <select
                            aria-label="Select authority for deadline mapping"
                            title="Select authority for deadline mapping"
                            value={newMapping.authority_id}
                            onChange={(event) =>
                                setNewMapping((prev) => ({ ...prev, authority_id: event.target.value }))
                            }
                        >
                            <option value="">Select authority</option>
                            {authorities.map((authority) => (
                                <option key={authority.id} value={authority.id}>
                                    {authority.name}
                                </option>
                            ))}
                        </select>

                        <input
                            type="number"
                            min={1}
                            max={365}
                            className={styles.input}
                            aria-label="Response deadline days"
                            title="Response deadline days"
                            placeholder="Deadline days"
                            value={newMapping.response_deadline_days}
                            onChange={(event) =>
                                setNewMapping((prev) => ({ ...prev, response_deadline_days: event.target.value }))
                            }
                        />
                    </div>

                    <div className={styles.topBar}>
                        <button
                            type="button"
                            className={styles.addButton}
                            onClick={saveNewCategoryAuthorityMapping}
                        >
                            Save deadline mapping
                        </button>
                        <button
                            type="button"
                            className={styles.refreshButton}
                            onClick={refreshCategoryAuthorityMappings}
                            disabled={mappingsLoading}
                        >
                            {mappingsLoading ? "Refreshing..." : "Refresh mappings"}
                        </button>
                    </div>

                    <div className={styles.tableWrap}>
                        <table className={styles.dataTable}>
                            <thead>
                                <tr>
                                    <th>Category</th>
                                    <th>Authority</th>
                                    <th>Deadline (days)</th>
                                    <th>Authority status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categoryAuthorityMappings.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className={styles.tableEmpty}>
                                            No category-authority mappings found.
                                        </td>
                                    </tr>
                                ) : (
                                    categoryAuthorityMappings.map((mapping) => {
                                        const key = `${mapping.category_id}-${mapping.authority_id}`;
                                        const draftValue =
                                            mappingDeadlineDrafts[key] ?? String(mapping.response_deadline_days);

                                        return (
                                            <tr key={key}>
                                                <td>{mapping.category_name}</td>
                                                <td>{mapping.authority_name}</td>
                                                <td>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={365}
                                                        className={styles.input}
                                                        aria-label={`Deadline days for ${mapping.category_name} to ${mapping.authority_name}`}
                                                        title={`Deadline days for ${mapping.category_name} to ${mapping.authority_name}`}
                                                        value={draftValue}
                                                        onChange={(event) =>
                                                            setMappingDeadlineDrafts((prev) => ({
                                                                ...prev,
                                                                [key]: event.target.value,
                                                            }))
                                                        }
                                                    />
                                                </td>
                                                <td>
                                                    <span
                                                        className={`${styles.statusBadge} ${mapping.authority_is_active
                                                            ? styles.statusActive
                                                            : styles.statusInactive
                                                            }`}
                                                    >
                                                        {mapping.authority_is_active ? "active" : "inactive"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className={styles.actionRow}>
                                                        <button
                                                            type="button"
                                                            className={styles.addButton}
                                                            onClick={() => saveExistingMappingDeadline(mapping)}
                                                        >
                                                            Update
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className={styles.dangerButton}
                                                            onClick={() => removeMapping(mapping)}
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Weekly export generation + download history. */}
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2>Weekly report exports</h2>
                        <span className={styles.countBadge}>{weeklyExports.length}</span>
                    </div>

                    <div className={styles.formGridThree}>
                        <select
                            aria-label="Select authority for weekly export"
                            title="Select authority for weekly export"
                            value={newWeeklyExport.authority_id}
                            onChange={(event) =>
                                setNewWeeklyExport((prev) => ({ ...prev, authority_id: event.target.value }))
                            }
                        >
                            <option value="">Select authority</option>
                            {authorities.map((authority) => (
                                <option key={authority.id} value={authority.id}>
                                    {authority.name}
                                </option>
                            ))}
                        </select>

                        <select
                            aria-label="Optional ward filter for weekly export"
                            title="Optional ward filter for weekly export"
                            value={newWeeklyExport.ward_id}
                            onChange={(event) =>
                                setNewWeeklyExport((prev) => ({ ...prev, ward_id: event.target.value }))
                            }
                        >
                            <option value="">All wards</option>
                            {wards.map((ward) => (
                                <option key={ward.id} value={ward.id}>
                                    {ward.name}
                                </option>
                            ))}
                        </select>

                        <select
                            aria-label="Export format"
                            title="Export format"
                            value={newWeeklyExport.format}
                            onChange={(event) =>
                                setNewWeeklyExport((prev) => ({
                                    ...prev,
                                    format: event.target.value as WeeklyExportFormat,
                                }))
                            }
                        >
                            <option value="csv">CSV</option>
                            <option value="pdf">PDF</option>
                        </select>
                    </div>

                    <div className={styles.formGridTwo}>
                        <input
                            type="date"
                            className={styles.input}
                            aria-label="Weekly export period start"
                            title="Weekly export period start"
                            value={newWeeklyExport.period_start}
                            onChange={(event) =>
                                setNewWeeklyExport((prev) => ({ ...prev, period_start: event.target.value }))
                            }
                        />
                        <input
                            type="date"
                            className={styles.input}
                            aria-label="Weekly export period end"
                            title="Weekly export period end"
                            value={newWeeklyExport.period_end}
                            onChange={(event) =>
                                setNewWeeklyExport((prev) => ({ ...prev, period_end: event.target.value }))
                            }
                        />
                    </div>

                    <div className={styles.topBar}>
                        <button
                            type="button"
                            className={styles.addButton}
                            onClick={generateWeeklyExportFile}
                        >
                            Generate export
                        </button>
                        <button
                            type="button"
                            className={styles.refreshButton}
                            onClick={refreshWeeklyExports}
                            disabled={weeklyExportsLoading}
                        >
                            {weeklyExportsLoading ? "Refreshing..." : "Refresh exports"}
                        </button>
                        <p className={styles.feedback}>Leave dates blank to use the latest rolling 7-day window.</p>
                    </div>

                    <div className={styles.tableWrap}>
                        <table className={styles.dataTable}>
                            <thead>
                                <tr>
                                    <th>Generated</th>
                                    <th>Authority / Ward</th>
                                    <th>Period</th>
                                    <th>Totals</th>
                                    <th>Format</th>
                                    <th>Download</th>
                                </tr>
                            </thead>
                            <tbody>
                                {weeklyExports.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className={styles.tableEmpty}>
                                            No weekly exports generated yet.
                                        </td>
                                    </tr>
                                ) : (
                                    weeklyExports.map((item) => (
                                        <tr key={item.id}>
                                            <td>{new Date(item.generated_at).toLocaleString()}</td>
                                            <td>
                                                <div>{item.authority_name}</div>
                                                <div className={styles.itemMeta}>{item.ward_name || "All wards"}</div>
                                            </td>
                                            <td>
                                                {item.period_start} → {item.period_end}
                                            </td>
                                            <td>
                                                {item.total_issues} total · {item.open_issues} open · {item.pending_issues} pending
                                            </td>
                                            <td>{String(item.report_file_type || "csv").toUpperCase()}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className={styles.addButton}
                                                    onClick={() => downloadWeeklyExportFile(item)}
                                                >
                                                    Download
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                {/* Create/edit reference data blocks for categories, wards, and authorities. */}
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
        </RequireAuth>
    );
}
