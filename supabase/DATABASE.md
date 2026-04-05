# Cross Connect Database Schema (Supabase)

This document describes the database structure and policies for the Cross Connect application.

## Tables

### `puzzles`
The core table storing puzzle data, layouts, and metadata.
- `id` (uuid, primary key): Unique identifier for the puzzle.
- `created_by` (uuid, references `auth.users`): The ID of the user who created the puzzle. Nullable for anonymous puzzles.
- `title` (text): The title of the puzzle.
- `categories` (jsonb): A list of category objects, each containing `words` and `description`.
- `layout` (jsonb): A 2D array representing the active grid cells (1 for active, 0 for empty).
- `word_order` (text[]): An array of words in the shuffled order they appear in the bank.
- `grid_data` (jsonb): The mapping of words to grid coordinates (used for editing).
- `is_published` (boolean): Whether the puzzle is visible to everyone. Defaults to `true`.
- `is_shadowbanned` (boolean): Flag for content moderation. When `true`, ONLY the author can see the puzzle.
- `likes_count` (int4): Number of likes.
- `play_count` (int4): Number of times the puzzle was started.
- `solve_count` (int4): Number of times the puzzle was solved.
- `share_count` (int4): Number of times the puzzle was shared.
- `author_profile_clicks` (int4): Number of times users clicked the author's profile.
- `trimmean_attempts_to_solve` (float8): Global 20% trimmed mean of attempts needed.
- `median_time_to_solve` (float8): Global median time taken to solve.
- `median_moves_to_solve` (float8): Global median number of moves.
- `trimmean_hints_used` (float8): Global 20% trimmed mean of hints used.
- `difficulty_score` (float8): Metric = `((MedTime/75 + MedMoves/30 + TrimAttempts-1 + TrimHints) / (SolveRate + 1)) / 5`.
- `quality_score` (float8): Bayesian average metric (0-100) combining solves, likes, shares, skips, and author reputation.
- `locale` (text): The browser locale (e.g., `en-US`) of the creator.
- `created_at` (timestamp with time zone): When the puzzle was created.
- `updated_at` (timestamp with time zone): When the puzzle was last modified.

### `profiles`
Public user profiles linked to Supabase Auth users.
- `id` (uuid, references `auth.users`): Primary key.
- `nickname` (text): The public display name of the user.
- `skill_score` (float8): Calculated player skill based on their last 50 solves.
- `difficulty_preference` (int4): Player difficulty offset (-5 for easier, +5 for harder).
- `author_reputation` (float8): Bayesian average (0-100) of the quality of all puzzles published by this user.
- `is_hard_shadowbanned` (boolean): Flag for repeat/severe offenders. When `true`, all their content is automatically shadowbanned.
- `shadowban_total` (int4): Total count of shadowbanned content (puzzles/comments) associated with this user.
- `updated_at` (timestamp with time zone): Last updated timestamp.
- `locale` (text): The user's preferred browser locale.

### `comments`
Interactive comments on puzzles.
- `id` (uuid, primary key).
- `puzzle_id` (uuid, references `puzzles`): Puzzle the comment belongs to.
- `user_id` (uuid, references `profiles`): Author of the comment.
- `content` (text): The comment text.
- `is_shadowbanned` (boolean): Flag for content moderation. 
- `likes_count` (int4): Total likes for the comment.
- `created_at` (timestamp with time zone).

### `comment_likes`
Tracks which users liked which comments.
- `comment_id` (uuid, references `comments`).
- `user_id` (uuid, references `profiles`).
- **Unique Constraint:** `(comment_id, user_id)`.

### `user_progress`
Tracks user performance and "Skip" status on specific puzzles.
- `id` (uuid, primary key).
- `user_id` (uuid, references `auth.users`): Links to the player.
- `puzzle_id` (uuid, references `puzzles`): Links to the puzzle.
- `is_solved` (boolean): Whether the user has solved the puzzle.
- `is_skipped` (boolean): Whether the user has skipped the puzzle.
- `is_liked` (boolean): Whether the user has liked the puzzle.
- `has_shared` (boolean): Whether the user has shared the puzzle.
- `has_clicked_author` (boolean): Whether the user clicked the author's profile.
- `status` (text, generated): Derived status (`solved` > `skipped` > `in_progress`).
- `grid_state` (jsonb): The current state of the grid for resuming.
- `attempts` (int4): Number of check/submit attempts.
- `move_count` (int4): Number of moves made.
- `hints_revealed` (jsonb): List of hints shown to the user.
- `hints_revealed_count` (int4): Count of hints revealed (kept in sync via trigger).
- `guess_history` (jsonb): History of validation attempts.
- `total_seconds_played` (int4): Cumulative time played.
- `started_at` (timestamp with time zone): When the user started the puzzle.
- `solved_at` (timestamp with time zone): When the user first solved the puzzle.
- `updated_at` (timestamp with time zone): Last time any interaction occurred.
- **Unique Constraint:** `(user_id, puzzle_id)` ensures one record per player-puzzle pair.

## Row Level Security (RLS)

### `puzzles`
- **Public access** is allowed for published puzzles where `is_shadowbanned = false`.
- **Owners** can always view their own puzzles (even if shadowbanned or unpublished).
- **Owners** can update or delete their own puzzles.

### `comments`
- **Public access** is allowed for comments where `is_shadowbanned = false`.
- **Owners** can always view their own comments (even if shadowbanned).

### `profiles`
- **Anyone** can view all public profiles for author mapping.
- **Users** can only insert/update their own profile.

### `user_progress`
- **Users** can view/insert/update/delete their own progress.

## Triggers and Automation

- **Skill Sync:** (`on_user_progress_solved_sync_skill`) Updates a user's `skill_score`.
- **Stats Sync:** (`on_user_progress_sync_v3`) Recalculates puzzle difficulty, medians, and quality scores.
- **Content Change Reset:** (`handle_puzzle_content_change`) Flushes progress if puzzle structure is edited.
- **Shadowban Tracking:** Logic in `puzzleService.js` (Web Client) automatically flags content and increments `shadowban_total` on `profiles`.

## RPC Functions

- `get_recommended_puzzle(p_user_id)`: Fetches a puzzle for the user based on skill/preference. **Filters out shadowbanned and self-authored puzzles.**
- `toggle_comment_like(p_comment_id, p_user_id)`: Toggles comment like status and increments/decrements `likes_count` atomically.
- `record_puzzle_play(userId, puzzleId)`: Upserts `user_progress` to trigger global play count increments.
