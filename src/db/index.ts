import Database from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  const path = resolve(process.cwd(), config.DATABASE_URL);
  mkdirSync(dirname(path), { recursive: true });
  _db = new Database(path);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");
  const schema = readFileSync(resolve(__dirname, "schema.sql"), "utf8");
  _db.exec(schema);
  return _db;
}

export function now(): number {
  return Date.now();
}
