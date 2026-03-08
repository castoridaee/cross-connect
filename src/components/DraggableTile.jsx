import { useDraggable } from '@dnd-kit/core';
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
      style={{ touchAction: 'none' }}
    >
      <WordTile label={label} variant={variant} inGrid={inGrid} />
    </div>
  );
};