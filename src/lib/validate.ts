/** Shape checks for untrusted upstream JSON. Each reader throws with the field path on mismatch. */

/** The message of a caught value: an Error's message, anything else as text. */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class ShapeError extends Error {
  constructor(path: string, expected: string) {
    super(`Unexpected upstream data at ${path}: expected ${expected}`);
    this.name = "ShapeError";
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) throw new ShapeError(path, "an object");
  return value;
}

export function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new ShapeError(path, "an array");
  return value;
}

export function readNumber(record: Record<string, unknown>, key: string, path: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new ShapeError(`${path}.${key}`, "a number");
  return value;
}

/** A number above zero, for amounts such as a price that cannot be zero or negative. */
export function readPositiveNumber(record: Record<string, unknown>, key: string, path: string): number {
  const value = readNumber(record, key, path);
  if (value <= 0) throw new ShapeError(`${path}.${key}`, "a number above zero");
  return value;
}

export function readOptionalNumber(record: Record<string, unknown>, key: string, path: string): number | null {
  const value = record[key];
  if (value === null || value === undefined) return null;
  return readNumber(record, key, path);
}

export function readString(record: Record<string, unknown>, key: string, path: string): string {
  const value = record[key];
  if (typeof value !== "string") throw new ShapeError(`${path}.${key}`, "a string");
  return value;
}

/** The value as an absolute http(s) URL, or null for anything else (other schemes, relative or malformed URLs). */
export function toHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Reads a `[numerator, denominator]` rational as used by NEAR protocol config. */
export function readRatio(record: Record<string, unknown>, key: string, path: string): number {
  const pair = asArray(record[key], `${path}.${key}`);
  const [num, den] = pair;
  if (typeof num !== "number" || typeof den !== "number" || den === 0) {
    throw new ShapeError(`${path}.${key}`, "a [numerator, denominator] pair");
  }
  return num / den;
}

/** Reads a `[timestamp, value]` daily series as returned by DefiLlama summaries. */
export function readDailySeries(value: unknown, path: string): Array<{ time: number; value: number }> {
  return asArray(value, path).map((point, i) => {
    const pair = asArray(point, `${path}[${i}]`);
    const [time, amount] = pair;
    if (typeof time !== "number" || typeof amount !== "number") {
      throw new ShapeError(`${path}[${i}]`, "a [timestamp, number] pair");
    }
    return { time, value: amount };
  });
}

/** Reads a yoctoNEAR integer string exactly, as a bigint. */
export function readYocto(record: Record<string, unknown>, key: string, path: string): bigint {
  const value = readString(record, key, path);
  if (!/^\d+$/.test(value)) throw new ShapeError(`${path}.${key}`, "a yoctoNEAR integer string");
  return BigInt(value);
}

const YOCTO_PER_MICRO_NEAR = 10n ** 18n;

/** Converts a yoctoNEAR decimal string (10^-24 NEAR) to a NEAR number with micro-NEAR precision. */
export function yoctoToNear(yocto: string, path: string): number {
  if (!/^\d+$/.test(yocto)) throw new ShapeError(path, "a yoctoNEAR integer string");
  return Number(BigInt(yocto) / YOCTO_PER_MICRO_NEAR) / 1e6;
}
