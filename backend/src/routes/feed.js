import { Router } from 'express';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { cacheGetJSON, cacheSetJSON } from '../db/redis.js';

const router = Router();

// GET /api/feed
// GET /api/feed?mode=pull
// GET /api/feed?mode=fanout
router.get('/', requireAuth, async (req, res) => {
  try {
    const mode = req.query.mode === 'fanout' ? 'fanout' : 'pull';

    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      50
    );

    const cursor = req.query.cursor || new Date().toISOString();

    const cacheKey = `feed:${mode}:${req.userId}:${cursor}:${limit}`;

    // Try Redis cache first
    try {
      const cached = await cacheGetJSON(cacheKey);

      if (cached) {
        return res.json({
          ...cached,
          cached: true,
        });
      }
    } catch (redisError) {
      console.warn('Redis cache read failed:', redisError.message);
    }

    const start = process.hrtime.bigint();

    let rows;

    // --------------------------------------------------
    // PULL MODEL
    // --------------------------------------------------
    if (mode === 'pull') {
      const result = await query(
        `
        SELECT
          t.id,
          t.user_id,
          t.content,
          t.parent_tweet_id,
          t.like_count,
          t.retweet_count,
          t.reply_count,
          t.created_at,

          u.username,
          u.display_name,
          u.avatar_url,
          u.is_verified

        FROM tweets t

        JOIN users u
          ON u.id = t.user_id

        WHERE
          (
            t.user_id IN (
              SELECT followee_id
              FROM follows
              WHERE follower_id = $1
            )
            OR t.user_id = $1
          )

          AND t.created_at < $2
          AND t.deleted_at IS NULL
          AND u.deleted_at IS NULL

        ORDER BY t.created_at DESC

        LIMIT $3
        `,
        [req.userId, cursor, limit]
      );

      rows = result.rows;
    }

    // --------------------------------------------------
    // FAN-OUT MODEL
    // --------------------------------------------------
    else {
      const result = await query(
        `
        SELECT
          t.id,
          t.user_id,
          t.content,
          t.parent_tweet_id,
          t.like_count,
          t.retweet_count,
          t.reply_count,
          t.created_at,

          u.username,
          u.display_name,
          u.avatar_url,
          u.is_verified

        FROM feed_entries f

        JOIN tweets t
          ON t.id = f.tweet_id
         AND t.created_at = f.tweet_created_at

        JOIN users u
          ON u.id = t.user_id

        WHERE
          f.owner_id = $1
          AND f.tweet_created_at < $2
          AND t.deleted_at IS NULL
          AND u.deleted_at IS NULL

        ORDER BY f.tweet_created_at DESC

        LIMIT $3
        `,
        [req.userId, cursor, limit]
      );

      rows = result.rows;
    }

    const tookMs =
      Number(process.hrtime.bigint() - start) / 1e6;

    // --------------------------------------------------
    // Convert database rows to frontend-friendly objects
    // --------------------------------------------------

    const tweets = rows.map((tweet) => ({
      id: tweet.id,

      userId: tweet.user_id,

      content: tweet.content,

      parentTweetId: tweet.parent_tweet_id,

      likes: tweet.like_count || 0,

      reposts: tweet.retweet_count || 0,

      comments: tweet.reply_count || 0,

      createdAt: tweet.created_at,

      isLiked: false,

      isReposted: false,

      isBookmarked: false,

      // User information
      user: {
        id: tweet.user_id,
        username: tweet.username,
        displayName: tweet.display_name,
        handle: `@${tweet.username}`,
        avatar: tweet.avatar_url,
        isVerified: tweet.is_verified,
      },
    }));

    const payload = {
      mode,
      tookMs,

      nextCursor:
        rows.length > 0
          ? rows[rows.length - 1].created_at
          : null,

      tweets,
    };

    // Cache for 30 seconds.
    // If Redis is unavailable, the feed still works.
    try {
      await cacheSetJSON(cacheKey, payload, 30);
    } catch (redisError) {
      console.warn('Redis cache write failed:', redisError.message);
    }

    return res.json(payload);

  } catch (error) {
    console.error('Feed error:', error);

    return res.status(500).json({
      error: 'Failed to load feed',
      details: error.message,
    });
  }
});


// --------------------------------------------------
// FEED BENCHMARK
// --------------------------------------------------

router.get('/benchmark', requireAuth, async (req, res) => {
  try {
    const cursor = new Date().toISOString();

    const runs = {};

    // Pull
    let start = process.hrtime.bigint();

    await query(
      `
      SELECT t.id
      FROM tweets t

      WHERE
        (
          t.user_id IN (
            SELECT followee_id
            FROM follows
            WHERE follower_id = $1
          )
          OR t.user_id = $1
        )

        AND t.created_at < $2
        AND t.deleted_at IS NULL

      ORDER BY t.created_at DESC

      LIMIT 20
      `,
      [req.userId, cursor]
    );

    runs.pull =
      Number(process.hrtime.bigint() - start) / 1e6;


    // Fan-out
    start = process.hrtime.bigint();

    await query(
      `
      SELECT tweet_id
      FROM feed_entries

      WHERE
        owner_id = $1
        AND tweet_created_at < $2

      ORDER BY tweet_created_at DESC

      LIMIT 20
      `,
      [req.userId, cursor]
    );

    runs.fanout =
      Number(process.hrtime.bigint() - start) / 1e6;


    return res.json({
      tookMs: runs,

      note:
        'Pull reads tweets at request time. Fan-out reads precomputed feed entries.'
    });

  } catch (error) {
    console.error('Feed benchmark error:', error);

    return res.status(500).json({
      error: 'Benchmark failed',
      details: error.message,
    });
  }
});

export default router;