'use client';

import { useState } from 'react';
import { ArrowBigUp, ArrowBigDown, CornerDownRight, MessageSquare, AlertTriangle, X } from 'lucide-react';
import { getAnonymousIdentity } from '@/lib/identity';
import { formatTimeAgo } from '@/lib/utils';
import { vote, report, Comment } from '@/lib/supabase';
import CommentComposer from './CommentComposer';

interface CommentCardProps {
  comment: Comment;
  replies: Comment[];
  postId: string;
  currentSessionId: string;
  postAuthorSessionId: string;
  onActionSuccess: () => void;
}

export default function CommentCard({
  comment,
  replies,
  postId,
  currentSessionId,
  postAuthorSessionId,
  onActionSuccess
}: CommentCardProps) {
  const [userVote, setUserVote] = useState<1 | -1 | null>(null);
  const [voteCount, setVoteCount] = useState(comment.upvotes - comment.downvotes);
  const [isVoting, setIsVoting] = useState(false);
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('spam');
  const [customReason, setCustomReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // Generate anonymous identity for comment author
  // Keyed on post ID so identity is consistent in the thread
  const identity = getAnonymousIdentity(comment.session_id, postId);
  const isOP = comment.session_id === postAuthorSessionId;
  const isMyComment = comment.session_id === currentSessionId;

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
      await vote('comment', comment.id, value, currentSessionId);
      onActionSuccess();
    } catch (err) {
      console.error('Vote failed', err);
      setUserVote(userVote);
      setVoteCount(comment.upvotes - comment.downvotes);
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
      await report('comment', comment.id, finalReason, currentSessionId);
      setShowReportModal(false);
      onActionSuccess();
    } catch (err: any) {
      setReportError(err.message || 'Failed to report comment. You may have already reported it.');
    } finally {
      setIsReporting(false);
    }
  };

  return (
    <div className="border-b border-gray-100 dark:border-gray-800/80 py-4 last:border-b-0" id={`comment-${comment.id}`}>
      {/* Comment Card Main Container */}
      <div className="flex space-x-3">
        {/* Left padding/line for visual flow */}
        <div className="flex-1 space-y-2">
          {/* Comment Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className={`px-2 py-0.5 text-[11px] font-semibold rounded-md border ${identity.bgClass} ${identity.textClass} ${identity.borderClass}`}>
                {identity.fullName}
              </span>
              {isOP && (
                <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700/60 px-1 py-0.2 rounded text-[9px] font-bold tracking-wider">
                  OP
                </span>
              )}
              <span className="text-gray-400 dark:text-gray-600 text-[11px]">
                {formatTimeAgo(comment.created_at)}
              </span>
            </div>

            <button
              onClick={() => setShowReportModal(true)}
              className="text-gray-400 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 p-1 rounded transition-colors duration-150"
              title="Report comment"
              id={`report-comment-btn-${comment.id}`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Comment Content */}
          <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed break-words whitespace-pre-wrap">
            {comment.content}
          </p>

          {/* Comment Actions */}
          <div className="flex items-center space-x-4 pt-1 text-xs">
            {/* Voting */}
            <div className="flex items-center bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-100 dark:border-gray-850 p-0.5">
              <button
                onClick={() => handleVote(1)}
                disabled={isVoting}
                className={`p-1 rounded-md transition-all duration-150 active:scale-[0.80] ease-out ${
                  userVote === 1
                    ? 'text-upvote bg-upvote/10 border-upvote/20'
                    : 'text-gray-455 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                }`}
                id={`comment-upvote-${comment.id}`}
              >
                <ArrowBigUp className="w-4.5 h-4.5" />
              </button>
              
              <span className={`px-1.5 font-bold tabular-nums min-w-[14px] text-center ${
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
                className={`p-1 rounded-md transition-all duration-150 active:scale-[0.80] ease-out ${
                  userVote === -1
                    ? 'text-downvote bg-downvote/10 border-downvote/20'
                    : 'text-gray-455 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
                }`}
                id={`comment-downvote-${comment.id}`}
              >
                <ArrowBigDown className="w-4.5 h-4.5" />
              </button>
            </div>

            {/* Reply toggle (Only show if this is a top-level comment) */}
            {!comment.parent_comment_id && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="flex items-center space-x-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
                id={`reply-toggle-${comment.id}`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Reply</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inline Reply Composer */}
      {showReplyForm && (
        <div className="mt-3 ml-6 pl-2 border-l-2 border-emerald-500/20">
          <CommentComposer
            postId={postId}
            parentCommentId={comment.id}
            sessionId={currentSessionId}
            onCommentCreated={onActionSuccess}
            onCancel={() => setShowReplyForm(false)}
            placeholder={`Reply to ${identity.fullName}...`}
            autoFocus
          />
        </div>
      )}

      {/* Nested Replies Rendering */}
      {replies && replies.length > 0 && (
        <div className="mt-3 ml-6 space-y-3.5 pl-3 border-l border-gray-100 dark:border-gray-800/80">
          {replies.map((reply) => {
            const replyIdentity = getAnonymousIdentity(reply.session_id, postId);
            const isReplyOP = reply.session_id === postAuthorSessionId;
            return (
              <div key={reply.id} className="flex space-x-2 py-1" id={`comment-${reply.id}`}>
                <CornerDownRight className="w-4 h-4 text-gray-300 dark:text-gray-700 mt-1 flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${replyIdentity.bgClass} ${replyIdentity.textClass} ${replyIdentity.borderClass}`}>
                        {replyIdentity.fullName}
                      </span>
                      {isReplyOP && (
                        <span className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700/60 px-1 py-0.2 rounded text-[8px] font-bold tracking-wider">
                          OP
                        </span>
                      )}
                      <span className="text-gray-400 dark:text-gray-600 text-[10px]">
                        {formatTimeAgo(reply.created_at)}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        comment.id = reply.id; // reference sub-reply for report modal
                        setShowReportModal(true);
                      }}
                      className="text-gray-450 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 p-0.5 rounded transition-colors"
                      id={`report-reply-${reply.id}`}
                    >
                      <AlertTriangle className="w-3 h-3" />
                    </button>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-sm break-words whitespace-pre-wrap">
                    {reply.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Report Modal (For Comment or Reply) */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200">Report Comment</h3>
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
                Help maintain a respectful environment. Why are you reporting this comment?
              </p>

              <div className="space-y-2">
                {['spam', 'harassment', 'violence', 'inappropriate', 'other'].map((reason) => (
                  <label key={reason} className="flex items-center space-x-3 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition-all duration-200">
                    <input
                      type="radio"
                      name="report-comment-reason"
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
                  placeholder="Describe the issue..."
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
                  id={`submit-report-comment-${comment.id}`}
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
