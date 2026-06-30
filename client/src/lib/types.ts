export type UserRole = "resident" | "authority" | "admin";

export interface OtpDeliveryDebug {
    otp?: string;
    expiresInMinutes?: number;
    smtpMessageId?: string;
    smtpResponse?: string;
}

export interface AuthUser {
    id: number;
    username: string;
    email: string;
    role: UserRole;
    ward_id?: number | null;
}

export interface AuthPayload {
    token: string;
    user: AuthUser;
}

export interface ProfileEditsMeta {
    used: number;
    max: number;
    remaining: number;
}

export interface UserProfile {
    id: number;
    username: string;
    email: string;
    role: UserRole;
    ward_id?: number | null;
    full_name: string;
    phone_number?: string | null;
    date_of_birth?: string | null;
    residence?: string | null;
    profile_photo_url?: string | null;
    bio?: string | null;
    created_at: string;
}

export interface ProfileResponse {
    profile: UserProfile;
    profileEdits: ProfileEditsMeta;
}

export interface UpdateProfileResponse extends AuthPayload {
    message: string;
    profile: UserProfile;
    profileEdits: ProfileEditsMeta;
}

export interface RegisterResponse {
    message: string;
    requiresVerification: boolean;
    email: string;
    debug?: OtpDeliveryDebug;
}

export interface ResendOtpResponse {
    message: string;
    debug?: OtpDeliveryDebug;
}

export interface VerificationResponse extends AuthPayload {
    message: string;
}

export interface Ward {
    id: number;
    name: string;
    code: string | null;
    county: string;
    constituency: string | null;
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
