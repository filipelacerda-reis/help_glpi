/**
 * Calcula o tempo em minutos de horário comercial entre duas datas
 * Horário comercial padrão: Segunda a Sexta, 09:00 às 17:00 (8 horas por dia)
 */

export interface BusinessHoursConfig {
  workdayStartHour?: number; // default 9
  workdayEndHour?: number; // default 17
  workingDays?: number[]; // default [1,2,3,4,5] (segunda=1, domingo=0)
  holidays?: Date[]; // opcional: lista de feriados
}

const DEFAULT_CONFIG: Required<Omit<BusinessHoursConfig, 'holidays'>> & { holidays?: Date[] } = {
  workdayStartHour: 9,
  workdayEndHour: 17,
  workingDays: [1, 2, 3, 4, 5], // Segunda a Sexta
  holidays: [],
};

/**
 * Verifica se uma data é feriado
 */
function isHoliday(date: Date, holidays: Date[]): boolean {
  if (!holidays || holidays.length === 0) return false;

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  return holidays.some((holiday) => {
    const holidayStr = `${holiday.getFullYear()}-${String(holiday.getMonth() + 1).padStart(2, '0')}-${String(holiday.getDate()).padStart(2, '0')}`;
    return holidayStr === dateStr;
  });
}

/**
 * Verifica se um dia da semana é dia útil
 */
function isWorkingDay(date: Date, workingDays: number[]): boolean {
  const dayOfWeek = date.getDay(); // 0 = domingo, 1 = segunda, ..., 6 = sábado
  return workingDays.includes(dayOfWeek);
}

/**
 * Cria uma data com hora específica no mesmo dia
 */
function setTime(date: Date, hour: number, minute: number = 0): Date {
  const newDate = new Date(date);
  newDate.setHours(hour, minute, 0, 0);
  return newDate;
}

/**
 * Calcula minutos de horário comercial entre duas datas
 */
export function businessMinutesBetween(
  start: Date,
  end: Date,
  config?: BusinessHoursConfig
): number {
  // Se start >= end, retornar 0
  if (start >= end) {
    return 0;
  }

  const finalConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    holidays: config?.holidays || [],
  };

  const { workdayStartHour, workdayEndHour, workingDays, holidays } = finalConfig;

  // Normalizar datas para o mesmo timezone
  const startDate = new Date(start);
  const endDate = new Date(end);

  let totalMinutes = 0;
  const currentDate = new Date(startDate);

  // Iterar dia a dia de start até end
  while (currentDate < endDate) {
    // Se não é dia útil, pular
    if (!isWorkingDay(currentDate, workingDays)) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
      continue;
    }

    // Se é feriado, pular
    if (isHoliday(currentDate, holidays)) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
      continue;
    }

    // Calcular janela do dia
    const dayStart = setTime(currentDate, workdayStartHour);
    const dayEnd = setTime(currentDate, workdayEndHour);

    // Calcular início efetivo (max entre start e início do dia)
    const effectiveStart = startDate > dayStart ? startDate : dayStart;

    // Calcular fim efetivo (min entre end e fim do dia)
    const effectiveEnd = endDate < dayEnd ? endDate : dayEnd;

    // Se há sobreposição, somar minutos
    if (effectiveEnd > effectiveStart) {
      const minutes = Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60));
      totalMinutes += minutes;
    }

    // Avançar para o próximo dia
    currentDate.setDate(currentDate.getDate() + 1);
    currentDate.setHours(0, 0, 0, 0);
  }

  return totalMinutes;
}

/**
 * Converte minutos de horário comercial para horas (com 2 casas decimais)
 */
export function businessMinutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * Calcula diferença em minutos de calendário (wall-clock time)
 */
export function diffInCalendarMinutes(start: Date, end: Date): number {
  if (start >= end) return 0;
  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
}

/**
 * Calcula diferença em minutos de horário comercial
 * Alias para businessMinutesBetween para manter compatibilidade
 */
export function diffInBusinessMinutes(
  start: Date,
  end: Date,
  config?: BusinessHoursConfig
): number {
  return businessMinutesBetween(start, end, config);
}

/**
 * Formata minutos de horário comercial para string legível
 */
export function formatBusinessMinutes(minutes: number): string {
  if (minutes === 0) return '0 min';
  
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins} min`;
  }
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}min`;
}

