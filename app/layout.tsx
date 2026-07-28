import "./globals.css";
import type { Metadata } from "next";
import AppShell from "@/app/components/AppShell";

export const metadata: Metadata = {
  title: "Tempsens System",
  description: "Internal job order, sales, and technical tools",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <AppShell>{children}</AppShell>
        </div>
      </body>
    </html>
  );
}
