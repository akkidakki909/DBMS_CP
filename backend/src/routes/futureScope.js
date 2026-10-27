
import { Router } from 'express';
import { query, pool } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/roles.js';

const router = Router();
router.use(requireAuth);

// Role information and an admin-only user list.
router.get('/me/role', async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, username, role FROM users WHERE id=$1',
      [req.userId]
    );
    res.json(rows[0] || {});
  } catch (e) {
    next(e);
  }
});

router.get('/admin/users', requireRole('admin', 'moderator'), async (_req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT id, username, display_name AS "displayName",
             email, role, created_at AS "createdAt",
             deleted_at AS "deletedAt"
      FROM users
      ORDER BY created_at DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.patch('/admin/users/:id/role', requireRole('admin'), async (req, res, next) => {
  const { role } = req.body;

  if (!['user', 'moderator', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'role must be user, moderator, or admin' });
  }

  try {
    const { rows } = await query(
      'UPDATE users SET role=$1 WHERE id=$2 RETURNING id, username, role',
      [role, req.params.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

router.patch('/admin/users/:id/status', requireRole('admin', 'moderator'), async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE users
       SET deleted_at = CASE WHEN $1::boolean THEN now() ELSE NULL END
       WHERE id=$2
       RETURNING id, username, deleted_at AS "deletedAt"`,
      [Boolean(req.body.disabled), req.params.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// Edit a post and retain its previous version.
router.patch('/tweets/:id', async (req, res, next) => {
  const content = typeof req.body.content === 'string'
    ? req.body.content.trim()
    : '';

  if (!content || content.length > 280) {
    return res.status(400).json({
      error: 'content must contain 1–280 characters'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `SELECT id, user_id, content, created_at
       FROM tweets
       WHERE id=$1 AND deleted_at IS NULL
       FOR UPDATE`,
      [req.params.id]
    );

    const tweet = rows[0];

    if (!tweet) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Post not found' });
    }

    const { rows: roleRows } = await client.query(
      'SELECT role FROM users WHERE id=$1',
      [req.userId]
    );

    if (
      tweet.user_id !== req.userId &&
      !['admin', 'moderator'].includes(roleRows[0]?.role)
    ) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'You can only edit your own post'
      });
    }

    await client.query(
      `INSERT INTO tweet_edit_history
       (tweet_id, tweet_created_at, editor_id, old_content, new_content)
       VALUES ($1, $2, $3, $4, $5)`,
      [tweet.id, tweet.created_at, req.userId, tweet.content, content]
    );

    const updated = await client.query(
      `UPDATE tweets
       SET content=$1, edit_count=edit_count+1
       WHERE id=$2 AND created_at=$3
       RETURNING id, content, edit_count, created_at`,
      [content, tweet.id, tweet.created_at]
    );

    await client.query('COMMIT');

    res.json({
      id: updated.rows[0].id,
      content: updated.rows[0].content,
      editCount: updated.rows[0].edit_count,
      createdAt: updated.rows[0].created_at
    });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

router.get('/tweets/:id/edits', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT old_content AS content,
              edited_at AS "editedAt",
              editor_id AS "editorId"
       FROM tweet_edit_history
       WHERE tweet_id=$1
       ORDER BY edited_at ASC`,
      [req.params.id]
    );

    const { rows: current } = await query(
      `SELECT content, edit_count AS "editCount",
              created_at AS "createdAt"
       FROM tweets
       WHERE id=$1 AND deleted_at IS NULL`,
      [req.params.id]
    );

    if (!current.length) {
      return res.status(404).json({ error: 'Post not found' });
    }

    res.json({
      editCount: current[0].editCount,
      history: [
        ...rows,
        ...(current[0].editCount
          ? [{
              content: current[0].content,
              editedAt: current[0].createdAt,
              current: true
            }]
          : [])
      ]
    });
  } catch (e) {
    next(e);
  }
});

// Report a post or user.
router.post('/reports', async (req, res, next) => {
  const {
    targetType = 'tweet',
    targetId,
    reason,
    details = ''
  } = req.body;

  const validReasons = [
    'spam', 'harassment', 'hate', 'violence',
    'misinformation', 'nudity', 'other'
  ];

  if (
    !targetId ||
    !['tweet', 'user'].includes(targetType) ||
    !validReasons.includes(reason)
  ) {
    return res.status(400).json({
      error: 'Valid targetId, targetType, and reason are required'
    });
  }

  try {
    let exactTweetCreatedAt = null;

    if (targetType === 'tweet') {
      const target = await query(
        `SELECT created_at
         FROM tweets
         WHERE id=$1 AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [targetId]
      );

      if (!target.rows.length) {
        return res.status(404).json({ error: 'Post not found' });
      }

      exactTweetCreatedAt = target.rows[0].created_at;
    } else {
      const target = await query(
        'SELECT id FROM users WHERE id=$1 AND deleted_at IS NULL',
        [targetId]
      );

      if (!target.rows.length) {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    const { rows } = await query(
      `INSERT INTO reports
       (reporter_id, target_type, target_tweet_id,
        target_tweet_created_at, target_user_id, reason, details)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, status, created_at AS "createdAt"`,
      [
        req.userId,
        targetType,
        targetType === 'tweet' ? targetId : null,
        exactTweetCreatedAt,
        targetType === 'user' ? targetId : null,
        reason,
        String(details).slice(0, 2000)
      ]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === '23503') {
      return res.status(404).json({ error: 'Target user or post not found' });
    }
    next(e);
  }
});

router.get('/admin/reports', requireRole('admin', 'moderator'), async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';

    const { rows } = await query(
      `SELECT r.*,
              u.username AS reporter_username,
              t.content AS target_tweet_content,
              t.user_id AS target_tweet_author_id,
              tu.username AS target_tweet_author,
              t.created_at AS target_tweet_created_at
       FROM reports r
       JOIN users u ON u.id=r.reporter_id
       LEFT JOIN tweets t
         ON t.id=r.target_tweet_id
        AND t.created_at=r.target_tweet_created_at
       LEFT JOIN users tu ON tu.id=t.user_id
       WHERE ($1='all' OR r.status=$1)
       ORDER BY r.created_at DESC
       LIMIT 200`,
      [status]
    );

    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.patch('/admin/reports/:id', requireRole('admin', 'moderator'), async (req, res, next) => {
  const { status } = req.body;

  if (!['reviewed', 'resolved', 'dismissed', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  try {
    const { rows } = await query(
      `UPDATE reports
       SET status=$1, reviewed_by=$2, reviewed_at=now()
       WHERE id=$3
       RETURNING *`,
      [status, req.userId, req.params.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Report not found' });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// Persistent bookmarks.
router.get('/bookmarks', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT t.id, t.user_id AS "userId", t.content,
              t.created_at AS "createdAt",
              t.like_count AS likes,
              t.retweet_count AS reposts,
              t.reply_count AS comments,
              u.username,
              u.display_name AS "displayName",
              u.avatar_url AS avatar
       FROM bookmarks b
       JOIN tweets t
         ON t.id=b.tweet_id
        AND t.created_at=b.tweet_created_at
       JOIN users u ON u.id=t.user_id
       WHERE b.user_id=$1 AND t.deleted_at IS NULL
       ORDER BY b.created_at DESC
       LIMIT 200`,
      [req.userId]
    );

    res.json(rows.map(t => ({
      ...t,
      user: {
        id: t.userId,
        username: t.username,
        displayName: t.displayName,
        handle: `@${t.username}`,
        avatar: t.avatar
      },
      images: [],
      isBookmarked: true,
      isLiked: false,
      isReposted: false
    })));
  } catch (e) {
    next(e);
  }
});

// FIX: use the exact created_at value selected by PostgreSQL.
// Do not create a JavaScript Date or send a timestamp from the browser.
router.post('/bookmarks/:tweetId', async (req, res, next) => {
  try {
    const tweetId = req.params.tweetId;

    const { rows } = await query(
      `INSERT INTO bookmarks (user_id, tweet_id, tweet_created_at)
       SELECT $1, t.id, t.created_at
       FROM tweets AS t
       WHERE t.id=$2
         AND t.deleted_at IS NULL
       ORDER BY t.created_at DESC
       LIMIT 1
       ON CONFLICT DO NOTHING
       RETURNING tweet_id`,
      [req.userId, tweetId]
    );

    if (!rows.length) {
      const { rows: existing } = await query(
        `SELECT 1
         FROM bookmarks b
         JOIN tweets t
           ON t.id=b.tweet_id
          AND t.created_at=b.tweet_created_at
         WHERE b.user_id=$1
           AND b.tweet_id=$2
           AND t.deleted_at IS NULL
         LIMIT 1`,
        [req.userId, tweetId]
      );

      if (existing.length) return res.status(204).end();

      const { rows: tweetExists } = await query(
        `SELECT 1 FROM tweets
         WHERE id=$1 AND deleted_at IS NULL
         LIMIT 1`,
        [tweetId]
      );

      if (!tweetExists.length) {
        return res.status(404).json({ error: 'Post not found' });
      }
    }

    return res.status(204).end();
  } catch (e) {
    next(e);
  }
});

router.delete('/bookmarks/:tweetId', async (req, res, next) => {
  try {
    await query(
      'DELETE FROM bookmarks WHERE user_id=$1 AND tweet_id=$2',
      [req.userId, req.params.tweetId]
    );

    res.status(204).end();
  } catch (e) {
    next(e);
  }
});

// Direct messages.
router.get('/messages', async (req, res, next) => {
  const other = req.query.with;

  try {
    if (other) {
      const { rows } = await query(
        `SELECT id,
                sender_id AS "senderId",
                recipient_id AS "recipientId",
                content,
                is_read AS "isRead",
                created_at AS "createdAt"
         FROM direct_messages
         WHERE (sender_id=$1 AND recipient_id=$2)
            OR (sender_id=$2 AND recipient_id=$1)
         ORDER BY created_at ASC
         LIMIT 500`,
        [req.userId, other]
      );

      await query(
        `UPDATE direct_messages
         SET is_read=TRUE
         WHERE sender_id=$1 AND recipient_id=$2 AND is_read=FALSE`,
        [other, req.userId]
      );

      return res.json(rows);
    }

    const { rows } = await query(
      `SELECT DISTINCT ON (other_id)
              other_id AS "userId",
              u.username,
              u.display_name AS "displayName",
              dm.content AS "lastMessage",
              dm.created_at AS "lastMessageAt",
              (SELECT count(*)::int
               FROM direct_messages unread
               WHERE unread.sender_id=other_id
                 AND unread.recipient_id=$1
                 AND unread.is_read=FALSE) AS "unreadCount"
       FROM (
         SELECT *,
                CASE WHEN sender_id=$1
                     THEN recipient_id ELSE sender_id END AS other_id
         FROM direct_messages
         WHERE sender_id=$1 OR recipient_id=$1
       ) dm
       JOIN users u ON u.id=dm.other_id
       ORDER BY other_id, dm.created_at DESC`,
      [req.userId]
    );

    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.post('/messages', async (req, res, next) => {
  const { recipientId, content } = req.body;
  const body = typeof content === 'string' ? content.trim() : '';

  if (!recipientId || !body || body.length > 4000) {
    return res.status(400).json({
      error: 'recipientId and content (1–4000 chars) are required'
    });
  }

  try {
    const { rows } = await query(
      `INSERT INTO direct_messages(sender_id, recipient_id, content)
       SELECT $1, $2, $3
       WHERE $1<>$2
         AND EXISTS (
           SELECT 1 FROM users
           WHERE id=$2 AND deleted_at IS NULL
         )
       RETURNING id, sender_id AS "senderId",
                 recipient_id AS "recipientId",
                 content, is_read AS "isRead",
                 created_at AS "createdAt"`,
      [req.userId, recipientId, body]
    );

    if (!rows.length) {
      return res.status(400).json({ error: 'Recipient not found or invalid' });
    }

    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// Create a poll attached to a post owned by the creator.
router.post('/tweets/:id/poll', async (req, res, next) => {
  const {
    question,
    options,
    durationHours = 24
  } = req.body;

  const cleanOptions = Array.isArray(options)
    ? options.map(x => String(x).trim()).filter(Boolean)
    : [];

  if (
    !question?.trim() ||
    cleanOptions.length < 2 ||
    cleanOptions.length > 4 ||
    new Set(cleanOptions).size !== cleanOptions.length
  ) {
    return res.status(400).json({
      error: 'Question and 2–4 unique options are required'
    });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: t } = await client.query(
      `SELECT id, user_id, created_at
       FROM tweets
       WHERE id=$1 AND deleted_at IS NULL
       FOR UPDATE`,
      [req.params.id]
    );

    if (!t.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Post not found' });
    }

    if (t[0].user_id !== req.userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({
        error: 'Only the post owner can attach a poll'
      });
    }

    const { rows: p } = await client.query(
      `INSERT INTO polls(tweet_id, tweet_created_at, question, ends_at)
       VALUES ($1, $2, $3, now()+($4::text||' hours')::interval)
       ON CONFLICT(tweet_id, tweet_created_at)
       DO UPDATE SET question=EXCLUDED.question
       RETURNING id`,
      [
        t[0].id,
        t[0].created_at,
        question.trim(),
        Math.max(1, Math.min(168, Number(durationHours) || 24))
      ]
    );

    await client.query('DELETE FROM poll_options WHERE poll_id=$1', [p[0].id]);

    for (let i = 0; i < cleanOptions.length; i++) {
      await client.query(
        `INSERT INTO poll_options(poll_id, option_text, position)
         VALUES ($1, $2, $3)`,
        [p[0].id, cleanOptions[i], i + 1]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ pollId: p[0].id });
  } catch (e) {
    await client.query('ROLLBACK');
    next(e);
  } finally {
    client.release();
  }
});

router.get('/tweets/:id/poll', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.id AS "pollId",
              p.question,
              p.ends_at AS "endsAt",
              o.id AS "optionId",
              o.option_text AS text,
              count(v.user_id)::int AS votes,
              bool_or(v.user_id=$2) AS "userVotedForOption"
       FROM polls p
       JOIN poll_options o ON o.poll_id=p.id
       LEFT JOIN poll_votes v ON v.option_id=o.id
       WHERE p.tweet_id=$1
       GROUP BY p.id, o.id
       ORDER BY o.position`,
      [req.params.id, req.userId]
    );

    if (!rows.length) return res.status(404).json({ error: 'Poll not found' });

    const first = rows[0];

    res.json({
      id: first.pollId,
      question: first.question,
      endsAt: first.endsAt,
      hasVoted: rows.some(r => r.userVotedForOption),
      options: rows.map(r => ({
        id: r.optionId,
        text: r.text,
        votes: r.votes
      })),
      totalVotes: rows.reduce((n, r) => n + r.votes, 0)
    });
  } catch (e) {
    next(e);
  }
});

router.post('/polls/:pollId/vote', async (req, res, next) => {
  const { optionId } = req.body;

  if (!optionId) {
    return res.status(400).json({ error: 'optionId is required' });
  }

  try {
    const { rows } = await query(
      `INSERT INTO poll_votes(poll_id, option_id, user_id)
       SELECT p.id, o.id, $3
       FROM polls p
       JOIN poll_options o ON o.poll_id=p.id
       WHERE p.id=$1 AND o.id=$2 AND p.ends_at>now()
       ON CONFLICT(poll_id, user_id) DO NOTHING
       RETURNING poll_id`,
      [req.params.pollId, optionId, req.userId]
    );

    if (!rows.length) {
      return res.status(409).json({
        error: 'Poll expired, invalid option, or you have already voted'
      });
    }

    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
});

// Hourly and daily hashtag rankings.
router.get('/trending', async (_req, res, next) => {
  try {
    const run = async (hours) => (
      await query(
        `SELECT h.tag, count(*)::int AS posts
         FROM tweet_hashtags th
         JOIN hashtags h ON h.id=th.hashtag_id
         JOIN tweets t
           ON t.id=th.tweet_id
          AND t.created_at=th.tweet_created_at
         WHERE t.created_at >= now()-($1::text||' hours')::interval
           AND t.deleted_at IS NULL
         GROUP BY h.tag
         ORDER BY posts DESC, h.tag ASC
         LIMIT 10`,
        [hours]
      )
    ).rows;

    res.json({
      hourly: await run(1),
      daily: await run(24),
      generatedAt: new Date().toISOString()
    });
  } catch (e) {
    next(e);
  }
});

// URL-based image attachments.
router.post('/tweets/:id/media', async (req, res, next) => {
  const { mediaUrl, altText = '' } = req.body;

  if (typeof mediaUrl !== 'string' || !/^https:\/\//i.test(mediaUrl)) {
    return res.status(400).json({
      error: 'mediaUrl must be an HTTPS URL'
    });
  }

  try {
    const { rows: t } = await query(
      `SELECT id, user_id, created_at
       FROM tweets
       WHERE id=$1 AND deleted_at IS NULL`,
      [req.params.id]
    );

    if (!t.length) return res.status(404).json({ error: 'Post not found' });

    if (t[0].user_id !== req.userId) {
      return res.status(403).json({
        error: 'Only the post owner can attach media'
      });
    }

    const { rows } = await query(
      `INSERT INTO tweet_media
       (tweet_id, tweet_created_at, media_url, alt_text)
       VALUES ($1, $2, $3, $4)
       RETURNING id, media_url AS "mediaUrl", alt_text AS "altText"`,
      [
        t[0].id,
        t[0].created_at,
        mediaUrl,
        String(altText).slice(0, 300)
      ]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// Persistent notification inbox.
router.get('/notifications', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT n.id, n.type,
              n.tweet_id AS "postId",
              n.is_read AS "isRead",
              n.created_at AS "createdAt",
              u.id AS "fromUserId",
              u.username,
              u.display_name AS "displayName",
              u.avatar_url AS avatar
       FROM notifications n
       JOIN users u ON u.id=n.actor_id
       WHERE n.user_id=$1
       ORDER BY n.created_at DESC
       LIMIT 100`,
      [req.userId]
    );

    res.json(rows);
  } catch (e) {
    next(e);
  }
});

router.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE notifications
       SET is_read=TRUE
       WHERE id=$1 AND user_id=$2
       RETURNING id, is_read AS "isRead"`,
      [req.params.id, req.userId]
    );

    if (!rows.length) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

// Find people by username for starting a direct-message conversation.
router.get('/people', async (req, res, next) => {
  const q = String(req.query.q || '').trim();

  try {
    const pattern = q.length >= 2
      ? `%${q.replace(/[%_]/g, '\\$&')}%`
      : null;

    const { rows } = await query(
      `SELECT u.id,
              u.username,
              u.display_name AS "displayName",
              u.avatar_url AS avatar,
              u.bio,
              EXISTS(
                SELECT 1 FROM follows f
                WHERE f.follower_id=$1 AND f.followee_id=u.id
              ) AS "isFollowing"
       FROM users u
       WHERE u.deleted_at IS NULL
         AND u.id<>$1
         AND ($2::text IS NULL OR u.username ILIKE $2)
       ORDER BY u.created_at DESC
       LIMIT 30`,
      [req.userId, pattern]
    );

    res.json(rows);
  } catch (e) {
    next(e);
  }
});

export default router;
