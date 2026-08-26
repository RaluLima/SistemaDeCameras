"use client";
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SocketProvider } from "@/contexts/SocketContext";
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <SocketProvider>
        <ThemeProvider>{children}</ThemeProvider>
      </SocketProvider>
    </SessionProvider>
  );
}
