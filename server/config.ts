import { z } from 'zod';

export const isLoopback = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host);
const configSchema = z.object({
  baseUrl: z
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (
        url.protocol === 'http:' &&
        isLoopback(url.hostname) &&
        !url.username &&
        !url.password &&
        url.pathname === '/' &&
        !url.search &&
        !url.hash
      );
    }, 'Ollama must use a loopback HTTP URL without credentials or a path.')
    .transform((value) => new URL(value).origin),
  model: z
    .string()
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/)
    .max(150)
    .refine(
      (value) => !value.toLowerCase().includes('cloud'),
      'Use a local model, not a cloud model.',
    ),
  port: z.coerce.number().int().min(1024).max(65535),
  timeoutMs: z.coerce.number().int().min(1000).max(600000),
});
export type Config = z.infer<typeof configSchema>;
export function readConfig(env: NodeJS.ProcessEnv): Config {
  return configSchema.parse({
    baseUrl: env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434',
    model: env.OLLAMA_MODEL ?? 'gemma4:e2b',
    port: env.PORT ?? 3001,
    timeoutMs: env.OLLAMA_TIMEOUT_MS ?? 180000,
  });
}
