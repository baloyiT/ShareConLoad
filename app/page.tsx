"use client";

import { useEffect, useState, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/services/supabaseClient";
import ContainerList from "@/components/ContainerList";
import { Container } from "@/components/ContainerCard";
import LocationAutocomplete from "@/components/LocationAutocomplete";
import RoleSwitcher from "@/components/RoleSwitcher";
import { BarChart3, ChevronDown, Clock, DollarSign, FileText, Globe, Menu, Package, Settings, Ship, SearchX, Shield, ShieldCheck, Handshake, Users, X } from 'lucide-react';

// ─── Brand data ───────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: (
      <Users size={20} />
    ),
    title: "Smarter Connections",
    desc: "Match capacity with real demand",
  },
  {
    icon: (
      <BarChart3 size={20} />
    ),
    title: "Reduce Empty Miles",
    desc: "Optimize routes and maximize utilization",
  },
  {
    icon: (
      <Globe size={20} />
    ),
    title: "Global Reach",
    desc: "Connect across ports, countries & continents",
  },
  {
    icon: (
      <ShieldCheck size={20} />
    ),
    title: "Trusted Operators",
    desc: "Verified & reliable logistics partners",
  },
];

const TRUST = [
  {
    icon: (
      <Shield size={24} />
    ),
    title: "Secure Bookings",
    desc: "Your booking and data are safe with us.",
  },
  {
    icon: (
      <Clock size={24} />
    ),
    title: "24/7 Support",
    desc: "We are here to help you with anything, anytime.",
  },
  {
    icon: (
      <FileText size={24} />
    ),
    title: "Flexible Bookings",
    desc: "Cancel or change your booking with ease.",
  },
  {
    icon: (
      <DollarSign size={24} />
    ),
    title: "Transparent Pricing",
    desc: "You always know exactly what you pay.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [originFilter, setOriginFilter] = useState("");
  const [destinationFilter, setDestinationFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [loadTypeFilter, setLoadTypeFilter] = useState<'all' | 'FCL' | 'LCL'>('all');
  const [searched, setSearched] = useState(false);

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function resolveUser(u: User | null, isNewLogin = false) {
      setUser(u);
      if (!u) {
        setIsAdmin(false);
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("role_type, is_admin")
        .eq("user_id", u.id);

      setIsAdmin(data?.some((p) => p.is_admin === true) ?? false);

      // On fresh login, route to the user's primary portal
      if (isNewLogin) {
        if (data?.some((p) => p.is_admin)) {
          router.push("/admin");
        } else if (data?.some((p) => p.role_type === "operator")) {
          router.push("/operator");
        } else if (data?.some((p) => p.role_type === "agent")) {
          router.push("/agent");
        } else if (data?.some((p) => p.role_type === "measurement_agent")) {
          router.push("/measurement-agent");
        } else if (data?.some((p) => p.role_type === "transporter")) {
          router.push("/transporter");
        }
      }
    }

    supabase.auth.getUser().then(({ data }) => resolveUser(data.user, false));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      resolveUser(session?.user ?? null, event === "SIGNED_IN");
    });
    return () => subscription.unsubscribe();
  }, [router]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.refresh();
  }

  // ── Containers ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchContainers() {
      const { data, error } = await supabase
        .from("containers")
        .select("*, operator_id")
        .eq("status", "open")
        .order("departure_date", { ascending: true });
      if (error) {
        setError("Could not load containers. Please try again later.");
      } else {
        setContainers(data as Container[]);

        const operatorIds = (data ?? []).map(c => c.operator_id).filter(Boolean) as string[];
        if (operatorIds.length > 0) {
          const { data: ratings } = await supabase
            .from('operator_rating_summary')
            .select('user_id, average_stars, review_count')
            .in('user_id', operatorIds);

          if (ratings && ratings.length > 0) {
            const ratingMap = new Map(
              ratings.map(r => [r.user_id, { average_stars: r.average_stars, review_count: r.review_count }])
            );
            setContainers(prev =>
              prev.map(c => ({
                ...c,
                ...(c.operator_id ? (ratingMap.get(c.operator_id) ?? {}) : {}),
              }))
            );
          }
        }
      }
      setLoading(false);
    }
    fetchContainers();
  }, []);

  const filteredContainers = useMemo(() => {
    if (!searched) return containers;
    return containers.filter((c) => {
      const matchLoc = (filter: string, city: string, country: string) => {
        if (!filter.trim()) return true;
        const f = filter.trim().toLowerCase();
        return (
          city.toLowerCase().includes(f) ||
          country.toLowerCase().includes(f) ||
          `${city}, ${country}`.toLowerCase().includes(f)
        );
      };
      const originMatch = matchLoc(
        originFilter,
        c.origin_city,
        c.origin_country,
      );
      const destMatch = matchLoc(
        destinationFilter,
        c.destination_city,
        c.destination_country,
      );
      const dateMatch = !dateFilter || c.departure_date >= dateFilter;
      const priceMatch = !maxPrice || (c.price_per_cbm_usd ?? c.price_per_cbm) <= parseFloat(maxPrice);
      const loadTypeMatch = loadTypeFilter === 'all' || c.load_type === loadTypeFilter;
      return originMatch && destMatch && dateMatch && priceMatch && loadTypeMatch;
    });
  }, [
    containers,
    originFilter,
    destinationFilter,
    dateFilter,
    maxPrice,
    loadTypeFilter,
    searched,
  ]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearched(true);
  }
  function handleReset() {
    setOriginFilter("");
    setDestinationFilter("");
    setDateFilter("");
    setMaxPrice("");
    setLoadTypeFilter('all');
    setSearched(false);
  }

  const userInitials = user
    ? ((user.user_metadata?.full_name as string | undefined)
        ?.split(" ")
        .map((n: string) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() ??
      user.email?.[0]?.toUpperCase() ??
      "")
    : "";
  const userName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans">
      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
        <div className="w-full px-6 sm:px-10 flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <Image
              src="/logo1.png"
              alt=""
              width={40}
              height={40}
              className="h-9 w-auto"
            />
            <span className="text-xl font-extrabold tracking-tight">
              <span style={{ color: "#0b103a" }}>Share</span>
              <span style={{ color: "#ff6a00" }}>Con</span>
              <span style={{ color: "#0b103a" }}>Load</span>
            </span>
          </Link>

          {/* Nav links (desktop) */}
          <div className="hidden lg:flex items-center gap-5 text-sm font-medium text-gray-600">
            <Link href="/about" className="hover:text-gray-900 transition-colors whitespace-nowrap">
              About
            </Link>
            <Link
              href="/how-it-works"
              className="hover:text-gray-900 transition-colors whitespace-nowrap"
            >
              How It Works
            </Link>
            {/*
            <a
              href="#listings"
              className="hover:text-gray-900 transition-colors whitespace-nowrap"
            >
              I Need Container Space
            </a>
            
            <button
              onClick={handleSwitchToOperator}
              className="hover:text-gray-900 transition-colors whitespace-nowrap"
            >
              I Have Container Space
            </button>

*/}

            <Link href="/contact" className="hover:text-gray-900 transition-colors">
              Contact
            </Link>
          </div>

          {/* Auth / user section */}
          <div className="flex items-center gap-2">
            {/* Hamburger (mobile only) */}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors ml-1"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
            {user ? (
              <>
                <Link
                  href="/bookings"
                  className="hidden sm:flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-lg text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: "#0b103a" }}
                >
                  <Package className="w-4 h-4" /> My Bookings
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="hidden sm:flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: '#0b103a', backgroundColor: '#e8eef8' }}
                  >
                    <Settings className="w-4 h-4" /> Admin
                  </Link>
                )}
                <RoleSwitcher currentRole="customer" />

                {/* Avatar + name + badge */}
                <div className="flex items-center gap-2 pl-1">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ backgroundColor: "#0b103a" }}
                  >
                    {userInitials}
                  </div>
                  <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[130px] truncate">
                    {userName}
                  </span>
                </div>

                <button
                  onClick={handleSignOut}
                  className="text-sm font-medium text-gray-500 hover:text-gray-800 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-sm font-medium text-gray-700 hover:text-gray-900 px-4 py-1.5 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors"
                >
                  Login
                </Link>
                <Link
                  href="/auth/register"
                  className="text-sm font-semibold text-white px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: "#ff6a00" }}
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── Mobile nav drawer ──────────────────────────────────────────────── */}
      {mobileNavOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />

          {/* Drawer */}
          <aside className="fixed top-0 right-0 h-full w-72 bg-white z-50 shadow-xl flex flex-col lg:hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <span className="text-base font-extrabold tracking-tight">
                <span style={{ color: '#0b103a' }}>Share</span>
                <span style={{ color: '#ff6a00' }}>Con</span>
                <span style={{ color: '#0b103a' }}>Load</span>
              </span>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Nav links */}
            <nav className="flex flex-col gap-1 px-3 py-4 flex-1">
              <Link
                href="/about"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                About
              </Link>
              <Link
                href="/how-it-works"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                How It Works
              </Link>
              <Link
                href="/contact"
                onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Contact
              </Link>

              {user && (
                <>
                  <div className="border-t border-gray-100 my-2" />
                  <Link
                    href="/bookings"
                    onClick={() => setMobileNavOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                    style={{ color: '#0b103a', backgroundColor: '#e8eef8' }}
                  >
                    <Package className="w-4 h-4" /> My Bookings
                  </Link>
                  <RoleSwitcher variant="flat" currentRole="customer" onNavigate={() => setMobileNavOpen(false)} />
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                      style={{ color: '#0b103a', backgroundColor: '#e8eef8' }}
                    >
                      <Settings className="w-4 h-4" /> Admin Dashboard
                    </Link>
                  )}
                </>
              )}
            </nav>

            {/* Auth footer */}
            <div className="px-4 py-4 border-t border-gray-100 flex flex-col gap-2">
              {user ? (
                <button
                  onClick={() => { setMobileNavOpen(false); handleSignOut(); }}
                  className="w-full text-sm font-medium text-gray-500 hover:text-gray-800 px-4 py-2.5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors"
                >
                  Sign out
                </button>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    onClick={() => setMobileNavOpen(false)}
                    className="w-full text-center text-sm font-medium text-gray-700 px-4 py-2.5 rounded-xl border border-gray-200 hover:border-gray-400 transition-colors"
                  >
                    Login
                  </Link>
                  <Link
                    href="/auth/register"
                    onClick={() => setMobileNavOpen(false)}
                    className="w-full text-center text-sm font-semibold text-white px-4 py-2.5 rounded-xl hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: '#ff6a00' }}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </aside>
        </>
      )}

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden min-h-[600px] lg:min-h-[680px] flex items-center">

        {/* Background image */}
        <Image
          src="/hero-port.png"
          alt="Container port"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />

        {/* Dark overlay */}
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(135deg, rgba(15,32,68,0.92) 0%, rgba(26,58,107,0.80) 60%, rgba(15,32,68,0.60) 100%)' }}
        />

        {/* Content */}
        <div className="relative z-10 px-5 sm:px-12 lg:px-20 py-16 lg:py-24 w-full">
          <div className="max-w-xl">
            <h1
              className="font-extrabold leading-[1.1] mb-5 text-white"
              style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)' }}
            >
              Share the Load.
              <br />
              <span style={{ color: '#ff6a00' }}>Connect the World.</span>
            </h1>
            <p className="text-gray-300 text-base lg:text-lg mb-8 max-w-lg leading-relaxed">
              ShareConLoad connects shippers, operators, and freight agents to move containers smarter across every global route — reducing empty miles and building a more efficient logistics network.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-3 mb-10">
              <a
                href="#listings"
                className="inline-flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-xl text-white hover:opacity-90 transition-opacity shadow-sm"
                style={{ backgroundColor: '#ff6a00' }}
              >
                Find Container Space
                <ChevronDown className="w-4 h-4" />
              </a>
              <Link
                href="/onboarding/operator"
                className="inline-flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-xl border-2 hover:bg-white/10 transition-colors"
                style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#ffffff' }}
              >
                List Your Container
              </Link>
              <Link
                href="/onboarding/agent"
                className="inline-flex items-center gap-2 text-sm font-bold px-6 py-3 rounded-xl border-2 hover:bg-white/10 transition-colors"
                style={{ borderColor: 'rgba(31,168,255,0.6)', color: '#1fa8ff' }}
              >
                Join as Agent
              </Link>
            </div>

            {/* Feature grid */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-5">
              {FEATURES.map(({ icon, title, desc }) => (
                <div key={title} className="flex flex-col gap-2">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-white"
                    style={{ backgroundColor: '#ff6a00' }}
                  >
                    {icon}
                  </div>
                  <p className="text-sm font-bold text-white">{title}</p>
                  <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

      </section>

      {/* ── Search + Listings ──────────────────────────────────────────────── */}
      <section id="listings" className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        {/* Search form */}
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-3"
          style={{ color: "#ff6a00" }}
        >
          Find Container Space
        </p>
        <form
          onSubmit={handleSearch}
          className="bg-white rounded-2xl shadow-md border border-gray-100 p-5 mb-10"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Origin
              </label>
              <LocationAutocomplete
                id="origin"
                placeholder="e.g. Shanghai, China"
                value={originFilter}
                onChange={setOriginFilter}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Destination
              </label>
              <LocationAutocomplete
                id="destination"
                placeholder="e.g. Lagos, Nigeria"
                value={destinationFilter}
                onChange={setDestinationFilter}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Departure Date
              </label>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="input input-bordered w-full text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
                Max Price / CBM (USD equiv.)
              </label>
              <input
                type="number"
                placeholder="e.g. 200"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="input input-bordered w-full text-sm"
                min={0}
              />
            </div>
          </div>
          <div className="mb-3">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Load Type</label>
            <div className="flex gap-2">
              {(['all','FCL','LCL'] as const).map((lt) => (
                <button key={lt} type="button" onClick={() => setLoadTypeFilter(lt)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold border transition-colors"
                  style={loadTypeFilter === lt
                    ? { backgroundColor: '#0b103a', color: '#fff', borderColor: '#0b103a' }
                    : { backgroundColor: '#fff', color: '#6b7280', borderColor: '#e5e7eb' }}>
                  {lt === 'all' ? 'All' : lt}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            {searched && (
              <button
                type="button"
                onClick={handleReset}
                className="text-sm text-gray-400 hover:text-gray-600 underline"
              >
                Clear filters
              </button>
            )}
            <button
              type="submit"
              className="ml-auto text-white font-semibold px-8 py-2 rounded-xl text-sm hover:opacity-90 transition-opacity"
              style={{ backgroundColor: "#0b103a" }}
            >
              Search
            </button>
          </div>
        </form>

        {/* Heading */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900">
                Available Containers
              </h2>
              {!loading && (
                <span
                  className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: "#fff7ed", color: "#ff6a00" }}
                >
                  {filteredContainers.length} {searched ? "result" : "open"}
                  {filteredContainers.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            {searched && !loading && (
              <p className="text-sm text-gray-400 mt-0.5">
                Showing filtered results -{" "}
                <button
                  type="button"
                  onClick={handleReset}
                  className="underline hover:text-gray-600"
                >
                  clear filters
                </button>
              </p>
            )}
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-24">
            <span
              className="loading loading-spinner loading-lg"
              style={{ color: "#ff6a00" }}
            />
          </div>
        )}
        {error && (
          <div className="alert alert-error max-w-lg mx-auto">
            <span>{error}</span>
          </div>
        )}
        {!loading && !error && searched && filteredContainers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{ backgroundColor: '#f3f4f6' }}
            >
              <SearchX className="w-8 h-8 text-gray-400" strokeWidth={1.5} />
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-1">No results found</h3>
            <p className="text-sm text-gray-400 max-w-xs leading-relaxed mb-5">
              No containers match your filters. Try a different route, date, or price range.
            </p>
            <button
              onClick={handleReset}
              className="text-sm font-semibold px-5 py-2.5 rounded-xl text-white hover:opacity-90 transition-opacity"
              style={{ backgroundColor: '#ff6a00' }}
            >
              Clear filters
            </button>
          </div>
        )}

        {!loading && !error && !(searched && filteredContainers.length === 0) && (
          <ContainerList containers={filteredContainers} />
        )}
      </section>

      {/* ── Trust strip ────────────────────────────────────────────────────── */}
      <section className="border-t border-gray-100 bg-white py-14 px-4">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {TRUST.map(({ icon, title, desc }) => (
            <div key={title} className="flex flex-col items-center gap-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: "#fff7ed", color: "#ff6a00" }}
              >
                {icon}
              </div>
              <h3 className="font-bold text-gray-800">{title}</h3>
              <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Supply-side CTA ──────────────────────────────────────────────── */}
      <section style={{ backgroundColor: '#0b103a' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 sm:grid-cols-2 gap-6 divide-y sm:divide-y-0 sm:divide-x divide-white/10">

          {/* Operator column */}
          <div className="flex items-center gap-4 pb-6 sm:pb-0 sm:pr-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(249,115,22,0.15)' }}
            >
              <Ship className="w-6 h-6" style={{ color: '#ff6a00' }} />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-lg leading-tight">
                Got container space? List it globally.
              </p>
              <p className="text-gray-400 text-sm mt-1 mb-4">
                Reach verified shippers on every route and fill your container faster.
              </p>
              <Link
                href="/onboarding/operator"
                className="inline-block text-sm font-bold px-6 py-2.5 rounded-xl text-white hover:opacity-90 transition-opacity whitespace-nowrap"
                style={{ backgroundColor: '#ff6a00' }}
              >
                I Have Container Space →
              </Link>
            </div>
          </div>

          {/* Agent column */}
          <div className="flex items-center gap-4 pt-6 sm:pt-0 sm:pl-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: 'rgba(31,168,255,0.15)' }}
            >
              <Handshake className="w-6 h-6" style={{ color: '#1fa8ff' }} />
            </div>
            <div className="flex-1">
              <p className="text-white font-bold text-lg leading-tight">
                You&apos;re a freight agent? Bring your clients here.
              </p>
              <p className="text-gray-400 text-sm mt-1 mb-4">
                Book container space on behalf of your shippers — all from one portal.
              </p>
              <Link
                href="/onboarding/agent"
                className="inline-block text-sm font-bold px-6 py-2.5 rounded-xl text-white hover:opacity-90 transition-opacity whitespace-nowrap"
                style={{ backgroundColor: '#1fa8ff' }}
              >
                Join as Agent →
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">

          {/* Brand */}
          <div className="flex flex-col gap-3">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo1.png" alt="" width={32} height={32} className="h-7 w-auto" />
              <span className="text-base font-extrabold tracking-tight">
                <span style={{ color: '#0b103a' }}>Share</span>
                <span style={{ color: '#ff6a00' }}>Con</span>
                <span style={{ color: '#0b103a' }}>Load</span>
              </span>
            </Link>
            <p className="text-xs text-gray-400 leading-relaxed max-w-[220px]">
              The smarter way to move goods globally, shared container logistics for everyone.
            </p>
          </div>

          {/* Platform links */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Platform</p>
            <Link href="/about" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">About</Link>
            <Link href="/how-it-works" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">How It Works</Link>
            <a href="#listings"        className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Browse Containers</a>
            <Link href="/onboarding/operator" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">List Your Container</Link>
            <Link href="/onboarding/agent" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Become an Agent</Link>
            <Link href="/auth/register" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Create Account</Link>
          </div>

          {/* Legal links */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">Legal</p>
            <Link href="/pricing" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Pricing</Link>
            <Link href="/privacy" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Terms of Service</Link>
            <Link href="/cancellation" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Cancellation &amp; Refund Policy</Link>
            <Link href="#" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">Cookie Policy</Link>
          </div>
        </div>

        <div className="border-t border-gray-100 px-6 sm:px-10 py-4">
          <p className="text-xs text-gray-400 text-center">
            © {new Date().getFullYear()} ShareConLoad. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
