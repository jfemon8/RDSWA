import { useInfiniteQuery, type QueryKey } from '@tanstack/react-query';
import api from '@/lib/api';

interface InfiniteListSource {
  /** Centralised key from queryKeys, built from the same filters passed below. */
  queryKey: QueryKey;
  /** API path without the query string, e.g. `/notices`. */
  path: string;
  /** Filters other than page and limit, which the options add themselves. */
  filters?: Record<string, string | undefined>;
  limit?: number;
}

interface UseInfiniteListOptions extends InfiniteListSource {
  enabled?: boolean;
  /** Extra react-query options, such as the offline caching a page has already chosen. */
  queryOptions?: Record<string, unknown>;
}

/** One page of any `ApiResponse.paginated` endpoint. */
interface ListPage {
  data?: any[];
  pagination?: { page: number; total: number; totalPages: number; hasNext: boolean };
}

/** Query options for a paginated endpoint, shared so a prefetch warms the very key the list reads. */
export function infiniteListOptions({
  queryKey,
  path,
  filters = {},
  limit = 20,
}: InfiniteListSource) {
  return {
    queryKey,
    initialPageParam: 1,
    queryFn: async ({ pageParam }: { pageParam: unknown }): Promise<ListPage> => {
      const params = new URLSearchParams({ page: String(pageParam), limit: String(limit) });
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== '') params.set(key, value);
      }
      const { data } = await api.get(`${path}?${params}`);
      return data;
    },
    // An endpoint that omits pagination has given us everything it has.
    getNextPageParam: (last: ListPage) =>
      last?.pagination?.hasNext ? last.pagination.page + 1 : undefined,
  };
}

/** Row count from a paginated response body, which lives under `pagination` rather than at the root. */
export function paginatedTotal(body: unknown): number {
  return (body as ListPage | undefined)?.pagination?.total ?? 0;
}

/** Reads a paginated endpoint one page at a time and hands back every row loaded so far. */
export function useInfiniteList<T = any>({
  enabled = true,
  queryOptions,
  ...source
}: UseInfiniteListOptions) {
  const query = useInfiniteQuery({ ...infiniteListOptions(source), enabled, ...queryOptions });

  const pages = query.data?.pages ?? [];
  const items = pages.flatMap((p) => p.data ?? []) as T[];

  return {
    ...query,
    items,
    /** Rows the server holds in total, which stays right even while only the first page is loaded. */
    total: pages[0]?.pagination?.total ?? items.length,
  };
}
