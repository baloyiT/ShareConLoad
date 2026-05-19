'use client';

import { useState } from 'react';
import { supabase } from '@/services/supabaseClient';

type Props = {
  bookingId: string;
  rateeId: string;
  title: string;
  onClose: () => void;
  onSubmitted: () => void;
};

export default function RatingModal({ bookingId, rateeId, title, onClose, onSubmitted }: Props) {
  const [stars, setStars]     = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  async function handleSubmit() {
    if (stars === 0) {
      setError('Please select a star rating.');
      return;
    }
    setLoading(true);
    setError(null);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('You must be signed in to submit a rating.');
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from('booking_ratings').insert({
      booking_id: bookingId,
      rater_id:   user.id,
      ratee_id:   rateeId,
      stars,
      comment:    comment.trim() || null,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    onSubmitted();
  }

  return (
    <div className="modal modal-open">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold text-base mb-4">{title}</h3>

        <div className="flex gap-1.5 mb-4">
          {[1, 2, 3, 4, 5].map(i => (
            <button
              key={i}
              onClick={() => setStars(i)}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(0)}
              aria-label={`${i} star${i > 1 ? 's' : ''}`}
              className="bg-transparent border-0 cursor-pointer p-0 leading-none text-4xl"
              style={{ color: i <= (hovered || stars) ? '#f59e0b' : '#d1d5db' }}
            >
              ★
            </button>
          ))}
        </div>

        <textarea
          className="textarea textarea-bordered w-full text-sm"
          placeholder="Optional comment (max 1000 characters)"
          rows={3}
          maxLength={1000}
          value={comment}
          onChange={e => setComment(e.target.value)}
        />

        {error && <p className="text-error text-sm mt-2">{error}</p>}

        <div className="modal-action">
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn btn-sm border-0"
            style={{ background: '#f59e0b', color: 'white' }}
            disabled={loading || stars === 0}
            onClick={handleSubmit}
          >
            {loading ? 'Submitting…' : 'Submit rating'}
          </button>
        </div>
      </div>
      <label className="modal-backdrop" onClick={onClose} />
    </div>
  );
}
