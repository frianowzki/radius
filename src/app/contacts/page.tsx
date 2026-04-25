"use client";

import { useMemo, useState } from "react";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import Link from "next/link";
import { AppShell } from "@/components/AppShell";
import {
  getContacts,
  addContact,
  updateContact,
  removeContact,
  formatAddress,
  searchDirectoryEntries,
  type Contact,
} from "@/lib/utils";

function ContactAvatar({ contact }: { contact: Contact }) {
  if (contact.avatar) {
    return (
      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/8 bg-white/[0.04] text-lg">
        <span>{contact.avatar}</span>
      </div>
    );
  }

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 text-sm font-bold text-indigo-300">
      {contact.name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function ContactsPage() {
  const { address: walletAddress } = useAccount();
  const [contacts, setContacts] = useState<Contact[]>(() => getContacts());
  const [directoryQuery, setDirectoryQuery] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [handle, setHandle] = useState("");
  const [avatar, setAvatar] = useState("");
  const [note, setNote] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editHandle, setEditHandle] = useState("");
  const [editAvatar, setEditAvatar] = useState("");
  const [editNote, setEditNote] = useState("");

  const directoryEntries = useMemo(
    () => searchDirectoryEntries(directoryQuery, walletAddress),
    [directoryQuery, walletAddress]
  );

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !isAddress(address)) return;
    addContact(name.trim(), address, { handle, avatar, note });
    setContacts(getContacts());
    setName("");
    setAddress("");
    setHandle("");
    setAvatar("");
    setNote("");
    setShowForm(false);
  }

  function handleDelete(id: string) {
    removeContact(id);
    setContacts(getContacts());
    setDeleteId(null);
  }

  function startEdit(contact: Contact) {
    setEditingId(contact.id);
    setEditName(contact.name);
    setEditAddress(contact.address);
    setEditHandle(contact.handle || "");
    setEditAvatar(contact.avatar || "");
    setEditNote(contact.note || "");
    setDeleteId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
    setEditAddress("");
    setEditHandle("");
    setEditAvatar("");
    setEditNote("");
  }

  function addDirectoryEntry(entry: { name: string; address?: string; handle?: string; avatar?: string; note?: string; bio?: string }) {
    if (!entry.address || contacts.some((contact) => contact.address.toLowerCase() === entry.address!.toLowerCase())) return;
    addContact(entry.name, entry.address, {
      handle: entry.handle,
      avatar: entry.avatar,
      note: entry.note || entry.bio,
    });
    setContacts(getContacts());
  }

  function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId || !editName.trim() || !isAddress(editAddress)) return;

    updateContact(editingId, {
      name: editName.trim(),
      address: editAddress,
      handle: editHandle,
      avatar: editAvatar,
      note: editNote,
    });
    setContacts(getContacts());
    cancelEdit();
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-6">
            <div className="glass-panel-strong rounded-[32px] p-8">
              <div className="flex items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-zinc-500">Contacts</p>
                  <h2 className="text-4xl font-semibold tracking-tight text-glow">
                    People should feel closer than raw addresses.
                  </h2>
                  <p className="mt-4 text-base leading-7 text-zinc-400">
                    Trusted contacts are the identity backbone of the product. Add people once, then send or request without cold wallet friction.
                  </p>
                </div>
                <button
                  onClick={() => setShowForm(!showForm)}
                  className="rounded-2xl bg-indigo-500/15 px-4 py-3 text-sm font-medium text-indigo-300 transition-colors hover:bg-indigo-500/25"
                >
                  {showForm ? "Close form" : "+ Add contact"}
                </button>
              </div>
            </div>

            {showForm && (
              <form
                onSubmit={handleAdd}
                className="glass-panel rounded-[28px] p-6 space-y-4"
              >
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-400">
                    Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Alice"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-400">
                    Wallet address
                  </label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 font-mono text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                  />
                  {address && !isAddress(address) && (
                    <p className="mt-2 text-xs text-red-400">Invalid address</p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-400">
                      Handle <span className="text-zinc-600">(optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. @alice"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-400">
                      Avatar <span className="text-zinc-600">(emoji optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ✨"
                      value={avatar}
                      onChange={(e) => setAvatar(e.target.value)}
                      maxLength={4}
                      className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-zinc-400">
                    Note <span className="text-zinc-600">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Design partner, dinner split, team wallet"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!name.trim() || !isAddress(address)}
                  className="w-full rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition-all hover:shadow-indigo-500/30 disabled:opacity-40"
                >
                  Save contact
                </button>
              </form>
            )}

            {contacts.length === 0 ? (
              <div className="glass-panel rounded-[28px] p-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[24px] bg-white/[0.06] text-2xl">
                  ◎
                </div>
                <p className="mb-1 text-zinc-300">No contacts yet</p>
                <p className="text-sm text-zinc-500">
                  Add your frequent counterparties so payments feel human, not raw.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="glass-panel group rounded-[28px] p-5 transition-all hover:border-white/14"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-4">
                        <ContactAvatar contact={contact} />
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-zinc-100">{contact.name}</p>
                            {contact.handle && (
                              <span className="rounded-full border border-white/8 bg-white/[0.05] px-2.5 py-1 text-xs text-zinc-400">
                                {contact.handle}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 font-mono text-xs text-zinc-500">
                            {formatAddress(contact.address)}
                          </p>
                          {contact.note && (
                            <p className="mt-2 text-sm text-zinc-400">{contact.note}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEdit(contact)}
                          className="rounded-2xl bg-white/8 px-3 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/12"
                        >
                          Edit
                        </button>
                        <Link
                          href={`/send?to=${contact.address}`}
                          className="rounded-2xl bg-indigo-500/12 px-4 py-2.5 text-sm font-medium text-indigo-300 transition-colors hover:bg-indigo-500/20"
                        >
                          Send
                        </Link>
                        <Link
                          href={`/request?to=${contact.address}`}
                          className="rounded-2xl bg-white/8 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-white/12"
                        >
                          Request
                        </Link>
                        {deleteId === contact.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDelete(contact.id)}
                              className="rounded-2xl bg-red-500/20 px-3 py-2.5 text-sm font-medium text-red-300 hover:bg-red-500/30"
                            >
                              Confirm
                            </button>
                            <button
                              onClick={() => setDeleteId(null)}
                              className="rounded-2xl bg-white/8 px-3 py-2.5 text-sm text-zinc-300 hover:bg-white/12"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteId(contact.id)}
                            className="rounded-2xl px-3 py-2.5 text-sm text-zinc-500 transition-all hover:bg-white/8 hover:text-red-300"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                    {editingId === contact.id && (
                      <form
                        onSubmit={handleEdit}
                        className="mt-5 grid gap-4 border-t border-white/8 pt-5"
                      >
                        <div className="grid gap-4 sm:grid-cols-2">
                          <input
                            type="text"
                            placeholder="Name"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="0x wallet address"
                            value={editAddress}
                            onChange={(e) => setEditAddress(e.target.value)}
                            className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 font-mono text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                        {editAddress && !isAddress(editAddress) && (
                          <p className="text-xs text-red-400">Invalid address</p>
                        )}
                        <div className="grid gap-4 sm:grid-cols-3">
                          <input
                            type="text"
                            placeholder="@handle"
                            value={editHandle}
                            onChange={(e) => setEditHandle(e.target.value)}
                            className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Avatar"
                            value={editAvatar}
                            onChange={(e) => setEditAvatar(e.target.value)}
                            maxLength={4}
                            className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Note"
                            value={editNote}
                            onChange={(e) => setEditNote(e.target.value)}
                            className="w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="submit"
                            disabled={!editName.trim() || !isAddress(editAddress)}
                            className="rounded-2xl bg-indigo-500/15 px-4 py-2.5 text-sm font-medium text-indigo-300 transition-colors hover:bg-indigo-500/25 disabled:opacity-40"
                          >
                            Save changes
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-2xl bg-white/8 px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/12"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="glass-panel rounded-[32px] p-6">
              <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-zinc-500">Directory</p>
              <h3 className="text-2xl font-semibold tracking-tight text-zinc-100">
                Usernames need discovery before they need a registry.
              </h3>
              <p className="mt-3 text-sm leading-7 text-zinc-500">
                This is the practical bridge between local identity and future global usernames. Search your own profile and saved people in one place.
              </p>
              <input
                type="text"
                value={directoryQuery}
                onChange={(e) => setDirectoryQuery(e.target.value)}
                placeholder="Search name, @username, address"
                className="mt-4 w-full rounded-2xl border border-white/8 bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-zinc-500 focus:border-indigo-500 focus:outline-none"
              />
              <div className="mt-4 space-y-3">
                {directoryEntries.slice(0, 6).map((entry) => (
                  <div key={`${entry.kind}-${entry.handle || entry.address || entry.name}`} className="rounded-[24px] border border-white/8 bg-white/[0.04] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-zinc-100">{entry.name}</p>
                          {entry.handle && (
                            <span className="rounded-full border border-white/8 bg-white/[0.05] px-2.5 py-1 text-xs text-zinc-400">@{entry.handle}</span>
                          )}
                          <span className="rounded-full border border-white/8 bg-white/[0.05] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                            {entry.kind === "self" ? "You" : "Contact"}
                          </span>
                        </div>
                        {entry.address && (
                          <p className="mt-1 font-mono text-xs text-zinc-500">{formatAddress(entry.address)}</p>
                        )}
                        {(entry.note || entry.bio) && (
                          <p className="mt-2 text-sm text-zinc-400">{entry.note || entry.bio}</p>
                        )}
                      </div>
                      {entry.address && (
                        <div className="flex gap-2">
                          {entry.kind !== "contact" && (
                            <button
                              type="button"
                              onClick={() => addDirectoryEntry(entry)}
                              className="rounded-2xl bg-[var(--accent)]/30 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent)]/45"
                            >
                              Add
                            </button>
                          )}
                          <Link
                            href={`/send?to=${entry.handle ? `@${entry.handle}` : entry.address}`}
                            className="rounded-2xl bg-[var(--accent)]/25 px-3 py-2 text-sm font-medium text-zinc-100 transition-colors hover:bg-[var(--accent)]/35"
                          >
                            Send
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-[32px] p-6">
              <p className="mb-3 text-[11px] uppercase tracking-[0.3em] text-zinc-500">Identity layer</p>
              <h3 className="text-2xl font-semibold tracking-tight text-zinc-100">
                Contacts are product memory.
              </h3>
              <p className="mt-3 text-sm leading-7 text-zinc-500">
                The app gets more premium when payment history connects to actual people, notes, and repeat counterparties instead of anonymous strings.
              </p>
            </div>

            <div className="glass-panel rounded-[32px] p-6">
              <h3 className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
                Identity traits
              </h3>
              <div className="space-y-4 text-sm">
                <div className="border-b border-white/8 pb-4">
                  <p className="font-medium text-zinc-100">Handle</p>
                  <p className="mt-2 leading-6 text-zinc-500">Lets people feel recognizable before full usernames exist onchain.</p>
                </div>
                <div className="border-b border-white/8 pb-4">
                  <p className="font-medium text-zinc-100">Avatar</p>
                  <p className="mt-2 leading-6 text-zinc-500">Even a lightweight emoji avatar makes receipts feel more human.</p>
                </div>
                <div>
                  <p className="font-medium text-zinc-100">Note</p>
                  <p className="mt-2 leading-6 text-zinc-500">A tiny bit of context makes repeat payment flows much better.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
