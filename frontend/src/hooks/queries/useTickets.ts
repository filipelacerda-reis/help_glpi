import { useQuery } from '@tanstack/react-query';
import { ticketService } from '../../services/ticket.service';

type TicketFilters = Parameters<typeof ticketService.getTickets>[0];

export const useTickets = (filters?: TicketFilters) =>
  useQuery({
    queryKey: ['tickets', filters ?? {}],
    queryFn: () => ticketService.getTickets(filters),
  });

export type { TicketFilters };
