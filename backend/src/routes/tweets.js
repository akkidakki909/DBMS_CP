import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { bumpHashtag, checkIdempotency } from '../db/redis.js';

const router = Router();

function toPublicTweet(t) {
  return {
    id: t.id, userId: t.user_id, content: t.content, parentTweetId: t.parent_tweet_id,
    likeCount: t.like_count, retweetCount: t.retweet_count, replyCount: t.reply_count,
    createdAt: t.created_at,
    user: t.username ? { id:t.user_id, username:t.username, displayName:t.display_name || t.username, handle:`@${t.username}`, avatar:t.avatar_url || '', isVerified:!!t.is_verified } : undefined,
  };
}

// ---------- Create tweet (extracts hashtags, bumps trending) ----------
router.post('/', requireAuth, async (req, res) => {
  const { content, parentTweetId, idempotencyKey } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'content is required' });
  if (idempotencyKey) {
    const isNew = await checkIdempotency(idempotencyKey);
    if (!isNew) return res.status(409).json({ error: 'Duplicate submission ignored' });
  }

  const { rows } = await query(
    `INSERT INTO tweets (user_id, content, parent_tweet_id, is_reply)
     VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.userId, content, parentTweetId || null, !!parentTweetId]
  );
  const tweet = rows[0];

  // Notify the parent-post author when someone replies.
  if (parentTweetId) {
    const parent = await query('SELECT user_id FROM tweets WHERE id=$1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1', [parentTweetId]);
    if (parent.rows[0] && parent.rows[0].user_id !== req.userId) {
      await query("INSERT INTO notifications(user_id,actor_id,type,tweet_id) VALUES($1,$2,'reply',$3)", [parent.rows[0].user_id, req.userId, tweet.id]);
    }
  }

  // hashtags: extract, upsert, link, bump Redis trending
  const tags = [...content.matchAll(/#(\w+)/g)].map(m => m[1]);
  for (const tag of tags) {
    const { rows: h } = await query(
      `INSERT INTO hashtags (tag) VALUES ($1)
       ON CONFLICT (tag) DO UPDATE SET tag = EXCLUDED.tag RETURNING id`,
      [tag.toLowerCase()]
    );
    await query(
      `INSERT INTO tweet_hashtags (tweet_id, tweet_created_at, hashtag_id) VALUES ($1,$2,$3)
       ON CONFLICT DO NOTHING`,
      [tweet.id, tweet.created_at, h[0].id]
    );
    await bumpHashtag(tag);
  }

  res.status(201).json(toPublicTweet(tweet));
});

// ---------- Recursive CTE: full thread ----------
router.get('/:id/thread', optionalAuth, async (req, res) => {
  const { rows } = await query(
    `WITH RECURSIVE thread AS (
       SELECT id, user_id, content, parent_tweet_id, created_at, like_count, retweet_count, reply_count, 0 AS depth
       FROM tweets WHERE id = $1
       UNION ALL
       SELECT t.id, t.user_id, t.content, t.parent_tweet_id, t.created_at, t.like_count, t.retweet_count, t.reply_count, th.depth + 1
       FROM tweets t
       JOIN thread th ON t.parent_tweet_id = th.id
     )
     SELECT thread.*,u.username,u.display_name,u.avatar_url,u.is_verified FROM thread JOIN users u ON u.id=thread.user_id ORDER BY depth, created_at;`,
    [req.params.id]
  );
  res.json(rows.map(toPublicTweet));
});

router.delete('/:id', requireAuth, async (req, res) => {
  const { rows } = await query(
    `UPDATE tweets SET deleted_at = now() WHERE id = $1 AND user_id = $2 RETURNING id`,
    [req.params.id, req.userId]
  );
  if (!rows.length) return res.status(404).json({ error: 'Not found or not yours' });
  res.status(204).end();
});

export default router;
