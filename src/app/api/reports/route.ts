import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// POST: Submit a report securely
export async function POST(req: NextRequest) {
  const verifiedSessionId = req.headers.get('x-session-id');
  if (!verifiedSessionId) {
    return NextResponse.json({ message: 'Session required' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { targetType, targetId, reason } = body;

    // Validation
    if (!targetType || !['post', 'comment'].includes(targetType)) {
      return NextResponse.json({ message: 'Invalid target type' }, { status: 400 });
    }
    if (!targetId) {
      return NextResponse.json({ message: 'Target ID is required' }, { status: 400 });
    }
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      return NextResponse.json({ message: 'Report reason is required' }, { status: 400 });
    }
    if (reason.trim().length > 100) {
      return NextResponse.json({ message: 'Reason exceeds 100 characters' }, { status: 400 });
    }

    // Call secure PL/pgSQL transaction-wrapped RPC
    const { data, error } = await supabase!.rpc('secure_submit_report', {
      sess_id: verifiedSessionId,
      r_target_type: targetType,
      r_target_id: targetId,
      r_reason: reason.trim()
    });

    if (error) {
      // 23505 is the PostgreSQL code for unique violation (user already reported this target)
      if (error.code === '23505') {
        return NextResponse.json({ message: 'You have already reported this item.' }, { status: 400 });
      }
      if (error.message.includes('Rate limit exceeded')) {
        return NextResponse.json({ message: error.message }, { status: 429 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });

  } catch (err: any) {
    console.error('Submit report error:', err);
    return NextResponse.json({ message: 'Internal server error occurred' }, { status: 500 });
  }
}
