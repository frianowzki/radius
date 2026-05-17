"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { isAddress } from "viem";
import { AppShell } from "@/components/AppShell";
import { useAccount } from "wagmi";
import { useRadiusAuth } from "@/lib/web3auth";
import { formatAddress, getContacts, removeContact, saveContacts, updateContact, upsertContactByAddress, type Contact } from "@/lib/utils";
import { fetchRemoteContacts, mergeContacts, pushRemoteContacts } from "@/lib/contacts-sync";
import { fetchRegistryProfile, searchRegistryProfiles } from "@/lib/registry-client";

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
  /* eslint-disable react-hooks/set-state-in-effect -- hydrate from localStorage/URL on mount to avoid SSR mismatch */
  useEffect(() => {
    setContacts(getContacts());
    const initial = new URLSearchParams(window.location.search).get("search");
    if (initial) {
      setQuery(initial);
      setGlobalSearch(initial);
    }
  }, []);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => [c.name, c.handle, c.address, c.note].some((v) => v?.toLowerCase().includes(q)));
  }, [contacts, query]);

  const visibleGlobalResults = useMemo(
    () => globalResults.filter((r) => r.address.toLowerCase() !== owner?.toLowerCase()),
    [globalResults, owner]
  );

  function addGlobalProfile(r: { address: string; displayName: string; handle?: string; avatar?: string }) {
    upsertContactByAddress(r.address, { name: r.displayName, handle: r.handle, avatar: r.avatar });
    const next = getContacts();
    setContacts(next);
    setQuery("");
    setGlobalSearch("");
    setGlobalResults([]);
    if (owner) pushRemoteContacts(owner, next, { provider: authProvider, signMessage, prompt: true }).then((res) => setSyncStatus(res ? "synced" : "error"));
  }

  useEffect(() => {
    const q = globalSearch.trim().replace(/^@/, "");
    if (q.length < 2) {
      setGlobalResults([]);
      setGlobalSearching(false);
      return;
    }
    let cancelled = false;
    setGlobalSearching(true);
    const timer = window.setTimeout(() => {
      searchRegistryProfiles(q)
        .then(async (profiles) => {
          if (cancelled) return;
          if (profiles.length) { setGlobalResults(profiles); return; }
          const exact = await fetchRegistryProfile({ handle: q }).catch(() => null);
          if (!cancelled) setGlobalResults(exact ? [exact] : []);
        })
        .catch(() => fetchRegistryProfile({ handle: q }).then((profile) => { if (!cancelled) setGlobalResults(profile ? [profile] : []); }).catch(() => { if (!cancelled) setGlobalResults([]); }))
        .finally(() => { if (!cancelled) setGlobalSearching(false); });
    }, 220);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [globalSearch]);

  function resetForm() {
    setName(""); setAddress(""); setHandle(""); setNote(""); setShowForm(false);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const input = address.trim();
    if (!name.trim() || !input) return;

    let finalAddress = input;
    let finalName = name.trim();
    let finalHandle = handle.trim();
    let finalAvatar: string | undefined;

    if (!isAddress(input)) {
      const profile = await fetchRegistryProfile({ handle: input.replace(/^@/, "") }).catch(() => null);
      if (!profile?.address || !isAddress(profile.address)) return;
      finalAddress = profile.address;
      finalName = finalName || profile.displayName;
      finalHandle = profile.handle || finalHandle || input.replace(/^@/, "");
      finalAvatar = profile.avatar;
    }

    if (editingId) updateContact(editingId, { name: finalName, address: finalAddress, handle: finalHandle, avatar: finalAvatar, note });
    else upsertContactByAddress(finalAddress, { name: finalName, handle: finalHandle, avatar: finalAvatar, note });
    const next = getContacts();
    setContacts(next);
    setEditingId(null);
    resetForm();
    if (owner) pushRemoteContacts(owner, next, { provider: authProvider, signMessage, prompt: true }).then((res) => setSyncStatus(res ? "synced" : "error"));
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

        <div className="relative">
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setGlobalSearch(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && visibleGlobalResults[0]) {
                e.preventDefault();
                addGlobalProfile(visibleGlobalResults[0]);
              }
            }}
            placeholder="Search contacts or @username"
            className="radius-input text-sm"
          />
          <p className="mt-2 text-xs text-[var(--muted)]">Type a Radius username to find registered users globally and add them to contacts.</p>
          {visibleGlobalResults.length > 0 && (
            <div className="mt-3 space-y-2 rounded-2xl border border-[var(--brand)]/20 bg-[var(--card)] p-3 text-[var(--foreground)] shadow-lg backdrop-blur-xl">
              <p className="px-1 text-[10px] font-black uppercase tracking-[0.18em] text-[var(--brand)]">Global Radius users</p>
              {visibleGlobalResults.map((r) => {
                  const alreadyAdded = contacts.some((c) => c.address.toLowerCase() === r.address.toLowerCase());
                  return (
                    <div key={r.address} className="flex items-center justify-between gap-2 rounded-xl bg-[var(--brand)]/5 p-2">
                      {r.avatar ? <img src={r.avatar} alt="" className="h-10 w-10 rounded-full object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-full bg-[var(--brand)]/10 text-xs font-bold text-[var(--brand)]">{r.displayName.slice(0, 1).toUpperCase()}</div>}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold">{r.displayName}</p>
                        {r.handle && <p className="truncate text-xs text-[var(--muted)]">@{r.handle}</p>}
                        <p className="truncate font-mono text-[10px] text-[var(--muted)]">{formatAddress(r.address)}</p>
                      </div>
                      <button
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => addGlobalProfile(r)}
                        className="shrink-0 rounded-full bg-[var(--brand)] px-3 py-1.5 text-xs font-semibold text-white disabled:bg-white/15 disabled:text-[var(--muted)]"
                      >{alreadyAdded ? "Added" : "Add"}</button>
                    </div>
                  );
                })}
            </div>
          )}
          {globalSearching && <p className="mt-1 text-xs text-[var(--muted)]">Searching Radius usernames…</p>}
          {!globalSearching && globalSearch.trim().replace(/^@+/, "").length >= 2 && visibleGlobalResults.length === 0 && (
            <p className="mt-1 text-xs text-[var(--muted)]">No registered Radius username found yet.</p>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className="soft-card rounded-[28px] p-5 space-y-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="radius-input text-sm" />
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="0x wallet address or @username" className="radius-input font-mono text-sm" />
            <button type="submit" disabled={!name.trim() || !address.trim()} className="primary-btn w-full text-sm disabled:opacity-40">{editingId ? "Save changes" : "Save contact"}</button>
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
