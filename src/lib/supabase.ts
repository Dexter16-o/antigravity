import { createClient } from '@supabase/supabase-js';

// Check if we have valid Supabase credentials
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isSupabaseConfigured = 
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'your_supabase_url' && 
  supabaseAnonKey !== 'your_supabase_anon_key';

// Initialize Supabase Client
export const supabase = isSupabaseConfigured 
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

// Determine if we are running in mock mode
export const isMockMode = !isSupabaseConfigured;

// ----------------------------------------------------
// TypeScript Interfaces
// ----------------------------------------------------
export interface Post {
  id: string;
  content: string;
  image_url: string | null;
  session_id: string; // Exists in mock mode, stripped in server API responses
  is_author?: boolean; // Set dynamically in API routes and mock layer
  category: string;
  created_at: string;
  upvotes: number;
  downvotes: number;
  is_hidden: boolean;
  report_count: number;
}

export interface Comment {
  id: string;
  post_id: string;
  parent_comment_id: string | null;
  content: string;
  session_id: string;
  is_author?: boolean;
  created_at: string;
  upvotes: number;
  downvotes: number;
  is_hidden: boolean;
  report_count: number;
}

export interface Vote {
  id: string;
  session_id: string;
  target_type: 'post' | 'comment';
  target_id: string;
  vote_value: 1 | -1;
  created_at: string;
}

export interface Report {
  id: string;
  session_id: string;
  target_type: 'post' | 'comment';
  target_id: string;
  reason: string;
  created_at: string;
}

export interface DMThread {
  id: string;
  post_id: string;
  creator_session_id?: string;
  receiver_session_id?: string;
  other_user_name?: string; // Resolved anonymous identity
  other_user_color?: string;
  other_user_bg?: string;
  other_user_border?: string;
  is_blocked: boolean;
  blocked_by: string | null;
  created_at: string;
}

export interface DMMessage {
  id: string;
  thread_id: string;
  sender_session_id?: string;
  is_me?: boolean;
  content: string;
  is_reported: boolean;
  report_reason?: string | null;
  created_at: string;
}

export interface ReportedItem {
  id: string;
  target_type: 'post' | 'comment';
  content: string;
  report_count: number;
  is_hidden: boolean;
  reasons: string[];
  session_id?: string; // Kept in admin dashboard responses
  created_at: string;
}

export interface ReportedDM {
  id: string;
  thread_id: string;
  content: string;
  report_reason: string;
  reported_at: string;
  sender_session_id: string;
  post_id: string | null;
  history: Array<{
    content: string;
    sender_session_id: string;
    created_at: string;
  }>;
}

// ----------------------------------------------------
// LocalStorage Mock DB Helpers
// ----------------------------------------------------
const getMockData = <T>(key: string, defaultVal: T): T => {
  if (typeof window === 'undefined') return defaultVal;
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : defaultVal;
};

const setMockData = <T>(key: string, data: T) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent('yak-db-update'));
};

// Initialize Mock database with sample records
if (typeof window !== 'undefined' && !localStorage.getItem('yak_posts')) {
  const initialPosts: Post[] = [
    {
      id: 'p1',
      content: 'Welcome to the college anonymous feed! 🎓 Select a category tag to view channels, upvote, and start chatting.',
      image_url: null,
      session_id: 'mock-session-admin',
      category: 'General',
      created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      upvotes: 8,
      downvotes: 1,
      is_hidden: false,
      report_count: 0
    },
    {
      id: 'p2',
      content: 'The mess food today is actually decent? Or is it just me? Mechanical hostel mess is serving paneer curry today!',
      image_url: null,
      session_id: 'mock-session-user1',
      category: 'Hostel/Mess',
      created_at: new Date(Date.now() - 60000 * 15).toISOString(),
      upvotes: 4,
      downvotes: 0,
      is_hidden: false,
      report_count: 0
    }
  ];
  localStorage.setItem('yak_posts', JSON.stringify(initialPosts));
  localStorage.setItem('yak_comments', JSON.stringify([]));
  localStorage.setItem('yak_votes', JSON.stringify([]));
  localStorage.setItem('yak_reports', JSON.stringify([]));
  localStorage.setItem('yak_dm_threads', JSON.stringify([]));
  localStorage.setItem('yak_dm_messages', JSON.stringify([]));
}

// Helper to resolve other user emoji in mock mode DMs
import { getAnonymousIdentity } from './identity';

// ----------------------------------------------------
// Unified Data API
// ----------------------------------------------------

// 1. Fetch Posts
export async function getPosts(sortBy: 'new' | 'hot', category?: string | null): Promise<Post[]> {
  if (isMockMode) {
    const posts = getMockData<Post[]>('yak_posts', []);
    const currentSessionId = typeof window !== 'undefined' ? localStorage.getItem('yak_session_id') || '' : '';
    
    let visiblePosts = posts.filter(p => !p.is_hidden);
    if (category && category !== 'All') {
      visiblePosts = visiblePosts.filter(p => p.category === category);
    }

    const mapped = visiblePosts.map(p => ({
      ...p,
      is_author: p.session_id === currentSessionId
    }));

    if (sortBy === 'new') {
      return [...mapped].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      return [...mapped].sort((a, b) => {
        const scoreA = (a.upvotes - a.downvotes) - (Date.now() - new Date(a.created_at).getTime()) / (3600000 * 2);
        const scoreB = (b.upvotes - b.downvotes) - (Date.now() - new Date(b.created_at).getTime()) / (3600000 * 2);
        return scoreB - scoreA;
      });
    }
  }

  // Production Server API
  const url = `/api/posts?sortBy=${sortBy}${category ? `&category=${category}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load posts');
  const data = await res.json();
  return data.posts || [];
}

// 2. Fetch Single Post
export async function getPost(id: string): Promise<Post | null> {
  if (isMockMode) {
    const posts = getMockData<Post[]>('yak_posts', []);
    const currentSessionId = typeof window !== 'undefined' ? localStorage.getItem('yak_session_id') || '' : '';
    const post = posts.find(p => p.id === id);
    if (!post || post.is_hidden) return null;
    return {
      ...post,
      is_author: post.session_id === currentSessionId
    };
  }

  const res = await fetch(`/api/posts?id=${id}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.post || null;
}

// 3. Create Post
export async function createPost(
  content: string, 
  imageUrl: string | null, 
  sessionId: string, 
  category: string = 'General'
): Promise<Post> {
  if (isMockMode) {
    const posts = getMockData<Post[]>('yak_posts', []);

    // Rate Limiting check locally
    const lastPost = [...posts]
      .filter(p => p.session_id === sessionId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    if (lastPost) {
      const elapsed = (Date.now() - new Date(lastPost.created_at).getTime()) / 1000;
      if (elapsed < 60) {
        const remaining = Math.ceil(60 - elapsed);
        throw new Error(`Rate limit exceeded: You can only post once every 60 seconds. Please wait ${remaining} seconds.`);
      }
    }

    const newPost: Post = {
      id: Math.random().toString(36).substr(2, 9),
      content,
      image_url: imageUrl,
      session_id: sessionId,
      category,
      created_at: new Date().toISOString(),
      upvotes: 0,
      downvotes: 0,
      is_hidden: false,
      report_count: 0
    };

    posts.push(newPost);
    setMockData('yak_posts', posts);
    return { ...newPost, is_author: true };
  }

  // Server API
  const res = await fetch('/api/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, imageUrl, category })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to create post');
  }
  const data = await res.json();
  return data.post;
}

// 4. Vote
export async function vote(
  targetType: 'post' | 'comment',
  targetId: string,
  value: 1 | -1,
  sessionId: string
): Promise<void> {
  if (isMockMode) {
    const votes = getMockData<Vote[]>('yak_votes', []);
    
    // Vote spam rate limit check (5 per 10s)
    const recentVotes = votes.filter(v => v.session_id === sessionId && (Date.now() - new Date(v.created_at).getTime()) < 10000);
    if (recentVotes.length >= 5) {
      throw new Error('Rate limit exceeded: You are voting too fast. Max 5 votes per 10 seconds.');
    }

    const existingIndex = votes.findIndex(v => v.session_id === sessionId && v.target_id === targetId);

    if (existingIndex !== -1) {
      if (votes[existingIndex].vote_value === value) {
        votes.splice(existingIndex, 1);
      } else {
        votes[existingIndex].vote_value = value;
      }
    } else {
      votes.push({
        id: Math.random().toString(36).substr(2, 9),
        session_id: sessionId,
        target_type: targetType,
        target_id: targetId,
        vote_value: value,
        created_at: new Date().toISOString()
      });
    }
    setMockData('yak_votes', votes);

    // Apply triggers
    if (targetType === 'post') {
      const posts = getMockData<Post[]>('yak_posts', []);
      const pIdx = posts.findIndex(p => p.id === targetId);
      if (pIdx !== -1) {
        const postVotes = votes.filter(v => v.target_id === targetId && v.target_type === 'post');
        posts[pIdx].upvotes = postVotes.filter(v => v.vote_value === 1).length;
        posts[pIdx].downvotes = postVotes.filter(v => v.vote_value === -1).length;
        if (posts[pIdx].upvotes - posts[pIdx].downvotes <= -5) posts[pIdx].is_hidden = true;
        setMockData('yak_posts', posts);
      }
    } else {
      const comments = getMockData<Comment[]>('yak_comments', []);
      const cIdx = comments.findIndex(c => c.id === targetId);
      if (cIdx !== -1) {
        const commentVotes = votes.filter(v => v.target_id === targetId && v.target_type === 'comment');
        comments[cIdx].upvotes = commentVotes.filter(v => v.vote_value === 1).length;
        comments[cIdx].downvotes = commentVotes.filter(v => v.vote_value === -1).length;
        if (comments[cIdx].upvotes - comments[cIdx].downvotes <= -5) comments[cIdx].is_hidden = true;
        setMockData('yak_comments', comments);
      }
    }
    return;
  }

  // Server API
  const res = await fetch('/api/votes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetType, targetId, value })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to submit vote');
  }
}

// 5. Fetch Comments
export async function getComments(postId: string): Promise<Comment[]> {
  if (isMockMode) {
    const comments = getMockData<Comment[]>('yak_comments', []);
    const currentSessionId = typeof window !== 'undefined' ? localStorage.getItem('yak_session_id') || '' : '';
    return comments
      .filter(c => c.post_id === postId && !c.is_hidden)
      .map(c => ({ ...c, is_author: c.session_id === currentSessionId }))
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }

  const res = await fetch(`/api/comments?postId=${postId}`);
  if (!res.ok) throw new Error('Failed to load comments');
  const data = await res.json();
  return data.comments || [];
}

// 6. Create Comment
export async function createComment(
  postId: string,
  parentCommentId: string | null,
  content: string,
  sessionId: string
): Promise<Comment> {
  if (isMockMode) {
    const comments = getMockData<Comment[]>('yak_comments', []);

    // Rate Limiting checks
    const lastComment = [...comments]
      .filter(c => c.session_id === sessionId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

    if (lastComment) {
      const elapsed = (Date.now() - new Date(lastComment.created_at).getTime()) / 1000;
      if (elapsed < 20) {
        const remaining = Math.ceil(20 - elapsed);
        throw new Error(`Rate limit exceeded: You can only comment once every 20 seconds. Please wait ${remaining} seconds.`);
      }
    }

    const newComment: Comment = {
      id: Math.random().toString(36).substr(2, 9),
      post_id: postId,
      parent_comment_id: parentCommentId,
      content,
      session_id: sessionId,
      created_at: new Date().toISOString(),
      upvotes: 0,
      downvotes: 0,
      is_hidden: false,
      report_count: 0
    };

    comments.push(newComment);
    setMockData('yak_comments', comments);
    return { ...newComment, is_author: true };
  }

  // Server API
  const res = await fetch('/api/comments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ postId, parentCommentId, content })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to create comment');
  }
  const data = await res.json();
  return data.comment;
}

// 7. Report content
export async function report(
  targetType: 'post' | 'comment',
  targetId: string,
  reason: string,
  sessionId: string
): Promise<void> {
  if (isMockMode) {
    const reports = getMockData<Report[]>('yak_reports', []);
    
    // Rate limit check (2 per minute)
    const recentReports = reports.filter(r => r.session_id === sessionId && (Date.now() - new Date(r.created_at).getTime()) < 60000);
    if (recentReports.length >= 2) {
      throw new Error('Rate limit exceeded: You can only file 2 reports per minute.');
    }

    const existing = reports.some(r => r.session_id === sessionId && r.target_id === targetId);
    if (existing) throw new Error('You have already reported this item.');

    reports.push({
      id: Math.random().toString(36).substr(2, 9),
      session_id: sessionId,
      target_type: targetType,
      target_id: targetId,
      reason,
      created_at: new Date().toISOString()
    });
    setMockData('yak_reports', reports);

    // Apply counters
    if (targetType === 'post') {
      const posts = getMockData<Post[]>('yak_posts', []);
      const pIdx = posts.findIndex(p => p.id === targetId);
      if (pIdx !== -1) {
        posts[pIdx].report_count += 1;
        if (posts[pIdx].report_count >= 3) posts[pIdx].is_hidden = true;
        setMockData('yak_posts', posts);
      }
    } else {
      const comments = getMockData<Comment[]>('yak_comments', []);
      const cIdx = comments.findIndex(c => c.id === targetId);
      if (cIdx !== -1) {
        comments[cIdx].report_count += 1;
        if (comments[cIdx].report_count >= 3) comments[cIdx].is_hidden = true;
        setMockData('yak_comments', comments);
      }
    }
    return;
  }

  // Server API
  const res = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetType, targetId, reason })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to submit report');
  }
}

// 8. Fetch User Active Votes
export async function getUserVotes(sessionId: string): Promise<Record<string, 1 | -1>> {
  if (isMockMode) {
    const votes = getMockData<Vote[]>('yak_votes', []);
    const userVotes = votes.filter(v => v.session_id === sessionId);
    const voteMap: Record<string, 1 | -1> = {};
    userVotes.forEach(v => {
      voteMap[v.target_id] = v.vote_value;
    });
    return voteMap;
  }

  const res = await fetch('/api/votes');
  if (!res.ok) return {};
  const data = await res.json();
  return data.votes || {};
}

// 9. Fetch User Karma
export async function getUserKarma(sessionId: string): Promise<number> {
  if (isMockMode) {
    const posts = getMockData<Post[]>('yak_posts', []);
    const comments = getMockData<Comment[]>('yak_comments', []);
    
    // Sum active posts score
    const postKarma = posts
      .filter(p => p.session_id === sessionId && !p.is_hidden)
      .reduce((acc, p) => acc + (p.upvotes - p.downvotes), 0);

    // Sum active comments score
    const commentKarma = comments
      .filter(c => c.session_id === sessionId && !c.is_hidden)
      .reduce((acc, c) => acc + (c.upvotes - c.downvotes), 0);

    return postKarma + commentKarma;
  }

  const res = await fetch('/api/karma');
  if (!res.ok) return 0;
  const data = await res.json();
  return data.karma || 0;
}

// 10. Fetch DM threads
export async function getDMThreads(sessionId: string): Promise<DMThread[]> {
  if (isMockMode) {
    const threads = getMockData<DMThread[]>('yak_dm_threads', []);
    const matched = threads.filter(t => t.creator_session_id === sessionId || t.receiver_session_id === sessionId);
    
    return matched.map(t => {
      const otherSessionId = t.creator_session_id === sessionId 
        ? t.receiver_session_id! 
        : t.creator_session_id!;
        
      const otherIdentity = getAnonymousIdentity(otherSessionId, t.post_id);
      
      const { creator_session_id, receiver_session_id, ...rest } = t;
      return {
        ...rest,
        other_user_name: otherIdentity.fullName,
        other_user_color: otherIdentity.textClass,
        other_user_bg: otherIdentity.bgClass,
        other_user_border: otherIdentity.borderClass
      };
    });
  }

  const res = await fetch('/api/dms');
  if (!res.ok) return [];
  const data = await res.json();
  return data.threads || [];
}

// 11. Fetch messages for thread
export async function getDMMessages(threadId: string, sessionId: string): Promise<DMMessage[]> {
  if (isMockMode) {
    const messages = getMockData<DMMessage[]>('yak_dm_messages', []);
    const threads = getMockData<DMThread[]>('yak_dm_threads', []);
    
    // Confirm participation
    const thread = threads.find(t => t.id === threadId);
    if (!thread || (thread.creator_session_id !== sessionId && thread.receiver_session_id !== sessionId)) {
      throw new Error('Unauthorized');
    }

    return messages
      .filter(m => m.thread_id === threadId)
      .map(m => {
        const { sender_session_id, ...rest } = m;
        return {
          ...rest,
          is_me: sender_session_id === sessionId
        };
      });
  }

  const res = await fetch(`/api/dms?threadId=${threadId}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages || [];
}

// 12. Create DM thread
export async function createDMThread(postId: string, sessionId: string): Promise<DMThread> {
  if (isMockMode) {
    const threads = getMockData<DMThread[]>('yak_dm_threads', []);
    const posts = getMockData<Post[]>('yak_posts', []);
    
    const post = posts.find(p => p.id === postId);
    if (!post) throw new Error('Post not found');
    if (post.session_id === sessionId) throw new Error('You cannot message yourself');

    const existing = threads.find(t => 
      t.post_id === postId && 
      ((t.creator_session_id === sessionId && t.receiver_session_id === post.session_id) ||
       (t.creator_session_id === post.session_id && t.receiver_session_id === sessionId))
    );

    if (existing) return existing;

    const newThread: DMThread = {
      id: Math.random().toString(36).substr(2, 9),
      post_id: postId,
      creator_session_id: sessionId,
      receiver_session_id: post.session_id,
      is_blocked: false,
      blocked_by: null,
      created_at: new Date().toISOString()
    };

    threads.push(newThread);
    setMockData('yak_dm_threads', threads);
    return newThread;
  }

  const res = await fetch('/api/dms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create_thread', postId })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to initialize DM thread');
  }
  const data = await res.json();
  return data.thread;
}

// 13. Send DM message
export async function sendDMMessage(threadId: string, content: string, sessionId: string): Promise<DMMessage> {
  if (isMockMode) {
    const messages = getMockData<DMMessage[]>('yak_dm_messages', []);
    
    // Rate limit locally (1 per 2 seconds)
    const recentMsgs = [...messages]
      .filter(m => m.sender_session_id === sessionId)
      .sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      
    if (recentMsgs) {
      const elapsed = (Date.now() - new Date(recentMsgs.created_at).getTime()) / 1000;
      if (elapsed < 2) throw new Error('Rate limit exceeded: Please wait 2 seconds between messages.');
    }

    const newMsg: DMMessage = {
      id: Math.random().toString(36).substr(2, 9),
      thread_id: threadId,
      sender_session_id: sessionId,
      content,
      is_reported: false,
      created_at: new Date().toISOString()
    };

    messages.push(newMsg);
    setMockData('yak_dm_messages', messages);
    return { ...newMsg, is_me: true };
  }

  const res = await fetch('/api/dms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'send_message', threadId, content })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to send message');
  }
  const data = await res.json();
  return data.message;
}

// 14. Block DM thread
export async function blockDMThread(threadId: string, sessionId: string): Promise<void> {
  if (isMockMode) {
    const threads = getMockData<DMThread[]>('yak_dm_threads', []);
    const tIdx = threads.findIndex(t => t.id === threadId);
    
    if (tIdx !== -1) {
      threads[tIdx].is_blocked = true;
      threads[tIdx].blocked_by = sessionId;
      setMockData('yak_dm_threads', threads);
    }
    return;
  }

  const res = await fetch('/api/dms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'block_thread', threadId })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to block conversation');
  }
}

// 15. Report DM message
export async function reportDMMessage(messageId: string, reason: string, sessionId: string): Promise<void> {
  if (isMockMode) {
    const messages = getMockData<DMMessage[]>('yak_dm_messages', []);
    const mIdx = messages.findIndex(m => m.id === messageId);
    
    if (mIdx !== -1) {
      messages[mIdx].is_reported = true;
      messages[mIdx].report_reason = reason;
      setMockData('yak_dm_messages', messages);
    }
    return;
  }

  const res = await fetch('/api/dms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'report_message', messageId, reason })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Failed to report message');
  }
}

// 16. Realtime subscription (Same as v1)
export function subscribeToUpdates(callback: () => void): () => void {
  if (isMockMode) {
    if (typeof window !== 'undefined') {
      window.addEventListener('yak-db-update', callback);
      return () => window.removeEventListener('yak-db-update', callback);
    }
    return () => {};
  }

  const channel = supabase!
    .channel('schema-db-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'votes' }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, callback)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'dm_messages' }, callback)
    .subscribe();

  return () => {
    supabase!.removeChannel(channel);
  };
}

// ----------------------------------------------------
// Admin Actions (GET/POST Secure Passphrase Routing)
// ----------------------------------------------------
export async function getReportedItems(passphrase: string): Promise<ReportedItem[]> {
  if (isMockMode) {
    if (passphrase !== 'college-admin-2026') {
      throw new Error('Unauthorized');
    }
    const posts = getMockData<Post[]>('yak_posts', []);
    const comments = getMockData<Comment[]>('yak_comments', []);
    const reports = getMockData<Report[]>('yak_reports', []);

    const reportedItems: ReportedItem[] = [];

    posts.forEach(p => {
      if (p.report_count > 0 || p.is_hidden) {
        const itemReports = reports.filter(r => r.target_id === p.id && r.target_type === 'post');
        reportedItems.push({
          id: p.id,
          target_type: 'post',
          content: p.content,
          report_count: p.report_count,
          is_hidden: p.is_hidden,
          reasons: itemReports.map(r => r.reason),
          session_id: p.session_id,
          created_at: p.created_at
        });
      }
    });

    comments.forEach(c => {
      if (c.report_count > 0 || c.is_hidden) {
        const itemReports = reports.filter(r => r.target_id === c.id && r.target_type === 'comment');
        reportedItems.push({
          id: c.id,
          target_type: 'comment',
          content: c.content,
          report_count: c.report_count,
          is_hidden: c.is_hidden,
          reasons: itemReports.map(r => r.reason),
          session_id: c.session_id,
          created_at: c.created_at
        });
      }
    });

    return reportedItems.sort((a, b) => b.report_count - a.report_count);
  }

  // Server API
  const res = await fetch(`/api/admin/action?passphrase=${encodeURIComponent(passphrase)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Unauthorized');
  }
  const data = await res.json();
  return data.reports || [];
}

// Fetch reported DMs (exclusive to admin routing)
export async function getReportedDMs(passphrase: string): Promise<ReportedDM[]> {
  if (isMockMode) {
    if (passphrase !== 'college-admin-2026') {
      throw new Error('Unauthorized');
    }
    const messages = getMockData<DMMessage[]>('yak_dm_messages', []);
    const threads = getMockData<DMThread[]>('yak_dm_threads', []);
    
    const reportedList: ReportedDM[] = [];
    
    messages.forEach(m => {
      if (m.is_reported) {
        const thread = threads.find(t => t.id === m.thread_id);
        const history = messages
          .filter(hist => hist.thread_id === m.thread_id)
          .sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          .slice(-5)
          .map(h => ({
            content: h.content,
            sender_session_id: h.sender_session_id || 'mock',
            created_at: h.created_at
          }));

        reportedList.push({
          id: m.id,
          thread_id: m.thread_id,
          content: m.content,
          report_reason: m.report_reason || 'Flagged',
          reported_at: m.created_at, // mock fallback
          sender_session_id: m.sender_session_id || 'mock',
          post_id: thread?.post_id || null,
          history
        });
      }
    });
    
    return reportedList;
  }

  // Server API
  const res = await fetch(`/api/admin/action?passphrase=${encodeURIComponent(passphrase)}`);
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Unauthorized');
  }
  const data = await res.json();
  return data.reportedDMs || [];
}

export async function moderateContent(
  action: 'restore' | 'delete',
  targetType: 'post' | 'comment' | 'dm_message' | 'dm_thread',
  targetId: string,
  passphrase: string
): Promise<void> {
  if (isMockMode) {
    if (action === 'restore') {
      if (targetType === 'post' || targetType === 'comment') {
        const table = targetType === 'post' ? 'yak_posts' : 'yak_comments';
        const items = getMockData<any[]>(table, []);
        const idx = items.findIndex(i => i.id === targetId);
        if (idx !== -1) {
          items[idx].is_hidden = false;
          items[idx].report_count = 0;
          setMockData(table, items);
        }
        
        // Remove reports
        const reports = getMockData<Report[]>('yak_reports', []);
        setMockData('yak_reports', reports.filter(r => r.target_id !== targetId));
      } else if (targetType === 'dm_message') {
        const messages = getMockData<DMMessage[]>('yak_dm_messages', []);
        const idx = messages.findIndex(m => m.id === targetId);
        if (idx !== -1) {
          messages[idx].is_reported = false;
          messages[idx].report_reason = null;
          setMockData('yak_dm_messages', messages);
        }
      }
    } else {
      // action === 'delete'
      if (targetType === 'post' || targetType === 'comment') {
        const table = targetType === 'post' ? 'yak_posts' : 'yak_comments';
        const items = getMockData<any[]>(table, []);
        setMockData(table, items.filter(i => i.id !== targetId));
        
        if (targetType === 'post') {
          // cascade delete comments
          const comments = getMockData<Comment[]>('yak_comments', []);
          setMockData('yak_comments', comments.filter(c => c.post_id !== targetId));
          
          // cascade delete threads
          const threads = getMockData<DMThread[]>('yak_dm_threads', []);
          setMockData('yak_dm_threads', threads.filter(t => t.post_id !== targetId));
        }
      } else if (targetType === 'dm_message') {
        const messages = getMockData<DMMessage[]>('yak_dm_messages', []);
        setMockData('yak_dm_messages', messages.filter(m => m.id !== targetId));
      } else if (targetType === 'dm_thread') {
        const threads = getMockData<DMThread[]>('yak_dm_threads', []);
        setMockData('yak_dm_threads', threads.filter(t => t.id !== targetId));
        
        const messages = getMockData<DMMessage[]>('yak_dm_messages', []);
        setMockData('yak_dm_messages', messages.filter(m => m.thread_id !== targetId));
      }
    }
    return;
  }

  // Server API
  const res = await fetch('/api/admin/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase, action, targetType, targetId })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.message || 'Moderation action failed');
  }
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url === 'your_supabase_url' || key === 'your_supabase_service_role_key') {
    return null;
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}
