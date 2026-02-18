import prisma from '../../../lib/prisma';

export const auditEventReadService = {
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
    if (filters?.action) where.action = { contains: filters.action, mode: 'insensitive' };
    if (filters?.resource) where.resourceType = { contains: filters.resource, mode: 'insensitive' };
    if (filters?.from || filters?.to) {
      where.ts = {};
      if (filters.from) where.ts.gte = filters.from;
      if (filters.to) where.ts.lte = filters.to;
    }

    const items = await prisma.auditEvent.findMany({
      where,
      take: limit + 1,
      orderBy: { ts: 'desc' },
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

    const mapped = data.map((item) => ({
      id: item.id,
      action: item.action,
      resource: item.resourceType,
      resourceId: item.resourceId,
      domain: item.domain,
      requestId: item.requestId,
      detailsJson: item.metadataJson,
      createdAt: item.ts,
      actor: item.actor || (item.actorEmail ? { email: item.actorEmail } : null),
      beforeJson: item.beforeJson,
      afterJson: item.afterJson,
      ip: item.ip,
      userAgent: item.userAgent,
    }));

    return { data: mapped, nextCursor };
  },
};
