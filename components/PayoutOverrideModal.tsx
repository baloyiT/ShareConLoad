'use client';

import { useState } from 'react';

export function formatCountdown(ms: number): string {
  const clamped = Math.max(0, ms);

  const totalMinutes = Math.floor(clamped / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes - days * 24 * 60) / 60);
  const minutes = totalMinutes - days * 24 * 60 - hours * 60;

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

type PayoutOverrideModalProps = {
  msRemaining: number;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  submitting: boolean;
  error: string | null;
};

const MIN_REASON_LENGTH = 10;

export default function PayoutOverrideModal({
  msRemaining,
  onCancel,
  onConfirm,
  submitting,
  error,
}: PayoutOverrideModalProps) {
  const [reason, setReason] = useState('');

  const canConfirm = reason.trim().length >= MIN_REASON_LENGTH && !submitting;

  function handleConfirm() {
    if (!canConfirm) return;
    onConfirm(reason);
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-base mb-4">Force Trigger Payout</h3>

        <p className="text-sm mb-4">
          This will bypass {formatCountdown(msRemaining)} of refund-window protection.
          Please provide a justification reason before continuing.
        </p>

        <textarea
          className="textarea textarea-bordered w-full text-sm"
          placeholder={`Justification reason (minimum ${MIN_REASON_LENGTH} characters)`}
          aria-label="Justification reason"
          rows={3}
          value={reason}
          onChange={e => setReason(e.target.value)}
        />

        {error && <p className="text-error text-sm mt-2">{error}</p>}

        <div className="modal-action">
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm btn-error text-white"
            disabled={!canConfirm}
            onClick={handleConfirm}
          >
            {submitting ? 'Triggering…' : 'Force trigger'}
          </button>
        </div>
      </div>
      <label className="modal-backdrop" aria-label="Close modal" onClick={onCancel} />
    </div>
  );
}
