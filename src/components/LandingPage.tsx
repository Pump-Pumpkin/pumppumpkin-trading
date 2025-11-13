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
      "Blazing-fast execution tuned for pump.fun volatility with pro-grade order flow.",
    icon: Rocket,
  },
  {
    title: "Smart Liquidity",
    description:
      "Lock PPA to unlock boosted rewards and power the platform treasury.",
    icon: Wallet,
  },
  {
    title: "Deep Analytics",
    description:
      "Track trending memecoins, portfolio P&L, and live funding in one hub.",
    icon: LineChart,
  },
  {
    title: "Secure By Design",
    description:
      "Server-side verification on every deposit keeps rewards and balances real.",
    icon: Shield,
  },
];

const metrics = [
  { label: "Supported Wallets", value: "12+" },
  { label: "Leverage Available", value: "Up to 5x" },
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
              The fastest way to trade{" "}
              <span className="text-blue-400">memecoin momentum</span>.
            </h1>
            <p className="text-lg md:text-xl text-gray-300 max-w-3xl mb-8">
              Deposit once, trade everything, and keep earning PPA rewards for
              feeding liquidity back into the ecosystem. Purpose-built tooling,
              real-time market feeds, and secure verification let you stay ahead
              of every pump.
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

          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6">
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
        </section>
      </div>

      {/* Features */}
      <section
        id="features"
        className="px-6 md:px-12 py-16 md:py-24 bg-gradient-to-b from-black via-slate-950 to-black"
      >
        <div className="max-w-5xl mx-auto text-center mb-14">
          <p className="uppercase tracking-[0.3em] text-xs text-blue-300 mb-4">
            Full-stack trading environment
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Liquidity, research, and execution in one streamlined flow.
          </h2>
          <p className="text-gray-400 text-lg">
            Built with the same conviction as elite trading desks, tuned for the
            culture of Solana memecoins.
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
                Lock your PPA. Boost the treasury. Earn monthly rewards.
              </h2>
              <p className="text-gray-300 text-lg mb-6">
                Commit your PPA to the reward vault for 7–30 days, earn SOL and
                PPA rewards, and unlock priority access to new product drops.
                Withdrawals are verified server-side to keep the system fair for
                real liquidity providers.
              </p>
              <ul className="space-y-3 text-sm text-gray-300">
                <li className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-blue-300 mt-0.5" />
                  <span>Anti-fake deposit safeguards lock down every reward.</span>
                </li>
                <li className="flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-blue-300 mt-0.5" />
                  <span>Track earnings live alongside your trading balance.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Gauge className="w-5 h-5 text-blue-300 mt-0.5" />
                  <span>Flexible lock windows with tiered boost multipliers.</span>
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
            From signal to settlement
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold mb-4">
            Engineered for real-time Pump Pumpkin throughput.
          </h2>
          <p className="text-gray-400 text-lg">
            Supabase-powered balance verification, Birdeye data feeds, Jupiter
            swap routing, and dedicated Solana RPC clusters keep every click
            responsive.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="border border-white/10 rounded-3xl p-8 bg-white/5 text-left hover:border-blue-500/30 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center mb-4">
              <Zap className="w-5 h-5 text-blue-200" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Live Market Streams</h3>
            <p className="text-sm text-gray-300">
              Birdeye websocket feeds update every second with curated pump.fun
              signals and price action overlays.
            </p>
          </div>

          <div className="border border-white/10 rounded-3xl p-8 bg-white/5 text-left hover:border-blue-500/30 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center mb-4">
              <Shield className="w-5 h-5 text-blue-200" />
            </div>
            <h3 className="text-xl font-semibold mb-3">Verified Deposits</h3>
            <p className="text-sm text-gray-300">
              Python verification service on DigitalOcean validates every SOL
              transfer before rewards or balance credits update.
            </p>
          </div>

          <div className="border border-white/10 rounded-3xl p-8 bg-white/5 text-left hover:border-blue-500/30 transition-colors">
            <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center mb-4">
              <TrendingUp className="w-5 h-5 text-blue-200" />
            </div>
            <h3 className="text-xl font-semibold mb-3">One-click Execution</h3>
            <p className="text-sm text-gray-300">
              Jupiter swap API and Solana priority fee tuning fire orders
              instantly while keeping UI latency sub-300ms.
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

