import React from 'react';
import { ChevronLeft } from 'lucide-react';

export default function NewsPage({ onBack, onNavigateToLegal }) {
  const newsItems = [
    {
      title: "Initial Release",
      date: "April 8, 2026",
      content: "Hello! I worked on this for the last couple months. It took some time to add and test all the features, besides that, my personal goal before launching was to make a 3x3 puzzle. I technically failed that goal, just one corner short :( ... It's just really hard to make a good puzzle with that much interlinking. Try it yourself. I almost want to say there should be an achievement system for creating a 3x3 puzzle. But anyone *could* do that, if they don't care anything about the quality of the puzzle.\n\nI'm mostly happy with the \"bootstrap\" puzzles I came up with so far. If I had to guess, I'd say they probably skew too hard. It's easy to make a hard puzzle and hard to make a good puzzle. For example, to get stuck in a mindset where you always try to be clever with the categories. If Connections shows us anything, it's that you should have at least half the categories as fairly obvious things, and maybe only 25% as something clever. Too much clever stuff will leave the solver frusturated, \"How was I supposed to think of THAT??\".\n\nI've had fun figuring out the unique things that come with adding shape to this style of puzzle. For example, oroboros puzzles (where there's no start and end) I think are easier than snaking puzzles (where there are distinct start and end points). With an O-shaped puzzle, you just have to know the categories and what words link them. With a U-shaped puzzle, you have to know that, and also have to figure out which categories start and finish, which is kind of arbitrary. I also think it's usually easier when a category has at least 3 or 4 words in it. If all your categories are only 2 words, then it's really hard to know what's coincident and what's a real category. Lastly, putting a single word by itself results in the solver having to know everything else 100%, because ANY word could go in the category by itself. I'm inclined to think that's bad practice (but I did it anyway). Anyway, fun to figure out stuff like that.\n\nHave fun, and make me some puzzles, please! - Mott"
    }
  ];

  return (
    <div className="max-w-2xl mx-auto p-6 sm:p-8 animate-in fade-in duration-500">
      <button
        onClick={onBack}
        className="mb-10 text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em]"
      >
        <ChevronLeft size={16} /> Back
      </button>

      <div className="mb-12 border-b-4 border-slate-900 pb-8">
        <h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">
          Bulletin Board
        </h1>
      </div>

      <div className="space-y-12 mb-20">
        {newsItems.map((item, i) => (
          <div key={i} className="group">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {item.date}
              </span>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-4 tracking-tight group-hover:text-indigo-600 transition-colors uppercase">
              {item.title}
            </h2>
            <div className="text-slate-500 leading-relaxed font-medium space-y-4">
              {item.content.split(/\n\n+/).map((paragraph, idx) => (
                <p key={idx} dangerouslySetInnerHTML={{ __html: paragraph }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      <footer className="pt-12 pb-20 flex justify-between items-center">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          {/* © 2026 Matt Beyer. U can steal it if you really want tho */}
        </p>
        <button
          onClick={onNavigateToLegal}
          className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
        >
          Legal
        </button>
      </footer>
    </div>
  );
}
