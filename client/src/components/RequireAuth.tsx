/**
 * Route guard for auth + optional role checks.
 */
"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
    authFromSnapshot,
    getAuthServerSnapshot,
    getAuthSnapshot,
    refreshAuthSession,
    subscribeAuth,
} from "@/lib/auth";
import { defaultRouteForRole } from "@/lib/roleRouting";
import type { UserRole } from "@/lib/types";

interface RequireAuthProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
}

export default function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
    // Router lets us redirect users when they are not allowed to stay on this page.
    const router = useRouter();
    // Pathname is used to preserve intended destination for post-auth return.
    const pathname = usePathname();
    // Subscribe to auth store so this guard updates as soon as auth changes.
    const authRaw = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthServerSnapshot);
    // Parse auth snapshot into a typed object.
    const auth = authFromSnapshot(authRaw);
    const [sessionChecked, setSessionChecked] = useState(false);
    // Boolean check keeps conditional logic easy to read.
    const isAuthed = Boolean(auth?.user);
    // Current role may be undefined briefly while auth is loading.
    const role = auth?.user?.role;
    // If no role list is provided, any authenticated role is allowed.
    const hasRoleAccess = !allowedRoles || (role ? allowedRoles.includes(role) : false);

    useEffect(() => {
        let isMounted = true;

        const run = async () => {
            // If we already have local auth snapshot, skip backend hydration.
            if (isAuthed) {
                if (isMounted) setSessionChecked(true);
                return;
            }

            // Try hydrating from HttpOnly cookie session.
            await refreshAuthSession();
            if (isMounted) {
                setSessionChecked(true);
            }
        };

        void run();

        return () => {
            isMounted = false;
        };
    }, [isAuthed]);

    useEffect(() => {
        if (!sessionChecked) return;

        // Unauthenticated users go to register with a return path.
        if (!isAuthed) {
            const nextParam = pathname ? `?next=${encodeURIComponent(pathname)}` : "?next=%2Fmy-profile";
            router.replace(`/register${nextParam}`);
            return;
        }

        // Authenticated but unauthorized users go to role default page.
        if (!hasRoleAccess) {
            router.replace(defaultRouteForRole(role));
        }
    }, [hasRoleAccess, isAuthed, pathname, role, router, sessionChecked]);

    // While redirecting, show a small status message instead of protected content.
    if (!sessionChecked || !isAuthed || !hasRoleAccess) {
        return (
            <main className="main">
                <div className="container">
                    <p className="message">
                        {!sessionChecked || !isAuthed
                            ? "Checking account access..."
                            : "Redirecting to your authorized workspace..."}
                    </p>
                </div>
            </main>
        );
    }

    // Access granted: render the protected page content.
    return <>{children}</>;
}
