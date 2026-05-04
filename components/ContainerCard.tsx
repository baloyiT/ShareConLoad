import Link from 'next/link';

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
  status: string;
  operator_name?: string;
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
          <span className="badge badge-sm text-white font-semibold px-2" style={{ backgroundColor: '#22c55e' }}>
            LIVE
          </span>
          <div className="text-right">
            <span className="text-2xl font-bold" style={{ color: '#f97316' }}>
              ${container.price_per_cbm}
            </span>
            <span className="text-xs text-gray-400 block">/CBM</span>
          </div>
        </div>

        {/* Route */}
        <div className="mt-1">
          <div className="flex items-center gap-2 text-lg font-bold text-gray-800">
            <span>{container.origin_city}</span>
            <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
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
        <div className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
          <span className="text-gray-500">Available space</span>
          <span className="font-semibold text-gray-800">
            {container.available_capacity_cbm} CBM
          </span>
        </div>

        {/* Operator + CTA */}
        <div className="flex items-center justify-between pt-1">
          {container.operator_name ? (
            <p className="text-xs text-gray-400 truncate max-w-[120px]">{container.operator_name}</p>
          ) : (
            <span />
          )}
          <Link
            href={`/container/${container.id}`}
            className="text-sm font-semibold hover:underline"
            style={{ color: '#f97316' }}
          >
            View Details →
          </Link>
        </div>
      </div>
    </div>
  );
}
