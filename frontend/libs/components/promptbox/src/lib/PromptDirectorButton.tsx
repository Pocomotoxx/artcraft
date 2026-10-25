import { FormEvent, useState } from "react";
import { Tooltip } from "@storyteller/ui-tooltip";
import { Modal } from "@storyteller/ui-modal";
import { Button } from "@storyteller/ui-button";
import { PromptDirectorCallTool } from "@storyteller/tauri-api";
import { BookMarkedIcon } from "lucide-react";
import { twMerge } from "tailwind-merge";
import { PROMPT_TOOLBAR_ICON_BUTTON_CLASSES } from "./PromptClearAllButton";

// Toolbar button that opens the user's PromptDirector library (Chrome extension,
// reached through the local MCP connector). Picking a case writes its original
// prompt into the prompt box via `onPick`. Needs Chrome + the extension running.

const SEARCH_LIMIT = 24;

interface PromptDirectorButtonProps {
  /** Receives the picked case's prompt text. Replace or append is the caller's call. */
  onPick: (prompt: string) => void;
  className?: string;
}

interface CaseHit {
  caseId: string;
  title: string;
}

export const PromptDirectorButton = ({
  onPick,
  className,
}: PromptDirectorButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CaseHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (e?: FormEvent) => {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await callTool("search_cases", {
        query: query.trim(),
        hasOriginalPrompt: true,
        limit: SEARCH_LIMIT,
      });
      setHits(extractHits(result));
    } catch (err) {
      setHits([]);
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const pick = async (hit: CaseHit) => {
    setBusy(true);
    setError(null);
    try {
      const result = await callTool("read_case", {
        caseId: hit.caseId,
        part: "original_prompt",
      });
      const text = extractText(result);
      if (!text) {
        setError("This case has no original prompt.");
        return;
      }
      onPick(text);
      setIsOpen(false);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const open = () => {
    setIsOpen(true);
    if (hits.length === 0) void search();
  };

  return (
    <>
      <Tooltip
        content="PromptDirector library"
        position="top"
        className="z-50"
        delay={200}
      >
        <button
          type="button"
          aria-label="Pick a prompt from the PromptDirector library"
          onClick={open}
          className={twMerge(
            PROMPT_TOOLBAR_ICON_BUTTON_CLASSES,
            "focus:outline-none",
            className,
          )}
        >
          <BookMarkedIcon className="h-4 w-4" />
        </button>
      </Tooltip>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="PromptDirector"
        className="max-w-xl"
      >
        <form onSubmit={search} className="flex gap-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your saved prompts"
            className="min-w-0 flex-1 rounded-md border border-base-fg/15 bg-transparent px-3 py-2 text-sm text-base-fg outline-none focus:border-base-fg/40"
          />
          <Button type="submit" variant="secondary" disabled={busy}>
            Search
          </Button>
        </form>
        {error && <div className="mt-3 text-sm text-red-400">{error}</div>}
        <ul className="mt-3 max-h-80 overflow-y-auto">
          {hits.map((hit) => (
            <li key={hit.caseId}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void pick(hit)}
                className="w-full truncate rounded-md px-3 py-2 text-left text-sm text-base-fg hover:bg-base-fg/10 disabled:opacity-50"
              >
                {hit.title}
              </button>
            </li>
          ))}
          {!busy && !error && hits.length === 0 && (
            <li className="px-3 py-2 text-sm text-base-fg/60">No cases found.</li>
          )}
        </ul>
      </Modal>
    </>
  );
};

type ToolName = "search_cases" | "read_case";

// The connector wraps its JSON result as MCP text content; isError carries {code,message}.
const callTool = async (
  tool: ToolName,
  args: Record<string, unknown>,
): Promise<unknown> => {
  const response = await PromptDirectorCallTool(tool, args);
  const mcp = response.payload?.result as
    | { isError?: boolean; content?: { type: string; text?: string }[] }
    | undefined;
  const text = mcp?.content?.find((c) => c.type === "text")?.text ?? "";
  const parsed = text ? JSON.parse(text) : null;
  if (mcp?.isError) {
    throw new Error(parsed?.message ?? "PromptDirector request failed");
  }
  return parsed;
};

// Result field names are not pinned down by the connector docs, so accept the
// common shapes: an array under cases/items/results, ids as caseId or id.
const extractHits = (result: unknown): CaseHit[] => {
  const root = result as Record<string, unknown> | unknown[] | null;
  const list = Array.isArray(root)
    ? root
    : ((["cases", "items", "results"] as const)
        .map((key) => (root as Record<string, unknown> | null)?.[key])
        .find(Array.isArray) as unknown[] | undefined) ?? [];
  return list.flatMap((item) => {
    const entry = item as { caseId?: string; id?: string; title?: string };
    const caseId = entry.caseId ?? entry.id;
    return caseId ? [{ caseId, title: entry.title || caseId }] : [];
  });
};

const extractText = (result: unknown): string => {
  const page = result as { content?: unknown; text?: unknown } | null;
  const text = page?.content ?? page?.text;
  return typeof text === "string" ? text.trim() : "";
};

const errorText = (err: unknown): string => {
  const e = err as { error_message?: string; message?: string } | string;
  if (typeof e === "string") return e;
  return e?.error_message ?? e?.message ?? "PromptDirector is not reachable.";
};
