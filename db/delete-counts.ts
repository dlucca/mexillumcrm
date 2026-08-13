import { sql } from "drizzle-orm";
import type { AnyDb } from "@/db/types";
import { contacts, activities, tasks } from "@/db/schema";

// Conteos de descendencia para el impacto del borrado en cascada. Se resuelven en
// batch (GROUP BY) para toda la tabla, evitando N+1 por fila; los ids sin registros
// simplemente no aparecen en el mapa (el consumidor asume 0). Mismo patrón que
// lastActivityByCompany.

export type CompanyRelationCounts = { contacts: number; activities: number; tasks: number };

async function countByCompany(
  db: AnyDb,
  table: typeof contacts | typeof activities | typeof tasks
): Promise<Map<string, number>> {
  const rows = await db
    .select({ companyId: table.companyId, n: sql<number>`count(*)::int` })
    .from(table)
    .groupBy(table.companyId);
  return new Map(rows.map((r) => [r.companyId, r.n]));
}

export async function companyRelationCounts(db: AnyDb): Promise<Map<string, CompanyRelationCounts>> {
  const [contactMap, activityMap, taskMap] = await Promise.all([
    countByCompany(db, contacts),
    countByCompany(db, activities),
    countByCompany(db, tasks),
  ]);
  const ids = new Set([...contactMap.keys(), ...activityMap.keys(), ...taskMap.keys()]);
  const map = new Map<string, CompanyRelationCounts>();
  for (const id of ids) {
    map.set(id, {
      contacts: contactMap.get(id) ?? 0,
      activities: activityMap.get(id) ?? 0,
      tasks: taskMap.get(id) ?? 0,
    });
  }
  return map;
}
