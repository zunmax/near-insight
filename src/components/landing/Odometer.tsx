"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import type { LandingFigure } from "@/lib/thesis/landing-figures";

/** How long each figure shows before the next one rolls in, in ms; the progress line under the eyebrow fills in this time. */
const FIGURE_MS = 2600;

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/** Easing of the sideways glide, matching --ease-out. */
const GLIDE = { duration: 700, easing: "cubic-bezier(0.16, 1, 0.3, 1)" };

/** "$4.47B" → { prefix: "$", chars: "4.47", magnitude: "B", unit: "" }; "416.2K NEAR" → { …, magnitude: "K", unit: "NEAR" };
    "27 chains" → { prefix: "", chars: "27", magnitude: "", unit: "chains" }. */
function splitValue(value: string) {
  const [, prefix = "", chars = "", magnitude = "", unit = value] = /^(\D*?)(\d[\d.,]*)([KMBT](?=\s|$))?\s*(.*)$/.exec(value) ?? [];
  return { prefix, chars, magnitude, unit };
}

/** Digits further right roll first, like a mechanical counter. */
const rollDelay = (fromRight: number) => ({ transitionDelay: `${fromRight * 70}ms`, animationDelay: `${fromRight * 70}ms` }) as CSSProperties;

/** The landing figures one after another: each digit rolls on its own strip to the next value, the unit and the outlined
    verb slide up, and pieces that move sideways when the number's width changes glide to their new place. */
export function Odometer({ figures }: { figures: LandingFigure[] }) {
  const [index, setIndex] = useState(0);
  /** Hovering pauses the figures; each resume starts a fresh run, so the progress line restarts with the timer. */
  const [paused, setPaused] = useState(false);
  const [run, setRun] = useState(0);
  const pieces = useRef<Array<HTMLElement | null>>([]);
  const lefts = useRef<Array<number | null> | null>(null);

  const parts = figures.map((figure) => splitValue(figure.value));
  const cellCount = Math.max(...parts.map((part) => part.chars.length));

  useEffect(() => {
    /** Reduced motion keeps the first figure. A hidden tab keeps its figure, so the page does no work in the background. */
    if (figures.length < 2 || paused || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % figures.length);
    }, FIGURE_MS);
    return () => clearInterval(timer);
  }, [figures.length, paused]);

  /** Pieces whose place changed glide from the old place; offsetLeft ignores transforms, so a running glide does not skew it. */
  useLayoutEffect(() => {
    const measure = () => pieces.current.map((el) => (el?.offsetParent ? el.offsetLeft : null));
    const before = lefts.current;
    const now = measure();
    lefts.current = now;
    if (before && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      pieces.current.forEach((el, k) => {
        const from = before[k];
        const to = now[k];
        if (el && from != null && to != null && from !== to) el.animate([{ transform: `translateX(${from - to}px)` }, { transform: "none" }], GLIDE);
      });
    }
    const onResize = () => {
      lefts.current = measure();
    };
    addEventListener("resize", onResize);
    return () => removeEventListener("resize", onResize);
  }, [index]);

  const figure = figures[index];
  const part = parts[index];
  if (!figure || !part) return null;
  const { prefix, chars, magnitude, unit } = part;

  return (
    <div
      className="odometer"
      aria-hidden="true"
      data-paused={paused || undefined}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => {
        setPaused(false);
        setRun((r) => r + 1);
      }}
    >
      <p key={`eyebrow-${index}`} className="landing-eyebrow odometer-fade">
        {figure.eyebrow}
      </p>
      <span className="odometer-progress">
        <i key={`${index}-${run}`} />
      </span>
      <div className="odometer-value">
        <span
          ref={(el) => {
            pieces.current[0] = el;
          }}
          hidden={!prefix}
        >
          {prefix}
        </span>
        {Array.from({ length: cellCount }, (_, k) => {
          const char = chars[k];
          const digit = char !== undefined && /\d/.test(char);
          return (
            <span
              key={k}
              ref={(el) => {
                pieces.current[k + 1] = el;
              }}
              hidden={char === undefined}
              className={digit ? "odometer-cell" : "odometer-cell odometer-mark"}
            >
              {digit ? (
                <span className="odometer-strip" style={{ transform: `translateY(${-Number(char)}em)`, ...rollDelay(chars.length - 1 - k) }}>
                  {DIGITS.map((digit) => (
                    <span key={digit}>{digit}</span>
                  ))}
                </span>
              ) : (
                char
              )}
            </span>
          );
        })}
        <span
          ref={(el) => {
            pieces.current[cellCount + 1] = el;
          }}
          hidden={!magnitude}
          className="odometer-magnitude"
        >
          <span key={index}>{magnitude}</span>
        </span>
        <span
          ref={(el) => {
            pieces.current[cellCount + 2] = el;
          }}
          hidden={!unit}
          className="odometer-unit"
        >
          <span key={index}>{unit}</span>
        </span>
      </div>
      <p className="odometer-verb landing-outline">
        <span key={index}>
          {figure.verb}
          <b>.</b>
        </span>
      </p>
    </div>
  );
}
