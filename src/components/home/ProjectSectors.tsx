import { NEAR_SECTORS } from "@/content/facts";

/** NEAR's sectors as chips under the Home page title. */
export function ProjectSectors() {
  return (
    <ul className="m-0 mt-3 flex list-none flex-wrap gap-1.5 p-0">
      {NEAR_SECTORS.map((sector) => (
        <li key={sector} className="chip">
          {sector}
        </li>
      ))}
    </ul>
  );
}
