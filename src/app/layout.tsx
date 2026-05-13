import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "Camera Monitor",
  description: "Monitoramento de câmeras com IA",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Providers>
          {children}
          <Toaster position="top-right" toastOptions={{
            className: "!bg-white dark:!bg-dark-100 !text-gray-900 dark:!text-gray-100 !shadow-lg dark:!shadow-black/30",
          }} />
        </Providers>
      </body>
    </html>
  );
}
