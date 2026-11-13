import { TRIGGERS } from "@/config/thesis-triggers";
import { digitsApart, formatPercent } from "@/lib/format";

/** Decimals at which max issuance and the supply breaking point's ceiling print apart, as the check compares them unrounded. */
export const maxIssuanceDigits = (rate: number) => digitsApart(rate * 100, TRIGGERS.maxIssuanceCeiling * 100, 1);

/** Max issuance as a percentage at maxIssuanceDigits: 0.025 → "2.5%", 0.0251 → "2.51%". */
export const formatMaxIssuance = (rate: number) => formatPercent(rate, maxIssuanceDigits(rate));
