"use client";

import { useState } from "react";

import { CheckCircleIcon, CopyIcon, XCircleIcon } from "./icons";

export type CopyButtonProps = Readonly<{
  value: string;
  label?: string;
  compact?: boolean;
}>;

export function CopyButton({ value, label = "복사", compact = false }: CopyButtonProps) {
  const [status, setStatus] = useState("");
  const buttonClassName = compact ? "button button--ghost button--compact" : "button button--ghost button--compact";

  return (
    <span className="copy-control">
      <code>{value}</code>
      <button
        aria-label={compact ? label : undefined}
        className={buttonClassName}
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(
            () => setStatus("복사됨"),
            () => setStatus("복사 실패")
          );
        }}
      >
        <CopyIcon />
        {compact ? <span className="sr-only">{label}</span> : <span>{label}</span>}
      </button>
      {status ? <span className="copy-control__status muted" role="status">{status === "복사됨" ? <CheckCircleIcon /> : <XCircleIcon />} {status}</span> : null}
    </span>
  );
}
