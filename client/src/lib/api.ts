/**
 * Typed API helpers for frontend requests.
 */
import type {
    AdminUserLifecycleResponse,
    AdminUsersResponse,
    AdminWeeklyExportGenerateResponse,
    AdminWeeklyExportsResponse,
    CategoryAuthorityDeadlineDeleteResponse,
    CategoryAuthorityDeadlineListResponse,
    CategoryAuthorityDeadlineSaveResponse,
    AdminOverrideCloseResponse,
    AdminReportReassignResponse,
    AdminReportsResponse,
    AuthPayload,
    Category,
    DeleteMyReportResponse,
    OfficerEscalationsResponse,
    OfficerQueueResponse,
    ReportLifecycleStatus,
    ProfileResponse,
    RegisterResponse,
    ReportsResponse,
    ResendOtpResponse,
    UpdateProfileResponse,
    VerificationResponse,
    Ward
} from "./types";

// Base backend URL used by all frontend API calls.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api";

type RequestConfig = RequestInit & {
    token?: string | null;
};

export type ApiRequestOptions = {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    token?: string;
    body?: Record<string, unknown>;
};

const toErrorMessage = (payload: unknown, fallback: string) => {
    // Normalize backend error payloads.
    if (typeof payload === "object" && payload !== null) {
        const record = payload as { error?: { message?: string }; message?: string };
        return record.error?.message ?? record.message ?? fallback;
    }
    return fallback;
};

const request = async <T>(path: string, config: RequestConfig = {}): Promise<T> => {
    const headers = new Headers(config.headers);

    // Let browser set multipart boundary for FormData.
    if (!(config.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }

    // Optional legacy Bearer support (cookie session is primary).
    if (config.token) {
        headers.set("Authorization", `Bearer ${config.token}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...config,
        headers,
        credentials: "include",
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(toErrorMessage(payload, `Request failed with status ${response.status}`));
    }

    return payload as T;
};

const extractFilenameFromContentDisposition = (value: string | null): string => {
    if (!value) return "download";

    const utf8Match = value.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        try {
            return decodeURIComponent(utf8Match[1]).replace(/[/\\?%*:|"<>]/g, "_");
        } catch {
            return utf8Match[1].replace(/[/\\?%*:|"<>]/g, "_");
        }
    }

    const plainMatch = value.match(/filename="?([^";]+)"?/i);
    if (plainMatch?.[1]) {
        return plainMatch[1].replace(/[/\\?%*:|"<>]/g, "_");
    }

    return "download";
};

const requestBinary = async (path: string, config: RequestConfig = {}) => {
    const headers = new Headers(config.headers);

    if (config.token) {
        headers.set("Authorization", `Bearer ${config.token}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...config,
        headers,
        credentials: "include",
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(toErrorMessage(payload, `Request failed with status ${response.status}`));
    }

    const blob = await response.blob();
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const filename = extractFilenameFromContentDisposition(response.headers.get("content-disposition"));

    return { blob, filename, contentType };
};

// Generic wrapper for endpoints not covered by dedicated helpers.
export async function apiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const { method = "GET", token, body } = options;
    return request<T>(endpoint, {
        method,
        token,
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
}

// -----------------------------
// Admin helpers: users, mappings, and weekly exports.
// -----------------------------
export const getAdminUsers = () =>
    request<AdminUsersResponse>("/admin/users");

export const updateAdminUserLifecycle = (
    userId: number,
    payload: { is_active: boolean; deactivation_reason?: string }
) =>
    request<AdminUserLifecycleResponse>(`/admin/users/${userId}/lifecycle`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });

export const getCategoryAuthorityMappings = () =>
    request<CategoryAuthorityDeadlineListResponse>("/admin/category-authority-map");

export const saveCategoryAuthorityDeadline = (
    payload: { category_id: number; authority_id: number; response_deadline_days: number }
) =>
    request<CategoryAuthorityDeadlineSaveResponse>("/admin/category-authority-map", {
        method: "POST",
        body: JSON.stringify(payload),
    });

export const deleteCategoryAuthorityMapping = (
    payload: { category_id: number; authority_id: number }
) =>
    request<CategoryAuthorityDeadlineDeleteResponse>("/admin/category-authority-map", {
        method: "DELETE",
        body: JSON.stringify(payload),
    });

type AdminWeeklyExportsQuery = {
    authority_id?: number;
    format?: "csv" | "pdf";
    limit?: number;
};

export const getAdminWeeklyExports = (queryParams: AdminWeeklyExportsQuery = {}) => {
    const query = new URLSearchParams();

    if (typeof queryParams.authority_id === "number") query.set("authority_id", String(queryParams.authority_id));
    if (queryParams.format) query.set("format", queryParams.format);
    if (typeof queryParams.limit === "number") query.set("limit", String(queryParams.limit));

    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<AdminWeeklyExportsResponse>(`/admin/weekly-exports${suffix}`);
};

export const generateAdminWeeklyExport = (
    payload: {
        authority_id: number;
        ward_id?: number;
        format: "csv" | "pdf";
        period_start?: string;
        period_end?: string;
    }
) =>
    request<AdminWeeklyExportGenerateResponse>("/admin/weekly-exports", {
        method: "POST",
        body: JSON.stringify(payload),
    });

export const downloadAdminWeeklyExport = (exportId: number) =>
    requestBinary(`/admin/weekly-exports/${exportId}/download`, {
        method: "GET",
    });

export const logout = () =>
    request<{ message: string }>("/auth/logout", {
        method: "POST",
    });

type RegisterRoleContext = "resident" | "authority";

// Create new account and start email-verification flow.
export const register = (
    username: string,
    email: string,
    password: string,
    options?: { ward_id?: number; role_context?: RegisterRoleContext }
) => {
    const body: Record<string, unknown> = { username, email, password };

    if (typeof options?.ward_id === "number") {
        body.ward_id = options.ward_id;
    }

    if (options?.role_context) {
        body.role_context = options.role_context;
    }

    return request<RegisterResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
    });
};

type LoginRoleContext = "resident" | "authority" | "admin";

// Login with credentials and optional role/ward context checks.
export const login = (
    username: string,
    email: string,
    password: string,
    options?: { ward_id?: number; role_context?: LoginRoleContext }
) => {
    const body: Record<string, unknown> = { username, email, password };
    if (typeof options?.ward_id === "number") {
        body.ward_id = options.ward_id;
    }
    if (options?.role_context) {
        body.role_context = options.role_context;
    }

    return request<AuthPayload>("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
    });
};

// Verify one-time password and receive active session payload.
export const verifyEmailOtp = (email: string, otp: string) =>
    request<VerificationResponse>("/auth/verify-email-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp }),
    });

// Read current user's profile data.
export const getMyProfile = () =>
    request<ProfileResponse>("/auth/profile");

type UpdateMyProfilePayload = {
    full_name: string;
    email: string;
    phone_number?: string;
    date_of_birth?: string;
    residence?: string;
    bio?: string;
    photo?: File | null;
};

// Update profile fields (multipart payload allows optional image upload).
export const updateMyProfile = (payload: UpdateMyProfilePayload) => {
    const formData = new FormData();
    formData.set("full_name", payload.full_name);
    formData.set("email", payload.email);

    if (payload.phone_number !== undefined) formData.set("phone_number", payload.phone_number);
    if (payload.date_of_birth !== undefined) formData.set("date_of_birth", payload.date_of_birth);
    if (payload.residence !== undefined) formData.set("residence", payload.residence);
    if (payload.bio !== undefined) formData.set("bio", payload.bio);
    if (payload.photo) formData.set("photo", payload.photo);

    return request<UpdateProfileResponse>("/auth/profile", {
        method: "PATCH",
        body: formData,
    });
};

// Request new OTP code for pending email verification.
export const resendVerificationOtp = (email: string) =>
    request<ResendOtpResponse>("/auth/resend-verification-otp", {
        method: "POST",
        body: JSON.stringify({ email }),
    });

type WardFilters = {
    county?: string;
    constituency?: string | string[];
    focus?: string;
};

// Fetch ward options with optional geographic filtering.
export const getWards = async (filters: WardFilters = {}) => {
    const query = new URLSearchParams();

    if (filters.county) {
        query.set("county", filters.county);
    }

    if (filters.focus) {
        query.set("focus", filters.focus);
    }

    if (filters.constituency) {
        const constituencyValue = Array.isArray(filters.constituency)
            ? filters.constituency.join(",")
            : filters.constituency;

        if (constituencyValue.trim()) {
            query.set("constituency", constituencyValue);
        }
    }

    const suffix = query.toString() ? `?${query.toString()}` : "";
    const data = await request<{ wards: Ward[] }>(`/auth/wards${suffix}`);
    return data.wards;
};

// Fetch all report categories.
export const getCategories = async () => {
    const data = await request<{ categories: Category[] }>("/reports/categories");
    return data.categories;
};

// Load public/community report feed.
export const getPublicReports = (params?: { page?: number; limit?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);

    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<ReportsResponse>(`/reports${suffix}`);
};

// Load reports submitted by currently logged-in user.
export const getMyReports = () =>
    request<ReportsResponse>("/reports/mine");

// Resident-only: delete own report once.
export const deleteMyReport = (reportId: number) =>
    request<DeleteMyReportResponse>(`/reports/${reportId}`, {
        method: "DELETE",
    });

type OfficerQueueParams = {
    status?: string | string[];
    ward_id?: number;
    from_date?: string;
    to_date?: string;
};

const appendMultiValueParam = (query: URLSearchParams, key: string, value?: string | string[]) => {
    if (!value) return;

    if (Array.isArray(value)) {
        const normalized = value
            .map((item) => item.trim())
            .filter(Boolean)
            .join(",");

        if (normalized) {
            query.set(key, normalized);
        }
        return;
    }

    const normalized = value.trim();
    if (normalized) {
        query.set(key, normalized);
    }
};

export const getOfficerQueue = (params: OfficerQueueParams = {}) => {
    const query = new URLSearchParams();

    appendMultiValueParam(query, "status", params.status);

    if (typeof params.ward_id === "number") {
        query.set("ward_id", String(params.ward_id));
    }
    if (params.from_date?.trim()) {
        query.set("from_date", params.from_date.trim());
    }
    if (params.to_date?.trim()) {
        query.set("to_date", params.to_date.trim());
    }

    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<OfficerQueueResponse>(`/officer/queue${suffix}`);
};

// Update report status from officer queue tools.
export const updateOfficerQueueStatus = (
    reportId: number,
    payload: { status: ReportLifecycleStatus; notes?: string }
) =>
    request<{ message: string; new_status: ReportLifecycleStatus }>(`/officer/queue/${reportId}/status`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });

// Save officer note on a specific report.
export const addOfficerQueueNote = (reportId: number, notes: string) =>
    request<{ message: string }>(`/officer/queue/${reportId}/notes`, {
        method: "POST",
        body: JSON.stringify({ notes }),
    });

type OfficerEscalationParams = {
    status?: string | string[];
};

export const getOfficerEscalations = (params: OfficerEscalationParams = {}) => {
    const query = new URLSearchParams();
    appendMultiValueParam(query, "status", params.status);
    const suffix = query.toString() ? `?${query.toString()}` : "";

    return request<OfficerEscalationsResponse>(`/escalations${suffix}`);
};

type AdminReportsQuery = {
    page?: number;
    limit?: number;
    ward_id?: number;
    category_id?: number;
    authority_id?: number;
    status?: string | string[];
    from_date?: string;
    to_date?: string;
    search?: string;
};

export const getAdminReports = (queryParams: AdminReportsQuery = {}) => {
    const query = new URLSearchParams();

    if (typeof queryParams.page === "number") query.set("page", String(queryParams.page));
    if (typeof queryParams.limit === "number") query.set("limit", String(queryParams.limit));
    if (typeof queryParams.ward_id === "number") query.set("ward_id", String(queryParams.ward_id));
    if (typeof queryParams.category_id === "number") query.set("category_id", String(queryParams.category_id));
    if (typeof queryParams.authority_id === "number") query.set("authority_id", String(queryParams.authority_id));
    if (queryParams.from_date?.trim()) query.set("from_date", queryParams.from_date.trim());
    if (queryParams.to_date?.trim()) query.set("to_date", queryParams.to_date.trim());
    if (queryParams.search?.trim()) query.set("search", queryParams.search.trim());

    appendMultiValueParam(query, "status", queryParams.status);

    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<AdminReportsResponse>(`/admin/reports${suffix}`);
};

// Admin action to reassign report ownership/routing.
export const reassignAdminReport = (
    reportId: number,
    payload: { authority_id: number; category_id?: number; note: string }
) =>
    request<AdminReportReassignResponse>(`/admin/reports/${reportId}/reassign`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });

// Admin action to force close a report with audit note.
export const overrideCloseAdminReport = (
    reportId: number,
    payload: { note: string }
) =>
    request<AdminOverrideCloseResponse>(`/admin/reports/${reportId}/override-close`, {
        method: "PATCH",
        body: JSON.stringify(payload),
    });

// Submit a new report with form data + optional media.
export const createReport = (formData: FormData) =>
    request<{ message: string; report: { id: number; tracking_number: string } }>("/reports", {
        method: "POST",
        body: formData,
    });

// Upvote or remove upvote for a report.
export const toggleUpvote = (reportId: number) =>
    request<{ upvoted: boolean; upvote_count: number; message: string }>(`/reports/${reportId}/upvote`, {
        method: "POST",
    });

// Convert backend media path into absolute browser URL.
export const toPublicAssetUrl = (mediaUrl?: string | null) => {
    if (!mediaUrl) return null;
    if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) return mediaUrl;

    // Remove /api segment so static uploads resolve from backend root.
    const apiOrigin = API_BASE_URL.replace(/\/api\/?$/, "");
    const normalizedPath = mediaUrl.replace(/\\/g, "/");
    const pathWithLeadingSlash = normalizedPath.startsWith("/")
        ? normalizedPath
        : `/${normalizedPath}`;
    return `${apiOrigin}${pathWithLeadingSlash}`;
};
