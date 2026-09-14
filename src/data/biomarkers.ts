export type BiomarkerId = 'hemoglobin' | 'tsh' | 'creatinine';

export interface BiomarkerMeta {
  id: BiomarkerId;
  name: string;
  shortName: string;
  unit: string;
  /** population "normal" range — what labs print on the report */
  popMin: number;
  popMax: number;
  decimals: number;
  storyLabel: string;
  /** which direction of change is the concerning one for this marker */
  concern: 'lower' | 'higher' | 'either';
}

export const biomarkers: Record<BiomarkerId, BiomarkerMeta> = {
  hemoglobin: {
    id: 'hemoglobin',
    name: 'Hemoglobin',
    shortName: 'Hb',
    unit: 'g/dL',
    popMin: 12.0,
    popMax: 16.0,
    decimals: 1,
    storyLabel: 'Slow decline, stays "normal"',
    concern: 'lower',
  },
  tsh: {
    id: 'tsh',
    name: 'TSH',
    shortName: 'TSH',
    unit: 'mIU/L',
    popMin: 0.4,
    popMax: 4.0,
    decimals: 1,
    storyLabel: 'Bouncing noise, all normal',
    concern: 'either',
  },
  creatinine: {
    id: 'creatinine',
    name: 'Creatinine',
    shortName: 'Cr',
    unit: 'mg/dL',
    popMin: 0.6,
    popMax: 1.2,
    decimals: 2,
    storyLabel: 'Stable, then sharp jump',
    concern: 'higher',
  },
};