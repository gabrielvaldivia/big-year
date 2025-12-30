import "./globals.css";
import { Providers } from "./providers";
import React from "react";

export const metadata = {
  title: "Yearly Calendar",
  description: "Full-year calendar with Google all-day events",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
