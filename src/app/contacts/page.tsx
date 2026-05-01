"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { isAddress } from "viem";
import { AppShell } from "@/components/AppShell";
import { useAccount } from "wagmi";
import { useRadiusAuth } from "@/lib/web3auth";
import { addContact, formatAddress, getContacts, removeContact, saveContacts, updateContact, type Contact } from "@/lib/utils";
import { fetchRemoteContacts, mergeContacts, pushRemoteContacts } from "@/lib/contacts-sync";

function ContactAvatar({ contact }: { contact: Contact }) {
  return (
    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#6366f1] to-[#3b82f6] text-sm font-bold text-white shadow-sm">
      {(contact.avatar || contact.name).slice(0, 1).toUpperCase()}
    </div>
  );
}

export default function ContactsPage() {
  const { address: wagmiAddress } = useAccount();
  const { address: authAddress } = useRadiusAuth();
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
    pushRemoteContacts(owner, getContacts()).then((res) => setSyncStatus(res ? "synced" : "error"));
  }
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [handle, setHandle] = useState("");
  const [note, setNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

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
              <button
                type="button"
                onClick={syncToCloud}
                className="contacts-sync-btn"
                aria-label={syncStatus === "syncing" ? "Syncing" : syncStatus === "synced" ? "Synced" : syncStatus === "error" ? "Sync failed" : "Sync"}
                title={syncStatus === "syncing" ? "Syncing…" : syncStatus === "synced" ? "Synced" : syncStatus === "error" ? "Sync failed" : "Sync"}
              >
                {syncStatus === "syncing" ? (
                  <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                ) : syncStatus === "synced" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                ) : syncStatus === "error" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
                )}
              </button>
            )}
            <button type="button" onClick={() => setShowForm((v) => !v)} className="theme-toggle icon-only"><span className="theme-toggle-dot">＋</span></button>
          </div>
        </header>

        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search contacts" className="radius-input text-sm" />

        {showForm && (
          <form onSubmit={handleAdd} className="soft-card rounded-[28px] p-5 space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="radius-input text-sm" />
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x wallet address" className="radius-input font-mono text-sm" />
            <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@username optional" className="radius-input text-sm" />
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note optional" className="radius-input text-sm" />
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
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Link href={`/send?to=${encodeURIComponent(contact.handle ? contact.handle.replace(/^@/, "") : contact.address)}`} className="rounded-2xl bg-[var(--brand)]/10 px-3 py-2.5 text-center text-xs font-bold text-[var(--brand)]">Send to</Link>
                  <button type="button" onClick={() => startEdit(contact)} className="rounded-2xl bg-emerald-500/12 px-3 py-2.5 text-xs font-bold text-emerald-600">Edit</button>
                  <button type="button" onClick={() => handleDelete(contact.id)} className="rounded-2xl bg-red-500/12 px-3 py-2.5 text-xs font-bold text-red-600">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
