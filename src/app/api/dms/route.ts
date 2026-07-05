import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getAnonymousIdentity } from '@/lib/identity';

// GET: Retrieve user's active DM threads or messages in a thread
export async function GET(req: NextRequest) {
  const verifiedSessionId = req.headers.get('x-session-id');
  if (!verifiedSessionId) {
    return NextResponse.json({ message: 'Session required' }, { status: 401 });
  }

  const url = new URL(req.url);
  const threadId = url.searchParams.get('threadId');

  try {
    if (threadId) {
      // 1. Fetch messages for a specific thread (enforced by RLS)
      const { data, error } = await supabase!.rpc('secure_get_dm_messages', {
        sess_id: verifiedSessionId,
        dm_thread_id: threadId
      });

      if (error) throw error;

      // 2. Clean messages of sender_session_id and return is_me boolean
      const cleanedMessages = (data || []).map((msg: any) => {
        const { sender_session_id, ...rest } = msg;
        return {
          ...rest,
          is_me: sender_session_id === verifiedSessionId
        };
      });

      return NextResponse.json({ messages: cleanedMessages });
    } else {
      // Fetch list of active threads for the user (enforced by RLS)
      const { data, error } = await supabase!.rpc('secure_get_dm_threads', {
        sess_id: verifiedSessionId
      });

      if (error) throw error;

      // Clean creator/receiver session IDs and resolve other user's anonymous identity
      const cleanedThreads = (data || []).map((thread: any) => {
        const { creator_session_id, receiver_session_id, ...rest } = thread;
        
        // Find other participant session
        const otherSessionId = creator_session_id === verifiedSessionId 
          ? receiver_session_id 
          : creator_session_id;

        // Resolve other user's identity based on this post context
        const otherIdentity = getAnonymousIdentity(otherSessionId, thread.post_id);

        return {
          ...rest,
          other_user_name: otherIdentity.fullName,
          other_user_color: otherIdentity.textClass,
          other_user_bg: otherIdentity.bgClass,
          other_user_border: otherIdentity.borderClass
        };
      });

      return NextResponse.json({ threads: cleanedThreads });
    }
  } catch (err: any) {
    console.error('Fetch DMs error:', err);
    return NextResponse.json({ message: 'Internal server error occurred' }, { status: 500 });
  }
}

// POST: Execute secure thread and message operations
export async function POST(req: NextRequest) {
  const verifiedSessionId = req.headers.get('x-session-id');
  if (!verifiedSessionId) {
    return NextResponse.json({ message: 'Session required' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, postId, threadId, messageId, content, reason } = body;

    if (action === 'create_thread') {
      if (!postId) {
        return NextResponse.json({ message: 'Post ID is required' }, { status: 400 });
      }

      const { data, error } = await supabase!.rpc('secure_create_dm_thread', {
        sess_id: verifiedSessionId,
        dm_post_id: postId
      });

      if (error) {
        if (error.message.includes('You cannot message yourself') || error.message.includes('Post not found')) {
          return NextResponse.json({ message: error.message }, { status: 400 });
        }
        throw error;
      }

      // Hide session IDs in response
      const { creator_session_id, receiver_session_id, ...cleanedThread } = data;
      return NextResponse.json({ thread: cleanedThread });

    } else if (action === 'send_message') {
      if (!threadId) {
        return NextResponse.json({ message: 'Thread ID is required' }, { status: 400 });
      }
      if (!content || typeof content !== 'string') {
        return NextResponse.json({ message: 'Message content is required' }, { status: 400 });
      }
      if (content.trim().length > 1000) {
        return NextResponse.json({ message: 'Message exceeds 1000 characters' }, { status: 400 });
      }

      const { data, error } = await supabase!.rpc('secure_send_dm_message', {
        sess_id: verifiedSessionId,
        dm_thread_id: threadId,
        dm_content: content.trim()
      });

      if (error) {
        if (error.message.includes('Rate limit exceeded')) {
          return NextResponse.json({ message: error.message }, { status: 429 });
        }
        throw error;
      }

      const { sender_session_id, ...cleanedMsg } = data;
      return NextResponse.json({ message: { ...cleanedMsg, is_me: true } });

    } else if (action === 'block_thread') {
      if (!threadId) {
        return NextResponse.json({ message: 'Thread ID is required' }, { status: 400 });
      }

      const { data, error } = await supabase!.rpc('secure_block_dm_thread', {
        sess_id: verifiedSessionId,
        dm_thread_id: threadId
      });

      if (error) {
        if (error.message.includes('Thread not found')) {
          return NextResponse.json({ message: error.message }, { status: 404 });
        }
        throw error;
      }

      return NextResponse.json({ success: true, thread: data });

    } else if (action === 'report_message') {
      if (!messageId) {
        return NextResponse.json({ message: 'Message ID is required' }, { status: 400 });
      }
      if (!reason || typeof reason !== 'string') {
        return NextResponse.json({ message: 'Report reason is required' }, { status: 400 });
      }
      if (reason.trim().length > 100) {
        return NextResponse.json({ message: 'Reason exceeds 100 characters limit' }, { status: 400 });
      }

      const { data, error } = await supabase!.rpc('secure_report_dm_message', {
        sess_id: verifiedSessionId,
        dm_msg_id: messageId,
        dm_reason: reason.trim()
      });

      if (error) {
        if (error.message.includes('Message not found')) {
          return NextResponse.json({ message: error.message }, { status: 404 });
        }
        throw error;
      }

      return NextResponse.json({ success: true });

    } else {
      return NextResponse.json({ message: 'Invalid action' }, { status: 400 });
    }

  } catch (err: any) {
    console.error('DMs action error:', err);
    return NextResponse.json({ message: 'Internal server error occurred' }, { status: 500 });
  }
}
