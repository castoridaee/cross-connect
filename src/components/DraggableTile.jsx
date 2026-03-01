import { useDraggable } from '@dnd-kit/core';

export const DraggableTile = ({ id, label, inGrid, isError, isDraggingOverlay }) => {
  const { attributes, listeners, setNodeRef } = useDraggable({ id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`w-16 h-16 flex items-center justify-center text-center p-1 rounded-md font-bold text-[9px] uppercase transition-all cursor-grab active:cursor-grabbing
        ${isDraggingOverlay ? 'bg-indigo-600 text-white shadow-2xl scale-110 opacity-100 z-[3000]' :
          inGrid ? (isError ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white') :
            'bg-white text-slate-800 border border-slate-300 shadow-sm'}`}
    >
      {label}
    </div>
  );
};