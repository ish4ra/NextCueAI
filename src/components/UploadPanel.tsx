import { useRef, useState } from 'react';
import { ImagePlus, ArrowUpRight, RefreshCw, X, ScanLine } from 'lucide-react';

export type Screenshot = { file: File; url: string; data: string };
type Props = {
  screenshot: Screenshot | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  busy: boolean;
};
export function UploadPanel({ screenshot, onSelect, onRemove, busy }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const select = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onSelect(file);
  };
  return (
    <section className="panel screenshot-panel" aria-labelledby="screenshot-title">
      <div className="panel-heading">
        <h2 id="screenshot-title">
          <span className="section-number">01</span> Your screenshot
        </h2>
        <span className="eyebrow">INPUT</span>
      </div>
      <input
        ref={input}
        className="sr-only"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        aria-label="Choose screenshot"
        tabIndex={-1}
        disabled={busy}
        onChange={(e) => {
          select(e.target.files);
          e.target.value = '';
        }}
      />
      <div
        className={`image-stage ${dragging ? 'is-dragging' : ''} ${screenshot ? 'has-image' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!busy) select(e.dataTransfer.files);
        }}
      >
        {screenshot ? (
          <>
            <img className="screenshot" src={screenshot.url} alt="Your selected screenshot" />
            <span className="preview-label">
              <ScanLine size={13} aria-hidden="true" /> Preview
            </span>
          </>
        ) : (
          <div className="empty-upload">
            <div className="upload-symbol">
              <ImagePlus size={31} strokeWidth={1.4} aria-hidden="true" />
            </div>
            <h3>Drop your screenshot here</h3>
            <p>
              A confusing screen. An unexpected error.
              <br />
              Start with what you can see.
            </p>
            <button
              className="button primary"
              onClick={() => input.current?.click()}
              disabled={busy}
            >
              Choose an image <ArrowUpRight size={16} aria-hidden="true" />
            </button>
            <span className="paste-hint">
              or paste an image with <kbd>Ctrl</kbd> + <kbd>V</kbd>{' '}
              <span className="mac-hint">(⌘ V on Mac)</span>
            </span>
          </div>
        )}
      </div>
      <div className="image-footer">
        {screenshot ? (
          <>
            <span className="file-detail">
              <strong title={screenshot.file.name}>{screenshot.file.name}</strong>
              <span>{(screenshot.file.size / 1024 / 1024).toFixed(2)} MB</span>
            </span>
            <div className="file-actions">
              <button
                className="icon-button"
                aria-label="Replace screenshot"
                title="Replace screenshot"
                disabled={busy}
                onClick={() => input.current?.click()}
              >
                <RefreshCw size={17} />
              </button>
              <button
                className="icon-button"
                aria-label="Remove screenshot"
                title="Remove screenshot"
                disabled={busy}
                onClick={onRemove}
              >
                <X size={18} />
              </button>
            </div>
          </>
        ) : (
          <>
            <span>PNG, JPG, or WebP</span>
            <span>Up to 10 MB</span>
          </>
        )}
      </div>
    </section>
  );
}
