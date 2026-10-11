"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Send } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    {
      name: "Submit Project",
      href: "/",
      icon: Send,
      active: pathname === "/",
    },
    {
      name: "Global Leaderboard",
      href: "/leaderboard",
      icon: Trophy,
      active: pathname === "/leaderboard",
    },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-16 w-full items-center justify-between border-b border-white/5 bg-black/60 px-6 backdrop-blur-xl">
      {/* Massive and Commanding Brand Wordmark */}
      <Link href="/" className="flex items-center transition-opacity hover:opacity-90">
        <span className="text-2xl md:text-3xl font-extrabold tracking-tighter text-white drop-shadow-md font-sans">
          Praetor
        </span>
      </Link>

      {/* Refined Glassmorphic Navigation Tabs */}
      <nav className="flex items-center gap-1 rounded-full border border-white/10 bg-zinc-900/60 p-1 backdrop-blur-xl">
        {navLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "relative flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-colors duration-200",
                link.active
                  ? "text-white"
                  : "text-zinc-400 hover:text-zinc-200"
              )}
            >
              {link.active && (
                <motion.span
                  layoutId="navbar-active-pill"
                  className="absolute inset-0 rounded-full bg-white/10 border border-white/15 shadow-sm"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className="relative z-10 h-3.5 w-3.5" />
              <span className="relative z-10">{link.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Subtle Balance Spacer for Centering */}
      <div className="w-20 hidden sm:block pointer-events-none" />
    </header>
  );
}
