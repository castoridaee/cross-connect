import { WordTile } from './WordTile';

export const DraggableTile = ({ id, label, inGrid, isError, isDraggingOverlay }) => {
  const { attributes, listeners, setNodeRef } = useDraggable({ id });

  const variant = isDraggingOverlay || (inGrid && !isError) ? 'active' : (isError ? 'error' : 'default');

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className="cursor-grab active:cursor-grabbing"
    >
      <WordTile label={label} variant={variant} />
    </div>
  );
};