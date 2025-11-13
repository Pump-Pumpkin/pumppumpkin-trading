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

        <header className="relative z-10 flex flex-col md:flex-row items-center justify-between px-6 md:px-12 py-6">
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
              <p className="text-lg font-semibold">Memecoin Pro Desk</p>
            </div>
          </div>

          <nav className="mt-6 md:mt-0 flex flex-wrap items-center gap-6 text-sm text-gray-300">
            <a href="#features" className="hover:text-white transition-colors">
              Why Pump Pumpkin
            </a>
            <a href="#rewards" className="hover:text-white transition-colors">
              Rewards
            </a>
            <a href="#infrastructure" className="hover:text-white transition-colors">
              Infrastructure
            </a>
            <a href="https://docs.google.com/document/d/1aRZkctIHg7PqQ3G4PEFXn8abbMnmBHn2TmnYB97xZ4w/edit?usp=sharing" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
              Docs
            </a>
            <Link
              to="/trading"
              className="bg-blue-500 text-black font-semibold px-5 py-2 rounded-lg shadow-lg shadow-blue-500/20 hover:bg-blue-400 transition-colors"
            >
              Enter Trading
            </Link>
          </nav>
        </header>

        <section className="relative z-10 px-6 md:px-12 py-16 md:py-24">
          <div className="max-w-5xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/40 bg-blue-900/20 text-blue-200 uppercase tracking-[0.3em] text-xs mb-6">
              Built for pump.fun hunters
            </div>
            <h1 className="text-4xl md:text-6xl font-semibold leading-tight mb-6">
              Trade the waves. Catch the pumps. Earn like a pro.
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-3xl mb-4">
              The fastest way to trade Solana memecoin momentum — built for degens who move before the crowd.
            </p>
            <p className="text-lg md:text-xl text-gray-300 max-w-3xl mb-4">
              Deposit once, trade everything, and keep stacking PPA rewards for fueling liquidity back into the ecosystem.
            </p>
            <p className="text-lg md:text-xl text-gray-300 max-w-3xl mb-8">
              Purpose-built tooling, real-time feeds, and verified deposits keep your trades lightning-fast and your rewards legit.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/trading"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-blue-500 hover:bg-blue-400 text-black font-semibold rounded-xl transition-colors shadow-lg shadow-blue-500/20"
              >
                <Zap className="w-5 h-5" />
                Trade Now
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 px-8 py-3 border border-white/20 hover:border-blue-400 hover:text-blue-300 rounded-xl font-semibold transition-colors"
              >
                Explore Features
              </a>
            </div>
          </div>

          <div className="mt-16">
            <h2 className="text-sm uppercase tracking-[0.4em] text-gray-400 mb-6">
              Platform Highlights
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
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
        className="px-6 md:px-12 py-16 md:py-24 bg-gradient-to-b from-black via-slate-950 to-black"
      >
        <div className="max-w-5xl mx-auto text-center mb-14">
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

        <div className="grid gap-6 md:grid-cols-2">
          {features.map(({ title, description, icon: Icon }) => (
            <div
              key={title}
              className="border border-white/10 bg-white/5 rounded-3xl p-8 text-left flex flex-col gap-4 hover:border-blue-500/40 transition-colors"
            >
              <div className="h-12 w-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
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
        className="px-6 md:px-12 py-16 md:py-24 bg-gradient-to-r from-blue-900/20 via-black to-blue-900/20"
      >
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-blue-500/40 bg-blue-900/10 text-blue-200 uppercase tracking-[0.25em] text-xs mb-4">
                PPA Liquidity Loop
              </div>
              <h2 className="text-3xl md:text-4xl font-semibold mb-4">
                Lock. Boost. Earn. Repeat.
              </h2>
              <p className="text-gray-300 text-lg mb-6">
                Commit your PPA to the reward vault for 7–30 days and earn SOL + PPA rewards every month.
              </p>
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-300 mt-0.5" />
                  <span>Get priority access to new trading features, boosted leverage tiers, and exclusive early signals.</span>
                </li>
                <li className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-blue-300 mt-0.5" />
                  <span>Anti-fake deposit validation ensures rewards stay real.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Gauge className="w-5 h-5 text-blue-300 mt-0.5" />
                  <span>Live earnings tracking built right into your balance dashboard.</span>
                </li>
                <li className="flex items-start gap-3">
                  <LineChart className="w-5 h-5 text-blue-300 mt-0.5" />
                  <span>Tiered boosts for longer lock durations.</span>
                </li>
              </ul>
            </div>

            <div className="border border-blue-500/30 bg-blue-900/10 rounded-3xl p-8 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">
                    Current Cycle
                  </p>
                  <p className="text-3xl font-semibold text-blue-300">
                    28.4% APY
                  </p>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center">
                  <Globe2 className="w-6 h-6 text-blue-200" />
                </div>
              </div>
              <div className="space-y-6">
                <div className="rounded-2xl border border-white/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-gray-400 mb-2">
                    Liquidity Locked
                  </p>
                  <p className="text-2xl font-semibold text-white">1,592,420 PPA</p>
                  <p className="text-sm text-gray-500">
                    Updated hourly from Supabase vault stats.
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 p-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-gray-400 mb-2">
                    Next Unlock Window
                  </p>
                  <p className="text-2xl font-semibold text-white">In 3 days</p>
                  <p className="text-sm text-gray-500">
                    Queued unlock requests process automatically.
                  </p>
                </div>
              </div>
              <Link
                to="/trading"
                className="mt-8 inline-flex items-center justify-center gap-2 w-full px-6 py-3 bg-blue-500 hover:bg-blue-400 text-black font-semibold rounded-xl transition-colors"
              >
                Start Locking PPA
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Infrastructure */}
      <section
        id="infrastructure"
        className="px-6 md:px-12 py-16 md:py-24 bg-black"
      >
        <div className="max-w-5xl mx-auto text-center mb-12">
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

        <div className="grid md:grid-cols-3 gap-6">
          <div className="border border-white/10 rounded-3xl p-8 bg-white/5 text-left hover:border-blue-500/30 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-blue-200" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Live Market Streams</h3>
            <p className="text-sm text-gray-300">
              Curated pump.fun signals & overlay charts updated every second.
            </p>
          </div>

          <div className="border border-white/10 rounded-3xl p-8 bg-white/5 text-left hover:border-blue-500/30 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center mb-4">
              <Shield className="w-5 h-5 text-blue-200" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Verified Deposits</h3>
            <p className="text-sm text-gray-300">
              Python-based service validates every SOL transfer before crediting rewards.
            </p>
          </div>

          <div className="border border-white/10 rounded-3xl p-8 bg-white/5 text-left hover:border-blue-500/30 transition-colors">
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

