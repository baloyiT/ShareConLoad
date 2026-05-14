import { supabase } from './supabaseClient';

// ─── Event catalogue ──────────────────────────────────────────────────────────
// Add new event keys here as the platform grows.

export type NotificationEventMap = {
  'booking.created': {
    bookingId: string;
    recipientId: string;
    route: string;
    totalCbm: number;
    totalPrice: number;
  };
  'booking.status_updated': {
    bookingId: string;
    recipientId: string;
    route: string;
    oldStatus: string;
    newStatus: string;
  };
  'booking.cancelled': {
    bookingId: string;
    recipientId: string;
    route: string;
  };
  'payment.due': {
    bookingId: string;
    recipientId: string;
    stage: string;
    amount: number;
    dueDate: string;
  };
  'payment.confirmed': {
    bookingId: string;
    recipientId: string;
    stage: string;
    amount: number;
  };
  'container.departure_notice': {
    bookingId:     string;
    recipientId:   string;
    route:         string;
    departureDate: string;
  };
  'customs.alert': {
    bookingId: string;
    recipientId: string;
    eventType: string;
    description: string;
  };
  'cargo.released': {
    bookingId: string;
    recipientId: string;
    route: string;
  };
  'dispute.update': {
    disputeId: string;
    recipientId: string;
    newStatus: string;
  };
};

export type NotificationEvent = keyof NotificationEventMap;

// ─── Channel interface ────────────────────────────────────────────────────────
// Every channel implements this. Adding email or SMS means adding one object
// that satisfies this interface and appending it to ACTIVE_CHANNELS below.

interface NotificationChannel {
  name: string;
  send<E extends NotificationEvent>(
    event: E,
    payload: NotificationEventMap[E]
  ): Promise<void>;
}

// ─── Human-readable message builder ──────────────────────────────────────────

function buildMessage(event: NotificationEvent, payload: NotificationEventMap[typeof event]): {
  title: string;
  body: string;
} {
  switch (event) {
    case 'booking.created':
      return {
        title: 'Booking Submitted',
        body: `Your booking for ${(payload as NotificationEventMap['booking.created']).route} (${(payload as NotificationEventMap['booking.created']).totalCbm} CBM) has been received and is pending confirmation.`,
      };
    case 'booking.status_updated': {
      const p = payload as NotificationEventMap['booking.status_updated'];
      const statusLabel: Record<string, string> = {
        confirmed:  'confirmed by the operator',
        loaded:     'loaded into the container',
        in_transit: 'on its way',
        delivered:  'delivered',
      };
      return {
        title: `Shipment ${statusLabel[p.newStatus] ?? p.newStatus}`,
        body: `Your shipment on ${p.route} has been updated from ${p.oldStatus} to ${p.newStatus}.`,
      };
    }
    case 'booking.cancelled':
      return {
        title: 'Booking Cancelled',
        body: `Your booking for ${(payload as NotificationEventMap['booking.cancelled']).route} has been cancelled.`,
      };
    case 'payment.due': {
      const p = payload as NotificationEventMap['payment.due'];
      const stageLabel: Record<string, string> = {
        deposit_20:       '20% deposit',
        pre_departure_50: '50% pre-departure',
        final_release_30: '30% final release',
      };
      return {
        title: 'Payment Due',
        body:  `Your ${stageLabel[p.stage] ?? p.stage} payment of R${p.amount.toFixed(2)} is due by ${new Date(p.dueDate).toLocaleDateString('en-GB')}.`,
      };
    }
    case 'payment.confirmed': {
      const p = payload as NotificationEventMap['payment.confirmed'];
      return {
        title: 'Payment Confirmed',
        body:  `Your payment of R${p.amount.toFixed(2)} has been confirmed for booking ${p.bookingId.slice(0, 8).toUpperCase()}.`,
      };
    }
    case 'customs.alert': {
      const p = payload as NotificationEventMap['customs.alert'];
      return {
        title: 'Customs Alert',
        body:  `A customs event (${p.eventType.replace('_', ' ')}) has been recorded for your shipment. ${p.description}`,
      };
    }
    case 'cargo.released': {
      const p = payload as NotificationEventMap['cargo.released'];
      return {
        title: 'Cargo Released',
        body:  `Your cargo on ${p.route} has been authorized for release. You may now collect your goods.`,
      };
    }
    case 'dispute.update': {
      const p = payload as NotificationEventMap['dispute.update'];
      return {
        title: 'Dispute Updated',
        body:  `Your dispute has been updated to status: ${p.newStatus.replace('_', ' ')}.`,
      };
    }
    case 'container.departure_notice': {
      const p = payload as NotificationEventMap['container.departure_notice'];
      return {
        title: 'Departure in 7 Days — Payment Due',
        body:  `Your container on ${p.route} departs on ${new Date(p.departureDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}. Please complete your 50% pre-departure payment to ensure your cargo is loaded.`,
      };
    }
    default:
      return { title: 'Notification', body: '' };
  }
}

// ─── Channel: Console ─────────────────────────────────────────────────────────
// Always active. Zero cost, works without DB.

const consoleChannel: NotificationChannel = {
  name: 'console',
  async send(event, payload) {
    const { title, body } = buildMessage(event, payload);
    console.info(`[Notification] ${event} | ${title}: ${body}`, payload);
  },
};

// ─── Channel: Database ────────────────────────────────────────────────────────
// Stores notifications in the `notifications` table.
// Requires the table from the SQL setup block below.
//
// SQL (run in Supabase SQL Editor):
//
//   CREATE TABLE notifications (
//     id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//     recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
//     event        TEXT NOT NULL,
//     title        TEXT NOT NULL,
//     body         TEXT NOT NULL,
//     metadata     JSONB DEFAULT '{}',
//     read         BOOLEAN NOT NULL DEFAULT FALSE,
//     created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
//   );
//
//   ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
//
//   CREATE POLICY "Users can view own notifications"
//     ON notifications FOR SELECT USING (auth.uid() = recipient_id);
//
//   CREATE POLICY "Users can mark own notifications read"
//     ON notifications FOR UPDATE USING (auth.uid() = recipient_id);

const databaseChannel: NotificationChannel = {
  name: 'database',
  async send(event, payload) {
    const { title, body } = buildMessage(event, payload);
    const { error } = await supabase.from('notifications').insert({
      recipient_id: payload.recipientId,
      event,
      title,
      body,
      metadata: payload,
    });
    if (error) {
      // Non-fatal: log and continue so other channels still fire.
      console.error(`[Notification] database channel failed for ${event}:`, error.message);
    }
  },
};

// ─── Channel: Email (future) ──────────────────────────────────────────────────
// Uncomment and implement when an email provider is available.
// Replace the console.info with an API call to Resend / SendGrid / etc.
//
// const emailChannel: NotificationChannel = {
//   name: 'email',
//   async send(event, payload) {
//     const { title, body } = buildMessage(event, payload);
//     await fetch('/api/email', {
//       method: 'POST',
//       body: JSON.stringify({ to: payload.recipientId, subject: title, text: body }),
//     });
//   },
// };

// ─── Channel: SMS (future) ────────────────────────────────────────────────────
// Uncomment and implement when a Twilio / Africa's Talking account is ready.
//
// const smsChannel: NotificationChannel = {
//   name: 'sms',
//   async send(event, payload) {
//     const { body } = buildMessage(event, payload);
//     await twilioClient.messages.create({ to: phoneNumber, body });
//   },
// };

// ─── Active channels ──────────────────────────────────────────────────────────
// Add / remove channels here. Order determines dispatch order.

const ACTIVE_CHANNELS: NotificationChannel[] = [
  consoleChannel,
  databaseChannel,
  // emailChannel,
  // smsChannel,
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fire a notification event across all active channels.
 * Failures in individual channels are caught and logged; they never
 * throw back to the caller or block the booking flow.
 */
export async function notify<E extends NotificationEvent>(
  event: E,
  payload: NotificationEventMap[E]
): Promise<void> {
  await Promise.allSettled(
    ACTIVE_CHANNELS.map((channel) =>
      channel.send(event, payload).catch((err) =>
        console.error(`[Notification] channel "${channel.name}" threw for ${event}:`, err)
      )
    )
  );
}

/**
 * Mark a notification as read. Called from a notification bell/drawer UI.
 */
export async function markAsRead(notificationId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) console.error('[Notification] markAsRead failed:', error.message);
}

/**
 * Fetch unread notifications for the current user.
 */
export async function fetchUnread(recipientId: string) {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, event, title, body, created_at')
    .eq('recipient_id', recipientId)
    .eq('read', false)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Notification] fetchUnread failed:', error.message);
    return [];
  }
  return data;
}
