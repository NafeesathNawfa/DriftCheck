import { describeResult, type CheckDriftResult } from '../lib/checkDrift';
import type { BiomarkerMeta } from '../data/biomarkers';
import { TrendChart } from './TrendChart';

interface ResultScreenProps {
  biomarker: BiomarkerMeta;
  past: number[];
  latest: number;
  result: CheckDriftResult;
  onRunAnother: () => void;
  onChooseStory: () => void;
}

const accentMap: Record<string, { cls: string; color: string }> = {
  good: { cls: 'flag-good', color: '#15803d' },
  warn: { cls: 'flag-warn', color: '#b45309' },
  bad: { cls: 'flag-bad', color: '#b91c1c' },
};

export function ResultScreen({
  biomarker,
  past,
  latest,
  result,
  onRunAnother,
  onChooseStory,
}: ResultScreenProps) {
  const desc = describeResult(result, {
    label: biomarker.name,
    unit: biomarker.unit,
    concern: biomarker.concern,
  });
  const accent = accentMap[desc.accent];

  return (
    <>
      <section className={`flag ${accent.cls}`}>
        <h2>{desc.title}</h2>
        <p>{desc.short}</p>
      </section>

      <div className="card">
        <h2>What this means</h2>
        <ul className="bullets">
          {desc.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
        <div className="cta">{desc.cta}</div>
      </div>

      <TrendChart
        biomarker={biomarker}
        past={past}
        latest={latest}
        flagColor={accent.color}
        personalMean={result.personalMean}
        personalBand={result.personalBand}
      />

      <div className="row">
        <button type="button" className="btn btn-primary" onClick={onRunAnother}>
          Check another value
        </button>
        <button type="button" className="btn btn-ghost" onClick={onChooseStory}>
          Try a different story
        </button>
      </div>
    </>
  );
}