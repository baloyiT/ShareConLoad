import Stage3Gate from '@/components/Stage3Gate';

export default function TransporterOnboardingLayout({ children }: { children: React.ReactNode }) {
  return <Stage3Gate allow={['transporter']}>{children}</Stage3Gate>;
}
