'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/services/supabaseClient';
import { containsContactInfo } from '@/services/messageFilter';
import { notify } from '@/services/notificationService';

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

type Props = {
  bookingId: string;
  bookingRef: string;
  currentUserId: string;
  recipientId: string;
  readOnly?: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MessageThread({
  bookingId,
  bookingRef,
  currentUserId,
  recipientId,
  readOnly = false,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [filterWarn, setFilterWarn] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  // ─── Load messages ──────────────────────────────────────────────────────────

  async function loadMessages() {
    const { data, error } = await supabase
      .from('booking_messages')
      .select('id, sender_id, content, created_at')
      .eq('booking_id', bookingId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[MessageThread] loadMessages failed:', error);
      return;
    }
    setMessages(data ?? []);
  }

  useEffect(() => {
    loadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  // ─── Auto-scroll ────────────────────────────────────────────────────────────

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ─── Draft handling ─────────────────────────────────────────────────────────

  function handleDraftChange(value: string) {
    setDraft(value);
    setFilterWarn(containsContactInfo(value));
    setSendError(null);
  }

  // ─── Send ────────────────────────────────────────────────────────────────────

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed || filterWarn) return;

    setSending(true);
    setSendError(null);

    const { error } = await supabase.from('booking_messages').insert({
      booking_id: bookingId,
      sender_id: currentUserId,
      content: trimmed,
    });

    if (error) {
      console.error('[MessageThread] send failed:', error);
      if (error.message.includes('Contact details')) {
        setSendError('Contact details (phone numbers, emails, or links) are not allowed in messages.');
      } else {
        setSendError('Failed to send. Please try again.');
      }
      setSending(false);
      return;
    }

    try {
      await notify('message.new', { bookingId, recipientId, bookingRef });
    } catch (e) {
      console.error('[MessageThread] notify failed:', e);
    }
    setDraft('');
    setFilterWarn(false);
    setSending(false);
    await loadMessages();
  }

  // ─── Keyboard handler ────────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col border rounded-xl overflow-hidden" style={{ height: '360px' }}>
      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
        {messages.length === 0 ? (
          <p className="text-sm text-gray-400 text-center mt-8">No messages yet.</p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] px-3 py-2 text-sm ${
                    isOwn ? 'text-white' : 'bg-white border text-gray-800'
                  }`}
                  style={{
                    borderRadius: isOwn ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    backgroundColor: isOwn ? '#1fa8ff' : undefined,
                  }}
                >
                  <p className="leading-snug">{msg.content}</p>
                  <p
                    className={`text-xs mt-1 ${isOwn ? '' : 'text-gray-400'}`}
                    style={isOwn ? { color: 'rgba(255,255,255,0.75)' } : undefined}
                  >
                    {fmt(msg.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      {!readOnly && (
        <div className="border-t bg-white p-3 space-y-2">
          {filterWarn && (
            <p className="text-xs text-amber-600">
              Contact details (phone numbers, emails, or links) are not allowed in messages.
            </p>
          )}
          {sendError && (
            <p className="text-xs text-red-500">{sendError}</p>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              className="textarea textarea-bordered flex-1 resize-none text-sm"
              rows={2}
              maxLength={2000}
              placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
              value={draft}
              onChange={(e) => handleDraftChange(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
            />
            <button
              onClick={handleSend}
              disabled={sending || !draft.trim() || filterWarn}
              className="btn text-white border-0 hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#1fa8ff' }}
            >
              {sending ? (
                <span className="loading loading-spinner loading-sm" />
              ) : (
                'Send'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
