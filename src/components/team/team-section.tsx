import { getMessages } from "@/i18n";
import { formatDate } from "@/lib/format/date";
import { formatPhone } from "@/lib/format/phone";
import { siteUrl } from "@/lib/env";
import { displayCode } from "@/lib/invitations";
import type { ActiveShop, CurrentUser } from "@/lib/auth/session";
import { revokeInvitation } from "@/server/actions/team";
import { listPendingInvitations, listTeam } from "@/server/queries/team";
import { InvitePanel } from "./invite-panel";
import { LeaveShopButton, RemoveMemberButton } from "./member-actions";

const t = getMessages();

/** Section « Équipe » des paramètres : membres, invitations (propriétaire), départ (vendeur). */
export async function TeamSection({ active, user }: { active: ActiveShop; user: CurrentUser }) {
  const isOwner = active.role === "owner";
  const [members, invitations] = await Promise.all([
    listTeam(active.shop.id),
    isOwner ? listPendingInvitations(active.shop.id) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
        {members.map((m) => {
          const name = m.name ?? t.team.unnamed;
          return (
            <li key={m.userId} className="flex items-center gap-3 px-4 py-3">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base font-semibold">
                  {name}
                  {m.userId === user.id && <span className="font-normal text-muted"> ({t.team.you})</span>}
                </span>
                <span className="text-sm text-muted">
                  {t.settings.role[m.role]}
                  {m.phone && ` · ${formatPhone(m.phone)}`} · {t.team.joined.replace("{date}", formatDate(m.joinedAt))}
                </span>
              </span>
              {isOwner && m.role === "seller" && <RemoveMemberButton userId={m.userId} name={name} />}
            </li>
          );
        })}
      </ul>

      {isOwner && (
        <>
          {invitations.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-base font-semibold">{t.team.pending}</h3>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {invitations.map((inv) => (
                  <li key={inv.id} className="flex items-center gap-3 px-4 py-2">
                    <span className="flex flex-1 flex-col">
                      <span className="tabular text-base font-bold tracking-wider">{displayCode(inv.code)}</span>
                      <span className="text-xs text-muted">
                        {t.team.expires.replace("{date}", formatDate(inv.expiresAt))}
                      </span>
                    </span>
                    <form action={revokeInvitation}>
                      <input type="hidden" name="id" value={inv.id} />
                      <button type="submit" className="min-h-10 rounded-lg border-2 border-border px-3 text-sm font-semibold">
                        {t.team.revoke}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <InvitePanel shopName={active.shop.name} joinBaseUrl={siteUrl()} />
        </>
      )}

      {!isOwner && <LeaveShopButton />}
    </div>
  );
}
