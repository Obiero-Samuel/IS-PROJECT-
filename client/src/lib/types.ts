export type UserRole = "resident" | "authority" | "admin";

export interface AuthUser {
    id: number;
    username: string;
    email: string;
    role: UserRole;
}

export interface AuthPayload {
    token: string;
    user: AuthUser;
}

export interface Category {
    id: number;
    name: string;
    description?: string | null;
}

export interface ReportItem {
    id: number;
    tracking_number: string;
    title: string;
    description: string;
    category_name: string;
    status: "pending" | "in-progress" | "resolved";
    upvote_count: number;
    media_url?: string | null;
    location_address?: string | null;
    latitude?: string | number | null;
    longitude?: string | number | null;
    submitted_by?: string;
    created_at: string;
    updated_at?: string;
}

export interface ReportsResponse {
    reports: ReportItem[];
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
