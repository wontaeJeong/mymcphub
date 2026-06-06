"use client";

import { useState } from "react";

export type CopyButtonProps = Readonly<{
  value: string;
  label?: string;
}>;

export function CopyButton({ value, label = "Copy" }: CopyButtonProps) {
  const [status, setStatus] = useState("");

  return (
    <span className="copy-control">
      <code>{value}</code>
      <button
        className="button button--ghost"
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(
            () => setStatus("Copied"),
            () => setStatus("Copy failed")
          );
        }}
      >
        {label}
      </button>
      {status ? <span className="muted" role="status">{status}</span> : null}
    </span>
  );
}
