import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
const client = new pg.Client({ connectionString: DATABASE_URL });

async function main(): Promise<void> {
  await client.connect();
  const r = await client.query(
    `SELECT id, "questionnaireData" FROM wedding_indicators LIMIT 1`
  );
  const qd = r.rows[0]?.questionnaireData as Record<string, unknown>;
  if (!qd) {
    console.log("No data found");
    return;
  }

  const sigs = (qd.signatures || {}) as Record<string, string>;
  const sigNames = qd.signatureNames as Record<string, string> | null;
  console.log("signatureDate:", qd.signatureDate);
  console.log("signatureNames:", JSON.stringify(sigNames, null, 2));
  console.log("signature keys:", Object.keys(sigs));
  for (const [k, v] of Object.entries(sigs)) {
    console.log(`  ${k}: ${typeof v === "string" ? v.substring(0, 80) + "..." : typeof v}`);
  }
  await client.end();
}

main().catch(console.error);
