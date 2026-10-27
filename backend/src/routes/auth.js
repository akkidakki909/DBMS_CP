import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db/pool.js';

const router = Router();

function toPublicUser(u) {
  return {
    id: u.id, username: u.username, displayName: u.display_name, handle: '@' + u.username,
    email: u.email, bio: u.bio, avatar: u.avatar_url, banner: u.banner_url,
    isVerified: u.is_verified, role: u.role || 'user', followersCount: u.followers_count,
    followingCount: u.following_count, postsCount: u.posts_count,
  };
}

router.post('/register', async (req, res) => {
  const { username, displayName, email, password } = req.body;
  if (!username || !displayName || !email || !password) {
    return res.status(400).json({ error: 'username, displayName, email, password are required' });
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO users (username, display_name, email, password_hash, avatar_url)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [username, displayName, email, hash, `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`]
    );
    const user = rows[0];
    const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user: toPublicUser(user) });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username or email already taken' });
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const { rows } = await query('SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL', [email]);
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const token = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: toPublicUser(user) });
});

export default router;
