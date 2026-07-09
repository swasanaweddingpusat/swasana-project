import { readFileSync } from "fs";
import pg from "pg";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL not set");
}

const TEMP_TABLE = "wedding_indicators_import";

async function main(): Promise<void> {
  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();

  try {
    // 1. Check existing venues for name→id mapping
    const venueRows = await client.query<{ id: string; name: string }>(
      `SELECT id, name FROM venues WHERE "isActive" = true`
    );
    console.log(`Found ${venueRows.rows.length} venues:`);
    for (const v of venueRows.rows) {
      console.log(`  - ${v.name} (${v.id})`);
    }

    // 2. Get a default createdById (first admin profile)
    const profileRow = await client.query<{ id: string }>(
      `SELECT p.id FROM profiles p
       JOIN users u ON u.id = p."userId"
       JOIN roles r ON r.id = p."roleId"
       WHERE r."isSystemRole" = true
       LIMIT 1`
    );
    const defaultCreatedById = profileRow.rows[0]?.id;
    if (!defaultCreatedById) {
      throw new Error("No admin profile found for createdById fallback");
    }
    console.log(`Default createdById: ${defaultCreatedById}`);

    // 3. Create temp table
    await client.query(`DROP TABLE IF EXISTS ${TEMP_TABLE}`);
    await client.query(`
      CREATE TABLE ${TEMP_TABLE} (
        id INTEGER,
        created_at TIMESTAMPTZ,
        user_id UUID,
        event_date DATE,
        questionnaire_data TEXT,
        couple_name TEXT,
        venue TEXT
      )
    `);
    console.log("Created temp table");

    // 4. Read and modify SQL file
    const sqlPath = process.argv[2] || "C:\\Users\\U S E R\\Downloads\\wedding_indicators_rows (1).sql";
    console.log(`Reading SQL file: ${sqlPath}`);
    let sql = readFileSync(sqlPath, "utf-8");
    sql = sql.replace(
      `"public"."wedding_indicators"`,
      `"public"."${TEMP_TABLE}"`
    );
    // Sanitize: remove carriage returns and other control chars invalid in JSON
    sql = sql.replace(/\r/g, "");
    console.log(`Executing INSERT (${(sql.length / 1024 / 1024).toFixed(1)}MB)...`);
    await client.query(sql);

    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM ${TEMP_TABLE}`
    );
    console.log(`Imported ${countResult.rows[0].count} rows into temp table`);

    // 5. Build venue name → id map with explicit aliases
    const venueMap = new Map<string, string>();
    for (const v of venueRows.rows) {
      venueMap.set(v.name.toLowerCase().trim(), v.id);
    }

    // Old Supabase venue names → current DB venue names
    const venueAliases: Record<string, string> = {
      "swasana brin gatsu": "brin gatot subroto",
      "swasana brin thamrin": "brin thamrin",
      "swasana grand slipi": "grand slipi",
      "swasana dharmagati": "dharmagati",
      "swasana lippo kuningan": "lippo kuningan",
      "swasana patrajasa": "patrajasa",
      "swasana seskoad": "seskoad",
      "gunawarman samisara": "samisara sopodel",
      "gunawarman bripens": "menara bripens",
      "pakubuwono": "paramita", // confirm with user if this mapping is correct
    };

    for (const [alias, canonical] of Object.entries(venueAliases)) {
      const id = venueMap.get(canonical);
      if (id) {
        venueMap.set(alias, id);
      }
    }

    // 6. Query temp data
    const tempRows = await client.query<{
      id: number;
      created_at: Date;
      user_id: string;
      event_date: Date;
      questionnaire_data: string;
      couple_name: string;
      venue: string;
    }>(`SELECT * FROM ${TEMP_TABLE} ORDER BY id`);

    console.log(`\nTransforming ${tempRows.rows.length} rows...`);

    let inserted = 0;
    let skipped = 0;

    for (const row of tempRows.rows) {
      let q: Record<string, unknown> = {};
      try {
        // Sanitize control characters before JSON.parse
        const sanitized = (row.questionnaire_data || "{}").replace(
          /[\x00-\x1f\x7f]/g,
          ""
        );
        q = JSON.parse(sanitized);
      } catch {
        console.warn(`  WARN row ${row.id}: invalid JSON, using empty object`);
      }

      // Map venue name to venueId
      const venueName = (row.venue || "").toLowerCase().trim();
      let venueId = venueMap.get(venueName);
      if (!venueId) {
        // Try partial match
        for (const [name, id] of venueMap.entries()) {
          if (name.includes(venueName) || venueName.includes(name)) {
            venueId = id;
            break;
          }
        }
      }
      if (!venueId) {
        console.warn(`  SKIP row ${row.id}: no venue match for "${row.venue}"`);
        skipped++;
        continue;
      }

      // Extract ratings from questionnaire_data
      const emRating = getNestedRating(q, "event_manager");
      const woRating = getNestedRating(q, "wedding_organizer");
      const bfRating = getNestedRating(q, "ballroom_facilities");
      const bcRating = getNestedRating(q, "ballroom_cleanliness");
      const pvRating = getNestedRating(q, "participating_vendors");
      const salesRating = typeof q.sales_rating === "number" ? q.sales_rating : null;

      // Extract names
      const eventManagerName = String(q.event_manager_name || q.manager_event || "");
      const woName = String(q.wedding_organizer_name || "");

      // Extract notes
      const emNotes = getNestedNotes(q, "event_manager");
      const woNotes = getNestedNotes(q, "wedding_organizer");
      const bfNotes = getNestedNotes(q, "ballroom_facilities");
      const bcNotes = getNestedNotes(q, "ballroom_cleanliness");
      const pvNotes = getNestedNotes(q, "participating_vendors");

      // Project managers
      const projectManagers = Array.isArray(q.project_managers)
        ? (q.project_managers as Array<{ name?: string; rating?: number; notes?: string }>).map(
            (pm) => ({
              name: pm.name || "",
              rating: typeof pm.rating === "number" ? pm.rating : null,
              notes: pm.notes || "",
            })
          )
        : [];

      // Post wedding wishes
      const pww = (q.post_wedding_wishes || {}) as Record<string, unknown>;
      const postWeddingWishes = {
        logamMulia: Boolean(pww.logam_mulia),
        mobil: Boolean(pww.mobil),
        rumah: Boolean(pww.rumah),
        honeymoon: Boolean(pww.honeymoon),
        romanticDinner: Boolean(pww.romantic_dinner),
        umroh: Boolean(pww.umroh),
        custom1: String(pww.lainnya_1 || ""),
        custom2: String(pww.lainnya_2 || ""),
      };

      // Scores
      const satisfactionScore =
        typeof q.satisfaction_score === "number" ? q.satisfaction_score : null;
      const allowancePercentage =
        typeof q.allowance_percentage === "number"
          ? q.allowance_percentage
          : null;
      const allowanceNominal =
        typeof q.allowance_nominal === "number" ? q.allowance_nominal : null;
      const recommendationScore =
        typeof q.recommendation_score === "number"
          ? q.recommendation_score
          : 5;

      // Build questionnaireData JSON (includes signatures for preservation)
      const questionnaireData = {
        eventManagerNotes: emNotes,
        woNotes,
        ballroomFacilitiesNotes: bfNotes,
        ballroomCleanlinessNotes: bcNotes,
        vendorsNotes: pvNotes,
        salesNotes: "",
        projectManagers,
        postWeddingWishes,
        notes: String(q.notes || ""),
        signatures: q.signatures || null,
        signatureNames: q.signature_names || null,
        signatureDate: q.signature_date || null,
        legacyId: row.id,
      };

      // Generate cuid-like id
      const id = generateCuid();

      await client.query(
        `INSERT INTO wedding_indicators (
          id, "coupleName", "eventDate", "venueId", "createdById",
          "eventManagerName", "eventManagerRating", "woName", "woRating",
          "ballroomFacilitiesRating", "ballroomCleanlinessRating",
          "vendorsRating", "salesRating", "recommendationScore",
          "satisfactionScore", "allowancePercentage", "allowanceNominal",
          "questionnaireData", "createdAt", "updatedAt"
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9,
          $10, $11,
          $12, $13, $14,
          $15, $16, $17,
          $18, $19, $20
        )`,
        [
          id,
          row.couple_name || "",
          row.event_date,
          venueId,
          defaultCreatedById,
          eventManagerName,
          emRating,
          woName || null,
          woRating,
          bfRating,
          bcRating,
          pvRating,
          salesRating,
          recommendationScore,
          satisfactionScore,
          allowancePercentage,
          allowanceNominal,
          JSON.stringify(questionnaireData),
          row.created_at || new Date(),
          row.created_at || new Date(),
        ]
      );
      inserted++;
    }

    console.log(`\nDone: ${inserted} inserted, ${skipped} skipped`);

    // 7. Cleanup
    await client.query(`DROP TABLE IF EXISTS ${TEMP_TABLE}`);
    console.log("Temp table dropped");
  } finally {
    await client.end();
  }
}

function getNestedRating(
  q: Record<string, unknown>,
  key: string
): number | null {
  const obj = q[key];
  if (obj && typeof obj === "object" && "rating" in obj) {
    const r = (obj as Record<string, unknown>).rating;
    return typeof r === "number" ? r : null;
  }
  return null;
}

function getNestedNotes(q: Record<string, unknown>, key: string): string {
  const obj = q[key];
  if (obj && typeof obj === "object" && "notes" in obj) {
    return String((obj as Record<string, unknown>).notes || "");
  }
  return "";
}

function generateCuid(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  const counter = (globalCounter++).toString(36).padStart(4, "0");
  return `c${timestamp}${counter}${random}`;
}

let globalCounter = 0;

main().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
