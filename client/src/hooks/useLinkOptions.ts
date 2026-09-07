import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';

/** How many of each list a "link this record to..." dropdown offers, newest first. */
export const EVENT_OPTION_LIMIT = 100;
export const COMMITTEE_OPTION_LIMIT = 20;

/** The latest events, for dropdowns that optionally link a record to one. */
export function useEventOptions() {
  const { data } = useQuery({
    queryKey: ['event-link-options'],
    queryFn: async () => (await api.get(`/events?limit=${EVENT_OPTION_LIMIT}`)).data,
  });
  // The events endpoint already sorts newest first and caps the page at this limit.
  return (data?.data || []) as any[];
}

/** The latest committees, for dropdowns that optionally link a record to one. */
export function useCommitteeOptions() {
  const { data } = useQuery({
    queryKey: ['committee-link-options'],
    queryFn: async () => (await api.get('/committees')).data,
  });
  // This endpoint returns every committee sorted by tenure, so the newest ones are trimmed off the front.
  return ((data?.data || []) as any[]).slice(0, COMMITTEE_OPTION_LIMIT);
}
