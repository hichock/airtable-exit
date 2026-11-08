import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { loadSchema } from "@/lib/schema/load";

export function generateMetadata(): Metadata {
  return { title: loadSchema().app.name, description: "Your own CRM, built from your Airtable base." };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
