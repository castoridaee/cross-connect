import React, { useState } from 'react';
import { X } from 'lucide-react';
import { updateProfile } from '../lib/puzzleService';
import Avatar from "boring-avatars";

export function ProfileSettingsModal({ profile, onClose, onUpdated }) {
  const [preference, setPreference] = useState(profile?.difficulty_preference || 0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const OPTIONS = [
    { value: -5, label: 'Much Easier' },
    { value: -2, label: 'Easier' },
    { value: 0, label: 'Normal' },
    { value: 2, label: 'Harder' },
    { value: 5, label: 'Much Harder' },
  ];

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: updateErr } = await updateProfile(profile.id, {
        difficulty_preference: preference,
      });
      if (updateErr) throw updateErr;
      onUpdated(data);
      onClose();
    } catch (err) {
      console.error('Error updating profile:', err);
      setError('Failed to update settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 animate-in fade-in duration-200" onClick={onClose} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-3xl shadow-2xl z-50 p-6 animate-in zoom-in duration-200">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Avatar
              size={32}
              name={profile.id}
              variant="beam"
              colors={["#5cacc4", "#8cd19d", "#cee879", "#fcb653", "#ff5254"]}
              square
            />
            <h2 className="text-xl font-black tracking-tight text-slate-900">Profile Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">
            Puzzle Difficulty Preference
          </label>
          <div className="space-y-2">
            {OPTIONS.map(opt => (
              <label
                key={opt.value}
                className={`flex flex-col p-3 rounded-2xl border-2 transition-all cursor-pointer ${preference === opt.value
                  ? 'border-indigo-600 bg-indigo-50/50'
                  : 'border-slate-100 hover:border-slate-300'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="difficulty_preference"
                    value={opt.value}
                    checked={preference === opt.value}
                    onChange={() => setPreference(opt.value)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-600"
                  />
                  <div className="flex-1">
                    <span className={`block font-bold text-sm ${preference === opt.value ? 'text-indigo-900' : 'text-slate-700'}`}>
                      {opt.label}
                    </span>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold flex gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black uppercase tracking-widest text-sm py-4 rounded-xl transition-all"
        >
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </>
  );
}
