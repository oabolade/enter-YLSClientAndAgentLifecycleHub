import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileText, Loader2, UploadCloud, X } from "lucide-react";
import { useTranslation } from "react-i18next";

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
import { completion, matchFile } from "@/lib/hub/checklists";
import { docLabel } from "@/lib/hub/labels";
import type { DocId, SubmissionItem } from "@/lib/hub/types";
import { cn } from "@/lib/utils";

type ChecklistEditorProps = {
  items: SubmissionItem[];
  onChange: (items: SubmissionItem[]) => void;
};

type UnmatchedFile = { key: string; name: string };

export const ChecklistEditor = ({ items, onChange }: ChecklistEditorProps) => {
  const { t } = useTranslation();
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const inputRef = useRef<HTMLInputElement>(null);
  const [verifying, setVerifying] = useState<string[]>([]);
  const [unmatched, setUnmatched] = useState<UnmatchedFile[]>([]);
  const [dragging, setDragging] = useState(false);

  const apply = (next: SubmissionItem[]) => {
    itemsRef.current = next;
    onChange(next);
  };
  const patchItem = (id: DocId, patch: Partial<SubmissionItem>) =>
    apply(itemsRef.current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)));

  const openFileItems = () =>
    itemsRef.current.filter((entry) => entry.kind === "file" && !entry.received);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach((file, index) => {
      setVerifying((prev) => [...prev, file.name]);
      // Simulated verification delay; the live Document Completeness agent replaces this.
      window.setTimeout(() => {
        setVerifying((prev) => {
          const at = prev.indexOf(file.name);
          return at === -1 ? prev : [...prev.slice(0, at), ...prev.slice(at + 1)];
        });
        const hit = matchFile(
          file.name,
          openFileItems().map((entry) => entry.id),
        );
        if (hit) patchItem(hit, { received: true, fileName: file.name });
        else
          setUnmatched((prev) => [
            ...prev,
            { key: `${file.name}-${Date.now()}-${index}`, name: file.name },
          ]);
      }, 900 + index * 300);
    });
  };

  const assign = (file: UnmatchedFile, id: DocId) => {
    patchItem(id, { received: true, fileName: file.name });
    setUnmatched((prev) => prev.filter((entry) => entry.key !== file.key));
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
                    onClick={() => patchItem(entry.id, { received: false, fileName: undefined })}
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
          handleFiles(event.dataTransfer.files);
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
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {verifying.map((name, index) => (
        <p
          key={`${name}-${index}`}
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t("intake.verifying", { file: name })}
        </p>
      ))}

      {unmatched.map((file) => (
        <div
          key={file.key}
          className="space-y-2 rounded-lg border border-warning/50 bg-warning-soft/60 p-3"
        >
          <p className="text-sm font-medium">{t("intake.unmatchedTitle")}</p>
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
