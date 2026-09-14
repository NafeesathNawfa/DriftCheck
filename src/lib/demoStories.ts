export const demoStories: Record<
  'hemoglobin' | 'tsh' | 'creatinine',
  { past: number[]; new: number; story: string }
> = {
  hemoglobin: {
    past: [14.5, 14.0, 13.6, 13.2],
    new: 12.9,
    story:
      'Steady decline over a year — every result stays inside the "normal" band, but the direction is consistent.',
  },
  tsh: {
    past: [2.1, 3.4, 1.9, 3.0],
    new: 2.5,
    story:
      'Back-and-forth value with no consistent direction — classic noise, sits inside personal + population range.',
  },
  creatinine: {
    past: [0.9, 0.95, 0.92, 0.91],
    new: 1.8,
    story:
      'Rock-stable baseline for months, then a sharp single jump — this is an acute change, not a trend.',
  },
};

export type DemoStoryId = keyof typeof demoStories;