import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { ProgressBar } from "@/components/hub/progress-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fallbackLng, normalizeLanguage } from "@/i18n/config";
import {
  DOCUMENT_ACCEPT,
  documentExtension,
  reviewIntake,
  storeDocument,
} from "@/lib/hub/agents";
import { completion } from "@/lib/hub/checklists";
import { DOC_CRITERIA } from "@/lib/hub/covey";
import { docLabel } from "@/lib/hub/labels";
import type { DocId, LangCode, SubmissionItem } from "@/lib/hub/types";
import { cn } from "@/lib/utils";

type ChecklistEditorProps = {
  /** The saved submission, or a draft id until the intake is filed. */
  submissionId: string;
  lineOfBusiness: string;
  items: SubmissionItem[];
  onChange: (items: SubmissionItem[]) => void;
  /** Name the document agent compares against the name on each document. */
  clientName: string;
  /** Reports whether uploads are still being stored or checked. */
  onBusyChange?: (busy: boolean) => void;
};

type QueuedFile = { key: string; file: File; extension: string };

/** A stored file the document agent could not place; the client may choose its item. */
type UnmatchedFile = {
  key: string;
  name: string;
  path: string;
  note: string;
  reason: "unmatched" | "unreadable" | "unchecked";
};

const CLEARED_FILE: Partial<SubmissionItem> = {
  received: false,
  fileName: undefined,
  filePath: undefined,
  aiVerified: undefined,
  aiNote: undefined,
};

export const ChecklistEditor = ({
  submissionId,
  lineOfBusiness,
  items,
  onChange,
  clientName,
  onBusyChange,
}: ChecklistEditorProps) => {
  const { t, i18n } = useTranslation();
  const language = (normalizeLanguage(i18n.resolvedLanguage ?? i18n.language) ??
    fallbackLng) as LangCode;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const inputRef = useRef<HTMLInputElement>(null);
  const [verifying, setVerifying] = useState<{ key: string; name: string }[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedFile[]>([]);
  const [dragging, setDragging] = useState(false);

  const busy = verifying.length > 0;
  useEffect(() => {
    onBusyChange?.(busy);
  }, [busy, onBusyChange]);

  const apply = (next: SubmissionItem[]) => {
    itemsRef.current = next;
    onChange(next);
  };
  const patchItem = (id: DocId, patch: Partial<SubmissionItem>) =>
    apply(itemsRef.current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));

  const openFileIds = () =>
    itemsRef.current
      .filter((entry) => entry.kind === "file" && !entry.received)
      .map((entry) => entry.id);

  const processFile = async ({ key, file, extension }: QueuedFile) => {
    const path = await storeDocument(file, extension).catch((error) => {
      console.error("Document upload failed", error);
      return null;
    });
    if (!path) {
      toast.error(t("intake.uploadFailed", { file: file.name }));
      return;
    }
    const hold = (reason: UnmatchedFile["reason"], note = "") =>
      setUnmatched((prev) => [...prev, { key, name: file.name, path, note, reason }]);

    try {
      // Only the open items are sent with the new file: items already received stay received.
      const checklist = openFileIds().flatMap((id) =>
        DOC_CRITERIA[id]
          ? [{ item_id: id, label: DOC_CRITERIA[id].label, review_criteria: DOC_CRITERIA[id].criteria }]
          : [],
      );
      if (checklist.length === 0) {
        hold("unmatched");
        return;
      }
      const documentId = `doc-${key}`;
      const review = await reviewIntake({
        submissionId,
        language,
        lineOfBusiness,
        checklist,
        documents: [{ document_id: documentId, filename: file.name, path }],
        clientName,
      });
      const hit = review.items.find((entry) => entry.document_ids.includes(documentId));
      const target = checklist.find((entry) => entry.item_id === hit?.item_id);
      if (hit?.status === "received" && target && openFileIds().includes(target.item_id as DocId)) {
        patchItem(target.item_id as DocId, {
          received: true,
          fileName: file.name,
          filePath: path,
          aiVerified: true,
          aiNote: `AI intake review: readable and matches "${target.label}".`,
        });
      } else {
        hold(hit?.status === "needs_review" ? "unreadable" : "unmatched");
      }
    } catch (error) {
      // The file is saved; without the agent, the client chooses where it belongs.
      console.error("Document agent unavailable", error);
      hold("unchecked");
    }
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const queue: QueuedFile[] = [];
    for (const file of Array.from(files)) {
      const extension = documentExtension(file);
      if (extension) queue.push({ key: crypto.randomUUID(), file, extension });
      else toast.error(t("intake.fileRejected", { file: file.name }));
    }
    if (queue.length === 0) return;
    setVerifying((prev) => [...prev, ...queue.map(({ key, file }) => ({ key, name: file.name }))]);
    // One at a time, so two files are never matched to the same checklist item.
    for (const entry of queue) {
      try {
        await processFile(entry);
      } finally {
        setVerifying((prev) => prev.filter((pending) => pending.key !== entry.key));
      }
    }
  };

  const assign = (file: UnmatchedFile, id: DocId) => {
    patchItem(id, {
      received: true,
      fileName: file.name,
      filePath: file.path,
      aiVerified: false,
      aiNote: file.note,
    });
    setUnmatched((prev) => prev.filter((entry) => entry.key !== file.key));
  };

  const reasonText = (reason: UnmatchedFile["reason"]) => {
    switch (reason) {
      case "unmatched":
        return t("intake.reasonUnmatched");
      case "unreadable":
        return t("intake.reasonUnreadable");
      case "unchecked":
        return t("intake.reasonUnchecked");
    }
  };

  const progress = completion(items);
  const remainingFileItems = items.filter((entry) => entry.kind === "file" && !entry.received);

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="font-medium">
            {t("intake.progress", { done: progress.done, total: progress.total })}
          </span>
          <span className="font-semibold tabular-nums">{progress.pct}%</span>
        </div>
        <ProgressBar value={progress.pct} tone={progress.missing.length ? "warning" : "success"} />
      </div>

      <ul className="space-y-2">
        {items.map((entry) => {
          const flagged = !entry.received && !entry.optional;
          return (
            <li
              key={entry.id}
              className={cn(
                "rounded-lg border bg-card p-3 transition-colors",
                entry.received && "border-success/40 bg-success-soft/50",
                flagged && "border-warning/50 bg-warning-soft/60",
              )}
            >
              <div className="flex items-start gap-3">
                {entry.received ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
                ) : flagged ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
                ) : (
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                )}
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{docLabel(t, entry.id)}</span>
                    <Badge variant={entry.optional ? "muted" : "outline"}>
                      {entry.optional ? t("intake.optional") : t("intake.required")}
                    </Badge>
                    {entry.received ? (
                      <Badge variant="success">{t("intake.received")}</Badge>
                    ) : flagged ? (
                      <Badge variant="warning">{t("intake.missing")}</Badge>
                    ) : null}
                    {entry.received && entry.aiVerified ? (
                      <Badge variant="muted">{t("intake.aiVerified")}</Badge>
                    ) : null}
                  </div>
                  {entry.kind === "info" && !entry.fileName ? (
                    <Input
                      value={entry.value ?? ""}
                      placeholder={t("intake.infoPlaceholder")}
                      aria-label={docLabel(t, entry.id)}
                      onChange={(event) =>
                        patchItem(entry.id, {
                          value: event.target.value,
                          received: event.target.value.trim() !== "",
                        })
                      }
                    />
                  ) : entry.fileName ? (
                    <p className="truncate text-xs text-muted-foreground">{entry.fileName}</p>
                  ) : null}
                </div>
                {entry.kind === "file" && entry.received ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label={t("common.remove")}
                    onClick={() => patchItem(entry.id, CLEARED_FILE)}
                  >
                    <X />
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void handleFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-input bg-card px-4 py-8 text-center transition-colors hover:border-primary hover:bg-secondary",
          dragging && "border-primary bg-secondary",
        )}
      >
        <UploadCloud className="h-8 w-8 text-primary" aria-hidden />
        <span className="text-sm font-semibold">{t("intake.dropTitle")}</span>
        <span className="text-xs text-muted-foreground">{t("intake.dropHint")}</span>
        <span className="text-xs text-muted-foreground">{t("intake.aiNote")}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={DOCUMENT_ACCEPT}
        className="hidden"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {verifying.map((pending) => (
        <p key={pending.key} className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          <span className="truncate">{t("intake.verifying", { file: pending.name })}</span>
        </p>
      ))}

      {unmatched.map((file) => (
        <div
          key={file.key}
          className="space-y-2 rounded-lg border border-warning/50 bg-warning-soft/60 p-3"
        >
          <p className="text-sm font-medium">{t("intake.unmatchedTitle")}</p>
          <p className="text-sm">{reasonText(file.reason)}</p>
          <p className="truncate text-xs text-muted-foreground">{file.name}</p>
          <div className="flex items-center gap-2">
            <Select onValueChange={(id) => assign(file, id as DocId)}>
              <SelectTrigger className="bg-card" aria-label={t("intake.unmatchedSelect")}>
                <SelectValue placeholder={t("intake.unmatchedSelect")} />
              </SelectTrigger>
              <SelectContent>
                {remainingFileItems.map((entry) => (
                  <SelectItem key={entry.id} value={entry.id}>
                    {docLabel(t, entry.id)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setUnmatched((prev) => prev.filter((entry) => entry.key !== file.key))}
            >
              {t("common.remove")}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};
