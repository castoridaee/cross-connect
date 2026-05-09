import { useDroppable } from '@dnd-kit/core';

export const WordBank = ({ children }) => {
  const { setNodeRef } = useDroppable({ id: 'word-bank' });

  return (
    <footer
      ref={setNodeRef}
      id="word-bank"
      className="flex flex-wrap justify-center items-start content-start gap-1 max-w-[425px] min-w-[265px] w-fit p-2 bg-white rounded-xl border mb-4 min-h-[40px] transition-all duration-300"
    >
      {children}
    </footer>
  );
};