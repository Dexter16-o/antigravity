import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: Fetch active user votes
export async function GET(req: NextRequest) {
  const verifiedSessionId = req.headers.get('x-session-id');
  if (!verifiedSessionId) {
    return NextResponse.json({ message: 'Session required' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase!.rpc('secure_get_user_votes', {
      sess_id: verifiedSessionId
    });

    if (error) throw error;

    const voteMap: Record<string, 1 | -1> = {};
    (data || []).forEach((v: any) => {
      voteMap[v.target_id] = v.vote_value as 1 | -1;
    });

    return NextResponse.json({ votes: voteMap });
  } catch (err: any) {
    console.error('Fetch user votes error:', err);
    return NextResponse.json({ message: 'Internal server error occurred' }, { status: 500 });
  }
}

// POST: Submit a vote securely
export async function POST(req: NextRequest) {
  const verifiedSessionId = req.headers.get('x-session-id');
  if (!verifiedSessionId) {
    return NextResponse.json({ message: 'Session required' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { targetType, targetId, value } = body;

    // Validation
    if (!targetType || !['post', 'comment'].includes(targetType)) {
      return NextResponse.json({ message: 'Invalid target type' }, { status: 400 });
    }
    if (!targetId) {
      return NextResponse.json({ message: 'Target ID is required' }, { status: 400 });
    }
    if (value !== 1 && value !== -1) {
      return NextResponse.json({ message: 'Invalid vote value' }, { status: 400 });
    }

    // Call secure PL/pgSQL transaction-wrapped RPC to perform upsert, set session variable, and check rate limit trigger
    const { data, error } = await supabase!.rpc('secure_submit_vote', {
      sess_id: verifiedSessionId,
      v_target_type: targetType,
      v_target_id: targetId,
      v_value: value
    });

    if (error) {
      if (error.message.includes('Rate limit exceeded')) {
        return NextResponse.json({ message: error.message }, { status: 429 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });

  } catch (err: any) {
    console.error('Submit vote error:', err);
    return NextResponse.json({ message: 'Internal server error occurred' }, { status: 500 });
  }
}
