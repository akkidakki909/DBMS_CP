import { query } from '../db/pool.js';

export function requireRole(...allowedRoles) {
  return async (req, res, next) => {
    try {
      const { rows } = await query('SELECT role FROM users WHERE id=$1 AND deleted_at IS NULL', [req.userId]);
      const role = rows[0]?.role || 'user';
      req.userRole = role;
      if (!allowedRoles.includes(role)) return res.status(403).json({ error: 'Insufficient privileges' });
      next();
    } catch (error) { next(error); }
  };
}
