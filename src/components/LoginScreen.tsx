'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';

interface LoginScreenProps {
  onLogin: (name: string) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }

    setError('');
    onLogin(name.trim());
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 dark:from-slate-950 dark:to-blue-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4 inline-block">💬</div>
          <h1 className="text-4xl font-black mb-2 bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
            CampusYak
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm font-semibold tracking-wide uppercase">
            Anonymous College Community
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl p-8 border border-blue-100 dark:border-slate-800">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Welcome Back!
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mb-6">
            Enter your name to join the community
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Input */}
            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Enter your name"
                className="w-full px-4 py-3 rounded-xl border-2 border-blue-200 dark:border-slate-700 bg-blue-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-500 dark:placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400/50 transition-all"
                autoFocus
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg text-sm font-semibold">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-95 shadow-lg hover:shadow-xl"
            >
              <span>Continue</span>
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>

          {/* Footer */}
          <p className="text-center text-xs text-slate-500 dark:text-slate-400 mt-6">
            Stay anonymous • Share freely • Be respectful
          </p>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-950/30 rounded-2xl p-4 border border-blue-200 dark:border-blue-900/50">
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            <span className="font-bold text-blue-600 dark:text-blue-400">💡 Pro tip:</span> Your name is just for display. Posts remain completely anonymous!
          </p>
        </div>
      </div>
    </div>
  );
}
