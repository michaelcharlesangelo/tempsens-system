import "./globals.css";
import type { Metadata, Viewport } from "next";
import AppShell from "@/app/components/AppShell";

export const metadata: Metadata = {
  title: "Tempsens System",
  description: "Internal job order, sales, and technical tools",
};

// Was missing entirely - without it, mobile browsers render the page at a
// virtual ~980px desktop width and scale it down, which is most of why
// pages "looked messed up" on phones (tables cramped, text sizing weird).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
