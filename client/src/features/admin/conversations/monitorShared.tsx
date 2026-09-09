import { User as UserIcon } from 'lucide-react';

export interface MonitorUser {
  _id: string;
  name: string;
  email?: string;
  avatar?: string;
  role?: string;
  batch?: string;
  department?: string;
}

export interface MonitorGroup {
  _id: string;
  name: string;
  type: string;
  avatar?: string;
  memberCount: number;
  lastMessage?: { content?: string; attachments?: any[]; sender?: { name?: string } | null; createdAt?: string } | null;
  lastActivityAt?: string;
}

export interface DmThread {
  partner: MonitorUser;
  lastMessage?: { content?: string; attachments?: any[]; createdAt?: string } | null;
  messageCount: number;
}

export interface SubjectStats {
  sent: number;
  groupMessages: number;
  directMessages: number;
  firstAt: string | null;
  lastAt: string | null;
}

/** One-line preview of a message, standing in for an attachment when there is no text. */
export function messagePreview(message?: { content?: string; attachments?: any[] } | null): string {
  if (!message) return 'No messages yet';
  if (message.content) return message.content;
  const kind = message.attachments?.[0]?.kind;
  return kind ? `[${kind}]` : 'No messages yet';
}

export function MonitorAvatar({
  user,
  size = 'h-9 w-9',
}: {
  user?: { name?: string; avatar?: string } | null;
  size?: string;
}) {
  if (user?.avatar) {
    return <img src={user.avatar} alt="" loading="lazy" className={`${size} rounded-full object-cover shrink-0`} />;
  }
  return (
    <span className={`${size} rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground`}>
      <UserIcon className="h-1/2 w-1/2" />
    </span>
  );
}
