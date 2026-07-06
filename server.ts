import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { getDb } from './src/db/index.ts';
import { users, provinceCustomizations } from './src/db/schema.ts';
import { eq } from 'drizzle-orm';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON bodies
  app.use(express.json({ limit: '10mb' }));

  // API endpoints FIRST

  // Auth Sync endpoint
  app.post('/api/auth/sync', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const userId = decodedToken.uid;
      const email = decodedToken.email || '';

      const db = getDb();
      // Check if user already exists
      const existing = await db.select().from(users).where(eq(users.id, userId)).limit(1);

      if (existing.length === 0) {
        await db.insert(users).values({
          id: userId,
          email: email,
        });
        console.log(`Created new Cloud SQL user record: ${userId} (${email})`);
      }

      res.json({ success: true, user: { id: userId, email } });
    } catch (err: any) {
      console.error('Error syncing auth with Cloud SQL:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get Customizations endpoint
  app.get('/api/customizations', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const userId = decodedToken.uid;

      const db = getDb();
      const list = await db
        .select()
        .from(provinceCustomizations)
        .where(eq(provinceCustomizations.userId, userId));

      res.json(list);
    } catch (err: any) {
      console.error('Error fetching customizations from Cloud SQL:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Save Customization endpoint
  app.post('/api/customizations', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      const userId = decodedToken.uid;
      const { provinceId, customData } = req.body;

      if (!provinceId || !customData) {
        res.status(400).json({ error: 'Missing provinceId or customData' });
        return;
      }

      const db = getDb();
      const customizationId = `${userId}_${provinceId}`;

      const existing = await db
        .select()
        .from(provinceCustomizations)
        .where(eq(provinceCustomizations.id, customizationId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(provinceCustomizations)
          .set({
            customData: customData,
            updatedAt: new Date(),
          })
          .where(eq(provinceCustomizations.id, customizationId));
      } else {
        await db.insert(provinceCustomizations).values({
          id: customizationId,
          userId: userId,
          provinceId: provinceId,
          customData: customData,
        });
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('Error saving customization to Cloud SQL:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
