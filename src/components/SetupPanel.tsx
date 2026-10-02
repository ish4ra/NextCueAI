import { ExternalLink, RefreshCw, Terminal } from 'lucide-react';
import type { ModelStatus } from '../../shared/analysis';
export function SetupPanel({
  status,
  checking,
  onCheck,
}: {
  status: ModelStatus | null;
  checking: boolean;
  onCheck: () => void;
}) {
  const needsLocalModel = status?.state === 'unsupported' || status?.state === 'remote';
  const model = needsLocalModel ? 'gemma4:e2b' : status?.model || 'gemma4:e2b';
  return (
    <section className="setup-panel" id="setup-panel" aria-labelledby="setup-title" tabIndex={-1}>
      <div className="setup-intro">
        <Terminal size={21} aria-hidden="true" />
        <div>
          <h2 id="setup-title">A little setup. Then it stays local.</h2>
          <p role="status">{status?.message ?? 'Checking your local Ollama connection…'}</p>
        </div>
        <button className="button secondary" onClick={onCheck} disabled={checking}>
          <RefreshCw size={15} className={checking ? 'spin' : ''} aria-hidden="true" />
          {checking ? 'Checking…' : 'Check again'}
        </button>
      </div>
      <ol className="setup-steps">
        <li>
          <strong>Install Ollama</strong>
          <p>Get the latest version and open it.</p>
          <a href="https://ollama.com/download" target="_blank" rel="noreferrer">
            Download Ollama <ExternalLink size={13} aria-hidden="true" />
          </a>
        </li>
        <li>
          <strong>Download the vision model</strong>
          <p>Run this once in your terminal.</p>
          <code>ollama pull {model}</code>
          {needsLocalModel && (
            <p>
              Then set <code>OLLAMA_MODEL=gemma4:e2b</code> in .env and restart NextCueAI.
            </p>
          )}
        </li>
        <li>
          <strong>Keep Ollama running</strong>
          <p>The desktop app runs it for you. On Linux:</p>
          <code>ollama serve</code>
        </li>
      </ol>
      <p className="setup-footnote">
        The model download needs several GB of disk space. Analysis speed depends on your hardware.
        To change the model or local endpoint, edit <code>.env</code> and restart NextCueAI.
      </p>
    </section>
  );
}
