import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import {
  Database, Loader2, Download, Upload, RefreshCw, AlertTriangle, FileJson, HardDrive, Search,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmModal';

interface CollectionInfo {
  name: string;
  count: number;
}

interface BackupInfo {
  database: string;
  collections: CollectionInfo[];
  totalCollections: number;
  totalDocuments: number;
}

export default function AdminBackupPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<string | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'backup', 'info'],
    queryFn: async () => {
      const { data } = await api.get('/admin/backup/info');
      return data;
    },
  });

  const info: BackupInfo | null = data?.data || null;

  const restoreMutation = useMutation({
    mutationFn: async (vars: { collection: string; documents: any[]; mode: 'merge' | 'replace' }) => {
      const { data } = await api.post(`/admin/backup/restore/${vars.collection}`, {
        documents: vars.documents,
        mode: vars.mode,
      });
      return data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'backup', 'info'] });
      setRestoreTarget(null);
      toast.success(res?.message || 'Restore complete');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Restore failed'),
  });

  /** Download the selected collection as a JSON file via the export endpoint. */
  const handleExport = async (collectionName: string) => {
    try {
      const res = await api.get(`/admin/backup/export/${collectionName}`, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${collectionName}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Exported ${collectionName}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Export failed');
    }
  };

  /** Prompt for a JSON file and send it back to the restore endpoint. */
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !restoreTarget) return;

    const ok = await confirm({
      title: restoreMode === 'replace' ? 'Replace collection?' : 'Merge into collection?',
      message: restoreMode === 'replace'
        ? `This will DELETE all existing documents in "${restoreTarget}" and replace them with the file contents. This cannot be undone.`
        : `Documents from the file will be inserted into "${restoreTarget}". Existing documents with the same _id will be skipped.`,
      confirmLabel: restoreMode === 'replace' ? 'Replace' : 'Merge',
      variant: 'danger',
    });
    if (!ok) {
      e.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        toast.error('Backup file must contain a JSON array of documents');
        return;
      }
      restoreMutation.mutate({ collection: restoreTarget, documents: parsed, mode: restoreMode });
    } catch {
      toast.error('Failed to parse backup file');
    } finally {
      e.target.value = '';
    }
  };

  const startRestore = (collection: string, mode: 'merge' | 'replace') => {
    setRestoreTarget(collection);
    setRestoreMode(mode);
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  const filteredCollections = (info?.collections || []).filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="container mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <Database className="h-6 w-6 text-primary" />
        <BlurText
          text="Database Backup & Restore"
          className="text-2xl sm:text-3xl font-bold"
          delay={80}
          animateBy="words"
          direction="bottom"
        />
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Export collections as JSON snapshots or restore from a backup file. Use with caution on shared infrastructure.
      </p>

      {/* Dangerous operation warning */}
      <FadeIn delay={0.1} direction="up">
        <div className="flex items-start gap-2 p-3 rounded-md border border-amber-200 dark:border-amber-900/40 bg-amber-50/60 dark:bg-amber-900/10 mb-6">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-200">
            <p className="font-semibold">Destructive operations ahead.</p>
            <p>
              "Replace" mode wipes the target collection before inserting. Always export a fresh backup before restoring. Never restore production data into staging or vice-versa.
            </p>
          </div>
        </div>
      </FadeIn>

      {/* Summary + refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap gap-3">
          {info && (
            <>
              <StatCard icon={Database} label="Database" value={info.database} />
              <StatCard icon={HardDrive} label="Collections" value={String(info.totalCollections)} />
              <StatCard icon={FileJson} label="Total docs" value={info.totalDocuments.toLocaleString()} />
            </>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 border rounded-md text-sm hover:bg-accent disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search collections..."
          className="w-full pl-9 pr-3 py-2 border rounded-md bg-card text-foreground text-sm"
        />
      </div>

      {/* Hidden file picker for restore */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Collection list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filteredCollections.length === 0 ? (
        <div className="text-center py-16 text-sm text-muted-foreground">
          No collections match your search.
        </div>
      ) : (
        <div className="border rounded-lg divide-y bg-card">
          <AnimatePresence>
            {filteredCollections.map((col, i) => (
              <motion.div
                key={col.name}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="p-3 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-accent/30"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{col.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {col.count.toLocaleString()} document{col.count === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => handleExport(col.name)}
                    className="flex items-center gap-1 px-2.5 py-1 border rounded-md text-xs hover:bg-accent"
                  >
                    <Download className="h-3 w-3" /> Export
                  </button>
                  <button
                    onClick={() => startRestore(col.name, 'merge')}
                    disabled={restoreMutation.isPending && restoreTarget === col.name}
                    className="flex items-center gap-1 px-2.5 py-1 border rounded-md text-xs hover:bg-accent disabled:opacity-50"
                  >
                    <Upload className="h-3 w-3" /> Merge
                  </button>
                  <button
                    onClick={() => startRestore(col.name, 'replace')}
                    disabled={restoreMutation.isPending && restoreTarget === col.name}
                    className="flex items-center gap-1 px-2.5 py-1 border border-destructive/40 text-destructive rounded-md text-xs hover:bg-destructive/10 disabled:opacity-50"
                  >
                    <Upload className="h-3 w-3" /> Replace
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-card">
      <Icon className="h-4 w-4 text-primary" />
      <div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
