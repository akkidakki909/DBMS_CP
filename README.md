
## Future-scope features (October 2026 update)

This update adds a separate, additive PostgreSQL migration and API/UI support for the features requested for the course demo. Keep your existing `.env` private.

### 1. Apply the new database migration

Do **not** rerun `001_init.sql` on a database that already has the schema; it is the initial schema, not an idempotent upgrade. From the `backend` directory, with PostgreSQL running and `DATABASE_URL` configured in `backend/.env`, run:

```bash
npm run migrate-future
```

Or run directly:

```bash
psql -U postgres -d chirp -f src/migrations/003_future_scope.sql
```

### 2. Make your account an admin for the demo

Register/login normally first, then copy the account UUID from `users` in pgAdmin. Run this in the `chirp` Query Tool, replacing the UUID with your own account ID:

```sql
UPDATE users SET role = 'admin' WHERE id = 'PUT-YOUR-USER-UUID-HERE';
SELECT id, username, role FROM users;
```

Log out and log in again so the frontend refreshes the user information. Open `/admin` to review reports and manage roles. Only an existing admin can promote users to admin. App roles (`user`, `moderator`, `admin`) are separate from PostgreSQL login roles. For the DBMS DCL demonstration, use a separate restricted PostgreSQL role and demonstrate `GRANT`/`REVOKE`; never make the app's database login a superuser.

### 3. New functionality

- **Roles and admin:** `users.role`, role-checking middleware, admin user listing, role changes, and account disable/enable endpoints.
- **Post editing:** use the post menu → Edit post. Each edit increments `tweets.edit_count` and stores the previous version in `tweet_edit_history`. The Edited badge opens the saved history.
- **Reports:** Report Post saves a report in PostgreSQL. Admin/moderator review queue is available at `/admin`.
- **Notifications:** the Notifications page reads persisted `notifications` rows and marks items read when opened. Existing engagement routes create some notification types; the database currently supports like/follow/retweet/reply/mention.
- **Messages:** Messages now uses the `direct_messages` table and lets you start a thread by entering another user's exact username.
- **Hourly/daily trending:** Explore reads PostgreSQL hashtag activity from the last hour or last 24 hours. New posts containing hashtags feed this ranking.
- **Polls:** the composer can create a 24-hour poll with 2–4 unique options; votes are stored in `poll_votes` and each user can vote once.
- **Images:** the composer accepts an HTTPS image URL and saves it in `tweet_media`. This is URL-based media, not a local file uploader; use a trusted image host for the demo.
- **Emojis:** emoji characters can be typed directly or inserted using the composer emoji button.

### 4. New API routes

All routes below are under `/api` and require a valid bearer token unless otherwise stated:

- `GET /trending` — `hourly` and `daily` rankings.
- `PATCH /tweets/:id` and `GET /tweets/:id/edits` — edit post and read edit history.
- `POST /reports`, `GET /admin/reports`, `PATCH /admin/reports/:id` — reporting/moderation.
- `GET /messages`, `GET /messages?with=<user UUID>`, `POST /messages`, `GET /people?q=<username>` — direct messaging.
- `POST /tweets/:id/poll`, `GET /tweets/:id/poll`, `POST /polls/:pollId/vote` — polls.
- `POST /tweets/:id/media` — attach an HTTPS media URL.
- `GET /notifications`, `PATCH /notifications/:id/read` — notification inbox/read status.
- `GET /me/role`, `GET /admin/users`, `PATCH /admin/users/:id/role`, `PATCH /admin/users/:id/status` — role/admin operations.

### 5. Run the app

Terminal 1:

```bash
cd backend
npm install
npm run dev
```

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Use the existing local `.env` values for PostgreSQL, Redis/Memurai, and a long random `JWT_SECRET`. Confirm `http://localhost:5000/api/health` returns `{ "ok": true }` before testing features.

### 6. Demo checklist

1. Create posts with `#DBMS` and `#Chirp`; show Explore → Hourly/Daily.
2. Edit one post twice; show the Edited badge and edit history; verify `edit_count` in pgAdmin.
3. Report a post, open `/admin`, and move the report to `reviewed` or `resolved`.
4. Open `/messages`, start a thread with another registered username, and send a message; verify `direct_messages` in pgAdmin.
5. Create a poll, vote once, and verify `poll_votes` in pgAdmin.
6. Attach an HTTPS image URL and verify `tweet_media`.
7. Show `users.role` and demonstrate PostgreSQL `GRANT`/`REVOKE` separately for DCL.

### Notes / limitations

- The app was not run against your local PostgreSQL instance in this environment. Apply the migration and test the checklist locally before presenting.
- Images use HTTPS URLs; binary uploads, resizing, and storage are not included.
- Live push notifications are not wired into the React UI yet; the inbox is database-backed and the existing Socket.IO server is available as a later enhancement.
- Trending is based on post counts in the last hour/24 hours. It is a clear demo baseline, not a production trend-detection algorithm.
