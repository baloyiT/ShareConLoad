import Link from 'next/link';
import StarDisplay from '@/components/StarDisplay';

import { ArrowRight } from 'lucide-react';
export type Container = {
  id: string;
  origin_city: string;
  origin_country: string;
  destination_city: string;
  destination_country: string;
  departure_date: string;
  arrival_date?: string;
  available_capacity_cbm: number;
  total_capacity_cbm: number;
  price_per_cbm: number;
  currency_code?: string;
  price_per_cbm_usd?: number;
  status: string;
  operator_name?: string;
  operator_id?: string;
  average_stars?: number;
  review_count?: number;
};

type ContainerCardProps = {
  container: Container;
};

export default function ContainerCard({ container }: ContainerCardProps) {
  const formattedDeparture = new Date(container.departure_date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const formattedArrival = container.arrival_date
    ? new Date(container.arrival_date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="card bg-white shadow-sm border border-gray-100 hover:shadow-md transition-shadow duration-200 rounded-xl overflow-hidden">
      <div className="card-body p-5 gap-3">
        {/* Status + price */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-1.5">
            <span className="badge badge-sm text-white font-semibold px-2" style={{ backgroundColor: '#22c55e' }}>
              LIVE
            </span>
            {(container.origin_country === 'Test Country' || container.destination_country === 'Test Country') && (
              <span className="badge badge-sm font-semibold px-2 border" style={{ backgroundColor: '#fef9c3', color: '#854d0e', borderColor: '#fde047' }}>
                TEST
              </span>
            )}
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold" style={{ color: '#ff6a00' }}>
              {container.currency_code ?? 'ZAR'} {container.price_per_cbm.toLocaleString()}
            </span>
            <span className="text-xs text-gray-400 block">/CBM</span>
            {container.price_per_cbm_usd != null && (container.currency_code ?? 'ZAR') !== 'USD' && (
              <span className="text-xs text-gray-400">≈ USD {container.price_per_cbm_usd.toFixed(2)}</span>
            )}
          </div>
        </div>

        {/* Route */}
        <div className="mt-1">
          <div className="flex items-center gap-2 flex-wrap text-lg font-bold text-gray-800">
            <span>{container.origin_city}</span>
            <ArrowRight className="w-4 h-4 text-gray-400 shrink-0" />
            <span>{container.destination_city}</span>
          </div>
          <p className="text-sm text-gray-400 mt-0.5">
            {container.origin_country} → {container.destination_country}
          </p>
        </div>

        {/* Dates */}
        <div className="flex gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide">Departure</p>
            <p className="font-medium text-gray-700">{formattedDeparture}</p>
          </div>
          {formattedArrival && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Arrival</p>
              <p className="font-medium text-gray-700">{formattedArrival}</p>
            </div>
          )}
        </div>

        {/* Capacity */}
        <div className="bg-gray-50 rounded-lg px-3 py-2.5">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-500">Available space</span>
            <span className="font-semibold text-gray-800">
              {container.available_capacity_cbm} / {container.total_capacity_cbm} CBM
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${((container.total_capacity_cbm - container.available_capacity_cbm) / container.total_capacity_cbm) * 100}%`,
                backgroundColor: container.available_capacity_cbm / container.total_capacity_cbm < 0.2 ? '#ef4444' : '#ff6a00',
              }}
            />
          </div>
        </div>

        {/* Operator + CTA */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex flex-col gap-1 min-w-0 flex-1">
            {container.operator_name ? (
              <p className="text-xs text-gray-400 truncate max-w-[120px]">{container.operator_name}</p>
            ) : (
              <span />
            )}
            {container.average_stars != null && container.review_count != null && container.review_count > 0 && (
              <div style={{ marginTop: '4px' }}>
                <StarDisplay average={container.average_stars} count={container.review_count} size="sm" />
              </div>
            )}
          </div>
          <Link
            href={`/container/${container.id}`}
            className="text-sm font-semibold hover:underline"
            style={{ color: '#ff6a00' }}
          >
            View Details →
          </Link>
        </div>
      </div>
    </div>
  );
}
