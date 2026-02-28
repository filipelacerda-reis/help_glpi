import { useQuery } from '@tanstack/react-query';
import { ticketService } from '../../services/ticket.service';

type StaleTicketsParams = {
  daysThreshold?: number;
  take?: number;
};

export const useStaleTickets = (params?: StaleTicketsParams) =>
  useQuery({
    queryKey: ['tickets', 'stale', params ?? {}],
    queryFn: () => ticketService.getStaleTickets(params),
    staleTime: 1000 * 60,
  });

export type { StaleTicketsParams };

