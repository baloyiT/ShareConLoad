'use client';

import { Check, Lock, Ship, Unlock, type LucideIcon } from 'lucide-react';

type Payment = {
  id: string;
  stage: 'deposit_20' | 'pre_departure_50' | 'final_release_30';
  amount: number;
  status: 'pending' | 'paid' | 'refunded' | 'failed';
  due_date: string | null;
  paid_at: string | null;
};

const STAGE_META: Record<string, { label: string; percent: string; description: string; icon: LucideIcon }> = {
  deposit_20: {
    label:       'Stage 1 — Booking Deposit',
    percent:     '20%',
    description: 'Secures your space in the container. Due within 24 hours of booking.',
    icon:        Lock,
  },
  pre_departure_50: {
    label:       'Stage 2 — Pre-Departure',
    percent:     '50%',
    description: 'Due 7 days before departure. Must be paid for cargo to be loaded.',
    icon:        Ship,
  },
  final_release_30: {
    label:       'Stage 3 — Final Release',
    percent:     '30%',
    description: 'Due upon cargo arrival. Required before release is authorised.',
    icon:        Unlock,
  },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Pending',  color: '#f59e0b', bg: '#fffbeb' },
  paid:     { label: 'Paid',     color: '#22c55e', bg: '#f0fdf4' },
  refunded: { label: 'Refunded', color: '#6b7280', bg: '#f9fafb' },
  failed:   { label: 'Failed',   color: '#ef4444', bg: '#fef2f2' },
};

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

type Props = {
  payment: Payment;
  isPayable: boolean;
  lockReason?: string;
  onPay: (paymentId: string) => void;
  paying: boolean;
};

export default function PaymentStageCard({ payment, isPayable, lockReason, onPay, paying }: Props) {
  const meta   = STAGE_META[payment.stage];
  const status = STATUS_CONFIG[payment.status] ?? STATUS_CONFIG.pending;
  const StageIcon = meta.icon;

  return (
    <div
      className="bg-white rounded-2xl border overflow-hidden"
      style={{ borderColor: isPayable && payment.status === 'pending' ? '#ff6a00' : '#e5e7eb' }}
    >
      {/* Top stripe */}
      <div
        className="h-1 w-full"
        style={{ backgroundColor: payment.status === 'paid' ? '#22c55e' : isPayable ? '#ff6a00' : '#e5e7eb' }}
      />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <StageIcon className="w-5 h-5 text-gray-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-gray-800">{meta.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{meta.description}</p>
            </div>
          </div>
          <span
            className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full shrink-0 whitespace-nowrap"
            style={{ backgroundColor: status.bg, color: status.color }}
          >
            {status.label}
          </span>
        </div>

        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400">{meta.percent} of total</p>
            <p className="text-2xl font-extrabold" style={{ color: payment.status === 'paid' ? '#22c55e' : '#111827' }}>
              R{payment.amount.toFixed(2)}
            </p>
            {payment.due_date && payment.status === 'pending' && (
              <p className="text-xs text-red-400 mt-0.5">Due {fmt(payment.due_date)}</p>
            )}
            {payment.paid_at && (
              <p className="text-xs text-gray-400 mt-0.5">Paid {fmt(payment.paid_at)}</p>
            )}
          </div>

          {isPayable && payment.status === 'pending' && (
            <button
              onClick={() => onPay(payment.id)}
              disabled={paying}
              className="btn text-white font-bold rounded-xl hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: '#ff6a00' }}
            >
              {paying
                ? <span className="loading loading-spinner loading-sm" />
                : `Pay R${payment.amount.toFixed(2)} →`}
            </button>
          )}

          {payment.status === 'paid' && (
            <div className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
              <Check className="w-4 h-4" strokeWidth={2.5} />
              Confirmed
            </div>
          )}

          {!isPayable && payment.status === 'pending' && (
            <span className="flex items-center gap-1.5 text-xs text-gray-400 max-w-[180px] text-right leading-tight">
              <Lock className="w-3 h-3 shrink-0" /> {lockReason ?? 'Complete previous stage first'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
