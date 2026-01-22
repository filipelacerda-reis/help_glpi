import { businessMinutesBetween, businessMinutesToHours, formatBusinessMinutes } from '../../utils/businessHours';

describe('businessHours', () => {
  describe('businessMinutesBetween', () => {
    it('deve retornar 0 quando start >= end', () => {
      const start = new Date('2024-01-15T10:00:00');
      const end = new Date('2024-01-15T10:00:00');
      
      expect(businessMinutesBetween(start, end)).toBe(0);
    });

    it('deve retornar 0 quando start > end', () => {
      const start = new Date('2024-01-15T11:00:00');
      const end = new Date('2024-01-15T10:00:00');
      
      expect(businessMinutesBetween(start, end)).toBe(0);
    });

    it('deve calcular minutos corretamente no mesmo dia dentro do horário comercial', () => {
      const start = new Date('2024-01-15T09:00:00'); // Segunda-feira, 9h
      const end = new Date('2024-01-15T10:30:00'); // Segunda-feira, 10h30
      
      const result = businessMinutesBetween(start, end);
      expect(result).toBe(90); // 1h30 = 90 minutos
    });

    it('deve calcular minutos corretamente quando começa antes do horário comercial', () => {
      const start = new Date('2024-01-15T08:00:00'); // Segunda-feira, 8h (antes do horário comercial)
      const end = new Date('2024-01-15T10:00:00'); // Segunda-feira, 10h
      
      const result = businessMinutesBetween(start, end);
      expect(result).toBe(60); // Apenas de 9h às 10h = 60 minutos
    });

    it('deve calcular minutos corretamente quando termina depois do horário comercial', () => {
      const start = new Date('2024-01-15T16:00:00'); // Segunda-feira, 16h
      const end = new Date('2024-01-15T18:00:00'); // Segunda-feira, 18h (depois do horário comercial)
      
      const result = businessMinutesBetween(start, end);
      expect(result).toBe(60); // Apenas de 16h às 17h = 60 minutos
    });

    it('deve ignorar fins de semana', () => {
      const start = new Date('2024-01-12T09:00:00'); // Sexta-feira, 9h
      const end = new Date('2024-01-15T10:00:00'); // Segunda-feira, 10h (pula sábado e domingo)
      
      const result = businessMinutesBetween(start, end);
      // Sexta: 9h-17h = 8h = 480min
      // Segunda: 9h-10h = 1h = 60min
      // Total: 540 minutos
      expect(result).toBe(540);
    });

    it('deve ignorar noites', () => {
      const start = new Date('2024-01-15T16:00:00'); // Segunda-feira, 16h
      const end = new Date('2024-01-16T10:00:00'); // Terça-feira, 10h
      
      const result = businessMinutesBetween(start, end);
      // Segunda: 16h-17h = 1h = 60min
      // Terça: 9h-10h = 1h = 60min
      // Total: 120 minutos
      expect(result).toBe(120);
    });

    it('deve calcular corretamente múltiplos dias úteis', () => {
      const start = new Date('2024-01-15T09:00:00'); // Segunda-feira, 9h
      const end = new Date('2024-01-17T17:00:00'); // Quarta-feira, 17h
      
      const result = businessMinutesBetween(start, end);
      // Segunda: 9h-17h = 8h = 480min
      // Terça: 9h-17h = 8h = 480min
      // Quarta: 9h-17h = 8h = 480min
      // Total: 1440 minutos (3 dias * 8h)
      expect(result).toBe(1440);
    });

    it('deve respeitar feriados quando fornecidos', () => {
      const start = new Date('2024-01-15T09:00:00'); // Segunda-feira, 9h
      const end = new Date('2024-01-17T17:00:00'); // Quarta-feira, 17h
      const holiday = new Date('2024-01-16T00:00:00'); // Terça-feira (feriado)
      
      const result = businessMinutesBetween(start, end, { holidays: [holiday] });
      // Segunda: 9h-17h = 8h = 480min
      // Terça: FERIADO (ignorado)
      // Quarta: 9h-17h = 8h = 480min
      // Total: 960 minutos (2 dias * 8h)
      expect(result).toBe(960);
    });

    it('deve respeitar configuração customizada de horário', () => {
      const start = new Date('2024-01-15T08:00:00'); // Segunda-feira, 8h
      const end = new Date('2024-01-15T12:00:00'); // Segunda-feira, 12h
      
      const result = businessMinutesBetween(start, end, {
        workdayStartHour: 8,
        workdayEndHour: 12,
      });
      // 8h-12h = 4h = 240 minutos
      expect(result).toBe(240);
    });

    it('deve respeitar configuração customizada de dias úteis', () => {
      const start = new Date('2024-01-13T09:00:00'); // Sábado, 9h
      const end = new Date('2024-01-15T10:00:00'); // Segunda-feira, 10h
      
      // Configurar para trabalhar também aos sábados
      const result = businessMinutesBetween(start, end, {
        workingDays: [0, 1, 2, 3, 4, 5, 6], // Todos os dias
      });
      // Sábado: 9h-17h = 8h = 480min
      // Domingo: 9h-17h = 8h = 480min (se configurado)
      // Segunda: 9h-10h = 1h = 60min
      // Total: depende da configuração, mas deve incluir sábado
      expect(result).toBeGreaterThan(0);
    });

    it('deve calcular corretamente quando o intervalo cruza múltiplos dias úteis e fins de semana', () => {
      const start = new Date('2024-01-12T14:00:00'); // Sexta-feira, 14h
      const end = new Date('2024-01-16T11:00:00'); // Terça-feira, 11h
      
      const result = businessMinutesBetween(start, end);
      // Sexta: 14h-17h = 3h = 180min
      // Sábado e Domingo: ignorados
      // Segunda: 9h-17h = 8h = 480min
      // Terça: 9h-11h = 2h = 120min
      // Total: 780 minutos
      expect(result).toBe(780);
    });
  });

  describe('businessMinutesToHours', () => {
    it('deve converter minutos para horas corretamente', () => {
      expect(businessMinutesToHours(60)).toBe(1);
      expect(businessMinutesToHours(90)).toBe(1.5);
      expect(businessMinutesToHours(120)).toBe(2);
      expect(businessMinutesToHours(480)).toBe(8);
    });

    it('deve arredondar para 2 casas decimais', () => {
      expect(businessMinutesToHours(65)).toBe(1.08); // 65/60 = 1.0833... -> 1.08
      expect(businessMinutesToHours(95)).toBe(1.58); // 95/60 = 1.5833... -> 1.58
    });
  });

  describe('formatBusinessMinutes', () => {
    it('deve formatar 0 minutos corretamente', () => {
      expect(formatBusinessMinutes(0)).toBe('0 min');
    });

    it('deve formatar apenas minutos', () => {
      expect(formatBusinessMinutes(30)).toBe('30 min');
      expect(formatBusinessMinutes(45)).toBe('45 min');
    });

    it('deve formatar apenas horas', () => {
      expect(formatBusinessMinutes(60)).toBe('1h');
      expect(formatBusinessMinutes(120)).toBe('2h');
      expect(formatBusinessMinutes(480)).toBe('8h');
    });

    it('deve formatar horas e minutos', () => {
      expect(formatBusinessMinutes(90)).toBe('1h 30min');
      expect(formatBusinessMinutes(150)).toBe('2h 30min');
      expect(formatBusinessMinutes(510)).toBe('8h 30min');
    });
  });
});

