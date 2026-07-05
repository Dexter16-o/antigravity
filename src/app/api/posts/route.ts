import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET: Fetch feed posts (stripped of session IDs, enriched with is_author)
export async function GET(req: NextRequest) {
  const verifiedSessionId = req.headers.get('x-session-id');
  if (!verifiedSessionId) {
    return NextResponse.json({ message: 'Session required' }, { status: 401 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const sortBy = url.searchParams.get('sortBy') || 'new';
  const category = url.searchParams.get('category');

  try {
    if (id) {
      // Fetch single post
      const { data: post, error } = await supabase!
        .from('posts')
        .select('id, content, image_url, session_id, category, created_at, upvotes, downvotes, report_count')
        .eq('id', id)
        .eq('is_hidden', false)
        .single();
      
      if (error) {
        return NextResponse.json({ message: 'Post not found or hidden' }, { status: 404 });
      }

      const { session_id, ...rest } = post;
      return NextResponse.json({
        post: {
          ...rest,
          is_author: session_id === verifiedSessionId
        }
      });
    }

    // 1. Fetch non-hidden posts from Supabase (runs parameterized)
    let query = supabase!
      .from('posts')
      .select('id, content, image_url, session_id, category, created_at, upvotes, downvotes, report_count')
      .eq('is_hidden', false);

    if (category && category !== 'All') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;

    // 2. Map data to hide session_id and expose is_author boolean
    const cleanedPosts = (data || []).map((post: any) => {
      const { session_id, ...rest } = post;
      return {
        ...rest,
        is_author: session_id === verifiedSessionId
      };
    });

    // 3. Sort logic
    if (sortBy === 'new') {
      cleanedPosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    } else {
      // Hot ranking: score = (upvotes - downvotes) - (hours elapsed / 2)
      cleanedPosts.sort((a, b) => {
        const scoreA = (a.upvotes - a.downvotes) - (Date.now() - new Date(a.created_at).getTime()) / (3600000 * 2);
        const scoreB = (b.upvotes - b.downvotes) - (Date.now() - new Date(b.created_at).getTime()) / (3600000 * 2);
        return scoreB - scoreA;
      });
    }

    return NextResponse.json({ posts: cleanedPosts });
  } catch (err: any) {
    console.error('Fetch posts error:', err);
    return NextResponse.json({ message: 'Internal server error occurred' }, { status: 500 });
  }
}

// POST: Create anonymous post via transaction RPC
export async function POST(req: NextRequest) {
  const verifiedSessionId = req.headers.get('x-session-id');
  if (!verifiedSessionId) {
    return NextResponse.json({ message: 'Session required' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { content, imageUrl, category = 'General' } = body;

    // Server-side Input Validation
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ message: 'Post content is required' }, { status: 400 });
    }
    if (content.trim().length > 300) {
      return NextResponse.json({ message: 'Content exceeds 300 characters limit' }, { status: 400 });
    }

    const allowedCategories = ['General', 'Placements', 'Hostel/Mess', 'Academics', 'Lost & Found', 'Marketplace', 'Faculty Reviews'];
    if (!allowedCategories.includes(category)) {
      return NextResponse.json({ message: 'Invalid category selection' }, { status: 400 });
    }

    // Call plpgsql transaction-wrapping RPC function to enforce database-level RLS & triggers
    const { data, error } = await supabase!.rpc('secure_create_post', {
      sess_id: verifiedSessionId,
      post_content: content.trim(),
      post_image_url: imageUrl || null,
      post_category: category
    });

    if (error) {
      // Catch trigger exceptions (like rate-limiting)
      if (error.message.includes('Rate limit exceeded')) {
        return NextResponse.json({ message: error.message }, { status: 429 });
      }
      throw error;
    }

    // Clean response object of internal session ID
    const { session_id, ...cleanedPost } = data;
    return NextResponse.json({ post: { ...cleanedPost, is_author: true } });

  } catch (err: any) {
    console.error('Create post error:', err);
    return NextResponse.json({ message: 'Internal server error occurred' }, { status: 500 });
  }
}
