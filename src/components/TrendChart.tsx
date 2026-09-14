import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import type { BiomarkerMeta } from '../data/biomarkers';
import type { PersonalBand } from '../lib/checkDrift';

interface TrendChartProps {
  biomarker: BiomarkerMeta;
  past: number[];
  latest: number;
  flagColor: string;
  personalMean: number;
  personalBand: PersonalBand;
}

// color-switchable dot renderer — final point highlighted
function makeDot(flagColor: string, count: number) {
  return function renderDot(props: { cx?: number; cy?: number; index?: number }) {
    const isLast = props.index === count - 1;
    return (
      <circle
        cx={props.cx ?? 0}
        cy={props.cy ?? 0}
        r={isLast ? 6 : 4}
        fill={isLast ? flagColor : '#94a3b8'}
        stroke="#fff"
        strokeWidth={2}
      />
    );
  };
}

export function TrendChart({
  biomarker,
  past,
  latest,
  flagColor,
  personalMean,
  personalBand,
}: TrendChartProps) {
  const data = [
    ...past.map((v, i) => ({ name: `Check ${i + 1}`, value: v })),
    { name: 'New result', value: latest },
  ];

  const unit = biomarker.unit;
  const showPersonalBand = Number.isFinite(personalBand.min) && Number.isFinite(personalBand.max);

  return (
    <div className="chartCard card">
      <h2>Your trend</h2>
      <p className="sub">
        {biomarker.name} over your last {data.length} checks. The green band is the population
        &ldquo;normal&rdquo; range; the blue dashed line is <em>your</em> average.
      </p>

      <ResponsiveContainer width="100%" height={270}>
        <LineChart data={data} margin={{ top: 10, right: 16, bottom: 4, left: -8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
          <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
          <YAxis
            tick={{ fontSize: 12, fill: '#64748b' }}
            domain={[Math.min(biomarker.popMin, ...data.map((d) => d.value), ...(showPersonalBand ? [personalBand.min] : [])) - 0.1, Math.max(biomarker.popMax, ...data.map((d) => d.value), ...(showPersonalBand ? [personalBand.max] : [])) + 0.1]}
          />
          <Tooltip
            formatter={(value) => `${Number(value)} ${unit}`}
            contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
          />
          <ReferenceArea
            id="population-normal-band"
            y1={biomarker.popMin}
            y2={biomarker.popMax}
            fill="#16a34a"
            fillOpacity={0.09}
            stroke="none"
          />
          {showPersonalBand && (
            <ReferenceArea
              id="personal-band"
              y1={personalBand.min}
              y2={personalBand.max}
              fill="#2563eb"
              fillOpacity={0.07}
              stroke="none"
            />
          )}
          {Number.isFinite(personalMean) && (
            <ReferenceLine
              id="personal-mean"
              y={personalMean}
              stroke="#1d4ed8"
              strokeDasharray="4 4"
              label={{ value: 'your average', position: 'insideBottomLeft', fontSize: 11, fill: '#1d4ed8' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={flagColor}
            strokeWidth={2.5}
            dot={makeDot(flagColor, data.length)}
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="legend">
        <span>
          <span className="swatch swatch-green" /> population normal range
        </span>
        <span>
          <span className="swatch swatch-blue" /> your average
        </span>
        <span>
          <span className="swatch swatch-dot" /> your results
        </span>
      </div>
    </div>
  );
}