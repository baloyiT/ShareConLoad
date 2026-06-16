import ContainerCard, { Container } from './ContainerCard';

import { Briefcase } from 'lucide-react';
type ContainerListProps = {
  containers: Container[];
};

export default function ContainerList({ containers }: ContainerListProps) {
  if (containers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{ backgroundColor: '#fff7ed' }}
        >
          <Briefcase className="w-8 h-8" style={{ color: '#ff6a00' }} strokeWidth={1.5} />
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-1">No containers available</h3>
        <p className="text-sm text-gray-400 max-w-xs leading-relaxed">
          There are no open shipment slots right now. Check back soon or register as an operator to list your own.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      {containers.map((container) => (
        <ContainerCard key={container.id} container={container} />
      ))}
    </div>
  );
}
