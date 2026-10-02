import express, { type ErrorRequestHandler } from 'express';
import sharp from 'sharp';
import { z } from 'zod';
import { resolve } from 'node:path';
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from '../shared/analysis.js';
import { isLoopback, type Config } from './config.js';
import { analyzeImage, ApiError, modelStatus, type Fetch } from './ollama.js';

const requestSchema = z.object({
  image: z
    .string()
    .min(1)
    .max(Math.ceil(MAX_IMAGE_BYTES / 3) * 4)
    .refine((value) => value.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(value)),
  mime: z.enum(IMAGE_TYPES),
  language: z.enum(['en', 'si']),
  mode: z.enum(['simple', 'detailed']),
});

export function createApp(config: Config, upstream: Fetch = fetch, staticDir?: string) {
  const app = express();
  let active = false;
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'no-store',
      'Content-Security-Policy':
        "default-src 'self'; img-src 'self' blob: data:; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
    });
    try {
      const host = new URL(`http://${req.headers.host ?? ''}`);
      if (!isLoopback(host.hostname)) throw new Error('Host');
      if (req.headers.origin) {
        const origin = new URL(req.headers.origin);
        const allowedPorts = new Set([String(config.port), '5173']);
        if (
          !isLoopback(origin.hostname) ||
          origin.protocol !== 'http:' ||
          !allowedPorts.has(origin.port)
        )
          throw new Error('Origin');
      }
      if (req.headers['sec-fetch-site'] === 'cross-site') throw new Error('Cross-site');
      next();
    } catch {
      res.status(403).json({ error: 'Only requests from the local NextCueAI app are allowed.' });
    }
  });
  app.use('/api', express.json({ limit: '14mb' }));
  app.get('/api/status', async (_req, res) => {
    res.json(await modelStatus(config, upstream));
  });
  app.post('/api/analyze', async (req, res, next) => {
    if (active) {
      res
        .status(429)
        .json({ error: 'Another screenshot is being analyzed. Wait a moment and retry.' });
      return;
    }
    active = true;
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(config.timeoutMs)]);
    const onClose = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.on('close', onClose);
    try {
      const data = requestSchema.safeParse(req.body);
      if (!data.success)
        throw new ApiError(
          400,
          'Choose a valid PNG, JPG, or WebP image under 10 MB, and a supported language and mode.',
        );
      const { image, mime, language, mode } = data.data;
      const bytes = Buffer.from(image, 'base64');
      if (bytes.length > MAX_IMAGE_BYTES)
        throw new ApiError(413, 'Choose an image smaller than 10 MB.');
      let normalized: Buffer;
      try {
        const input = sharp(bytes, {
          limitInputPixels: 25000000,
          failOn: 'warning',
          animated: false,
        });
        const info = await input.metadata();
        const expected = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' }[mime];
        if (info.format !== expected || (info.pages ?? 1) > 1) throw new Error('Invalid image');
        normalized = await input
          .rotate()
          .resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer();
      } catch {
        throw new ApiError(
          400,
          'This image is damaged, too large in dimensions, animated, or does not match its file type. Export a still PNG, JPG, or WebP and retry.',
        );
      }
      const result = await analyzeImage(
        config,
        upstream,
        normalized.toString('base64'),
        language,
        mode,
        signal,
      );
      if (!res.destroyed) res.json(result);
    } catch (error) {
      next(error);
    } finally {
      active = false;
      res.off('close', onClose);
    }
  });
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'This API route does not exist.' });
  });
  if (staticDir) {
    app.use(express.static(staticDir));
    app.get('/', (_req, res) => {
      res.sendFile(resolve(staticDir, 'index.html'));
    });
  }
  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    if (res.headersSent || res.destroyed) return;
    if (error instanceof ApiError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    const known = error as { type?: string };
    if (known.type === 'entity.too.large') {
      res.status(413).json({ error: 'Choose an image smaller than 10 MB.' });
      return;
    }
    if (known.type === 'entity.parse.failed') {
      res
        .status(400)
        .json({ error: 'The request could not be read. Choose your screenshot again.' });
      return;
    }
    res.status(500).json({ error: 'Something went wrong. Please retry your screenshot.' });
  };
  app.use(errorHandler);
  return app;
}
