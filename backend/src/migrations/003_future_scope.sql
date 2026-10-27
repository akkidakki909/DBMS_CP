-- Chirp future-scope features. Run AFTER 001_init.sql.
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user','moderator','admin'));

ALTER TABLE tweets ADD COLUMN IF NOT EXISTS edit_count INTEGER NOT NULL DEFAULT 0 CHECK (edit_count >= 0);
ALTER TABLE tweets ADD COLUMN IF NOT EXISTS image_url TEXT;

CREATE TABLE IF NOT EXISTS tweet_edit_history (
  id BIGSERIAL PRIMARY KEY,
  tweet_id UUID NOT NULL,
  tweet_created_at TIMESTAMPTZ NOT NULL,
  editor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_content VARCHAR(280) NOT NULL,
  new_content VARCHAR(280) NOT NULL,
  edited_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tweet_edit_history_tweet ON tweet_edit_history(tweet_id, tweet_created_at, edited_at DESC);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type VARCHAR(10) NOT NULL CHECK (target_type IN ('tweet','user')),
  target_tweet_id UUID,
  target_tweet_created_at TIMESTAMPTZ,
  target_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(40) NOT NULL CHECK (reason IN ('spam','harassment','hate','violence','misinformation','nudity','other')),
  details TEXT DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','resolved','dismissed')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK ((target_type='tweet' AND target_tweet_id IS NOT NULL AND target_tweet_created_at IS NOT NULL AND target_user_id IS NULL)
      OR (target_type='user' AND target_user_id IS NOT NULL AND target_tweet_id IS NULL AND target_tweet_created_at IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_reports_status_created ON reports(status, created_at DESC);

CREATE TABLE IF NOT EXISTS direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 4000),
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id)
);
CREATE INDEX IF NOT EXISTS idx_messages_pair_time ON direct_messages(sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_unread ON direct_messages(recipient_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id UUID NOT NULL,
  tweet_created_at TIMESTAMPTZ NOT NULL,
  question VARCHAR(280) NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(tweet_id, tweet_created_at)
);
CREATE TABLE IF NOT EXISTS poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_text VARCHAR(100) NOT NULL,
  position SMALLINT NOT NULL CHECK (position BETWEEN 1 AND 4),
  UNIQUE(poll_id, position),
  UNIQUE(poll_id, option_text)
);
CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id UUID NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  option_id UUID NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(poll_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option ON poll_votes(option_id);

CREATE TABLE IF NOT EXISTS tweet_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tweet_id UUID NOT NULL,
  tweet_created_at TIMESTAMPTZ NOT NULL,
  media_url TEXT NOT NULL,
  alt_text VARCHAR(300) DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMIT;

-- DBMS demo note: application roles are stored in users.role. Use a separate
-- restricted PostgreSQL login for the app; do not grant SUPERUSER to the app.
-- Example (run as PostgreSQL administrator, adjust password locally):
-- CREATE ROLE chirp_readonly NOLOGIN;
-- GRANT SELECT ON users, tweets, follows, likes, retweets, hashtags, notifications TO chirp_readonly;
-- REVOKE INSERT, UPDATE, DELETE ON users, tweets FROM chirp_readonly;

-- Persistent per-user bookmarks (idempotent migration addition).
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tweet_id UUID NOT NULL,
  tweet_created_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, tweet_id),
  FOREIGN KEY (tweet_id, tweet_created_at) REFERENCES tweets(id, created_at) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created ON bookmarks(user_id, created_at DESC);
