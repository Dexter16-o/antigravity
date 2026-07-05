'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageSquare, ArrowLeft, Send, ShieldAlert, Ban, Flag, Sparkles, RefreshCw, AlertCircle, X } from 'lucide-react';
import { getOrCreateSessionId } from '@/lib/utils';
import { 
  getDMThreads, 
  getDMMessages, 
  sendDMMessage, 
  blockDMThread, 
  reportDMMessage, 
  subscribeToUpdates,
  DMThread, 
  DMMessage,
  isMockMode 
} from '@/lib/supabase';
import ThemeToggle from '@/components/ThemeToggle';
import Link from 'next/link';

function MessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeThreadParam = searchParams.get('threadId');

  const [sessionId, setSessionId] = useState('');
  const [threads, setThreads] = useState<DMThread[]>([]);
  const [messages, setMessages] = useState<DMMessage[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(activeThreadParam);
  
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingThreads, setIsLoadingThreads] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showReportModal, setShowReportModal] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('harassment');
  const [customReason, setCustomReason] = useState('');
  const [isReporting, setIsReporting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Initialize Session
  useEffect(() => {
    setSessionId(getOrCreateSessionId());
  }, []);

  // 2. Fetch Threads
  const loadThreads = async () => {
    if (!sessionId) return;
    try {
      const list = await getDMThreads(sessionId);
      setThreads(list);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingThreads(false);
    }
  };

  useEffect(() => {
    if (sessionId) {
      loadThreads();
    }
  }, [sessionId]);

  // 3. Fetch Messages for Active Thread
  const loadMessages = async (threadId: string) => {
    if (!sessionId) return;
    setIsLoadingMessages(true);
    try {
      const msgs = await getDMMessages(threadId, sessionId);
      setMessages(msgs);
      setErrorMsg(null);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to load messages');
    } finally {
      setIsLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (activeThreadId) {
      loadMessages(activeThreadId);
    } else {
      setMessages([]);
    }
  }, [activeThreadId, sessionId]);

  // Handle URL param changes
  useEffect(() => {
    if (activeThreadParam) {
      setActiveThreadId(activeThreadParam);
    }
  }, [activeThreadParam]);

  // 4. Realtime Messages syncing
  useEffect(() => {
    const unsubscribe = subscribeToUpdates(() => {
      // Reload both threads list (for new messages/updates) and active thread messages
      loadThreads();
      if (activeThreadId) {
        // Run without triggering full loading states for smooth insertion
        getDMMessages(activeThreadId, sessionId)
          .then(setMessages)
          .catch(console.error);
      }
    });
    return () => unsubscribe();
  }, [activeThreadId, sessionId]);

  // 5. Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 6. Actions
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeThreadId || !newMessage.trim() || isSending) return;

    if (!navigator.onLine) {
      setErrorMsg('Cannot send message: You are offline.');
      return;
    }

    setIsSending(true);
    setErrorMsg(null);
    const content = newMessage.trim();
    setNewMessage('');

    try {
      await sendDMMessage(activeThreadId, content, sessionId);
      // Let subscription reload, or fetch immediately
      const msgs = await getDMMessages(activeThreadId, sessionId);
      setMessages(msgs);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to send message');
      setNewMessage(content); // restore text on failure
    } finally {
      setIsSending(false);
    }
  };

  const handleEndConversation = async () => {
    if (!activeThreadId) return;
    if (!confirm('Are you sure you want to end this conversation? You will not be able to message each other again.')) return;

    try {
      await blockDMThread(activeThreadId, sessionId);
      loadThreads();
      if (activeThreadId) {
        loadMessages(activeThreadId);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to end conversation');
    }
  };

  const submitMsgReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReportModal || isReporting) return;

    setIsReporting(true);
    const finalReason = reportReason === 'other' ? customReason.trim() : reportReason;
    
    try {
      await reportDMMessage(showReportModal, finalReason, sessionId);
      alert('Message has been reported to the campus moderators.');
      setShowReportModal(null);
      setCustomReason('');
    } catch (err: any) {
      alert(err.message || 'Report submission failed');
    } finally {
      setIsReporting(false);
    }
  };

  const activeThread = threads.find(t => t.id === activeThreadId);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white dark:bg-gray-900 border-b border-gray-200/60 dark:border-gray-800/80 px-4 py-3.5 shadow-sm">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link 
              href="/"
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-black tracking-tight bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              <span>Campus DMs</span>
            </h1>
          </div>
          <div className="flex items-center space-x-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Inbox Grid */}
      <section className="flex-1 max-w-5xl w-full mx-auto p-4 flex gap-4 overflow-hidden h-[calc(100vh-73px)]">
        {/* Left Side: Thread List */}
        <div className={`w-full md:w-80 flex-shrink-0 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 flex flex-col overflow-hidden ${activeThreadId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-gray-100 dark:border-gray-800/80 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-gray-800 dark:text-gray-250">Conversations</h2>
            <button 
              onClick={loadThreads} 
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Refresh threads"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {isLoadingThreads ? (
              [1, 2, 3].map(n => (
                <div key={n} className="h-16 bg-gray-100 dark:bg-gray-850 rounded-xl animate-pulse w-full"></div>
              ))
            ) : threads.length > 0 ? (
              threads.map(thread => {
                const isActive = thread.id === activeThreadId;
                return (
                  <button
                    key={thread.id}
                    onClick={() => {
                      setActiveThreadId(thread.id);
                      router.replace(`/messages?threadId=${thread.id}`);
                    }}
                    className={`w-full text-left p-3 rounded-xl transition-all duration-200 flex items-center space-x-3 border ${
                      isActive 
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/50' 
                        : 'border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/40'
                    }`}
                    id={`thread-item-${thread.id}`}
                  >
                    <div className={`w-10 h-10 rounded-full border flex items-center justify-center text-sm font-black flex-shrink-0 ${thread.other_user_bg} ${thread.other_user_color} ${thread.other_user_border}`}>
                      {thread.other_user_name?.substring(0, 2)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-black truncate text-gray-800 dark:text-gray-200">
                          {thread.other_user_name}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 font-semibold uppercase mt-0.5 truncate">
                        Post context
                      </p>
                      {thread.is_blocked && (
                        <span className="inline-flex items-center text-[9px] text-red-500 dark:text-red-400 font-bold bg-red-50 dark:bg-red-950/20 px-1.5 py-0.5 rounded border border-red-100/50 dark:border-red-900/30 mt-1">
                          Ended
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-12 px-4">
                <span className="text-3xl block">💬</span>
                <h3 className="text-xs font-bold text-gray-700 dark:text-gray-400 mt-2">Inbox is empty</h3>
                <p className="text-[11px] text-gray-450 dark:text-gray-600 mt-1">
                  Message a user on their anonymous feed post to start a private, secure DM conversation!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Chat Window */}
        <div className={`flex-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 flex flex-col overflow-hidden ${!activeThreadId ? 'hidden md:flex' : 'flex'}`}>
          {activeThread ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-gray-100 dark:border-gray-850 flex items-center justify-between bg-white dark:bg-gray-900/50 backdrop-blur-md">
                <div className="flex items-center space-x-3">
                  <button 
                    onClick={() => {
                      setActiveThreadId(null);
                      router.replace('/messages');
                    }}
                    className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className={`w-9 h-9 rounded-full border flex items-center justify-center text-xs font-black ${activeThread.other_user_bg} ${activeThread.other_user_color} ${activeThread.other_user_border}`}>
                    {activeThread.other_user_name?.substring(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-gray-800 dark:text-gray-200">
                      {activeThread.other_user_name}
                    </h3>
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold">
                      ANONYMOUS CHAT
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-1.5">
                  {!activeThread.is_blocked && (
                    <button
                      onClick={handleEndConversation}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-red-150 text-red-500 dark:border-red-950/50 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs font-bold transition-all duration-200"
                      title="End and lock this conversation"
                      id="end-conversation-btn"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">End Chat</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Chat Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/30">
                {errorMsg && (
                  <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 text-xs rounded-xl border border-red-100 dark:border-red-900/50">
                    {errorMsg}
                  </div>
                )}

                {isLoadingMessages ? (
                  <div className="flex justify-center items-center py-12">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-500" />
                  </div>
                ) : messages.length > 0 ? (
                  messages.map(msg => (
                    <div 
                      key={msg.id}
                      className={`flex flex-col max-w-[80%] ${msg.is_me ? 'ml-auto items-end' : 'mr-auto items-start'}`}
                    >
                      <div className={`p-3 rounded-2xl text-sm leading-relaxed break-words border shadow-xs ${
                        msg.is_me 
                          ? 'bg-emerald-500 text-white border-emerald-450 rounded-tr-none' 
                          : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-100 dark:border-gray-700/80 rounded-tl-none'
                      }`}>
                        <p>{msg.content}</p>
                      </div>
                      
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-[9px] text-gray-400 dark:text-gray-600">
                          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {!msg.is_me && !msg.is_reported && (
                          <button
                            onClick={() => setShowReportModal(msg.id)}
                            className="text-[9px] text-gray-400 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 font-bold transition-all duration-200"
                            id={`report-msg-${msg.id}`}
                          >
                            Report
                          </button>
                        )}
                        {msg.is_reported && (
                          <span className="text-[9px] text-red-400 font-semibold">
                            Reported
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-16 text-gray-400 dark:text-gray-600">
                    <Sparkles className="w-8 h-8 mx-auto mb-2 text-emerald-500/60 animate-pulse" />
                    <p className="text-xs font-semibold">Say hello! Secure anonymous messaging starts here.</p>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Footer Input */}
              <div className="p-4 border-t border-gray-100 dark:border-gray-850">
                {activeThread.is_blocked ? (
                  <div className="flex items-center space-x-2.5 p-3.5 bg-gray-100 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 text-xs font-bold">
                    <AlertCircle className="w-4 h-4 text-gray-400" />
                    <span>This conversation has been ended. No further messages can be sent.</span>
                  </div>
                ) : (
                  <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Type a secure anonymous message..."
                      className="flex-1 px-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 text-gray-850 dark:text-gray-150 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:outline-none text-sm shadow-xs placeholder-gray-450 dark:placeholder-gray-600"
                      disabled={isSending}
                      maxLength={1000}
                      id="dm-message-input"
                    />
                    <button
                      type="submit"
                      disabled={!newMessage.trim() || isSending}
                      className={`p-3 rounded-2xl text-white transition-all duration-200 active:scale-95 ${
                        !newMessage.trim() || isSending
                          ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                          : 'bg-emerald-500 hover:bg-emerald-600 shadow-sm shadow-emerald-500/20'
                      }`}
                      id="dm-send-btn"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <span className="text-5xl mb-4">💬</span>
              <h3 className="text-base font-extrabold text-gray-800 dark:text-gray-200">No Chat Selected</h3>
              <p className="text-xs text-gray-450 dark:text-gray-600 mt-1.5 max-w-sm">
                Pick an existing conversation from the side menu, or click the "Message" button on any post in the main feed to start a new chat.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Message Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-gray-900 border border-gray-150 dark:border-gray-800 rounded-2xl p-5 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-red-500" />
                <span>Report DM Message</span>
              </h3>
              <button
                onClick={() => setShowReportModal(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitMsgReport} className="mt-4 space-y-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Reports are treated with high priority. Please select a reason for reporting this message.
              </p>

              <div className="space-y-2">
                {['harassment', 'spam', 'hate speech', 'threats', 'other'].map((reason) => (
                  <label key={reason} className="flex items-center space-x-3 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer transition-all duration-200">
                    <input
                      type="radio"
                      name="msg-report-reason"
                      value={reason}
                      checked={reportReason === reason}
                      onChange={() => setReportReason(reason)}
                      className="text-emerald-500 focus:ring-emerald-500 h-4 w-4 bg-gray-100 dark:bg-gray-850 border-gray-300 dark:border-gray-700"
                    />
                    <span className="text-sm capitalize text-gray-700 dark:text-gray-350">
                      {reason}
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
                  className="w-full p-2.5 rounded-xl border border-gray-250 dark:border-gray-800 bg-transparent text-gray-800 dark:text-gray-200 focus:ring-emerald-500 focus:border-emerald-500 text-sm focus:outline-none"
                  required
                />
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReportModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-850 transition-all duration-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isReporting}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 dark:bg-red-650 dark:hover:bg-red-700 text-white text-sm font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50"
                  id="submit-msg-report-btn"
                >
                  {isReporting ? 'Reporting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    }>
      <MessagesContent />
    </Suspense>
  );
}
