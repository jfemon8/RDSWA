import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Link } from "react-router-dom";
import { Scale, Plus, X, Loader2, ExternalLink } from "lucide-react";
import api from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmModal";
import { FieldError } from "@/components/ui/FieldError";
import { omitFieldError } from "@/lib/formErrors";
import { formatDate, toDateInput } from "@/lib/date";
import { useCommitteeOptions } from "@/hooks/useLinkOptions";
import EventFinanceSummary from "@/components/ui/EventFinanceSummary";
import DonationFormModal from "@/features/admin/donations/DonationFormModal";

const CATEGORIES = [
  "event",
  "office",
  "transport",
  "food",
  "printing",
  "other",
];

const money = (n: number) => `BDT ${(n || 0).toLocaleString()}`;

/** Optional per-event money view, letting organisers attach expenses and income without leaving the event. */
export default function EventFinanceSection({ event }: { event: any }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const eventId = event._id;

  const [form, setForm] = useState({
    title: "",
    amount: "",
    category: "event",
    expenseDate: "",
    committee: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [donationOpen, setDonationOpen] = useState(false);

  const { data: expenseData } = useQuery({
    queryKey: ["event-expenses", eventId],
    queryFn: async () =>
      (await api.get(`/expenses?event=${eventId}&limit=100`)).data,
  });
  const expenses: any[] = expenseData?.data || [];

  const committeeOptions = useCommitteeOptions();

  const { data: donationData } = useQuery({
    queryKey: ["event-donations", eventId],
    queryFn: async () =>
      (await api.get(`/donations?event=${eventId}&limit=100`)).data,
  });
  const donations: any[] = donationData?.data || [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["event-finance", eventId] });
    queryClient.invalidateQueries({ queryKey: ["event-expenses", eventId] });
    queryClient.invalidateQueries({ queryKey: ["event-donations", eventId] });
  };

  const addExpense = useMutation({
    mutationFn: () =>
      api.post("/expenses", {
        title: form.title.trim(),
        amount: Number(form.amount),
        category: form.category,
        expenseDate: form.expenseDate,
        committee: form.committee,
        event: eventId,
      }),
    onSuccess: () => {
      refresh();
      setForm({
        title: "",
        amount: "",
        category: "event",
        expenseDate: "",
        committee: "",
      });
      toast.success("Expense added");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Failed to add expense"),
  });

  const removeExpense = useMutation({
    mutationFn: (id: string) => api.delete(`/expenses/${id}`),
    onSuccess: () => {
      refresh();
      toast.success("Expense removed");
    },
    onError: (err: any) =>
      toast.error(err.response?.data?.message || "Failed to remove"),
  });

  const submitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.title.trim()) errs.title = "Expense title is required";
    if (!form.amount || Number(form.amount) <= 0)
      errs.amount = "Amount must be greater than zero";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    setErrors({});
    addExpense.mutate();
  };

  const set = (patch: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...patch }));
    setErrors((prev) =>
      Object.keys(patch).reduce((acc, f) => omitFieldError(acc, f), prev),
    );
  };

  const field =
    "w-full px-2.5 py-1.5 border rounded-md bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <div className="md:col-span-3">
      <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-3 text-foreground">
        <Scale className="h-4 w-4 text-primary" /> Finance
      </h4>

      <EventFinanceSummary eventId={eventId} compact className="mb-3" />

      {donationOpen && (
        <DonationFormModal
          donation={{ event: eventId, type: "event-based" }}
          onClose={() => {
            setDonationOpen(false);
            refresh();
          }}
        />
      )}

      {/* Expenses */}
      <form
        onSubmit={submitExpense}
        noValidate
        className="border rounded-lg p-3 bg-muted/30 mb-3"
      >
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Add Expense
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 min-w-0">
            <input
              placeholder="What was it for?"
              value={form.title}
              onChange={(e) => set({ title: e.target.value })}
              className={field}
            />
            <FieldError message={errors.title} />
          </div>
          <div className="sm:w-32">
            <input
              type="number"
              min="1"
              placeholder="Amount"
              value={form.amount}
              onChange={(e) => set({ amount: e.target.value })}
              className={field}
            />
            <FieldError message={errors.amount} />
          </div>
          <select
            value={form.category}
            onChange={(e) => set({ category: e.target.value })}
            className={`${field} sm:w-32`}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c} className="bg-card text-foreground">
                {c}
              </option>
            ))}
          </select>
          <motion.button
            type="submit"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={addExpense.isPending}
            className="flex items-center justify-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs hover:bg-primary/90 disabled:opacity-50"
          >
            {addExpense.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Add
          </motion.button>
        </div>

        {/* Both stay blank by default, letting the server stamp today and the current committee. */}
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <input
            type="date"
            value={form.expenseDate}
            max={toDateInput(new Date())}
            onChange={(e) => set({ expenseDate: e.target.value })}
            className={`${field} sm:w-44`}
          />
          <select
            value={form.committee}
            onChange={(e) => set({ committee: e.target.value })}
            className={`${field} sm:flex-1`}
          >
            <option value="" className="bg-card text-foreground">
              Select Committee
            </option>
            {committeeOptions.map((c: any) => (
              <option
                key={c._id}
                value={c._id}
                className="bg-card text-foreground"
              >
                {c.name}
                {c.isCurrent ? " (current)" : ""}
              </option>
            ))}
          </select>
        </div>
      </form>

      {expenses.length > 0 && (
        <div className="space-y-1 mb-4">
          {expenses.map((x: any, i: number) => (
            <motion.div
              key={x._id}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className="flex items-center gap-2 py-1.5 px-2.5 bg-muted rounded text-xs group"
            >
              <span className="font-medium text-foreground truncate">
                {x.title}
              </span>
              <span className="text-muted-foreground capitalize">
                {x.category}
              </span>
              <span className="text-muted-foreground">
                {formatDate(x.expenseDate || x.createdAt)}
              </span>
              <span className="ml-auto font-medium text-red-600 dark:text-red-400 whitespace-nowrap">
                {money(x.amount)}
              </span>
              <button
                onClick={async () => {
                  const ok = await confirm({
                    title: "Remove Expense",
                    message: `Remove "${x.title}" from this event?`,
                    confirmLabel: "Remove",
                    variant: "danger",
                  });
                  if (ok) removeExpense.mutate(x._id);
                }}
                title="Remove expense"
                className="p-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Income */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-muted-foreground">
          Income ({donations.length})
        </p>
        <button
          type="button"
          onClick={() => setDonationOpen(true)}
          className="flex items-center gap-1 px-2 py-1 border rounded-md text-xs hover:bg-accent text-foreground"
        >
          <Plus className="h-3 w-3" /> Add income
        </button>
      </div>

      {donations.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No income linked to this event yet.
        </p>
      ) : (
        <div className="space-y-1">
          {donations.map((d: any) => (
            <div
              key={d._id}
              className="flex items-center gap-2 py-1.5 px-2.5 bg-muted rounded text-xs"
            >
              <span className="font-medium text-foreground truncate">
                {d.donor?.name || d.donorName || "Anonymous"}
              </span>
              <span className="text-muted-foreground capitalize">
                {d.paymentMethod}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-full capitalize ${
                  d.paymentStatus === "completed"
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                }`}
              >
                {d.paymentStatus}
              </span>
              <span className="ml-auto font-medium text-green-600 dark:text-green-400 whitespace-nowrap">
                {money(d.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      <Link
        to="/admin/budgets"
        className="mt-3 inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        Manage budgets <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}
