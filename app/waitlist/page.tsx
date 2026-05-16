'use client';

import { useState, useEffect } from 'react';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import { supabase } from '@/services/supabaseClient';
import styles from './waitlist.module.css';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-barlow',
  display: 'swap',
});

const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['700', '800', '900'],
  variable: '--font-barlow-condensed',
  display: 'swap',
});

type Role = 'operator' | 'consignor' | 'other';

const ROLES: { role: Role; icon: string; label: string }[] = [
  { role: 'operator',  icon: '🚢', label: "I'm an Operator" },
  { role: 'consignor', icon: '📦', label: "I'm a Consignor" },
  { role: 'other',     icon: '👀', label: 'Just Watching'   },
];

const COUNTRIES = [
  'South Africa','Zimbabwe','Zambia','Nigeria','Ghana','DRC','Kenya',
  'Tanzania','Ethiopia','Uganda','Mozambique','Namibia','Botswana',
  'China','United Kingdom','United States','Other',
];

const BIZ_TYPES = [
  'Container Operator','Freight Forwarder','Trucking Company','Shipping Agent',
  'Importer','Exporter','SME / Trader','Manufacturer','Individual','Other',
];

const STATS = [
  { num: '2',  label: 'Sides of the Market'   },
  { num: '0%', label: 'Empty Miles Tolerated'  },
  { num: '1',  label: 'Platform. Pan-African.' },
  { num: '∞',  label: 'Connections Possible'   },
];

const CORRIDORS = [
  'South Africa ↔ Zimbabwe',
  'South Africa ↔ Zambia',
  'South Africa ↔ DRC',
  'Ghana ↔ South Africa',
  'Ghana ↔ China Import Trade',
  'Nigeria ↔ South Africa',
  'East African Corridors',
  'Major African Port Cities',
  'Global Expansion →',
];

export default function WaitlistPage() {
  const [selectedRole, setSelectedRole] = useState<Role>('operator');
  const [submitting,   setSubmitting]   = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [submitError,  setSubmitError]  = useState<'duplicate' | 'generic' | null>(null);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.1 }
    );

    const els = document.querySelectorAll<HTMLElement>('[data-fade]');
    els.forEach((el, i) => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = `opacity 0.5s ${i * 0.06}s ease, transform 0.5s ${i * 0.06}s ease`;
      io.observe(el);
    });

    return () => io.disconnect();
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const form = e.currentTarget;
    const get = (name: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
      return el ? el.value.trim() : '';
    };

    const { error } = await supabase.from('waitlist_entries').insert({
      first_name:    get('fname'),
      last_name:     get('lname'),
      email:         get('email'),
      phone:         get('phone') || null,
      country:       get('country') || null,
      business_type: get('biz_type') || null,
      role:          selectedRole,
    });

    if (error) {
      console.error('Waitlist insert error:', error);
      setSubmitError(error.code === '23505' ? 'duplicate' : 'generic');
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  return (
    <div className={`${barlow.variable} ${barlowCondensed.variable} ${styles.page}`}>
      <div className={styles.bgLayer} />
      <div className={styles.bgGrid} />

      <div className={styles.wrap}>

        {/* ── Nav ── */}
        <nav className={styles.nav}>
          <svg height="36" viewBox="0 0 280 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="1" width="17" height="17" rx="3" fill="#f26522"/>
            <rect x="0" y="26" width="17" height="17" rx="3" fill="#f2a07a"/>
            <rect x="21" y="14" width="17" height="17" rx="3" fill="#132d5e"/>
            <line x1="40" y1="22" x2="50" y2="22" stroke="#2a4a7f" strokeWidth="2.2" strokeLinecap="round"/>
            <polyline points="46,18 50,22 46,26" fill="none" stroke="#2a4a7f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            <text x="56" y="34" fontFamily="'Barlow Condensed',sans-serif" fontWeight="800" fontSize="28" fill="white">
              Share<tspan fill="#f26522">Con</tspan>Load
            </text>
          </svg>
          <span className={styles.navBadge}>Coming Soon</span>
        </nav>

        {/* ── Hero ── */}
        <section className={styles.hero} id="form-wrap">
          <div className={styles.heroEyebrow}>Africa&apos;s Logistics Revolution</div>
          <h1 className={styles.heroHeadline}>
            Share the <span className={styles.orange}>Load.</span><br />
            Connect the <span className={styles.orange}>World.</span>
          </h1>
          <p className={styles.heroSub}>
            The global digital freight marketplace connecting container operators and carriers
            with businesses that need to move goods — smarter, cheaper, and faster across
            Africa and beyond.
          </p>

          {/* ── Form card ── */}
          <div className={styles.formCard}>
            {submitted ? (
              <div className={styles.successMsg}>
                <div className={styles.successCheck}>✅</div>
                <h3>You&apos;re on the list!</h3>
                <p>
                  We&apos;ll notify you the moment ShareConLoad goes live.<br />
                  Your information is safe — no spam, no data selling, ever.
                </p>
              </div>
            ) : (
              <>
                <div className={styles.formTitle}>Get Early Access</div>
                <div className={styles.formSubtitle}>
                  Join the waitlist. Be first when we go live. Your data is private and will never be sold or shared.
                </div>

                <div className={styles.roleRow}>
                  {ROLES.map(({ role, icon, label }) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      className={`${styles.roleBtn} ${selectedRole === role ? styles.roleBtnActive : ''}`}
                    >
                      <span className={styles.roleBtnIcon}>{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit}>
                  <div className={styles.fieldRow}>
                    <input className={styles.formInput} type="text"  name="fname" placeholder="First name" required autoComplete="given-name"  />
                    <input className={styles.formInput} type="text"  name="lname" placeholder="Last name"  required autoComplete="family-name" />
                  </div>
                  <div className={`${styles.fieldRow} ${styles.fieldRowSingle}`}>
                    <input className={styles.formInput} type="email" name="email" placeholder="Email address" required autoComplete="email" />
                  </div>
                  <div className={`${styles.fieldRow} ${styles.fieldRowSingle}`}>
                    <input className={styles.formInput} type="tel"   name="phone" placeholder="Phone number (optional)" autoComplete="tel" />
                  </div>
                  <div className={styles.fieldRow}>
                    <select className={styles.formSelect} name="country" defaultValue="">
                      <option value="" disabled>Country</option>
                      {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <select className={styles.formSelect} name="biz_type" defaultValue="">
                      <option value="" disabled>Business type</option>
                      {BIZ_TYPES.map((t) => <option key={t}>{t}</option>)}
                    </select>
                  </div>

                  <button type="submit" className={styles.submitBtn} disabled={submitting}>
                    {submitting ? 'Submitting…' : 'Notify Me at Launch'}
                    {!submitting && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    )}
                  </button>
                </form>

                {submitError === 'duplicate' && (
                  <p className={styles.errorNote}>Looks like you&apos;re already on the list!</p>
                )}
                {submitError === 'generic' && (
                  <p className={styles.errorNote}>Something went wrong. Please try again.</p>
                )}

                <p className={styles.privacyNote}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  No spam. No selling your data. One email when we launch.
                </p>
              </>
            )}
          </div>
        </section>

        {/* ── Stats strip ── */}
        <div className={styles.statsStrip}>
          {STATS.map(({ num, label }) => (
            <div key={label} data-fade="">
              <div className={styles.statNum}>{num}</div>
              <div className={styles.statLabel}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── Who it's for ── */}
        <section className={styles.audienceSection}>
          <div className={styles.sectionEyebrow}>Who This Is For</div>
          <h2 className={styles.sectionHeadline}>
            Built for the people<br />who <span className={styles.orange}>move Africa</span>
          </h2>
          <div className={styles.audienceGrid}>
            <div className={styles.audienceCard} data-fade="">
              <div className={styles.cardIcon}>🚢</div>
              <h3>Freight Capacity Providers</h3>
              <p>You have space. We find you cargo. Stop running half-empty routes and start earning on every kilometre you move.</p>
              <ul>
                <li>Container &amp; shipping operators</li>
                <li>Trucking &amp; transport companies</li>
                <li>Freight forwarders &amp; agents</li>
                <li>Independent logistics operators</li>
              </ul>
            </div>
            <div className={styles.audienceCard} data-fade="">
              <div className={styles.cardIcon}>📦</div>
              <h3>Cargo Owners &amp; Consignors</h3>
              <p>You need to move goods. We connect you to verified operators on your route — faster, transparently, and at better rates.</p>
              <ul>
                <li>Importers &amp; exporters</li>
                <li>SMEs &amp; cross-border traders</li>
                <li>Manufacturers</li>
                <li>Individuals shipping internationally</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section className={styles.howSection}>
          <div className={styles.sectionEyebrow}>How It Works</div>
          <h2 className={styles.sectionHeadline} style={{ marginBottom: '36px' }}>
            Simple. <span className={styles.orange}>Powerful.</span> Digital.
          </h2>
          <div className={styles.steps}>
            {[
              { n: '1', icon: '📋', title: 'List or Search',      desc: 'Operators post available container space. Consignors search by route, date, and cargo type — all in real time.' },
              { n: '2', icon: '🤝', title: 'Match & Connect',     desc: 'Smart matching connects cargo demand with available capacity. Communicate directly with verified operators on your route.' },
              { n: '3', icon: '🚀', title: 'Move Goods Smarter',  desc: 'Book and coordinate freight movement efficiently — cutting costs and eliminating empty miles across every corridor.' },
            ].map(({ n, icon, title, desc }) => (
              <div key={n} className={styles.step} data-n={n} data-fade="">
                <div className={styles.stepIcon}>{icon}</div>
                <h4>{title}</h4>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Corridors ── */}
        <section className={styles.corridorsSection}>
          <div className={styles.sectionEyebrow}>Trade Corridors</div>
          <h2 className={styles.sectionHeadline}>
            Where we&apos;re <span className={styles.orange}>launching first</span>
          </h2>
          <div className={styles.corridorTags}>
            {CORRIDORS.map((corridor) => (
              <div key={corridor} className={styles.corridorTag} data-fade="">
                <span className={styles.corridorDot} />
                {corridor}
              </div>
            ))}
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className={styles.ctaSection}>
          <h2>
            Don&apos;t get left<br /><span className={styles.orange}>on the dock.</span>
          </h2>
          <p>ShareConLoad is coming. Be among the first operators and consignors on the platform when we go live.</p>
          <a href="#form-wrap" className={styles.ctaBtn}>
            Join the Waitlist
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
        </section>

        {/* ── Footer ── */}
        <footer className={styles.footer}>
          <svg height="26" viewBox="0 0 280 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="1" width="17" height="17" rx="3" fill="#f26522" opacity="0.6"/>
            <rect x="0" y="26" width="17" height="17" rx="3" fill="#f2a07a" opacity="0.6"/>
            <rect x="21" y="14" width="17" height="17" rx="3" fill="#132d5e" opacity="0.6"/>
            <text x="56" y="34" fontFamily="'Barlow Condensed',sans-serif" fontWeight="800" fontSize="28" fill="rgba(255,255,255,0.45)">
              Share<tspan fill="rgba(242,101,34,0.55)">Con</tspan>Load
            </text>
          </svg>
          <p>© {new Date().getFullYear()} ShareConLoad — Under Veyqon Group. All rights reserved.</p>
          <p style={{ fontSize: '11px', opacity: 0.4 }}>shareconload.com</p>
        </footer>

      </div>
    </div>
  );
}
