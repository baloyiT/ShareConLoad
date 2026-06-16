'use client';

import { AlertTriangle, Check } from 'lucide-react';

type Milestone = {
  id: string;
  milestone: string;
  notes: string | null;
  occurred_at: string;
};

const MILESTONE_LABELS: Record<string, string> = {
  booking_confirmed:    'Booking Confirmed',
  cargo_received:       'Cargo Received',
  container_loaded:     'Container Loaded',
  vessel_departed:      'Vessel Departed',
  customs_hold:         'Customs Hold',
  destination_arrival:  'Arrived at Destination',
  customs_cleared:      'Customs Cleared',
  release_authorized:   'Release Authorized',
  cargo_collected:      'Cargo Collected',
  shipment_completed:   'Shipment Completed',
};

const MILESTONE_ORDER = [
  'booking_confirmed',
  'cargo_received',
  'container_loaded',
  'vessel_departed',
  'customs_hold',
  'destination_arrival',
  'customs_cleared',
  'release_authorized',
  'cargo_collected',
  'shipment_completed',
];

type Props = { milestones: Milestone[] };

export default function MilestoneTimeline({ milestones }: Props) {
  const achieved = new Set(milestones.map((m) => m.milestone));

  return (
    <div className="flex flex-col gap-0">
      {MILESTONE_ORDER.map((key, i) => {
        const record  = milestones.find((m) => m.milestone === key);
        const done    = achieved.has(key);
        const isHold  = key === 'customs_hold' && done;
        const isLast  = i === MILESTONE_ORDER.length - 1;

        return (
          <div key={key} className="flex gap-4">
            {/* Node + connector */}
            <div className="flex flex-col items-center">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                style={{
                  backgroundColor: done ? (isHold ? '#ef4444' : '#22c55e') : '#e5e7eb',
                  color: done ? '#fff' : '#9ca3af',
                }}
              >
                {done ? (isHold ? <AlertTriangle className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" strokeWidth={3} />) : i + 1}
              </div>
              {!isLast && (
                <div
                  className="w-0.5 flex-1 my-1 min-h-[1.5rem]"
                  style={{ backgroundColor: done ? (isHold ? '#fca5a5' : '#86efac') : '#e5e7eb' }}
                />
              )}
            </div>

            {/* Content */}
            <div className={`pb-4 flex-1 ${isLast ? 'pb-0' : ''}`}>
              <p className={`text-sm font-semibold ${done ? 'text-gray-900' : 'text-gray-400'}`}>
                {MILESTONE_LABELS[key]}
              </p>
              {record && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(record.occurred_at).toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })}
                  {record.notes && ` — ${record.notes}`}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
