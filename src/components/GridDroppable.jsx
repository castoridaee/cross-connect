import { useDroppable } from '@dnd-kit/core';
import { DraggableTile } from './DraggableTile';
import { WordTile } from './WordTile';

export const GridDroppable = ({ id, word, isError, activeDrag, isFlashing }) => {
  const { setNodeRef } = useDroppable({ id });

  return (
    <div ref={setNodeRef} className="w-full h-full">
      {word && !activeDrag ? (
        <DraggableTile id={word} label={word} inGrid isError={isError} />
      ) : (
        <WordTile label="" variant={isFlashing ? "error" : "ghost"} inGrid={true} />
      )}
    </div>
  );
};