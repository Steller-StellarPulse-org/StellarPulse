import Link from "next/link";
import { FiTwitter, FiMessageCircle } from "react-icons/fi";

const PRODUCT_LINKS = [
  { href: "/markets", label: "Markets" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/profile", label: "Profile" },
];

const RESOURCE_LINKS = [
  { href: "https://soroban.stellar.org/docs", label: "Docs", external: true },
  { href: "https://github.com/Steller-StellarPulse-org/StellarPulse", label: "GitHub", external: true },
];

const LEGAL_LINKS = [
  { href: "#", label: "Terms" },
  { href: "#", label: "Privacy" },
];

const SOCIAL_LINKS = [
  { href: "https://x.com/StellarPulseHQ", label: "Twitter", icon: FiTwitter },
  { href: "#", label: "Telegram", icon: FiMessageCircle },
  { href: "#", label: "Discord", icon: FiMessageCircle },
];

export default function Footer() {
  return (
    <footer className="border-t border-surface-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {/* Grid columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-slate-200 mb-4">Product</h4>
            <ul className="space-y-3">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-semibold text-slate-200 mb-4">Resources</h4>
            <ul className="space-y-3">
              {RESOURCE_LINKS.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-slate-200 mb-4">Legal</h4>
            <ul className="space-y-3">
              {LEGAL_LINKS.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Social */}
          <div>
            <h4 className="text-sm font-semibold text-slate-200 mb-4">Social</h4>
            <ul className="space-y-3">
              {SOCIAL_LINKS.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    <l.icon className="w-4 h-4" />
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-surface-border pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/"
            className="select-none transition-transform duration-200 hover:scale-105"
            aria-label="StellarPulse home"
          >
            <span className="text-lg font-bold text-white">StellarPulse</span>
          </Link>
          <p className="text-sm text-slate-600">
            &copy; {new Date().getFullYear()} StellarPulse. Built on Stellar/Soroban.
          </p>
        </div>
      </div>
    </footer>
  );
}
