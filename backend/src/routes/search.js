import { Router } from 'express';
import { query } from '../db/pool.js';
import { getTrending } from '../db/redis.js';

const router = Router();

// Full-text search over tweets (tsvector/tsquery + GIN index from migration 001)
router.get('/', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const { rows } = await query(
    `SELECT t.id, t.user_id, t.content, t.like_count, t.retweet_count, t.reply_count, t.created_at, u.username, u.display_name, u.avatar_url,
            ts_rank(t.search_vector, plainto_tsquery('english', $1)) AS rank
     FROM tweets t JOIN users u ON u.id=t.user_id, plainto_tsquery('english', $1) query
     WHERE t.search_vector @@ query AND t.deleted_at IS NULL AND u.deleted_at IS NULL
     ORDER BY rank DESC LIMIT 20`,
    [q]
  );
  res.json(rows);
});

// Trending hashtags — served from Redis sorted set, not Postgres, for speed
router.get('/trending', async (_req, res) => {
  const trending = await getTrending(10);
  res.json(trending);
});

export default router;
