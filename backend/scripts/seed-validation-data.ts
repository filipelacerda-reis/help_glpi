import { PrismaClient, UserRole, TicketStatus, TicketPriority, TicketType, CommentType, TicketEventType, EventOrigin, SlaInstanceStatus, TechnicianJournalEntryType, TagGroup, KbArticleStatus, TeamRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs/promises';

const prisma = new PrismaClient();

type LocalDate = { year: number; month: number; day: number };
type LocalDateTime = LocalDate & { hour: number; minute: number };

const OFFSET_HOURS = -3; // America/Recife (UTC-03:00)
const WORK_START = { hour: 9, minute: 0 };
const WORK_END = { hour: 18, minute: 0 };
const COUNTED_STATUSES = new Set<TicketStatus>([
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
]);

const TARGET_FIRST_RESPONSE = 60;
const TARGET_RESOLUTION = 240;

const FIXED_SALT = '$2a$10$1234567890123456789012';

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--wipe') {
      args.wipe = true;
    } else if (arg.startsWith('--')) {
      const key = arg.replace(/^--/, '');
      const value = argv[i + 1];
      if (value && !value.startsWith('--')) {
        args[key] = value;
        i += 1;
      } else {
        args[key] = 'true';
      }
    }
  }

  return {
    wipe: Boolean(args.wipe),
    days: Number(args.days || 21),
    ticketsPerDay: Number(args['tickets-per-day'] || 8),
    seed: Number(args.seed || 42),
    outputDir: String(args['output-dir'] || 'scripts/seed-output'),
  };
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randInt(rng: () => number, min: number, max: number) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick<T>(rng: () => number, list: T[]) {
  return list[randInt(rng, 0, list.length - 1)];
}

function localDateTimeToDate(local: LocalDateTime) {
  return new Date(Date.UTC(local.year, local.month - 1, local.day, local.hour - OFFSET_HOURS, local.minute, 0, 0));
}

function toLocalDateParts(date: Date): LocalDateTime {
  const local = new Date(date.getTime() + OFFSET_HOURS * 60 * 60 * 1000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
  };
}

function addLocalDays(local: LocalDate, days: number): LocalDate {
  const utc = Date.UTC(local.year, local.month - 1, local.day + days, 0, 0, 0, 0);
  const date = new Date(utc);
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function localDateKey(local: LocalDate) {
  const month = String(local.month).padStart(2, '0');
  const day = String(local.day).padStart(2, '0');
  return `${local.year}-${month}-${day}`;
}

function localDayOfWeek(local: LocalDate) {
  const noon = localDateTimeToDate({ ...local, hour: 12, minute: 0 });
  return noon.getUTCDay();
}

function isBusinessDay(local: LocalDate, holidays: Set<string>) {
  const day = localDayOfWeek(local);
  if (day === 0 || day === 6) return false;
  return !holidays.has(localDateKey(local));
}

function nextBusinessDay(local: LocalDate, holidays: Set<string>) {
  let candidate = addLocalDays(local, 1);
  while (!isBusinessDay(candidate, holidays)) {
    candidate = addLocalDays(candidate, 1);
  }
  return candidate;
}

function businessMinutesBetween(start: Date, end: Date, holidays: Set<string>) {
  if (!start || !end || end <= start) return 0;

  const startLocal = toLocalDateParts(start);
  const endLocal = toLocalDateParts(end);
  let current: LocalDate = { year: startLocal.year, month: startLocal.month, day: startLocal.day };
  const endDate: LocalDate = { year: endLocal.year, month: endLocal.month, day: endLocal.day };

  let total = 0;
  while (localDateKey(current) <= localDateKey(endDate)) {
    if (isBusinessDay(current, holidays)) {
      const dayStart = localDateTimeToDate({ ...current, ...WORK_START });
      const dayEnd = localDateTimeToDate({ ...current, ...WORK_END });
      const effectiveStart = start > dayStart ? start : dayStart;
      const effectiveEnd = end < dayEnd ? end : dayEnd;
      if (effectiveEnd > effectiveStart) {
        total += Math.floor((effectiveEnd.getTime() - effectiveStart.getTime()) / 60000);
      }
    }
    current = addLocalDays(current, 1);
  }

  return total;
}

function elapsedBusinessMinutesFromTimeline(
  segments: Array<{ status: TicketStatus; start: Date; end: Date }>,
  holidays: Set<string>
) {
  let total = 0;
  segments.forEach((segment) => {
    if (!COUNTED_STATUSES.has(segment.status)) return;
    total += businessMinutesBetween(segment.start, segment.end, holidays);
  });
  return total;
}

async function wipeTransactionalData() {
  await prisma.journalAttachment.deleteMany();
  await prisma.journalTag.deleteMany();
  await prisma.technicianJournalEntry.deleteMany();
  await prisma.ticketAttachment.deleteMany();
  await prisma.ticketComment.deleteMany();
  await prisma.ticketTag.deleteMany();
  await prisma.ticketObserver.deleteMany();
  await prisma.ticketInteraction.deleteMany();
  await prisma.ticketEvent.deleteMany();
  await prisma.ticketStatusHistory.deleteMany();
  await prisma.ticketRelation.deleteMany();
  await prisma.ticketWorklog.deleteMany();
  await prisma.ticketSatisfaction.deleteMany();
  await prisma.ticketSlaInstance.deleteMany();
  await prisma.ticketSlaStats.deleteMany();
  await prisma.ticketKbArticle.deleteMany();
  await prisma.kbArticleUsage.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.ticket.deleteMany();
}

async function upsertUser(email: string, name: string, role: UserRole, department: string) {
  const passwordHash = bcrypt.hashSync('seed123', FIXED_SALT);
  return prisma.user.upsert({
    where: { email },
    update: { name, role, department },
    create: { name, email, role, department, passwordHash },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rng = mulberry32(args.seed);
  const outputDir = path.resolve(args.outputDir);
  await fs.mkdir(outputDir, { recursive: true });

  if (args.wipe) {
    console.log('🧹 Wiping transactional data...');
    await wipeTransactionalData();
  }

  const todayLocal = toLocalDateParts(new Date());
  const startLocal: LocalDate = addLocalDays(todayLocal, -(args.days - 1));
  const holidayLocal = addLocalDays(startLocal, Math.floor(args.days / 2));
  const holidayDate = localDateTimeToDate({ ...holidayLocal, hour: 0, minute: 0 });
  const holidayKey = localDateKey(holidayLocal);
  const holidays = new Set<string>([holidayKey]);

  // Calendar default (America/Recife)
  await prisma.businessCalendar.updateMany({ data: { isDefault: false } });
  const existingCalendar = await prisma.businessCalendar.findFirst({
    where: { name: 'Calendário Seed Recife' },
  });
  const calendar = existingCalendar
    ? await prisma.businessCalendar.update({
        where: { id: existingCalendar.id },
        data: {
          timezone: 'America/Recife',
          isDefault: true,
          schedule: {
            monday: { open: '09:00', close: '18:00', enabled: true },
            tuesday: { open: '09:00', close: '18:00', enabled: true },
            wednesday: { open: '09:00', close: '18:00', enabled: true },
            thursday: { open: '09:00', close: '18:00', enabled: true },
            friday: { open: '09:00', close: '18:00', enabled: true },
            saturday: { open: '09:00', close: '18:00', enabled: false },
            sunday: { open: '09:00', close: '18:00', enabled: false },
          },
        },
      })
    : await prisma.businessCalendar.create({
        data: {
          name: 'Calendário Seed Recife',
          timezone: 'America/Recife',
          isDefault: true,
          schedule: {
            monday: { open: '09:00', close: '18:00', enabled: true },
            tuesday: { open: '09:00', close: '18:00', enabled: true },
            wednesday: { open: '09:00', close: '18:00', enabled: true },
            thursday: { open: '09:00', close: '18:00', enabled: true },
            friday: { open: '09:00', close: '18:00', enabled: true },
            saturday: { open: '09:00', close: '18:00', enabled: false },
            sunday: { open: '09:00', close: '18:00', enabled: false },
          },
        },
      });

  const existingHoliday = await prisma.businessCalendarException.findFirst({
    where: { calendarId: calendar.id, date: holidayDate },
  });
  if (!existingHoliday) {
    await prisma.businessCalendarException.create({
      data: {
        calendarId: calendar.id,
        date: holidayDate,
        isHoliday: true,
        description: 'Feriado Seed',
      },
    });
  }

  const existingPolicy = await prisma.slaPolicy.findFirst({
    where: { name: 'SLA Default Seed' },
  });
  const slaPolicy = existingPolicy
    ? await prisma.slaPolicy.update({
        where: { id: existingPolicy.id },
        data: {
          targetFirstResponseBusinessMinutes: TARGET_FIRST_RESPONSE,
          targetResolutionBusinessMinutes: TARGET_RESOLUTION,
          calendarId: calendar.id,
          appliesTo: {},
          active: true,
          targetCompliance: 98.5,
        },
      })
    : await prisma.slaPolicy.create({
        data: {
          name: 'SLA Default Seed',
          description: 'SLA padrão para validação',
          appliesTo: {},
          targetFirstResponseBusinessMinutes: TARGET_FIRST_RESPONSE,
          targetResolutionBusinessMinutes: TARGET_RESOLUTION,
          calendarId: calendar.id,
          active: true,
          targetCompliance: 98.5,
        },
      });

  const admin = await upsertUser('admin@seed.local', 'Admin Seed', UserRole.ADMIN, 'Seed');
  const triager = await upsertUser('triager@seed.local', 'Triager Seed', UserRole.TRIAGER, 'Seed');
  const technicians = await Promise.all(
    ['tech1', 'tech2', 'tech3', 'tech4'].map((name) =>
      upsertUser(`${name}@seed.local`, `Tecnico ${name}`, UserRole.TECHNICIAN, 'Seed')
    )
  );
  const requesters = await Promise.all(
    Array.from({ length: 10 }).map((_, idx) =>
      upsertUser(`requester${idx + 1}@seed.local`, `Solicitante ${idx + 1}`, UserRole.REQUESTER, 'Seed')
    )
  );

  const teams = await Promise.all([
    prisma.team.upsert({
      where: { name: 'Suporte N1 (Seed)' },
      update: {},
      create: { name: 'Suporte N1 (Seed)', description: 'Time seed N1' },
    }),
    prisma.team.upsert({
      where: { name: 'SRE (Seed)' },
      update: {},
      create: { name: 'SRE (Seed)', description: 'Time seed SRE' },
    }),
    prisma.team.upsert({
      where: { name: 'Operações (Seed)' },
      update: {},
      create: { name: 'Operações (Seed)', description: 'Time seed Operações' },
    }),
  ]);

  const categories = await Promise.all([
    prisma.category.upsert({ where: { name: 'Hardware' }, update: {}, create: { name: 'Hardware', active: true } }),
    prisma.category.upsert({ where: { name: 'Software' }, update: {}, create: { name: 'Software', active: true } }),
    prisma.category.upsert({ where: { name: 'Rede' }, update: {}, create: { name: 'Rede', active: true } }),
  ]);

  const tags = await Promise.all([
    prisma.tag.upsert({ where: { name: 'env:prod' }, update: {}, create: { name: 'env:prod', group: TagGroup.ENV } }),
    prisma.tag.upsert({ where: { name: 'env:staging' }, update: {}, create: { name: 'env:staging', group: TagGroup.ENV } }),
    prisma.tag.upsert({ where: { name: 'area:sre' }, update: {}, create: { name: 'area:sre', group: TagGroup.AREA } }),
    prisma.tag.upsert({ where: { name: 'area:ops' }, update: {}, create: { name: 'area:ops', group: TagGroup.AREA } }),
  ]);

  await prisma.userTeam.createMany({
    data: [
      { userId: admin.id, teamId: teams[1].id, role: TeamRole.LEAD },
      { userId: triager.id, teamId: teams[0].id, role: TeamRole.LEAD },
      { userId: technicians[0].id, teamId: teams[0].id, role: TeamRole.MEMBER },
      { userId: technicians[1].id, teamId: teams[0].id, role: TeamRole.MEMBER },
      { userId: technicians[2].id, teamId: teams[1].id, role: TeamRole.MEMBER },
      { userId: technicians[3].id, teamId: teams[2].id, role: TeamRole.MEMBER },
    ],
    skipDuplicates: true,
  });

  await prisma.teamCategory.createMany({
    data: teams.flatMap((team) =>
      categories.map((category) => ({ teamId: team.id, categoryId: category.id }))
    ),
    skipDuplicates: true,
  });

  const allTicketTypes = [
    TicketType.INCIDENT,
    TicketType.SERVICE_REQUEST,
    TicketType.PROBLEM,
    TicketType.CHANGE,
    TicketType.TASK,
    TicketType.QUESTION,
  ];

  await prisma.teamTicketType.createMany({
    data: teams.flatMap((team) =>
      allTicketTypes.map((ticketType) => ({ teamId: team.id, ticketType }))
    ),
    skipDuplicates: true,
  });

  const existingKbCategory = await prisma.kbCategory.findFirst({
    where: { name: 'Seed Infra' },
  });
  const kbCategory = existingKbCategory
    ? await prisma.kbCategory.update({
        where: { id: existingKbCategory.id },
        data: { description: 'KB seed infra' },
      })
    : await prisma.kbCategory.create({
        data: { name: 'Seed Infra', description: 'KB seed infra' },
      });

  const ensureKbArticle = async (title: string, content: string, tagsList: string[]) => {
    const existing = await prisma.kbArticle.findFirst({ where: { title } });
    if (existing) {
      return prisma.kbArticle.update({
        where: { id: existing.id },
        data: {
          content,
          status: KbArticleStatus.PUBLISHED,
          tags: tagsList,
          categoryId: kbCategory.id,
          updatedById: admin.id,
        },
      });
    }
    return prisma.kbArticle.create({
      data: {
        title,
        content,
        status: KbArticleStatus.PUBLISHED,
        tags: tagsList,
        createdById: admin.id,
        categoryId: kbCategory.id,
      },
    });
  };

  const kbArticles = await Promise.all([
    ensureKbArticle('Checklist de Deploy (Seed)', 'Passos para validar deploy.', ['deploy', 'seed']),
    ensureKbArticle('Falha de Rede (Seed)', 'Diagnostico de rede.', ['rede', 'seed']),
    ensureKbArticle('Erro 500 (Seed)', 'Como investigar erro 500.', ['api', 'seed']),
    ensureKbArticle('Rotina de Backup (Seed)', 'Procedimento de backup.', ['backup', 'seed']),
  ]);

  const specialPatterns: Array<{ pattern: string; dayOffset: number }> = [
    { pattern: 'MEET_SIMPLE', dayOffset: -2 },
    { pattern: 'BREACH_FIRST_RESPONSE', dayOffset: -3 },
    { pattern: 'BREACH_RESOLUTION', dayOffset: -4 },
    { pattern: 'WAITING_PAUSE', dayOffset: -5 },
    { pattern: 'REOPEN', dayOffset: -6 },
    { pattern: 'PARENT_CHILD', dayOffset: -7 },
    { pattern: 'BACKLOG_END_OF_DAY', dayOffset: -1 },
  ];

  const specialByDay = new Map<string, string[]>();
  specialPatterns.forEach(({ pattern, dayOffset }) => {
    const local = addLocalDays(todayLocal, dayOffset);
    const key = localDateKey(local);
    if (!specialByDay.has(key)) specialByDay.set(key, []);
    specialByDay.get(key)!.push(pattern);
  });

  const backlogHolidayDay = addLocalDays(holidayLocal, -1);
  const backlogHolidayKey = localDateKey(backlogHolidayDay);
  if (!specialByDay.has(backlogHolidayKey)) specialByDay.set(backlogHolidayKey, []);
  specialByDay.get(backlogHolidayKey)!.push('BACKLOG_HOLIDAY');

  const expectedMetrics: Array<Record<string, any>> = [];
  let createdCount = 0;

  const ensureTicketArtifacts = async (ticket: any, timeline: Array<{ status: TicketStatus; at: Date }>, requester: any, technician: any) => {
    await prisma.ticketStatusHistory.createMany({
      data: timeline.map((entry, index) => ({
        ticketId: ticket.id,
        oldStatus: index === 0 ? null : timeline[index - 1].status,
        newStatus: entry.status,
        changedById: technician.id,
        changedAt: entry.at,
      })),
    });

    await prisma.ticketEvent.createMany({
      data: [
        {
          ticketId: ticket.id,
          eventType: TicketEventType.CREATED,
          actorUserId: requester.id,
          origin: EventOrigin.SCRIPT,
          createdAt: ticket.createdAt,
        },
        ...timeline.slice(1).map((entry, index) => ({
          ticketId: ticket.id,
          eventType: TicketEventType.STATUS_CHANGED,
          actorUserId: technician.id,
          origin: EventOrigin.SCRIPT,
          oldValue: { status: timeline[index].status },
          newValue: { status: entry.status },
          createdAt: entry.at,
        })),
      ],
    });
  };

  const createCommentsAndWorklog = async (ticket: any, firstResponseAt: Date, requester: any, technician: any) => {
    const comment = await prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        authorId: technician.id,
        type: CommentType.PUBLIC,
        content: 'Primeira resposta seed.',
        createdAt: firstResponseAt,
      },
    });

    await prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        eventType: TicketEventType.COMMENT_ADDED,
        actorUserId: technician.id,
        origin: EventOrigin.SCRIPT,
        newValue: { commentId: comment.id },
        createdAt: firstResponseAt,
      },
    });

    await prisma.technicianJournalEntry.create({
      data: {
        technicianId: technician.id,
        type: TechnicianJournalEntryType.AUTO_TICKET_COMMENT,
        ticketId: ticket.id,
        commentId: comment.id,
        description: 'Resposta ao ticket (seed).',
        createdAt: firstResponseAt,
      },
    });

    const requesterCommentAt = new Date(firstResponseAt.getTime() + 60 * 60 * 1000);
    const requesterComment = await prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        authorId: requester.id,
        type: CommentType.PUBLIC,
        content: 'Obrigado, segue mais detalhes.',
        createdAt: requesterCommentAt,
      },
    });

    await prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        eventType: TicketEventType.COMMENT_ADDED,
        actorUserId: requester.id,
        origin: EventOrigin.SCRIPT,
        newValue: { commentId: requesterComment.id },
        createdAt: requesterCommentAt,
      },
    });

    const worklogAt = new Date(firstResponseAt.getTime() + 30 * 60 * 1000);
    const worklog = await prisma.ticketWorklog.create({
      data: {
        ticketId: ticket.id,
        userId: technician.id,
        durationMinutes: 45,
        description: 'Analisando incidente.',
        createdAt: worklogAt,
      },
    });

    await prisma.technicianJournalEntry.create({
      data: {
        technicianId: technician.id,
        type: TechnicianJournalEntryType.AUTO_TICKET_WORKLOG,
        ticketId: ticket.id,
        worklogId: worklog.id,
        description: 'Worklog registrado (seed).',
        createdAt: worklogAt,
      },
    });
  };

  const createSlaStats = async (
    ticket: any,
    firstResponseAt: Date | null,
    resolvedAt: Date | null,
    resolutionBusinessMinutes: number | null,
    firstResponseBusinessMinutes: number | null
  ) => {
    const breachedFirst = firstResponseBusinessMinutes !== null && firstResponseBusinessMinutes > TARGET_FIRST_RESPONSE;
    const breachedRes = resolutionBusinessMinutes !== null && resolutionBusinessMinutes > TARGET_RESOLUTION;
    const breached = breachedFirst || breachedRes;

    await prisma.ticketSlaStats.upsert({
      where: { ticketId: ticket.id },
      update: {
        slaPolicyId: slaPolicy.id,
        firstResponseAt,
        resolvedAt,
        businessFirstResponseTimeMs: firstResponseBusinessMinutes !== null ? firstResponseBusinessMinutes * 60000 : null,
        businessResolutionTimeMs: resolutionBusinessMinutes !== null ? resolutionBusinessMinutes * 60000 : null,
        breached,
        breachReason: breachedRes ? 'RESOLUTION_EXCEEDED' : breachedFirst ? 'FIRST_RESPONSE_EXCEEDED' : null,
      },
      create: {
        ticketId: ticket.id,
        slaPolicyId: slaPolicy.id,
        firstResponseAt,
        resolvedAt,
        businessFirstResponseTimeMs: firstResponseBusinessMinutes !== null ? firstResponseBusinessMinutes * 60000 : null,
        businessResolutionTimeMs: resolutionBusinessMinutes !== null ? resolutionBusinessMinutes * 60000 : null,
        breached,
        breachReason: breachedRes ? 'RESOLUTION_EXCEEDED' : breachedFirst ? 'FIRST_RESPONSE_EXCEEDED' : null,
      },
    });

    await prisma.ticketSlaInstance.create({
      data: {
        ticketId: ticket.id,
        slaPolicyId: slaPolicy.id,
        startedAt: ticket.createdAt,
        resolvedAt: resolvedAt || null,
        status: resolvedAt ? (breached ? SlaInstanceStatus.BREACHED : SlaInstanceStatus.MET) : SlaInstanceStatus.RUNNING,
      },
    });

    await prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        eventType: TicketEventType.SLA_STARTED,
        actorUserId: null,
        origin: EventOrigin.SYSTEM,
        createdAt: ticket.createdAt,
        newValue: { slaPolicyId: slaPolicy.id },
      },
    });

    if (resolvedAt) {
      await prisma.ticketEvent.create({
        data: {
          ticketId: ticket.id,
          eventType: breached ? TicketEventType.SLA_BREACHED : TicketEventType.SLA_MET,
          actorUserId: null,
          origin: EventOrigin.SYSTEM,
          createdAt: resolvedAt,
          newValue: {
            breached,
            businessResolutionMinutes: resolutionBusinessMinutes,
          },
        },
      });
    }
  };

  const createTicketForPattern = async (pattern: string, dayLocal: LocalDate) => {
    const team = pick(rng, teams);
    const category = pick(rng, categories);
    const technician = pick(rng, technicians);
    const requester = pick(rng, requesters);
    const priority = pick(rng, [TicketPriority.LOW, TicketPriority.MEDIUM, TicketPriority.HIGH]);
    const tipo = pick(rng, allTicketTypes);
    const tag = pick(rng, tags);

    let createdAt: Date;
    let firstResponseAt: Date | null = null;
    let resolvedAt: Date | null = null;
    let timeline: Array<{ status: TicketStatus; at: Date }> = [];

    if (pattern === 'MEET_SIMPLE') {
      createdAt = localDateTimeToDate({ ...dayLocal, hour: 10, minute: 0 });
      firstResponseAt = localDateTimeToDate({ ...dayLocal, hour: 10, minute: 30 });
      resolvedAt = localDateTimeToDate({ ...dayLocal, hour: 12, minute: 0 });
      timeline = [
        { status: TicketStatus.OPEN, at: createdAt },
        { status: TicketStatus.IN_PROGRESS, at: firstResponseAt },
        { status: TicketStatus.RESOLVED, at: resolvedAt },
      ];
    } else if (pattern === 'BREACH_FIRST_RESPONSE') {
      createdAt = localDateTimeToDate({ ...dayLocal, hour: 17, minute: 20 });
      const nextDay = nextBusinessDay(dayLocal, holidays);
      firstResponseAt = localDateTimeToDate({ ...nextDay, hour: 10, minute: 30 });
      resolvedAt = localDateTimeToDate({ ...nextDay, hour: 12, minute: 0 });
      timeline = [
        { status: TicketStatus.OPEN, at: createdAt },
        { status: TicketStatus.IN_PROGRESS, at: firstResponseAt },
        { status: TicketStatus.RESOLVED, at: resolvedAt },
      ];
    } else if (pattern === 'BREACH_RESOLUTION') {
      createdAt = localDateTimeToDate({ ...dayLocal, hour: 9, minute: 30 });
      firstResponseAt = localDateTimeToDate({ ...dayLocal, hour: 10, minute: 0 });
      const nextDay = nextBusinessDay(dayLocal, holidays);
      resolvedAt = localDateTimeToDate({ ...nextDay, hour: 17, minute: 30 });
      timeline = [
        { status: TicketStatus.OPEN, at: createdAt },
        { status: TicketStatus.IN_PROGRESS, at: firstResponseAt },
        { status: TicketStatus.RESOLVED, at: resolvedAt },
      ];
    } else if (pattern === 'WAITING_PAUSE') {
      createdAt = localDateTimeToDate({ ...dayLocal, hour: 9, minute: 0 });
      firstResponseAt = localDateTimeToDate({ ...dayLocal, hour: 9, minute: 30 });
      const waitingAt = localDateTimeToDate({ ...dayLocal, hour: 10, minute: 0 });
      const resumeAt = localDateTimeToDate({ ...dayLocal, hour: 16, minute: 0 });
      resolvedAt = localDateTimeToDate({ ...dayLocal, hour: 18, minute: 0 });
      timeline = [
        { status: TicketStatus.OPEN, at: createdAt },
        { status: TicketStatus.IN_PROGRESS, at: firstResponseAt },
        { status: TicketStatus.WAITING_REQUESTER, at: waitingAt },
        { status: TicketStatus.IN_PROGRESS, at: resumeAt },
        { status: TicketStatus.RESOLVED, at: resolvedAt },
      ];
    } else if (pattern === 'REOPEN') {
      createdAt = localDateTimeToDate({ ...dayLocal, hour: 10, minute: 0 });
      firstResponseAt = localDateTimeToDate({ ...dayLocal, hour: 11, minute: 0 });
      const firstResolved = localDateTimeToDate({ ...dayLocal, hour: 15, minute: 0 });
      const reopenDay = nextBusinessDay(dayLocal, holidays);
      const reopenAt = localDateTimeToDate({ ...reopenDay, hour: 10, minute: 0 });
      const reopenProgress = localDateTimeToDate({ ...reopenDay, hour: 10, minute: 30 });
      resolvedAt = localDateTimeToDate({ ...reopenDay, hour: 12, minute: 0 });
      timeline = [
        { status: TicketStatus.OPEN, at: createdAt },
        { status: TicketStatus.IN_PROGRESS, at: firstResponseAt },
        { status: TicketStatus.RESOLVED, at: firstResolved },
        { status: TicketStatus.OPEN, at: reopenAt },
        { status: TicketStatus.IN_PROGRESS, at: reopenProgress },
        { status: TicketStatus.RESOLVED, at: resolvedAt },
      ];
    } else if (pattern === 'PARENT_CHILD') {
      createdAt = localDateTimeToDate({ ...dayLocal, hour: 9, minute: 0 });
      firstResponseAt = localDateTimeToDate({ ...dayLocal, hour: 10, minute: 0 });
      resolvedAt = localDateTimeToDate({ ...dayLocal, hour: 15, minute: 0 });
      timeline = [
        { status: TicketStatus.OPEN, at: createdAt },
        { status: TicketStatus.IN_PROGRESS, at: firstResponseAt },
        { status: TicketStatus.RESOLVED, at: resolvedAt },
      ];
    } else if (pattern === 'BACKLOG_END_OF_DAY') {
      createdAt = localDateTimeToDate({ ...dayLocal, hour: 17, minute: 40 });
      const nextDay = nextBusinessDay(dayLocal, holidays);
      firstResponseAt = localDateTimeToDate({ ...nextDay, hour: 9, minute: 30 });
      timeline = [
        { status: TicketStatus.OPEN, at: createdAt },
        { status: TicketStatus.IN_PROGRESS, at: firstResponseAt },
      ];
    } else if (pattern === 'BACKLOG_HOLIDAY') {
      createdAt = localDateTimeToDate({ ...dayLocal, hour: 17, minute: 0 });
      const afterHoliday = nextBusinessDay(dayLocal, holidays);
      firstResponseAt = localDateTimeToDate({ ...afterHoliday, hour: 10, minute: 0 });
      timeline = [
        { status: TicketStatus.OPEN, at: createdAt },
        { status: TicketStatus.IN_PROGRESS, at: firstResponseAt },
      ];
    } else {
      createdAt = localDateTimeToDate({ ...dayLocal, hour: 10, minute: 0 });
      firstResponseAt = localDateTimeToDate({ ...dayLocal, hour: 10, minute: 30 });
      resolvedAt = localDateTimeToDate({ ...dayLocal, hour: 12, minute: 0 });
      timeline = [
        { status: TicketStatus.OPEN, at: createdAt },
        { status: TicketStatus.IN_PROGRESS, at: firstResponseAt },
        { status: TicketStatus.RESOLVED, at: resolvedAt },
      ];
    }

    const ticket = await prisma.ticket.create({
      data: {
        title: `[Seed] ${pattern} ${createdCount + 1}`,
        description: `Ticket seed ${pattern}`,
        status: resolvedAt ? TicketStatus.RESOLVED : TicketStatus.IN_PROGRESS,
        priority,
        tipo,
        requesterId: requester.id,
        assignedTechnicianId: technician.id,
        categoryId: category.id,
        teamId: team.id,
        teamSolicitanteId: team.id,
        createdAt,
        firstResponseAt: firstResponseAt || null,
        resolvedAt: resolvedAt || null,
      },
    });

    await prisma.ticketTag.create({
      data: { ticketId: ticket.id, tagId: tag.id },
    });

    await ensureTicketArtifacts(ticket, timeline, requester, technician);

    if (firstResponseAt) {
      await createCommentsAndWorklog(ticket, firstResponseAt, requester, technician);
    }

    if (timeline.some((entry) => entry.status === TicketStatus.WAITING_REQUESTER || entry.status === TicketStatus.WAITING_THIRD_PARTY)) {
      const pauseEntry = timeline.find(
        (entry) =>
          entry.status === TicketStatus.WAITING_REQUESTER ||
          entry.status === TicketStatus.WAITING_THIRD_PARTY
      );
      const resumeEntry = timeline.find(
        (entry, index) =>
          (entry.status === TicketStatus.IN_PROGRESS || entry.status === TicketStatus.OPEN) &&
          index > 0 &&
          (timeline[index - 1].status === TicketStatus.WAITING_REQUESTER ||
            timeline[index - 1].status === TicketStatus.WAITING_THIRD_PARTY)
      );

      if (pauseEntry) {
        await prisma.ticketEvent.create({
          data: {
            ticketId: ticket.id,
            eventType: TicketEventType.SLA_PAUSED,
            actorUserId: null,
            origin: EventOrigin.SYSTEM,
            createdAt: pauseEntry.at,
          },
        });
      }

      if (resumeEntry) {
        await prisma.ticketEvent.create({
          data: {
            ticketId: ticket.id,
            eventType: TicketEventType.SLA_RESUMED,
            actorUserId: null,
            origin: EventOrigin.SYSTEM,
            createdAt: resumeEntry.at,
          },
        });
      }
    }

    const segments: Array<{ status: TicketStatus; start: Date; end: Date }> = [];
    if (resolvedAt) {
      timeline.forEach((entry, index) => {
        const end = timeline[index + 1]?.at || resolvedAt;
        if (end > entry.at) {
          segments.push({ status: entry.status, start: entry.at, end });
        }
      });
    }

    const firstResponseBusinessMinutes = firstResponseAt
      ? businessMinutesBetween(createdAt, firstResponseAt, holidays)
      : null;
    const resolutionBusinessMinutes = resolvedAt
      ? elapsedBusinessMinutesFromTimeline(segments, holidays)
      : null;

    await prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        firstResponseBusinessMinutes,
        resolutionBusinessMinutes,
      },
    });

    await createSlaStats(
      ticket,
      firstResponseAt,
      resolvedAt,
      resolutionBusinessMinutes,
      firstResponseBusinessMinutes
    );

    await prisma.ticketKbArticle.create({
      data: { ticketId: ticket.id, articleId: kbArticles[0].id },
    });

    if (firstResponseAt) {
      await prisma.kbArticleUsage.create({
        data: {
          articleId: kbArticles[0].id,
          usedById: technician.id,
          ticketId: ticket.id,
          usedAt: firstResponseAt,
        },
      });
    }

    if (rng() < 0.15) {
      await prisma.technicianJournalEntry.create({
        data: {
          technicianId: technician.id,
          type: TechnicianJournalEntryType.MANUAL,
          ticketId: ticket.id,
          description: 'Entrada manual de validação (seed).',
          createdAt: new Date(ticket.createdAt.getTime() + 2 * 60 * 60 * 1000),
        },
      });
    }

    expectedMetrics.push({
      ticketId: ticket.id,
      pattern,
      createdAt: createdAt.toISOString(),
      firstResponseAt: firstResponseAt ? firstResponseAt.toISOString() : null,
      resolvedAt: resolvedAt ? resolvedAt.toISOString() : null,
      firstResponseBusinessMinutes,
      resolutionBusinessMinutes,
      targets: {
        firstResponseMinutes: TARGET_FIRST_RESPONSE,
        resolutionMinutes: TARGET_RESOLUTION,
      },
      breachedFirst: firstResponseBusinessMinutes !== null && firstResponseBusinessMinutes > TARGET_FIRST_RESPONSE,
      breachedRes: resolutionBusinessMinutes !== null && resolutionBusinessMinutes > TARGET_RESOLUTION,
      breached:
        (firstResponseBusinessMinutes !== null && firstResponseBusinessMinutes > TARGET_FIRST_RESPONSE) ||
        (resolutionBusinessMinutes !== null && resolutionBusinessMinutes > TARGET_RESOLUTION),
    });

    createdCount += 1;
    return ticket;
  };

  const localDates: LocalDate[] = [];
  for (let i = 0; i < args.days; i += 1) {
    localDates.push(addLocalDays(startLocal, i));
  }

  for (const dayLocal of localDates) {
    const key = localDateKey(dayLocal);
    const patterns = specialByDay.get(key) || [];
    const dayTickets: string[] = [...patterns];
    const parentChildCount = dayTickets.filter((p) => p === 'PARENT_CHILD').length;

    while (dayTickets.length + parentChildCount * 2 < args.ticketsPerDay) {
      dayTickets.push('MEET_SIMPLE');
    }

    for (const pattern of dayTickets) {
      if (pattern === 'PARENT_CHILD') {
        const parent = await createTicketForPattern(pattern, dayLocal);
        const child1 = await createTicketForPattern(pattern, dayLocal);
        const child2 = await createTicketForPattern(pattern, dayLocal);
        await prisma.ticketRelation.createMany({
          data: [
            { ticketId: parent.id, relatedTicketId: child1.id, relationType: 'PARENT_OF' },
            { ticketId: child1.id, relatedTicketId: parent.id, relationType: 'CHILD_OF' },
            { ticketId: parent.id, relatedTicketId: child2.id, relationType: 'PARENT_OF' },
            { ticketId: child2.id, relatedTicketId: parent.id, relationType: 'CHILD_OF' },
          ],
        });
      } else {
        await createTicketForPattern(pattern, dayLocal);
      }
    }
  }

  const outputPath = path.join(outputDir, 'expected-metrics.json');
  await fs.writeFile(outputPath, JSON.stringify(expectedMetrics, null, 2));

  console.log(`✅ Seed concluído. Tickets criados: ${createdCount}`);
  console.log(`📄 expected-metrics.json: ${outputPath}`);
}

main()
  .catch((error) => {
    console.error('❌ Erro no seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
