import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { WordTile } from './WordTile';

export function EditorDraggableTile({ id, label, r, c, onEdit }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `editor-${id}-${r}-${c}`,
    data: { type: 'grid', r, c, word: label }
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`w-full h-full relative group ${isDragging ? 'opacity-0' : 'opacity-100'}`}
      style={{ touchAction: 'none' }}
      onClick={(e) => {
        // Prevent trigger if it's just a click (DnD handles drag)
        // In dnd-kit, click is distinct from drag start
        onEdit(r, c);
      }}
    >
      <WordTile label={label} variant="active" inGrid={true} />
    </div>
  );
}
