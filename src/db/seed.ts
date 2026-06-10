import { randomUUID } from "node:crypto";
import { db } from "./index.js";
import { DEMO_USER_ID, seedDemoUser } from "../services/demo_seed.js";

const conn = db();
seedDemoUser(conn);

console.log("Seeded user:", DEMO_USER_ID);
console.log("idempotency demo key:", randomUUID());
