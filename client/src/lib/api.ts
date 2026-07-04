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
// Legacy token-only storage key used by dashboard token card.
export const TOKEN_STORAGE_KEY = "is_project_token";
// Full auth payload storage key used by login/session flows.
const AUTH_STORAGE_KEY = "is_project_auth";

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
    // Start with existing headers so callers can still pass custom values.
    const headers = new Headers(config.headers);

    // Let browser set multipart boundary for FormData.
    if (!(config.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }

    // Attach Bearer token when this request requires authentication.
    if (config.token) {
        headers.set("Authorization", `Bearer ${config.token}`);
    }

    // Execute request to backend API.
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...config,
        headers,
    });

    // Try to parse JSON response body; use empty object if response is not JSON.
    const payload = await response.json().catch(() => ({}));

    // Throw a normalized Error for non-success statuses.
    if (!response.ok) {
        throw new Error(toErrorMessage(payload, `Request failed with status ${response.status}`));
    }

    // Return typed payload so callers get compile-time type help.
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

    // Shared binary-download flow (auth + filename extraction).
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...config,
        headers,
    });

    if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(toErrorMessage(payload, `Request failed with status ${response.status}`));
    }

    const blob = await response.blob();
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const filename = extractFilenameFromContentDisposition(response.headers.get("content-disposition"));

    // Return file data + metadata to support browser downloads.
    return { blob, filename, contentType };
};

// Small generic wrapper for endpoint calls not covered by specific helpers below.
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
export const getAdminUsers = (token: string) =>
    request<AdminUsersResponse>("/admin/users", { token });

export const updateAdminUserLifecycle = (
    token: string,
    userId: number,
    payload: { is_active: boolean; deactivation_reason?: string }
) =>
    request<AdminUserLifecycleResponse>(`/admin/users/${userId}/lifecycle`, {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
    });

export const getCategoryAuthorityMappings = (token: string) =>
    request<CategoryAuthorityDeadlineListResponse>("/admin/category-authority-map", { token });

export const saveCategoryAuthorityDeadline = (
    token: string,
    payload: { category_id: number; authority_id: number; response_deadline_days: number }
) =>
    request<CategoryAuthorityDeadlineSaveResponse>("/admin/category-authority-map", {
        method: "POST",
        token,
        body: JSON.stringify(payload),
    });

export const deleteCategoryAuthorityMapping = (
    token: string,
    payload: { category_id: number; authority_id: number }
) =>
    request<CategoryAuthorityDeadlineDeleteResponse>("/admin/category-authority-map", {
        method: "DELETE",
        token,
        body: JSON.stringify(payload),
    });

type AdminWeeklyExportsQuery = {
    authority_id?: number;
    format?: "csv" | "pdf";
    limit?: number;
};

export const getAdminWeeklyExports = (token: string, queryParams: AdminWeeklyExportsQuery = {}) => {
    const query = new URLSearchParams();

    if (typeof queryParams.authority_id === "number") query.set("authority_id", String(queryParams.authority_id));
    if (queryParams.format) query.set("format", queryParams.format);
    if (typeof queryParams.limit === "number") query.set("limit", String(queryParams.limit));

    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<AdminWeeklyExportsResponse>(`/admin/weekly-exports${suffix}`, { token });
};

export const generateAdminWeeklyExport = (
    token: string,
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
        token,
        body: JSON.stringify(payload),
    });

export const downloadAdminWeeklyExport = (token: string, exportId: number) =>
    requestBinary(`/admin/weekly-exports/${exportId}/download`, {
        method: "GET",
        token,
    });

// Read token from storage (supports both legacy token key and full auth payload key).
export function loadStoredToken(): string {
    if (typeof window === "undefined") {
        return "";
    }

    // Support legacy auth payload storage.
    const directToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (directToken) {
        return directToken;
    }

    const authRaw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!authRaw) {
        return "";
    }

    try {
        const parsed = JSON.parse(authRaw) as { token?: string };
        return parsed.token ?? "";
    } catch {
        // Invalid JSON should fail safely instead of crashing the app.
        return "";
    }
}

export function storeToken(token: string): void {
    if (typeof window === "undefined") {
        return;
    }

    // Empty token means clear stored auth token.
    if (!token.trim()) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return;
    }

    // Save trimmed token to avoid accidental whitespace issues.
    localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
}

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
export const getMyProfile = (token: string) =>
    request<ProfileResponse>("/auth/profile", { token });

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
export const updateMyProfile = (token: string, payload: UpdateMyProfilePayload) => {
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
        token,
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
export const getMyReports = (token: string) =>
    request<ReportsResponse>("/reports/mine", { token });

type OfficerQueueParams = {
    status?: string | string[];
    ward_id?: number;
    from_date?: string;
    to_date?: string;
};

const appendMultiValueParam = (query: URLSearchParams, key: string, value?: string | string[]) => {
    // Backend expects CSV for multi-select filters.
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

export const getOfficerQueue = (token: string, params: OfficerQueueParams = {}) => {
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
    return request<OfficerQueueResponse>(`/officer/queue${suffix}`, { token });
};

// Update report status from officer queue tools.
export const updateOfficerQueueStatus = (
    token: string,
    reportId: number,
    payload: { status: ReportLifecycleStatus; notes?: string }
) =>
    request<{ message: string; new_status: ReportLifecycleStatus }>(`/officer/queue/${reportId}/status`, {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
    });

// Save officer note on a specific report.
export const addOfficerQueueNote = (token: string, reportId: number, notes: string) =>
    request<{ message: string }>(`/officer/queue/${reportId}/notes`, {
        method: "POST",
        token,
        body: JSON.stringify({ notes }),
    });

type OfficerEscalationParams = {
    status?: string | string[];
};

export const getOfficerEscalations = (token: string, params: OfficerEscalationParams = {}) => {
    const query = new URLSearchParams();
    appendMultiValueParam(query, "status", params.status);
    const suffix = query.toString() ? `?${query.toString()}` : "";

    return request<OfficerEscalationsResponse>(`/escalations${suffix}`, { token });
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

export const getAdminReports = (token: string, queryParams: AdminReportsQuery = {}) => {
    const query = new URLSearchParams();

    if (typeof queryParams.page === 'number') query.set('page', String(queryParams.page));
    if (typeof queryParams.limit === 'number') query.set('limit', String(queryParams.limit));
    if (typeof queryParams.ward_id === 'number') query.set('ward_id', String(queryParams.ward_id));
    if (typeof queryParams.category_id === 'number') query.set('category_id', String(queryParams.category_id));
    if (typeof queryParams.authority_id === 'number') query.set('authority_id', String(queryParams.authority_id));
    if (queryParams.from_date?.trim()) query.set('from_date', queryParams.from_date.trim());
    if (queryParams.to_date?.trim()) query.set('to_date', queryParams.to_date.trim());
    if (queryParams.search?.trim()) query.set('search', queryParams.search.trim());

    appendMultiValueParam(query, 'status', queryParams.status);

    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<AdminReportsResponse>(`/admin/reports${suffix}`, { token });
};

// Admin action to reassign report ownership/routing.
export const reassignAdminReport = (
    token: string,
    reportId: number,
    payload: { authority_id: number; category_id?: number; note: string }
) =>
    request<AdminReportReassignResponse>(`/admin/reports/${reportId}/reassign`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
    });

// Admin action to force close a report with audit note.
export const overrideCloseAdminReport = (
    token: string,
    reportId: number,
    payload: { note: string }
) =>
    request<AdminOverrideCloseResponse>(`/admin/reports/${reportId}/override-close`, {
        method: 'PATCH',
        token,
        body: JSON.stringify(payload),
    });

// Submit a new report with form data + optional media.
export const createReport = (token: string, formData: FormData) =>
    request<{ message: string; report: { id: number; tracking_number: string } }>("/reports", {
        method: "POST",
        token,
        body: formData,
    });

// Upvote or remove upvote for a report.
export const toggleUpvote = (token: string, reportId: number) =>
    request<{ upvoted: boolean; upvote_count: number; message: string }>(`/reports/${reportId}/upvote`, {
        method: "POST",
        token,
    });

// Convert backend media path into absolute browser URL.
export const toPublicAssetUrl = (mediaUrl?: string | null) => {
    if (!mediaUrl) return null;
    if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) return mediaUrl;

    // Remove /api segment so static uploads resolve from backend root.
    const apiOrigin = API_BASE_URL.replace(/\/api\/?$/, "");
    return `${apiOrigin}${mediaUrl}`;
};
