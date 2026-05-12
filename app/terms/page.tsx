import Link from 'next/link';
import Image from 'next/image';

export const metadata = { title: 'Terms & Conditions — ShareConLoad' };

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

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 pl-1">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#f97316' }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function DefItem({ term, definition }: { term: string; definition: string }) {
  return (
    <div className="flex gap-3 py-2 border-b border-gray-100 last:border-0">
      <span className="font-semibold text-gray-800 w-40 shrink-0">{term}</span>
      <span className="text-gray-600">{definition}</span>
    </div>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm h-14 flex items-center px-6 sm:px-10 gap-4">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image src="/logo1.png" alt="" width={36} height={36} className="h-8 w-auto" />
          <span className="text-lg font-extrabold tracking-tight">
            <span style={{ color: '#0f2044' }}>Share</span>
            <span style={{ color: '#f97316' }}>Con</span>
            <span style={{ color: '#0f2044' }}>Load</span>
          </span>
        </Link>
        <div className="flex-1" />
        <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Home
        </Link>
      </nav>

      {/* Hero */}
      <div className="py-10 px-4" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#f97316' }}>Legal</p>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Terms &amp; Conditions</h1>
          <p className="text-gray-400 text-sm">Effective Date: 09 May 2026 · VEYQON GROUP (Pty) Ltd</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-10">

          <p className="text-sm text-gray-600 leading-relaxed mb-8">
            These Terms &amp; Conditions (&quot;Terms&quot;) govern the use of the ShareConLoad platform and services operated by{' '}
            <strong>VEYQON GROUP (Pty) Ltd</strong>, registration number 2026/353683/07, a company registered in the
            Republic of South Africa. By accessing or using the Platform, you agree to be bound by these Terms.
          </p>

          <Section number="1" title="Definitions">
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <DefItem term="Customer" definition='Any individual or entity using the Platform to book or request shipment services.' />
              <DefItem term="Operator / Carrier" definition='An independent third-party transport provider offering shipping or logistics capacity through the Platform.' />
              <DefItem term="Booking" definition='A shipment reservation made through the Platform.' />
              <DefItem term="Cargo" definition='Goods, products, or items submitted for transport.' />
              <DefItem term="Deposit" definition='The initial reservation payment required to secure shipment space.' />
              <DefItem term="Service Fee" definition='The non-refundable platform administration and transaction fee charged by ShareConLoad.' />
              <DefItem term="Shipment" definition='The transportation service arranged between a Customer and an Operator through the Platform.' />
              <DefItem term="Platform" definition='The ShareConLoad digital marketplace accessible through shareconload.com.' />
            </div>
          </Section>

          <Section number="2" title="Nature of the Platform">
            <p>ShareConLoad is a digital logistics marketplace platform that facilitates connections between Customers and independent Operators for shared container shipping services.</p>
            <p>ShareConLoad is <strong>NOT</strong> any of the following, unless expressly stated otherwise:</p>
            <Bullets items={['A shipping line','A freight carrier','A customs broker','A warehouse operator','A logistics transporter','A freight forwarding company']} />
            <p>All transport services are performed exclusively by independent third-party Operators. ShareConLoad facilitates shipment bookings, payment processing, booking coordination, and dispute management processes on the Platform.</p>
          </Section>

          <Section number="3" title="Eligibility">
            <p>Users must be legally capable of entering into binding commercial agreements. By using the Platform, the user confirms and warrants that:</p>
            <Bullets items={['All information provided is accurate and complete','They are authorized to transact on behalf of their organization where applicable','They will comply with all applicable laws and regulations']} />
          </Section>

          <Section number="4" title="Account Registration">
            <p>Users may be required to create an account to access certain Platform services. Users are responsible for:</p>
            <Bullets items={['Maintaining account confidentiality','Safeguarding login credentials','All activities conducted through their accounts']} />
            <p>ShareConLoad reserves the right to suspend or terminate accounts suspected of fraud, misuse, unlawful activity, or breach of these Terms.</p>
          </Section>

          <Section number="5" title="Booking Process">
            <p>Shipment bookings are subject to Operator availability and acceptance. A booking becomes provisionally confirmed once the required Deposit is received and booking confirmation is issued by the Platform. Shipment space may be released if payment obligations are not fulfilled within required timelines. ShareConLoad reserves the right to refuse, cancel, or suspend bookings where necessary for operational, legal, or compliance reasons.</p>
          </Section>

          <Section number="6" title="Payment Terms">
            <p>All pricing and settlements are denominated in United States Dollars (USD), unless otherwise specified. Customers are required to pay a 20% reservation Deposit and applicable Service Fees at the time of booking. The remaining balance is due no later than seven (7) days before the scheduled shipment departure.</p>
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800">
              <strong>Important:</strong> Deposits become non-refundable forty-eight (48) hours after booking confirmation. Service Fees are non-refundable in all circumstances.
            </div>
            <p>Failure to pay the remaining balance within required timelines may result in automatic booking cancellation, forfeiture of Deposits, and release of reserved shipment capacity. Payments are processed through authorized third-party payment providers, including PayStack.</p>
          </Section>

          <Section number="7" title="Customer Responsibilities">
            <p>Customers remain solely responsible for:</p>
            <Bullets items={['Providing accurate shipment information','Lawful cargo declarations','Timely payments','Proper packaging and labeling','Customs documentation','Import/export permits','Compliance with all applicable laws and regulations']} />
            <p>Customers must ensure Cargo is shipment-ready before applicable loading or collection deadlines. Customers may not submit prohibited or restricted goods through the Platform.</p>
          </Section>

          <Section number="8" title="Operator Responsibilities">
            <p>Operators remain solely responsible for transport execution, cargo handling, operational compliance, shipment delivery, and applicable regulatory obligations. Operators must maintain all required licenses, permits, registrations, and operational insurance coverage. Operators are independent third parties and are not employees, agents, or representatives of ShareConLoad.</p>
          </Section>

          <Section number="9" title="Prohibited Cargo">
            <p>The following Cargo categories are strictly prohibited on the Platform unless expressly approved in writing by ShareConLoad:</p>
            <Bullets items={['Illegal goods of any nature','Hazardous or explosive materials','Firearms and ammunition','Narcotics and controlled substances','Counterfeit goods','Stolen property','Radioactive materials','Toxic chemicals','Live animals','Human remains','Goods prohibited under applicable import/export laws']} />
            <p>ShareConLoad reserves the right to reject or remove prohibited Cargo at any time without prior notice.</p>
          </Section>

          <Section number="10" title="Cancellations and Refunds">
            <p>Customers may cancel bookings subject to applicable cancellation terms. Deposits become non-refundable after forty-eight (48) hours from the time of booking confirmation.</p>
            <p>Where an Operator fails to perform a confirmed Shipment, ShareConLoad may investigate the matter, attempt reassignment to an alternative Operator, issue refunds, or provide platform credits where commercially appropriate. Refund timelines may vary depending on payment provider processing requirements, banking systems, and dispute investigation outcomes.</p>
          </Section>

          <Section number="11" title="Disputes and Claims">
            <p>Customers must report shipment disputes or claims within seventy-two (72) hours of delivery confirmation. Claims submitted after the stipulated dispute window may not be accepted.</p>
            <p>ShareConLoad reserves the right to request supporting documentation, investigate disputes, suspend payouts pending investigation, and mediate between parties. ShareConLoad&apos;s dispute decisions shall be made reasonably and in good faith, based on available evidence and operational records.</p>
          </Section>

          <Section number="12" title="Platform Rights">
            <p>ShareConLoad reserves the right to:</p>
            <Bullets items={['Suspend or terminate accounts','Cancel bookings','Withhold payouts during active investigations','Replace Operators where feasible','Reject Cargo','Enforce operational or compliance requirements as necessary']} />
          </Section>

          <Section number="13" title="Insurance">
            <p>Operators are responsible for maintaining appropriate operational and cargo liability insurance coverage. Customers are strongly encouraged to obtain independent cargo insurance where necessary. ShareConLoad does not guarantee compensation for Cargo loss, theft, or damage unless expressly agreed otherwise in writing.</p>
          </Section>

          <Section number="14" title="Limitation of Liability">
            <p>ShareConLoad acts solely as a technology marketplace platform facilitating transactions between Customers and Operators. ShareConLoad shall not be liable for:</p>
            <Bullets items={['Shipment or customs delays','Operator failures','Cargo loss or damage','Indirect or consequential losses','Business interruption losses of any nature']} />
            <p>To the maximum extent permitted by applicable law, ShareConLoad&apos;s total liability shall be limited to amounts directly paid to the Platform for the affected Booking.</p>
          </Section>

          <Section number="15" title="Force Majeure">
            <p>ShareConLoad shall not be liable for any delays, failures, or interruptions caused by events beyond its reasonable control, including but not limited to:</p>
            <Bullets items={['Natural disasters','Port congestion','Strikes or industrial action','War or political unrest','Customs actions or government interventions','Cyber incidents','Transportation disruptions']} />
          </Section>

          <Section number="16" title="Intellectual Property">
            <p>All Platform content, branding, systems, logos, and intellectual property remain the exclusive property of VEYQON GROUP (Pty) Ltd, unless otherwise stated. Users may not reproduce, distribute, reverse-engineer, or misuse Platform materials without prior written consent from ShareConLoad.</p>
          </Section>

          <Section number="17" title="Privacy and Data Usage">
            <p>Use of the Platform is subject to ShareConLoad&apos;s{' '}
              <Link href="/privacy" className="font-semibold hover:underline" style={{ color: '#f97316' }}>Privacy Policy</Link>,
              which is incorporated herein by reference. Users consent to the collection and processing of operational and transaction-related information necessary for service delivery and compliance purposes.
            </p>
          </Section>

          <Section number="18" title="Governing Law">
            <p>These Terms shall be governed by and interpreted in accordance with the laws of the Republic of South Africa. Any disputes arising hereunder shall be subject to the jurisdiction of the courts of the Republic of South Africa.</p>
          </Section>

          <Section number="19" title="Dispute Resolution">
            <p>Parties shall first attempt to resolve any disputes through good-faith negotiations within a reasonable timeframe. Where disputes remain unresolved after good-faith negotiations, the parties agree to attempt mediation before initiating formal court proceedings. Nothing in this clause prevents either party from seeking urgent legal relief or interim remedies where necessary.</p>
          </Section>

          <Section number="20" title="Amendments">
            <p>ShareConLoad reserves the right to amend these Terms from time to time at its sole discretion. Updated Terms become effective upon publication on the Platform. Continued use of the Platform following publication of revised Terms constitutes acceptance of those amendments.</p>
          </Section>

          <Section number="21" title="Contact Information">
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 space-y-1">
              <p className="font-bold text-gray-900">VEYQON GROUP (Pty) Ltd</p>
              <p>Registration Number: 2026/353683/07</p>
              <p>Republic of South Africa</p>
              <p>Website: <a href="https://shareconload.com" className="hover:underline" style={{ color: '#f97316' }}>shareconload.com</a></p>
              <p>Email: <a href="mailto:support@shareconload.com" className="hover:underline" style={{ color: '#f97316' }}>support@shareconload.com</a></p>
            </div>
          </Section>

        </div>

        <p className="text-center text-xs text-gray-400 mt-6 italic">Share the Load. Connect the World.</p>
      </div>
    </div>
  );
}
