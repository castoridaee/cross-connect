import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const fetchPuzzle = async (id = null) => {
  let query = supabase.from('puzzles').select('*').eq('is_published', true);

  if (id) {
    query = query.eq('id', id).single();
  } else {
    // Retrieval logic for random or featured puzzle selection
    query = query.limit(1);
  }

  const { data, error } = await query;
  return { data, error };
};

export const saveProgress = async (userId, puzzleId, gridState, attempts, status) => {
  const { data, error } = await supabase
    .from('user_progress')
    .upsert({
      user_id: userId,
      puzzle_id: puzzleId,
      grid_state: gridState,
      attempts: attempts,
      status: status,
      updated_at: new Date()
    });
  return { data, error };
};