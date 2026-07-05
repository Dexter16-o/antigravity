import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: Fetch comments (stripped of session IDs, enriched with is_author)
export async function GET(req: NextRequest) {
  const verifiedSessionId = req.headers.get('x-session-id');
  if (!verifiedSessionId) {
    return NextResponse.json({ message: 'Session required' }, { status: 401 });
  }

  const url = new URL(req.url);
  const postId = url.searchParams.get('postId');

  if (!postId) {
    return NextResponse.json({ message: 'postId is required' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase!
      .from('comments')
      .select('id, post_id, parent_comment_id, content, session_id, created_at, upvotes, downvotes, report_count')
      .eq('post_id', postId)
      .eq('is_hidden', false)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Clean session_id from results, add is_author flag
    const cleanedComments = (data || []).map((comment: any) => {
      const { session_id, ...rest } = comment;
      return {
        ...rest,
        is_author: session_id === verifiedSessionId
      };
    });

    return NextResponse.json({ comments: cleanedComments });
  } catch (err: any) {
    console.error('Fetch comments error:', err);
    return NextResponse.json({ message: 'Internal server error occurred' }, { status: 500 });
  }
}

// POST: Create anonymous comment via transaction RPC
export async function POST(req: NextRequest) {
  const verifiedSessionId = req.headers.get('x-session-id');
  if (!verifiedSessionId) {
    return NextResponse.json({ message: 'Session required' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { postId, parentCommentId, content } = body;

    // Input Validation
    if (!postId) {
      return NextResponse.json({ message: 'Post ID is required' }, { status: 400 });
    }
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ message: 'Comment content is required' }, { status: 400 });
    }
    if (content.trim().length > 1000) {
      return NextResponse.json({ message: 'Content exceeds 1000 characters limit' }, { status: 400 });
    }

    // Call secure PL/pgSQL transaction-wrapped RPC
    const { data, error } = await supabase!.rpc('secure_create_comment', {
      sess_id: verifiedSessionId,
      c_post_id: postId,
      c_parent_id: parentCommentId || null,
      c_content: content.trim()
    });

    if (error) {
      if (error.message.includes('Rate limit exceeded')) {
        return NextResponse.json({ message: error.message }, { status: 429 });
      }
      throw error;
    }

    const { session_id, ...cleanedComment } = data;
    return NextResponse.json({ comment: { ...cleanedComment, is_author: true } });

  } catch (err: any) {
    console.error('Create comment error:', err);
    return NextResponse.json({ message: 'Internal server error occurred' }, { status: 500 });
  }
}
