import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { Navbar } from "@/components/navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Praetor — Multimodal AI Hackathon Evaluator",
  description:
    "Autonomous multimodal hackathon evaluator. Cross-referencing codebase and UI demo videos or screenshots with Gemma 4, anchored immutably on Avalanche Fuji.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-black text-zinc-100 selection:bg-white selection:text-black">
        <Suspense fallback={<div className="fixed top-0 left-0 right-0 h-16 border-b border-white/5 bg-black/60 z-50" />}>
          <Navbar />
        </Suspense>
        {children}
        <Toaster
          position="bottom-left"
          toastOptions={{
            style: {
              background: "#18181b",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "#f4f4f5",
            },
          }}
        />
      </body>
    </html>
  );
}
