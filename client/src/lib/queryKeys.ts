export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  users: {
    all: ['users'] as const,
    list: (filters: Record<string, string>) => ['users', 'list', filters] as const,
    detail: (id: string) => ['users', 'detail', id] as const,
    members: (filters: Record<string, string>) => ['users', 'members', filters] as const,
    bloodDonors: (filters: Record<string, string>) => ['users', 'blood-donors', filters] as const,
  },
  committees: {
    all: ['committees'] as const,
    current: ['committees', 'current'] as const,
    detail: (id: string) => ['committees', 'detail', id] as const,
  },
  events: {
    all: ['events'] as const,
    list: (filters: Record<string, string>) => ['events', 'list', filters] as const,
    detail: (id: string) => ['events', 'detail', id] as const,
    myAttendance: ['events', 'my-attendance'] as const,
  },
  notices: {
    all: ['notices'] as const,
    list: (filters: Record<string, string>) => ['notices', 'list', filters] as const,
    detail: (id: string) => ['notices', 'detail', id] as const,
  },
  donations: {
    all: ['donations'] as const,
    campaigns: ['donations', 'campaigns'] as const,
    my: ['donations', 'my'] as const,
    paymentMethods: ['donations', 'payment-methods'] as const,
  },
  votes: {
    all: ['votes'] as const,
    detail: (id: string) => ['votes', 'detail', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
  },
  settings: {
    all: ['settings'] as const,
  },
  jobs: {
    all: ['jobs'] as const,
    detail: (id: string) => ['jobs', 'detail', id] as const,
    my: ['jobs', 'my'] as const,
  },
  mentorships: {
    all: ['mentorships'] as const,
    my: ['mentorships', 'my'] as const,
    mentors: ['mentorships', 'mentors'] as const,
  },
  budgets: {
    all: ['budgets'] as const,
    list: (filters: Record<string, string>) => ['budgets', 'list', filters] as const,
    detail: (id: string) => ['budgets', 'detail', id] as const,
  },
};
