'use client';

import { useEffect } from 'react';

/* Signals from inside React that hydration has completed (and that client
   handlers — Link navigation, buttons — are actually attached). The E2E
   waits for this before any interaction that needs React. */
export default function Hydrated() {
  useEffect(() => {
    window.__hlxHydrated = true;
  }, []);
  return <span id="hydration-flag" hidden />;
}
