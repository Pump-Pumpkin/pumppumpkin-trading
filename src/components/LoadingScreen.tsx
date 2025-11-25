import React, { useEffect, useMemo, useState } from "react";

const STATUS_MESSAGES = [
  "Authenticating wallet and secure session",
  "Syncing on-chain balances and trade history",
  "Booting risk engine and liquidation guards",
  "Linking Birdeye + Jupiter price oracles",
  "Arming order router and execution stack",
  "Calibrating leverage, fees, and safety rails",
];

const TELEMETRY = [
  {
    label: "Platform Status",
    value: "Operational",
    helper: "All microservices online",
  },
  {
    label: "Latency Target",
    value: "< 150ms",
    helper: "Mean order placement delay",
  },
  {
    label: "Risk Engine",
    value: "v2.4",
    helper: "Max drawdown + circuit breakers",
  },
  {
    label: "Data Feeds",
    value: "Birdeye + Jupiter",
    helper: "Live price + liquidity",
  },
];

interface LoadingScreenProps {
  walletAddress?: string;
  headline?: string;
  subHeadline?: string;
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({
  walletAddress,
  headline = "Preparing trading terminal",
  subHeadline = "Pump.fun leverage execution environment",
}) => {
  const [statusIndex, setStatusIndex] = useState(0);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches);
    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);
    return () => mediaQuery.removeEventListener("change", updatePreference);
  }, []);

  const cycleDelay = prefersReducedMotion ? 2000 : 1100;

  useEffect(() => {
    const timer = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, cycleDelay);

    return () => clearInterval(timer);
  }, [cycleDelay]);

  const progress = useMemo(() => {
    return (
      ((statusIndex + 1) / STATUS_MESSAGES.length) * 100
    );
  }, [statusIndex]);

  const sessionLabel =
    walletAddress && walletAddress !== "guest"
      ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
      : "Guest session";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#01040f] text-white">
      {/* Ambient gradients */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -left-10 h-96 w-96 rounded-full bg-blue-500/20 blur-[150px]" />
        <div className="absolute top-16 right-0 h-[32rem] w-[32rem] rounded-full bg-purple-600/15 blur-[200px]" />
        <div className="absolute inset-0 opacity-40">
          <div className="h-full w-full bg-[radial-gradient(circle_at_top,_rgba(30,124,250,0.12),_transparent_60%)]" />
        </div>
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-12">
        {/* Logo + rings */}
        <div className="mb-12 flex flex-col items-center text-center space-y-6">
          <div className="relative h-32 w-32">
            <div className="absolute inset-0 rounded-full border border-white/15 animate-pulse-slow" />
            <div
              className="absolute inset-[10%] rounded-full border border-blue-500/40 spin-slower"
              aria-hidden="true"
            />
            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-3xl loading-glow" />
            <div className="relative z-10 h-full w-full overflow-hidden rounded-2xl border border-white/10 shadow-[0_25px_70px_rgba(30,124,250,0.35)]">
              <img
                src="https://i.imgur.com/fWVz5td.png"
                alt="Pump Pumpkin Icon"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.45em] text-blue-200/80">
              Pump Pumpkin
            </p>
            <h1 className="text-3xl font-semibold sm:text-4xl">{headline}</h1>
            <p className="mt-3 text-base text-blue-100/80">{subHeadline}</p>
          </div>
        </div>

        {/* Session + progress */}
        <div className="w-full max-w-xl space-y-4">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.35em] text-white/50">
            <span>{sessionLabel}</span>
            <span>{Math.round(progress)}%</span>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 via-sky-400 to-cyan-400 progress-stripes"
              style={{ width: `${progress}%` }}
            />
          </div>

          <p className="text-sm text-blue-100/80">
            {STATUS_MESSAGES[statusIndex]}
          </p>
        </div>

        {/* Telemetry cards */}
        <div className="mt-12 grid w-full max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
          {TELEMETRY.map((item) => (
            <div
              key={item.label}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-lg"
            >
              <p className="text-[11px] uppercase tracking-[0.35em] text-blue-200/70">
                {item.label}
              </p>
              <p className="mt-2 text-2xl font-semibold text-white">
                {item.value}
              </p>
              <p className="mt-1 text-xs text-white/60">{item.helper}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;

