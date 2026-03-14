import { useState, useEffect } from 'react';
import { createPuzzle, updatePuzzle, clearPuzzleProgress } from '../lib/puzzleService';

export function usePuzzleDraft({
  user,
  initialData,
  title,
  rows,
  cols,
  grid,
  categories,
  wordOrder,
  isSubmitting,
  isPublishSuccess,
  publishedId,
  setPublishedId,
  setStatusMsg,
  onComplete
}) {
  const [editingId, setEditingId] = useState(initialData?.id || null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  // iterative draft saving
  useEffect(() => {
    if (!user) return;
    
    // Auto-save logic
    const wordCount = Object.keys(grid).length;
    const hasContent = !!title.trim() || wordCount > 0 || categories.length > 0;
    
    // Don't autosave if we're in the middle of a check or if published successfully in this session
    if (hasContent && !isSubmitting && !isPublishSuccess) {
      setIsSaving(true);
      const timer = setTimeout(async () => {
        const defaultTitle = new Date().toLocaleString([], { 
          month: 'short', day: 'numeric', year: 'numeric', 
          hour: '2-digit', minute: '2-digit' 
        });
        
        const payload = {
          title: title.trim() || defaultTitle,
          grid_data: grid,
          layout: Array.from({ length: rows }, (_, r) =>
            Array.from({ length: cols }, (_, c) => grid[`${r}-${c}`] ? 1 : 0)
          ),
          categories: categories,
          word_order: wordOrder,
          is_published: initialData?.is_published || false,
          created_by: user.id
        };
        
        try {
          if (editingId) {
            await updatePuzzle(editingId, payload);
            await clearPuzzleProgress(editingId);
          } else {
            const { data } = await createPuzzle(payload);
            if (data?.id) setEditingId(data.id);
          }
          setLastSavedAt(new Date());
        } catch (err) {
          console.error("Autosave error:", err);
        } finally {
          setIsSaving(false);
        }
      }, 2000); // 2s debounce
      return () => clearTimeout(timer);
    }
  }, [
    title, grid, rows, cols, categories, wordOrder, 
    user, editingId, isSubmitting, isPublishSuccess, initialData?.is_published
  ]);

  // Auto-claim puzzle if user just logged in and we have a pending publishedId
  useEffect(() => {
    if (publishedId && user && !user.is_anonymous) {
      const claim = async () => {
        const { error } = await updatePuzzle(publishedId, { created_by: user.id });
        if (!error) {
          setPublishedId(null);
          setStatusMsg({ type: 'success', text: "Puzzle successfully claimed and linked to your account!" });
          setTimeout(() => {
            onComplete?.();
          }, 2000);
        }
      };
      claim();
    }
  }, [publishedId, user, onComplete, setPublishedId, setStatusMsg]);

  return { editingId, setEditingId, isSaving, lastSavedAt };
}
