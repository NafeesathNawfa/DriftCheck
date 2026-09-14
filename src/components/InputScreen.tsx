import { biomarkers, type BiomarkerId } from '../data/biomarkers';
import type { DemoStoryId } from '../lib/demoStories';

interface InputScreenProps {
  biomarkerId: BiomarkerId;
  past: string[];
  latest: string;
  onBiomarkerChange: (id: BiomarkerId) => void;
  onStorySelect: (id: DemoStoryId) => void;
  onPastChange: (index: number, value: string) => void;
  onLatestChange: (value: string) => void;
  onRunCheck: () => void;
}

export function InputScreen({
  biomarkerId,
  past,
  latest,
  onBiomarkerChange,
  onStorySelect,
  onPastChange,
  onLatestChange,
  onRunCheck,
}: InputScreenProps) {
  const meta = biomarkers[biomarkerId];
  const pastValid = past.length === 4 && past.every((v) => Number.isFinite(Number(v)) && v.trim() !== '');
  const latestValid = latest.trim() !== '' && Number.isFinite(Number(latest));

  return (
    <>
      <div className="card">
        <h2>Pick a biomarker, then add your values</h2>
        <p className="sub">
          One tap on a story loads realistic past results — you can edit any number afterwards.
        </p>

        <div className="chipGrid">
          {(Object.keys(biomarkers) as BiomarkerId[]).map((id) => {
            const b = biomarkers[id];
            const active = id === biomarkerId;
            return (
              <button
                key={id}
                type="button"
                className={`chip ${active ? 'active' : ''}`}
                onClick={() => {
                  onBiomarkerChange(id);
                  onStorySelect(id);
                }}
              >
                <div className="name">{b.name}</div>
                <div className="meta">{b.storyLabel}</div>
                <div className="range">
                  Normal {b.popMin}–{b.popMax} {b.unit}
                </div>
              </button>
            );
          })}
        </div>

        <div className="fields">
          <div className="field">
            <label>Past 4</label>
            <input
              type="number"
              inputMode="decimal"
              step={meta.decimals === 2 ? 0.01 : 0.1}
              min="0"
              value={past[0] ?? ''}
              onChange={(e) => onPastChange(0, e.target.value)}
            />
          </div>
          <div className="field">
            <label>Past 3</label>
            <input
              type="number"
              inputMode="decimal"
              step={meta.decimals === 2 ? 0.01 : 0.1}
              min="0"
              value={past[1] ?? ''}
              onChange={(e) => onPastChange(1, e.target.value)}
            />
          </div>
          <div className="field">
            <label>Past 2</label>
            <input
              type="number"
              inputMode="decimal"
              step={meta.decimals === 2 ? 0.01 : 0.1}
              min="0"
              value={past[2] ?? ''}
              onChange={(e) => onPastChange(2, e.target.value)}
            />
          </div>
          <div className="field">
            <label>Last check</label>
            <input
              type="number"
              inputMode="decimal"
              step={meta.decimals === 2 ? 0.01 : 0.1}
              min="0"
              value={past[3] ?? ''}
              onChange={(e) => onPastChange(3, e.target.value)}
            />
          </div>
          <div className="field">
            <label>
              New result <span className="hint">({meta.unit})</span>
            </label>
            <input
              type="number"
              inputMode="decimal"
              step={meta.decimals === 2 ? 0.01 : 0.1}
              min="0"
              value={latest}
              onChange={(e) => onLatestChange(e.target.value)}
            />
          </div>
        </div>

        <p className="zeros">
          DriftCheck compares this new result to <em>your personal range</em> — the mean ± spread of
          your own last 4 checks — never just the population reference.
        </p>

        <div className="row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!pastValid || !latestValid}
            onClick={onRunCheck}
          >
            {`Check ${meta.name}`}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onStorySelect(biomarkerId)}
          >
            Reload demo story
          </button>
        </div>
      </div>
    </>
  );
}