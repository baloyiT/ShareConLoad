import Link from 'next/link';
import Image from 'next/image';

import { ArrowLeft } from 'lucide-react';
export const metadata = { title: 'Privacy Policy, ShareConLoad' };

function Section({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="text-base font-bold text-gray-900 mb-3">
        {number}. {title}
      </h2>
      <div className="text-sm text-gray-600 leading-relaxed space-y-3">{children}</div>
    </div>
  );
}

function Sub({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="font-semibold text-gray-700 mb-1.5">{number} {title}</p>
      {children}
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 pl-1">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#ff6a00' }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm h-14 flex items-center px-6 sm:px-10 gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image src="/logo1.png" alt="" width={36} height={36} className="h-8 w-auto" />
          <span className="text-lg font-extrabold tracking-tight">
            <span style={{ color: '#0b103a' }}>Share</span>
            <span style={{ color: '#ff6a00' }}>Con</span>
            <span style={{ color: '#0b103a' }}>Load</span>
          </span>
        </Link>
        <div className="flex-1" />
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </Link>
      </nav>

      {/* Hero */}
      <div className="py-10 px-4" style={{ background: 'linear-gradient(135deg, #0b103a 0%, #1a3a6b 100%)' }}>
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#ff6a00' }}>Legal</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Privacy Policy</h1>
          <p className="text-gray-400 text-sm">Effective Date: 09 May 2026 · VEYQON GROUP (Pty) Ltd</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-10">

          <p className="text-sm text-gray-600 leading-relaxed mb-8">
            This Privacy Policy explains how <strong>VEYQON GROUP (Pty) Ltd</strong>, registration number 2026/353683/07
            (&quot;ShareConLoad&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), collects, uses, stores, processes, and protects personal
            information through the ShareConLoad platform and related services. ShareConLoad is committed to protecting
            user privacy in accordance with applicable laws, including the Protection of Personal Information Act, 2013
            (&quot;POPIA&quot;) of South Africa. By accessing or using the Platform, you consent to the practices described in
            this Privacy Policy.
          </p>

          <Section number="1" title="About ShareConLoad">
            <p>ShareConLoad is a digital logistics marketplace platform operated by VEYQON GROUP (Pty) Ltd. The Platform facilitates shipment booking and payment coordination between cargo owners and independent transport operators for international maritime shared-container shipping services.</p>
          </Section>

          <Section number="2" title="Information We Collect">
            <Sub number="2.1" title="Customer Information">
              <Bullets items={['Full names','Company names','Email addresses','Telephone numbers','Billing information','Shipment information','Cargo details','Customs documentation','Import/export documentation','Account credentials','Communication records','Transaction history']} />
            </Sub>
            <Sub number="2.2" title="Operator Information">
              <Bullets items={['Company registration details','Business contact information','Banking details','Tax information','Operational licenses','Permits and certifications','Insurance documentation','Shipment performance information','Compliance records']} />
            </Sub>
            <Sub number="2.3" title="Technical Information">
              <p className="mb-1.5">We may automatically collect technical and usage information, including:</p>
              <Bullets items={['IP addresses','Browser type','Operating system','Device information','Login timestamps','Platform activity','Cookies and session data','Analytics and performance information']} />
            </Sub>
          </Section>

          <Section number="3" title="How We Collect Information">
            <p className="mb-1.5">Information may be collected through:</p>
            <Bullets items={['Account registration','Booking submissions','Payment processing','Customer support interactions','Uploaded documents','Website usage','Cookies and analytics technologies','Communications with Operators and Customers']} />
          </Section>

          <Section number="4" title="How We Use Information">
            <p className="mb-1.5">We use personal information to:</p>
            <Bullets items={['Facilitate shipment bookings','Process payments','Verify users and Operators','Coordinate shipment activities','Communicate operational updates','Manage disputes and claims','Comply with legal obligations','Improve platform functionality','Detect fraud or suspicious activity','Maintain operational security','Provide customer support','Send service-related notifications']} />
            <p className="mt-3">Where users consent, we may also send promotional communications, product updates, and marketing information. Users may opt out of marketing communications at any time.</p>
          </Section>

          <Section number="5" title="Payment Processing">
            <p>Payments are processed through authorized third-party payment providers, including PayStack. ShareConLoad does not store full payment card details directly unless expressly stated otherwise. Payment information may be subject to the privacy and security policies of third-party payment providers.</p>
          </Section>

          <Section number="6" title="Sharing of Information">
            <p className="mb-1.5">We may share information with:</p>
            <Bullets items={['Independent Operators and Carriers','Payment service providers','Customs and regulatory authorities','Logistics and operational partners','Cloud hosting and technology providers','Legal and compliance advisors','Law enforcement or government authorities where legally required']} />
            <p className="mt-3">Information is shared only where reasonably necessary for operational, legal, compliance, or security purposes.</p>
          </Section>

          <Section number="7" title="International Data Transfers">
            <p>Because ShareConLoad operates internationally, personal information may be processed, transferred, or stored outside South Africa through third-party service providers and cloud infrastructure providers. By using the Platform, users consent to such international transfers where necessary for service delivery and operational purposes.</p>
          </Section>

          <Section number="8" title="Data Retention">
            <p className="mb-1.5">ShareConLoad retains personal information only for as long as reasonably necessary to:</p>
            <Bullets items={['Provide services','Comply with legal obligations','Resolve disputes','Enforce agreements','Maintain operational records','Protect legitimate business interests']} />
            <p className="mt-3">Certain information may be retained longer where required by law or regulatory obligations.</p>
          </Section>

          <Section number="9" title="User Rights">
            <p className="mb-1.5">Subject to applicable laws, users may request to:</p>
            <Bullets items={['Access their personal information','Correct inaccurate information','Update account information','Request deletion of personal information where legally permissible','Object to certain processing activities','Withdraw consent where applicable']} />
            <p className="mt-3">Requests may be submitted to: <a href="mailto:support@shareconload.com" className="font-semibold hover:underline" style={{ color: '#ff6a00' }}>support@shareconload.com</a>. ShareConLoad may require reasonable identity verification before processing requests.</p>
          </Section>

          <Section number="10" title="Cookies and Tracking Technologies">
            <p className="mb-1.5">ShareConLoad may use cookies, session tracking, analytics tools, and similar tracking technologies to:</p>
            <Bullets items={['Improve platform performance','Maintain user sessions','Analyze usage patterns','Enhance security','Improve user experience']} />
            <p className="mt-3">Users may disable cookies through browser settings, although some platform functionality may be affected.</p>
          </Section>

          <Section number="11" title="Data Security">
            <p>ShareConLoad implements reasonable technical and organizational security measures to protect personal information against unauthorized access, misuse, loss, disclosure, alteration, and destruction. Despite reasonable safeguards, no internet-based system can be guaranteed completely secure. Users are responsible for maintaining the confidentiality of their account credentials.</p>
          </Section>

          <Section number="12" title="Operator and Third-Party Responsibility">
            <p>Operators and third-party service providers may independently process personal information in connection with shipment execution and operational services. ShareConLoad is not responsible for the privacy practices of independent third parties. Users are encouraged to review third-party privacy policies where applicable.</p>
          </Section>

          <Section number="13" title="Children and Minors">
            <p>The Platform is not intended for individuals under the age of 18 years. ShareConLoad does not knowingly collect personal information from minors. If we become aware that information relating to a minor has been submitted, such information may be removed.</p>
          </Section>

          <Section number="14" title="Legal Disclosures">
            <p className="mb-1.5">ShareConLoad may disclose personal information:</p>
            <Bullets items={['Where required by law','In response to lawful regulatory requests','To protect legal rights','To investigate fraud or unlawful conduct','To protect platform security and operational integrity']} />
          </Section>

          <Section number="15" title="Changes to This Privacy Policy">
            <p>ShareConLoad reserves the right to update or amend this Privacy Policy from time to time. Updated versions become effective upon publication on the Platform. Continued use of the Platform constitutes acceptance of revised policies.</p>
          </Section>

          <Section number="16" title="Contact Information">
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 space-y-1">
              <p className="font-bold text-gray-900">VEYQON GROUP (Pty) Ltd</p>
              <p>Registration Number: 2026/353683/07</p>
              <p>Republic of South Africa</p>
              <p>Website: <a href="https://shareconload.com" className="hover:underline" style={{ color: '#ff6a00' }}>shareconload.com</a></p>
              <p>Email: <a href="mailto:support@shareconload.com" className="hover:underline" style={{ color: '#ff6a00' }}>support@shareconload.com</a></p>
            </div>
          </Section>

        </div>

        <p className="text-center text-xs text-gray-400 mt-6 italic">Share the Load. Connect the World.</p>
      </div>
    </div>
  );
}
