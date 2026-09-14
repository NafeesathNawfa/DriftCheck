import { useEffect } from 'react';

interface CheckScreenProps {
  onComplete: () => void;
}

export function CheckScreen({ onComplete }: CheckScreenProps) {
  useEffect(() => {
    const t = setTimeout(onComplete, 1400);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div className="card checkWrap">
      <div className="spinner" />
      <p className="checkMsg">
        Building your personal baseline…
        <br />
        comparing the new result to <strong>your own</strong> last 4 checks.
      </p>
    </div>
  );
}