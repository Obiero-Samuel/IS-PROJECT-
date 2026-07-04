/**
 * Browser auth storage + sync helpers.
 */
import type { AuthPayload, AuthUser } from "./types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5000/api";
// LocalStorage key used for lightweight auth snapshot ({ user }).
const AUTH_KEY = "is_project_auth";
// Custom browser event name used to notify same-tab listeners.
const AUTH_SYNC_EVENT = "is-project-auth-sync";

// SSR-safe storage guard.
const canUseStorage = () => typeof window !== "undefined";

const parseAuth = (raw: string | null): AuthPayload | null => {
    // Null means there is no saved auth state.
    if (!raw) return null;

    try {
        // Parse JSON string into the typed auth payload shape.
        const parsed = JSON.parse(raw) as Partial<AuthPayload> | null;
        if (!parsed?.user) return null;

        // Persist only safe user metadata in browser storage.
        return {
            user: parsed.user,
        };
    } catch {
        // Bad/corrupt JSON is treated as no session.
        return null;
    }
};

const readAuthRaw = (): string | null => {
    // During SSR there is no localStorage, so return null safely.
    if (!canUseStorage()) return null;
    // Read the raw string value exactly as stored.
    return localStorage.getItem(AUTH_KEY);
};

const emitAuthSync = () => {
    // storage event won't fire in same tab, so emit custom sync event.
    if (!canUseStorage()) return;
    // Trigger all subscribers that auth changed right now.
    window.dispatchEvent(new Event(AUTH_SYNC_EVENT));
};

export const getAuth = (): AuthPayload | null => {
    // Read + parse current auth state in one helper.
    return parseAuth(readAuthRaw());
};

export const setAuth = (payload: AuthPayload) => {
    // Ignore writes when not in a browser context.
    if (!canUseStorage()) return;
    // Persist only session-safe user metadata (no JWT in browser storage).
    localStorage.setItem(AUTH_KEY, JSON.stringify({ user: payload.user }));
    // Notify listeners after storage is updated.
    emitAuthSync();
};

export const clearAuth = () => {
    // Ignore clears when not in a browser context.
    if (!canUseStorage()) return;
    // Remove persisted session.
    localStorage.removeItem(AUTH_KEY);
    // Notify listeners so UI updates immediately.
    emitAuthSync();
};

export const hasAuthSession = () => Boolean(getAuth()?.user);

// Refresh local auth snapshot from backend session cookie.
export const refreshAuthSession = async (): Promise<AuthUser | null> => {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            method: "GET",
            credentials: "include",
        });

        if (!response.ok) {
            clearAuth();
            return null;
        }

        const payload = (await response.json()) as { user?: AuthUser };
        if (!payload.user) {
            clearAuth();
            return null;
        }

        setAuth({ user: payload.user });
        return payload.user;
    } catch {
        clearAuth();
        return null;
    }
};

export const subscribeAuth = (callback: () => void) => {
    // Return a no-op unsubscribe during SSR.
    if (!canUseStorage()) return () => { };

    // Listen for same-tab and cross-tab auth changes.
    const handler = (event?: Event) => {
        // Ignore unrelated storage updates for other keys.
        if (event instanceof StorageEvent && event.key && event.key !== AUTH_KEY) {
            return;
        }
        // Trigger React store subscribers.
        callback();
    };

    // Same-tab updates.
    window.addEventListener(AUTH_SYNC_EVENT, handler);
    // Cross-tab updates.
    window.addEventListener("storage", handler);

    return () => {
        // Cleanup listeners on unsubscribe.
        window.removeEventListener(AUTH_SYNC_EVENT, handler);
        window.removeEventListener("storage", handler);
    };
};

// Snapshot helpers power useSyncExternalStore consumers.
export const getAuthSnapshot = (): string | null => readAuthRaw();
// Server snapshot is always null because browser storage is unavailable on server.
export const getAuthServerSnapshot = (): string | null => null;
// Convert snapshot raw string into parsed auth object when needed.
export const authFromSnapshot = (raw: string | null): AuthPayload | null => parseAuth(raw);
