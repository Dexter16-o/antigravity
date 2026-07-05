'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { createComment } from '@/lib/supabase';

interface CommentComposerProps {
  postId: string;
  parentCommentId: string | null;
  sessionId: string;
  onCommentCreated: () => void;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export default function CommentComposer({
  postId,
  parentCommentId,
  sessionId,
  onCommentCreated,
  onCancel,
  placeholder = 'Add a comment...',
  autoFocus = false
}: CommentComposerProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const maxChars = 500;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    if (content.length > maxChars) return;

    if (!navigator.onLine) {
      setErrorMsg('Cannot submit comment: You are offline.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await createComment(postId, parentCommentId, content.trim(), sessionId);
      setContent('');
      onCommentCreated();
      if (onCancel) onCancel();
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to submit comment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full bg-gray-50/50 dark:bg-gray-800/20 border border-gray-100 dark:border-gray-850 rounded-xl p-3 transition-all duration-300">
      <form onSubmit={handleSubmit} className="space-y-2.5">
        {errorMsg && (
          <div className="p-2.5 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 text-xs rounded-xl border border-red-100 dark:border-red-900/50">
            {errorMsg}
          </div>
        )}

        <div className="flex items-center space-x-2">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value.slice(0, maxChars))}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="flex-1 bg-transparent border-0 resize-none focus:ring-0 focus:outline-none text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-600 min-h-[44px]"
            disabled={isSubmitting}
            id={`comment-textarea-${parentCommentId || 'root'}`}
          />
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-800/80">
          <span className="text-[10px] tabular-nums text-gray-400 dark:text-gray-650">
            {maxChars - content.length} chars left
          </span>

          <div className="flex space-x-2">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:bg-gray-150 dark:hover:bg-gray-800/60 transition-all duration-200"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!content.trim() || isSubmitting}
              className={`flex items-center space-x-1.5 px-4 py-1.5 rounded-lg font-semibold text-xs transition-all duration-200 active:scale-95 ${
                !content.trim() || isSubmitting
                  ? 'bg-gray-100 dark:bg-gray-850 text-gray-405 dark:text-gray-600 cursor-not-allowed'
                  : 'bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white shadow-sm shadow-emerald-500/10'
              }`}
              id={`comment-submit-btn-${parentCommentId || 'root'}`}
            >
              <span>Reply</span>
              <Send className="w-3 h-3" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
