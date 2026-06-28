import type { AuthPayload } from "./types";

const AUTH_KEY = "is_project_auth";

const canUseStorage = () => typeof window !== "undefined";

export const getAuth = (): AuthPayload | null => {
    if (!canUseStorage()) return null;

    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;

    try {
        return JSON.parse(raw) as AuthPayload;
    } catch {
        localStorage.removeItem(AUTH_KEY);
        return null;
    }
};

export const setAuth = (payload: AuthPayload) => {
    if (!canUseStorage()) return;
    localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
};

export const clearAuth = () => {
    if (!canUseStorage()) return;
    localStorage.removeItem(AUTH_KEY);
};

export const getToken = () => getAuth()?.token ?? null;
