export type TicketStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'WAITING_REQUESTER'
  | 'WAITING_THIRD_PARTY'
  | 'RESOLVED'
  | 'CLOSED';

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type UserRole = 'REQUESTER' | 'TECHNICIAN' | 'TRIAGER' | 'ADMIN';

