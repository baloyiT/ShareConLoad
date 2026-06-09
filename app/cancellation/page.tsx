import Link from 'next/link';
import Image from 'next/image';

export const metadata = { title: 'Cancellation & Refund Policy, ShareConLoad' };

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
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#f97316' }} />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-800">
      <strong>Important:</strong> {children}
    </div>
  );
}

export default function CancellationPolicyPage() {
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
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">Cancellation &amp; Refund Policy</h1>
          <p className="text-gray-400 text-sm">Effective Date: 21 May 2026 · VEYQON GROUP (Pty) Ltd</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-10">

          <p className="text-sm text-gray-600 leading-relaxed mb-8">
            This Cancellation &amp; Refund Policy (&quot;Policy&quot;) governs cancellations, refunds, payment reversals, operational
            recovery processes, and related financial matters applicable to bookings made through the ShareConLoad platform
            operated by <strong>VEYQON GROUP (Pty) Ltd</strong>, registration number 2026/353683/07 (&quot;ShareConLoad&quot;,
            &quot;Platform&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). By using the Platform, Customers and Operators agree to this Policy.
            ShareConLoad operates as a digital logistics marketplace connecting Customers with independent Operators and
            logistics service providers. ShareConLoad acts as a coordination platform and operational facilitator and does
            not operate as a direct shipping carrier, financial institution, or escrow custodian.
          </p>

          {/* Section 1 */}
          <Section number="1" title="Customer Cancellations">
            <p>The following table summarises the refund entitlement at each cancellation stage:</p>

            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-gray-50 text-gray-700 font-semibold">
                    <th className="px-4 py-3 w-1/3">Cancellation Stage</th>
                    <th className="px-4 py-3 w-1/4">Deposit Status</th>
                    <th className="px-4 py-3">Refund / Outcome</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-600">
                  <tr>
                    <td className="px-4 py-3">Within 48 hrs of booking</td>
                    <td className="px-4 py-3">20% Deposit</td>
                    <td className="px-4 py-3">May be refunded · Service fees non-refundable</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">After 48 hrs of booking</td>
                    <td className="px-4 py-3">20% Deposit</td>
                    <td className="px-4 py-3">Non-refundable · Service fees non-refundable</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">After 2nd payment (pre-departure)</td>
                    <td className="px-4 py-3">50% payment</td>
                    <td className="px-4 py-3">Partial, subject to review · Deposit &amp; service fees non-refundable</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">After vessel departure</td>
                    <td className="px-4 py-3">All payments</td>
                    <td className="px-4 py-3">Non-refundable · Booking fully non-refundable</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3">After cargo arrival/release</td>
                    <td className="px-4 py-3">All payments</td>
                    <td className="px-4 py-3">Non-refundable · Shipment deemed completed</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <Sub number="1.1" title="Cancellation Within 48 Hours of Booking">
              <p>Customers may cancel a booking within forty-eight (48) hours of booking confirmation. Under such circumstances:</p>
              <Bullets items={['The 20% Deposit may be refunded', 'Platform service fees remain non-refundable']} />
            </Sub>

            <Sub number="1.2" title="Cancellation After 48 Hours of Booking">
              <p>Where a Customer cancels a booking more than forty-eight (48) hours after booking confirmation:</p>
              <Bullets items={['The 20% Deposit shall be fully non-refundable', 'Platform service fees shall remain non-refundable']} />
            </Sub>

            <Sub number="1.3" title="Cancellation After Second-Stage Payment">
              <p>Where the Customer has already completed the second-stage 50% payment and subsequently cancels before vessel departure:</p>
              <Bullets items={[
                'The initial 20% Deposit remains non-refundable',
                'Platform service fees remain non-refundable',
                'Partial refunds of the second-stage payment may be considered subject to operational, administrative, and processing deductions determined by ShareConLoad',
              ]} />
            </Sub>

            <Sub number="1.4" title="Cancellation After Vessel Departure">
              <Warning>Once the Shipment has departed from the origin port, the booking shall become fully non-refundable.</Warning>
            </Sub>

            <Sub number="1.5" title="Cancellation After Cargo Arrival or Release">
              <p>No refunds shall apply after:</p>
              <Bullets items={['Cargo arrival at destination', 'Cargo release authorization', 'Cargo collection by the consignee or authorized party']} />
              <p className="mt-2">
                Cargo Release Authorization includes release confirmation issued to the consignee, cargo collection approval,
                release documentation issued by the Operator, port, warehouse, or authorized logistics representative, or any
                instruction authorizing cargo handover or collection. Once cargo release authorization has been issued, the
                Shipment shall be regarded as operationally completed for refund purposes.
              </p>
              <p>
                Cargo shall be regarded as collected where the consignee, customer, clearing agent, transporter, or any
                authorized representative has taken possession, custody, or control of the cargo at the destination point.
                This includes physical collection, warehouse release, port release, container pickup, or transfer to onward
                transportation arranged by the consignee or customer. Following cargo collection or transfer of possession,
                the booking and Shipment shall be deemed completed and non-refundable.
              </p>
            </Sub>
          </Section>

          {/* Section 2 */}
          <Section number="2" title="Operator Cancellation & Non-Performance">
            <Sub number="2.1" title="Operator Cancellation Before Departure">
              <p>Operators may not unreasonably cancel confirmed Shipments after accepting a booking through the Platform. Where an Operator cancels a confirmed Shipment before vessel departure, ShareConLoad reserves the right to:</p>
              <Bullets items={[
                'Investigate the cancellation',
                'Suspend or withhold pending payouts',
                'Attempt reassignment to an alternative Operator',
                'Issue refunds or platform credits where applicable',
                'Apply operational penalties against the Operator',
              ]} />
            </Sub>

            <Sub number="2.2" title="Operator Failure to Load Cargo">
              <p>Where an Operator fails to load Cargo for a confirmed Shipment, ShareConLoad may:</p>
              <Bullets items={[
                'Investigate the operational failure',
                'Request supporting shipment documentation or evidence',
                'Attempt reassignment to an alternative Operator where commercially feasible',
                'Suspend related payouts',
                'Determine appropriate operational resolution measures',
              ]} />
              <p className="mt-2">Where reassignment is not reasonably possible, ShareConLoad may issue a refund, issue platform credits, or cancel the affected booking.</p>
            </Sub>

            <Sub number="2.3" title="Shipment Delays and Service Disruptions">
              <p>International shipping operations may be affected by port congestion, customs delays, weather conditions, vessel scheduling changes, transportation disruptions, or other operational circumstances.</p>
              <Warning>Shipment delays shall not automatically entitle Customers to compensation, refunds, credits, or payout adjustments.</Warning>
            </Sub>

            <Sub number="2.4" title="Platform Investigation Process">
              <p>Where operational disputes, shipment failures, or cancellation incidents arise, ShareConLoad may conduct an investigation which may include:</p>
              <Bullets items={[
                'Review of shipment records and booking information',
                'Review of operational communications',
                'Review of customs or port documentation',
                'Collection of supporting evidence from Customers or Operators',
                'Operational assessment of the incident circumstances',
              ]} />
              <p className="mt-2">Operators and Customers agree to cooperate reasonably with investigation processes.</p>
            </Sub>

            <Sub number="2.5" title="Replacement Operator Process">
              <p>Where operationally feasible, ShareConLoad may attempt to arrange an alternative Operator to complete the Shipment. Replacement arrangements may be subject to:</p>
              <Bullets items={[
                'Operator availability',
                'Revised shipment schedules',
                'Updated pricing',
                'Operational constraints',
                'Applicable port or customs requirements',
              ]} />
              <p className="mt-2">ShareConLoad does not guarantee replacement Operator availability. Booking confirmation does not constitute an absolute guarantee of vessel space availability where operational, regulatory, or capacity constraints arise.</p>
            </Sub>

            <Sub number="2.6" title="Refund & Recovery Process Resulting from Operator Failure">
              <p>Where Operator non-performance materially prevents Shipment completion, ShareConLoad may initiate the following operational review and resolution process:</p>
              <div className="space-y-3 mt-2">
                {[
                  { step: 'Step 1', label: 'Investigation', items: ['Review of shipment records and booking information', 'Review of operational communications', 'Review of supporting documentation', 'Assessment of applicable shipment circumstances'] },
                  { step: 'Step 2', label: 'Operational Resolution Attempt', items: ['Arrange a replacement Operator', 'Coordinate revised shipment scheduling', 'Arrange alternative routing', 'Implement other reasonable operational recovery measures'] },
                  { step: 'Step 3', label: 'Recovery Coordination', items: ['Where a refund is determined to be appropriate, ShareConLoad may coordinate recovery of applicable amounts from the responsible Operator where applicable'] },
                  { step: 'Step 4', label: 'Refund Determination', items: ['Recovered funds and available reserves', 'Applicable liabilities and operational findings', 'Third-party costs already incurred', 'Applicable Platform fees'] },
                ].map(({ step, label, items }) => (
                  <div key={step} className="border border-gray-100 rounded-xl p-4">
                    <p className="font-semibold text-gray-700 mb-2"><span style={{ color: '#f97316' }}>{step}</span>, {label}</p>
                    <Bullets items={items} />
                  </div>
                ))}
              </div>
              <Warning>ShareConLoad does not guarantee immediate or full refunds in all operational failure scenarios.</Warning>
            </Sub>

            <Sub number="2.7" title="Operator Penalties">
              <p>Where Operators repeatedly fail to fulfill confirmed Shipments or materially breach Platform obligations, ShareConLoad may apply operational penalties including:</p>
              <Bullets items={[
                'Warning notices',
                'Trust-score reductions',
                'Reduced marketplace visibility',
                'Payout withholding',
                'Temporary suspension',
                'Permanent removal from the Platform',
              ]} />
              <p className="mt-2">ShareConLoad reserves the right to determine penalties based on the severity, frequency, and operational impact of the incident.</p>
            </Sub>

            <Sub number="2.8" title="Fraudulent or Serious Operational Misconduct">
              <p>Where ShareConLoad reasonably suspects fraudulent activity, falsified shipment information, deceptive conduct, unauthorized cargo handling, misuse of customer information, or unlawful operational activity, ShareConLoad may:</p>
              <Bullets items={[
                'Immediately suspend the Operator account',
                'Freeze related payouts',
                'Terminate Platform access',
                'Report unlawful conduct to relevant authorities where required',
                'Pursue lawful recovery of operational losses where applicable',
              ]} />
            </Sub>
          </Section>

          {/* Section 3 */}
          <Section number="3" title="Refund Coordination & Payment Resolution">
            <Sub number="3.1" title="Refund Coordination Method">
              <p>Where a refund is determined to be applicable, ShareConLoad may coordinate or facilitate refund resolution through one or more of the following methods:</p>
              <Bullets items={[
                'The original payment method used for the transaction',
                'Platform credits where agreed by the Customer and ShareConLoad',
              ]} />
              <p className="mt-2">ShareConLoad reserves the right to determine the most appropriate refund method based on payment provider limitations, banking restrictions, operational circumstances, and fraud or compliance considerations.</p>
            </Sub>

            <Sub number="3.2" title="Refund Coordination Timelines">
              <p>Refund review and resolution timelines may vary depending on Operators, payment providers, financial institutions, operational investigations, and third-party processing requirements. Factors affecting resolution timelines may include:</p>
              <Bullets items={[
                'Banking institutions',
                'Payment providers',
                'Currency processing',
                'International transfer procedures',
                'Compliance or verification requirements',
              ]} />
              <p className="mt-2">ShareConLoad shall not be responsible for delays caused by third-party financial institutions or payment processors.</p>
            </Sub>

            <Sub number="3.3" title="Partial Refunds">
              <p>Where applicable, refunds may be issued on a partial basis after deduction of:</p>
              <Bullets items={[
                'Platform service fees',
                'Payment processing charges',
                'Banking fees',
                'Operational costs',
                'Operator-related costs',
                'Third-party charges already incurred',
              ]} />
              <p className="mt-2">Refund calculations shall be determined reasonably by ShareConLoad based on the operational stage of the Shipment and applicable transaction costs.</p>
            </Sub>

            <Sub number="3.4" title="Refund Verification">
              <p>Before administering refund review procedures, ShareConLoad may request:</p>
              <Bullets items={[
                'Identity verification',
                'Payment confirmation',
                'Shipment documentation',
                'Supporting operational information',
                'Additional evidence reasonably required to validate the request',
              ]} />
              <p className="mt-2">Refund review or resolution procedures may be delayed until required verification procedures are completed.</p>
            </Sub>

            <Sub number="3.5" title="Currency and Exchange Variations">
              <p>Where refund resolutions are facilitated, amounts may generally be coordinated in the original transaction currency where reasonably possible. ShareConLoad shall not be responsible for:</p>
              <Bullets items={[
                'Exchange-rate fluctuations',
                'Intermediary banking deductions',
                'Foreign exchange conversion costs',
                'Losses arising from currency variations during refund processing',
              ]} />
            </Sub>

            <Sub number="3.6" title="Platform Credits">
              <p>Where operationally appropriate, ShareConLoad may offer Platform credits instead of cash refunds. Platform credits:</p>
              <Bullets items={[
                'May be applied toward future Shipments',
                'May be subject to validity periods',
                'Are non-transferable unless otherwise approved by ShareConLoad',
                'May not be redeemable for cash unless required by applicable law',
              ]} />
            </Sub>

            <Sub number="3.7" title="Refund Restrictions">
              <p>Refunds may be delayed, reduced, suspended, or declined where:</p>
              <Bullets items={[
                'Disputes remain under investigation',
                'Fraudulent activity is suspected',
                'Chargebacks have been initiated',
                'Compliance reviews are pending',
                'Operational liabilities remain unresolved',
              ]} />
            </Sub>

            <Sub number="3.8" title="Final Refund Determinations">
              <p>All refund determinations made by ShareConLoad shall be based on operational records, shipment status, payment status, applicable costs incurred, Operator recovery status, and available supporting evidence. ShareConLoad reserves the right to make reasonable final determinations regarding refund eligibility and applicable deductions.</p>
            </Sub>
          </Section>

          {/* Section 3A */}
          <Section number="3A" title="Limitation of Liability">
            <Sub number="3A.1" title="Exclusion of Indirect and Consequential Losses">
              <p>To the maximum extent permitted by applicable law, ShareConLoad shall not be liable for any indirect, incidental, special, consequential, or punitive losses or damages arising from or in connection with the use of the Platform, Shipment operations, or related services, including but not limited to:</p>
              <Bullets items={[
                'Loss of profits, revenue, or anticipated business',
                'Shipment delays, scheduling changes, or transit disruptions',
                'Demurrage, detention, or port storage costs',
                'Customs penalties, import/export duties, or regulatory fines',
                'Third-party Operator failures, subcontractor failures, or logistical disruptions',
                'Any loss or damage arising from reliance on Platform information, operational estimates, or scheduling data',
              ]} />
            </Sub>

            <Sub number="3A.2" title="Cargo Space and Operational Availability">
              <p>Booking confirmation does not constitute an absolute guarantee of vessel space availability where operational, regulatory, or capacity constraints arise. ShareConLoad shall not be liable for losses arising from oversubscription, Operator allocation changes, vessel substitutions, or other operational disruptions affecting cargo space or scheduling.</p>
            </Sub>
          </Section>

          {/* Section 4 */}
          <Section number="4" title="Non-Refundable Items">
            <Sub number="4.1" title="Platform Service Fees">
              <p>For the purposes of this Policy, &quot;Platform Service Fees&quot; means the digital marketplace, coordination, administrative, verification, technology, and transaction facilitation fees charged by ShareConLoad in connection with bookings, shipments, and related operational services. All Platform service fees charged by ShareConLoad are non-refundable unless expressly determined otherwise by ShareConLoad.</p>
            </Sub>

            <Sub number="4.2" title="Expired Booking Deposits">
              <p>The 20% booking Deposit becomes non-refundable after forty-eight (48) hours from booking confirmation.</p>
            </Sub>

            <Sub number="4.3" title="Payment Processing and Banking Charges">
              <p>Payment processing charges, banking fees, intermediary bank deductions, foreign exchange costs, and related transaction charges are non-refundable.</p>
            </Sub>

            <Sub number="4.4" title="Customer Compliance Failures">
              <p>Refunds may be denied where shipment cancellation, delay, rejection, or operational failure results from:</p>
              <Bullets items={[
                'Inaccurate shipment information',
                'Missing documentation',
                'Customs non-compliance',
                'Permit failures',
                'Prohibited cargo declarations',
                'Customer-related regulatory violations',
              ]} />
            </Sub>

            <Sub number="4.5" title="Prohibited Cargo">
              <p>Payments relating to prohibited, unlawful, fraudulent, or restricted Cargo may be retained where operational, compliance, legal, or administrative costs have already been incurred.</p>
            </Sub>

            <Sub number="4.6" title="Fraudulent Transactions">
              <p>ShareConLoad reserves the right to deny refunds relating to:</p>
              <Bullets items={[
                'Fraudulent bookings',
                'Deceptive transactions',
                'Payment abuse',
                'Unauthorized account activity',
                'Suspected unlawful conduct',
              ]} />
            </Sub>

            <Sub number="4.7" title="Completed Shipment Stages">
              <p>Refund eligibility may reduce or cease entirely once:</p>
              <Bullets items={[
                'Shipment preparation has commenced',
                'Cargo has been loaded',
                'Vessel departure has occurred',
                'Cargo release authorization has been issued',
                'Cargo has been collected at destination',
              ]} />
            </Sub>

            <Sub number="4.8" title="Chargeback-Related Costs">
              <p>Where Customers initiate invalid or fraudulent chargebacks, ShareConLoad reserves the right to retain or recover:</p>
              <Bullets items={[
                'Operational costs',
                'Payment dispute costs',
                'Banking penalties',
                'Administrative costs',
                'Associated losses permitted by applicable law',
              ]} />
            </Sub>
          </Section>

          {/* Section 5 */}
          <Section number="5" title="Force Majeure">
            <Sub number="5.1" title="Force Majeure Events">
              <p>ShareConLoad shall not be liable for delays, failures, interruptions, cancellations, losses, or operational disruptions caused directly or indirectly by events beyond its reasonable control (&quot;Force Majeure Events&quot;). These may include:</p>
              <Bullets items={[
                'Natural disasters, floods, earthquakes, or fires',
                'War, terrorism, civil unrest, or political instability',
                'Labor strikes or port congestion',
                'Customs delays or government actions/restrictions',
                'Sanctions or transportation disruptions',
                'Vessel breakdowns or pandemics',
                'Cyber incidents, communication failures, or power outages',
                'Failures of third-party service providers',
              ]} />
            </Sub>

            <Sub number="5.2" title="Operational Impact">
              <p>Where a Force Majeure Event occurs, ShareConLoad may:</p>
              <Bullets items={[
                'Suspend affected services',
                'Delay shipment operations',
                'Revise shipment schedules',
                'Cancel affected bookings',
                'Coordinate alternative arrangements where feasible',
                'Implement operational contingency measures',
              ]} />
              <p className="mt-2">ShareConLoad does not guarantee uninterrupted Platform operations or shipment execution during Force Majeure Events.</p>
            </Sub>

            <Sub number="5.3" title="Refunds During Force Majeure">
              <Warning>Refunds during Force Majeure Events are not guaranteed. Platform service fees remain non-refundable unless otherwise determined by ShareConLoad.</Warning>
              <p className="mt-2">Any refund, credit, or settlement adjustment shall be assessed based on recoverable amounts, operational commitments already incurred, third-party costs, shipment stage completion, and applicable payment recovery status.</p>
            </Sub>

            <Sub number="5.4" title="Operator and Third-Party Impact">
              <p>ShareConLoad shall not be responsible for operational failures, delays, cancellations, or losses arising from Force Majeure Events affecting Operators, ports, customs authorities, shipping lines, warehouses, transportation providers, payment providers, or other third-party service providers.</p>
            </Sub>

            <Sub number="5.5" title="Mitigation Efforts">
              <p>Where reasonably possible, ShareConLoad may attempt to coordinate revised shipment arrangements, communicate operational updates, facilitate alternative routing, or support operational recovery efforts. Such efforts do not constitute a guarantee of shipment completion, compensation, or refund entitlement.</p>
            </Sub>

            <Sub number="5.6" title="Suspension of Obligations">
              <p>During a Force Majeure Event, affected obligations under this Policy may be suspended for the duration of the event and any reasonable recovery period required to restore operations.</p>
            </Sub>

            <Sub number="5.7" title="No Waiver of Rights">
              <p>A Force Majeure Event shall not waive or remove:</p>
              <Bullets items={[
                'Payment obligations already due',
                'Applicable operational costs',
                'Non-refundable fees',
                'Lawful recovery rights available to ShareConLoad',
              ]} />
            </Sub>
          </Section>

          {/* Section 6 */}
          <Section number="6" title="Chargebacks, Payment Disputes & Fraud">
            <Sub number="6.1" title="Fraudulent or Invalid Chargebacks">
              <p>Customers may not initiate fraudulent, abusive, or invalid payment chargebacks for Shipments, bookings, or transactions that were knowingly authorized, operationally processed, or materially fulfilled.</p>
            </Sub>

            <Sub number="6.2" title="Platform Right to Dispute Chargebacks">
              <p>Where a chargeback or payment reversal is initiated, ShareConLoad reserves the right to dispute the claim through applicable payment providers, financial institutions, or dispute-resolution channels. ShareConLoad may submit supporting evidence including:</p>
              <Bullets items={[
                'Booking confirmations and payment records',
                'Shipment documentation and communication records',
                'Operational logs and proof of service activity',
                'Applicable contractual agreements',
              ]} />
            </Sub>

            <Sub number="6.3" title="Account Suspension and Restrictions">
              <p>Where fraudulent, abusive, or suspicious payment activity is suspected, ShareConLoad may:</p>
              <Bullets items={[
                'Suspend customer or operator accounts',
                'Restrict Platform access',
                'Freeze related transactions',
                'Withhold payouts',
                'Cancel pending Shipments',
              ]} />
              <p className="mt-2">Such actions may remain in effect until investigations are completed.</p>
            </Sub>

            <Sub number="6.4" title="Recovery of Associated Costs">
              <p>ShareConLoad reserves the right to recover costs arising from fraudulent or invalid payment disputes, including:</p>
              <Bullets items={[
                'Chargeback penalties and payment processor fees',
                'Banking charges and operational losses',
                'Investigation costs and legal costs where applicable',
                'Related administrative expenses',
              ]} />
              <p className="mt-2">Recovery may occur through deduction from future refunds or pending payouts, offset against available balances, or lawful recovery processes permitted by applicable law.</p>
            </Sub>

            <Sub number="6.5" title="Fraud Investigations">
              <p>ShareConLoad may investigate suspected payment fraud, identity fraud, account misuse, deceptive booking activity, falsified shipment information, unauthorized transactions, or unlawful operational conduct. Users agree to cooperate reasonably with fraud investigations and verification procedures.</p>
            </Sub>

            <Sub number="6.6" title="Reporting to Authorities">
              <p>Where unlawful conduct is reasonably suspected, ShareConLoad reserves the right to:</p>
              <Bullets items={[
                'Report incidents to payment providers',
                'Notify financial institutions',
                'Cooperate with regulatory authorities and law enforcement agencies',
                'Disclose relevant information where legally permitted or required',
              ]} />
            </Sub>

            <Sub number="6.7" title="No Limitation of Other Rights">
              <p>The rights contained in this section are in addition to any other legal, contractual, operational, or recovery rights available to ShareConLoad under applicable law or Platform agreements.</p>
            </Sub>
          </Section>

          {/* Section 7 */}
          <Section number="7" title="General Provisions">
            <Sub number="7.1" title="Policy Amendments">
              <p>ShareConLoad reserves the right to amend, update, modify, or replace this Cancellation &amp; Refund Policy from time to time. Updated versions become effective upon publication on the Platform or upon notification to users through reasonable communication channels. Continued use of the Platform following publication of revised policies constitutes acceptance of such revisions.</p>
            </Sub>

            <Sub number="7.2" title="Governing Law">
              <p>This Policy shall be governed by and interpreted in accordance with the laws of the Republic of South Africa.</p>
            </Sub>

            <Sub number="7.3" title="Dispute Resolution">
              <p>Parties shall first attempt to resolve disputes arising under this Policy through good-faith discussions and operational resolution processes. Where disputes remain unresolved, parties agree to attempt mediation before initiating formal legal proceedings. Nothing in this section prevents either party from seeking urgent legal relief where reasonably necessary.</p>
            </Sub>

            <Sub number="7.4" title="Severability">
              <p>If any provision of this Policy is determined to be unlawful, invalid, or unenforceable, the remaining provisions shall continue in full force and effect.</p>
            </Sub>

            <Sub number="7.5" title="No Waiver">
              <p>Failure by ShareConLoad to enforce any right or provision under this Policy shall not constitute a waiver of such right or provision.</p>
            </Sub>

            <Sub number="7.6" title="Entire Policy Understanding">
              <p>This Policy forms part of the broader ShareConLoad legal and operational framework, including:</p>
              <Bullets items={[
                'The Terms & Conditions',
                'Privacy Policy',
                'Operator Agreement',
                'Related Platform policies where applicable',
              ]} />
            </Sub>

            <Sub number="7.7" title="Contact Information">
              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 space-y-1">
                <p className="font-bold text-gray-900">VEYQON GROUP (Pty) Ltd</p>
                <p>Registration Number: 2026/353683/07</p>
                <p>Republic of South Africa</p>
                <p>Website: <a href="https://shareconload.com" className="hover:underline" style={{ color: '#f97316' }}>shareconload.com</a></p>
                <p>Email: <a href="mailto:support@shareconload.com" className="hover:underline" style={{ color: '#f97316' }}>support@shareconload.com</a></p>
              </div>
            </Sub>
          </Section>

        </div>

        <p className="text-center text-xs text-gray-400 mt-6 italic">Share the Load. Connect the World.</p>
      </div>
    </div>
  );
}
