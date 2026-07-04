/**
 * This file handles shared frontend type definitions used across the app.
 */
// User roles supported by the platform.
export type UserRole = "resident" | "authority" | "admin";
// Main lifecycle states used by report workflows.
export type ReportLifecycleStatus = "pending" | "in-progress" | "resolved";

// Optional debug details returned in OTP-related responses (mainly useful in development).
export interface OtpDeliveryDebug {
    otp?: string;
    expiresInMinutes?: number;
    smtpMessageId?: string;
    smtpResponse?: string;
}

// Minimal user identity details attached to auth payloads.
export interface AuthUser {
    id: number;
    username: string;
    email: string;
    role: UserRole;
    ward_id?: number | null;
    authority_id?: number | null;
    is_active?: boolean;
    last_login_at?: string | null;
}

// Standard auth response containing logged-in user details.
// Token may be absent when backend uses HttpOnly cookie sessions.
export interface AuthPayload {
    token?: string;
    user: AuthUser;
}

// Metadata showing how many profile edits are used/remaining.
export interface ProfileEditsMeta {
    used: number;
    max: number;
    remaining: number;
}

// Full user profile shape displayed on the My Profile page.
export interface UserProfile {
    id: number;
    username: string;
    email: string;
    role: UserRole;
    ward_id?: number | null;
    authority_id?: number | null;
    is_active?: boolean;
    last_login_at?: string | null;
    full_name: string;
    phone_number?: string | null;
    date_of_birth?: string | null;
    residence?: string | null;
    profile_photo_url?: string | null;
    bio?: string | null;
    created_at: string;
}

// Response for reading current user's profile.
export interface ProfileResponse {
    profile: UserProfile;
    profileEdits: ProfileEditsMeta;
}

// Response for successful profile updates (may also refresh auth payload).
export interface UpdateProfileResponse extends AuthPayload {
    message: string;
    profile: UserProfile;
    profileEdits: ProfileEditsMeta;
}

// Registration endpoint response.
export interface RegisterResponse {
    message: string;
    requiresVerification: boolean;
    email: string;
    debug?: OtpDeliveryDebug;
}

// OTP resend response.
export interface ResendOtpResponse {
    message: string;
    debug?: OtpDeliveryDebug;
}

// OTP verification success response (returns active session).
export interface VerificationResponse extends AuthPayload {
    message: string;
}

// Ward reference data used in registration/login filters.
export interface Ward {
    id: number;
    name: string;
    code: string | null;
    county: string;
    constituency: string | null;
}

// Category reference data used in report submission and admin tools.
export interface Category {
    id: number;
    name: string;
    description?: string | null;
}

// Core report shape used on resident/public report pages.
export interface ReportItem {
    id: number;
    tracking_number: string;
    title: string;
    description: string;
    category_name: string;
    status: ReportLifecycleStatus;
    upvote_count: number;
    media_url?: string | null;
    location_address?: string | null;
    latitude?: string | number | null;
    longitude?: string | number | null;
    submitted_by?: string;
    created_at: string;
    updated_at?: string;
}

// Paginated report list response.
export interface ReportsResponse {
    reports: ReportItem[];
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// Response after resident deletes own report.
export interface DeleteMyReportResponse {
    message: string;
    report_id: number;
    deleted_at: string;
}

// Officer queue row shape (extended report + escalation context).
export interface OfficerQueueItem {
    id: number;
    tracking_number: string;
    title: string;
    description: string;
    status: ReportLifecycleStatus;
    created_at: string;
    updated_at: string;
    days_open: number;
    media_url?: string | null;
    latitude?: string | number | null;
    longitude?: string | number | null;
    location_address?: string | null;
    ward_id?: number | null;
    ward_name?: string | null;
    category_id?: number | null;
    category_name?: string | null;
    authority_id?: number | null;
    authority_name?: string | null;
    escalation_count: number;
    active_escalation_count: number;
    has_overdue_escalation: boolean;
    latest_escalation_id?: number | null;
    latest_escalation_status?: string | null;
    latest_escalated_at?: string | null;
    latest_escalation_is_overdue?: boolean;
    days_overdue: number;
}

// Officer queue filter metadata returned by backend.
export interface OfficerQueueFilters {
    status: string[];
    ward_id: number | null;
    from_date: string | null;
    to_date: string | null;
}

// Officer queue API response payload.
export interface OfficerQueueResponse {
    authority_id: number;
    filters: OfficerQueueFilters;
    reports: OfficerQueueItem[];
}

// Escalation status progression.
export type EscalationStatus = "pending" | "acknowledged" | "resolved" | "rejected";

// Escalation item enriched with report/context details for officer alert panels.
export interface OfficerEscalationItem {
    id: number;
    report_id: number;
    authority_id: number;
    escalated_by: number;
    reason: string;
    status: EscalationStatus;
    authority_notes?: string | null;
    is_overdue: boolean;
    escalated_at: string;
    acknowledged_at?: string | null;
    resolved_at?: string | null;
    updated_at: string;
    title: string;
    tracking_number: string;
    report_status: ReportLifecycleStatus;
    report_created_at: string;
    category_name?: string | null;
    ward_name?: string | null;
    response_deadline_days: number;
    days_overdue: number;
    authority_name?: string | null;
}

// Escalation list response for officer dashboard.
export interface OfficerEscalationsResponse {
    authority_id: number;
    escalations: OfficerEscalationItem[];
}

// Compact authority shape used in mapped authorities arrays.
export interface AdminMappedAuthority {
    id: number;
    name: string;
}

// Generic pagination metadata reused by admin responses.
export interface PaginationMeta {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

// Admin report row with extra oversight fields.
export interface AdminReportItem {
    id: number;
    tracking_number: string;
    title: string;
    description: string;
    status: ReportLifecycleStatus;
    created_at: string;
    updated_at: string;
    closed_by_admin: boolean;
    admin_override_notes?: string | null;
    closed_at?: string | null;
    category_id?: number | null;
    category_name?: string | null;
    ward_id?: number | null;
    ward_name?: string | null;
    reporter_id?: number | null;
    reporter_username?: string | null;
    authority_id?: number | null;
    authority_name?: string | null;
    mapped_authorities?: AdminMappedAuthority[];
    latest_escalation_id?: number | null;
    latest_escalation_status?: string | null;
    latest_escalated_at?: string | null;
    overdue_escalation_count: number;
}

// Admin report listing response.
export interface AdminReportsResponse {
    reports: AdminReportItem[];
    pagination: PaginationMeta;
}

// Response after admin reassigns a report.
export interface AdminReportReassignResponse {
    message: string;
    report: Partial<AdminReportItem> & { id: number; tracking_number: string; status: ReportLifecycleStatus };
    escalation?: {
        id: number;
        authority_id: number;
        status: EscalationStatus;
        escalated_at: string;
    };
}

// Response after admin force-closes a report.
export interface AdminOverrideCloseResponse {
    message: string;
    report: {
        id: number;
        tracking_number: string;
        status: ReportLifecycleStatus;
        closed_by_admin: boolean;
        admin_override_notes?: string | null;
        closed_at?: string | null;
        updated_at: string;
    };
}

// Admin-facing user row for user management table.
export interface AdminUserRow {
    id: number;
    username: string;
    email: string;
    role: UserRole;
    ward_id?: number | null;
    authority_id?: number | null;
    is_active: boolean;
    last_login_at?: string | null;
    deactivated_at?: string | null;
    deactivation_reason?: string | null;
    created_at: string;
}

// Admin users endpoint response.
export interface AdminUsersResponse {
    users: AdminUserRow[];
}

// Response for activate/deactivate lifecycle operations.
export interface AdminUserLifecycleResponse {
    message: string;
    user: AdminUserRow;
}

// Category-authority SLA mapping row.
export interface CategoryAuthorityDeadlineMapping {
    category_id: number;
    category_name: string;
    authority_id: number;
    authority_name: string;
    authority_is_active: boolean;
    response_deadline_days: number;
}

// List response for category-authority mappings.
export interface CategoryAuthorityDeadlineListResponse {
    mappings: CategoryAuthorityDeadlineMapping[];
}

// Save/upsert mapping response.
export interface CategoryAuthorityDeadlineSaveResponse {
    message: string;
    mapping: {
        category_id: number;
        authority_id: number;
        response_deadline_days: number;
    };
}

// Delete mapping response.
export interface CategoryAuthorityDeadlineDeleteResponse {
    message: string;
}

// File formats supported for weekly exports.
export type WeeklyExportFormat = "csv" | "pdf";

// Weekly export record row shown in admin downloads table.
export interface AdminWeeklyExportItem {
    id: number;
    authority_id: number;
    authority_name: string;
    ward_id?: number | null;
    ward_name?: string | null;
    period_start: string;
    period_end: string;
    total_issues: number;
    open_issues: number;
    resolved_issues: number;
    pending_issues: number;
    escalated_issues: number;
    generated_at: string;
    report_file_url?: string | null;
    report_file_type?: string | null;
}

// Weekly exports list response.
export interface AdminWeeklyExportsResponse {
    exports: AdminWeeklyExportItem[];
}

// Response for generating a new weekly export artifact.
export interface AdminWeeklyExportGenerateResponse {
    message: string;
    export: AdminWeeklyExportItem;
}
