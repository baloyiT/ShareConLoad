'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import { supabase } from '@/services/supabaseClient';

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
  { role: 'consignor', icon: '📦', label: "I'm a Shipper"   },
  { role: 'other',     icon: '👀', label: 'I\'m Exploring'  },
];

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda',
  'Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain',
  'Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan',
  'Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria',
  'Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada',
  'Central African Republic','Chad','Chile','China','Colombia','Comoros',
  'Congo (Brazzaville)','Congo (DRC)','Costa Rica','Croatia','Cuba','Cyprus',
  'Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic',
  'Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia',
  'Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia',
  'Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau',
  'Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran',
  'Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan',
  'Kenya','Kiribati','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho',
  'Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar',
  'Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands',
  'Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco',
  'Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru',
  'Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria',
  'North Korea','North Macedonia','Norway','Oman','Pakistan','Palau',
  'Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines',
  'Poland','Portugal','Qatar','Romania','Russia','Rwanda',
  'Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines',
  'Samoa','San Marino','São Tomé and Príncipe','Saudi Arabia','Senegal',
  'Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia',
  'Solomon Islands','Somalia','South Africa','South Korea','South Sudan',
  'Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria',
  'Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga',
  'Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda',
  'Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay',
  'Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen',
  'Zambia','Zimbabwe','Other',
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

const STEPS = [
  { n: '1', icon: '📋', title: 'List or Search',     desc: 'Operators post available container space. Consignors search by route, date, and cargo type — all in real time.' },
  { n: '2', icon: '🤝', title: 'Match & Connect',    desc: 'Smart matching connects cargo demand with available capacity. Communicate directly with verified operators on your route.' },
  { n: '3', icon: '🚀', title: 'Move Goods Smarter', desc: 'Book and coordinate freight movement efficiently — cutting costs and eliminating empty miles across every corridor.' },
];

const AUDIENCE = [
  {
    icon: '🚢',
    title: 'Freight Capacity Providers',
    desc: 'You have space. We find you cargo. Stop running half-empty routes and start earning on every kilometre you move.',
    items: ['Container & shipping operators', 'Trucking & transport companies', 'Freight forwarders & agents', 'Independent logistics operators'],
  },
  {
    icon: '📦',
    title: 'Cargo Owners & Consignors',
    desc: 'You need to move goods. We connect you to verified operators on your route — faster, transparently, and at better rates.',
    items: ['Importers & exporters', 'SMEs & cross-border traders', 'Manufacturers', 'Individuals shipping internationally'],
  },
];

export default function WaitlistPage() {
  const [selectedRole, setSelectedRole] = useState<Role>('operator');
  const [submitting,   setSubmitting]   = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [submitError,  setSubmitError]  = useState<'duplicate' | 'generic' | null>(null);
  const [countryQuery, setCountryQuery] = useState('');
  const [countryValue, setCountryValue] = useState('');
  const [countryOpen,  setCountryOpen]  = useState(false);
  const [countryError, setCountryError] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!countryValue) { setCountryError(true); return; }
    setCountryError(false);
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
      console.error('Waitlist insert error:', error.code, error.message);
      setSubmitError(error.code === '23505' ? 'duplicate' : 'generic');
      setSubmitting(false);
      return;
    }
    setSubmitted(true);
    setSubmitting(false);
  }

  return (
    <div
      data-theme="dark"
      className={`${barlow.variable} ${barlowCondensed.variable} font-sans relative overflow-x-hidden min-h-screen`}
      style={{ background: '#0d1f3c', color: '#ffffff' }}
    >
      {/* Background glow */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 90% 60% at 75% -5%, rgba(242,101,34,0.13) 0%, transparent 55%), ' +
            'radial-gradient(ellipse 50% 40% at -5% 90%, rgba(242,101,34,0.08) 0%, transparent 50%)',
        }}
      />

      <div className="relative z-10">

        {/* Nav */}
        <nav className="flex items-center justify-between px-[6%] py-[18px] border-b border-white/10 sticky top-0 backdrop-blur-[14px] z-[100]" style={{ background: 'rgba(13,31,60,0.9)' }}>
          <Link href="/" className="flex items-center gap-2">
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
          </Link>
          <Link href="/" className="text-xs font-semibold text-white/60 hover:text-white transition-colors flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Back to Home
          </Link>
        </nav>

        {/* Hero */}
        <section className="min-h-[92vh] flex flex-col items-center justify-center text-center px-[6%] pt-20 pb-16" id="form-wrap">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] uppercase text-[#f26522] mb-7 opacity-0 animate-[fadeUp_0.7s_0.1s_forwards]">
            <span className="block w-7 h-px bg-[#f26522] opacity-60" />
            Africa&apos;s Logistics Revolution
            <span className="block w-7 h-px bg-[#f26522] opacity-60" />
          </div>

          <h1 className="font-condensed font-black leading-none uppercase mb-6 text-[clamp(58px,10vw,110px)] opacity-0 animate-[fadeUp_0.7s_0.25s_forwards]">
            Share the <span className="text-[#f26522]">Load.</span><br />
            Connect the <span className="text-[#f26522]">World.</span>
          </h1>

          <p className="text-[clamp(15px,2vw,18px)] text-white/60 max-w-[560px] leading-relaxed mb-[52px] opacity-0 animate-[fadeUp_0.7s_0.4s_forwards]">
            The global digital freight marketplace connecting carriers and container operators with businesses that need to move goods faster, cheaper, and smarter across Africa and beyond.
          </p>

          {/* Form card */}
          <div className="bg-white/[0.04] border border-white/10 rounded-xl p-5 sm:p-9 w-full max-w-[520px] backdrop-blur-sm opacity-0 animate-[fadeUp_0.7s_0.55s_forwards]">
            {submitted ? (
              <div className="text-center py-4">
                <div className="text-5xl mb-4">✅</div>
                <h3 className="font-condensed text-2xl font-extrabold uppercase mb-2.5">You&apos;re on the list!</h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  We&apos;ll notify you the moment ShareConLoad goes live.<br />
                  Your information is safe — no spam, no data selling, ever.
                </p>
              </div>
            ) : (
              <>
                <div className="font-condensed text-xl font-bold tracking-[0.04em] uppercase mb-1.5">Get Early Access</div>
                <div className="text-sm text-white/60 mb-6 leading-relaxed">
                  Join the waitlist and get early access to Africa&apos;s next generation digital freight marketplace.
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  {ROLES.map(({ role, icon, label }) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      className={`flex flex-col items-center gap-1.5 py-3 px-1.5 rounded-md border text-[11px] font-semibold tracking-[0.1em] uppercase transition-all duration-200 cursor-pointer ${
                        selectedRole === role
                          ? 'border-[#f26522] bg-[#f26522]/10 text-white'
                          : 'border-white/10 bg-transparent text-white/60 hover:border-[#f26522] hover:text-white'
                      }`}
                    >
                      <span className="text-lg">{icon}</span>
                      {label}
                    </button>
                  ))}
                </div>

                <form onSubmit={handleSubmit}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
                    <input className="input input-bordered bg-white/[0.06] border-white/10 text-white placeholder:text-white/35 focus:border-[#f26522] text-sm w-full" type="text" name="fname" placeholder="First name" required autoComplete="given-name" />
                    <input className="input input-bordered bg-white/[0.06] border-white/10 text-white placeholder:text-white/35 focus:border-[#f26522] text-sm w-full" type="text" name="lname" placeholder="Last name" required autoComplete="family-name" />
                  </div>
                  <div className="mb-2.5">
                    <input className="input input-bordered bg-white/[0.06] border-white/10 text-white placeholder:text-white/35 focus:border-[#f26522] text-sm w-full" type="email" name="email" placeholder="Email address" required autoComplete="email" />
                  </div>
                  <div className="mb-2.5">
                    <input className="input input-bordered bg-white/[0.06] border-white/10 text-white placeholder:text-white/35 focus:border-[#f26522] text-sm w-full" type="tel" name="phone" placeholder="Phone number (optional)" autoComplete="tel" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
                    <div ref={countryRef} className="relative">
                      <input
                        type="text"
                        className={`input input-bordered bg-white/[0.06] text-white placeholder:text-white/35 text-sm w-full ${countryError ? 'border-red-400' : 'border-white/10'} focus:border-[#f26522]`}
                        placeholder="Country *"
                        autoComplete="off"
                        value={countryQuery}
                        onChange={e => { setCountryQuery(e.target.value); setCountryValue(''); setCountryOpen(true); setCountryError(false); }}
                        onFocus={() => setCountryOpen(true)}
                      />
                      <input type="hidden" name="country" value={countryValue} />
                      {countryError && <p className="text-red-400 text-xs mt-1 ml-1">Please select a country</p>}
                      {countryOpen && (
                        <ul className="absolute top-full left-0 right-0 mt-1 rounded-lg max-h-52 overflow-y-auto z-50 py-1 shadow-xl border border-white/10" style={{ background: '#0f2345' }}>
                          {COUNTRIES.filter(c => c.toLowerCase().includes(countryQuery.toLowerCase())).map(c => (
                            <li
                              key={c}
                              className="px-3 py-2 text-sm text-white/80 cursor-pointer hover:bg-[#f26522]/20 hover:text-white"
                              onMouseDown={() => { setCountryValue(c); setCountryQuery(c); setCountryOpen(false); setCountryError(false); }}
                            >
                              {c}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <select className="select select-bordered bg-white/[0.06] border-white/10 text-white focus:border-[#f26522] text-sm w-full" name="biz_type" defaultValue="" required>
                      <option value="" disabled>Business type *</option>
                      {BIZ_TYPES.map((t) => <option key={t} style={{ background: '#0f2345' }}>{t}</option>)}
                    </select>
                  </div>

                  <button
                    type="submit"
                    className="w-full mt-3 py-3 px-6 rounded-lg font-condensed text-base font-bold tracking-[0.12em] uppercase flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                    style={{ background: '#f26522', color: '#ffffff' }}
                    disabled={submitting}
                  >
                    {submitting ? 'Submitting…' : (
                      <>
                        Notify Me at Launch
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </>
                    )}
                  </button>
                </form>

                {submitError === 'duplicate' && (
                  <p className="text-[13px] text-red-300 text-center mt-2.5 leading-relaxed">Looks like you&apos;re already on the list!</p>
                )}
                {submitError === 'generic' && (
                  <p className="text-[13px] text-red-300 text-center mt-2.5 leading-relaxed">Something went wrong. Please try again.</p>
                )}

                <p className="text-[11.5px] text-white/60 text-center mt-3 leading-relaxed flex items-center justify-center gap-1.5">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  No spam. No selling your data. One email when we launch.
                </p>
              </>
            )}
          </div>
        </section>

        {/* Stats strip */}
        <div className="border-t border-b border-white/10 py-10 px-[6%] grid grid-cols-2 md:grid-cols-4 gap-5 text-center">
          {STATS.map(({ num, label }) => (
            <div key={label} data-fade="">
              <div className="font-condensed font-black text-[#f26522] leading-none mb-1.5 text-[clamp(36px,5vw,52px)]">{num}</div>
              <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-white/60">{label}</div>
            </div>
          ))}
        </div>

        {/* Who it's for */}
        <section className="px-[6%] py-20">
          <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#f26522] flex items-center gap-2.5 mb-5">
            Who This Is For
            <span className="block w-8 h-px bg-[#f26522] opacity-50" />
          </div>
          <h2 className="font-condensed font-black uppercase leading-none text-[clamp(36px,5vw,56px)] mb-12">
            Built for the people<br />moving <span className="text-[#f26522]">Africa and beyond</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {AUDIENCE.map(({ icon, title, desc, items }) => (
              <div key={title} className="bg-white/[0.04] border border-white/10 rounded-[10px] p-7 hover:border-[#f26522]/40 hover:-translate-y-0.5 transition-all duration-200" data-fade="">
                <div className="text-3xl mb-3.5">{icon}</div>
                <h3 className="font-condensed text-xl font-extrabold uppercase tracking-[0.04em] mb-2.5">{title}</h3>
                <p className="text-[13.5px] text-white/60 leading-relaxed">{desc}</p>
                <ul className="mt-3.5 space-y-1 list-none p-0">
                  {items.map((item) => (
                    <li key={item} className="text-[13px] text-white/60 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#f26522] flex-shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="px-[6%] py-20 border-t border-white/10">
          <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#f26522] flex items-center gap-2.5 mb-5">
            How It Works
            <span className="block w-8 h-px bg-[#f26522] opacity-50" />
          </div>
          <h2 className="font-condensed font-black uppercase leading-none text-[clamp(36px,5vw,56px)] mb-9">
            Simple. <span className="text-[#f26522]">Powerful.</span> Digital.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {STEPS.map(({ n, icon, title, desc }) => (
              <div key={n} className="bg-white/[0.04] border border-white/10 rounded-[10px] p-7 relative overflow-hidden" data-fade="">
                <span className="absolute right-4 top-3 font-condensed text-[72px] font-black text-[#f26522]/[0.08] leading-none select-none pointer-events-none">{n}</span>
                <div className="text-[28px] mb-3.5">{icon}</div>
                <h4 className="font-condensed text-lg font-extrabold uppercase tracking-[0.04em] mb-2">{title}</h4>
                <p className="text-[13.5px] text-white/60 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-[6%] py-[90px] border-t border-white/10 text-center" style={{ background: 'linear-gradient(to bottom, transparent, rgba(242,101,34,0.05))' }}>
          <h2 className="font-condensed font-black uppercase leading-none text-[clamp(40px,6vw,72px)] mb-4">
            Don&apos;t get left<br /><span className="text-[#f26522]">on the dock.</span>
          </h2>
          <p className="text-white/60 text-[15px] max-w-[480px] mx-auto mb-8 leading-relaxed">
            ShareConLoad is coming. Be among the first operators and consignors on the platform when we go live.
          </p>
          <a
            href="#form-wrap"
            className="inline-flex items-center gap-2 py-3 px-8 rounded-lg font-condensed text-base font-bold tracking-[0.1em] uppercase transition-opacity hover:opacity-90"
            style={{ background: '#f26522', color: '#ffffff' }}
          >
            Join the Waitlist
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </a>
        </section>

        {/* Footer */}
        <footer className="py-7 px-[6%] border-t border-white/10 flex items-center justify-between flex-wrap gap-3">
          <svg height="26" viewBox="0 0 280 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="0" y="1" width="17" height="17" rx="3" fill="#f26522" opacity="0.6"/>
            <rect x="0" y="26" width="17" height="17" rx="3" fill="#f2a07a" opacity="0.6"/>
            <rect x="21" y="14" width="17" height="17" rx="3" fill="#132d5e" opacity="0.6"/>
            <text x="56" y="34" fontFamily="'Barlow Condensed',sans-serif" fontWeight="800" fontSize="28" fill="rgba(255,255,255,0.45)">
              Share<tspan fill="rgba(242,101,34,0.55)">Con</tspan>Load
            </text>
          </svg>
          <p className="text-xs text-white/60">© {new Date().getFullYear()} ShareConLoad — Under Veyqon Group. All rights reserved.</p>
          <p className="text-[11px] text-white/40">shareconload.com</p>
        </footer>

      </div>
    </div>
  );
}
