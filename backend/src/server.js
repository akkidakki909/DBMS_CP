import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

import authRoutes from './routes/auth.js';
import tweetRoutes from './routes/tweets.js';
import feedRoutes from './routes/feed.js';
import followRoutes from './routes/follows.js';
import engagementRoutes from './routes/engagement.js';
import searchRoutes from './routes/search.js';
import analyticsRoutes from './routes/analytics.js';
import futureScopeRoutes from './routes/futureScope.js';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/tweets', tweetRoutes);
app.use('/api/feed', feedRoutes);
app.use('/api/follows', followRoutes);
app.use('/api', engagementRoutes);       // /api/likes/:id, /api/retweets/:id
app.use('/api/search', searchRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api', futureScopeRoutes); // roles, moderation, edit history, polls, messages, media, trends

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const httpServer = createServer(app);
export const io = new Server(httpServer, { cors: { origin: process.env.CLIENT_ORIGIN || '*' } });

io.on('connection', (socket) => {
  // client should emit 'identify' with their userId right after connecting
  socket.on('identify', (userId) => socket.join(`user:${userId}`));
});

// Helper other route files can import to push a live event, e.g.:
//   import { io } from '../server.js'; io.to(`user:${recipientId}`).emit('notification', payload);

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`Chirp API listening on :${PORT}`));
