import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
import { createApp } from '../server/app.js';
import { readConfig } from '../server/config.js';

const config = {
  baseUrl: 'http://127.0.0.1:11434',
  model: 'gemma4:e2b',
  port: 3001,
  timeoutMs: 5000,
};
const result = {
  summary: 'Settings',
  problem: 'Nothing visibly broken',
  nextAction: 'Read the label',
  steps: ['Check the selected option'],
  caution: '',
  confidence: 'medium',
};
const show = { capabilities: ['completion', 'vision'], details: { family: 'gemma4' } };
const body = async () => ({
  image: (
    await sharp({ create: { width: 10, height: 10, channels: 3, background: '#fff' } })
      .png()
      .toBuffer()
  ).toString('base64'),
  mime: 'image/png',
  language: 'si',
  mode: 'simple',
});
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
afterEach(() => vi.restoreAllMocks());

describe('configuration', () => {
  it('normalizes a trailing slash on the Ollama URL', () => {
    expect(readConfig({ OLLAMA_BASE_URL: 'http://127.0.0.1:11434/' }).baseUrl).toBe(config.baseUrl);
  });
  it('defaults to a local vision model', () =>
    expect(readConfig({})).toEqual({ ...config, timeoutMs: 180000 }));
  it.each([
    { OLLAMA_BASE_URL: 'https://example.com' },
    { OLLAMA_MODEL: 'gemma4:cloud' },
    { PORT: 'no' },
    { OLLAMA_BASE_URL: 'http://user:pass@localhost:11434' },
  ])('rejects unsafe or invalid configuration %o', (env) =>
    expect(() => readConfig(env)).toThrow(),
  );
});

describe('local API', () => {
  it('accepts valid screenshots close to the 10 MB limit', async () => {
    const bytes = await sharp(randomBytes(1800 * 1800 * 3), {
      raw: { width: 1800, height: 1800, channels: 3 },
    })
      .png()
      .toBuffer();
    expect(bytes.length).toBeLessThan(10 * 1024 * 1024);
    const upstream = vi
      .fn()
      .mockResolvedValueOnce(response(show))
      .mockResolvedValueOnce(response({ message: { content: JSON.stringify(result) } }));
    const res = await request(createApp(config, upstream))
      .post('/api/analyze')
      .send({ ...(await body()), image: bytes.toString('base64') });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(result);
  });
  it('reports readiness only for an installed vision model', async () => {
    const app = createApp(config, vi.fn().mockResolvedValue(response(show)));
    const res = await request(app).get('/api/status');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ state: 'ready', model: config.model });
  });
  it.each([
    [404, {}, 'missing'],
    [200, { capabilities: ['completion'] }, 'unsupported'],
    [200, { ...show, remote_model: 'gemma4', remote_host: 'https://ollama.com' }, 'remote'],
  ])('reports model setup state', async (status, data, state) => {
    const res = await request(
      createApp(config, vi.fn().mockResolvedValue(response(data, status as number))),
    ).get('/api/status');
    expect(res.body.state).toBe(state);
  });
  it('gives an offline setup state when Ollama is unreachable', async () => {
    const res = await request(
      createApp(config, vi.fn().mockRejectedValue(new Error('private stack'))),
    ).get('/api/status');
    expect(res.body.state).toBe('offline');
    expect(JSON.stringify(res.body)).not.toContain('private stack');
  });
  it('sends verified image bytes, language, and a JSON schema to Ollama', async () => {
    const upstream = vi
      .fn()
      .mockResolvedValueOnce(response(show))
      .mockResolvedValueOnce(response({ message: { content: JSON.stringify(result) } }));
    const res = await request(createApp(config, upstream))
      .post('/api/analyze')
      .send(await body());
    expect(res.status).toBe(200);
    expect(res.body).toEqual(result);
    const payload = JSON.parse(upstream.mock.calls[1][1].body);
    expect(payload.model).toBe(config.model);
    expect(payload.stream).toBe(false);
    expect(payload.format.required).toContain('nextAction');
    expect(payload.messages[1].images[0]).toBeTruthy();
    expect(payload.messages[0].content).toContain('Sinhala');
  });
  it('rejects malformed image bytes before inference', async () => {
    const upstream = vi.fn();
    const res = await request(createApp(config, upstream))
      .post('/api/analyze')
      .send({ ...(await body()), image: Buffer.from('<svg/>').toString('base64') });
    expect(res.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('rejects mismatched MIME type and invalid language', async () => {
    const app = createApp(config, vi.fn());
    expect(
      (
        await request(app)
          .post('/api/analyze')
          .send({ ...(await body()), mime: 'image/jpeg' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .post('/api/analyze')
          .send({ ...(await body()), language: 'xx' })
      ).status,
    ).toBe(400);
  });
  it('rejects cross-origin requests and DNS rebinding hosts', async () => {
    const app = createApp(config, vi.fn());
    expect(
      (
        await request(app)
          .post('/api/analyze')
          .set('Origin', 'https://attacker.example')
          .send(await body())
      ).status,
    ).toBe(403);
    expect((await request(app).get('/api/status').set('Host', 'attacker.example')).status).toBe(
      403,
    );
  });
  it('returns a useful error for invalid model JSON without leaking it', async () => {
    const upstream = vi
      .fn()
      .mockResolvedValueOnce(response(show))
      .mockResolvedValueOnce(response({ message: { content: 'private malformed content' } }));
    const res = await request(createApp(config, upstream))
      .post('/api/analyze')
      .send(await body());
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/usable response/);
    expect(JSON.stringify(res.body)).not.toContain('private malformed');
  });
});
