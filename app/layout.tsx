import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blog Dashboard",
  description: "Internal dashboard for the HME Technology blog network",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
