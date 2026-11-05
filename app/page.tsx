"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/services/supabaseClient";
import HomeEnquiryForm from "@/components/HomeEnquiryForm";
import PublicFooter from "@/components/PublicFooter";
import PublicNav from "@/components/PublicNav";

const STEPS = [
  {
    title: "Describe it",
    desc: 'Approximate details are fine. "Not sure" is a valid answer.',
  },
  {
    title: "We check and match",
    desc: "Our team calls or WhatsApps you, then matches up to three operators.",
  },
  {
    title: "Compare and choose",
    desc: "See quotes side by side and pay your chosen operator directly.",
  },
];

export default function HomePage() {
  const router = useRouter();

  // On SIGNED_IN, route the user to their primary portal.
  useEffect(() => {
    async function routeToPortal(u: User) {
      const { data } = await supabase
        .from("profiles")
        .select("role_type, is_admin")
        .eq("user_id", u.id);

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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) routeToPortal(session.user);
    });
    return () => subscription.unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col bg-white font-sans text-[#333B48]">
      <PublicNav />

      <main className="flex-1">
        {/* The image is clipped here, not on the section, so location suggestions can overflow the hero. */}
        <section className="relative">
          <div className="absolute inset-0 overflow-hidden">
            <Image
              src="/hero-port.png"
              alt="Container port"
              fill
              priority
              sizes="100vw"
              className="object-cover object-center"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(100deg, rgba(8,29,58,0.94) 0%, rgba(8,29,58,0.82) 50%, rgba(8,29,58,0.35) 100%)",
              }}
            />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center">
            <div>
              <p className="text-sm font-semibold text-[#FF6A00]">Freight. Connected.</p>
              <h1 className="mt-2 text-3xl lg:text-5xl font-bold leading-tight text-white">
                Tell us what you need to move. We&apos;ll find the right operators.
              </h1>
              <p className="mt-4 text-base lg:text-lg text-[#D6DCE5]">
                Sea, air, road or rail. You don&apos;t need to know freight terms. Just describe it in
                your own words.
              </p>
            </div>
            <HomeEnquiryForm />
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 lg:py-16">
          <h2 className="text-2xl font-bold text-[#081D3A]">How it works</h2>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-8">
            {STEPS.map(({ title, desc }, i) => (
              <div key={title}>
                <span className="font-heading text-xl font-bold text-[#FF6A00]">{i + 1}</span>
                <h3 className="mt-1 text-lg font-semibold text-[#081D3A]">{title}</h3>
                <p className="mt-1 text-sm text-[#6B7280]">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#081D3A]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <h2 className="text-xl font-bold text-white">Are you a freight operator?</h2>
              <p className="mt-1 text-sm text-[#D6DCE5] max-w-xl">
                Show customers the services you offer and the routes you cover. Listing is free during
                our founding period.
              </p>
            </div>
            <Link
              href="/for-operators"
              className="inline-flex items-center justify-center gap-2 shrink-0 text-sm font-semibold text-white bg-[#FF6A00] px-5 py-3 rounded-xl hover:opacity-90 transition-opacity"
            >
              For operators <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
