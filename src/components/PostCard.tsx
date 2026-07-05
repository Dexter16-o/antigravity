'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowBigUp, ArrowBigDown, MessageCircle, AlertTriangle, X, MessageSquare } from 'lucide-react';
import { getAnonymousIdentity } from '@/lib/identity';
import { formatTimeAgo } from '@/lib/utils';
import { vote, report, createDMThread } from '@/lib/supabase';

interface PostCardProps {
  post: {
    id: string;
    content: string;
    image_url: string | null;
    session_id: string;
    category: string;
    created_at: string;
    upvotes: number;
    downvotes: number;
    is_hidden: boolean;
    report_count: number;
    is_author?: boolean;
  };
  currentSessionId: string;
  initialUserVote?: 1 | -1 | null;
  commentCount?: number;
  onVoteSuccess?: () => void;
  onReportSuccess?: () => void;
}

export default function PostCard({
  post,
  currentSessionId,
  initialUserVote = null,
  commentCount = 0,
  onVoteSuccess,
  onReportSuccess
}: PostCardProps) {
  const router = useRouter();
  const [userVote, setUserVote] = useState<1 | -1 | null>(initialUserVote);
  const [voteCount, setVoteCount] = useState(post.upvotes - post.downvotes);
  const [isVoting, setIsVoting] = useState(false);
  const [isMessaging, setIsMessaging] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [customReason, setCustomReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [showLightbox, setShowLightbox] = useState(false);

  // Generate anonymous name for the author of this post
  const identity = getAnonymousIdentity(post.session_id, post.id);
  const isOP = post.is_author ?? (post.session_id === currentSessionId);

  const handleVote = async (value: 1 | -1) => {
    if (isVoting) return;
    setIsVoting(true);

    // Optimistic UI updates
    let voteDiff = 0;
    let nextVote: 1 | -1 | null = null;

    if (userVote === value) {
      nextVote = null;
      voteDiff = -value;
    } else if (userVote === null) {
      nextVote = value;
      voteDiff = value;
    } else {
      nextVote = value;
      voteDiff = value * 2;
    }

    setUserVote(nextVote);
    setVoteCount(prev => prev + voteDiff);

    try {
      await vote('post', post.id, value, currentSessionId);
      if (onVoteSuccess) onVoteSuccess();
    } catch (err) {
      console.error('Vote failed', err);
      setUserVote(userVote);
      setVoteCount(post.upvotes - post.downvotes);
    } finally {
      setIsVoting(false);
    }
  };

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsReporting(true);
    setReportError(null);

    const finalReason = reportReason === 'other' ? customReason.trim() : reportReason;
    if (!finalReason) {
      setReportError('Please provide a reason for the report.');
      setIsReporting(false);
      return;
    }

    try {
      await report('post', post.id, finalReason, currentSessionId);
      setShowReportModal(false);
      if (onReportSuccess) onReportSuccess();
    } catch (err: any) {
      setReportError(err.message || 'Failed to submit report. You may have already reported this post.');
    } finally {
      setIsReporting(false);
    }
  };

  const handleStartChat = async () => {
    if (isMessaging) return;
    setIsMessaging(true);
    try {
      const thread = await createDMThread(post.id, currentSessionId);
      router.push(`/messages?threadId=${thread.id}`);
    } catch (err: any) {
      console.error('Start chat error:', err);
      alert('Could not start conversation: ' + (err.message || 'Internal error'));
    } finally {
      setIsMessaging(false);
    }
  };

  return (
    <div className="w-full bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800/80 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 p-4 relative group" id={`post-${post.id}`}>
      <div className="flex items-start justify-between space-x-3">
        {/* Post Meta / Author Info */}
        <div className="flex items-center space-x-2">
          <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg border ${identity.bgClass} ${identity.textClass} ${identity.borderClass}`}>
            {identity.fullName}
          </span>
          {isOP && (
            <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700/60 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider">
              OP
            </span>
          )}
          <span className="text-gray-450 dark:text-gray-500 text-xs font-semibold bg-gray-50 dark:bg-gray-800 px-2 py-0.5 rounded-lg border border-gray-100 dark:border-gray-800/50">
            {post.category}
          </span>
          <span className="text-gray-400 dark:text-gray-600 text-xs">
            {formatTimeAgo(post.created_at)}
          </span>
        </div>

        {/* Report Button */}
        <button
          onClick={() => setShowReportModal(true)}
          className="text-gray-400 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200"
          title="Report post"
          id={`report-btn-${post.id}`}
        >
          <AlertTriangle className="w-4 h-4" />
        </button>
      </div>

      {/* Post Text & Image */}
      <div className="mt-3.5 space-y-3">
        <Link href={`/post/${post.id}`} className="block">
          <p className="text-gray-800 dark:text-gray-200 text-base leading-relaxed break-words whitespace-pre-wrap">
            {post.content}
          </p>
        </Link>

        {post.image_url && (
          <div className="relative rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800 max-h-[300px] cursor-pointer group/img" onClick={() => setShowLightbox(true)}>
            <img
              src={post.image_url}
              alt="Post attachment"
              className="max-h-[300px] w-full object-cover transition-transform duration-500 group-hover/img:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-black/10 opacity-0 group-hover/img:opacity-100 transition-opacity duration-300 flex items-center justify-center text-white text-xs font-medium">
              Click to view full image
            </div>
          </div>
        )}
      </div>

      {/* Post Footer Actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80">
        {/* Voting interface */}
        <div className="flex items-center bg-gray-50 dark:bg-gray-800/40 rounded-xl p-0.5 border border-gray-100 dark:border-gray-850">
          <button
            onClick={() => handleVote(1)}
            disabled={isVoting}
            className={`p-1.5 rounded-lg transition-all duration-150 active:scale-[0.80] ease-out ${
              userVote === 1
                ? 'text-upvote bg-upvote/10 border-upvote/20'
                : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
            }`}
            aria-label="Upvote"
            id={`upvote-btn-${post.id}`}
          >
            <ArrowBigUp className={`w-5 h-5 ${userVote === 1 ? 'fill-current' : ''}`} />
          </button>
          
          <span className={`px-2 text-sm font-bold tabular-nums min-w-[20px] text-center ${
            voteCount > 0 
              ? 'text-upvote' 
              : voteCount < 0 
              ? 'text-downvote' 
              : 'text-gray-500 dark:text-gray-400'
          }`}>
            {voteCount}
          </span>

          <button
            onClick={() => handleVote(-1)}
            disabled={isVoting}
            className={`p-1.5 rounded-lg transition-all duration-150 active:scale-[0.80] ease-out ${
              userVote === -1
                ? 'text-downvote bg-downvote/10 border-downvote/20'
                : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
            }`}
            aria-label="Downvote"
            id={`downvote-btn-${post.id}`}
          >
            <ArrowBigDown className={`w-5 h-5 ${userVote === -1 ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Message Button (DMs) & Comments */}
        <div className="flex items-center space-x-1">
          {!isOP && (
            <button
              onClick={handleStartChat}
              disabled={isMessaging}
              className="flex items-center space-x-1.5 text-gray-505 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-400 px-3 py-1.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-all duration-200 disabled:opacity-50"
              id={`message-btn-${post.id}`}
            >
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs font-semibold">Message</span>
            </button>
          )}

          <Link href={`/post/${post.id}`} className="flex items-center space-x-1.5 text-gray-505 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 px-3 py-1.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-all duration-200">
            <MessageCircle className="w-4.5 h-4.5" />
            <span className="text-xs font-semibold">{commentCount}</span>
          </Link>
        </div>
      </div>

      {/* Lightbox Modal */}
      {showLightbox && post.image_url && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowLightbox(false)}>
          <button
            onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all duration-200"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={post.image_url}
            alt="Full size attachment"
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Report Anonymous Post</h3>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReport} className="mt-4 space-y-4">
              {reportError && (
                <div className="p-2.5 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded-xl border border-red-100 dark:border-red-900/50">
                  {reportError}
                </div>
              )}

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Help maintain a respectful environment. Why are you reporting this anonymous post?
              </p>

              <div className="space-y-2">
                {['spam', 'harassment', 'violence', 'inappropriate', 'other'].map((reason) => (
                  <label key={reason} className="flex items-center space-x-3 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition-all duration-200">
                    <input
                      type="radio"
                      name="report-reason"
                      value={reason}
                      checked={reportReason === reason}
                      onChange={() => setReportReason(reason)}
                      className="text-emerald-500 focus:ring-emerald-500 h-4 w-4 bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                    />
                    <span className="text-sm capitalize text-gray-700 dark:text-gray-300">
                      {reason === 'inappropriate' ? 'Inappropriate content' : reason}
                    </span>
                  </label>
                ))}
              </div>

              {reportReason === 'other' && (
                <textarea
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Describe the issue (max 100 characters)..."
                  maxLength={100}
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-transparent text-gray-800 dark:text-gray-200 focus:ring-emerald-500 focus:border-emerald-500 text-sm focus:outline-none"
                  required
                />
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReporting}
                  className="flex-1 py-2.5 rounded-xl bg-danger hover:bg-danger/90 text-white text-sm font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50"
                  id={`submit-report-${post.id}`}
                >
                  {isReporting ? 'Reporting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
