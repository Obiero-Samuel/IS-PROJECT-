import type { UserRole } from "./types";

export const defaultRouteForRole = (role: UserRole | null | undefined) => {
    switch (role) {
        case "admin":
            return "/admin";
        case "authority":
            return "/officer";
        case "resident":
        default:
            return "/my-profile";
    }
};
