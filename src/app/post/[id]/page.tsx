'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw, MessageSquare } from 'lucide-react';
import { getPost, getComments, getUserVotes, subscribeToUpdates, Post, Comment } from '@/lib/supabase';
import { getOrCreateSessionId } from '@/lib/utils';
import PostCard from '@/components/PostCard';
import CommentCard from '@/components/CommentCard';
import CommentComposer from '@/components/CommentComposer';
import Link from 'next/link';

export default function PostThread() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, 1 | -1>>({});
  const [sessionId, setSessionId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load session
  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  // Fetch post and comments data
  const loadThreadData = async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    if (!postId) return;

    try {
      const activeSession = sessionId || getOrCreateSessionId();
      const [fetchedPost, fetchedComments, fetchedVotes] = await Promise.all([
        getPost(postId),
        getComments(postId),
        getUserVotes(activeSession)
      ]);

      if (!fetchedPost || fetchedPost.is_hidden) {
        setError('Post not found or has been moderated.');
        setPost(null);
      } else {
        setPost(fetchedPost);
        setComments(fetchedComments);
        setUserVotes(fetchedVotes);
        setError(null);
      }
    } catch (err: any) {
      console.error('Failed to load thread details:', err);
      setError('Failed to load thread.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId && postId) {
      loadThreadData(true);
    }
  }, [postId, sessionId]);

  // Realtime update listener
  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      loadThreadData(false);
    });
    return () => unsubscribe();
  }, [postId, sessionId]);

  // Organize comments hierarchy (one-level nesting)
  const rootComments = comments.filter(c => c.parent_comment_id === null);
  
  const getCommentReplies = (commentId: string) => {
    return comments.filter(c => c.parent_comment_id === commentId);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 py-6">
        <div className="max-w-xl mx-auto px-4 space-y-4">
          <div className="flex items-center space-x-2 py-2">
            <div className="w-8 h-8 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse"></div>
            <div className="w-24 h-6 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse"></div>
          </div>
          <div className="w-full h-40 bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl animate-pulse"></div>
        </div>
      </main>
    );
  }

  if (error || !post) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 py-12 text-center">
        <div className="max-w-xl mx-auto px-4 space-y-4">
          <p className="text-red-500 font-bold">{error || 'Thread not found.'}</p>
          <Link href="/" className="inline-flex items-center space-x-2 text-emerald-500 font-semibold hover:underline">
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Feed</span>
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link 
            href="/" 
            className="flex items-center space-x-1.5 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors font-semibold text-sm"
            id="back-to-feed-btn"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Feed</span>
          </Link>

          <h1 className="text-base font-black tracking-tight text-gray-800 dark:text-gray-200">
            Yak Thread
          </h1>

          <button
            onClick={() => loadThreadData(true)}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-500 hover:text-gray-800 transition-colors"
            id="refresh-thread-btn"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      <section className="max-w-xl mx-auto px-4 py-6 space-y-6">
        {/* Main Post Card */}
        <PostCard
          post={post}
          currentSessionId={sessionId}
          initialUserVote={userVotes[post.id]}
          commentCount={comments.length}
          onVoteSuccess={() => {}}
          onReportSuccess={() => router.push('/')}
        />

        {/* Comment Input Section */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 shadow-sm space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500 flex items-center space-x-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Join the Discussion</span>
          </h3>
          <CommentComposer
            postId={post.id}
            parentCommentId={null}
            sessionId={sessionId}
            onCommentCreated={() => loadThreadData(false)}
            placeholder="Type your anonymous reply..."
          />
        </div>

        {/* Comment Feed / Tree List */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-1">
          <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200 pb-3 border-b border-gray-100 dark:border-gray-800">
            Comments ({rootComments.length})
          </h3>

          {rootComments.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
              {rootComments.map((comment) => (
                <CommentCard
                  key={comment.id}
                  comment={comment}
                  replies={getCommentReplies(comment.id)}
                  postId={post.id}
                  currentSessionId={sessionId}
                  postAuthorSessionId={post.session_id}
                  onActionSuccess={() => loadThreadData(false)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400 dark:text-gray-650 text-xs">
              💬 No comments yet. Be the first to express your opinion!
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
