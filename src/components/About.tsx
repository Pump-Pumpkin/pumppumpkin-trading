import { useEffect } from "react";
import {
  Zap,
  Shield,
  Users,
  Rocket,
  Globe,
  CheckCircle,
  Eye,
  Layers,
  Linkedin,
  Twitter,
  CheckCircle2,
  TrendingUp,
  Send,
} from "lucide-react";
import yonatanbadash from "../assets/yonatanbadash.png";

const About: React.FC = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-lg mx-auto px-4 pb-20">
        <div className="text-center py-8 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-900/20 via-transparent to-transparent rounded-3xl blur-3xl"></div>

          <div className="relative">
            <div className="w-24 h-24 mx-auto mb-6 relative">
              <img
                src="https://i.imgur.com/fWVz5td.png"
                alt="Pump Pumpkin Icon"
                className="w-full h-full object-cover rounded-2xl relative z-10 shadow-2xl"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl opacity-30 blur-lg animate-pulse"></div>
            </div>

            <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-white via-blue-100 to-white bg-clip-text text-transparent">
              Pump Pumpkin
            </h2>
            <p className="text-gray-300 text-base mb-2">
              Professional DeFi Trading Platform
            </p>
            <div className="flex items-center justify-center space-x-2 text-sm">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-green-400 font-medium">Live on Solana</span>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <div className="text-center mb-8">
            <div className="flex md:flex-row flex-col items-center justify-center mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center md:mr-3 mb-3 md:mb-0">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white">
                How to Use the Platform
              </h3>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto">
              Professional DeFi trading tools designed for mobile-first
              experience
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border border-gray-700/50 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  01
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-semibold text-base mb-2">
                    Connect Your Wallet
                  </h4>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    Securely connect your Solana wallet with enterprise-grade
                    security protocols. Your private keys remain completely
                    secure.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center space-x-1 bg-gray-800/50 rounded-lg px-2 py-1">
                      <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                      <span className="text-xs text-gray-400">
                        Bank-level security
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 bg-gray-800/50 rounded-lg px-2 py-1">
                      <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                      <span className="text-xs text-gray-400">
                        Guest mode available
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border border-gray-700/50 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  02
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-semibold text-base mb-2">
                    Advanced Trading Features
                  </h4>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    Execute sophisticated strategies with up to 100x leverage.
                    Intelligent risk management protects your capital.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center space-x-1 bg-gray-800/50 rounded-lg px-2 py-1">
                      <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                      <span className="text-xs text-gray-400">
                        Up to 100x leverage
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 bg-gray-800/50 rounded-lg px-2 py-1">
                      <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                      <span className="text-xs text-gray-400">
                        Smart risk controls
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border border-gray-700/50 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                  03
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-white font-semibold text-base mb-2">
                    Degen Memecoin Trading
                  </h4>
                  <p className="text-gray-300 text-sm leading-relaxed mb-3">
                    Trade any memecoin above 80k market cap with up to 100x
                    leverage. YOLO into the next moonshot with maximum risk,
                    maximum reward.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center space-x-1 bg-gray-800/50 rounded-lg px-2 py-1">
                      <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                      <span className="text-xs text-gray-400">
                        Max leverage trading
                      </span>
                    </div>
                    <div className="flex items-center space-x-1 bg-gray-800/50 rounded-lg px-2 py-1">
                      <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0" />
                      <span className="text-xs text-gray-400">
                        Full degen mode
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <div className="text-center mb-8">
              <div className="flex md:flex-row flex-col items-center justify-center mb-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center md:mr-3 mb-3 md:mb-0">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white">
                  Why Choose Pump Pumpkin
                </h3>
              </div>
              <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto">
                Professional DeFi trading tools designed for mobile-first
                experience
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h5 className="text-white font-medium text-base mb-1">
                      Enterprise Security
                    </h5>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Bank-level encryption and security protocols protect your
                      assets 24/7
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Zap className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h5 className="text-white font-medium text-base mb-1">
                      Lightning Fast
                    </h5>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Execute trades in milliseconds with our optimized Solana
                      infrastructure
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h5 className="text-white font-medium text-base mb-1">
                      Advanced Analytics
                    </h5>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Professional trading tools with real-time market insights
                      and data
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
                <div className="flex items-start space-x-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <h5 className="text-white font-medium text-base mb-1">
                      99.9% Uptime
                    </h5>
                    <p className="text-gray-400 text-sm leading-relaxed">
                      Reliable platform that's always available when you need to
                      trade
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 bg-gray-900/30 border border-gray-800 rounded-lg p-4">
              <div className="text-center">
                <p className="text-gray-400 text-sm mb-3">
                  Trusted by traders worldwide
                </p>
                <div className="flex justify-center space-x-8">
                  <div>
                    <p className="text-white font-semibold">100x</p>
                    <p className="text-gray-500 text-xs">Max Leverage</p>
                  </div>
                  <div>
                    <p className="text-white font-semibold">24/7</p>
                    <p className="text-gray-500 text-xs">Trading</p>
                  </div>
                  <div>
                    <p className="text-white font-semibold">&lt;1s</p>
                    <p className="text-gray-500 text-xs">Execution</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <div className="text-center mb-8">
            <div className="flex md:flex-row flex-col items-center justify-center mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center md:mr-3 mb-3 md:mb-0">
                <Rocket className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white">Our Vision</h3>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto">
              Empowering users to trade any memecoin above $80K market cap with
              institutional-grade leverage, all from a seamless mobile-first
              DeFi experience.
            </p>
          </div>

          <div className="bg-gradient-to-br from-gray-900/40 to-gray-800/40 border border-gray-700/50 rounded-xl p-6 backdrop-blur-sm">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-600 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Globe className="w-8 h-8 text-white" />
              </div>
              <h4 className="text-white font-bold text-xl mb-3">
                Democratizing Professional DeFi
              </h4>
              <p className="text-gray-300 text-sm leading-relaxed">
                Building the world's most advanced mobile-first DeFi trading
                platform. Our mission is to provide institutional-grade tools to
                every trader, regardless of background or capital size.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                  <Eye className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm mb-1">
                    Transparent Trading
                  </p>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    No hidden fees or market manipulation. Every trade executes
                    with complete transparency on Solana blockchain.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                  <Layers className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm mb-1">
                    Enterprise Infrastructure
                  </p>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    Built on enterprise architecture with 99.9% uptime, advanced
                    risk management, and professional tools.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                  <Users className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm mb-1">
                    Community-Driven
                  </p>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    Every feature shaped by our trading community. We listen,
                    iterate, and deliver what professionals need.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-700/50">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xl font-bold text-blue-400">100x</p>
                  <p className="text-gray-400 text-xs">Max Leverage</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-blue-400">99.9%</p>
                  <p className="text-gray-400 text-xs">Uptime</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-blue-400">1s</p>
                  <p className="text-gray-400 text-xs">Execution</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-10">
          <div className="text-center mb-8">
            <div className="flex md:flex-row flex-col items-center justify-center mb-4">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 flex items-center justify-center md:mr-3 mb-3 md:mb-0">
                <Users className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white">Our Leader</h3>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm mx-auto">
              Visionary leadership driving innovation in DeFi and blockchain
              technology
            </p>
          </div>

          <div className="space-y-4">
            <div className="relative bg-gradient-to-r from-gray-900/40 to-gray-800/40 border border-gray-700/50 rounded-xl p-5 backdrop-blur-sm">
              <div className="flex items-start space-x-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                  <img
                    src={yonatanbadash}
                    alt="CEO Profile"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 pr-2 md:pr-0">
                  <h4 className="text-white font-bold text-lg mb-2">
                    Yonatan Badash
                  </h4>
                  <p className="text-blue-400 text-sm mb-3 font-medium">
                    Chief Executive Officer & Founder
                  </p>
                  <p className="text-gray-300 text-sm leading-relaxed mb-4">
                    Visionary leader with extensive experience in DeFi,
                    blockchain technology, and financial markets. Leading Pump
                    Pumpkin's mission to democratize professional trading tools
                    and make institutional-grade DeFi accessible to everyone.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="bg-gray-800/50 text-gray-300 text-xs px-3 py-1 rounded-full">
                      DeFi Expert
                    </span>
                    <span className="bg-gray-800/50 text-gray-300 text-xs px-3 py-1 rounded-full">
                      Blockchain Pioneer
                    </span>
                    <span className="bg-gray-800/50 text-gray-300 text-xs px-3 py-1 rounded-full">
                      Financial Innovation
                    </span>
                  </div>

                  {/* Mobile social links - shown below content on mobile */}
                  <div className="flex md:hidden justify-center items-center space-x-3 mt-4 pt-4 border-t border-gray-700/30">
                    <a
                      href="https://www.linkedin.com/in/yonatan-badash-a19aa1279"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-gray-800/50 flex items-center justify-center hover:bg-blue-600/20 transition-colors border border-gray-700/50"
                    >
                      <Linkedin className="w-4 h-4 text-gray-400 hover:text-blue-400" />
                    </a>
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href="https://t.me/YonatanBad1"
                      className="w-8 h-8 rounded-lg bg-gray-800/50 flex items-center justify-center hover:bg-blue-600/20 transition-colors border border-gray-700/50"
                    >
                      <Send className="w-4 h-4 text-gray-400 hover:text-blue-400" />
                    </a>
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href="https://x.com/yonatanbadash1"
                      className="w-8 h-8 rounded-lg bg-gray-800/50 flex items-center justify-center hover:bg-blue-500/20 transition-colors border border-gray-700/50"
                    >
                      <Twitter className="w-4 h-4 text-gray-400 hover:text-blue-500" />
                    </a>
                  </div>
                </div>
              </div>

              {/* Desktop social links - absolute positioned on desktop only */}
              <div className="hidden md:flex absolute top-4 right-4 items-center space-x-3">
                <a
                  href="https://www.linkedin.com/in/yonatan-badash-a19aa1279"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-8 h-8 rounded-lg bg-gray-800/50 flex items-center justify-center hover:bg-blue-600/20 transition-colors border border-gray-700/50"
                >
                  <Linkedin className="w-4 h-4 text-gray-400 hover:text-blue-400" />
                </a>
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://t.me/YonatanBad1"
                  className="w-8 h-8 rounded-lg bg-gray-800/50 flex items-center justify-center hover:bg-blue-600/20 transition-colors border border-gray-700/50"
                >
                  <Send className="w-4 h-4 text-gray-400 hover:text-blue-400" />
                </a>
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://x.com/yonatanbadash1"
                  className="w-8 h-8 rounded-lg bg-gray-800/50 flex items-center justify-center hover:bg-blue-500/20 transition-colors border border-gray-700/50"
                >
                  <Twitter className="w-4 h-4 text-gray-400 hover:text-blue-500" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center py-6 border-t border-gray-800/50">
          <div className="mb-3">
            <p className="text-gray-400 text-sm mb-1">Pump Pumpkin</p>
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <p className="text-green-400 text-xs font-medium">
                Live on Solana Mainnet
              </p>
            </div>
          </div>

          <div className="text-xs text-gray-500 space-y-1">
            <p>© 2024 Pump Pumpkin</p>
            <p>Professional DeFi Trading Platform</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default About;
