'use client';

import { useEffect, useState } from 'react';
import { Flame, Clock, RefreshCw, AlertCircle, ShieldAlert, MessageSquare, Sparkles } from 'lucide-react';
import { getPosts, getUserVotes, subscribeToUpdates, getUserKarma, isMockMode, Post } from '@/lib/supabase';
import { getOrCreateSessionId } from '@/lib/utils';
import PostComposer from '@/components/PostComposer';
import PostCard from '@/components/PostCard';
import ThemeToggle from '@/components/ThemeToggle';
import Link from 'next/link';

export default function Home() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, 1 | -1>>({});
  const [sortBy, setSortBy] = useState<'new' | 'hot'>('new');
  const [activeCategory, setActiveCategory] = useState('All');
  const [karma, setKarma] = useState<number>(0);
  const [sessionId, setSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Initialize user session ID client-side
  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  // 2. Load feed data
  const loadFeedData = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const activeSession = sessionId || getOrCreateSessionId();
      const [fetchedPosts, fetchedVotes, fetchedKarma] = await Promise.all([
        getPosts(sortBy, activeCategory),
        getUserVotes(activeSession),
        getUserKarma(activeSession)
      ]);
      setPosts(fetchedPosts);
      setUserVotes(fetchedVotes);
      setKarma(fetchedKarma);
      setError(null);
    } catch (err: any) {
      console.error('Failed to load feed:', err);
      setError('Failed to load posts. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger fetch when sort order, session ID, or category changes
  useEffect(() => {
    if (sessionId) {
      loadFeedData(true);
    }
  }, [sortBy, sessionId, activeCategory]);

  // 3. Realtime subscriptions
  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      loadFeedData(false);
    });
    return () => unsubscribe();
  }, [sortBy, sessionId, activeCategory]);

  // Filter posts based on search query
  const filteredPosts = posts.filter(post => 
    post.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {/* Premium Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 transition-all duration-300">
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="text-2xl">💬</span>
            <div>
              <h1 className="text-xl font-black tracking-tight bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">
                CampusYak
              </h1>
              <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold tracking-widest uppercase">
                College Community Feed
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Yakarma display */}
            <div className="flex items-center space-x-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-100/50 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold shadow-xs">
              <Sparkles className="w-3.5 h-3.5 fill-current animate-pulse" />
              <span className="tabular-nums" id="karma-display">{karma} Karma</span>
            </div>

            {/* DMs link */}
            <Link 
              href="/messages"
              className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
              title="Direct Messages"
              id="dm-inbox-link"
            >
              <MessageSquare className="w-5 h-5" />
            </Link>

            {/* Link to Admin Route */}
            <Link 
              href="/admin"
              className="p-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
              title="Admin Moderation"
              id="admin-dashboard-link"
            >
              <ShieldAlert className="w-5 h-5" />
            </Link>
            
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <section className="max-w-xl mx-auto px-4 py-6 space-y-6">
        
        {/* Mock Mode Alert Banner */}
        {isMockMode && (
          <div className="flex items-center space-x-3 p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 rounded-2xl border border-amber-100 dark:border-amber-900/50 text-xs shadow-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <div className="flex-1">
              <span className="font-bold">Offline Mock Mode Enabled.</span> Data is stored locally in your browser cache. Paste the <code className="bg-amber-100/50 dark:bg-amber-900/30 px-1 rounded">schema.sql</code> and fill out your <code className="bg-amber-100/50 dark:bg-amber-900/30 px-1 rounded">.env.local</code> to connect a real Supabase backend.
            </div>
          </div>
        )}

        {/* Global Search Bar */}
        <div className="w-full space-y-3">
          <input
            type="text"
            placeholder="Search anonymous posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-850 bg-white dark:bg-gray-900 text-gray-850 dark:text-gray-150 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none text-sm transition-all shadow-sm placeholder-gray-400 dark:placeholder-gray-600"
            id="search-input"
          />

          {/* Category Filter pills */}
          <div className="w-full overflow-x-auto py-1 flex space-x-2 scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {['All', 'General', 'Placements', 'Hostel/Mess', 'Academics', 'Lost & Found', 'Marketplace', 'Faculty Reviews'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 active:scale-95 border ${
                  activeCategory === cat
                    ? 'bg-emerald-500 text-white shadow-sm border-emerald-500'
                    : 'bg-white dark:bg-gray-900 text-gray-550 dark:text-gray-400 border-gray-200 dark:border-gray-850 hover:bg-gray-50 dark:hover:bg-gray-800/40'
                }`}
                id={`filter-category-${cat.replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase().replace(/-+$/, '')}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Composer (Post Creation) */}
        {sessionId && (
          <PostComposer sessionId={sessionId} onPostCreated={() => loadFeedData(false)} />
        )}

        {/* Feed Filters / Tabs & Refresh */}
        <div className="flex items-center justify-between border-b border-gray-200/60 dark:border-gray-800/80 pb-3">
          <div className="flex space-x-1 bg-gray-100/80 dark:bg-gray-950/80 border border-gray-200/30 dark:border-gray-800/50 rounded-xl p-1">
            <button
              onClick={() => setSortBy('new')}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg font-semibold text-xs transition-all duration-200 active:scale-95 ${
                sortBy === 'new'
                  ? 'bg-white dark:bg-gray-900 text-emerald-500 dark:text-emerald-400 shadow-sm border border-gray-100 dark:border-gray-800'
                  : 'text-gray-505 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
              id="tab-new"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>New</span>
            </button>
            <button
              onClick={() => setSortBy('hot')}
              className={`flex items-center space-x-1.5 px-4 py-2 rounded-lg font-semibold text-xs transition-all duration-200 active:scale-95 ${
                sortBy === 'hot'
                  ? 'bg-white dark:bg-gray-900 text-emerald-500 dark:text-emerald-400 shadow-sm border border-gray-100 dark:border-gray-800'
                  : 'text-gray-505 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
              id="tab-hot"
            >
              <Flame className="w-3.5 h-3.5" />
              <span>Hot</span>
            </button>
          </div>

          <button
            onClick={() => loadFeedData(true)}
            className="p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            title="Refresh feed"
            id="refresh-feed-btn"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Feed Posts Listing */}
        <div className="space-y-4">
          {error && (
            <div className="text-center py-8 text-red-500">
              <p className="text-sm font-semibold">{error}</p>
              <button 
                onClick={() => loadFeedData(true)} 
                className="mt-3 px-4 py-2 bg-gray-200 dark:bg-gray-800 rounded-xl text-xs font-semibold hover:bg-gray-300 dark:hover:bg-gray-700"
              >
                Retry Loading
              </button>
            </div>
          )}

          {isLoading ? (
            // Premium Skeletons
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 space-y-4 animate-pulse">
                  <div className="flex space-x-3">
                    <div className="w-24 h-6 bg-gray-200 dark:bg-gray-800 rounded-lg"></div>
                    <div className="w-12 h-6 bg-gray-100 dark:bg-gray-850 rounded-lg"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="w-full h-4 bg-gray-200 dark:bg-gray-800 rounded-md"></div>
                    <div className="w-4/5 h-4 bg-gray-200 dark:bg-gray-800 rounded-md"></div>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                    <div className="w-20 h-8 bg-gray-100 dark:bg-gray-850 rounded-xl"></div>
                    <div className="w-16 h-8 bg-gray-100 dark:bg-gray-850 rounded-xl"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredPosts.length > 0 ? (
            filteredPosts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentSessionId={sessionId}
                initialUserVote={userVotes[post.id]}
                onVoteSuccess={() => {}} // Dynamic refresh handled by realtime listener
                onReportSuccess={() => loadFeedData(false)}
              />
            ))
          ) : (
            // Beautiful Empty State
            <div className="text-center py-16 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
              <span className="text-4xl block mb-3">📭</span>
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-250">No yaks here yet!</h3>
              <p className="text-xs text-gray-450 dark:text-gray-600 mt-1 max-w-xs mx-auto">
                Be the first to share an anonymous message with the community! Use the post composer above.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
