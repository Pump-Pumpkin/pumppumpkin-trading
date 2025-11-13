import React from 'react';
import { ArrowLeft } from 'lucide-react';

interface TermsOfServiceProps {
  onBack: () => void;
}

export default function TermsOfService({ onBack }: TermsOfServiceProps) {
  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header - Larger for mobile */}
        <div className="flex items-center mb-10">
          <button 
            onClick={onBack}
            className="flex items-center text-blue-400 hover:text-blue-300 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 mr-3" />
            <span className="text-lg">Back</span>
          </button>
        </div>

        {/* Terms Content */}
        <div className="prose prose-invert max-w-none">
          <div className="text-center mb-10">
            <img 
              src="https://i.imgur.com/fWVz5td.png" 
              alt="Pump Pumpkin Icon" 
              className="w-24 h-24 object-cover rounded-xl mx-auto mb-6"
            />
            <h1 className="text-4xl font-bold">TERMS OF SERVICE</h1>
          </div>
          
          <div className="space-y-8 text-gray-300 leading-relaxed text-base">
            <section>
              <h2 className="text-2xl font-semibold text-white mb-5">1. ACCEPTANCE OF TERMS</h2>
              <p>
                These Terms of Service ("Terms") constitute a legally binding agreement between you ("User", "you", or "your") and Pump Pumpkin ("Company", "we", "us", or "our") regarding your use of the Pump Pumpkin platform, website, and related services (collectively, the "Service"). By accessing, browsing, or using our Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and all applicable laws and regulations. If you do not agree with any part of these Terms, you must not use our Service.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-5">2. DESCRIPTION OF SERVICE</h2>
              <p>
                Pump Pumpkin provides a decentralized trading platform that enables users to engage in leveraged trading of digital assets, specifically tokens created on the Pump.fun platform. The Service allows users to open leveraged positions with various multipliers, subject to market conditions and platform limitations. The Company acts solely as a technology provider and does not provide investment advice, financial planning services, or recommendations regarding specific trading strategies.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-5">3. FEES AND CHARGES</h2>
              <p>
                The Company charges a single flat fee of twenty percent (20%) on ANY amount returned to users when closing trading positions. This fee applies to ALL position closures that return money to your account, whether the position is profitable or results in a loss. The fee is calculated on the total return amount (remaining collateral plus any profits or minus any losses) and is automatically deducted before crediting funds to your account. No fees are charged when opening positions - users only pay the required collateral amount.
              </p>
              <p>
                Examples: (1) Profitable trade: You deposit 1 SOL, make 0.5 SOL profit, total return is 1.5 SOL, platform fee is 0.3 SOL (20%), you receive 1.2 SOL. (2) Losing trade: You deposit 1 SOL, lose 0.4 SOL, total return is 0.6 SOL, platform fee is 0.12 SOL (20%), you receive 0.48 SOL. (3) Complete liquidation: You lose 100% of collateral, no return amount, no fee charged. This fee structure applies universally to all position closures.
              </p>
              <p>
                All fees are clearly disclosed on the platform interface prior to trade execution. Fee structures may be modified at the Company's sole discretion with thirty (30) days written notice to users. Users are responsible for understanding all applicable fees before executing trades. Fees are non-refundable except in cases of documented system errors or technical malfunctions directly attributable to the Company's platform.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-5">4. ELIGIBILITY AND ACCOUNT REGISTRATION</h2>
              <p>
                To use our Service, you must be at least 18 years of age and have the legal capacity to enter into binding agreements in your jurisdiction. You represent and warrant that all information provided during account registration is accurate, complete, and current. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to immediately notify us of any unauthorized use of your account or any other breach of security.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-white mb-5">5. RISK DISCLOSURE AND ACKNOWLEDGMENT</h2>
              <p>
                Trading in digital assets, particularly with leverage, involves substantial risk of loss and is not suitable for all investors. The value of digital assets can be extremely volatile and unpredictable. Leveraged trading amplifies both potential gains and losses, and you may lose more than your initial investment. Past performance is not indicative of future results. You acknowledge and agree that you understand these risks and that you are solely responsible for determining whether leveraged trading is appropriate for your financial situation and risk tolerance.
              </p>
              <p>
                You further acknowledge that digital assets are subject to various risks including but not limited to: market volatility, liquidity risks, technology risks, regulatory risks, and operational risks. The Company makes no representations or warranties regarding the future performance of any digital assets or trading strategies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">6. PROHIBITED ACTIVITIES</h2>
              <p>
                You agree not to engage in any of the following prohibited activities: (a) violating any applicable laws, regulations, or third-party rights; (b) engaging in market manipulation, including but not limited to wash trading, spoofing, or layering; (c) using automated trading systems or bots without prior written consent; (d) attempting to gain unauthorized access to our systems or other users' accounts; (e) transmitting viruses, malware, or other harmful code; (f) engaging in money laundering or terrorist financing activities; (g) providing false or misleading information; (h) using our Service for any unlawful purpose.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">7. TRADING TERMS AND CONDITIONS</h2>
              <p>
                All trades executed through our platform are final and irreversible once confirmed on the blockchain. The Company reserves the right to set minimum and maximum position sizes, leverage limits, and other trading parameters at its sole discretion. Margin requirements may change without prior notice based on market conditions and risk management considerations. Positions may be automatically liquidated if margin requirements are not met. You are responsible for monitoring your positions and maintaining adequate margin at all times.
              </p>
              <p>
                Trading fees, funding rates, and other charges will be clearly disclosed on the platform and may be subject to change with reasonable notice. You agree to pay all applicable fees and charges associated with your use of the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">8. INTELLECTUAL PROPERTY RIGHTS</h2>
              <p>
                The Service and all content, features, and functionality thereof are owned by the Company or its licensors and are protected by copyright, trademark, patent, trade secret, and other intellectual property laws. You are granted a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your personal, non-commercial use, subject to these Terms. You may not reproduce, distribute, modify, create derivative works of, publicly display, publicly perform, republish, download, store, or transmit any of the material on our Service without prior written consent.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">9. PRIVACY AND DATA PROTECTION</h2>
              <p>
                Your privacy is important to us. Our collection, use, and disclosure of personal information is governed by our Privacy Policy, which is incorporated into these Terms by reference. By using our Service, you consent to the collection, use, and disclosure of your personal information in accordance with our Privacy Policy. We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">10. DISCLAIMERS AND LIMITATION OF LIABILITY</h2>
              <p>
                THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR COURSE OF PERFORMANCE. THE COMPANY DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
              </p>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE COMPANY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OF THE SERVICE, REGARDLESS OF THE THEORY OF LIABILITY AND EVEN IF THE COMPANY HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">11. INDEMNIFICATION</h2>
              <p>
                You agree to defend, indemnify, and hold harmless the Company and its officers, directors, employees, agents, and affiliates from and against any and all claims, damages, obligations, losses, liabilities, costs, and expenses (including but not limited to attorney's fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any third-party rights, including without limitation any copyright, property, or privacy right; or (d) any claim that your use of the Service caused damage to a third party.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">12. TERMINATION</h2>
              <p>
                These Terms shall remain in full force and effect while you use the Service. We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach these Terms. Upon termination, your right to use the Service will cease immediately. All provisions of these Terms which by their nature should survive termination shall survive termination, including without limitation ownership provisions, warranty disclaimers, indemnity, and limitations of liability.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">13. GOVERNING LAW AND DISPUTE RESOLUTION</h2>
              <p>
                These Terms shall be governed by and construed in accordance with the laws of [Jurisdiction], without regard to its conflict of law provisions. Any dispute arising out of or relating to these Terms or the Service shall be resolved through binding arbitration in accordance with the rules of [Arbitration Organization]. The arbitration shall be conducted in [Location], and the language of the arbitration shall be English. The arbitrator's award shall be final and binding and may be entered as a judgment in any court of competent jurisdiction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">14. MODIFICATIONS TO TERMS</h2>
              <p>
                We reserve the right to modify these Terms at any time in our sole discretion. If we make material changes to these Terms, we will notify you by posting the updated Terms on our website and updating the "Last Updated" date. Your continued use of the Service after such modifications constitutes your acceptance of the updated Terms. If you do not agree to the modified Terms, you must stop using the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">15. SEVERABILITY</h2>
              <p>
                If any provision of these Terms is held to be invalid, illegal, or unenforceable, the validity, legality, and enforceability of the remaining provisions shall not in any way be affected or impaired thereby. In such case, the invalid, illegal, or unenforceable provision shall be replaced with a valid, legal, and enforceable provision that most closely reflects the original intent of the parties.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">16. ENTIRE AGREEMENT</h2>
              <p>
                These Terms, together with our Privacy Policy and any other legal notices published by us on the Service, constitute the entire agreement between you and the Company concerning the Service. These Terms supersede all prior or contemporaneous communications and proposals, whether electronic, oral, or written, between you and the Company with respect to the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-white mb-4">17. CONTACT INFORMATION</h2>
              <p>
                If you have any questions about these Terms, please contact us at legal@pumppumpkin.com. We will make reasonable efforts to respond to your inquiries in a timely manner.
              </p>
            </section>

            <div className="text-center py-8 border-t border-gray-700 mt-8">
              <p className="text-gray-500 text-sm">
                Last Updated: {new Date().toLocaleDateString()}
              </p>
              <p className="text-gray-600 text-xs mt-2">
                © 2024 Pump Pumpkin. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}