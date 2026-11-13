"use client";

import { catchError } from "next/error";

/** Contains a failing part of a page by rendering nothing in its place, where an error message would be out of place. */
export const HideOnError = catchError(() => null);
