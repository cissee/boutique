"use client";

import { useOffline } from "next/offline";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { AmountInput } from "@/components/ledger/amount-input";
import { FormAlert } from "@/components/ui/form";
import { balanceTone, Money } from "@/components/ui/money";
import { getMessages } from "@/i18n";
import { formatFCFA, parseAmount } from "@/lib/format/currency";
import { formatDateTime } from "@/lib/format/date";
import { formatPhone } from "@/lib/format/phone";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/ledger";
import {
  enqueueOperation,
  notifyOfflineChange,
  offlineStore,
  runSync,
  subscribeOffline,
  usePendingOperations,
} from "@/lib/offline/client";
import { pendingEffect } from "@/lib/offline/sync";
import type { CustomerSnapshot, PendingOperation, SnapshotCustomer } from "@/lib/offline/types";
import { matcher } from "@/lib/search";
import { syncOfflineOperation } from "@/server/actions/offline";

const t = getMessages();
const inputClass =
  "min-h-12 rounded-xl border-2 border-border bg-surface px-4 text-lg outline-none focus:border-brand";

function useSnapshot(): CustomerSnapshot | null | undefined {
  const [snapshot, setSnapshot] = useState<CustomerSnapshot | null | undefined>(undefined);
  useEffect(() => {
    const load = () => {
      const store = offlineStore();
      if (!store) return setSnapshot(null);
      store.getSnapshot().then(setSnapshot).catch(() => setSnapshot(null));
    };
    load();
    return subscribeOffline(load);
  }, []);
  return snapshot;
}

/** Application réduite, utilisable sans réseau (données locales uniquement). */
export function OfflineApp() {
  const snapshot = useSnapshot();
  const ops = usePendingOperations();
  const isOffline = useOffline();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const customers = useMemo(() => {
    if (!snapshot) return [];
    const matches = matcher(query);
    return snapshot.customers.filter(matches).slice(0, 50);
  }, [snapshot, query]);
  const selected = snapshot?.customers.find((c) => c.id === selectedId) ?? null;

  async function syncNow() {
    setSyncing(true);
    setSyncError(null);
    try {
      const report = await runSync(syncOfflineOperation);
      if (report?.stoppedBy === "auth") setSyncError(t.offline.sessionExpired);
    } catch {
      setSyncError(t.errors.network);
    } finally {
      setSyncing(false);
    }
  }

  if (snapshot === undefined) return <p className="text-muted">{t.common.loading}</p>;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">{t.offline.title}</h1>
        {snapshot && <p className="text-lg font-semibold text-brand">{snapshot.shopName}</p>}
        <p className="text-base text-muted">{t.offline.intro}</p>
      </header>

      {!isOffline && (
        <div className="flex flex-col gap-2 rounded-xl bg-repayment-soft p-4 text-repayment">
          <p className="font-semibold">{t.offline.online}</p>
          <a href="/dashboard" className="font-semibold underline underline-offset-4">
            {t.offline.backToApp} →
          </a>
        </div>
      )}

      {message && <FormAlert success={message} />}

      <Queue ops={ops} canSync={!isOffline} syncing={syncing} onSync={syncNow} error={syncError} />

      {!snapshot ? (
        <p className="rounded-2xl border border-dashed border-border bg-surface p-5 text-muted">{t.offline.noData}</p>
      ) : selected ? (
        <OfflineEntry
          key={selected.id}
          customer={selected}
          shopId={snapshot.shopId}
          pending={pendingEffect(ops, selected.id)}
          onCancel={() => setSelectedId(null)}
          onSaved={() => {
            setSelectedId(null);
            setMessage(t.offline.saved);
          }}
        />
      ) : (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-muted">
            {t.offline.dataFrom.replace("{date}", formatDateTime(snapshot.savedAt))}. {t.offline.staleWarning}
          </p>
          <input
            type="search"
            aria-label={t.customers.searchLabel}
            placeholder={t.customers.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className={inputClass}
          />
          <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
            {customers.map((c) => {
              const extra = pendingEffect(ops, c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setMessage(null);
                      setSelectedId(c.id);
                    }}
                    className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left active:bg-background"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-base font-semibold">{c.name}</span>
                      {c.phone && <span className="text-sm text-muted">{formatPhone(c.phone)}</span>}
                    </span>
                    <span className="flex flex-col items-end">
                      <Money amount={c.balance + extra} tone={balanceTone(c.balance + extra)} />
                      {extra !== 0 && (
                        <span className="text-xs text-muted">
                          {t.offline.pendingSuffix.replace("{amount}", formatFCFA(extra))}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

function OfflineEntry({
  customer,
  shopId,
  pending,
  onCancel,
  onSaved,
}: {
  customer: SnapshotCustomer;
  shopId: string;
  pending: number;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [kind, setKind] = useState<PendingOperation["kind"]>("DEBT");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const estimated = customer.balance + pending;
  const value = parseAmount(amount);
  const exceeds = kind === "REPAYMENT" && value !== null && value > estimated;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (value === null) return setError(t.errors.invalidAmount);
    if (exceeds) return setError(t.ledger.exceedsBalance.replace("{balance}", formatFCFA(estimated)));
    setSaving(true);
    try {
      const now = new Date().toISOString();
      await enqueueOperation({
        requestId: crypto.randomUUID(),
        kind,
        shopId,
        customerId: customer.id,
        customerName: customer.name,
        amount: value,
        description: note.trim().slice(0, 500) || null,
        paymentMethod: kind === "REPAYMENT" ? method : null,
        occurredAt: now,
        createdAt: now,
        status: "pending",
        attempts: 0,
      });
      onSaved();
    } catch {
      setError(t.errors.generic);
      setSaving(false);
    }
  }

  const tab = (k: PendingOperation["kind"], label: string) => (
    <button
      type="button"
      aria-pressed={kind === k}
      onClick={() => setKind(k)}
      className={`min-h-12 flex-1 rounded-xl border-2 font-semibold ${
        kind === k ? "border-brand bg-brand text-white" : "border-border bg-surface"
      }`}
    >
      {label}
    </button>
  );

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4" noValidate>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-bold">{customer.name}</p>
          <p className="text-sm">
            {t.customers.balance} : <Money amount={estimated} tone={balanceTone(estimated)} />
          </p>
        </div>
        <button type="button" onClick={onCancel} className="min-h-10 rounded-lg border-2 border-border px-3 text-sm font-semibold">
          {t.ledger.changeCustomer}
        </button>
      </div>

      <div className="flex gap-2">
        {tab("DEBT", t.offline.debt)}
        {tab("REPAYMENT", t.offline.repayment)}
      </div>

      <FormAlert error={error ?? undefined} />
      <AmountInput
        label={kind === "DEBT" ? t.ledger.amount : t.ledger.amountPaid}
        value={amount}
        onChange={(v) => {
          setAmount(v);
          setError(null);
        }}
        errors={exceeds ? [t.ledger.exceedsBalance.replace("{balance}", formatFCFA(estimated))] : undefined}
      />

      {kind === "REPAYMENT" && (
        <div className="flex flex-wrap gap-2">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={method === m}
              onClick={() => setMethod(m)}
              className={`min-h-11 rounded-full border-2 px-4 text-sm font-semibold ${
                method === m ? "border-repayment bg-repayment text-white" : "border-border bg-surface"
              }`}
            >
              {t.transactions.paymentMethod[m]}
            </button>
          ))}
        </div>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-base font-semibold">
          {kind === "DEBT" ? t.ledger.description : t.ledger.comment}{" "}
          <span className="font-normal text-muted">({t.common.optional})</span>
        </span>
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={inputClass} />
      </label>

      <button
        type="submit"
        disabled={saving || exceeds}
        className="min-h-14 rounded-xl bg-brand px-6 text-lg font-semibold text-white disabled:opacity-60"
      >
        {saving ? t.common.loading : t.offline.save}
      </button>
    </form>
  );
}

function Queue({
  ops,
  canSync,
  syncing,
  onSync,
  error,
}: {
  ops: PendingOperation[];
  canSync: boolean;
  syncing: boolean;
  onSync: () => void;
  error: string | null;
}) {
  if (!ops.length) return null;
  const hasPending = ops.some((op) => op.status === "pending");

  async function discard(op: PendingOperation) {
    if (!window.confirm(t.offline.discardConfirm)) return;
    await offlineStore()?.deleteOperation(op.requestId);
    notifyOfflineChange();
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border-2 border-warning bg-warning-soft p-4">
      <h2 className="text-lg font-bold text-warning">{t.offline.queueTitle}</h2>
      {error && <p className="text-sm font-semibold text-debt">{error}</p>}
      <ul className="flex flex-col gap-2">
        {ops.map((op) => (
          <li key={op.requestId} className="flex items-start gap-3 rounded-xl bg-surface p-3">
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="font-semibold">
                {op.kind === "DEBT" ? t.offline.debt : t.offline.repayment} · {op.customerName}
              </span>
              <span className="text-xs text-muted">{formatDateTime(op.occurredAt)}</span>
              {op.status === "pending" ? (
                <span className="text-sm text-warning">{t.offline.statusPending}</span>
              ) : (
                <span className="text-sm font-semibold text-debt">
                  {t.offline.statusRejected} : {op.error === "max_attempts" ? t.offline.maxAttempts : op.error}
                </span>
              )}
            </span>
            <span className="flex flex-col items-end gap-2">
              <Money amount={op.amount} tone={op.kind === "DEBT" ? "debt" : "repayment"} sign={op.kind === "DEBT" ? "+" : "−"} />
              {op.status === "rejected" && (
                <button
                  type="button"
                  onClick={() => discard(op)}
                  className="min-h-9 rounded-lg border-2 border-debt px-3 text-sm font-semibold text-debt"
                >
                  {t.offline.discard}
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {hasPending && canSync && (
        <button
          type="button"
          onClick={onSync}
          disabled={syncing}
          className="min-h-12 rounded-xl bg-warning px-4 font-semibold text-white disabled:opacity-60"
        >
          {syncing ? t.offline.syncing : t.offline.syncNow}
        </button>
      )}
    </section>
  );
}
