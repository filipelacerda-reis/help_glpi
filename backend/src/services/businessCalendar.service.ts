import prisma from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { BusinessSchedule } from '../domain/time/businessTime.engine';

export interface CreateBusinessCalendarDto {
  name: string;
  timezone?: string;
  schedule: {
    monday?: { open: string; close: string; enabled: boolean };
    tuesday?: { open: string; close: string; enabled: boolean };
    wednesday?: { open: string; close: string; enabled: boolean };
    thursday?: { open: string; close: string; enabled: boolean };
    friday?: { open: string; close: string; enabled: boolean };
    saturday?: { open: string; close: string; enabled: boolean };
    sunday?: { open: string; close: string; enabled: boolean };
  };
  isDefault?: boolean;
}

export interface UpdateBusinessCalendarDto {
  name?: string;
  timezone?: string;
  schedule?: CreateBusinessCalendarDto['schedule'];
  isDefault?: boolean;
}

export const businessCalendarService = {
  /**
   * Cria um calendário de negócio
   */
  async createCalendar(data: CreateBusinessCalendarDto) {
    // Se for marcado como padrão, desmarcar outros
    if (data.isDefault) {
      await prisma.businessCalendar.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const calendar = await prisma.businessCalendar.create({
      data: {
        name: data.name,
        timezone: data.timezone || 'America/Sao_Paulo',
        schedule: data.schedule as any,
        isDefault: data.isDefault || false,
      },
    });

    logger.info('Calendário de negócio criado', { calendarId: calendar.id, name: calendar.name });
    return calendar;
  },

  /**
   * Busca todos os calendários
   */
  async getAllCalendars() {
    return prisma.businessCalendar.findMany({
      orderBy: [
        { isDefault: 'desc' },
        { name: 'asc' },
      ],
    });
  },

  /**
   * Busca calendário por ID
   */
  async getCalendarById(id: string) {
    const calendar = await prisma.businessCalendar.findUnique({
      where: { id },
      include: {
        exceptions: {
          orderBy: {
            date: 'asc',
          },
        },
      },
    });

    if (!calendar) {
      throw new AppError('Calendário não encontrado', 404);
    }

    return calendar;
  },

  /**
   * Busca calendário padrão
   */
  async getDefaultCalendar() {
    const calendar = await prisma.businessCalendar.findFirst({
      where: { isDefault: true },
    });

    if (!calendar) {
      // Criar calendário padrão 8x5 se não existir
      return this.createDefaultCalendar();
    }

    return calendar;
  },

  /**
   * Retorna o BusinessSchedule para uso no motor de business time
   */
  async getBusinessSchedule(calendarId: string | null): Promise<BusinessSchedule> {
    const formatDateInTimeZone = (date: Date, timeZone: string) => {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const parts = formatter.formatToParts(date);
      const values: Record<string, string> = {};
      parts.forEach((part) => {
        if (part.type !== 'literal') {
          values[part.type] = part.value;
        }
      });
      return `${values.year}-${values.month}-${values.day}`;
    };

    type CalendarWithExceptions = Prisma.BusinessCalendarGetPayload<{
      include: { exceptions: true };
    }>;
    let calendar: CalendarWithExceptions | null = null;
    if (calendarId) {
      calendar = await prisma.businessCalendar.findUnique({
        where: { id: calendarId },
        include: { exceptions: true },
      });
      if (!calendar) {
        throw new AppError('Calendário não encontrado', 404);
      }
    } else {
      calendar = await prisma.businessCalendar.findFirst({
        where: { isDefault: true },
        include: { exceptions: true },
      });
      if (!calendar) {
        logger.warn('Calendário padrão não encontrado, usando default corporativo');
        const created = await this.createDefaultCalendar();
        calendar = await prisma.businessCalendar.findUnique({
          where: { id: created.id },
          include: { exceptions: true },
        });
      }
    }

    if (!calendar) {
      throw new AppError('Calendário padrão não encontrado', 500);
    }

    const schedule = (calendar.schedule || {}) as Record<
      string,
      { open?: string; close?: string; enabled?: boolean }
    >;
    const timezone = calendar.timezone || 'America/Sao_Paulo';
    const holidays = (calendar?.exceptions || [])
      .filter((exception: { isHoliday: boolean }) => exception.isHoliday)
      .map((exception: { date: Date }) => formatDateInTimeZone(exception.date, timezone));

    const mapDay = (day: { open?: string; close?: string; enabled?: boolean } | undefined, enabled: boolean) => ({
      start: day?.open || '09:00',
      end: day?.close || '18:00',
      enabled: day?.enabled ?? enabled,
    });

    return {
      timezone,
      weekly: {
        0: mapDay(schedule.sunday, false),
        1: mapDay(schedule.monday, true),
        2: mapDay(schedule.tuesday, true),
        3: mapDay(schedule.wednesday, true),
        4: mapDay(schedule.thursday, true),
        5: mapDay(schedule.friday, true),
        6: mapDay(schedule.saturday, false),
      },
      holidays,
    };
  },

  /**
   * Cria calendário padrão 8x5 (Segunda a Sexta, 09:00-18:00)
   */
  async createDefaultCalendar() {
    const defaultSchedule = {
      monday: { open: '09:00', close: '18:00', enabled: true },
      tuesday: { open: '09:00', close: '18:00', enabled: true },
      wednesday: { open: '09:00', close: '18:00', enabled: true },
      thursday: { open: '09:00', close: '18:00', enabled: true },
      friday: { open: '09:00', close: '18:00', enabled: true },
      saturday: { open: '09:00', close: '18:00', enabled: false },
      sunday: { open: '09:00', close: '18:00', enabled: false },
    };

    return this.createCalendar({
      name: 'Calendário Padrão 8x5',
      timezone: 'America/Sao_Paulo',
      schedule: defaultSchedule,
      isDefault: true,
    });
  },

  /**
   * Atualiza calendário
   */
  async updateCalendar(id: string, data: UpdateBusinessCalendarDto) {
    const calendar = await prisma.businessCalendar.findUnique({
      where: { id },
    });

    if (!calendar) {
      throw new AppError('Calendário não encontrado', 404);
    }

    // Se for marcado como padrão, desmarcar outros
    if (data.isDefault) {
      await prisma.businessCalendar.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.businessCalendar.update({
      where: { id },
      data: {
        name: data.name,
        timezone: data.timezone,
        schedule: data.schedule as any,
        isDefault: data.isDefault,
      },
    });

    logger.info('Calendário atualizado', { calendarId: id });
    return updated;
  },

  /**
   * Adiciona exceção (feriado) ao calendário
   */
  async addException(calendarId: string, date: Date, description?: string) {
    const calendar = await prisma.businessCalendar.findUnique({
      where: { id: calendarId },
    });

    if (!calendar) {
      throw new AppError('Calendário não encontrado', 404);
    }

    const exception = await prisma.businessCalendarException.create({
      data: {
        calendarId,
        date,
        isHoliday: true,
        description,
      },
    });

    logger.info('Exceção adicionada ao calendário', { calendarId, date });
    return exception;
  },

  /**
   * Remove exceção do calendário
   */
  async removeException(exceptionId: string) {
    await prisma.businessCalendarException.delete({
      where: { id: exceptionId },
    });

    logger.info('Exceção removida do calendário', { exceptionId });
  },
};

