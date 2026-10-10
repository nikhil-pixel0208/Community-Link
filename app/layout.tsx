import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/session";
import { ToastProvider } from "@/components/toast";

export const metadata: Metadata = {
  title: "Community Link — zone-based, self-destructing community",
  description:
    "Temporary, location-bound communities where every post disappears the moment its purpose is served.",
};

export const viewport: Viewport = {
  themeColor: "#07080d",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <ToastProvider>
          <SessionProvider>{children}</SessionProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
