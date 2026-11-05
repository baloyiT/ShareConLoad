import Stage3Gate from '@/components/Stage3Gate';

export default function MeasurementAgentOnboardingLayout({ children }: { children: React.ReactNode }) {
  return <Stage3Gate allow={['measurement_agent']}>{children}</Stage3Gate>;
}
