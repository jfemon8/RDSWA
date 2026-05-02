import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { FileText, Download, Search, Mail, X, ChevronDown, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FadeIn, BlurText } from '@/components/reactbits';
import { formatDate, formatDateTime } from '@/lib/date';
import SEO from '@/components/SEO';
import RichContent from '@/components/ui/RichContent';
import { useToast } from '@/components/ui/Toast';
import Spinner from '@/components/ui/Spinner';
import EmptyState from '@/components/ui/EmptyState';
import Promo from '@/components/promo/Promo';
import { proxyFileUrl } from '@/lib/fileProxy';

export default function DocumentsPage() {
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const toast = useToast();

  const toggleExpand = (id: string) => setExpandedId((cur) => (cur === id ? null : id));

  /**
   * Hit the counter endpoint then open the file via our proxy so the browser
   * sees the proper Content-Type (PDFs preview inline instead of downloading
   * as opaque binary blobs).
   */
  const handleDownload = async (docId: string, fileUrl: string, title?: string) => {
    try {
      await api.get(`/documents/${docId}/download`);
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    } catch {
      /* non-fatal — still open the file */
    }
    if (!fileUrl) {
      toast.error('File URL is missing');
      return;
    }
    const params = new URLSearchParams({ url: fileUrl, inline: 'true' });
    if (title) params.set('name', title);
    window.open(`/api/upload/proxy?${params.toString()}`, '_blank', 'noopener');
  };

  const { data, isLoading } = useQuery({
    queryKey: ['documents', category, search],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '50' });
      if (category) params.set('category', category);
      if (search) params.set('search', search);
      const { data } = await api.get(`/documents?${params}`);
      return data;
    },
  });

  const documents = data?.data || [];
  const categories = ['', 'policy', 'resolution', 'report', 'form', 'other'];

  const getFileIcon = (_type: string) => {
    return <FileText className="h-8 w-8 text-primary" />;
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="container mx-auto py-8">
      <SEO
        title="Documents"
        description="Official RDSWA documents — constitution, policies, meeting resolutions, financial reports, membership forms, and downloadable resources for the University of Barishal Rangpur student community. RDSWA ডকুমেন্টস ও ফরম।"
        keywords="RDSWA documents, RDSWA constitution, RDSWA policies, RDSWA membership form, RDSWA financial report, BU Rangpur documents, RDSWA ডকুমেন্ট, RDSWA ফরম"
      />
      <BlurText
        text="Documents"
        className="text-2xl sm:text-3xl md:text-4xl font-bold mb-6"
        delay={80}
        animateBy="words"
        direction="bottom"
      />

      <FadeIn delay={0.1} direction="up">
        <div className="flex flex-wrap gap-3 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents..."
              className="w-full pl-10 pr-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50" />
          </div>
          <div className="flex gap-2 flex-wrap">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-2 text-sm rounded-md border capitalize ${
                  category === c ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent'
                }`}
              >
                {c || 'All'}
              </button>
            ))}
          </div>
        </div>
      </FadeIn>

      {/* lg+ adds a sticky right-rail promo. Below lg the sidebar is hidden
          and the document list takes the full container width. */}
      <div className="lg:flex lg:gap-6">
        <div className="flex-1 min-w-0">
      {isLoading ? (
        <Spinner size="md" />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title={search || category ? 'No Matches' : 'No Documents Yet'}
          description={search || category
            ? 'No documents match your current filters. Try a different search term or category.'
            : 'No documents have been uploaded yet. Contact an admin if you need a specific document.'}
          primary={search || category
            ? { label: 'Clear Filters', icon: X, onClick: () => { setSearch(''); setCategory(''); } }
            : { label: 'Contact Admin', icon: Mail, to: '/contact' }}
          hint="Policies, resolutions, reports and forms published by RDSWA will appear here once uploaded."
        />
      ) : (
        <div className="space-y-3">
          {documents.map((doc: any, index: number) => {
            const isExpanded = expandedId === doc._id;
            const filename = doc.fileUrl ? doc.fileUrl.split('/').pop() : '';
            const previewUrl = doc.fileUrl ? proxyFileUrl(doc.fileUrl, doc.title || filename, true) : '';
            return (
            <FadeIn key={doc._id} delay={0.05 * index} direction="up">
              <div className="border rounded-lg bg-card overflow-hidden">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(doc._id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleExpand(doc._id); } }}
                  className="w-full p-4 flex items-center gap-4 text-left hover:bg-accent/30 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40"
                  aria-expanded={isExpanded}
                >
                  {getFileIcon(doc.fileType)}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate text-foreground">{doc.title}</h3>
                    {doc.description && !isExpanded && (
                      <RichContent html={doc.description} className="text-sm text-muted-foreground line-clamp-1 mt-0.5" />
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                      <span className="capitalize">{doc.category}</span>
                      {doc.fileType && <span className="uppercase">{doc.fileType}</span>}
                      {doc.fileSize && <span>{formatSize(doc.fileSize)}</span>}
                      {doc.downloadCount > 0 && <span>{doc.downloadCount} downloads</span>}
                      <span>{formatDate(doc.createdAt)}</span>
                    </div>
                  </div>
                  <motion.span
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className="shrink-0 text-muted-foreground"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </motion.span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDownload(doc._id, doc.fileUrl, doc.title); }}
                    className="shrink-0 p-2 text-primary hover:bg-primary/10 rounded-md"
                    title="Download"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-3 border-t bg-muted/20 space-y-3 text-sm">
                        {doc.description ? (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                            <div className="rounded border bg-background p-3">
                              <RichContent html={doc.description} />
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground italic">No description provided.</p>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div>
                            <p className="font-medium text-muted-foreground mb-0.5">Category</p>
                            <p className="text-foreground capitalize">{doc.category}</p>
                          </div>
                          <div>
                            <p className="font-medium text-muted-foreground mb-0.5">File type</p>
                            <p className="text-foreground uppercase">{doc.fileType || '—'}</p>
                          </div>
                          <div>
                            <p className="font-medium text-muted-foreground mb-0.5">Size</p>
                            <p className="text-foreground">{formatSize(doc.fileSize) || '—'}</p>
                          </div>
                          <div>
                            <p className="font-medium text-muted-foreground mb-0.5">Downloads</p>
                            <p className="text-foreground">{doc.downloadCount || 0}</p>
                          </div>
                          <div className="col-span-2 sm:col-span-2">
                            <p className="font-medium text-muted-foreground mb-0.5">Uploaded</p>
                            <p className="text-foreground">{doc.createdAt ? formatDateTime(doc.createdAt) : '—'}</p>
                          </div>
                          {doc.uploadedBy?.name && (
                            <div className="col-span-2 sm:col-span-2">
                              <p className="font-medium text-muted-foreground mb-0.5">Uploaded by</p>
                              <p className="text-foreground">{doc.uploadedBy.name}</p>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1">
                          {previewUrl && (
                            <a
                              href={previewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border hover:bg-accent text-foreground"
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Preview
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDownload(doc._id, doc.fileUrl, doc.title); }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                          >
                            <Download className="h-3.5 w-3.5" /> Download
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </FadeIn>
            );
          })}
        </div>
      )}

      {/* Bottom display banner — appears below the document list on every
          breakpoint. Distinct from the sidebar promo so we get one
          impression on mobile (where the sidebar is hidden). */}
      {documents.length > 0 && (
        <div className="mt-8 empty:hidden">
          <Promo kind="displayResponsive" minHeight={250} />
        </div>
      )}
        </div>
        <aside className="hidden lg:block lg:empty:hidden w-72 shrink-0 sticky top-20 self-start">
          <Promo kind="sidebar" minHeight={600} />
        </aside>
      </div>
    </div>
  );
}
