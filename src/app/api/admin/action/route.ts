import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// Helper to get client IP address
function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  
  return '127.0.0.1'; // local fallback
}

// GET: Fetch reported items and reported DMs
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const passphrase = url.searchParams.get('passphrase');
  
  const adminPassphrase = process.env.ADMIN_PASSPHRASE || 'college-admin-2026';
  if (passphrase !== adminPassphrase) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const adminClient = createAdminClient();
  if (!adminClient) {
    return NextResponse.json({ message: 'Supabase admin client not configured' }, { status: 500 });
  }

  try {
    // 1. Fetch reported/hidden posts and comments
    const [postsRes, commentsRes, reportsRes, reportedDMsRes] = await Promise.all([
      adminClient.from('posts').select('*').or('report_count.gt.0,is_hidden.eq.true'),
      adminClient.from('comments').select('*').or('report_count.gt.0,is_hidden.eq.true'),
      adminClient.from('reports').select('*'),
      adminClient.from('dm_messages').select('*').eq('is_reported', true)
    ]);

    if (postsRes.error) throw postsRes.error;
    if (commentsRes.error) throw commentsRes.error;
    if (reportsRes.error) throw reportsRes.error;
    if (reportedDMsRes.error) throw reportedDMsRes.error;

    // Map posts - Return actual session_id for admin tracking!
    const reportedItems = (postsRes.data || []).map((p: any) => {
      const itemReports = (reportsRes.data || []).filter(
        (r: any) => r.target_id === p.id && r.target_type === 'post'
      );
      return {
        id: p.id,
        target_type: 'post',
        content: p.content,
        report_count: p.report_count,
        is_hidden: p.is_hidden,
        reasons: itemReports.map((r: any) => r.reason),
        session_id: p.session_id,
        created_at: p.created_at
      };
    });

    // Map comments - Return actual session_id!
    (commentsRes.data || []).forEach((c: any) => {
      const itemReports = (reportsRes.data || []).filter(
        (r: any) => r.target_id === c.id && r.target_type === 'comment'
      );
      reportedItems.push({
        id: c.id,
        target_type: 'comment',
        content: c.content,
        report_count: c.report_count,
        is_hidden: c.is_hidden,
        reasons: itemReports.map((r: any) => r.reason),
        session_id: c.session_id,
        created_at: c.created_at
      });
    });

    reportedItems.sort((a, b) => b.report_count - a.report_count);

    // 2. Fetch context history (last 5 messages) for reported DMs
    const reportedDMs = [];
    const dmList = reportedDMsRes.data || [];
    
    for (const msg of dmList) {
      // Get thread
      const { data: thread } = await adminClient
        .from('dm_threads')
        .select('*')
        .eq('id', msg.thread_id)
        .single();
      
      // Get history
      const { data: history } = await adminClient
        .from('dm_messages')
        .select('content, sender_session_id, created_at')
        .eq('thread_id', msg.thread_id)
        .order('created_at', { ascending: false })
        .limit(5);

      reportedDMs.push({
        id: msg.id,
        thread_id: msg.thread_id,
        content: msg.content,
        report_reason: msg.report_reason,
        reported_at: msg.reported_at,
        sender_session_id: msg.sender_session_id,
        post_id: thread?.post_id || null,
        history: (history || []).reverse()
      });
    }

    return NextResponse.json({ reports: reportedItems, reportedDMs });
  } catch (err: any) {
    console.error('Admin fetch error:', err);
    return NextResponse.json({ message: 'Internal server error occurred' }, { status: 500 });
  }
}

// POST: Moderate content & Check brute force lockout
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const adminClient = createAdminClient();
  
  if (!adminClient) {
    return NextResponse.json({ message: 'Supabase admin client not configured' }, { status: 500 });
  }

  try {
    // 1. Brute-force Lockout Check
    const { data: lockoutCheck } = await adminClient
      .from('admin_attempts')
      .select('*')
      .eq('ip_address', ip)
      .single();

    if (lockoutCheck) {
      const elapsed = (Date.now() - new Date(lockoutCheck.last_attempt).getTime()) / 1000;
      if (lockoutCheck.attempts >= 5 && elapsed < 15 * 60) {
        const remainingMin = Math.ceil((15 * 60 - elapsed) / 60);
        return NextResponse.json(
          { message: `Too many failed attempts. Access locked. Please wait ${remainingMin} minutes.` },
          { status: 429 }
        );
      }
    }

    // 2. Validate Passphrase
    const body = await req.json();
    const { passphrase, action, targetType, targetId } = body;

    const adminPassphrase = process.env.ADMIN_PASSPHRASE || 'college-admin-2026';
    if (passphrase !== adminPassphrase) {
      // Record failed attempt
      const currentAttempts = lockoutCheck ? lockoutCheck.attempts + 1 : 1;
      await adminClient
        .from('admin_attempts')
        .upsert({ ip_address: ip, attempts: currentAttempts, last_attempt: new Date().toISOString() });

      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Reset attempts on successful log on
    if (lockoutCheck && lockoutCheck.attempts > 0) {
      await adminClient
        .from('admin_attempts')
        .update({ attempts: 0 })
        .eq('ip_address', ip);
    }

    // 3. Perform Moderation Action
    if (action === 'restore') {
      if (targetType === 'post' || targetType === 'comment') {
        const table = targetType === 'post' ? 'posts' : 'comments';
        
        // Reset hidden and report counts
        await adminClient.from(table).update({ is_hidden: false, report_count: 0 }).eq('id', targetId);
        
        // Clear public reports
        await adminClient.from('reports').delete().eq('target_id', targetId);
        
        return NextResponse.json({ success: true, message: 'Item successfully restored' });
      } else if (targetType === 'dm_message') {
        // Reset DM message report flag
        await adminClient
          .from('dm_messages')
          .update({ is_reported: false, report_reason: null, reported_at: null, report_session_id: null })
          .eq('id', targetId);

        return NextResponse.json({ success: true, message: 'DM message restored' });
      }

    } else if (action === 'delete') {
      if (targetType === 'post' || targetType === 'comment') {
        const table = targetType === 'post' ? 'posts' : 'comments';
        await adminClient.from(table).delete().eq('id', targetId);
        return NextResponse.json({ success: true, message: 'Content permanently deleted' });
      } else if (targetType === 'dm_message') {
        // Delete message
        await adminClient.from('dm_messages').delete().eq('id', targetId);
        return NextResponse.json({ success: true, message: 'DM message permanently deleted' });
      } else if (targetType === 'dm_thread') {
        // Delete thread (cascades)
        await adminClient.from('dm_threads').delete().eq('id', targetId);
        return NextResponse.json({ success: true, message: 'DM conversation permanently deleted' });
      }
    }

    return NextResponse.json({ message: 'Invalid action or target type' }, { status: 400 });

  } catch (err: any) {
    console.error('Moderation action error:', err);
    return NextResponse.json({ message: 'Internal server error occurred' }, { status: 500 });
  }
}
