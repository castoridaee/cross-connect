import React from 'react';
import { ChevronLeft, Shield, Scale, Lock } from 'lucide-react';

export default function LegalPage({ onBack }) {
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
          Legal Info
        </h1>
      </div>

      <div className="space-y-12 mb-20 text-slate-600 font-medium leading-relaxed">
        {/* Privacy */}
        <section>
          <div className="flex items-center gap-2 mb-4 text-slate-900">
            <Lock size={18} />
            <h2 className="text-xl font-black uppercase tracking-tight">Privacy Policy</h2>
          </div>
          <p className="mb-4">
            I collect minimal data to operate the game:
          </p>
          <ul className="list-disc pl-5 space-y-2 mb-4">
            <li><strong>Email Address:</strong> Used for account authentication and recovery.</li>
            <li><strong>Gameplay Data:</strong> Puzzle progress, solve times, solve attempts, and likes are used to calculate difficulty statistics and quality scores.</li>
            <li><strong>Captcha Data:</strong> Not currently running, but may be implemented in the future if needed to prevent spam and abuse. If implemented, the captcha may require user behavior tracking to function.</li>
            <li><strong>Content:</strong> Puzzles you create and comments you write are stored for basic functionality of the game.</li>
          </ul>
          <p>
            I do not sell your personal information to third parties, nor run ads or tracking pixels. Data is stored securely in servers operated by <a href="https://supabase.com">Supabase</a>.
          </p>
        </section>

        {/* Section: Data Rights (GDPR) */}
        <section>
          <div className="flex items-center gap-2 mb-4 text-slate-900">
            <Shield size={18} />
            <h2 className="text-xl font-black uppercase tracking-tight">GDPR & Data Rights</h2>
          </div>
          <p className="mb-4">
            Under regulations like the GDPR, you have the following rights regarding your data:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Right to Access:</strong> You can request a copy of the data I have stored for you.</li>
            <li><strong>Right to Erasure:</strong> You can request that I delete your account and all associated data at any time.</li>
            <li><strong>Right to Rectification:</strong> You can update your profile information directly in the app settings.</li>
          </ul>
        </section>
      </div>

      <footer className="pt-12 pb-20">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-300">
          Last Updated: April 7, 2026
        </p>
      </footer>
    </div>
  );
}
