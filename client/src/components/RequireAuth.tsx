"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getToken } from "@/lib/auth";

interface RequireAuthProps {
    children: React.ReactNode;
}

export default function RequireAuth({ children }: RequireAuthProps) {
    const router = useRouter();
    const pathname = usePathname();
    const [isAuthed] = useState<boolean>(() => Boolean(getToken()));

    useEffect(() => {
        if (!isAuthed) {
            const nextParam = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
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
