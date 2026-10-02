import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  Code2,
  Globe2,
  LoaderCircle,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  validateFile,
  type Analysis,
  type Language,
  type Mode,
  type ModelStatus,
} from '../shared/analysis';
import { analyze, getStatus, readImage } from './api';
import { UploadPanel, type Screenshot } from './components/UploadPanel';
import { SetupPanel } from './components/SetupPanel';
import { ResultPanel } from './components/ResultPanel';

export default function App() {
  const [screenshot, setScreenshot] = useState<Screenshot | null>(null);
  const [language, setLanguage] = useState<Language>('en');
  const [mode, setMode] = useState<Mode>('simple');
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [setupOpen, setSetupOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [result, setResult] = useState<{ analysis: Analysis; language: Language } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const selectionVersion = useRef(0);
  const uploadUrl = useRef<string | null>(null);

  const checkStatus = useCallback(async () => {
    try {
      setStatus(await getStatus());
    } catch (err) {
      setStatus({
        state: 'offline',
        model: '',
        message: err instanceof Error ? err.message : 'Cannot reach the local bridge.',
      });
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    const initial = new AbortController();
    void getStatus(AbortSignal.any([initial.signal, AbortSignal.timeout(8000)]))
      .then((value) => {
        if (!initial.signal.aborted) {
          setStatus(value);
          setChecking(false);
        }
      })
      .catch(() => {
        if (!initial.signal.aborted) {
          setStatus({
            state: 'offline',
            model: '',
            message: 'Cannot reach the local bridge. Restart NextCueAI and check again.',
          });
          setChecking(false);
        }
      });
    return () => {
      initial.abort();
      controller.current?.abort();
      if (uploadUrl.current) URL.revokeObjectURL(uploadUrl.current);
    };
  }, []);

  const clear = useCallback(() => {
    selectionVersion.current++;
    controller.current?.abort();
    controller.current = null;
    if (uploadUrl.current) URL.revokeObjectURL(uploadUrl.current);
    uploadUrl.current = null;
    setScreenshot(null);
    setResult(null);
    setError('');
    setRetry(false);
    setBusy(false);
    setReading(false);
    setAnnouncement('Workspace cleared. Choose another screenshot.');
  }, []);

  const selectImage = useCallback(async (file: File) => {
    if (controller.current) return;
    const problem = validateFile(file);
    if (problem) {
      setError(problem);
      setRetry(false);
      return;
    }
    const version = ++selectionVersion.current;
    setReading(true);
    setError('');
    setRetry(false);
    setResult(null);
    let url: string | null = null;
    try {
      const data = await readImage(file);
      url = URL.createObjectURL(file);
      const image = new Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth * image.naturalHeight > 25000000)
        throw new Error(
          'Choose a screenshot under 25 megapixels. Crop the area you need help with.',
        );
      if (version !== selectionVersion.current) {
        URL.revokeObjectURL(url);
        return;
      }
      if (uploadUrl.current) URL.revokeObjectURL(uploadUrl.current);
      uploadUrl.current = url;
      setScreenshot({ file, url, data });
      setAnnouncement('Screenshot ready to analyze.');
    } catch (err) {
      if (url) URL.revokeObjectURL(url);
      if (version === selectionVersion.current)
        setError(
          err instanceof Error && err.message.includes('megapixels')
            ? err.message
            : 'This image could not be opened. Export a still PNG, JPG, or WebP and try again.',
        );
    } finally {
      if (version === selectionVersion.current) setReading(false);
    }
  }, []);

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const item = Array.from(event.clipboardData?.items ?? []).find((item) =>
        item.type.startsWith('image/'),
      );
      const file = item?.getAsFile();
      if (file) {
        event.preventDefault();
        void selectImage(file);
      }
    };
    window.addEventListener('paste', onPaste);
    const preventDrop = (event: DragEvent) => {
      event.preventDefault();
    };
    window.addEventListener('dragover', preventDrop);
    window.addEventListener('drop', preventDrop);
    return () => {
      window.removeEventListener('paste', onPaste);
      window.removeEventListener('dragover', preventDrop);
      window.removeEventListener('drop', preventDrop);
    };
  }, [selectImage]);

  async function runAnalysis() {
    if (!screenshot || controller.current || reading) return;
    const current = new AbortController();
    controller.current = current;
    setBusy(true);
    setError('');
    setRetry(false);
    setResult(null);
    setAnnouncement('Analyzing your screenshot locally.');
    try {
      const analysis = await analyze(
        screenshot.data,
        screenshot.file.type,
        language,
        mode,
        current.signal,
      );
      if (!current.signal.aborted) {
        setResult({ analysis, language });
        setAnnouncement('Analysis complete. Your next cue is ready below.');
      }
    } catch (err) {
      if (!current.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Analysis failed. Please retry.');
        setRetry(true);
        void checkStatus();
      }
    } finally {
      if (controller.current === current) {
        setBusy(false);
        controller.current = null;
      }
    }
  }
  function cancel() {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setAnnouncement('Analysis cancelled. Your screenshot is still ready.');
  }
  const ready = status?.state === 'ready';
  return (
    <>
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <header className="site-header">
        <a className="brand" href="/" aria-label="NextCueAI home">
          <img src="/icon.svg" alt="" width="34" height="34" />
          <span>
            NextCue<span className="brand-ai">AI</span>
          </span>
        </a>
        <nav aria-label="App links">
          <button
            className={`status-button ${ready ? 'ready' : ''}`}
            aria-expanded={setupOpen}
            aria-controls="setup-panel"
            onClick={() => setSetupOpen(!setupOpen)}
          >
            <span className="status-dot" />
            {checking ? 'Checking local AI' : ready ? 'Local AI ready' : 'Setup needed'}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          <a
            className="github-link"
            href="https://github.com/ish4ra/NextCueAI"
            target="_blank"
            rel="noreferrer"
            aria-label="NextCueAI on GitHub"
          >
            <Code2 size={20} />
          </a>
        </nav>
      </header>
      <main>
        <section className="intro">
          <div>
            <div className="kicker">
              <span /> A LITTLE CLARITY GOES A LONG WAY
            </div>
            <h1>
              See the problem.
              <br />
              <span>Know what to do next.</span>
            </h1>
            <p>
              Turn a confusing screenshot into clear, practical guidance.
              <br className="desktop-break" /> In your language. At your pace. On your computer.
            </p>
          </div>
          <div className="intro-note">
            <div className="cue-mark" aria-hidden="true">
              <span />
              <ArrowRight size={35} />
              <span />
            </div>
            <p>
              A second pair of eyes.
              <br />
              <strong>A simpler next step.</strong>
            </p>
          </div>
        </section>
        {setupOpen && (
          <SetupPanel
            status={status}
            checking={checking}
            onCheck={() => {
              setChecking(true);
              void checkStatus();
            }}
          />
        )}
        <div className="workspace-heading">
          <div>
            <span className="workspace-dot" />
            SCREENSHOT WORKSPACE
          </div>
          {screenshot && (
            <button className="button text-button" onClick={clear}>
              <RotateCcw size={14} aria-hidden="true" />
              Start over
            </button>
          )}
        </div>
        <div id="workspace" className="workspace" tabIndex={-1}>
          <UploadPanel
            screenshot={screenshot}
            onSelect={(file) => {
              void selectImage(file);
            }}
            onRemove={clear}
            busy={busy || reading}
          />
          <section className="panel controls-panel" aria-labelledby="controls-title">
            <div className="panel-heading">
              <h2 id="controls-title">
                <span className="section-number">02</span> Make it clear
              </h2>
              <SlidersHorizontal size={17} aria-hidden="true" />
            </div>
            <div className="controls-content">
              <label className="field-label" htmlFor="language">
                <Globe2 size={16} aria-hidden="true" />
                Response language
              </label>
              <div className="select-wrap">
                <select
                  id="language"
                  value={language}
                  disabled={busy}
                  onChange={(e) => setLanguage(e.target.value as Language)}
                >
                  <option value="en">English</option>
                  <option value="si">සිංහල · Sinhala</option>
                </select>
                <ChevronDown size={16} aria-hidden="true" />
              </div>
              <fieldset disabled={busy}>
                <legend>How much detail?</legend>
                <div className="mode-options">
                  <label className={mode === 'simple' ? 'selected' : ''}>
                    <input
                      type="radio"
                      name="mode"
                      value="simple"
                      checked={mode === 'simple'}
                      onChange={() => setMode('simple')}
                    />
                    <span>
                      <strong>Simple</strong>
                      <small>Just the essentials</small>
                    </span>
                    {mode === 'simple' && <Check size={16} aria-hidden="true" />}
                  </label>
                  <label className={mode === 'detailed' ? 'selected' : ''}>
                    <input
                      type="radio"
                      name="mode"
                      value="detailed"
                      checked={mode === 'detailed'}
                      onChange={() => setMode('detailed')}
                    />
                    <span>
                      <strong>Detailed</strong>
                      <small>A little more context</small>
                    </span>
                    {mode === 'detailed' && <Check size={16} aria-hidden="true" />}
                  </label>
                </div>
              </fieldset>
              <div className="analysis-actions">
                {busy ? (
                  <>
                    <button className="button primary analyze-button" disabled>
                      <LoaderCircle size={17} className="spin" aria-hidden="true" />
                      Analyzing locally…
                    </button>
                    <button className="button text-button cancel-button" onClick={cancel}>
                      <X size={14} aria-hidden="true" />
                      Cancel analysis
                    </button>
                  </>
                ) : (
                  <button
                    className="button primary analyze-button"
                    disabled={!screenshot || reading || !ready}
                    onClick={() => {
                      void runAnalysis();
                    }}
                  >
                    {reading ? 'Opening image…' : retry ? 'Retry analysis' : 'Analyze screenshot'}
                    <ArrowRight size={17} aria-hidden="true" />
                  </button>
                )}
                {!ready && !checking && (
                  <button
                    className="setup-link"
                    onClick={() => {
                      setSetupOpen(true);
                      requestAnimationFrame(() => document.getElementById('setup-panel')?.focus());
                    }}
                  >
                    Connect local AI to get started <ArrowRight size={13} aria-hidden="true" />
                  </button>
                )}
                <p className="privacy-note">
                  <ShieldCheck size={16} aria-hidden="true" />
                  Your screenshots can stay on your computer.
                </p>
              </div>
            </div>
          </section>
        </div>
        {error && (
          <div className="error-message" role="alert">
            <InfoIcon />
            <div>
              <strong>Let’s try that again</strong>
              <p>{error}</p>
            </div>
            <button className="icon-button" aria-label="Dismiss error" onClick={() => setError('')}>
              <X size={18} />
            </button>
          </div>
        )}
        <div className="sr-only" role="status" aria-live="polite">
          {announcement}
        </div>
        <ResultPanel key={result ? 'result' : 'empty'} result={result} busy={busy} />
        <div className="below-workspace">
          <div>
            <ShieldCheck size={17} aria-hidden="true" />
            <span>No uploads to a cloud AI. No screenshot history.</span>
          </div>
          <p>Crop out private details before sharing a screenshot.</p>
        </div>
      </main>
      <footer>
        <span>
          NextCueAI <span className="footer-divider">/</span> Open source. Local by design.
        </span>
        <a href="https://github.com/ish4ra/NextCueAI#readme" target="_blank" rel="noreferrer">
          Setup & documentation <ArrowRight size={13} aria-hidden="true" />
        </a>
      </footer>
    </>
  );
}
function InfoIcon() {
  return (
    <span className="error-icon" aria-hidden="true">
      !
    </span>
  );
}
