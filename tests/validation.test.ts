import { describe, expect, it } from 'vitest';
import { parseAnalysis, validateFile, MAX_IMAGE_BYTES } from '../shared/analysis.js';

const answer = {
  summary: 'A settings page.',
  problem: 'No error is visible.',
  nextAction: 'Review the selected setting.',
  steps: ['Read the label.'],
  caution: '',
  confidence: 'medium',
};

describe('model response validation', () => {
  it('accepts complete JSON and a single JSON fence', () => {
    expect(parseAnalysis(JSON.stringify(answer))).toEqual(answer);
    expect(parseAnalysis('```json\n' + JSON.stringify(answer) + '\n```')).toEqual(answer);
  });
  it.each([
    'not json',
    '{}',
    JSON.stringify({ ...answer, steps: [] }),
    JSON.stringify({ ...answer, confidence: 'certain' }),
    JSON.stringify({ ...answer, summary: ' ' }),
  ])('rejects unusable output: %s', (raw) => {
    expect(() => parseAnalysis(raw)).toThrow();
  });
});

describe('file validation', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp'])('accepts supported %s files', (type) => {
    expect(validateFile({ type, size: 2048 })).toBeNull();
  });
  it('rejects SVG, empty files, and oversized files', () => {
    expect(validateFile({ type: 'image/svg+xml', size: 100 })).toMatch(/PNG/);
    expect(validateFile({ type: 'image/png', size: 0 })).toMatch(/empty/);
    expect(validateFile({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toMatch(/10 MB/);
  });
});
