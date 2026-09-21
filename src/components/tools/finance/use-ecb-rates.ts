"use client";

import * as React from "react";
import { fetchLatest, RateError, type RateTable } from "@/lib/currency/rates";

/**
 * The ECB reference-rate table, fetched only when something needs it.
 *
 * `wanted` gates the request: a XAU/USD position for a dollar account needs no
 * conversion at all, so it should not cost the visitor a network request to a
 * third party. The table is shared across every component on the page.
 */
let shared: Promise<RateTable> | null = null;

export function useEcbRates(wanted: boolean): { table: RateTable | null; error: string | null } {
  const [table, setTable] = React.useState<RateTable | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!wanted || table) return;
    let cancelled = false;
    shared ??= fetchLatest();
    shared.then(
      (loaded) => {
        if (!cancelled) setTable(loaded);
      },
      (thrown) => {
        shared = null;
        if (!cancelled) setError(thrown instanceof RateError ? thrown.message : "Rates could not be loaded.");
      },
    );
    return () => {
      cancelled = true;
    };
  }, [wanted, table]);

  return { table, error };
}
