"use client";

import { createContext, useCallback, useContext, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from "react";
import { useNewsEvents } from "@/components/news/useNewsEvents";
import type { NewsItem } from "@/db/schema";
import { addNewStories, NEWS_PAGE_SIZE } from "@/lib/news";

type Listener = (items: NewsItem[]) => void;

const NewsEventsContext = createContext<{ connected: boolean; subscribe: (listener: Listener) => () => void } | null>(null);

/** One news WebSocket for everything inside it (the dashboard layout): the feeds hear the pushed stories, and the live
    badges show only while the socket is open. */
export function NewsEventsProvider({ url, children }: { url: string; children: ReactNode }) {
  const listeners = useRef(new Set<Listener>());
  /** The newest stories pushed so far, replayed to each new listener: a page kept hidden and shown again was not listening. */
  const recent = useRef<NewsItem[]>([]);
  const [connected, setConnected] = useState(false);
  useNewsEvents(
    url,
    (items) => {
      recent.current = addNewStories(recent.current, items, NEWS_PAGE_SIZE).items;
      for (const listener of listeners.current) listener(items);
    },
    setConnected,
  );
  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    if (recent.current.length > 0) listener(recent.current);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);
  const value = useMemo(() => ({ connected, subscribe }), [connected, subscribe]);
  return <NewsEventsContext value={value}>{children}</NewsEventsContext>;
}

/** Calls `onStories` with each batch of stories the surrounding NewsEventsProvider receives. */
export function useNewsStories(onStories: Listener) {
  const context = useContext(NewsEventsContext);
  const handleStories = useEffectEvent(onStories);
  useEffect(() => context?.subscribe((items) => handleStories(items)), [context]);
}

/** "Live", while the surrounding NewsEventsProvider's socket is open; nothing otherwise. */
export function NewsLiveBadge() {
  const connected = useContext(NewsEventsContext)?.connected ?? false;
  if (!connected) return null;
  return (
    <span className="flex items-center gap-1.5 text-[12px] font-semibold text-up">
      <span aria-hidden="true" className="live-dot" />
      Live
    </span>
  );
}
