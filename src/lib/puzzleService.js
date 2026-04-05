import { supabase } from './supabase';

// Helper to retry transient Safari/Networking errors (Load failed)
const withRetry = async (fn, retries = 1) => {
  try {
    return await fn();
  } catch (err) {
    if (retries > 0 && err.message === 'Load failed') {
      console.warn(`Retrying fetch after transient Safari error...`);
      await new Promise(r => setTimeout(r, 500));
      return withRetry(fn, retries - 1);
    }
    throw err;
  }
};

export async function recordPuzzleSolve(userId, puzzleId, stats) {
  const { attempts, moves, seconds, grid, hints, history } = stats;

  // 1. Save the individual user's performance including final state
  const { error: progressError } = await supabase
    .from('user_progress')
    .upsert({
      user_id: userId,
      puzzle_id: puzzleId,
      is_solved: true,
      grid_state: grid || {},
      attempts: attempts,
      move_count: moves,
      total_seconds_played: seconds,
      hints_revealed: hints || [],
      guess_history: history || [],
      solved_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, puzzle_id' });

  if (progressError) throw progressError;

  return { error: null };
}

export async function createPuzzle(puzzleData) {
  const { data, error } = await supabase
    .from('puzzles')
    .insert([puzzleData])
    .select()
    .single();

  return { data, error };
}

export async function updatePuzzle(id, data) {
  const { data: updatedData, error } = await supabase
    .from('puzzles')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  return { data: updatedData, error };
}

export async function deletePuzzle(id) {
  const { error } = await supabase
    .from('puzzles')
    .delete()
    .eq('id', id);
  return { error };
}

export async function unpublishPuzzle(id) {
  return await updatePuzzle(id, { is_published: false });
}

export async function clearPuzzleProgress(puzzleId) {
  const { error } = await supabase
    .from('user_progress')
    .delete()
    .eq('puzzle_id', puzzleId);
  return { error };
}

export async function getPuzzlesByAuthor(authorId) {
  const { data, error } = await supabase
    .from('puzzles')
    .select('*, author:profiles!created_by(nickname)')
    .eq('created_by', authorId)
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function getProfile(id) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single();
  return { data, error };
}

export async function updateProfile(id, data) {
  const { data: updatedData, error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', id)
    .select()
    .single();
  return { data: updatedData, error };
}

export async function getPuzzle(id) {
  const { data, error } = await supabase
    .from('puzzles')
    .select('*, author:profiles!created_by(nickname)')
    .eq('id', id)
    .single();
  return { data, error };
}

export async function recordPuzzleSkip(userId, puzzleId) {
  console.log("DB: Recording skip for", { userId, puzzleId });
  const { data: current } = await getPuzzleProgress(userId, puzzleId);
  if (current?.is_solved || current?.status === 'solved') {
    console.log("[recordPuzzleSkip] Ignoring skip: Puzzle already solved.");
    return { error: null };
  }

  const { error } = await supabase
    .from('user_progress')
    .upsert({
      user_id: userId,
      puzzle_id: puzzleId,
      is_skipped: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, puzzle_id' });
  
  if (error) console.error("DB Error in recordPuzzleSkip:", error);
  return { error };
}

export async function savePuzzleProgress(userId, puzzleId, progress) {
  const { data: current } = await getPuzzleProgress(userId, puzzleId);
  if (current?.status === 'solved') return { error: null };

  const { error } = await supabase
    .from('user_progress')
    .upsert({
      user_id: userId,
      puzzle_id: puzzleId,
      grid_state: progress.grid,
      attempts: progress.attempts,
      move_count: progress.moves,
      total_seconds_played: progress.seconds,
      hints_revealed: progress.hints || [],
      guess_history: progress.history || [],
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, puzzle_id' });
  
  if (error && error.message === 'Load failed') {
    // Retry once for Safari transient issues
    const { error: retryError } = await supabase.from('user_progress').upsert({
      user_id: userId,
      puzzle_id: puzzleId,
      grid_state: progress.grid,
      attempts: progress.attempts,
      move_count: progress.moves,
      total_seconds_played: progress.seconds,
      hints_revealed: progress.hints || [],
      guess_history: progress.history || [],
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, puzzle_id' });
    if (retryError) console.error(`[savePuzzleProgress] Persistent DB Error:`, retryError.message);
    return { error: retryError };
  }
  
  if (error) console.error(`[savePuzzleProgress] DB Error:`, error.message);
  else console.log(`[savePuzzleProgress] Auto-saved progress for ${puzzleId}`);
  
  return { error };
}

export async function getPuzzleProgress(userId, puzzleId) {
  const fetchFn = () => supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('puzzle_id', puzzleId)
    .maybeSingle();

  let { data, error } = await fetchFn();

  if (error && error.message === 'Load failed') {
    await new Promise(r => setTimeout(r, 500));
    const result = await fetchFn();
    data = result.data;
    error = result.error;
  }

  return { data, error };
}
export async function getUserProgressForPuzzles(userId, puzzleIds) {
  if (!userId || !puzzleIds || puzzleIds.length === 0) return { data: [], error: null };
  const fetchFn = () => supabase
    .from('user_progress')
    .select('puzzle_id, status, is_liked')
    .eq('user_id', userId)
    .in('puzzle_id', puzzleIds);

  let { data, error } = await fetchFn();

  if (error && error.message === 'Load failed') {
    await new Promise(r => setTimeout(r, 500));
    const result = await fetchFn();
    data = result.data;
    error = result.error;
  }

  return { data, error };
}

export async function recordPuzzleEngagement(puzzleId, userId, metric) {
  if (!userId) return { error: 'Not signed in' };
  const { error } = await supabase.rpc('record_puzzle_engagement', {
    p_id: puzzleId,
    u_id: userId,
    metric: metric
  });
  return { error };
}

export async function recordPuzzlePlay(userId, puzzleId) {
  if (!userId || !puzzleId) {
    console.warn(`[recordPuzzlePlay] Missing IDs: userId=${userId}, puzzleId=${puzzleId}`);
    return { error: 'Missing IDs' };
  }
  
  console.log(`[recordPuzzlePlay] Start: user=${userId}, puzzle=${puzzleId}`);
  
  // 1. Upsert to ensure the row exists. This will trigger the global play_count increment.
  const { data, error } = await supabase
    .from('user_progress')
    .upsert({
      user_id: userId,
      puzzle_id: puzzleId,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id, puzzle_id' })
    .select()
    .single();

  if (error) {
    console.error(`[recordPuzzlePlay] DB Error:`, error.message, error.details);
  } else {
    console.log(`[recordPuzzlePlay] Success: Row ${data.id} is present. Status: ${data.status}`);
  }
  
  return { data, error };
}

export async function togglePuzzleLike(puzzleId, userId) {
  const { data, error } = await supabase.rpc('toggle_puzzle_like', {
    p_id: puzzleId,
    u_id: userId
  });
  return { data, error };
}

export async function getLikedPuzzles(userId) {
  if (!userId) return { data: [], error: null };
  const { data, error } = await supabase
    .from('puzzles')
    .select('*, user_progress!inner(is_liked)')
    .eq('user_progress.user_id', userId)
    .eq('user_progress.is_liked', true)
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function getRecommendedPuzzle(userId) {
  const fetchFn = () => supabase.rpc('get_recommended_puzzle', {
    p_user_id: userId || null
  }).select('*, author:profiles!created_by(nickname)');

  let { data, error } = await fetchFn();
  
  // Safari "Load failed" retry
  if (error && error.message === 'Load failed') {
    console.warn("Safari Load failed detected, retrying...");
    await new Promise(r => setTimeout(r, 500));
    const result = await fetchFn();
    data = result.data;
    error = result.error;
  }

  if (error) {
    console.warn("RPC fetch with join failed, retrying without join...", error);
    const { data: fallbackData, error: fallbackError } = await supabase.rpc('get_recommended_puzzle', {
      p_user_id: userId || null
    });
    if (fallbackError) return { data: null, error: fallbackError };
    return { data: fallbackData?.[0] || null, error: null };
  }
  return { data: data?.[0] || null, error: null };
}

export async function getComments(puzzleId, sortBy = 'newest') {
  let query = supabase
    .from('comments')
    .select('*, author:profiles!user_id(id, nickname)')
    .eq('puzzle_id', puzzleId);

  if (sortBy === 'liked') {
    query = query.order('likes_count', { ascending: false });
  } else {
    query = query.order('created_at', { ascending: false });
  }

  const { data, error } = await query;
  return { data, error };
}

export async function addComment(puzzleId, userId, content) {
  const { data, error } = await supabase
    .from('comments')
    .insert([{
      puzzle_id: puzzleId,
      user_id: userId,
      content: content
    }])
    .select('*, author:profiles!user_id(nickname)')
    .single();

  return { data, error };
}

export async function toggleCommentLike(commentId, userId) {
  const { data, error } = await supabase.rpc('toggle_comment_like', {
    p_comment_id: commentId,
    p_user_id: userId
  });
  return { data, error };
}

export async function getUserComments(userId) {
  const { data, error } = await supabase
    .from('comments')
    .select('*, puzzle:puzzles(id, title, description, categories)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function getUserMentions(nickname) {
  // Simple mention check using @nickname
  const mentionPattern = `@${nickname}`;
  const { data, error } = await supabase
    .from('comments')
    .select('*, author:profiles!user_id(nickname), puzzle:puzzles(id, title, description, categories)')
    .ilike('content', `%${mentionPattern}%`)
    .order('created_at', { ascending: false });
  return { data, error };
}

export async function getCommentLikes(userId, commentIds) {
  if (!userId || !commentIds || commentIds.length === 0) return { data: [], error: null };
  const { data, error } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .eq('user_id', userId)
    .in('comment_id', commentIds);
  return { data, error };
}
