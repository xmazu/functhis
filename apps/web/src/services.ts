import { createAuth as createConfiguredAuth } from "@functhis/auth";
import { type Database, createDb } from "@functhis/db";

import { env } from "./env.server";

export function getDb(): Database {
  return createDb(env);
}
export async function createAuth(database?: Database) {
  return createConfiguredAuth(env, database ?? (await getDb()));
}
