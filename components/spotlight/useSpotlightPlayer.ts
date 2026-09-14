"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Shared engine behind the spotlight bar-chart interaction: bars grow in
// (handled by the chart itself), then this drives an auto-cycling overlay
// that types out one slide's real report text, holds, advances to the
// next slide, and loops -- until a bar is clicked, which pins that slide
// and stops the cycle. Used identically by both dashboard charts, so it
// lives here once rather than being duplicated per chart.
export interface SpotlightSlide {
  key: string;
  title: string;
  bodyText: string; // plain text, \n for line breaks -- typed out char by char
}

export interface SpotlightPlayerOptions {
  holdMs?: number; // how long a slide stays up after typing finishes
  typeSpeedMs?: number; // ms per character
}

export interface SpotlightPlayerState {
  isOpen: boolean;
  isPlaying: boolean;
  isPinned: boolean;
  currentIndex: number;
  typedText: string;
  isTypingDone: boolean;
  play: () => void; // start/resume auto-cycling from slide 0 (or current if paused mid-cycle)
  pause: () => void;
  pin: (index: number) => void;
  resume: () => void; // alias for play, used by the "resume auto-play" link
  close: () => void; // fully exit back to the plain chart (unlike pause, which stays pinned/open)
}

const DEFAULT_HOLD_MS = 2200;
const DEFAULT_TYPE_SPEED_MS = 18;

export function useSpotlightPlayer(
  slides: SpotlightSlide[],
  { holdMs = DEFAULT_HOLD_MS, typeSpeedMs = DEFAULT_TYPE_SPEED_MS }: SpotlightPlayerOptions = {},
): SpotlightPlayerState {
  const [isOpen, setIsOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [typedText, setTypedText] = useState("");
  const [isTypingDone, setIsTypingDone] = useState(false);
  const [playToken, setPlayToken] = useState(0);

  const typeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors isPlaying for reads inside timer callbacks -- state itself is
  // stale inside a closure created before a later setState call runs.
  const playingRef = useRef(false);

  const clearTimers = useCallback(() => {
    if (typeTimerRef.current) clearInterval(typeTimerRef.current);
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    typeTimerRef.current = null;
    advanceTimerRef.current = null;
  }, []);

  const typeSlide = useCallback(
    (index: number, { advanceOnDone }: { advanceOnDone: boolean }) => {
      const slide = slides[index];
      if (!slide) return;
      clearTimers();
      setTypedText("");
      setIsTypingDone(false);
      let i = 0;
      typeTimerRef.current = setInterval(() => {
        i++;
        setTypedText(slide.bodyText.slice(0, i));
        if (i >= slide.bodyText.length) {
          if (typeTimerRef.current) clearInterval(typeTimerRef.current);
          typeTimerRef.current = null;
          setIsTypingDone(true);
          if (advanceOnDone) {
            advanceTimerRef.current = setTimeout(() => {
              if (!playingRef.current) return;
              setCurrentIndex((prev) => (prev + 1) % slides.length);
            }, holdMs);
          }
        }
      }, typeSpeedMs);
    },
    [slides, holdMs, typeSpeedMs, clearTimers],
  );

  // Whenever currentIndex changes while playing, (re)type that slide and
  // queue the advance to the next one -- this is what makes the loop
  // self-sustaining without a single long-lived recursive timer.
  //
  // playToken exists for a real bug it fixes: play()/pin() can set
  // currentIndex to a value it's already at (e.g. resuming while the
  // pinned slide happens to be index 0, which is also where play()
  // always resets to) -- React skips the effect when no dependency's
  // *value* actually changed, even though play()/pin() were called. The
  // token increments on every play()/pin() call regardless of the
  // resulting index, so the effect always re-fires and actually resumes
  // typing/auto-advance instead of silently doing nothing. It must NOT
  // change on pause() -- pause is supposed to freeze whatever's on
  // screen in place, not restart the typing animation.
  useEffect(() => {
    if (!isOpen) return;
    typeSlide(currentIndex, { advanceOnDone: playingRef.current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, playToken]);

  const play = useCallback(() => {
    clearTimers();
    playingRef.current = true;
    setIsPlaying(true);
    setIsPinned(false);
    setIsOpen(true);
    setCurrentIndex(0);
    setPlayToken((t) => t + 1);
  }, [clearTimers]);

  const resume = play;

  const pause = useCallback(() => {
    clearTimers();
    playingRef.current = false;
    setIsPlaying(false);
    setIsPinned(true);
  }, [clearTimers]);

  // Unlike pause (which freezes the current slide, still open/pinned),
  // close fully exits the overlay -- for clicking the backdrop or an
  // explicit close action, back to the plain chart underneath.
  const close = useCallback(() => {
    clearTimers();
    playingRef.current = false;
    setIsPlaying(false);
    setIsPinned(false);
    setIsOpen(false);
  }, [clearTimers]);

  const pin = useCallback(
    (index: number) => {
      clearTimers();
      playingRef.current = false;
      setIsPlaying(false);
      setIsPinned(true);
      setIsOpen(true);
      setCurrentIndex(index);
      setPlayToken((t) => t + 1);
    },
    [clearTimers],
  );

  useEffect(() => () => clearTimers(), [clearTimers]);

  return {
    isOpen,
    isPlaying,
    isPinned,
    currentIndex,
    typedText,
    isTypingDone,
    play,
    pause,
    pin,
    resume,
    close,
  };
}
