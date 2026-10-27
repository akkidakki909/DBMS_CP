# Chirp TODO Fixes — implementation notes

This patch addresses the first pass of the reported issues:

- Admin reports now include the reported tweet's content, author, and timestamp when the tweet still exists.
- Post likes and reposts call the backend and update UI state only after a successful response.
- Bookmarks have a PostgreSQL table and authenticated GET/POST/DELETE endpoints; the Bookmarks page loads persisted bookmarks.
- Post detail uses the UUID-backed API thread instead of mock numeric IDs, and replies are saved as tweets with `parentTweetId`.
- Explore search queries the backend/PostgreSQL instead of mock posts.
- Explore people-to-follow comes from the backend and Follow/Unfollow calls the existing endpoints.
- Profile page no longer relies on mock-only post IDs and handles missing profile data without rendering a blank screen.
- Composer has a multi-emoji picker and image preview/error hint.
- Share copies the post URL.

## Apply the database migration

From `DBMS_CP/backend`, run:

```bat
npm run migrate-future
```

This migration is intended to be re-runnable and adds the `bookmarks` table to migration 003. Do not rerun `001_init.sql` against an existing database.

## Important verification notes

- Backend JavaScript syntax checks passed in the patch workspace.
- A frontend production build could not be verified in this environment because the archived `node_modules` lacked the platform-specific Vite/Rolldown native binding. Run `npm install` in `frontend` on the Windows machine, then `npm run build`.
- Image URLs must be direct, reachable HTTPS image URLs. This patch previews image URLs and reports a load error; it does not implement binary file hosting.
- Bookmark folders are still presentation-only collections from the demo data. The main All Bookmarks view is database-backed; per-folder persistent membership remains a follow-up item.
- Poll voting and messaging endpoints already existed; test them after applying migration 003. This patch improves the messaging recipient lookup through `/people` but does not add real-time delivery.
