import { db } from "./index.js";

// Schema is applied on first connection; running this script ensures the file exists
// and the schema is materialized.
db();
console.log("DB initialized.");
