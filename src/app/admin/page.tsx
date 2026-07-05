'use client';

import { useState, useEffect } from 'react';
import { ShieldCheck, Lock, ArrowLeft, RefreshCw, Eye, EyeOff, AlertTriangle, Check, Trash, MessageSquare } from 'lucide-react';
import { getReportedItems, getReportedDMs, moderateContent, isMockMode, ReportedItem, ReportedDM } from '@/lib/supabase';
import { formatTimeAgo } from '@/lib/utils';
import Link from 'next/link';

export default function AdminDashboard() {
  const [passphrase, setPassphrase] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [reports, setReports] = useState<ReportedItem[]>([]);
  const [reportedDMs, setReportedDMs] = useState<ReportedDM[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Auto authenticate if passphrase is saved in sessionStorage
  useEffect(() => {
    const savedPass = sessionStorage.getItem('yak_admin_pass');
    if (savedPass) {
      setPassphrase(savedPass);
      fetchReports(savedPass);
    }
  }, []);

  const fetchReports = async (pass: string) => {
    setIsLoading(true);
    setError(null);
    try {
      let fetchedReports: ReportedItem[] = [];
      let fetchedDMs: ReportedDM[] = [];

      if (isMockMode) {
        fetchedReports = await getReportedItems(pass);
        fetchedDMs = await getReportedDMs(pass);
      } else {
        const res = await fetch(`/api/admin/action?passphrase=${encodeURIComponent(pass)}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.message || 'Authentication failed');
        }
        const data = await res.json();
        fetchedReports = data.reports || [];
        fetchedDMs = data.reportedDMs || [];
      }

      setReports(fetchedReports);
      setReportedDMs(fetchedDMs);
      setIsAuthenticated(true);
      sessionStorage.setItem('yak_admin_pass', pass);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Incorrect passphrase or connection error');
      setIsAuthenticated(false);
      sessionStorage.removeItem('yak_admin_pass');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passphrase.trim()) return;
    fetchReports(passphrase.trim());
  };

  const handleAction = async (
    action: 'restore' | 'delete', 
    targetType: 'post' | 'comment' | 'dm_message' | 'dm_thread', 
    targetId: string
  ) => {
    setActionLoading(targetId);
    setError(null);
    setSuccessMsg(null);

    try {
      await moderateContent(action, targetType, targetId, passphrase);
      setSuccessMsg(`Action completed successfully.`);
      
      // Refresh list
      await fetchReports(passphrase);
      
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to complete moderation action.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setPassphrase('');
    setReports([]);
    setReportedDMs([]);
    sessionStorage.removeItem('yak_admin_pass');
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 text-gray-950 dark:text-gray-150 transition-colors">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-3xl p-6 shadow-xl space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-500 rounded-2xl">
              <Lock className="w-8 h-8" />
            </div>
            <h1 className="text-xl font-bold">Admin Moderation</h1>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Enter the hardcoded passphrase to access reported feed items.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-450 text-xs rounded-xl border border-red-100 dark:border-red-900/50" id="admin-login-error">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                Passphrase
              </label>
              <input
                type="password"
                placeholder="••••••••••••"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-850 bg-transparent text-gray-800 dark:text-gray-200 focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm transition-all"
                id="admin-passphrase-input"
                required
              />
            </div>

            <div className="flex space-x-3 pt-2">
              <Link 
                href="/" 
                className="flex-1 py-3 text-center rounded-xl border border-gray-200 dark:border-gray-855 hover:bg-gray-50 dark:hover:bg-gray-800/50 text-sm font-semibold text-gray-600 dark:text-gray-400 transition-colors"
              >
                Back to Feed
              </Link>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-emerald-500/10 active:scale-95 disabled:opacity-50"
                id="admin-login-btn"
              >
                {isLoading ? 'Verifying...' : 'Unlock'}
              </button>
            </div>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 transition-colors duration-300">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link 
            href="/" 
            className="flex items-center space-x-1.5 text-gray-550 hover:text-gray-855 dark:text-gray-400 dark:hover:text-gray-200 transition-colors font-semibold text-xs"
            id="admin-back-btn"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Feed</span>
          </Link>

          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <h1 className="text-base font-black tracking-tight text-gray-800 dark:text-gray-250">
              Moderator Desk
            </h1>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => fetchReports(passphrase)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-900 text-gray-505 transition-colors"
              title="Refresh reports"
              id="admin-refresh-btn"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleLogout}
              className="px-2.5 py-1.5 text-xs font-semibold bg-gray-100 hover:bg-gray-200 dark:bg-gray-850 dark:hover:bg-gray-800 rounded-lg text-red-500 transition-colors"
              id="admin-logout-btn"
            >
              Lock
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <section className="max-w-xl mx-auto px-4 py-6 space-y-6">
        
        {isMockMode && (
          <div className="flex items-center space-x-2 p-2 px-3 bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 rounded-xl border border-amber-100 dark:border-amber-900/50 text-[11px]">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Working in offline Mock Mode (LocalStorage sync is active).</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl border border-emerald-100 dark:border-emerald-900/50">
            {successMsg}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 text-xs rounded-xl border border-red-100 dark:border-red-900/50">
            {error}
          </div>
        )}

        {/* ========================================== */}
        {/* DIRECT MESSAGES MODERATION SECTION (CRITICAL) */}
        {/* ========================================== */}
        <div className="bg-red-50/30 dark:bg-red-950/10 border-2 border-red-100 dark:border-red-950/50 rounded-3xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-red-100/50 dark:border-red-950/30 pb-3">
            <div>
              <h2 className="text-sm font-extrabold text-red-600 dark:text-red-400 flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-red-500 fill-current animate-pulse" />
                <span>Reported Direct Messages</span>
              </h2>
              <p className="text-[11px] text-gray-450 dark:text-gray-500 font-medium">
                High Priority: Private user-to-user messages flagged for moderation review.
              </p>
            </div>
            <span className="bg-red-500 text-white font-extrabold px-3 py-1 rounded-xl text-xs tabular-nums shadow-xs">
              {reportedDMs.length} Flagged
            </span>
          </div>

          <div className="space-y-4">
            {reportedDMs.length > 0 ? (
              reportedDMs.map((dm) => (
                <div 
                  key={dm.id}
                  className="bg-white dark:bg-gray-900/80 border border-red-200/50 dark:border-red-900/30 rounded-2xl p-4 space-y-4 relative shadow-sm"
                  id={`reported-dm-${dm.id}`}
                >
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-red-500 font-bold bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 px-2 py-0.5 rounded-lg">
                      Reason: {dm.report_reason}
                    </span>
                    <span className="text-gray-450 dark:text-gray-500 font-semibold truncate max-w-[200px]">
                      Sender: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-red-500">{dm.sender_session_id.substring(0, 10)}...</code>
                    </span>
                  </div>

                  {/* Context Messages Box */}
                  <div className="space-y-1.5 p-3 bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-850">
                    <span className="text-[9px] font-black text-gray-400 dark:text-gray-600 uppercase tracking-widest block">
                      Conversation Context (Last 5 messages)
                    </span>
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                      {dm.history && dm.history.map((hMsg, hIdx) => {
                        const isTarget = hMsg.content === dm.content && hMsg.sender_session_id === dm.sender_session_id;
                        return (
                          <div 
                            key={hIdx} 
                            className={`p-2 rounded-lg text-xs border ${
                              isTarget 
                                ? 'bg-red-50/40 dark:bg-red-950/30 border-red-200 dark:border-red-900/40 text-red-650 dark:text-red-300' 
                                : 'bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 text-gray-650 dark:text-gray-400'
                            }`}
                          >
                            <div className="flex justify-between items-center text-[9px] text-gray-400 dark:text-gray-600 mb-0.5">
                              <span>User: {hMsg.sender_session_id.substring(0, 6)}...</span>
                              <span>{formatTimeAgo(hMsg.created_at)}</span>
                            </div>
                            <p className="break-words">{hMsg.content}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 dark:border-gray-850/80">
                    <button
                      onClick={() => handleAction('restore', 'dm_message', dm.id)}
                      disabled={actionLoading !== null}
                      className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold"
                      id={`restore-dm-${dm.id}`}
                    >
                      Restore Msg
                    </button>
                    <button
                      onClick={() => handleAction('delete', 'dm_message', dm.id)}
                      disabled={actionLoading !== null}
                      className="flex-1 py-2 bg-red-55 hover:bg-red-105 dark:bg-red-950/20 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 rounded-xl text-xs font-semibold"
                      id={`delete-dm-msg-${dm.id}`}
                    >
                      Delete Msg
                    </button>
                    <button
                      onClick={() => handleAction('delete', 'dm_thread', dm.thread_id)}
                      disabled={actionLoading !== null}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-sm"
                      id={`delete-dm-thread-${dm.id}`}
                    >
                      End Thread
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-6 text-xs text-gray-400 dark:text-gray-500 font-semibold">
                No reported DM logs. Inbox is fully compliant.
              </p>
            )}
          </div>
        </div>

        {/* Queue Metrics bar */}
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <h2 className="text-sm font-extrabold text-gray-800 dark:text-gray-250">General Reports Queue</h2>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Content flagged in the main public channels.
            </p>
          </div>
          <span className="bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/50 font-bold px-3 py-1 rounded-xl text-sm tabular-nums">
            {reports.length}
          </span>
        </div>

        {/* Feed Reports Queue */}
        <div className="space-y-4">
          {reports.length > 0 ? (
            reports.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-5 shadow-sm space-y-4 relative"
                id={`reported-item-${item.id}`}
              >
                {/* Header Flag Status */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md ${
                      item.target_type === 'post'
                        ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border border-blue-100'
                        : 'bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100'
                    }`}>
                      {item.target_type}
                    </span>
                    <span className="text-gray-405 dark:text-gray-550 text-xs">
                      {formatTimeAgo(item.created_at)}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-xs font-semibold">
                    <span className="text-red-500 flex items-center space-x-1">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>{item.report_count} flags</span>
                    </span>
                    <span className={`flex items-center space-x-1 ${item.is_hidden ? 'text-gray-450' : 'text-emerald-500'}`}>
                      {item.is_hidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{item.is_hidden ? 'Hidden' : 'Visible'}</span>
                    </span>
                  </div>
                </div>

                {/* Session ID display to identify repeat offenders! */}
                {item.session_id && (
                  <div className="text-[10px] text-gray-400 dark:text-gray-600 flex items-center space-x-1.5">
                    <span className="font-bold">Author session ID:</span>
                    <code className="bg-gray-100 dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700/50 px-1.5 py-0.5 rounded text-gray-650 dark:text-gray-400 select-all font-mono">
                      {item.session_id}
                    </code>
                  </div>
                )}

                {/* Flagged Content */}
                <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-xl border border-gray-100 dark:border-gray-850">
                  <p className="text-sm text-gray-800 dark:text-gray-250 leading-relaxed whitespace-pre-wrap break-words">
                    {item.content}
                  </p>
                </div>

                {/* Flag Reasons */}
                {item.reasons && item.reasons.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider block">
                      Report Reasons
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {item.reasons.map((reason, rIdx) => (
                        <span
                          key={rIdx}
                          className="bg-red-50/50 dark:bg-red-950/10 text-red-600 dark:text-red-400 border border-red-100/30 px-2 py-0.5 rounded-lg text-xs"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Moderation Controls */}
                <div className="flex items-center space-x-3 pt-3 border-t border-gray-100 dark:border-gray-850">
                  <button
                    onClick={() => handleAction('restore', item.target_type, item.id)}
                    disabled={actionLoading !== null}
                    className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                    id={`restore-btn-${item.id}`}
                  >
                    <Check className="w-4 h-4" />
                    <span>{actionLoading === item.id ? 'Restoring...' : 'Restore'}</span>
                  </button>
                  <button
                    onClick={() => handleAction('delete', item.target_type, item.id)}
                    disabled={actionLoading !== null}
                    className="flex-1 flex items-center justify-center space-x-1.5 py-2.5 bg-red-50 hover:bg-red-100 dark:bg-red-950/20 dark:hover:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-650 dark:text-red-400 rounded-xl text-xs font-semibold transition-all active:scale-95 disabled:opacity-50"
                    id={`delete-btn-${item.id}`}
                  >
                    <Trash className="w-4 h-4" />
                    <span>{actionLoading === item.id ? 'Deleting...' : 'Delete Permanently'}</span>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl p-6">
              <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-200">Inbox is completely clean!</h3>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 max-w-xs mx-auto">
                No reported or hidden content requires review. Good job, moderator!
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
