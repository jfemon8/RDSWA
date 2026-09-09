import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  Hash,
  MessagesSquare,
  Search,
  User as UserIcon,
  Users,
} from "lucide-react";
import api from "@/lib/api";
import { formatDate } from "@/lib/date";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { FadeIn } from "@/components/reactbits";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import MonitorThreadPanel from "./MonitorThreadPanel";
import {
  MonitorAvatar,
  messagePreview,
  type DmThread,
  type MonitorGroup,
  type MonitorUser,
  type SubjectStats,
} from "./monitorShared";

/** Selection lives in the URL so a thread is linkable and the browser's back button closes it on mobile. */
export default function AdminConversationsPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "groups" ? "groups" : "members";
  const memberId = params.get("member") || "";
  const dmPartnerId = params.get("dm") || "";
  const groupId = params.get("group") || "";
  const hasTarget = !!(dmPartnerId || groupId);

  const update = (next: Record<string, string | null>) => {
    const merged = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) =>
      v ? merged.set(k, v) : merged.delete(k),
    );
    setParams(merged);
  };

  return (
    <FadeIn direction="up">
      <div className="container mx-auto">
        <div className="flex items-start gap-3 mb-3">
          <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary hidden sm:flex items-center justify-center shrink-0">
            <Eye className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-bold text-foreground">
              Conversation Monitor
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Read any conversation and moderate any message.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div
            className={`lg:col-span-4 ${hasTarget ? "hidden lg:block" : ""}`}
          >
            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="flex border-b">
                {(["members", "groups"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() =>
                      update({
                        tab: t === "members" ? null : t,
                        dm: null,
                        group: null,
                      })
                    }
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      tab === t
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t === "members" ? (
                      <UserIcon className="h-4 w-4" />
                    ) : (
                      <Users className="h-4 w-4" />
                    )}
                    {t === "members" ? "By Member" : "All Groups"}
                  </button>
                ))}
              </div>

              {tab === "members" ? (
                memberId ? (
                  <SubjectConversations
                    memberId={memberId}
                    activeId={dmPartnerId || groupId}
                    onBack={() =>
                      update({ member: null, dm: null, group: null })
                    }
                    onPickDm={(id) => update({ dm: id, group: null })}
                    onPickGroup={(id) => update({ group: id, dm: null })}
                  />
                ) : (
                  <MemberSearch
                    onPick={(id) =>
                      update({ member: id, dm: null, group: null })
                    }
                  />
                )
              ) : (
                <GroupBrowser
                  activeId={groupId}
                  onPick={(id) => update({ group: id, dm: null })}
                />
              )}
            </div>
          </div>

          <div
            className={`lg:col-span-8 ${hasTarget ? "" : "hidden lg:block"}`}
          >
            {hasTarget ? (
              <MonitorThreadPanel
                memberId={memberId || undefined}
                dmPartnerId={dmPartnerId || undefined}
                groupId={groupId || undefined}
                onClose={() => update({ dm: null, group: null })}
              />
            ) : (
              <EmptyState
                icon={MessagesSquare}
                title="No conversation open"
                description="Pick a member to see who they talk to, or open any group directly."
                noWrapper
              />
            )}
          </div>
        </div>
      </div>
    </FadeIn>
  );
}

function MemberSearch({ onPick }: { onPick: (id: string) => void }) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);

  const { data: users = [], isFetching } = useQuery<MonitorUser[]>({
    queryKey: ["admin", "monitor", "users", debounced],
    queryFn: async () => {
      const { data } = await api.get(
        `/users?limit=20&search=${encodeURIComponent(debounced)}`,
      );
      return data.data || [];
    },
  });

  return (
    <div>
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members by name or email..."
            className="w-full pl-9 pr-3 py-2 border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      <div className="max-h-[calc(100dvh-22rem)] min-h-[14rem] lg:max-h-[32rem] overflow-y-auto divide-y">
        {isFetching && users.length === 0 ? (
          <div className="py-8">
            <Spinner size="sm" />
          </div>
        ) : users.length === 0 ? (
          <p className="px-4 py-8 text-sm text-center text-muted-foreground">
            No members found.
          </p>
        ) : (
          users.map((u) => (
            <button
              key={u._id}
              onClick={() => onPick(u._id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-accent transition-colors"
            >
              <MonitorAvatar user={u} />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-foreground truncate">
                  {u.name}
                </span>
                <span className="block text-xs text-muted-foreground truncate">
                  {u.email}
                </span>
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function SubjectConversations({
  memberId,
  activeId,
  onBack,
  onPickDm,
  onPickGroup,
}: {
  memberId: string;
  activeId: string;
  onBack: () => void;
  onPickDm: (id: string) => void;
  onPickGroup: (id: string) => void;
}) {
  const { data, isLoading } = useQuery<{
    user: MonitorUser;
    conversations: DmThread[];
    groups: MonitorGroup[];
    stats: SubjectStats;
  }>({
    queryKey: ["admin", "monitor", "conversations", memberId],
    queryFn: async () =>
      (await api.get(`/communication/monitor/users/${memberId}`)).data.data,
  });

  return (
    <div>
      <div className="flex items-center gap-2 px-2 py-2.5 border-b sm:px-3">
        <button
          onClick={onBack}
          className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-foreground shrink-0"
          title="Back to member search"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <MonitorAvatar user={data?.user} />
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground truncate">
            {data?.user?.name || "…"}
          </span>
          <span className="block text-xs text-muted-foreground truncate">
            {data?.user?.email}
          </span>
        </span>
      </div>

      {isLoading ? (
        <div className="py-10">
          <Spinner size="sm" />
        </div>
      ) : (
        <>
          {data?.stats && (
            <div className="grid grid-cols-3 divide-x border-b text-center">
              <Stat label="Messages" value={data.stats.sent} />
              <Stat label="Direct" value={data.stats.directMessages} />
              <Stat label="In groups" value={data.stats.groupMessages} />
            </div>
          )}
          {data?.stats?.lastAt && (
            <p className="px-3 py-1.5 text-[11px] text-muted-foreground border-b">
              Last active {formatDate(data.stats.lastAt)}
            </p>
          )}

          <div className="max-h-[calc(100dvh-30rem)] min-h-[12rem] lg:max-h-[28rem] overflow-y-auto">
            <SectionLabel>
              Direct messages ({data?.conversations.length || 0})
            </SectionLabel>
            {data?.conversations.length === 0 && (
              <p className="px-3 pb-3 text-sm text-muted-foreground">
                No direct conversations.
              </p>
            )}
            <div className="divide-y">
              {data?.conversations.map((c) => (
                <button
                  key={c.partner._id}
                  onClick={() => onPickDm(c.partner._id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                    activeId === c.partner._id
                      ? "bg-primary/10"
                      : "hover:bg-accent"
                  }`}
                >
                  <MonitorAvatar user={c.partner} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground truncate">
                      {c.partner.name}
                    </span>
                    <span className="block text-xs text-muted-foreground truncate">
                      {messagePreview(c.lastMessage)}
                    </span>
                  </span>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {c.messageCount}
                  </span>
                </button>
              ))}
            </div>

            <SectionLabel>Groups ({data?.groups.length || 0})</SectionLabel>
            {data?.groups.length === 0 && (
              <p className="px-3 pb-3 text-sm text-muted-foreground">
                Not a member of any group.
              </p>
            )}
            <div className="divide-y">
              {data?.groups.map((g) => (
                <GroupRow
                  key={g._id}
                  group={g}
                  active={activeId === g._id}
                  onClick={() => onPickGroup(g._id)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function GroupBrowser({
  activeId,
  onPick,
}: {
  activeId: string;
  onPick: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search);

  const { data: groups = [], isLoading } = useQuery<MonitorGroup[]>({
    queryKey: ["admin", "monitor", "groups", debounced],
    queryFn: async () =>
      (
        await api.get(
          `/communication/monitor/groups?search=${encodeURIComponent(debounced)}`,
        )
      ).data.data,
  });

  return (
    <div>
      <div className="p-3 border-b">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search groups..."
            className="w-full pl-9 pr-3 py-2 border rounded-md bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      <div className="max-h-[calc(100dvh-22rem)] min-h-[14rem] lg:max-h-[32rem] overflow-y-auto divide-y">
        {isLoading ? (
          <div className="py-8">
            <Spinner size="sm" />
          </div>
        ) : groups.length === 0 ? (
          <p className="px-4 py-8 text-sm text-center text-muted-foreground">
            No groups found.
          </p>
        ) : (
          groups.map((g) => (
            <GroupRow
              key={g._id}
              group={g}
              active={activeId === g._id}
              onClick={() => onPick(g._id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function GroupRow({
  group,
  active,
  onClick,
}: {
  group: MonitorGroup;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
        active ? "bg-primary/10" : "hover:bg-accent"
      }`}
    >
      {group.avatar ? (
        <img
          src={group.avatar}
          alt=""
          loading="lazy"
          className="h-9 w-9 rounded-full object-cover shrink-0"
        />
      ) : (
        <span className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-muted-foreground">
          <Hash className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground truncate">
          {group.name}
        </span>
        <span className="block text-xs text-muted-foreground truncate">
          {group.lastMessage?.sender?.name
            ? `${group.lastMessage.sender.name}: `
            : ""}
          {messagePreview(group.lastMessage)}
        </span>
      </span>
      <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
        <Users className="h-3 w-3" /> {group.memberCount}
      </span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="py-2">
      <p className="text-sm font-semibold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
