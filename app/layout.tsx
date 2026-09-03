import type { Metadata } from "next";
import Nav from "@/components/Nav";
import { getSites } from "@/lib/sites";
import "./globals.css";

export const metadata: Metadata = {
  title: "Blog Dashboard",
  description: "Internal dashboard for the HME Technology blog network",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const sites = await getSites();

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <Nav sites={sites} />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
