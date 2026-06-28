import type { AuthPayload, Category, ReportsResponse } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api";

type RequestConfig = RequestInit & {
    token?: string | null;
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

    const response = await fetch(`${API_BASE}${path}`, {
        ...config,
        headers,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(toErrorMessage(payload, "Request failed."));
    }

    return payload as T;
};

export const register = (username: string, email: string, password: string) =>
    request<AuthPayload>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
    });

export const login = (email: string, password: string) =>
    request<AuthPayload>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
    });

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

    const apiOrigin = API_BASE.replace(/\/api\/?$/, "");
    return `${apiOrigin}${mediaUrl}`;
};
