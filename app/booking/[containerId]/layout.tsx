import Stage3Gate from '@/components/Stage3Gate';

// Admin only while Stage 3 is not public.
export default function BookingLayout({ children }: { children: React.ReactNode }) {
  return <Stage3Gate allow={[]}>{children}</Stage3Gate>;
}
