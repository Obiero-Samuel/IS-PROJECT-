"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { authFromSnapshot, getAuthServerSnapshot, getAuthSnapshot, subscribeAuth } from "@/lib/auth";

interface RequireAuthProps {
    children: React.ReactNode;
}

export default function RequireAuth({ children }: RequireAuthProps) {
    const router = useRouter();
    const pathname = usePathname();
    const authRaw = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getAuthServerSnapshot);
    const auth = authFromSnapshot(authRaw);
    const isAuthed = Boolean(auth?.token);

    useEffect(() => {
        if (!isAuthed) {
            const nextParam = pathname ? `?next=${encodeURIComponent(pathname)}` : "?next=%2Fmy-profile";
            router.replace(`/register${nextParam}`);
        }
    }, [isAuthed, pathname, router]);

    if (!isAuthed) {
        return (
            <main className="main">
                <div className="container">
                    <p className="message">Checking account access...</p>
                </div>
            </main>
        );
    }

    return <>{children}</>;
}
