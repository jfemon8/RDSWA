export interface PaginationOptions {
  page: number;
  limit: number;
}

export function parsePagination(query: { page?: string; limit?: string }): PaginationOptions {
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10) || 20));
  return { page, limit };
}

export function getSkip(options: PaginationOptions): number {
  return (options.page - 1) * options.limit;
}
