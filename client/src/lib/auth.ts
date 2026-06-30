import type { AuthPayload } from "./types";

const AUTH_KEY = "is_project_auth";
const AUTH_SYNC_EVENT = "is-project-auth-sync";

const canUseStorage = () => typeof window !== "undefined";

const parseAuth = (raw: string | null): AuthPayload | null => {
    if (!raw) return null;

    try {
        return JSON.parse(raw) as AuthPayload;
    } catch {
        return null;
    }
};

const readAuthRaw = (): string | null => {
    if (!canUseStorage()) return null;
    return localStorage.getItem(AUTH_KEY);
};

const emitAuthSync = () => {
    if (!canUseStorage()) return;
    window.dispatchEvent(new Event(AUTH_SYNC_EVENT));
};

export const getAuth = (): AuthPayload | null => {
    return parseAuth(readAuthRaw());
};

export const setAuth = (payload: AuthPayload) => {
    if (!canUseStorage()) return;
    localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
    emitAuthSync();
};

export const clearAuth = () => {
    if (!canUseStorage()) return;
    localStorage.removeItem(AUTH_KEY);
    emitAuthSync();
};

export const getToken = () => getAuth()?.token ?? null;

export const subscribeAuth = (callback: () => void) => {
    if (!canUseStorage()) return () => { };

    const handler = (event?: Event) => {
        if (event instanceof StorageEvent && event.key && event.key !== AUTH_KEY) {
            return;
        }
        callback();
    };

    window.addEventListener(AUTH_SYNC_EVENT, handler);
    window.addEventListener("storage", handler);

    return () => {
        window.removeEventListener(AUTH_SYNC_EVENT, handler);
        window.removeEventListener("storage", handler);
    };
};

export const getAuthSnapshot = (): string | null => readAuthRaw();
export const getAuthServerSnapshot = (): string | null => null;
export const authFromSnapshot = (raw: string | null): AuthPayload | null => parseAuth(raw);
