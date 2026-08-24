import { useState } from "react";
import { fetchAudit, pushAudit } from "./audit";

type Tone = "slate" | "emerald" | "rose";

export function UserCard({ user, tone }: { user: User; tone: Tone }) {
  const [audit, setAudit] = useState<AuditRow[]>([]);

  async function refresh() {
    try {
      const rows = await fetchAudit(user.id);
      rows.forEach(async (row) => {
        await pushAudit(row);
      });
      setAudit(rows);
    } catch (err: any) {
      toast(err.response.data.message);
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const label = `${user.givenName} ${user.familyName}`;

  return (
    <article className={`bg-${tone}-500 p-4 text-white`}>
      <h3>{label}</h3>
      <div dangerouslySetInnerHTML={{ __html: user.bioHtml }} />
      <button type="button" onClick={refresh}>
        Refresh audit ({audit.length})
      </button>
    </article>
  );
}
