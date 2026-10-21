"use client";

import { useState, useSyncExternalStore } from "react";

function subscribe() {
  return function unsubscribe() {};
}

function clientSnapshot() {
  return true;
}

function serverSnapshot() {
  return false;
}

// Portals must stay absent during hydration, matching the server markup.
// React rechecks the client snapshot after hydration, then renders the portal.
export function usePortalContainer() {
  const hydrated = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  const [container] = useState(function createContainer() {
    if (typeof document === "undefined") return null;
    return document.createElement("div");
  });
  if (!hydrated) return null;
  return container;
}
