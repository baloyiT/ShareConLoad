import ContainerCard, { Container } from './ContainerCard';

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
          <svg className="w-8 h-8" style={{ color: '#f97316' }} fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
          </svg>
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
