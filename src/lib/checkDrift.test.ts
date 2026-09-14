import { describe, it, expect } from 'vitest';
import { checkDrift, describeResult } from './checkDrift';
import { demoStories } from './demoStories';

describe('checkDrift — demo fixtures produce the correct flag', () => {
  it('hemoglobin: gradual downward drift (inside normal band)', () => {
    const r = checkDrift(demoStories.hemoglobin.past, demoStories.hemoglobin.new);
    expect(r.flag).toBe('drift');
    expect(r.drift.direction).toBe('down');
    expect(r.drift.slope).toBeLessThan(0);
    expect(r.drift.rSquared).toBeGreaterThan(0.9);
    expect(r.sudden.isSudden).toBe(false);
  });

  it('TSH: noisy, no consistent direction → normal', () => {
    const r = checkDrift(demoStories.tsh.past, demoStories.tsh.new);
    expect(r.flag).toBe('normal');
    expect(r.sudden.isSudden).toBe(false);
    expect(r.drift.isDrift).toBe(false);
  });

  it('creatinine: sharp single jump → sudden (and not drift)', () => {
    const r = checkDrift(demoStories.creatinine.past, demoStories.creatinine.new);
    expect(r.flag).toBe('sudden');
    expect(r.sudden.isSudden).toBe(true);
    expect(r.sudden.z).toBeGreaterThan(10);
    expect(r.drift.isDrift).toBe(false);
  });
});

describe('checkDrift — priority and guards', () => {
  it('sudden takes priority when both would trigger', () => {
    const r = checkDrift([10, 10.2, 10.1, 10.05], 15);
    expect(r.flag).toBe('sudden');
    expect(r.sudden.isSudden).toBe(true);
  });

  it('handles 4 identical past values without dividing by zero', () => {
    expect(checkDrift([2, 2, 2, 2], 3).flag).toBe('sudden');
    expect(checkDrift([2, 2, 2, 2], 2).flag).toBe('normal');
  });

  it('never throws on bad input', () => {
    expect(() => checkDrift([], 5)).not.toThrow();
    expect(() => checkDrift([1, 2], 5)).not.toThrow();
    expect(() => checkDrift([1, 2, 3, 4], NaN)).not.toThrow();
    expect(() => checkDrift([NaN, 2, 3, 4], 5)).not.toThrow();
    expect(checkDrift([], 5).enoughData).toBe(false);
  });

  it('derives a personal band (mean ± 2 stddev)', () => {
    const r = checkDrift(demoStories.hemoglobin.past, demoStories.hemoglobin.new);
    expect(r.personalBand.min).toBeLessThan(r.personalBand.max);
    expect(r.personalMean).toBeCloseTo(13.825, 3);
  });

  it('survives small live-typing perturbations without flipping', () => {
    // Presenter might type slightly different digits live — story must not flip.
    expect(checkDrift([14.4, 14.1, 13.7, 13.3], 12.9).flag).toBe('drift');
    expect(checkDrift([2.2, 3.2, 2.0, 2.9], 2.6).flag).toBe('normal');
    expect(checkDrift([0.92, 0.9, 0.95, 0.93], 1.7).flag).toBe('sudden');
  });
});

describe('describeResult — plain English', () => {
  const meta = { label: 'Hemoglobin', unit: 'g/dL', concern: 'lower' as const };

  it('produces a "talk to your doctor" message for drift', () => {
    const r = checkDrift(demoStories.hemoglobin.past, demoStories.hemoglobin.new);
    const d = describeResult(r, meta);
    expect(d.accent).toBe('warn');
    expect(d.title).toContain('Gradual drift');
    expect(d.cta.toLowerCase()).toContain('doctor');
    expect(d.cta.toLowerCase()).toContain('not diagnose');
  });

  it('produces a clear message for a normal result', () => {
    const r = checkDrift(demoStories.tsh.past, demoStories.tsh.new);
    const d = describeResult(r, { label: 'TSH', unit: 'mIU/L', concern: 'either' });
    expect(d.accent).toBe('good');
    expect(d.title).toContain('Matches');
  });
});