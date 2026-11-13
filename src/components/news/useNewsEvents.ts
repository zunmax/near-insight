"use client";

import { useEffect, useEffectEvent } from "react";
import type { NewsItem } from "@/db/schema";
import { readNewsEvent } from "@/lib/news";

/** First wait before reconnecting; doubles after each failed attempt up to the cap. */
const RECONNECT_MS = 2_000;
const RECONNECT_MAX_MS = 60_000;

/** Calls `onStories` with each batch the worker's news WebSocket pushes (the latest stories on each connect, then each new
    one) and `onConnection` with whether it is open. Reconnects with backoff while the tab is visible; a URL the browser
    refuses (malformed, or ws:// from an https page) stops it, and the stories rendered with the page stay. */
export function useNewsEvents(url: string, onStories: (items: NewsItem[]) => void, onConnection: (open: boolean) => void) {
  const handleStories = useEffectEvent(onStories);
  const handleConnection = useEffectEvent(onConnection);
  useEffect(() => {
    let socket: WebSocket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let delay = RECONNECT_MS;
    let stopped = false;
    let waiting = false;
    const connect = () => {
      waiting = false;
      try {
        socket = new WebSocket(url);
      } catch {
        stopped = true;
        return;
      }
      socket.onopen = () => {
        delay = RECONNECT_MS;
        handleConnection(true);
      };
      socket.onmessage = (event) => {
        const items = typeof event.data === "string" ? readNewsEvent(event.data) : null;
        if (items && items.length > 0) handleStories(items);
      };
      socket.onclose = () => {
        handleConnection(false);
        if (stopped) return;
        /** A hidden tab waits; it reconnects when it is shown again. */
        waiting = true;
        if (document.hidden) return;
        timer = setTimeout(connect, delay);
        delay = Math.min(delay * 2, RECONNECT_MAX_MS);
      };
    };
    const onVisibility = () => {
      if (!stopped && waiting && !document.hidden) {
        clearTimeout(timer);
        connect();
      }
    };
    connect();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stopped = true;
      clearTimeout(timer);
      socket?.close();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [url]);
}
