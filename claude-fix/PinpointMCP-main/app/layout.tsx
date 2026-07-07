import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import PinpointSelector from "pinpoint-react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Pinpoint test project",
  description: "Vertical-slice test bed for the Pinpoint visual selector",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.className}`}>
      <body className="min-h-full flex flex-col relative overflow-x-hidden">
        <div className="bg-glow" />
        {children}
        {process.env.NODE_ENV === "development" && <PinpointSelector />}
      </body>
    </html>
  );
}
