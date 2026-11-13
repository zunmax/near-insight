"use client";

import { useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { NoBreakTokens } from "@/components/ui/NoBreakTokens";
import type { NavIconName } from "@/config/navigation";

/** One definition: its topic (with the section whose color marks it) and the data services its text names. */
export type MethodNote = { title: string; text: string; topic: string; section: NavIconName; sources: readonly string[] };

/** A note's first sentence, its card summary. A full stop ends one only before a space and a capital, "(", a backtick or a
    quote, so 0.01% stays whole. */
const firstSentence = (text: string) => text.split(/(?<=\.)\s+(?=[A-Z(`"])/)[0] ?? text;

/** A note with each `backtick` span shown as inline code; dates and ids in the rest stay on one line. */
function NoteText({ text }: { text: string }) {
  return (
    <>
      {text.split("`").map((piece, i) =>
        i % 2 === 1 ? (
          <code key={i} className="rounded-[4px] bg-surface-3 px-1 text-[12.5px] text-ink">
            {piece}
          </code>
        ) : (
          <NoBreakTokens key={i} text={piece} />
        ),
      )}
    </>
  );
}

function Topic({ note }: { note: MethodNote }) {
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] text-muted">
      <span aria-hidden="true" className="size-2 shrink-0 rounded-full" style={{ background: `var(--section-${note.section})` }} />
      {note.topic}
    </span>
  );
}

/** The definitions as cards, two columns from tablet width; a card opens its full text in a sheet (a centered dialog,
    a bottom sheet on phones) that steps to the previous and next definition. */
export function MethodNotes({ notes }: { notes: MethodNote[] }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);
  const note = notes[index]!;

  /** A route hidden by navigation stays mounted, so an open sheet is closed rather than left in the top layer. */
  useLayoutEffect(() => {
    const element = dialog.current;
    return () => element?.close();
  }, []);

  const open = (i: number) => {
    setIndex(i);
    if (!dialog.current?.open) dialog.current?.showModal();
    dialog.current?.scrollTo({ top: 0 });
  };
  /** Moves from the latest index, so two quick taps move two definitions; a button at the first or last one does nothing. */
  const step = (by: -1 | 1) => {
    if (index + by < 0 || index + by >= notes.length) return;
    setIndex((i) => Math.min(Math.max(i + by, 0), notes.length - 1));
    dialog.current?.scrollTo({ top: 0 });
  };
  /** The sheet fills the dialog, so a click on the dialog itself landed on the backdrop. */
  const onDialogClick = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === dialog.current) dialog.current.close();
  };

  return (
    <>
      <div className="mt-2 grid gap-2.5 md:grid-cols-2">
        {notes.map((item, i) => (
          <button
            key={item.title}
            type="button"
            onClick={() => open(i)}
            className="flex flex-col gap-1.5 rounded-[8px] border border-line-strong px-3.5 py-3 text-left transition-colors hover:bg-[var(--hover)]"
          >
            <Topic note={item} />
            <span className="text-[15px] font-bold text-ink">{item.title}</span>
            <span className="line-clamp-3 text-[13.5px] leading-[1.45] text-ink-2">
              <NoteText text={firstSentence(item.text)} />
            </span>
            <span className="mt-auto pt-1 text-[12.5px] text-muted">{item.text.split(/\s+/).length} words · Read</span>
          </button>
        ))}
      </div>
      <dialog ref={dialog} aria-labelledby="method-note-title" onClick={onDialogClick} className="note-sheet">
        <div className="relative px-6 pt-5 pb-6 max-md:pt-7">
          <button
            type="button"
            onClick={() => dialog.current?.close()}
            aria-label="Close"
            className="absolute top-3 right-3 grid size-[34px] place-items-center rounded-full text-[20px] text-ink hover:bg-[var(--hover)]"
          >
            ×
          </button>
          <Topic note={note} />
          <h3 id="method-note-title" className="mt-1.5 mb-2 pr-8 text-[22px] leading-tight font-extrabold text-ink">
            {note.title}
          </h3>
          <p className="text-[15px] leading-[1.6] text-ink-2">
            <NoteText text={note.text} />
          </p>
          {note.sources.length > 0 ? (
            <div className="mt-3.5 flex flex-wrap gap-1.5">
              {note.sources.map((source) => (
                <span key={source} className="chip h-5 px-2 text-[11.5px] text-muted">
                  {source}
                </span>
              ))}
            </div>
          ) : null}
          <div className="mt-5 flex justify-between border-t border-line pt-3 text-[14px] font-bold">
            {/** aria-disabled rather than disabled, so a button keeps focus when it reaches the first or last definition. */}
            <button type="button" onClick={() => step(-1)} aria-disabled={index === 0} className="text-[var(--blue)] aria-disabled:cursor-default aria-disabled:text-faint">
              ‹ Previous
            </button>
            <button type="button" onClick={() => step(1)} aria-disabled={index === notes.length - 1} className="text-[var(--blue)] aria-disabled:cursor-default aria-disabled:text-faint">
              Next ›
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
