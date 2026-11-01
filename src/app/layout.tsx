import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "./providers";
import { DemoModeBanner } from "@/components/shared/demo-mode-banner";
import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: brand.name,
  description: brand.description,
  applicationName: brand.name
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased">
        <DemoModeBanner />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
