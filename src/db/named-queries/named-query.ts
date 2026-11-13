/** The shape of one catalog query: the chart it backs, its SQL, the requests behind its tables and the code that uses it. */
export type NamedQuery = {
  id: string;
  /** The chart or number the query backs. */
  title: string;
  /** Page the chart is on. */
  page: string;
  /** Plain sentences on what the result shows. */
  sentence: string;
  sql: string;
  /** Requests that filled the tables the query reads. */
  requests: string[];
  /** Where the dashboard calculates further from these rows, if it does. */
  code?: string;
};
