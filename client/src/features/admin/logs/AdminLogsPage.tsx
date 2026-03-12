import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { Loader2, Shield, Clock } from 'lucide-react';

type Tab = 'audit' | 'login';

export default function AdminLogsPage() {
  const [tab, setTab] = useState<Tab>('audit');

  return (
    <FadeIn direction="up">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-6">Logs & Security</h1>

        <div className="flex flex-col sm:flex-row gap-2 mb-6 border-b">
          <button
            onClick={() => setTab('audit')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${
              tab === 'audit' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Shield className="h-4 w-4" /> Audit Logs
          </button>
          <button
            onClick={() => setTab('login')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${
              tab === 'login' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="h-4 w-4" /> Login History
          </button>
        </div>

        {tab === 'audit' && <AuditLogsTab />}
        {tab === 'login' && <LoginHistoryTab />}
      </div>
    </FadeIn>
  );
}

function AuditLogsTab() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'logs', page, action],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (action) params.set('action', action);
      const { data } = await api.get(`/admin/logs?${params}`);
      return data;
    },
  });

  const logs = data?.data || [];
  const pagination = data?.pagination;

  return (
    <>
      <FadeIn direction="up" delay={0.05}>
        <div className="flex gap-3 mb-6">
          <input value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}
            placeholder="Filter by action..."
            className="px-3 py-2 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full sm:w-64" />
        </div>
      </FadeIn>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No audit logs found</p>
        </div>
      ) : (
        <>
          <FadeIn direction="up" delay={0.1}>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="text-left p-3 font-medium text-foreground">Action</th>
                    <th className="text-left p-3 font-medium text-foreground">Actor</th>
                    <th className="text-left p-3 font-medium text-foreground">Resource</th>
                    <th className="text-left p-3 font-medium text-foreground">IP</th>
                    <th className="text-left p-3 font-medium text-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log: any) => (
                    <tr
                      key={log._id}
                      className="border-t hover:bg-accent/30"
                    >
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-muted text-xs font-mono">{log.action}</span>
                      </td>
                      <td className="p-3 text-foreground">{log.actor?.name || log.actor?.email || 'System'}</td>
                      <td className="p-3 text-muted-foreground text-xs">{log.resource}</td>
                      <td className="p-3 text-muted-foreground text-xs font-mono">{log.ip || '-'}</td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {new Date(log.createdAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent">Prev</button>
              <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} of {pagination.totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent">Next</button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function LoginHistoryTab() {
  const [page, setPage] = useState(1);
  const [userFilter, setUserFilter] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'login-history', page, userFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (userFilter) params.set('userId', userFilter);
      const { data } = await api.get(`/admin/login-history?${params}`);
      return data;
    },
  });

  const history = data?.data || [];
  const pagination = data?.pagination;

  return (
    <>
      <FadeIn direction="up" delay={0.05}>
        <div className="flex gap-3 mb-6">
          <input value={userFilter} onChange={(e) => { setUserFilter(e.target.value); setPage(1); }}
            placeholder="Filter by user ID..."
            className="px-3 py-2 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full sm:w-64" />
        </div>
      </FadeIn>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : history.length === 0 ? (
        <div className="text-center py-12">
          <Clock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No login history found</p>
        </div>
      ) : (
        <>
          <FadeIn direction="up" delay={0.1}>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="text-left p-3 font-medium text-foreground">User</th>
                    <th className="text-left p-3 font-medium text-foreground">IP Address</th>
                    <th className="text-left p-3 font-medium text-foreground">User Agent</th>
                    <th className="text-left p-3 font-medium text-foreground">Status</th>
                    <th className="text-left p-3 font-medium text-foreground">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h: any) => (
                    <tr
                      key={h._id}
                      className="border-t hover:bg-accent/30"
                    >
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-sm text-foreground">{h.user?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{h.user?.email || ''}</p>
                        </div>
                      </td>
                      <td className="p-3 text-xs font-mono text-muted-foreground">{h.ip || '-'}</td>
                      <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{h.userAgent || '-'}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          h.success !== false
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        }`}>
                          {h.success !== false ? 'Success' : 'Failed'}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">
                        {new Date(h.createdAt).toLocaleString('en-US', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </FadeIn>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent">Prev</button>
              <span className="px-3 py-1 text-sm text-muted-foreground">Page {page} of {pagination.totalPages}</span>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages}
                className="px-3 py-1 border rounded text-sm disabled:opacity-50 hover:bg-accent">Next</button>
            </div>
          )}
        </>
      )}
    </>
  );
}
