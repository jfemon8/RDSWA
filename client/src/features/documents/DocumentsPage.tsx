import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { FileText, Download, Loader2, Search } from 'lucide-react';
import { FadeIn, BlurText } from '@/components/reactbits';

export default function DocumentsPage() {
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');

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
    <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
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

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : documents.length === 0 ? (
        <FadeIn delay={0.1} direction="up">
          <div className="text-center py-12">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No documents found</p>
          </div>
        </FadeIn>
      ) : (
        <div className="space-y-3">
          {documents.map((doc: any, index: number) => (
            <FadeIn key={doc._id} delay={0.05 * index} direction="up">
              <div
                className="border rounded-lg p-4 bg-card flex items-center gap-4"
              >
                {getFileIcon(doc.fileType)}
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium truncate text-foreground">{doc.title}</h3>
                  {doc.description && <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{doc.description}</p>}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                    <span className="capitalize">{doc.category}</span>
                    {doc.fileType && <span className="uppercase">{doc.fileType}</span>}
                    {doc.fileSize && <span>{formatSize(doc.fileSize)}</span>}
                    {doc.downloadCount > 0 && <span>{doc.downloadCount} downloads</span>}
                    <span>{new Date(doc.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })}</span>
                  </div>
                </div>
                <a href={doc.fileUrl} target="_blank" rel="noreferrer"
                  className="shrink-0 p-2 text-primary hover:bg-primary/10 rounded-md" title="Download">
                  <Download className="h-5 w-5" />
                </a>
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}
