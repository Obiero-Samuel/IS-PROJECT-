/**
 * This file handles default route selection based on user role.
 */
import type { UserRole } from "./types";

// Decide where a user should land after login based on their role.
export const defaultRouteForRole = (role: UserRole | null | undefined) => {
    // A switch makes role-to-page mapping easy to read and maintain.
    switch (role) {
        case "admin":
            // Admins go to the admin control panel.
            return "/admin";
        case "authority":
            // Authority users go to the officer operations dashboard.
            return "/officer";
        case "resident":
        default:
            // Residents (or unknown role fallbacks) go to their personal profile area.
            return "/my-profile";
    }
};
