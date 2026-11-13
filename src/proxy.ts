import { NextResponse, type NextRequest } from "next/server";
import { isStoryStored } from "@/data/news";
import { STORY_ID } from "@/lib/news";

/** A story link that names no stored story answers 404. The story page streams, which fixes its status at 200 before the
    story is read, so the check runs here first and rewrites to a page that answers 404 with the story's not-found message. */
export function proxy(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (id !== null && STORY_ID.test(id) && isStoryStored(id)) return NextResponse.next();
  return NextResponse.rewrite(new URL("/dashboard/news/story/missing", request.url));
}

export const config = { matcher: "/dashboard/news/story" };
