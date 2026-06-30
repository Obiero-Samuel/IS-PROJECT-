import type {
    AuthPayload,
    Category,
    ProfileResponse,
    RegisterResponse,
    ReportsResponse,
    ResendOtpResponse,
    UpdateProfileResponse,
    VerificationResponse,
    Ward
} from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api";
export const TOKEN_STORAGE_KEY = "is_project_token";

type RequestConfig = RequestInit & {
    token?: string | null;
};

export type ApiRequestOptions = {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    token?: string;
    body?: Record<string, unknown>;
};

const toErrorMessage = (payload: unknown, fallback: string) => {
    if (typeof payload === "object" && payload !== null) {
        const record = payload as { error?: { message?: string }; message?: string };
        return record.error?.message ?? record.message ?? fallback;
    }
    return fallback;
};

const request = async <T>(path: string, config: RequestConfig = {}): Promise<T> => {
    const headers = new Headers(config.headers);

    if (!(config.body instanceof FormData)) {
        headers.set("Content-Type", "application/json");
    }

    if (config.token) {
        headers.set("Authorization", `Bearer ${config.token}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...config,
        headers,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(toErrorMessage(payload, `Request failed with status ${response.status}`));
    }

    return payload as T;
};

export async function apiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const { method = "GET", token, body } = options;
    return request<T>(endpoint, {
        method,
        token,
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
}

export function loadStoredToken(): string {
    if (typeof window === "undefined") {
        return "";
    }

    return localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
}

export function storeToken(token: string): void {
    if (typeof window === "undefined") {
        return;
    }

    if (!token.trim()) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        return;
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
}

export const register = (username: string, email: string, password: string, ward_id: number) =>
    request<RegisterResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password, ward_id }),
    });

export const login = (username: string, email: string, password: string, ward_id: number) =>
    request<AuthPayload>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, email, password, ward_id }),
    });

export const verifyEmailOtp = (email: string, otp: string) =>
    request<VerificationResponse>("/auth/verify-email-otp", {
        method: "POST",
        body: JSON.stringify({ email, otp }),
    });

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

export const getCategories = async () => {
    const data = await request<{ categories: Category[] }>("/reports/categories");
    return data.categories;
};

export const getPublicReports = (params?: { page?: number; limit?: number; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.status) query.set("status", params.status);

    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<ReportsResponse>(`/reports${suffix}`);
};

export const getMyReports = (token: string) =>
    request<ReportsResponse>("/reports/mine", { token });

export const createReport = (token: string, formData: FormData) =>
    request<{ message: string; report: { id: number; tracking_number: string } }>("/reports", {
        method: "POST",
        token,
        body: formData,
    });

export const toggleUpvote = (token: string, reportId: number) =>
    request<{ upvoted: boolean; upvote_count: number; message: string }>(`/reports/${reportId}/upvote`, {
        method: "POST",
        token,
    });

export const toPublicAssetUrl = (mediaUrl?: string | null) => {
    if (!mediaUrl) return null;
    if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) return mediaUrl;

    const apiOrigin = API_BASE_URL.replace(/\/api\/?$/, "");
    return `${apiOrigin}${mediaUrl}`;
};
