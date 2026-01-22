export type BusinessSchedule = {
  timezone: string; // IANA, ex: "America/Sao_Paulo"
  weekly: Record<number, { start: string; end: string; enabled: boolean }>;
  holidays?: string[]; // YYYY-MM-DD no timezone do schedule
};

type LocalDate = {
  year: number;
  month: number;
  day: number;
};

type LocalDateTime = LocalDate & {
  hour: number;
  minute: number;
  second: number;
};

function getZonedParts(date: Date, timeZone: string): LocalDateTime {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const values: Record<string, string> = {};
  parts.forEach((part) => {
    if (part.type !== 'literal') {
      values[part.type] = part.value;
    }
  });

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function zonedTimeToUtc(local: LocalDateTime, timeZone: string): Date {
  const utcGuess = new Date(
    Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second, 0)
  );
  const actual = getZonedParts(utcGuess, timeZone);
  const actualUtc = Date.UTC(
    actual.year,
    actual.month - 1,
    actual.day,
    actual.hour,
    actual.minute,
    actual.second,
    0
  );
  const desiredUtc = Date.UTC(
    local.year,
    local.month - 1,
    local.day,
    local.hour,
    local.minute,
    local.second,
    0
  );
  const diffMs = actualUtc - desiredUtc;
  return new Date(utcGuess.getTime() - diffMs);
}

function toLocalDate(date: Date, timeZone: string): LocalDate {
  const parts = getZonedParts(date, timeZone);
  return { year: parts.year, month: parts.month, day: parts.day };
}

function localDateToString(local: LocalDate): string {
  const month = String(local.month).padStart(2, '0');
  const day = String(local.day).padStart(2, '0');
  return `${local.year}-${month}-${day}`;
}

function addLocalDays(local: LocalDate, days: number): LocalDate {
  const utc = new Date(Date.UTC(local.year, local.month - 1, local.day + days, 0, 0, 0, 0));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1, day: utc.getUTCDate() };
}

function compareLocalDates(a: LocalDate, b: LocalDate): number {
  const aUtc = Date.UTC(a.year, a.month - 1, a.day, 0, 0, 0, 0);
  const bUtc = Date.UTC(b.year, b.month - 1, b.day, 0, 0, 0, 0);
  return aUtc - bUtc;
}

function getDayOfWeek(local: LocalDate, timeZone: string): number {
  const noon = zonedTimeToUtc(
    { ...local, hour: 12, minute: 0, second: 0 },
    timeZone
  );
  return noon.getUTCDay(); // 0-6 (Sun-Sat)
}

function parseTime(value: string): { hour: number; minute: number } {
  const [hourRaw, minuteRaw] = value.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (Number.isNaN(hour) || Number.isNaN(minute)) {
    throw new Error(`Invalid time format: ${value}`);
  }
  return { hour, minute };
}

export function businessMinutesBetween(
  start: Date,
  end: Date,
  schedule: BusinessSchedule
): number {
  if (!start || !end || end <= start) {
    return 0;
  }

  const timeZone = schedule.timezone;
  const holidays = new Set(schedule.holidays ?? []);

  const startLocal = toLocalDate(start, timeZone);
  const endLocal = toLocalDate(end, timeZone);

  let totalMinutes = 0;
  let current = startLocal;

  while (compareLocalDates(current, endLocal) <= 0) {
    const dayOfWeek = getDayOfWeek(current, timeZone);
    const daySchedule = schedule.weekly[dayOfWeek];
    const dateKey = localDateToString(current);

    if (daySchedule?.enabled && !holidays.has(dateKey)) {
      const startTime = parseTime(daySchedule.start);
      const endTime = parseTime(daySchedule.end);
      const dayStartUtc = zonedTimeToUtc(
        { ...current, hour: startTime.hour, minute: startTime.minute, second: 0 },
        timeZone
      );
      const dayEndUtc = zonedTimeToUtc(
        { ...current, hour: endTime.hour, minute: endTime.minute, second: 0 },
        timeZone
      );

      const effectiveStart = start > dayStartUtc ? start : dayStartUtc;
      const effectiveEnd = end < dayEndUtc ? end : dayEndUtc;

      if (effectiveEnd > effectiveStart) {
        totalMinutes += Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / 60000);
      }
    }

    current = addLocalDays(current, 1);
  }

  return totalMinutes;
}
