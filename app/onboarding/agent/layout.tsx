import Stage3Gate from '@/components/Stage3Gate';

export default function AgentOnboardingLayout({ children }: { children: React.ReactNode }) {
  return <Stage3Gate allow={['agent']}>{children}</Stage3Gate>;
}
