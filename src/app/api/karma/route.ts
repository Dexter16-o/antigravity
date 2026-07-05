import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: Fetch user's current karma points securely
export async function GET(req: NextRequest) {
  const verifiedSessionId = req.headers.get('x-session-id');
  if (!verifiedSessionId) {
    return NextResponse.json({ message: 'Session required' }, { status: 401 });
  }

  try {
    const { data, error } = await supabase!.rpc('secure_get_user_karma', {
      sess_id: verifiedSessionId
    });

    if (error) throw error;

    return NextResponse.json({ karma: data || 0 });
  } catch (err: any) {
    console.error('Fetch karma error:', err);
    return NextResponse.json({ message: 'Internal server error occurred' }, { status: 500 });
  }
}
