import { Link } from 'react-router-dom';

interface Props {
  message: string;
  /** Notification metadata, which carries `actorId` / `actorName` when a person triggered it. */
  metadata?: { actorId?: string; actorName?: string } | null;
  className?: string;
}

/** Notification body that turns the acting member's name into a link to their profile. */
export default function NotificationMessage({ message, metadata, className = '' }: Props) {
  const text = message || '';
  const name = metadata?.actorName;
  const id = metadata?.actorId;
  const at = name && id ? text.indexOf(name) : -1;

  // Older notifications carry no actor, so they render as the plain sentence they always were.
  if (at < 0) return <p className={className}>{text}</p>;

  return (
    <p className={className}>
      {text.slice(0, at)}
      <Link
        to={`/members/${id}`}
        onClick={(e) => e.stopPropagation()}
        className="font-medium text-primary hover:underline"
      >
        {name}
      </Link>
      {text.slice(at + name!.length)}
    </p>
  );
}
