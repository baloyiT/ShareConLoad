import ContainerCard, { Container } from './ContainerCard';

type ContainerListProps = {
  containers: Container[];
};

export default function ContainerList({ containers }: ContainerListProps) {
  if (containers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="text-6xl mb-4">📦</div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No containers found</h3>
        <p className="text-gray-400 text-sm max-w-xs">
          Try adjusting your search or check back soon for new shipment slots.
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
