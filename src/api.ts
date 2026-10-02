import { analysisSchema, type Language, type Mode, type ModelStatus } from '../shared/analysis';

export async function getStatus(signal?: AbortSignal): Promise<ModelStatus> {
  const response = await fetch('/api/status', { signal: signal ?? AbortSignal.timeout(8000) });
  if (!response.ok)
    throw new Error('The local bridge is not responding. Restart NextCueAI and check again.');
  return response.json();
}

export async function analyze(
  image: string,
  mime: string,
  language: Language,
  mode: Mode,
  signal: AbortSignal,
) {
  let response: Response;
  try {
    response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, mime, language, mode }),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error('Cannot reach the local bridge. Restart NextCueAI, then retry.', {
      cause: error,
    });
  }
  const data = await response.json().catch(() => {
    throw new Error('The local bridge returned an unreadable response. Restart it and retry.');
  });
  if (!response.ok)
    throw new Error(typeof data.error === 'string' ? data.error : 'Analysis failed. Please retry.');
  const parsed = analysisSchema.safeParse(data);
  if (!parsed.success) throw new Error('The model did not return a usable response. Please retry.');
  return parsed.data;
}

export function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('This image could not be opened. Choose it again.'));
    reader.readAsDataURL(file);
  });
}
