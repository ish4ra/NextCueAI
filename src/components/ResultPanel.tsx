import { useRef, useState } from 'react';
import { ArrowRight, Check, Copy, Info, ScanLine } from 'lucide-react';
import { formatAnalysis, resultLabels, type Analysis, type Language } from '../../shared/analysis';

type Props = { result: { analysis: Analysis; language: Language } | null; busy: boolean };
export function ResultPanel({ result, busy }: Props) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const output = useRef<HTMLDivElement>(null);
  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(formatAnalysis(result.analysis, result.language));
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopied(false);
      setCopyError(true);
      const range = document.createRange();
      if (output.current) {
        range.selectNodeContents(output.current);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    }
  }
  if (!result)
    return (
      <section className="panel result-empty" aria-label="Screenshot guidance" aria-busy={busy}>
        <div className={`result-icon ${busy ? 'working' : ''}`}>
          <ScanLine size={25} aria-hidden="true" />
        </div>
        <h2>{busy ? 'Looking for your next step…' : 'A clearer picture, a useful next step.'}</h2>
        <p>
          {busy
            ? 'Your local model is reading the screenshot. The first analysis may take longer while the model loads.'
            : 'Add a screenshot and we’ll help you make sense of it, one step at a time.'}
        </p>
        <div className="result-outline">
          <span>Understand the screen</span>
          <ArrowRight size={14} aria-hidden="true" />
          <span>Find your next action</span>
        </div>
        {busy && <span className="loading-bar" aria-hidden="true" />}
      </section>
    );
  const { analysis, language } = result;
  const labels = resultLabels[language];
  return (
    <section className="panel result-panel" aria-labelledby="result-title">
      <div className="panel-heading">
        <h2 id="result-title">
          <span className="section-number">03</span> Your next cue
        </h2>
        <button
          className="button text-button"
          onClick={() => {
            void copy();
          }}
        >
          {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy response'}
        </button>
      </div>
      {copyError && (
        <p className="copy-notice" role="status">
          Clipboard access is unavailable. The response is selected; press Ctrl+C or ⌘C to copy.
        </p>
      )}
      <div ref={output} className="result-content" lang={language}>
        <div className="observation-grid">
          <div>
            <h3>{labels.summary}</h3>
            <p>{analysis.summary}</p>
          </div>
          <div>
            <h3>{labels.problem}</h3>
            <p>{analysis.problem}</p>
          </div>
        </div>
        <div className="next-action">
          <ArrowRight size={22} aria-hidden="true" />
          <div>
            <h3>{labels.nextAction}</h3>
            <p>{analysis.nextAction}</p>
          </div>
        </div>
        <h3 className="steps-title">{labels.steps}</h3>
        <ol className="action-steps">
          {analysis.steps.map((step, i) => (
            <li key={i}>
              <span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
        {analysis.caution && (
          <div className="caution">
            <Info size={18} aria-hidden="true" />
            <div>
              <h3>{labels.caution}</h3>
              <p>{analysis.caution}</p>
            </div>
          </div>
        )}
      </div>
      <p className="result-disclaimer">
        AI can miss details. Verify important actions before following them.
      </p>
    </section>
  );
}
