import { useEffect, useState } from 'react';
import { checkDrift, type CheckDriftResult } from './lib/checkDrift';
import { demoStories, type DemoStoryId } from './lib/demoStories';
import { biomarkers, type BiomarkerId } from './data/biomarkers';
import { InputScreen } from './components/InputScreen';
import { CheckScreen } from './components/CheckScreen';
import { ResultScreen } from './components/ResultScreen';
import { DisclaimerBanner } from './components/DisclaimerBanner';

type Screen = 'input' | 'check' | 'result';

const EMPTY_PAST = ['', '', '', ''];

export default function App() {
  const [screen, setScreen] = useState<Screen>('input');
  const [biomarkerId, setBiomarkerId] = useState<BiomarkerId>('hemoglobin');
  const [past, setPast] = useState<string[]>(EMPTY_PAST);
  const [latest, setLatest] = useState('');
  const [result, setResult] = useState<CheckDriftResult | null>(null);

  // Ready-to-demo on first paint: load the hemoglobin story immediately.
  useEffect(() => {
    selectStory('hemoglobin');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectStory(id: DemoStoryId | BiomarkerId) {
    const story = demoStories[id];
    setBiomarkerId(id);
    setPast(story.past.map((v) => String(v)));
    setLatest(String(story.new));
    setResult(null);
    setScreen('input');
  }

  function handlePastChange(index: number, value: string) {
    setPast((prev) => prev.map((v, i) => (i === index ? value : v)));
  }

  function runCheck() {
    const pastNums = past.map(Number);
    const latestNum = Number(latest);
    if (pastNums.length !== 4 || pastNums.some((n) => !Number.isFinite(n))) return;
    if (!Number.isFinite(latestNum)) return;
    try {
      setResult(checkDrift(pastNums, latestNum));
      setScreen('check');
    } catch {
      // never visible in the demo — checkDrift is guarded against throwing
    }
  }

  return (
    <div className="app">
      <header className="header">
        <span className="dot" />
        <h1>DriftCheck</h1>
      </header>
      <p className="tag">Your lab values, measured against YOU — not the crowd&rsquo;s &ldquo;normal&rdquo;.</p>

      {screen === 'input' && (
        <InputScreen
          biomarkerId={biomarkerId}
          past={past}
          latest={latest}
          onBiomarkerChange={setBiomarkerId}
          onStorySelect={selectStory}
          onPastChange={handlePastChange}
          onLatestChange={setLatest}
          onRunCheck={runCheck}
        />
      )}

      {screen === 'check' && <CheckScreen onComplete={() => setScreen('result')} />}

      {screen === 'result' && result && (
        <ResultScreen
          biomarker={biomarkers[biomarkerId]}
          past={past.map(Number)}
          latest={Number(latest)}
          result={result}
          onRunAnother={() => setScreen('input')}
          onChooseStory={() => {
            selectStory('hemoglobin');
          }}
        />
      )}

      <DisclaimerBanner />
    </div>
  );
}