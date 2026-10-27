import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit } from '../db/redis.js';

const router = Router();

async function getTweetMeta(id) {
  const { rows } = await query('SELECT id, created_at, user_id FROM tweets WHERE id = $1', [id]);
  return rows[0];
}

router.post('/likes/:tweetId', requireAuth, async (req, res) => {
  const ok = await rateLimit(`ratelimit:like:${req.userId}`, 60, 60); // 60 likes/min
  if (!ok) return res.status(429).json({ error: 'Slow down — too many likes' });

  const tweet = await getTweetMeta(req.params.tweetId);
  if (!tweet) return res.status(404).json({ error: 'Tweet not found' });

  await query(
    `INSERT INTO likes (user_id, tweet_id, tweet_created_at) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
    [req.userId, tweet.id, tweet.created_at]
  );
  if (tweet.user_id !== req.userId) {
    await query(`INSERT INTO notifications (user_id, actor_id, type, tweet_id) VALUES ($1,$2,'like',$3)`,
      [tweet.user_id, req.userId, tweet.id]);
  }
  res.status(204).end();
});

router.delete('/likes/:tweetId', requireAuth, async (req, res) => {
  await query(`DELETE FROM likes WHERE user_id = $1 AND tweet_id = $2`, [req.userId, req.params.tweetId]);
  res.status(204).end();
});

router.post('/retweets/:tweetId', requireAuth, async (req, res) => {
  const tweet = await getTweetMeta(req.params.tweetId);
  if (!tweet) return res.status(404).json({ error: 'Tweet not found' });

  await query(
    `INSERT INTO retweets (user_id, tweet_id, tweet_created_at, quote_content) VALUES ($1,$2,$3,$4)
     ON CONFLICT DO NOTHING`,
    [req.userId, tweet.id, tweet.created_at, req.body.quoteContent || null]
  );
  if (tweet.user_id !== req.userId) {
    await query(`INSERT INTO notifications (user_id, actor_id, type, tweet_id) VALUES ($1,$2,'retweet',$3)`,
      [tweet.user_id, req.userId, tweet.id]);
  }
  res.status(204).end();
});

router.delete('/retweets/:tweetId', requireAuth, async (req,res,next) => {
  try { await query('DELETE FROM retweets WHERE user_id=$1 AND tweet_id=$2', [req.userId, req.params.tweetId]); res.status(204).end(); } catch(e) { next(e); }
});

export default router;
