"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { isAddress } from "viem";
import { AppShell } from "@/components/AppShell";
import { useAccount } from "wagmi";
import { useRadiusAuth } from "@/lib/web3auth";
import { addContact, formatAddress, getContacts, removeContact, saveContacts, updateContact, type Contact } from "@/lib/utils";
import { fetchRemoteContacts, mergeContacts, pushRemoteContacts } from "@/lib/contacts-sync";
import { fetchRegistryProfile } from "@/lib/registry-client";

function SyncStatusIcon({ status }: { status: "idle" | "syncing" | "synced" | "error" }) {
  if (status === "syncing") {
    return <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 0 1-9 9" /><path d="M3 12a9 9 0 0 1 9-9" /></svg>;
  }
  if (status === "synced") {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>;
  }
  if (status === "error") {
    return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 8v5" /><path d="M12 16h.01" /></svg>;
  }
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 0 1-9 9 9.7 9.7 0 0 1-6.7-2.8" /><path d="M3 12a9 9 0 0 1 9-9 9.7 9.7 0 0 1 6.7 2.8" /><path d="M3 19v-4h4" /><path d="M21 5v4h-4" /></svg>;
}

function ContactAvatar({ contact }: { contact: Contact }) {
  if (contact.avatar) {
    return (
      <img src={contact.avatar} alt={contact.name} className="h-12 w-12 rounded-2xl object-cover shadow-sm" />
    );
  }
  return (
    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#3b82f6] text-sm font-bold text-white shadow-sm">
      {(contact.avatar || contact.name).slice(0, 1).toUpperCase()}
    </div>
  );
}

export default function ContactsPage() {
  const { address: wagmiAddress } = useAccount();
  const { address: authAddress, provider: authProvider, signMessage } = useRadiusAuth();
  const owner = wagmiAddress ?? authAddress;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  /* eslint-disable react-hooks/set-state-in-effect -- hydrate from localStorage on mount to avoid SSR mismatch */
  useEffect(() => { setContacts(getContacts()); }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  // Auto-pull and merge cloud contacts when owner becomes known.
  /* eslint-disable react-hooks/set-state-in-effect -- async fetch then state update is the canonical pattern */
  useEffect(() => {
    if (!owner) return;
    let cancelled = false;
    setSyncStatus("syncing");
    fetchRemoteContacts(owner)
      .then((remote) => {
        if (cancelled) return;
        if (!remote) { setSyncStatus("error"); return; }
        const merged = mergeContacts(getContacts(), remote.contacts);
        saveContacts(merged);
        setContacts(merged);
        // Push merged set so cloud reflects locally-added contacts too.
        pushRemoteContacts(owner, merged).then(() => { if (!cancelled) setSyncStatus("synced"); });
      })
      .catch(() => { if (!cancelled) setSyncStatus("error"); });
    return () => { cancelled = true; };
  }, [owner]);
  /* eslint-enable react-hooks/set-state-in-effect */

  function syncToCloud() {
    if (!owner) return;
    setSyncStatus("syncing");
    pushRemoteContacts(owner, getContacts(), { provider: authProvider, signMessage, prompt: true }).then((res) => setSyncStatus(res ? "synced" : "error"));
  }
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [handle, setHandle] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [globalResults, setGlobalResults] = useState<{ address: string; displayName: string; handle?: string; avatar?: string }[]>([]);
  const [globalSearching, setGlobalSearching] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => [c.name, c.handle, c.address, c.note].some((v) => v?.toLowerCase().includes(q)));
  }, [contacts, query]);

  function resetForm() {
    setName(""); setAddress(""); setHandle(""); setNote(""); setShowForm(false);
  }

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !isAddress(address)) return;
    if (editingId) updateContact(editingId, { name: name.trim(), address, handle, note });
    else addContact(name.trim(), address, { handle, note });
    const next = getContacts();
    setContacts(next);
    setEditingId(null);
    resetForm();
    if (owner) pushRemoteContacts(owner, next);
  }

  function startEdit(contact: Contact) {
    setEditingId(contact.id);
    setName(contact.name);
    setAddress(contact.address);
    setHandle(contact.handle || "");
    setNote(contact.note || "");
    setShowForm(true);
  }

  function handleDelete(id: string) {
    removeContact(id);
    const next = getContacts();
    setContacts(next);
    if (owner) pushRemoteContacts(owner, next);
  }

  return (
    <AppShell>
      <div className="screen-pad space-y-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[var(--brand)]">Contacts</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">People</h1>
          </div>
          <div className="flex items-center gap-2">
            {owner && (
              <button type="button" onClick={syncToCloud} aria-label={syncStatus === "syncing" ? "Syncing contacts" : syncStatus === "synced" ? "Contacts synced" : syncStatus === "error" ? "Sync failed" : "Sync contacts"} title={syncStatus === "error" ? "Sync failed" : syncStatus === "synced" ? "Synced" : "Sync contacts"} className={`grid h-9 w-9 place-items-center rounded-full bg-white/60 text-[var(--brand)] shadow-sm ${syncStatus === "error" ? "text-red-500" : ""}`}>
                <SyncStatusIcon status={syncStatus} />
              </button>
            )}
            <button type="button" onClick={() => setShowForm((v) => !v)} aria-label="Add contact" className="grid h-9 w-9 place-items-center rounded-full bg-[var(--brand)] text-white shadow-sm shadow-blue-500/20">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
            </button>
          </div>
        </header>

        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts" className="radius-input text-sm" />

        <div className="relative">
          <input
            value={globalSearch}
            onChange={(e) => {
              setGlobalSearch(e.target.value);
              const q = e.target.value.trim().replace(/^@/, "");
              if (q.length < 2) { setGlobalResults([]); return; }
              setGlobalSearching(true);
              fetchRegistryProfile({ handle: q })
                .then((profile) => {
                  if (profile) setGlobalResults([profile]);
                  else setGlobalResults([]);
                })
                .catch(() => setGlobalResults([]))
                .finally(() => setGlobalSearching(false));
            }}
            placeholder="Search Radius users"
            className="radius-input text-sm"
          />
          {globalResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-10 mt-1 space-y-1 rounded-2xl border border-[var(--brand)]/20 bg-white p-3 shadow-lg">
              {globalResults.map((r) => (
                <div key={r.address} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--brand)]/5 p-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{r.displayName}</p>
                    {r.handle && <p className="truncate text-xs text-[#8b8795]">@{r.handle}</p>}
                    <p className="truncate font-mono text-[10px] text-[#8b8795]">{formatAddress(r.address)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      addContact(r.displayName, r.address, { handle: r.handle, avatar: r.avatar });
                      const next = getContacts();
                      setContacts(next);
                      setGlobalSearch("");
                      setGlobalResults([]);
                      if (owner) pushRemoteContacts(owner, next);
                    }}
                    className="shrink-0 rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white"
                  >Add</button>
                </div>
              ))}
            </div>
          )}
          {globalSearching && <p className="mt-1 text-xs text-[#8b8795]">Searching…</p>}
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className="soft-card rounded-[28px] p-5 space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="radius-input text-sm" />
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x wallet address" className="radius-input font-mono text-sm" />
            <button type="submit" disabled={!name.trim() || !isAddress(address)} className="primary-btn w-full text-sm disabled:opacity-40">{editingId ? "Save changes" : "Save contact"}</button>
          </form>
        )}

        {filtered.length === 0 ? (
          <div className="soft-card rounded-[28px] p-10 text-center">
            <div className="contacts-empty-orb mx-auto mb-5">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <p className="text-lg font-semibold">{contacts.length === 0 ? "No contacts yet." : "No contacts match your search."}</p>
            <p className="mt-2 text-sm text-[var(--muted)]">Save frequent recipients for faster stablecoin sends.</p>
            {contacts.length === 0 && (
              <button type="button" onClick={() => setShowForm(true)} className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--brand)]/20 px-5 py-2.5 text-sm font-medium text-[var(--brand)] transition-colors hover:bg-[var(--brand)]/5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                Add first contact
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((contact) => (
              <div key={contact.id} className="soft-card rounded-[24px] p-4">
                <div className="flex items-center gap-3">
                  <ContactAvatar contact={contact} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2"><p className="truncate text-sm font-bold">{contact.name}</p>{contact.handle && <span className="rounded-full bg-white/60 px-2 py-1 text-[10px] text-[#8b8795]">@{contact.handle.replace(/^@/, "")}</span>}</div>
                    <p className="mt-1 font-mono text-xs text-[#8b8795]">{formatAddress(contact.address)}</p>
                    {contact.note && <p className="mt-1 truncate text-xs text-[#8b8795]">{contact.note}</p>}
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Link href={`/send?to=${encodeURIComponent(contact.handle ? contact.handle.replace(/^@/, "") : contact.address)}`} aria-label="Send to" title="Send to" className="grid h-9 w-9 place-items-center rounded-full bg-[var(--brand)]/10 text-[var(--brand)]">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </Link>
                  <button type="button" onClick={() => startEdit(contact)} aria-label="Edit" title="Edit" className="grid h-9 w-9 place-items-center rounded-full bg-emerald-500/12 text-emerald-600">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"/></svg>
                  </button>
                  {deletingId === contact.id ? (
                    <>
                      <button type="button" onClick={() => { handleDelete(contact.id); setDeletingId(null); }} aria-label="Confirm delete" title="Confirm delete" className="grid h-9 w-9 place-items-center rounded-full bg-red-500/20 text-red-600">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </button>
                      <button type="button" onClick={() => setDeletingId(null)} aria-label="Cancel" title="Cancel" className="grid h-9 w-9 place-items-center rounded-full bg-white/60 text-[#8b8795]">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setDeletingId(contact.id)} aria-label="Delete" title="Delete" className="grid h-9 w-9 place-items-center rounded-full bg-red-500/12 text-red-600">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
