import Image from 'next/image';
import type { ReactNode } from 'react';

type Props = {
  title:        string;
  label?:       string;
  description?: ReactNode;
  gradient?:    boolean;
  showMap?:     boolean;
  rightSlot?:   ReactNode;
  children?:    ReactNode;
};

export default function PageHero({
  title, label, description,
  gradient = false, showMap = false,
  rightSlot, children,
}: Props) {
  const bg = gradient
    ? 'linear-gradient(135deg, #0b103a 0%, #1a3a6b 100%)'
    : '#0b103a';

  return (
    <div
      className={`relative overflow-hidden ${showMap ? 'py-10' : 'py-8'} px-4`}
      style={{ background: bg }}
    >
      {showMap && (
        <div className="absolute inset-0 pointer-events-none" style={{ mixBlendMode: 'screen', opacity: 0.15 }}>
          <Image src="/world-map-overlay.png" alt="" fill sizes="100vw" className="object-cover" />
        </div>
      )}
      <div className="relative max-w-6xl mx-auto z-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {label && <p className="text-gray-400 text-sm mb-1 font-medium">{label}</p>}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white">{title}</h1>
            {description && <p className="text-gray-400 text-sm mt-1">{description}</p>}
          </div>
          {rightSlot}
        </div>
        {children}
      </div>
    </div>
  );
}
