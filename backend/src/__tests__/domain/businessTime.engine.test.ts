import { businessMinutesBetween, BusinessSchedule } from '../../domain/time/businessTime.engine';

const baseSchedule: BusinessSchedule = {
  timezone: 'America/Sao_Paulo',
  weekly: {
    0: { start: '09:00', end: '18:00', enabled: false },
    1: { start: '09:00', end: '18:00', enabled: true },
    2: { start: '09:00', end: '18:00', enabled: true },
    3: { start: '09:00', end: '18:00', enabled: true },
    4: { start: '09:00', end: '18:00', enabled: true },
    5: { start: '09:00', end: '18:00', enabled: true },
    6: { start: '09:00', end: '18:00', enabled: false },
  },
};

describe('businessTime.engine', () => {
  it('returns 0 when end <= start', () => {
    const start = new Date('2024-01-15T12:00:00Z');
    const end = new Date('2024-01-15T12:00:00Z');
    expect(businessMinutesBetween(start, end, baseSchedule)).toBe(0);
  });

  it('calculates interval inside business hours', () => {
    const start = new Date('2024-01-15T13:00:00Z'); // 10:00 local
    const end = new Date('2024-01-15T15:00:00Z'); // 12:00 local
    expect(businessMinutesBetween(start, end, baseSchedule)).toBe(120);
  });

  it('handles interval crossing end of day', () => {
    const start = new Date('2024-01-15T20:00:00Z'); // 17:00 local
    const end = new Date('2024-01-15T23:00:00Z'); // 20:00 local
    expect(businessMinutesBetween(start, end, baseSchedule)).toBe(60);
  });

  it('skips weekend days', () => {
    const start = new Date('2024-01-12T19:00:00Z'); // Fri 16:00 local
    const end = new Date('2024-01-15T13:00:00Z'); // Mon 10:00 local
    expect(businessMinutesBetween(start, end, baseSchedule)).toBe(180);
  });

  it('skips holidays', () => {
    const schedule: BusinessSchedule = {
      ...baseSchedule,
      holidays: ['2024-01-15'],
    };
    const start = new Date('2024-01-15T12:00:00Z'); // Mon 09:00 local (holiday)
    const end = new Date('2024-01-16T13:00:00Z'); // Tue 10:00 local
    expect(businessMinutesBetween(start, end, schedule)).toBe(60);
  });

  it('respects different hours per day', () => {
    const schedule: BusinessSchedule = {
      ...baseSchedule,
      weekly: {
        ...baseSchedule.weekly,
        5: { start: '09:00', end: '16:00', enabled: true }, // Friday shorter
      },
    };
    const start = new Date('2024-01-12T18:00:00Z'); // Fri 15:00 local
    const end = new Date('2024-01-12T21:00:00Z'); // Fri 18:00 local
    expect(businessMinutesBetween(start, end, schedule)).toBe(60);
  });

  it('uses schedule timezone explicitly', () => {
    const start = new Date('2024-01-15T08:00:00Z'); // 05:00 local
    const end = new Date('2024-01-15T13:00:00Z'); // 10:00 local
    expect(businessMinutesBetween(start, end, baseSchedule)).toBe(60);
  });
});
