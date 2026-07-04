/**
 * Browser auth storage + sync helpers.
 */
import type { AuthPayload } from "./types";

// LocalStorage key used for the full auth payload ({ token, user }).
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
        return JSON.parse(raw) as AuthPayload;
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
    // Persist latest token and user details.
    localStorage.setItem(AUTH_KEY, JSON.stringify(payload));
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

// Convenience helper used by API calls that only need the token.
export const getToken = () => getAuth()?.token ?? null;

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
