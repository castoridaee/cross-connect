import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WordTile } from './WordTile';

export const DraggableTile = ({ id, label, inGrid, isError, isDraggingOverlay }) => {
  const { attributes, listeners, setNodeRef, isDragging, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    touchAction: 'none'
  };

  const variant = isDraggingOverlay || (inGrid && !isError) ? 'active' : (isError ? 'error' : 'default');

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab active:cursor-grabbing ${isDragging ? 'opacity-0' : 'opacity-100'}`}
    >
      <WordTile label={label} variant={variant} inGrid={inGrid} />
    </div>
  );
};