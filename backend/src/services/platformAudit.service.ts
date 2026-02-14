import prisma from '../lib/prisma';

export const platformAuditService = {
  async log(
    actorUserId: string | null,
    action: string,
    resource: string,
    detailsJson?: any
  ) {
    return prisma.platformAuditLog.create({
      data: {
        actorUserId,
        action,
        resource,
        detailsJson,
      },
    });
  },

  async list(
    limit: number,
    cursor?: string,
    filters?: {
      actorUserId?: string;
      action?: string;
      resource?: string;
      from?: Date;
      to?: Date;
    }
  ) {
    const where: any = {};
    if (filters?.actorUserId) where.actorUserId = filters.actorUserId;
    if (filters?.action) where.action = filters.action;
    if (filters?.resource) where.resource = filters.resource;
    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
    }

    const items = await prisma.platformAuditLog.findMany({
      where,
      take: limit + 1,
      orderBy: { createdAt: 'desc' },
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      include: {
        actor: { select: { id: true, name: true, email: true } },
      },
    });

    const hasNext = items.length > limit;
    const data = hasNext ? items.slice(0, limit) : items;
    const nextCursor = hasNext ? data[data.length - 1].id : null;

    return { data, nextCursor };
  },
};
