import { useDroppable } from '@dnd-kit/core';
import { DraggableTile } from './DraggableTile';

export const GridDroppable = ({ id, word, isError, activeDrag }) => {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div ref={setNodeRef} className={`w-16 h-16 border-2 rounded-lg flex items-center justify-center overflow-hidden transition-colors
      ${isError ? 'bg-red-500 border-red-700' : 'bg-slate-100 border-slate-200'}`}>
      {word && !activeDrag && <DraggableTile id={word} label={word} inGrid isError={isError} />}
    </div>
  );
};