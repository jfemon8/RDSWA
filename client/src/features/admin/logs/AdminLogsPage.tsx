import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FadeIn } from '@/components/reactbits';
import api from '@/lib/api';
import { Loader2, Shield, Clock, AlertTriangle } from 'lucide-react';
import { formatDateTime } from '@/lib/date';

type Tab = 'audit' | 'login' | 'suspicious';

export default function AdminLogsPage() {
  const [tab, setTab] = useState<Tab>('audit');

  return (
    <FadeIn direction="up">
      <div className="container mx-auto">
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
          <button
            onClick={() => setTab('suspicious')}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 ${
              tab === 'suspicious' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <AlertTriangle className="h-4 w-4" /> Suspicious Activity
          </button>
        </div>

        {tab === 'audit' && <AuditLogsTab />}
        {tab === 'login' && <LoginHistoryTab />}
        {tab === 'suspicious' && <SuspiciousActivityTab />}
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
                        {formatDateTime(log.createdAt)}
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
                        {formatDateTime(h.createdAt)}
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

function SuspiciousActivityTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'suspicious-activity'],
    queryFn: async () => {
      const { data } = await api.get('/admin/suspicious-activity');
      return data;
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  const { failedByIp = [], failedByUser = [], multipleIps = [] } = data?.data || {};

  const hasNoData = failedByIp.length === 0 && failedByUser.length === 0 && multipleIps.length === 0;

  if (hasNoData) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">No suspicious activity detected in the last 24 hours</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Failed logins by IP */}
      {failedByIp.length > 0 && (
        <FadeIn direction="up" delay={0.1}>
          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-red-50 dark:bg-red-900/20 border-b">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Failed Logins by IP (5+ in 24h)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="text-left p-3 font-medium text-foreground">IP Address</th>
                    <th className="text-left p-3 font-medium text-foreground">Attempts</th>
                    <th className="text-left p-3 font-medium text-foreground">Last Attempt</th>
                  </tr>
                </thead>
                <tbody>
                  {failedByIp.map((item: any) => (
                    <tr key={item._id} className="border-t hover:bg-accent/30">
                      <td className="p-3 font-mono text-xs text-muted-foreground">{item._id || '-'}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                          {item.count}
                        </span>
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{formatDateTime(item.lastAttempt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Failed logins by user */}
      {failedByUser.length > 0 && (
        <FadeIn direction="up" delay={0.2}>
          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-orange-50 dark:bg-orange-900/20 border-b">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Failed Logins by User (3+ in 24h)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="text-left p-3 font-medium text-foreground">User</th>
                    <th className="text-left p-3 font-medium text-foreground">Attempts</th>
                    <th className="text-left p-3 font-medium text-foreground">IPs</th>
                    <th className="text-left p-3 font-medium text-foreground">Last Attempt</th>
                  </tr>
                </thead>
                <tbody>
                  {failedByUser.map((item: any) => (
                    <tr key={item._id} className="border-t hover:bg-accent/30">
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-sm text-foreground">{item.userInfo?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{item.userInfo?.email || ''}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                          {item.count}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground font-mono">
                        {(item.ips || []).join(', ')}
                      </td>
                      <td className="p-3 text-muted-foreground text-xs">{formatDateTime(item.lastAttempt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </FadeIn>
      )}

      {/* Multiple IP logins */}
      {multipleIps.length > 0 && (
        <FadeIn direction="up" delay={0.3}>
          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-b">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Multiple IP Logins (3+ IPs in 24h)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-sm">
                <thead>
                  <tr className="bg-muted border-b">
                    <th className="text-left p-3 font-medium text-foreground">User</th>
                    <th className="text-left p-3 font-medium text-foreground">IP Count</th>
                    <th className="text-left p-3 font-medium text-foreground">IPs</th>
                  </tr>
                </thead>
                <tbody>
                  {multipleIps.map((item: any) => (
                    <tr key={item._id} className="border-t hover:bg-accent/30">
                      <td className="p-3">
                        <div>
                          <p className="font-medium text-sm text-foreground">{item.userInfo?.name || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground">{item.userInfo?.email || ''}</p>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                          {(item.ips || []).length}
                        </span>
                      </td>
                      <td className="p-3 text-xs text-muted-foreground font-mono">
                        {(item.ips || []).join(', ')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  );
}
