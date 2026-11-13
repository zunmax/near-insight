import { CodeTokens } from "@/components/ui/CodeTokens";
import { sqlTokens } from "@/lib/sql-tokens";

/** A SQL statement with keywords, functions, strings and numbers colored; the caller supplies the surrounding <pre>. */
export function SqlCode({ sql }: { sql: string }) {
  return <CodeTokens pieces={sqlTokens(sql)} />;
}
