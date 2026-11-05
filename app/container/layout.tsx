import Stage3Gate from '@/components/Stage3Gate';

export default function ContainerLayout({ children }: { children: React.ReactNode }) {
  return <Stage3Gate allow={['has_booking', 'has_containers']}>{children}</Stage3Gate>;
}
