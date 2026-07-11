"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FiMenu } from "react-icons/fi";
import WalletConnect from "@/components/wallet/WalletConnect";
import MobileMenu from "./MobileMenu";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/markets", label: "Markets" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/profile", label: "Profile" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <nav
        className={`sticky top-0 z-50 bg-surface-card/80 backdrop-blur-md rounded-navbar transition-shadow duration-300 ${
          scrolled
            ? "shadow-2xl shadow-black/40 border-b border-surface-border"
            : "border-b border-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-3 select-none transition-transform duration-200 hover:scale-105"
            aria-label="StellarPulse home"
          >
            <span className="text-xl font-bold text-white">SP</span>
            <span className="hidden sm:inline-block text-lg font-semibold text-white text-gradient">StellarPulse</span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-4 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  isActive(link.href)
                    ? "text-white"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {link.label}
                {isActive(link.href) && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-accent-gold" />
                )}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <div className="hidden md:block">
              <WalletConnect />
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
              aria-label="Open menu"
            >
              <FiMenu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <MobileMenu isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
    </>
  );
}
