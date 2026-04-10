import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Paperclip, Image as ImageIcon, Video, Music, FileText, File as FileIcon, UserRound, X, Loader2, Search, Smartphone, PencilLine, Users as UsersIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

/**
 * Browser API: navigator.contacts.select() — only on Android Chrome (and only
 * via HTTPS or localhost). Not in standard TS lib, so we declare a minimal
 * shape here. Detection happens at runtime.
 */
interface ContactsManager {
  select(properties: string[], options?: { multiple?: boolean }): Promise<Array<{
    name?: string[];
    tel?: string[];
    email?: string[];
  }>>;
  getProperties(): Promise<string[]>;
}
function getContactsManager(): ContactsManager | null {
  const contacts = (navigator as any)?.contacts;
  if (contacts && typeof contacts.select === 'function') {
    return contacts as ContactsManager;
  }
  return null;
}

export type ChatAttachment = {
  kind: 'image' | 'video' | 'audio' | 'pdf' | 'file' | 'contact';
  url?: string;
  publicId?: string;
  resourceType?: 'image' | 'video' | 'raw';
  name?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  contact?: {
    userId?: string;
    name: string;
    phone?: string;
    email?: string;
    avatar?: string;
  };
};

/** Per-kind file size limits enforced client-side before upload (bytes). */
const SIZE_LIMITS: Record<string, { bytes: number; label: string }> = {
  image: { bytes: 10 * 1024 * 1024, label: '10 MB' },
  video: { bytes: 50 * 1024 * 1024, label: '50 MB' },
  audio: { bytes: 10 * 1024 * 1024, label: '10 MB' },
  pdf: { bytes: 10 * 1024 * 1024, label: '10 MB' },
  file: { bytes: 10 * 1024 * 1024, label: '10 MB' },
};

/** Accept strings passed to <input type="file"> per kind. */
const ACCEPT: Record<string, string> = {
  image: 'image/*',
  video: 'video/*',
  audio: 'audio/*',
  pdf: 'application/pdf',
  file: '*/*',
};

interface ChatAttachmentMenuProps {
  /** Called when an attachment has been uploaded/selected and is ready to send. */
  onSelect: (attachment: ChatAttachment) => void;
  /** Disable the trigger (e.g. while sending). */
  disabled?: boolean;
}

/**
 * Paperclip button that opens a popover with 6 attachment options:
 * Image, Video, Audio, PDF, File, Contact.
 * Handles upload to /upload/chat-media for media kinds; contact uses an inline
 * member search that produces a contact attachment (no upload).
 */
export default function ChatAttachmentMenu({ onSelect, disabled }: ChatAttachmentMenuProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingKind, setPendingKind] = useState<keyof typeof ACCEPT | null>(null);

  const trigger = (kind: keyof typeof ACCEPT) => {
    setPendingKind(kind);
    setOpen(false);
    // Delay one tick so the popover closes before the file picker opens
    setTimeout(() => fileInputRef.current?.click(), 0);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file
    if (!file || !pendingKind) return;

    const limit = SIZE_LIMITS[pendingKind];
    if (limit && file.size > limit.bytes) {
      toast.error(`File too large. ${pendingKind} limit is ${limit.label}.`);
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post('/upload/chat-media', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const payload = data?.data || data;
      onSelect({
        kind: payload.kind,
        url: payload.url,
        publicId: payload.publicId,
        resourceType: payload.resourceType,
        name: payload.name,
        mimeType: payload.mimeType,
        size: payload.size,
        width: payload.width,
        height: payload.height,
        duration: payload.duration,
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Upload failed');
    } finally {
      setUploading(false);
      setPendingKind(null);
    }
  };

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={pendingKind ? ACCEPT[pendingKind] : undefined}
        onChange={handleFile}
      />

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled || uploading}
        className="h-11 w-11 shrink-0 flex items-center justify-center rounded-full hover:bg-accent text-muted-foreground disabled:opacity-50 transition-colors"
        aria-label="Attach media"
        title="Attach"
      >
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <Paperclip className="h-5 w-5" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute bottom-12 left-0 z-50 bg-card border rounded-xl shadow-lg p-2 w-56"
            >
              <MenuItem icon={ImageIcon} label="Image" hint="JPEG, PNG, WebP · 10 MB" onClick={() => trigger('image')} />
              <MenuItem icon={Video} label="Video" hint="MP4, WebM · 50 MB" onClick={() => trigger('video')} />
              <MenuItem icon={Music} label="Audio" hint="MP3, WAV · 10 MB" onClick={() => trigger('audio')} />
              <MenuItem icon={FileText} label="PDF" hint="Documents · 10 MB" onClick={() => trigger('pdf')} />
              <MenuItem icon={FileIcon} label="File" hint="Any file · 10 MB" onClick={() => trigger('file')} />
              <div className="border-t my-1" />
              <MenuItem icon={UserRound} label="Contact" hint="Share a member profile" onClick={() => { setOpen(false); setContactOpen(true); }} />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {contactOpen && (
          <ContactPicker
            onClose={() => setContactOpen(false)}
            onSelect={(contact) => {
              onSelect({ kind: 'contact', contact });
              setContactOpen(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  hint,
  onClick,
}: {
  icon: typeof Paperclip;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent text-left transition-colors"
    >
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-[10px] text-muted-foreground truncate">{hint}</p>
      </div>
    </button>
  );
}

type ContactMode = 'member' | 'phone' | 'manual';

/**
 * Modal contact picker with three modes:
 *  - member: search the RDSWA member directory (existing flow)
 *  - phone:  use the Web Contacts API to pick from the user's phone (Android Chrome only)
 *  - manual: type in name + phone/email manually
 *
 * Returns a normalized ChatAttachment.contact payload to the caller via onSelect.
 */
function ContactPicker({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (contact: NonNullable<ChatAttachment['contact']>) => void;
}) {
  const [mode, setMode] = useState<ContactMode>('member');

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="bg-card border rounded-xl shadow-xl w-full max-w-md p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm">Share Contact</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md hover:bg-accent text-muted-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 mb-3 p-1 bg-muted rounded-lg text-xs">
          <ModeTab active={mode === 'member'} onClick={() => setMode('member')} icon={UsersIcon} label="Member" />
          <ModeTab active={mode === 'phone'} onClick={() => setMode('phone')} icon={Smartphone} label="From Phone" />
          <ModeTab active={mode === 'manual'} onClick={() => setMode('manual')} icon={PencilLine} label="Manual" />
        </div>

        {mode === 'member' && <MemberSearchMode onSelect={onSelect} />}
        {mode === 'phone' && <PhoneContactMode onSelect={onSelect} />}
        {mode === 'manual' && <ManualContactMode onSelect={onSelect} />}
      </motion.div>
    </motion.div>
  );
}

function ModeTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Paperclip;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md transition-colors ${
        active ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="font-medium">{label}</span>
    </button>
  );
}

function MemberSearchMode({ onSelect }: { onSelect: (contact: NonNullable<ChatAttachment['contact']>) => void }) {
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['contact-picker-members', search],
    queryFn: async () => {
      const { data } = await api.get(`/users/members?search=${encodeURIComponent(search)}&limit=15`);
      return data.data;
    },
    enabled: search.length >= 2,
  });

  const results = data || [];

  return (
    <>
      <div className="relative mb-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members by name or email..."
          className="w-full pl-9 pr-3 py-2.5 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          autoFocus
        />
      </div>
      <div className="max-h-80 overflow-y-auto">
        {search.length < 2 ? (
          <p className="text-center text-xs text-muted-foreground py-6">Type at least 2 characters to search.</p>
        ) : isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : results.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-6">No members found.</p>
        ) : (
          <ul className="space-y-1">
            {results.map((u: any) => (
              <li key={u._id}>
                <button
                  type="button"
                  onClick={() => onSelect({
                    userId: u._id,
                    name: u.name,
                    phone: u.phone,
                    email: u.email,
                    avatar: u.avatar,
                  })}
                  className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent text-left"
                >
                  {u.avatar ? (
                    <img src={u.avatar} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <UserRound className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    {u.department && <p className="text-[11px] text-muted-foreground truncate">{u.department}</p>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function PhoneContactMode({ onSelect }: { onSelect: (contact: NonNullable<ChatAttachment['contact']>) => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Array<{ name: string; phone?: string; email?: string }>>([]);
  const cm = getContactsManager();

  const handlePick = async () => {
    if (!cm) {
      toast.error('Your browser does not support the phone contacts API. Use Manual entry instead.');
      return;
    }
    setLoading(true);
    try {
      // Request the most-supported subset of properties.
      const props = ['name', 'tel', 'email'];
      const contacts = await cm.select(props, { multiple: true });
      const normalized = contacts
        .map((c) => ({
          name: c.name?.[0] || '',
          phone: c.tel?.[0],
          email: c.email?.[0],
        }))
        .filter((c) => c.name);
      if (normalized.length === 0) {
        toast.info('No contacts selected');
      }
      setPicked(normalized);
    } catch (err: any) {
      // User cancelled or permission denied — silent.
      if (err?.name !== 'AbortError') {
        console.error('contacts.select error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  if (!cm) {
    return (
      <div className="text-center py-8 px-4">
        <Smartphone className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground mb-1">Phone contacts unavailable</p>
        <p className="text-[11px] text-muted-foreground">
          The Web Contacts API only works on Android Chrome over HTTPS.
          Use the <strong>Manual</strong> tab to type a contact instead.
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handlePick}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
        {loading ? 'Opening picker…' : 'Pick from phone'}
      </button>
      {picked.length > 0 && (
        <ul className="space-y-1 max-h-64 overflow-y-auto mt-3">
          {picked.map((c, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => onSelect({ name: c.name, phone: c.phone, email: c.email })}
                className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent text-left"
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <UserRound className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {c.phone || c.email || 'No contact info'}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ManualContactMode({ onSelect }: { onSelect: (contact: NonNullable<ChatAttachment['contact']>) => void }) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Contact name is required');
      return;
    }
    if (!phone.trim() && !email.trim()) {
      toast.error('Add a phone number or email');
      return;
    }
    onSelect({
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name *"
        className="w-full px-3 py-2.5 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        autoFocus
      />
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="Phone"
        className="w-full px-3 py-2.5 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        className="w-full px-3 py-2.5 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <button
        type="submit"
        className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm"
      >
        Share Contact
      </button>
    </form>
  );
}
