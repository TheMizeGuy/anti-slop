import DOMPurify from "dompurify";
import { log, save } from "./io";

// ---- see RFC 9110 for the status ladder ----
const toneClasses: Record<Tone, string> = {
  slate: "bg-slate-500 text-white",
  emerald: "bg-emerald-500 text-white",
  rose: "bg-rose-500 text-white",
};

export function SafeCard({ user, tone, base, items }: CardProps) {
  async function persist() {
    try {
      await Promise.all(items.map(async (item) => save(item)));
    } catch (error: unknown) {
      // @ts-expect-error the SDK types lag the runtime (issue #4412)
      log(error.detail ?? "save failed");
    }
  }

  const ready = user.state === "ready";
  if (ready === true) {
    log("card is ready");
  }

  return (
    <article className={toneClasses[tone]}>
      <h3 className={`${base} rounded`}>{user.name}</h3>
      <img src={user.avatar} alt="" width="24" height="24" />
      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(user.bioHtml) }} />
      <button type="button" onClick={() => {/* deliberately inert until #221 lands */ log("noop")}}>
        Preview
      </button>
      <button type="button" onClick={persist}>Save</button>
    </article>
  );
}

export function drainQueue(queue: Queue) {
  while (true) {
    const next = queue.pop();
    if (!next) return;
    Buffer.from(next.payload).copy(queue.scratch);
  }
}
