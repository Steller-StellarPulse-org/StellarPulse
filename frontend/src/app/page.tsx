import React from "react";
import Link from "next/link";
import {
  FiZap,
  FiGift,
  FiShield,
  FiLink,
  FiMessageCircle,
  FiActivity,
  FiHexagon,
  FiLock,
  FiSmartphone,
  FiArrowRight,
  FiCheck,
} from "react-icons/fi";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import FeaturedMarkets from "./FeaturedMarkets";
import LeaderboardPreview from "./LeaderboardPreview";
import LiveStats from "./LiveStats";

/* ─────────────────── Static Data ─────────────────── */

const FEATURES = [
  {
    icon: FiZap,
    title: "Instant Settlement",
    desc: "Bets confirm in 5 seconds via Stellar",
  },
  {
    icon: FiGift,
    title: "Everyone Earns",
    desc: "Win: 30 pts + 10 PULSE. Lose: 10 pts + 2 PULSE",
  },
  {
    icon: FiShield,
    title: "Fully Onchain",
    desc: "All bets, payouts, and rankings stored on Soroban",
  },
];

const STEPS = [
  { num: "01", title: "Connect Wallet", desc: "Connect Freighter, xBull, or Albedo. No signup needed." },
  { num: "02", title: "Pick a Market", desc: "Browse active predictions. Crypto, sports, events." },
  { num: "03", title: "Bet YES or NO", desc: "Stake XLM on your prediction. See live odds." },
  { num: "04", title: "Earn Rewards", desc: "Win or lose, you earn points + PULSE tokens." },
];

const EXTRA_FEATURES = [
  { icon: FiLink, title: "Onchain Referrals", desc: "Share your link, earn 0.5% + 3 bonus points on every bet placed by your referrals" },
  { icon: FiMessageCircle, title: "Social Sharing", desc: "Share your prediction on X, Telegram, WhatsApp with one tap" },
  { icon: FiActivity, title: "Live Activity", desc: "Real-time event feed of all bets and claims across markets" },
  { icon: FiHexagon, title: "PULSE Token", desc: "Platform token earned by every participant, win or lose" },
  { icon: FiLock, title: "Non-Custodial", desc: "Your keys, your funds. Smart contracts handle everything" },
  { icon: FiSmartphone, title: "Mobile-First", desc: "Full experience on mobile. Bet on the go" },
];

const ROADMAP = [
  { date: "Feb 2026", title: "Foundation", desc: "MVP launch, testnet, core markets", status: "done" },
  { date: "Jun 2026", title: "Mainnet Live", desc: "Shipped on Stellar mainnet — real bets, real payouts", status: "done" },
  { date: "Q3 2026", title: "Token Utility", desc: "PULSE staking, governance, rewards tiers", status: "current" },
  { date: "Q4 2026", title: "Scale", desc: "Mobile app, market categories, cross-chain", status: "upcoming" },
  { date: "2027", title: "Ecosystem", desc: "User-created markets, oracle resolution, partner integrations", status: "upcoming" },
] as const;

/* ─────────────────── Page Component ─────────────────── */

export default function HomePage() {
  return (
    <div>
      {/* ━━━ Section 1: Hero ━━━ */}
      <section className="relative overflow-hidden pt-20 pb-24 sm:pt-28 sm:pb-32">
        {/* Glow bg effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-primary-500/5 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-4 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-500/10 border border-primary-500/20 text-sm text-primary-400 mb-6">
            <span className="w-2 h-2 rounded-full bg-accent-mint animate-pulse" />
            Live on Stellar Mainnet | Low 2% fee
          </div>

          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-5">
            Predict. Win or Lose —{" "}
            <span className="text-gradient">You Always Earn.</span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto mb-8">
            Decentralized prediction market on Stellar. Near-zero fees. 5-second finality.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link href="/markets" className="btn-primary text-base px-8 py-3 inline-flex items-center gap-2">
              Explore Markets <FiArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/leaderboard" className="btn-secondary text-base px-8 py-3">
              View Leaderboard
            </Link>
          </div>

          {/* Live Stats */}
          <ErrorBoundary fallbackTitle="Stats unavailable">
            <LiveStats />
          </ErrorBoundary>
        </div>
      </section>

      {/* ━━━ Section 2: Feature Cards ━━━ */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="card group hover:border-primary-500/30 transition-colors"
            >
              <div className="w-11 h-11 rounded-xl bg-primary-500/10 flex items-center justify-center mb-4 group-hover:bg-primary-500/20 transition-colors">
                <f.icon className="w-5 h-5 text-primary-400" />
              </div>
              <h3 className="font-heading font-semibold text-lg mb-1">{f.title}</h3>
              <p className="text-sm text-slate-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ Section 3: How It Works ━━━ */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <h2 className="font-heading text-3xl font-bold text-center mb-3">
          How It Works
        </h2>
        <p className="text-slate-400 text-center mb-10 max-w-lg mx-auto">
          From wallet to winnings in 4 simple steps
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {STEPS.map((s) => (
            <div key={s.num} className="card relative overflow-hidden group">
              <span className="absolute top-4 right-4 text-5xl font-heading font-bold text-primary-500/10">
                {s.num}
              </span>
              <div className="relative">
                <h3 className="font-heading font-semibold text-lg mb-2">
                  {s.title}
                </h3>
                <p className="text-sm text-slate-400">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ Section 4: Featured Markets ━━━ */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-heading text-3xl font-bold">Featured Markets</h2>
            <p className="text-slate-400 mt-1">Top markets by volume</p>
          </div>
          <Link
            href="/markets"
            className="btn-secondary text-sm inline-flex items-center gap-2"
          >
            View All <FiArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <ErrorBoundary fallbackTitle="Featured markets unavailable">
          <FeaturedMarkets />
        </ErrorBoundary>
      </section>

      {/* ━━━ Section 5: Leaderboard Preview ━━━ */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-heading text-3xl font-bold">Top Predictors</h2>
            <p className="text-slate-400 mt-1">Hall of fame</p>
          </div>
          <Link
            href="/leaderboard"
            className="btn-secondary text-sm inline-flex items-center gap-2"
          >
            View All <FiArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <ErrorBoundary fallbackTitle="Leaderboard unavailable">
          <LeaderboardPreview />
        </ErrorBoundary>
      </section>

      {/* ━━━ Section 6: Additional Features Grid ━━━ */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <h2 className="font-heading text-3xl font-bold text-center mb-3">
          Built for Predictors
        </h2>
        <p className="text-slate-400 text-center mb-10 max-w-lg mx-auto">
          Everything you need to predict, earn, and share
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {EXTRA_FEATURES.map((f) => (
            <div key={f.title} className="card group hover:border-primary-500/20 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-surface-hover flex items-center justify-center mb-3 group-hover:bg-primary-500/10 transition-colors">
                <f.icon className="w-5 h-5 text-slate-400 group-hover:text-primary-400 transition-colors" />
              </div>
              <h3 className="font-heading font-semibold mb-1">{f.title}</h3>
              <p className="text-sm text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ━━━ Section 7: Roadmap ━━━ */}
      <section className="max-w-3xl mx-auto px-4 pb-20">
        <h2 className="font-heading text-3xl font-bold text-center mb-10">
          Roadmap
        </h2>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-surface-border" />
          <div className="space-y-8">
            {ROADMAP.map((r, i) => (
              <div key={r.date} className="relative flex gap-5">
                <div className="relative z-10">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
                      r.status === "done"
                        ? "bg-accent-mint/15 border border-accent-mint/40 text-accent-mint"
                        : r.status === "current"
                        ? "bg-primary-600 text-white ring-4 ring-primary-500/20"
                        : "bg-surface-card border border-surface-border text-slate-500"
                    }`}
                  >
                    {r.status === "done" ? <FiCheck className="w-4 h-4" /> : i + 1}
                  </div>
                </div>
                <div className="pt-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-primary-400 font-medium">{r.date}</span>
                    {r.status === "current" && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-500/10 text-[10px] font-semibold uppercase tracking-wide text-primary-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-mint animate-pulse" />
                        In Progress
                      </span>
                    )}
                    {r.status === "done" && (
                      <span className="px-2 py-0.5 rounded-full bg-accent-mint/10 text-[10px] font-semibold uppercase tracking-wide text-accent-mint">
                        Shipped
                      </span>
                    )}
                  </div>
                  <h3 className="font-heading font-semibold text-lg">{r.title}</h3>
                  <p className="text-sm text-slate-400 mt-0.5">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━ Section 8: CTA Footer ━━━ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-primary-600/10 to-transparent pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-4 py-20 text-center">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold mb-4">
            Start Predicting Today
          </h2>
          <p className="text-slate-400 mb-8 max-w-md mx-auto">
            No signup required. Just connect and bet.
          </p>
          <Link
            href="/markets"
            className="btn-primary text-base px-8 py-3 inline-flex items-center gap-2"
          >
            Explore Markets <FiArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}

