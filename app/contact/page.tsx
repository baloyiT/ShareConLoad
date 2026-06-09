'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { supabase } from '@/services/supabaseClient';

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

const SUBJECTS = [
  'General Inquiry',
  'Booking Support',
  'Operator Onboarding',
  'Payment Issue',
  'Technical Problem',
  'Partnership',
  'Other',
];

export default function ContactPage() {
  const [submitting,   setSubmitting]   = useState(false);
  const [submitted,    setSubmitted]    = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [countryQuery, setCountryQuery] = useState('');
  const [countryValue, setCountryValue] = useState('');
  const [countryOpen,  setCountryOpen]  = useState(false);
  const [countryError, setCountryError] = useState(false);
  const countryRef = useRef<HTMLDivElement>(null);

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
    setError(null);

    const form = e.currentTarget;
    const get = (name: string) => {
      const el = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
      return el ? el.value.trim() : '';
    };

    const { error: dbError } = await supabase.from('contact_submissions').insert({
      name:    get('name'),
      email:   get('email'),
      phone:   get('phone') || null,
      country: countryValue,
      subject: get('subject'),
      message: get('message'),
    });

    if (dbError) {
      console.error('Contact form error:', dbError);
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
      return;
    }

    setSubmitted(true);
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="py-12 px-4" style={{ background: 'linear-gradient(135deg, #0f2044 0%, #1a3a6b 100%)' }}>
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/60 hover:text-white transition-colors mb-6">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
            Back to Home
          </Link>
          <p className="text-xs font-extrabold uppercase tracking-widest mb-2" style={{ color: '#f97316' }}>
            Get in Touch
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2">Contact Us</h1>
          <p className="text-gray-300 text-sm leading-relaxed">
            Have a question or need help? Fill in the form and our team will get back to you within 24 hours.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        {submitted ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <div className="text-5xl mb-4">✅</div>
            <h2 className="text-xl font-extrabold text-gray-900 mb-2">Message Received!</h2>
            <p className="text-gray-500 text-sm leading-relaxed mb-6">
              Thank you for reaching out. We&apos;ll get back to you within 24 hours.
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-xl text-white"
              style={{ backgroundColor: '#f97316' }}
            >
              Back to Home
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Name + Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Jane Smith"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': '#f97316' } as React.CSSProperties}
                    onFocus={e => e.target.style.boxShadow = '0 0 0 2px #f97316'}
                    onBlur={e => e.target.style.boxShadow = ''}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Email Address <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="jane@example.com"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
                    onFocus={e => e.target.style.boxShadow = '0 0 0 2px #f97316'}
                    onBlur={e => e.target.style.boxShadow = ''}
                  />
                </div>
              </div>

              {/* Phone + Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Phone <span className="text-gray-400 font-normal normal-case">(optional)</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    placeholder="+27 82 000 0000"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
                    onFocus={e => e.target.style.boxShadow = '0 0 0 2px #f97316'}
                    onBlur={e => e.target.style.boxShadow = ''}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Subject <span className="text-red-400">*</span>
                  </label>
                  <select
                    name="subject"
                    required
                    defaultValue=""
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 focus:outline-none bg-white"
                    onFocus={e => e.target.style.boxShadow = '0 0 0 2px #f97316'}
                    onBlur={e => e.target.style.boxShadow = ''}
                  >
                    <option value="" disabled>Select a subject</option>
                    {SUBJECTS.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Country */}
              <div ref={countryRef} className="relative">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Country <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Search your country..."
                  autoComplete="off"
                  value={countryQuery}
                  onChange={e => { setCountryQuery(e.target.value); setCountryValue(''); setCountryOpen(true); setCountryError(false); }}
                  onFocus={() => setCountryOpen(true)}
                  onBlur={e => e.target.style.boxShadow = ''}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none ${countryError ? 'border-red-400' : 'border-gray-200'}`}
                  style={{}}
                  onFocusCapture={e => (e.target as HTMLInputElement).style.boxShadow = '0 0 0 2px #f97316'}
                />
                <input type="hidden" name="country" value={countryValue} />
                {countryError && <p className="text-red-400 text-xs mt-1">Please select a country</p>}
                {countryOpen && (
                  <ul className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl max-h-52 overflow-y-auto z-50 py-1 shadow-lg">
                    {COUNTRIES.filter(c => c.toLowerCase().includes(countryQuery.toLowerCase())).map(c => (
                      <li
                        key={c}
                        className="px-4 py-2 text-sm text-gray-700 cursor-pointer hover:bg-orange-50 hover:text-gray-900"
                        onMouseDown={() => { setCountryValue(c); setCountryQuery(c); setCountryOpen(false); setCountryError(false); }}
                      >
                        {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  Message <span className="text-red-400">*</span>
                </label>
                <textarea
                  name="message"
                  required
                  rows={5}
                  placeholder="Tell us how we can help..."
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none resize-none"
                  onFocus={e => e.target.style.boxShadow = '0 0 0 2px #f97316'}
                  onBlur={e => e.target.style.boxShadow = ''}
                />
              </div>

              {error && (
                <p className="text-sm text-red-500">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-6 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#f97316' }}
              >
                {submitting ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <>
                    Send Message
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </>
                )}
              </button>

            </form>
          </div>
        )}

        {/* Info cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          {[
            { icon: '📧', label: 'Email', value: 'support@shareconload.com' },
            { icon: '⏱️', label: 'Response Time', value: 'Within 24 hours' },
            { icon: '🌍', label: 'Coverage', value: 'Global' },
          ].map(({ icon, label, value }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
              <div className="text-2xl mb-2">{icon}</div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
              <p className="text-sm font-semibold text-gray-700">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
