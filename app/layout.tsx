import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AGE.EXE — X Oracle",
  description: "Drop your PFP. Face your digital truth.",
  openGraph: {
    title: "AGE.EXE — X Oracle",
    description: "Drop your PFP. Face your digital truth.",
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
