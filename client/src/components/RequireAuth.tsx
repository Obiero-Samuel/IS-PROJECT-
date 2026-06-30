"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authFromSnapshot, getAuthServerSnapshot, getAuthSnapshot, subscribeAuth } from "@/lib/auth";
import { defaultRouteForRole } from "@/lib/roleRouting";
import type { UserRole } from "@/lib/types";

interface RequireAuthProps {
    children: React.ReactNode;
    allowedRoles?: UserRole[];
}

export default function RequireAuth({ children, allowedRoles }: RequireAuthProps) {
    const router = useRouter();
    const pathname = usePathname();
    const authRaw = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthServerSnapshot);
    const auth = authFromSnapshot(authRaw);
    const isAuthed = Boolean(auth?.token);
    const role = auth?.user?.role;
    const hasRoleAccess = !allowedRoles || (role ? allowedRoles.includes(role) : false);

    useEffect(() => {
        if (!isAuthed) {
            const nextParam = pathname ? `?next=${encodeURIComponent(pathname)}` : "?next=%2Fmy-profile";
            router.replace(`/register${nextParam}`);
            return;
        }

        if (!hasRoleAccess) {
            router.replace(defaultRouteForRole(role));
        }
    }, [hasRoleAccess, isAuthed, pathname, role, router]);

    if (!isAuthed || !hasRoleAccess) {
        return (
            <main className="main">
                <div className="container">
                    <p className="message">
                        {!isAuthed ? "Checking account access..." : "Redirecting to your authorized workspace..."}
                    </p>
                </div>
            </main>
        );
    }

    return <>{children}</>;
}
