import { z } from 'zod';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type Language = 'en' | 'si';
export type Mode = 'simple' | 'detailed';

const text = z.string().trim().min(1).max(6000);
export const analysisSchema = z.object({
  summary: text,
  problem: text,
  nextAction: text,
  steps: z.array(text).min(1).max(8),
  caution: z.string().trim().max(6000),
  confidence: z.enum(['high', 'medium', 'low']),
});
export type Analysis = z.infer<typeof analysisSchema>;
export function analysisSchemaForMode(mode: Mode) {
  return mode === 'simple'
    ? analysisSchema.extend({ steps: z.array(text).min(1).max(4) })
    : analysisSchema;
}

export function parseAnalysis(raw: string, mode: Mode = 'detailed'): Analysis {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, '$1');
  return analysisSchemaForMode(mode).parse(JSON.parse(cleaned));
}

export function validateFile(file: { type: string; size: number }): string | null {
  if (!IMAGE_TYPES.includes(file.type as (typeof IMAGE_TYPES)[number]))
    return 'Choose a PNG, JPG, or WebP image.';
  if (file.size === 0) return 'That image is empty. Choose another screenshot.';
  if (file.size > MAX_IMAGE_BYTES) return 'Choose an image smaller than 10 MB.';
  return null;
}

export const resultLabels = {
  en: {
    summary: 'What you are seeing',
    problem: 'What may be happening',
    nextAction: 'Your next step',
    steps: 'Step by step',
    caution: 'Keep in mind',
  },
  si: {
    summary: 'තිරයේ පෙනෙන දේ',
    problem: 'සිදුවී තිබිය හැකි දේ',
    nextAction: 'ඊළඟට කළ යුතු දේ',
    steps: 'පියවරෙන් පියවර',
    caution: 'සැලකිල්ලට ගන්න',
  },
};

export function formatAnalysis(analysis: Analysis, language: Language): string {
  const labels = resultLabels[language];
  return [
    labels.summary,
    analysis.summary,
    '',
    labels.problem,
    analysis.problem,
    '',
    labels.nextAction,
    analysis.nextAction,
    '',
    labels.steps,
    ...analysis.steps.map((step, i) => `${i + 1}. ${step}`),
    ...(analysis.caution ? ['', labels.caution, analysis.caution] : []),
  ].join('\n');
}

export type ModelStatus = {
  state: 'ready' | 'offline' | 'missing' | 'unsupported' | 'remote';
  model: string;
  message: string;
};
