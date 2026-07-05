-- Enable uuid-ossp extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create Sessions table (for Yakarma)
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    karma_points INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create Posts table (with Category constraints)
CREATE TABLE IF NOT EXISTS posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL CHECK (char_length(content) <= 300),
    image_url TEXT,
    session_id TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('General', 'Placements', 'Hostel/Mess', 'Academics', 'Lost & Found', 'Marketplace', 'Faculty Reviews')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    upvotes INTEGER NOT NULL DEFAULT 0,
    downvotes INTEGER NOT NULL DEFAULT 0,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    report_count INTEGER NOT NULL DEFAULT 0
);

-- 3. Create Comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL CHECK (char_length(content) <= 1000),
    session_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    upvotes INTEGER NOT NULL DEFAULT 0,
    downvotes INTEGER NOT NULL DEFAULT 0,
    is_hidden BOOLEAN NOT NULL DEFAULT false,
    report_count INTEGER NOT NULL DEFAULT 0
);

-- 4. Create Votes table (Unique votes per session per item)
CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
    target_id UUID NOT NULL,
    vote_value INTEGER NOT NULL CHECK (vote_value IN (1, -1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, target_id)
);

-- 5. Create Reports table
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    target_type TEXT NOT NULL CHECK (target_type IN ('post', 'comment')),
    target_id UUID NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (session_id, target_id)
);

-- 6. Create DM Threads table
CREATE TABLE IF NOT EXISTS dm_threads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    creator_session_id TEXT NOT NULL,
    receiver_session_id TEXT NOT NULL,
    is_blocked BOOLEAN NOT NULL DEFAULT false,
    blocked_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (creator_session_id, receiver_session_id, post_id)
);

-- 7. Create DM Messages table
CREATE TABLE IF NOT EXISTS dm_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    thread_id UUID NOT NULL REFERENCES dm_threads(id) ON DELETE CASCADE,
    sender_session_id TEXT NOT NULL,
    content TEXT NOT NULL CHECK (char_length(content) <= 1000),
    is_reported BOOLEAN NOT NULL DEFAULT false,
    report_reason TEXT,
    reported_at TIMESTAMPTZ,
    report_session_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Create Admin Login Attempts table (Brute-force protection)
CREATE TABLE IF NOT EXISTS admin_attempts (
    ip_address TEXT PRIMARY KEY,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_attempt TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ----------------------------------------------------
-- TRIGGERS & FUNCTIONS
-- ----------------------------------------------------

-- Function: Recalculate User Karma (runs securely)
CREATE OR REPLACE FUNCTION recalculate_karma(user_session TEXT)
RETURNS VOID AS $$
DECLARE
    post_karma INTEGER;
    comment_karma INTEGER;
BEGIN
    SELECT COALESCE(SUM(upvotes - downvotes), 0) INTO post_karma 
    FROM posts WHERE session_id = user_session AND is_hidden = false;
    
    SELECT COALESCE(SUM(upvotes - downvotes), 0) INTO comment_karma 
    FROM comments WHERE session_id = user_session AND is_hidden = false;

    INSERT INTO sessions (session_id, karma_points)
    VALUES (user_session, post_karma + comment_karma)
    ON CONFLICT (session_id)
    DO UPDATE SET karma_points = post_karma + comment_karma;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function: Recalculate Post Votes and update Karma
CREATE OR REPLACE FUNCTION update_post_votes()
RETURNS TRIGGER AS $$
DECLARE
    post_id UUID;
    post_author TEXT;
BEGIN
    post_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.target_id ELSE NEW.target_id END;
    
    UPDATE posts
    SET 
        upvotes = (SELECT count(*) FROM votes WHERE target_id = post_id AND target_type = 'post' AND vote_value = 1),
        downvotes = (SELECT count(*) FROM votes WHERE target_id = post_id AND target_type = 'post' AND vote_value = -1)
    WHERE id = post_id;

    -- Update is_hidden based on score <= -5
    UPDATE posts
    SET is_hidden = CASE WHEN (upvotes - downvotes) <= -5 THEN true ELSE is_hidden END
    WHERE id = post_id;

    -- Recalculate OP Karma
    SELECT session_id INTO post_author FROM posts WHERE id = post_id;
    IF post_author IS NOT NULL THEN
        PERFORM recalculate_karma(post_author);
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_vote_change_post
AFTER INSERT OR UPDATE OR DELETE ON votes
FOR EACH ROW
WHEN (NEW.target_type = 'post' OR OLD.target_type = 'post')
EXECUTE FUNCTION update_post_votes();


-- Function: Recalculate Comment Votes and update Karma
CREATE OR REPLACE FUNCTION update_comment_votes()
RETURNS TRIGGER AS $$
DECLARE
    comment_id UUID;
    comment_author TEXT;
BEGIN
    comment_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.target_id ELSE NEW.target_id END;
    
    UPDATE comments
    SET 
        upvotes = (SELECT count(*) FROM votes WHERE target_id = comment_id AND target_type = 'comment' AND vote_value = 1),
        downvotes = (SELECT count(*) FROM votes WHERE target_id = comment_id AND target_type = 'comment' AND vote_value = -1)
    WHERE id = comment_id;

    -- Update is_hidden based on score <= -5
    UPDATE comments
    SET is_hidden = CASE WHEN (upvotes - downvotes) <= -5 THEN true ELSE is_hidden END
    WHERE id = comment_id;

    -- Recalculate commenter Karma
    SELECT session_id INTO comment_author FROM comments WHERE id = comment_id;
    IF comment_author IS NOT NULL THEN
        PERFORM recalculate_karma(comment_author);
    END IF;

    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_vote_change_comment
AFTER INSERT OR UPDATE OR DELETE ON votes
FOR EACH ROW
WHEN (NEW.target_type = 'comment' OR OLD.target_type = 'comment')
EXECUTE FUNCTION update_comment_votes();


-- Function: Recalculate reports count
CREATE OR REPLACE FUNCTION update_report_counts()
RETURNS TRIGGER AS $$
DECLARE
    t_id UUID;
    t_type TEXT;
BEGIN
    t_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.target_id ELSE NEW.target_id END;
    t_type := CASE WHEN TG_OP = 'DELETE' THEN OLD.target_type ELSE NEW.target_type END;

    IF t_type = 'post' THEN
        UPDATE posts
        SET 
            report_count = (SELECT count(*) FROM reports WHERE target_id = t_id AND target_type = 'post'),
            is_hidden = CASE WHEN (SELECT count(*) FROM reports WHERE target_id = t_id AND target_type = 'post') >= 3 THEN true ELSE is_hidden END
        WHERE id = t_id;
    ELSIF t_type = 'comment' THEN
        UPDATE comments
        SET 
            report_count = (SELECT count(*) FROM reports WHERE target_id = t_id AND target_type = 'comment'),
            is_hidden = CASE WHEN (SELECT count(*) FROM reports WHERE target_id = t_id AND target_type = 'comment') >= 3 THEN true ELSE is_hidden END
        WHERE id = t_id;
    END IF;
    
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_report_change
AFTER INSERT OR DELETE ON reports
FOR EACH ROW
EXECUTE FUNCTION update_report_counts();


-- ----------------------------------------------------
-- RATE LIMITING TRIGGERS
-- ----------------------------------------------------

-- Post Rate Limit (1 per 60s)
CREATE OR REPLACE FUNCTION rate_limit_posts()
RETURNS TRIGGER AS $$
DECLARE
    last_post_time TIMESTAMPTZ;
BEGIN
    SELECT created_at INTO last_post_time
    FROM posts
    WHERE session_id = NEW.session_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF last_post_time IS NOT NULL AND (now() - last_post_time) < INTERVAL '60 seconds' THEN
        RAISE EXCEPTION 'Rate limit exceeded: You can only post once every 60 seconds. Please wait % seconds.', 
            ceil(60 - EXTRACT(EPOCH FROM (now() - last_post_time)));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER before_post_insert
BEFORE INSERT ON posts
FOR EACH ROW
EXECUTE FUNCTION rate_limit_posts();


-- Comment Rate Limit (1 per 20s)
CREATE OR REPLACE FUNCTION rate_limit_comments()
RETURNS TRIGGER AS $$
DECLARE
    last_comment_time TIMESTAMPTZ;
BEGIN
    SELECT created_at INTO last_comment_time
    FROM comments
    WHERE session_id = NEW.session_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF last_comment_time IS NOT NULL AND (now() - last_comment_time) < INTERVAL '20 seconds' THEN
        RAISE EXCEPTION 'Rate limit exceeded: You can only comment once every 20 seconds. Please wait % seconds.', 
            ceil(20 - EXTRACT(EPOCH FROM (now() - last_comment_time)));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER before_comment_insert
BEFORE INSERT ON comments
FOR EACH ROW
EXECUTE FUNCTION rate_limit_comments();


-- Vote Rate Limit (5 per 10s)
CREATE OR REPLACE FUNCTION rate_limit_votes()
RETURNS TRIGGER AS $$
DECLARE
    recent_votes_count INTEGER;
BEGIN
    SELECT count(*) INTO recent_votes_count
    FROM votes
    WHERE session_id = NEW.session_id AND created_at > (now() - INTERVAL '10 seconds');

    IF recent_votes_count >= 5 THEN
        RAISE EXCEPTION 'Rate limit exceeded: You are voting too fast. Max 5 votes per 10 seconds.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER before_vote_insert
BEFORE INSERT ON votes
FOR EACH ROW
EXECUTE FUNCTION rate_limit_votes();


-- Report Rate Limit (2 per 60s)
CREATE OR REPLACE FUNCTION rate_limit_reports()
RETURNS TRIGGER AS $$
DECLARE
    recent_reports_count INTEGER;
BEGIN
    SELECT count(*) INTO recent_reports_count
    FROM reports
    WHERE session_id = NEW.session_id AND created_at > (now() - INTERVAL '60 seconds');

    IF recent_reports_count >= 2 THEN
        RAISE EXCEPTION 'Rate limit exceeded: You can only file 2 reports per minute.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER before_report_insert
BEFORE INSERT ON reports
FOR EACH ROW
EXECUTE FUNCTION rate_limit_reports();


-- DM Message Rate Limit (1 per 2s)
CREATE OR REPLACE FUNCTION rate_limit_dm_messages()
RETURNS TRIGGER AS $$
DECLARE
    last_msg_time TIMESTAMPTZ;
BEGIN
    SELECT created_at INTO last_msg_time
    FROM dm_messages
    WHERE sender_session_id = NEW.sender_session_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF last_msg_time IS NOT NULL AND (now() - last_msg_time) < INTERVAL '2 seconds' THEN
        RAISE EXCEPTION 'Rate limit exceeded: Please wait 2 seconds between messages.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER before_dm_message_insert
BEFORE INSERT ON dm_messages
FOR EACH ROW
EXECUTE FUNCTION rate_limit_dm_messages();


-- ----------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_attempts ENABLE ROW LEVEL SECURITY;

-- Posts RLS
CREATE POLICY "Allow public select on non-hidden posts" ON posts
    FOR SELECT USING (is_hidden = false);

CREATE POLICY "Allow transactional insert on posts" ON posts
    FOR INSERT WITH CHECK (session_id = current_setting('app.current_session_id', true));

-- Comments RLS
CREATE POLICY "Allow public select on non-hidden comments" ON comments
    FOR SELECT USING (is_hidden = false);

CREATE POLICY "Allow transactional insert on comments" ON comments
    FOR INSERT WITH CHECK (session_id = current_setting('app.current_session_id', true));

-- Votes RLS
CREATE POLICY "Allow transactional select on votes" ON votes
    FOR SELECT USING (session_id = current_setting('app.current_session_id', true));

CREATE POLICY "Allow transactional insert on votes" ON votes
    FOR INSERT WITH CHECK (session_id = current_setting('app.current_session_id', true));

CREATE POLICY "Allow transactional update on votes" ON votes
    FOR UPDATE USING (session_id = current_setting('app.current_session_id', true)) 
               WITH CHECK (session_id = current_setting('app.current_session_id', true));

CREATE POLICY "Allow transactional delete on votes" ON votes
    FOR DELETE USING (session_id = current_setting('app.current_session_id', true));

-- Reports RLS
CREATE POLICY "Allow transactional insert on reports" ON reports
    FOR INSERT WITH CHECK (session_id = current_setting('app.current_session_id', true));

-- Sessions RLS
CREATE POLICY "Allow transactional select on sessions" ON sessions
    FOR SELECT USING (session_id = current_setting('app.current_session_id', true));

-- DM Threads RLS
CREATE POLICY "Allow transactional select on dm_threads" ON dm_threads
    FOR SELECT USING (
        creator_session_id = current_setting('app.current_session_id', true) OR 
        receiver_session_id = current_setting('app.current_session_id', true)
    );

CREATE POLICY "Allow transactional insert on dm_threads" ON dm_threads
    FOR INSERT WITH CHECK (
        creator_session_id = current_setting('app.current_session_id', true)
    );

CREATE POLICY "Allow transactional update on dm_threads" ON dm_threads
    FOR UPDATE USING (
        creator_session_id = current_setting('app.current_session_id', true) OR 
        receiver_session_id = current_setting('app.current_session_id', true)
    );

-- DM Messages RLS
CREATE POLICY "Allow transactional select on dm_messages" ON dm_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM dm_threads 
            WHERE dm_threads.id = dm_messages.thread_id AND 
            (dm_threads.creator_session_id = current_setting('app.current_session_id', true) OR 
             dm_threads.receiver_session_id = current_setting('app.current_session_id', true))
        )
    );

CREATE POLICY "Allow transactional insert on dm_messages" ON dm_messages
    FOR INSERT WITH CHECK (
        sender_session_id = current_setting('app.current_session_id', true) AND
        EXISTS (
            SELECT 1 FROM dm_threads 
            WHERE dm_threads.id = dm_messages.thread_id AND 
            (dm_threads.creator_session_id = current_setting('app.current_session_id', true) OR 
             dm_threads.receiver_session_id = current_setting('app.current_session_id', true)) AND
            dm_threads.is_blocked = false
        )
    );


-- ----------------------------------------------------
-- SECURE TRANSACTION TRANSACTION-WRAPPING RPC FUNCTIONS
-- ----------------------------------------------------

-- 1. Create Post Secure RPC
CREATE OR REPLACE FUNCTION secure_create_post(
    sess_id text, 
    post_content text, 
    post_image_url text, 
    post_category text
)
RETURNS jsonb AS $$
DECLARE
    new_post posts;
BEGIN
    PERFORM set_config('app.current_session_id', sess_id, true);
    
    INSERT INTO posts (content, image_url, session_id, category)
    VALUES (post_content, post_image_url, sess_id, post_category)
    RETURNING * INTO new_post;
    
    RETURN to_jsonb(new_post);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Create Comment Secure RPC
CREATE OR REPLACE FUNCTION secure_create_comment(
    sess_id text, 
    c_post_id uuid, 
    c_parent_id uuid, 
    c_content text
)
RETURNS jsonb AS $$
DECLARE
    new_comment comments;
BEGIN
    PERFORM set_config('app.current_session_id', sess_id, true);
    
    INSERT INTO comments (post_id, parent_comment_id, content, session_id)
    VALUES (c_post_id, c_parent_id, c_content, sess_id)
    RETURNING * INTO new_comment;
    
    RETURN to_jsonb(new_comment);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Submit Vote Secure RPC (incorporates toggle logic server-side in a transaction)
CREATE OR REPLACE FUNCTION secure_submit_vote(
    sess_id text, 
    v_target_type text, 
    v_target_id uuid, 
    v_value integer
)
RETURNS jsonb AS $$
DECLARE
    existing_id uuid;
    existing_val integer;
    outcome text;
BEGIN
    PERFORM set_config('app.current_session_id', sess_id, true);
    
    SELECT id, vote_value INTO existing_id, existing_val 
    FROM votes 
    WHERE session_id = sess_id AND target_id = v_target_id;
    
    IF existing_id IS NOT NULL THEN
        IF existing_val = v_value THEN
            -- Toggle off: Delete
            DELETE FROM votes WHERE id = existing_id;
            outcome := 'deleted';
        ELSE
            -- Swap: Update
            UPDATE votes SET vote_value = v_value WHERE id = existing_id;
            outcome := 'updated';
        END IF;
    ELSE
        -- Insert
        INSERT INTO votes (session_id, target_type, target_id, vote_value)
        VALUES (sess_id, v_target_type, v_target_id, v_value);
        outcome := 'inserted';
    END IF;
    
    RETURN jsonb_build_object('success', true, 'outcome', outcome);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. Submit Report Secure RPC
CREATE OR REPLACE FUNCTION secure_submit_report(
    sess_id text, 
    r_target_type text, 
    r_target_id uuid, 
    r_reason text
)
RETURNS jsonb AS $$
BEGIN
    PERFORM set_config('app.current_session_id', sess_id, true);
    
    INSERT INTO reports (session_id, target_type, target_id, reason)
    VALUES (sess_id, r_target_type, r_target_id, r_reason);
    
    RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. Create DM Thread Secure RPC
CREATE OR REPLACE FUNCTION secure_create_dm_thread(
    sess_id text, 
    dm_post_id uuid
)
RETURNS jsonb AS $$
DECLARE
    post_author text;
    existing_thread dm_threads;
    new_thread dm_threads;
BEGIN
    PERFORM set_config('app.current_session_id', sess_id, true);
    
    -- Load post author session ID
    SELECT session_id INTO post_author FROM posts WHERE id = dm_post_id;
    IF post_author IS NULL THEN
        RAISE EXCEPTION 'Post not found';
    END IF;
    
    IF post_author = sess_id THEN
        RAISE EXCEPTION 'You cannot message yourself';
    END IF;
    
    -- Check if thread exists
    SELECT * INTO existing_thread 
    FROM dm_threads 
    WHERE ((creator_session_id = sess_id AND receiver_session_id = post_author) OR 
           (creator_session_id = post_author AND receiver_session_id = sess_id))
    AND post_id = dm_post_id;
    
    IF existing_thread.id IS NOT NULL THEN
        RETURN to_jsonb(existing_thread);
    END IF;
    
    -- Create new thread
    INSERT INTO dm_threads (post_id, creator_session_id, receiver_session_id)
    VALUES (dm_post_id, sess_id, post_author)
    RETURNING * INTO new_thread;
    
    RETURN to_jsonb(new_thread);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. Send DM Message Secure RPC
CREATE OR REPLACE FUNCTION secure_send_dm_message(
    sess_id text, 
    dm_thread_id uuid, 
    dm_content text
)
RETURNS jsonb AS $$
DECLARE
    new_msg dm_messages;
BEGIN
    PERFORM set_config('app.current_session_id', sess_id, true);
    
    INSERT INTO dm_messages (thread_id, sender_session_id, content)
    VALUES (dm_thread_id, sess_id, dm_content)
    RETURNING * INTO new_msg;
    
    RETURN to_jsonb(new_msg);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 7. Block DM Thread Secure RPC
CREATE OR REPLACE FUNCTION secure_block_dm_thread(
    sess_id text, 
    dm_thread_id uuid
)
RETURNS jsonb AS $$
DECLARE
    updated_thread dm_threads;
BEGIN
    PERFORM set_config('app.current_session_id', sess_id, true);
    
    UPDATE dm_threads
    SET is_blocked = true, blocked_by = sess_id
    WHERE id = dm_thread_id AND (creator_session_id = sess_id OR receiver_session_id = sess_id)
    RETURNING * INTO updated_thread;
    
    IF updated_thread.id IS NULL THEN
        RAISE EXCEPTION 'Thread not found or unauthorized';
    END IF;
    
    RETURN to_jsonb(updated_thread);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 8. Report DM Message Secure RPC
CREATE OR REPLACE FUNCTION secure_report_dm_message(
    sess_id text, 
    dm_msg_id uuid, 
    dm_reason text
)
RETURNS jsonb AS $$
DECLARE
    updated_msg dm_messages;
BEGIN
    PERFORM set_config('app.current_session_id', sess_id, true);
    
    UPDATE dm_messages
    SET 
        is_reported = true, 
        report_reason = dm_reason, 
        reported_at = now(), 
        report_session_id = sess_id
    WHERE id = dm_msg_id AND EXISTS (
        SELECT 1 FROM dm_threads 
        WHERE dm_threads.id = dm_messages.thread_id AND 
        (dm_threads.creator_session_id = sess_id OR dm_threads.receiver_session_id = sess_id)
    )
    RETURNING * INTO updated_msg;
    
    IF updated_msg.id IS NULL THEN
        RAISE EXCEPTION 'Message not found or unauthorized';
    END IF;
    
    RETURN to_jsonb(updated_msg);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 9. Fetch user votes securely inside same transaction
CREATE OR REPLACE FUNCTION secure_get_user_votes(sess_id text)
RETURNS TABLE (target_id uuid, vote_value integer) AS $$
BEGIN
    PERFORM set_config('app.current_session_id', sess_id, true);
    RETURN QUERY SELECT votes.target_id, votes.vote_value FROM votes WHERE votes.session_id = sess_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 10. Fetch user DMs threads securely
CREATE OR REPLACE FUNCTION secure_get_dm_threads(sess_id text)
RETURNS SETOF dm_threads AS $$
BEGIN
    PERFORM set_config('app.current_session_id', sess_id, true);
    RETURN QUERY 
        SELECT * FROM dm_threads 
        WHERE creator_session_id = sess_id OR receiver_session_id = sess_id
        ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 11. Fetch DM messages securely
CREATE OR REPLACE FUNCTION secure_get_dm_messages(sess_id text, dm_thread_id uuid)
RETURNS SETOF dm_messages AS $$
BEGIN
    PERFORM set_config('app.current_session_id', sess_id, true);
    RETURN QUERY 
        SELECT * FROM dm_messages 
        WHERE thread_id = dm_thread_id
        ORDER BY created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 12. Fetch user karma securely
CREATE OR REPLACE FUNCTION secure_get_user_karma(sess_id text)
RETURNS integer AS $$
DECLARE
    points integer;
BEGIN
    PERFORM set_config('app.current_session_id', sess_id, true);
    SELECT karma_points INTO points FROM sessions WHERE session_id = sess_id;
    RETURN COALESCE(points, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Realtime Publications (Updated)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE posts, comments, votes, reports, dm_messages;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
