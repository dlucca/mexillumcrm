import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";

export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;
