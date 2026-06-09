import { db } from "../db/index.js";

export type Biller = { id: string; category: string; name: string; vpa: string; region: string | null; active: number };

// Seed catalogue of common Indian billers (mocked vpa addresses for v0).
const SEED: Biller[] = [
  { id: "bil_mseb", category: "electricity", name: "MSEDCL (Maharashtra)", vpa: "msedcl@billdesk", region: "MH", active: 1 },
  { id: "bil_bescom", category: "electricity", name: "BESCOM (Karnataka)", vpa: "bescom@billdesk", region: "KA", active: 1 },
  { id: "bil_tneb", category: "electricity", name: "TNEB (Tamil Nadu)", vpa: "tneb@billdesk", region: "TN", active: 1 },
  { id: "bil_airtel_pre", category: "mobile", name: "Airtel Prepaid", vpa: "airtel.prepaid@payu", region: "ALL", active: 1 },
  { id: "bil_jio_pre", category: "mobile", name: "Jio Prepaid", vpa: "jio.prepaid@payu", region: "ALL", active: 1 },
  { id: "bil_vi_pre", category: "mobile", name: "Vi Prepaid", vpa: "vi.prepaid@payu", region: "ALL", active: 1 },
  { id: "bil_tata_dth", category: "dth", name: "Tata Play DTH", vpa: "tataplay@billdesk", region: "ALL", active: 1 },
  { id: "bil_airtel_dth", category: "dth", name: "Airtel Digital TV", vpa: "airteldth@billdesk", region: "ALL", active: 1 },
  { id: "bil_igl", category: "gas", name: "IGL (Delhi/NCR)", vpa: "igl@billdesk", region: "DL", active: 1 },
  { id: "bil_mgl", category: "gas", name: "MGL (Mumbai)", vpa: "mgl@billdesk", region: "MH", active: 1 },
  { id: "bil_act", category: "broadband", name: "ACT Fibernet", vpa: "act@billdesk", region: "ALL", active: 1 },
  { id: "bil_airtel_bb", category: "broadband", name: "Airtel Xstream Broadband", vpa: "airtelbb@billdesk", region: "ALL", active: 1 },
  { id: "bil_lic", category: "insurance", name: "LIC India Premium", vpa: "lic@billdesk", region: "ALL", active: 1 },
];

export function seedBillers() {
  const ins = db().prepare(
    `INSERT OR IGNORE INTO billers (id, category, name, vpa, region, active) VALUES (?, ?, ?, ?, ?, ?)`
  );
  db().transaction(() => {
    for (const b of SEED) ins.run(b.id, b.category, b.name, b.vpa, b.region, b.active);
  })();
}

export function listBillers(category?: string, region?: string): Biller[] {
  let where = "active = 1";
  const args: any[] = [];
  if (category) { where += " AND category = ?"; args.push(category); }
  if (region) { where += " AND (region = ? OR region = 'ALL')"; args.push(region); }
  return db().prepare(`SELECT * FROM billers WHERE ${where} ORDER BY category, name`).all(...args) as Biller[];
}

export function getBiller(id: string): Biller | null {
  return (db().prepare(`SELECT * FROM billers WHERE id = ?`).get(id) as Biller | undefined) ?? null;
}
