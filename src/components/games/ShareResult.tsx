"use client";

import * as React from "react";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { SITE } from "@/lib/site";
import { useCanShare } from "@/lib/utils/use-local";
import { track } from "@/lib/analytics";

/**
 * Uses the Web Share API where the browser supports it and falls back to
 * copy-to-clipboard everywhere else. No forced sharing, no pre-filled spam.
 */
export function ShareResult({
  text,
  url,
  title = "My DO101 result",
  gameId,
}: {
  text: string;
  url: string;
  title?: string;
  gameId: string;
}) {
  const canShare = useCanShare();
  const fullUrl = url.startsWith("http") ? url : `${SITE.url}${url}`;
  const message = `${text} ${fullUrl}`;

  const share = async () => {
    try {
      await navigator.share({ title, text, url: fullUrl });
      track("share_result", { game: gameId, method: "web-share" });
    } catch {
      /* the visitor cancelled — nothing to do */
    }
  };

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {canShare ? (
        <Button tone="sky" onClick={share}>
          Share result
        </Button>
      ) : null}
      <CopyButton
        value={message}
        label="Copy result"
        copiedLabel="Copied!"
        tone={canShare ? "panel" : "sky"}
        size="md"
        onCopied={() => track("share_result", { game: gameId, method: "clipboard" })}
      />
    </div>
  );
}
