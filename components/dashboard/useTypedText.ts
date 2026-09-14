"use client";

import { useEffect, useRef, useState } from "react";

// Simple one-shot typewriter -- types `text` once, character by character,
// starting when `startWhen` becomes true. Deliberately not the spotlight
// feature's useSpotlightPlayer: this has no auto-cycle/pin/resume, just a
// single type-once-and-stop, which is all the insight line needs.
export function useTypedText(
  text: string,
  { speedMs = 18, startWhen = true }: { speedMs?: number; startWhen?: boolean } = {},
): { typed: string; done: boolean } {
  const [typed, setTyped] = useState("");
  const [done, setDone] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!startWhen || startedRef.current || !text) return;
    startedRef.current = true;

    let i = 0;
    const id = setInterval(() => {
      i++;
      setTyped(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setDone(true);
      }
    }, speedMs);
    return () => clearInterval(id);
  }, [startWhen, text, speedMs]);

  return { typed, done };
}
