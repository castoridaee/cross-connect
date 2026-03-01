import { useDroppable } from '@dnd-kit/core';

export const WordBank = ({ children }) => {
  const { setNodeRef } = useDroppable({ id: 'word-bank' });

  return (
    <footer
      ref={setNodeRef}
      id="word-bank"
      className="flex flex-wrap justify-center gap-2 max-w-md p-6 bg-white rounded-3xl border mb-10 min-h-[100px] w-full"
    >
      {children}
    </footer>
  );
};