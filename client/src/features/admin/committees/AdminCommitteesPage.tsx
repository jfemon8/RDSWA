import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { FieldError } from "@/components/ui/FieldError";
import { extractFieldErrors } from "@/lib/formErrors";
import { queryKeys } from "@/lib/queryKeys";
import RichTextEditor from "@/components/ui/RichTextEditor";
import {
  Plus,
  Pencil,
  Archive,
  UserPlus,
  UserMinus,
  Search,
  ChevronDown,
  ChevronUp,
  Trash2,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { FadeIn } from "@/components/reactbits";
import { CommitteePosition, UserRole } from "@rdswa/shared";
import { useAuthStore } from "@/stores/authStore";
import { useConfirm } from "@/components/ui/ConfirmModal";
import { hasMinRole } from "@/lib/roles";
import Spinner from "@/components/ui/Spinner";
import {
  UNIQUE_POSITIONS,
  formatPosition,
  isCurrentCommittee,
  memberDisplayPosition,
  supportsDesignation,
  takenUniquePositions,
} from "@/lib/committee";

const POSITIONS = Object.values(CommitteePosition);

interface PickedMember {
  user: string;
  name: string;
  email?: string;
  position: string;
  designation?: string;
}

export default function AdminCommitteesPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const { user: currentUser } = useAuthStore();
  const canDelete = currentUser?.role
    ? hasMinRole(currentUser.role, UserRole.ADMIN)
    : false;
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
  });
  const [stagedMembers, setStagedMembers] = useState<PickedMember[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const resetForm = () => {
    setForm({ name: "", description: "", startDate: "", endDate: "" });
    setStagedMembers([]);
    setErrors({});
  };

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.committees.all,
    queryFn: async () => {
      const { data } = await api.get("/committees");
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: form.name,
        description: form.description,
        tenure: { startDate: form.startDate },
      };
      // Always send the end date so clearing it on an edit reopens the committee as the current one.
      payload.tenure.endDate = form.endDate || "";
      if (editId) {
        const { data } = await api.patch(`/committees/${editId}`, payload);
        return data;
      }
      payload.members = stagedMembers.map((m) => ({
        user: m.user,
        position: m.position,
        ...(m.designation ? { designation: m.designation } : {}),
      }));
      const { data } = await api.post("/committees", payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.committees.all });
      setShowForm(false);
      setEditId(null);
      resetForm();
      toast.success(editId ? "Committee updated" : "Committee created");
    },
    onError: (err: any) => {
      const fe = extractFieldErrors(err);
      if (fe) {
        setErrors(fe);
      } else {
        toast.error(err.response?.data?.message || "Failed to save committee");
      }
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/committees/${id}/archive`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.committees.all });
      toast.success("Committee archived");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to archive committee");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/committees/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.committees.all });
      toast.success("Committee deleted");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to delete committee");
    },
  });

  const committees = data?.data || [];

  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const startEdit = (c: any) => {
    setEditId(c._id);
    setStagedMembers([]);
    setForm({
      name: c.name,
      description: c.description || "",
      startDate: c.tenure?.startDate
        ? new Date(c.tenure.startDate).toISOString().split("T")[0]
        : "",
      endDate: c.tenure?.endDate
        ? new Date(c.tenure.endDate).toISOString().split("T")[0]
        : "",
    });
    setShowForm(true);
  };

  return (
    <div className="container mx-auto py-4 sm:py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
          Committees
        </h1>
        <button
          onClick={() => {
            setShowForm(true);
            setEditId(null);
            resetForm();
          }}
          className="flex items-center justify-center gap-2 px-4 py-2 sm:py-1.5 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 w-full sm:w-auto whitespace-nowrap"
        >
          <Plus className="h-4 w-4 shrink-0" /> New Committee
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", transitionEnd: { overflow: "visible" } }}
            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="border rounded-lg p-4 sm:p-5 bg-card mb-6">
              <h3 className="font-semibold mb-4 text-foreground">
                {editId ? "Edit" : "Create"} Committee
              </h3>
              <form
                noValidate
                onSubmit={(e) => {
                  e.preventDefault();
                  setErrors({});
                  const errs: Record<string, string> = {};
                  if (!form.name.trim())
                    errs.name = "Committee name is required";
                  if (!form.startDate)
                    errs.startDate = "Start date is required";
                  if (Object.keys(errs).length) {
                    setErrors(errs);
                    return;
                  }
                  createMutation.mutate();
                }}
                className="space-y-3"
              >
                <div>
                  <input
                    placeholder="Committee Name"
                    value={form.name}
                    onChange={(e) => {
                      setForm({ ...form, name: e.target.value });
                      setErrors((prev) => {
                        const { name, ...rest } = prev;
                        return rest;
                      });
                    }}
                    className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.name ? "border-red-500" : ""}`}
                    required
                  />
                  <FieldError message={errors.name} />
                </div>
                <RichTextEditor
                  value={form.description}
                  onChange={(v) => setForm({ ...form, description: v })}
                  placeholder="Committee description..."
                  minHeight="80px"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={(e) => {
                        setForm({ ...form, startDate: e.target.value });
                        setErrors((prev) => {
                          const { startDate, ...rest } = prev;
                          return rest;
                        });
                      }}
                      className={`w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm ${errors.startDate ? "border-red-500" : ""}`}
                      required
                    />
                    <FieldError message={errors.startDate} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={(e) =>
                        setForm({ ...form, endDate: e.target.value })
                      }
                      className="w-full px-3 py-2 border rounded-md bg-card text-foreground text-sm"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Leave the end date empty to make this the current committee.
                </p>

                {!editId && (
                  <StagedMembersField
                    members={stagedMembers}
                    onChange={setStagedMembers}
                  />
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
                  >
                    {createMutation.isPending
                      ? "Saving..."
                      : editId
                        ? "Update"
                        : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setEditId(null);
                      resetForm();
                    }}
                    className="px-4 py-2 border rounded-md text-sm hover:bg-accent text-foreground"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <Spinner size="md" />
      ) : (
        <div className="space-y-3">
          {committees.map((c: any, i: number) => (
            <FadeIn key={c._id} direction="up" delay={i * 0.06}>
              <div className="border rounded-lg bg-card">
                <div className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-foreground">
                        <button
                          type="button"
                          onClick={() => toggleExpand(c._id)}
                          aria-expanded={expandedId === c._id}
                          title="Manage Members"
                          className="text-left hover:text-primary transition-colors cursor-pointer"
                        >
                          {c.name}
                        </button>
                      </h3>
                      {isCurrentCommittee(c) && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                          Current
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {c.tenure?.startDate &&
                        new Date(c.tenure.startDate).getFullYear()}
                      {c.tenure?.endDate
                        ? ` - ${new Date(c.tenure.endDate).getFullYear()}`
                        : " - Present"}
                      {c.members &&
                        ` · ${c.members.filter((m: any) => !m.leftAt).length} members`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => toggleExpand(c._id)}
                      aria-expanded={expandedId === c._id}
                      className="p-2 hover:bg-accent rounded"
                      title="Manage Members"
                    >
                      {expandedId === c._id ? (
                        <ChevronUp className="h-4 w-4 text-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => startEdit(c)}
                      className="p-2 hover:bg-accent rounded"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4 text-foreground" />
                    </button>
                    {isCurrentCommittee(c) && (
                      <button
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Archive Committee",
                            message: `Archive "${c.name}"? Members with auto-assigned roles will be reset accordingly.`,
                            confirmLabel: "Archive",
                            variant: "warning",
                          });
                          if (ok) archiveMutation.mutate(c._id);
                        }}
                        className="p-2 hover:bg-accent rounded"
                        title="Archive"
                      >
                        <Archive className="h-4 w-4 text-foreground" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={async () => {
                          const ok = await confirm({
                            title: "Delete Committee",
                            message: `Are you sure you want to delete "${c.name}"? This action cannot be undone.`,
                            confirmLabel: "Delete",
                            variant: "danger",
                          });
                          if (ok) deleteMutation.mutate(c._id);
                        }}
                        className="p-2 hover:bg-accent rounded"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </button>
                    )}
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === c._id && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto", transitionEnd: { overflow: "visible" } }}
                      exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                      transition={{ duration: 0.3 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t p-4">
                        <CommitteeMembersPanel
                          committeeId={c._id}
                          members={c.members || []}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </FadeIn>
          ))}
        </div>
      )}
    </div>
  );
}

/** Search-and-pick form for one committee member, shared by the create form and the per-committee panel. */
function MemberPicker({
  takenPositions,
  excludedUserIds,
  onAdd,
  onCancel,
  isPending,
  submitLabel,
}: {
  takenPositions: string[];
  excludedUserIds: string[];
  onAdd: (member: PickedMember) => void;
  onCancel: () => void;
  isPending?: boolean;
  submitLabel: string;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<{
    _id: string;
    name: string;
    email?: string;
  } | null>(null);
  const [position, setPosition] = useState<string>(CommitteePosition.MEMBER);
  const [designation, setDesignation] = useState("");

  const { data: searchData } = useQuery({
    queryKey: ["users", "committee-search", search],
    queryFn: async () => {
      const { data } = await api.get(`/users?search=${search}&limit=10`);
      return data;
    },
    enabled: search.length >= 2,
  });

  const searchResults = (searchData?.data || []).filter(
    (u: any) => !excludedUserIds.includes(u._id),
  );

  const submit = () => {
    if (!selected) return;
    onAdd({
      user: selected._id,
      name: selected.name,
      email: selected.email,
      position,
      designation: supportsDesignation(position)
        ? designation.trim() || undefined
        : undefined,
    });
    setSearch("");
    setSelected(null);
    setPosition(CommitteePosition.MEMBER);
    setDesignation("");
  };

  return (
    <div className="border rounded-md p-3 bg-muted/30 space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setSelected(null);
          }}
          placeholder="Search user..."
          className="w-full pl-8 pr-3 py-1.5 border rounded-md bg-card text-foreground text-sm"
        />
      </div>
      {search.length >= 2 && !selected && searchResults.length > 0 && (
        <div className="border rounded-md max-h-32 overflow-y-auto bg-card">
          {searchResults.map((u: any) => (
            <button
              key={u._id}
              type="button"
              onClick={() => {
                setSelected(u);
                setSearch(u.name);
              }}
              className="w-full text-left px-3 py-1.5 text-xs border-b last:border-b-0 hover:bg-accent"
            >
              <span className="text-foreground">{u.name}</span>{" "}
              <span className="text-muted-foreground">({u.email})</span>
            </button>
          ))}
        </div>
      )}
      <select
        value={position}
        onChange={(e) => setPosition(e.target.value)}
        className="w-full px-3 py-1.5 border rounded-md bg-card text-foreground text-sm capitalize"
      >
        {POSITIONS.map((p) => {
          const taken = takenPositions.includes(p);
          return (
            <option key={p} value={p} disabled={taken} className="capitalize">
              {formatPosition(p)}
              {taken ? " [already assigned]" : ""}
            </option>
          );
        })}
      </select>

      <AnimatePresence initial={false}>
        {supportsDesignation(position) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", transitionEnd: { overflow: "visible" } }}
            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <input
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              placeholder="Designation e.g., Executive Member"
              maxLength={100}
              className="w-full px-3 py-1.5 border rounded-md bg-card text-foreground text-sm"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Leave empty to show this person as Member.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-2">
        <motion.button
          type="button"
          onClick={submit}
          disabled={!selected || isPending || takenPositions.includes(position)}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs disabled:opacity-50"
        >
          {isPending ? "Adding..." : submitLabel}
        </motion.button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 border rounded-md text-xs hover:bg-accent text-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Members staged in the create form, held locally until the committee itself is saved. */
function StagedMembersField({
  members,
  onChange,
}: {
  members: PickedMember[];
  onChange: (members: PickedMember[]) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  const takenPositions = members
    .filter((m) => UNIQUE_POSITIONS.includes(m.position))
    .map((m) => m.position);

  return (
    <div className="border rounded-md p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          Members ({members.length})
        </span>
        <button
          type="button"
          onClick={() => setShowPicker(!showPicker)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md"
        >
          <UserPlus className="h-3 w-3" /> Add Member
        </button>
      </div>

      <AnimatePresence>
        {showPicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", transitionEnd: { overflow: "visible" } }}
            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <MemberPicker
              takenPositions={takenPositions}
              excludedUserIds={members.map((m) => m.user)}
              onAdd={(member) => {
                onChange([...members, member]);
                setShowPicker(false);
              }}
              onCancel={() => setShowPicker(false)}
              submitLabel="Add"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {members.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          No members added yet. They can also be added after the committee is
          created.
        </p>
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence initial={false}>
            {members.map((m) => (
              <motion.div
                key={m.user}
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
                className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/40"
              >
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground capitalize truncate">
                    {memberDisplayPosition(m)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onChange(members.filter((x) => x.user !== m.user))
                  }
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded shrink-0"
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function CommitteeMembersPanel({
  committeeId,
  members,
}: {
  committeeId: string;
  members: any[];
}) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const [showAdd, setShowAdd] = useState(false);

  // Count active members only, keeping the header consistent with the collapsed-row label that already filters by `!leftAt`.
  const activeMembers = members.filter((m: any) => !m.leftAt);

  const addMutation = useMutation({
    mutationFn: (member: PickedMember) =>
      api.post(`/committees/${committeeId}/members`, {
        user: member.user,
        position: member.position,
        ...(member.designation ? { designation: member.designation } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.committees.all });
      setShowAdd(false);
      toast.success("Member added");
    },
    onError: (err: any) => {
      const fe = extractFieldErrors(err);
      if (fe) {
        toast.error(Object.values(fe)[0]);
      } else {
        toast.error(err.response?.data?.message || "Failed to add member");
      }
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      api.delete(`/committees/${committeeId}/members/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.committees.all });
      toast.success("Member removed");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || "Failed to remove member");
    },
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground">
          Members ({activeMembers.length})
        </h4>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md"
        >
          <UserPlus className="h-3 w-3" /> Add Member
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto", transitionEnd: { overflow: "visible" } }}
            exit={{ opacity: 0, height: 0, overflow: "hidden" }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <MemberPicker
              takenPositions={takenUniquePositions(members)}
              excludedUserIds={activeMembers
                .map((m: any) => m.user?._id)
                .filter(Boolean)}
              onAdd={(member) => addMutation.mutate(member)}
              onCancel={() => setShowAdd(false)}
              isPending={addMutation.isPending}
              submitLabel="Add"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {activeMembers.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No members in this committee
        </p>
      ) : (
        <div className="space-y-1.5">
          {activeMembers.map((m: any, i: number) => (
            <motion.div
              key={m.user?._id || i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between p-2.5 rounded-md hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {m.user?._id ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/members/${m.user._id}`)}
                    className="shrink-0 cursor-pointer"
                    aria-label={`Open ${m.user?.name || "member"}'s profile`}
                  >
                    {m.user?.avatar ? (
                      <img
                        src={m.user.avatar}
                        alt=""
                        className="w-7 h-7 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-foreground">
                        {m.user?.name?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                  </button>
                ) : m.user?.avatar ? (
                  <img
                    src={m.user.avatar}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-foreground shrink-0">
                    {m.user?.name?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <div className="min-w-0">
                  {m.user?._id ? (
                    <button
                      type="button"
                      onClick={() => navigate(`/members/${m.user._id}`)}
                      className="text-sm font-medium text-primary hover:underline text-left break-words cursor-pointer"
                    >
                      {m.user?.name || "Unknown"}
                    </button>
                  ) : (
                    <p className="text-sm font-medium text-foreground">
                      {m.user?.name || "Unknown"}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground capitalize">
                    {memberDisplayPosition(m)}
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: "Remove Member",
                    message: `Remove ${m.user?.name || "this member"} from the committee?`,
                    confirmLabel: "Remove",
                    variant: "danger",
                  });
                  if (ok) removeMutation.mutate(m.user?._id);
                }}
                disabled={removeMutation.isPending}
                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded"
                title="Remove"
              >
                <UserMinus className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
