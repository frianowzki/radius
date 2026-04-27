"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { isAddress } from "viem";
import { AppShell } from "@/components/AppShell";
import { addContact, formatAddress, getContacts, removeContact, updateContact, type Contact } from "@/lib/utils";

function ContactAvatar({ contact }: { contact: Contact }) {
  return (
    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#8f7cff] to-[#85cfff] text-sm font-bold text-white shadow-sm">
      {(contact.avatar || contact.name).slice(0, 1).toUpperCase()}
    </div>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>(() => getContacts());
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
    setContacts(getContacts());
    setEditingId(null);
    resetForm();
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
    setContacts(getContacts());
  }

  return (
    <AppShell>
      <div className="screen-pad space-y-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#8b8795]">Contacts</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">People</h1>
          </div>
          <button type="button" onClick={() => setShowForm((v) => !v)} className="theme-toggle icon-only"><span className="theme-toggle-dot">＋</span></button>
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
          <div className="soft-card rounded-[28px] p-8 text-center text-sm text-[#8b8795]">
            {contacts.length === 0 ? "No contacts yet." : "No contacts match your search."}
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
                  <Link href={`/send?to=${encodeURIComponent(contact.handle ? contact.handle.replace(/^@/, "") : contact.address)}`} className="rounded-2xl bg-[#8f7cff]/12 px-3 py-2.5 text-center text-xs font-bold text-[#6f60d5]">Send to</Link>
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
