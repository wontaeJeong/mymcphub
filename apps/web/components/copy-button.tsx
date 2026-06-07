"use client";

import { useState } from "react";

export type CopyButtonProps = Readonly<{
  value: string;
  label?: string;
}>;

export function CopyButton({ value, label = "복사" }: CopyButtonProps) {
  const [status, setStatus] = useState("");

  return (
    <span className="copy-control">
      <code>{value}</code>
      <button
        className="button button--ghost"
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(
            () => setStatus("복사됨"),
            () => setStatus("복사 실패")
          );
        }}
      >
        {label}
      </button>
      {status ? <span className="muted" role="status">{status}</span> : null}
    </span>
  );
}
