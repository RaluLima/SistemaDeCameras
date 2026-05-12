"use client";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (
      session?.user &&
      (session.user as any).mustChangePassword &&
      pathname !== "/change-password"
    ) {
      router.push("/change-password");
    }
  }, [session, pathname, router]);

  return <>{children}</>;
}
