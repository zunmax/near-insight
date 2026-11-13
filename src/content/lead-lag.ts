import type { LeadLagQuestion } from "@/lib/lead-lag";

/** Each lead-lag question as the series that leads and the series tested for following it some weeks later. */
export const LEAD_LAG_QUESTIONS: Record<LeadLagQuestion, readonly [leads: string, follows: string]> = {
  volumeLeadsPrice: ["Intents volume growth", "NEAR's return beyond the market"],
  priceLeadsVolume: ["NEAR's return beyond the market", "Intents volume growth"],
  volumeLeadsUsage: ["Intents volume growth", "active-accounts growth"],
  priceLeadsUsage: ["NEAR's return", "active-accounts growth"],
};

/** Short name of each question's two series, for the buttons that switch between them. */
export const LEAD_LAG_QUESTION_LABELS: Record<LeadLagQuestion, readonly [leads: string, follows: string]> = {
  volumeLeadsPrice: ["Volume", "price"],
  priceLeadsVolume: ["Price", "volume"],
  volumeLeadsUsage: ["Volume", "accounts"],
  priceLeadsUsage: ["Price", "accounts"],
};

/** A test as one line of plain text, e.g. "Intents volume growth leads active-accounts growth"; a same-week test (lag 0) "moves with", as it shows no lead. */
export function leadLagQuestionText(question: LeadLagQuestion, lag: number): string {
  return LEAD_LAG_QUESTIONS[question].join(lag === 0 ? " moves with " : " leads ");
}
