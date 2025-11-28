import React from "react";
import { Link } from "react-router-dom";
import {
  Rocket,
  Shield,
  Zap,
  Wallet,
  TrendingUp,
  LineChart,
  Gauge,
  Globe2,
} from "lucide-react";

const features = [
  {
    title: "Trade Faster",
    description:
      "Blazing execution optimized for pump.fun volatility with pro-grade routing and sub-300ms latency.",
    icon: Rocket,
  },
  {
    title: "Smart Liquidity",
    description:
      "Lock your PPA earnings to unlock boosted rewards and power the platform treasury — a liquidity loop that keeps the ecosystem pumping.",
    icon: Wallet,
  },
  {
    title: "Deep Analytics",
    description:
      "Track trending tokens, portfolio P&L, and live funding data — all in one dashboard powered by Birdeye and Supabase.",
    icon: LineChart,
  },
  {
    title: "Secure by Design",
    description:
      "Every deposit and reward is server-side verified, ensuring real balances, no spoofed volume, and fair distribution.",
    icon: Shield,
  },
];

const metrics = [
  { label: "Supported Wallets", value: "12+" },
  { label: "Leverage Available", value: "Up to 100x" },
  { label: "Rewards Distributed", value: "1,200+ SOL" },
  { label: "Trending Tokens Indexed", value: "50,000+" },
];

const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Hero */}
      <div className="relative bg-gradient-to-b from-blue-900/40 via-black to-black">
        <div className="absolute inset-0">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top,_#1e7cfa_0%,_transparent_55%)]" />
          <div className="absolute inset-0 opacity-40 bg-[linear-gradient(135deg,_rgba(30,124,250,0.25)_0%,_transparent_60%)]" />
        </div>

        <header className="relative z-10 flex flex-col md:flex-row items-center justify-between px-4 sm:px-6 lg:px-12 py-6 gap-6">
          <div className="flex items-center space-x-3">
            <div className="h-12 w-12 rounded-2xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
              <img
                src="https://i.imgur.com/fWVz5td.png"
                alt="Pump Pumpkin Logo"
                className="h-10 w-10 rounded-xl object-cover"
              />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-blue-300">
                Pump Pumpkin
              </p>
              <p className="text-lg font-semibold">Memecoin Trading Terminal</p>
            </div>
          </div>

          <div className="w-full md:w-auto space-y-3">
            <nav className="hidden md:flex flex-wrap items-center justify-end gap-6 text-sm text-gray-300">
              <a href="#features" className="hover:text-white transition-colors">
                Why Pump Pumpkin
              </a>
              <a href="#rewards" className="hover:text-white transition-colors">
                Rewards
              </a>
              <a href="#infrastructure" className="hover:text-white transition-colors">
                Infrastructure
              </a>
              <a
                href="https://docs.google.com/document/d/1aRZkctIHg7PqQ3G4PEFXn8abbMnmBHn2TmnYB97xZ4w/edit?usp=sharing"
                target="_blank"
                rel="noreferrer"
                className="hover:text-white transition-colors"
              >
                Docs
              </a>
              <Link
                to="/trading"
                className="bg-blue-500 text-black font-semibold px-5 py-2 rounded-lg shadow-lg shadow-blue-500/20 hover:bg-blue-400 transition-colors text-center"
              >
                Enter Trading
              </Link>
            </nav>
          </div>
        </header>

        <section className="relative z-10 px-4 sm:px-6 lg:px-12 pt-10 pb-16 md:py-24">
          <div className="max-w-6xl mx-auto">
            <div className="w-full flex justify-center md:justify-start mb-3">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/40 bg-blue-900/20 text-blue-200 uppercase tracking-[0.3em] text-xs">
                Built for pump.fun hunters
              </div>
            </div>
            <div className="space-y-6 text-center md:text-left">
              <h1 className="text-3xl sm:text-4xl lg:text-6xl font-semibold leading-tight">
                Trade the waves. Catch the pumps. Earn like a pro.
              </h1>
              <div className="space-y-4 text-lg md:text-xl text-gray-300 max-w-3xl mx-auto md:mx-0">
                <p>
                  The fastest way to trade Solana memecoin momentum — built for degens who move before the crowd.
                </p>
                <p>
                  Deposit once, trade everything, and keep stacking PPA rewards for fueling liquidity back into the ecosystem.
                </p>
                <p>
                  Purpose-built tooling, real-time feeds, and verified deposits keep your trades lightning-fast and your rewards legit.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
                <Link
                  to="/trading"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-blue-500 hover:bg-blue-400 text-black font-semibold rounded-xl transition-colors shadow-lg shadow-blue-500/20 w-full sm:w-auto"
                >
                  <Zap className="w-5 h-5" />
                  Trade Now
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3 border border-white/20 hover:border-blue-400 hover:text-blue-300 rounded-xl font-semibold transition-colors w-full sm:w-auto"
                >
                  Explore Features
                </a>
              </div>
            </div>
          </div>

          <div className="mt-16">
            <h2 className="text-sm uppercase tracking-[0.4em] text-gray-400 mb-6 text-center md:text-left">
              Platform Highlights
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6">
              {metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-blue-500/30 bg-blue-900/10 p-6 text-center backdrop-blur-sm"
                >
                  <p className="text-3xl font-semibold text-blue-400 mb-2">
                    {metric.value}
                  </p>
                  <p className="text-xs uppercase tracking-[0.25em] text-gray-400">
                    {metric.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Features */}
      <section
        id="features"
        className="px-4 sm:px-6 lg:px-12 py-16 md:py-24 bg-gradient-to-b from-black via-slate-950 to-black"
      >
        <div className="max-w-6xl mx-auto text-center mb-14">
          <p className="uppercase tracking-[0.3em] text-xs text-blue-300 mb-4">
            The Full-Stack Trading Environment
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Liquidity. Research. Execution.
          </h2>
          <p className="text-gray-400 text-lg">
            All in one seamless flow — built with the precision of an elite trading desk, tuned for the chaos of Solana memecoins.
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid gap-6 sm:gap-8 grid-cols-1 md:grid-cols-2">
          {features.map(({ title, description, icon: Icon }) => (
            <div
              key={title}
              className="border border-white/10 bg-white/5 rounded-3xl p-8 text-center flex flex-col items-center gap-4 hover:border-blue-500/40 transition-colors"
            >
              <div className="h-12 w-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center mx-auto">
                <Icon className="w-6 h-6 text-blue-300" />
              </div>
              <h3 className="text-2xl font-semibold">{title}</h3>
              <p className="text-sm text-gray-300">{description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Rewards */}
      <section
        id="rewards"
        className="px-4 sm:px-6 lg:px-12 py-16 md:py-24 bg-gradient-to-r from-blue-900/25 via-black to-blue-900/25"
      >
        <div className="max-w-6xl mx-auto space-y-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 text-center md:text-left">
            <div>
              <p className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/40 bg-blue-900/20 text-blue-200 uppercase tracking-[0.25em] text-xs mb-3">
                Rewards Engine
              </p>
              <h2 className="text-3xl md:text-4xl font-semibold">
                Lock PPA. Amplify yield. Fuel liquidity.
              </h2>
              <p className="text-gray-300 text-lg mt-3">
                Turn idle PPA into a compounding position. Rewards are sourced from 80% of
                platform profits and streamed back to lockers.
              </p>
            </div>
            <div className="space-y-3 w-full md:w-auto">
              <Link
                to="/trading"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-blue-500 hover:bg-blue-400 text-black font-semibold rounded-2xl transition-colors shadow-lg shadow-blue-500/20 w-full md:w-auto"
              >
                Start Locking
                <Zap className="w-4 h-4" />
              </Link>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
                2 minute setup • cancel anytime
              </p>
            </div>
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8 backdrop-blur-md space-y-6">
              <div className="flex items-center justify-between text-sm text-gray-400 uppercase tracking-[0.3em]">
                <span>Vault telemetry</span>
                <span className="flex items-center gap-2 text-blue-200">
                  <Globe2 className="w-4 h-4" />
                  Live
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-gray-400 mb-1">
                    Liquidity locked
                  </p>
                  <p className="text-3xl font-semibold text-white">70M PPA</p>
                  <p className="text-xs text-gray-500 mt-1">auto-updated hourly</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-gray-400 mb-1">
                    Unlock window
                  </p>
                  <p className="text-3xl font-semibold text-white">3 days</p>
                  <p className="text-xs text-gray-500 mt-1">queued exits process asap</p>
                </div>
              </div>

              <div className="rounded-2xl border border-blue-500/30 bg-blue-900/20 p-5 space-y-2">
                <div className="flex items-center justify-between text-sm text-blue-200">
                  <span>Current cycle</span>
                  <span>80% profit share</span>
                </div>
                <div className="w-full h-2 rounded-full bg-blue-900/40">
                  <div className="h-full w-[80%] rounded-full bg-gradient-to-r from-blue-400 to-cyan-300" />
                </div>
                <p className="text-xs text-blue-100">
                  Rewards stream out as SOL + PPA based on your vault percentage.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">
                    7-day
                  </p>
                  <p className="text-2xl font-semibold text-white mt-1">+10% APR</p>
                </div>
                <div className="rounded-2xl border border-blue-500/40 bg-blue-900/30 p-4 text-center shadow-lg shadow-blue-500/10">
                  <p className="text-xs uppercase tracking-[0.3em] text-blue-200">
                    14-day
                  </p>
                  <p className="text-2xl font-semibold text-blue-100 mt-1">+14% APR</p>
                </div>
                <div className="rounded-2xl border border-white/10 p-4 text-center">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">
                    30-day
                  </p>
                  <p className="text-2xl font-semibold text-white mt-1">+18% APR</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/40 p-6 sm:p-8 space-y-5">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-blue-300" />
                <div>
                  <p className="text-lg font-semibold">Institutional safeguards</p>
                  <p className="text-sm text-gray-400">
                    Each deposit is verified and reconciled before rewards unlock.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <TrendingUp className="w-6 h-6 text-blue-300" />
                <div>
                  <p className="text-lg font-semibold">Anti-wash rewards</p>
                  <p className="text-sm text-gray-400">
                    Fake volume gets filtered out so lockers only split real profits.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Gauge className="w-6 h-6 text-blue-300" />
                <div>
                  <p className="text-lg font-semibold">Live telemetry</p>
                  <p className="text-sm text-gray-400">
                    Your dashboard shows accrued PPA + SOL every few seconds.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <LineChart className="w-6 h-6 text-blue-300" />
                <div>
                  <p className="text-lg font-semibold">Stackable boosts</p>
                  <p className="text-sm text-gray-400">
                    Longer lock + higher PPA stake = multiplicative multipliers.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Infrastructure */}
      <section
        id="infrastructure"
        className="px-4 sm:px-6 lg:px-12 py-16 md:py-24 bg-black"
      >
        <div className="max-w-6xl mx-auto text-center mb-12">
          <p className="uppercase tracking-[0.3em] text-xs text-blue-300 mb-4">
            From Signal to Settlement
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Built for real-time Pump Pumpkin throughput.
          </h2>
          <p className="text-gray-400 text-lg">
            Powered by Supabase verification, Birdeye websockets, Jupiter routing, and dedicated Solana RPC clusters — so every click hits before the next candle moves.
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid gap-6 lg:gap-8 md:grid-cols-3">
          <div className="border border-white/10 rounded-3xl p-8 bg-white/5 text-center hover:border-blue-500/30 transition-colors flex flex-col items-center h-full">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-blue-200" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Live Market Streams</h3>
            <p className="text-sm text-gray-300">
              Curated pump.fun signals & overlay charts updated every second.
            </p>
          </div>

          <div className="border border-white/10 rounded-3xl p-8 bg-white/5 text-center hover:border-blue-500/30 transition-colors flex flex-col items-center h-full">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center mb-4">
              <Shield className="w-5 h-5 text-blue-200" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Verified Deposits</h3>
            <p className="text-sm text-gray-300">
              Python-based service validates every SOL transfer before crediting rewards.
            </p>
          </div>

          <div className="border border-white/10 rounded-3xl p-8 bg-white/5 text-center hover:border-blue-500/30 transition-colors flex flex-col items-center h-full">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center mb-4">
              <TrendingUp className="w-5 h-5 text-blue-200" />
            </div>
            <h3 className="text-xl font-semibold mb-3">One-click Execution</h3>
            <p className="text-sm text-gray-300">
              Jupiter swap API + priority fees = instant trades under 300ms.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-10 bg-black border-t border-white/10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} Pump Pumpkin. Built for memecoin pros.</p>
          <div className="flex items-center gap-6">
            <a
              href="https://x.com/pumppumpkinio"
              target="_blank"
              rel="noreferrer"
              className="hover:text-blue-300 transition-colors"
            >
              Twitter
            </a>
            <a
              href="mailto:support@pumppumpkin.io"
              className="hover:text-blue-300 transition-colors"
            >
              Contact
            </a>
            <Link
              to="/trading"
              className="text-blue-300 hover:text-blue-100 transition-colors font-semibold"
            >
              Launch Terminal
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

