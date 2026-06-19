"use client";

import { useCallback, useEffect, useState } from "react";
import Avatar from "@/components/avatar/Avatar";
import { parseAvatar } from "@/lib/avatar";
import { getChatSocket } from "@/lib/socket";
import { useConfirm } from "@/components/ui/useConfirm";
import {
  rank,
  canManage,
  canRename,
  canDeleteConversation,
  canRemoveMember,
  canSetRole,
  ASSIGNABLE_ROLES,
} from "@/lib/roles";

interface Member {
  userId: string;
  role: string;
  username: string | null;
  shortId: string | null;
  avatar: string | null;
}
interface Detail {
  id: string;
  kind: string;
  isGroup: boolean;
  name: string | null;
  myRole: string;
  inviteToken: string | null;
  members: Member[];
}
interface FoundUser {
  id: string;
  username: string | null;
  shortId: string | null;
  avatar: string | null;
}

const seed = (m: { shortId: string | null; username: string | null }) =>
  m.shortId ?? m.username ?? "anon";

const ROLE_STYLE: Record<string, string> = {
  owner: "text-accent",
  admin: "text-accent-amber",
  moderator: "text-fg",
  member: "text-fg-dim",
};

export default function ManagePanel({
  conversationId,
  meId,
  onClose,
  onRemoved,
}: {
  conversationId: string;
  meId: string;
  onClose: () => void;
  onRemoved: () => void; // меня удалили / вышел / чат удалён → закрыть и сбросить active
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<FoundUser | null | "none">(null);
  const { confirm, dialog: confirmDialog } = useConfirm();

  const load = useCallback(async () => {
    const res = await fetch(`/api/chat/conversations/${conversationId}`);
    const data = await res.json();
    if (data.ok) {
      setDetail(data.conversation);
      setNameDraft(data.conversation.name ?? "");
    } else if (res.status === 403 || res.status === 404) {
      onRemoved(); // меня тут больше нет
    }
  }, [conversationId, onRemoved]);

  useEffect(() => {
    load();
    // Состав/роли могли поменять другие — слушаем realtime.
    const socket = getChatSocket();
    const onUpdated = (p: { conversationId?: string }) => {
      if (p?.conversationId === conversationId) load();
    };
    const onRemovedEvt = (p: { conversationId?: string }) => {
      if (p?.conversationId === conversationId) onRemoved();
    };
    socket.on("conversation:updated", onUpdated);
    socket.on("conversation:removed", onRemovedEvt);
    return () => {
      socket.off("conversation:updated", onUpdated);
      socket.off("conversation:removed", onRemovedEvt);
    };
  }, [conversationId, load, onRemoved]);

  if (!detail) {
    return (
      <Shell onClose={onClose}>
        <p className="text-sm text-fg-dim">{error ?? "loading…"}</p>
      </Shell>
    );
  }

  const { kind, myRole } = detail;
  const isDM = kind === "dm";
  const amManager = canManage(myRole);

  async function api(url: string, method: string, body?: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!data.ok) setError(data.error ?? "failed");
    return data;
  }

  async function rename() {
    const name = nameDraft.trim();
    if (!name || name === detail!.name) return;
    const data = await api(`/api/chat/conversations/${conversationId}`, "PATCH", { name });
    if (data.ok) load();
  }

  async function lookup() {
    setFound(null);
    if (q.trim().length < 3) return;
    const res = await fetch(`/api/users/lookup?q=${encodeURIComponent(q.trim())}`);
    const data = await res.json();
    setFound(data.user ?? "none");
  }

  async function addMember(userId: string) {
    const data = await api(`/api/chat/conversations/${conversationId}/members`, "POST", {
      memberIds: [userId],
    });
    if (data.ok) {
      setQ("");
      setFound(null);
      load();
    }
  }

  async function setRole(userId: string, role: string) {
    const data = await api(
      `/api/chat/conversations/${conversationId}/members/${userId}`,
      "PATCH",
      { role },
    );
    if (data.ok) load();
  }

  async function transfer(userId: string, name: string) {
    if (!(await confirm(`Transfer ownership to @${name}? You will become admin.`))) return;
    const data = await api(
      `/api/chat/conversations/${conversationId}/members/${userId}`,
      "PATCH",
      { role: "owner" },
    );
    if (data.ok) load();
  }

  async function removeMember(userId: string, name: string) {
    if (!(await confirm(`Remove @${name} from the chat?`, { danger: true, confirmLabel: "remove" }))) return;
    const data = await api(
      `/api/chat/conversations/${conversationId}/members/${userId}`,
      "DELETE",
    );
    if (data.ok) load();
  }

  async function leave() {
    if (!(await confirm(isDM ? "Delete this chat?" : "Leave this chat?", { danger: true, confirmLabel: isDM ? "delete" : "leave" }))) return;
    const data = await api(`/api/chat/conversations/${conversationId}/leave`, "POST");
    if (data.ok) onRemoved();
  }

  async function destroy() {
    if (!(await confirm("Delete this chat for everyone? This cannot be undone.", { danger: true, confirmLabel: "delete" }))) return;
    const data = await api(`/api/chat/conversations/${conversationId}`, "DELETE");
    if (data.ok) onRemoved();
  }

  async function genInvite() {
    const data = await api(`/api/chat/conversations/${conversationId}/invite`, "POST");
    if (data.ok) setDetail((d) => (d ? { ...d, inviteToken: data.token } : d));
  }

  async function revokeInvite() {
    const data = await api(`/api/chat/conversations/${conversationId}/invite`, "DELETE");
    if (data.ok) setDetail((d) => (d ? { ...d, inviteToken: null } : d));
  }

  const inviteUrl = detail.inviteToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/dashboard/chat/join/${detail.inviteToken}`
    : "";

  // members отсортируем по рангу (owner сверху)
  const members = [...detail.members].sort((a, b) => rank(b.role) - rank(a.role));

  return (
    <Shell onClose={onClose}>
      {confirmDialog}
      <div className="mb-4 font-mono text-sm text-accent">
        $ manage {isDM ? "chat" : kind}
      </div>

      {error && <p className="mb-3 text-xs text-danger">{error}</p>}

      {/* ── имя (группа/канал) ── */}
      {!isDM && (
        <div className="mb-4">
          <label className="mb-1 block text-xs text-fg-dim">name</label>
          <div className="flex gap-2">
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={60}
              disabled={!canRename(myRole)}
              className="flex-1 rounded border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-fg outline-none focus:border-accent disabled:opacity-60"
            />
            {canRename(myRole) && (
              <button
                onClick={rename}
                disabled={busy || !nameDraft.trim() || nameDraft.trim() === detail.name}
                className="rounded border border-white/15 px-3 font-mono text-xs text-fg-dim hover:text-fg disabled:opacity-40"
              >
                save
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── invite-ссылка (admin+, не DM) ── */}
      {!isDM && amManager && (
        <div className="mb-4">
          <label className="mb-1 block text-xs text-fg-dim">invite link</label>
          {detail.inviteToken ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 rounded border border-white/10 bg-black/40 px-2 py-1.5 font-mono text-[11px] text-fg outline-none"
                />
                <button
                  onClick={() => navigator.clipboard?.writeText(inviteUrl)}
                  className="rounded border border-white/15 px-2 font-mono text-xs text-fg-dim hover:text-accent"
                >
                  copy
                </button>
              </div>
              <div className="flex gap-3 text-xs">
                <button onClick={genInvite} disabled={busy} className="text-fg-dim hover:text-fg">
                  regenerate
                </button>
                <button onClick={revokeInvite} disabled={busy} className="text-danger hover:underline">
                  revoke
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={genInvite}
              disabled={busy}
              className="rounded border border-white/15 px-3 py-1.5 font-mono text-xs text-fg-dim hover:text-accent"
            >
              + create invite link
            </button>
          )}
        </div>
      )}

      {/* ── добавить участника (admin+, не DM) ── */}
      {!isDM && amManager && (
        <div className="mb-4">
          <label className="mb-1 block text-xs text-fg-dim">add member</label>
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookup()}
              placeholder="@nick, #id or email"
              className="flex-1 rounded border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm text-fg outline-none focus:border-accent"
            />
            <button onClick={lookup} className="rounded border border-white/15 px-3 font-mono text-xs text-fg-dim hover:text-fg">
              find
            </button>
          </div>
          {found === "none" && <p className="mt-2 text-xs text-danger">no user found</p>}
          {found && found !== "none" && (
            <button
              onClick={() => addMember(found.id)}
              disabled={busy || members.some((m) => m.userId === found.id)}
              className="mt-2 flex w-full items-center gap-2 rounded border border-white/10 p-2 hover:border-accent/40 disabled:opacity-50"
            >
              <Avatar config={parseAvatar(found.avatar, seed(found))} size={28} />
              <span className="font-mono text-sm text-fg">@{found.username ?? "user"}</span>
              <span className="ml-auto font-mono text-xs text-accent">
                {members.some((m) => m.userId === found.id) ? "in chat" : "+ add"}
              </span>
            </button>
          )}
        </div>
      )}

      {/* ── участники ── */}
      {!isDM && (
        <div className="mb-4">
          <div className="mb-1 text-xs text-fg-dim">members · {members.length}</div>
          <div className="space-y-1">
            {members.map((m) => {
              const isMe = m.userId === meId;
              const canKick = !isMe && canRemoveMember(myRole, m.role);
              const canRole = !isMe && canSetRole(myRole, m.role, "member"); // есть ли вообще право менять
              const canGiveOwner = !isMe && myRole === "owner" && m.role !== "owner";
              return (
                <div key={m.userId} className="flex items-center gap-2 rounded px-1 py-1">
                  <Avatar config={parseAvatar(m.avatar, seed(m))} size={28} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-sm text-fg">
                      @{m.username ?? "user"} {isMe && <span className="text-fg-dim">(you)</span>}
                    </div>
                    <div className={`font-mono text-[11px] ${ROLE_STYLE[m.role] ?? "text-fg-dim"}`}>
                      {m.role}
                    </div>
                  </div>

                  {/* смена роли */}
                  {canRole && (
                    <select
                      value={ASSIGNABLE_ROLES.includes(m.role as never) ? m.role : "member"}
                      onChange={(e) => setRole(m.userId, e.target.value)}
                      disabled={busy}
                      className="rounded border border-white/10 bg-black/40 px-1 py-0.5 font-mono text-[11px] text-fg outline-none"
                    >
                      {ASSIGNABLE_ROLES.filter((r) => canSetRole(myRole, m.role, r) || r === m.role).map(
                        (r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ),
                      )}
                    </select>
                  )}
                  {canGiveOwner && (
                    <button
                      onClick={() => transfer(m.userId, m.username ?? "user")}
                      title="transfer ownership"
                      className="font-mono text-[11px] text-accent hover:underline"
                    >
                      ★
                    </button>
                  )}
                  {canKick && (
                    <button
                      onClick={() => removeMember(m.userId, m.username ?? "user")}
                      title="remove"
                      className="px-1 font-mono text-sm text-fg-dim hover:text-danger"
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── опасная зона ── */}
      <div className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-4">
        {!isDM && (
          <button
            onClick={leave}
            disabled={busy}
            className="rounded border border-white/15 py-2 font-mono text-xs text-fg-dim hover:border-danger/40 hover:text-danger disabled:opacity-50"
          >
            leave {kind}
          </button>
        )}
        {canDeleteConversation(kind, myRole) && (
          <button
            onClick={destroy}
            disabled={busy}
            className="rounded border border-danger/40 py-2 font-mono text-xs text-danger hover:bg-danger/10 disabled:opacity-50"
          >
            delete {isDM ? "chat" : kind} {isDM ? "" : "for everyone"}
          </button>
        )}
      </div>
    </Shell>
  );
}

// Оболочка-модалка (клик по фону — закрыть).
function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="max-h-[88vh] w-[min(94vw,460px)] overflow-y-auto rounded-lg border border-white/10 bg-bg-soft p-5">
        {children}
      </div>
    </div>
  );
}
