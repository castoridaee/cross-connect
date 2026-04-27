# Cross Connect

This is my game that combines Connections and Crossword puzzles.
It's designed to be populated with user generated content. I put a few social features (discussions/comments/likes), which is designed to make it feel like a community.
Sort of inspired by the comments section on the NYT connections game, but in a more distributed way (since not everyone gets the same puzzle each day).

## Puzzles

The puzzles are easy and fun to make. Easier to make than they are to solve, really. I bootstrapped the database with a few that I made.
Actually, to be more precise: it's easy to make mediocre puzzles, and hard to make good ones.
Some stuff I noticed:
- It's really hard to make dense puzzles. I tried to make a 3x3 but I couldn't quite get it working.
- The shape of the puzzle matters somewhat... it's harder to solve a long "snaking" puzzle than it is to solve a circular one. For example, a snaking puzzle and a circular puzzle may have the same categories, but with the snaking puzzle you also have to know which the "start" and "end" categories are, which is a little arbitrary. I'm inclined to think that's bad design.
- Putting one word in a category by itself makes the puzzle harder, since the solver has to know which one of the words doesn't belong in any category.

## Tech Stack

Uses Supabase, React, and Vite.

## Future Plans

I don't really want to make any more changes, but I think the puzzle selection algorithm should be improved (I currently don't have a real database to base it off of, so it's hard to figure out how to do this well). Currently, it doesn't take into account the quality score of the puzzle when picking the next one in the queue. Ideally, it should follow the general procedure it has now, but also factor in the puzzle quality.

Since the discussions are distributed, it might need some improvements there to allow for discussions. I put in some @ functionality, but I think it's not quite enough.