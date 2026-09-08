/**
 * Rebuild scripts/production-setup.sql from the migrations and the seed.
 *
 *   node scripts/make-production-setup.js
 *
 * That file is what gets pasted into a brand new Supabase project, so it has
 * to be every migration in order plus the reference catalogue. Keeping it by
 * hand meant remembering to append each new migration, and forgetting was
 * silent — the file still ran, it just built last month's schema.
 *
 * The prose at the top and bottom lives in production-setup-header.sql and
 * production-setup-footer.sql; everything between them is generated.
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const migrationsDir = path.join(root, "supabase", "migrations");

const banner = (source) =>
  [
    "-- =====================================================================",
    `-- SOURCE: ${source}`,
    "-- =====================================================================",
    "",
  ].join("\n");

const read = (p) => fs.readFileSync(p, "utf8").replace(/\s+$/, "");

const migrations = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  // Filenames are timestamp-prefixed, so lexical order is chronological order.
  .sort();

const parts = [read(path.join(root, "scripts", "production-setup-header.sql")), ""];

for (const file of migrations) {
  parts.push(
    "",
    banner(`supabase/migrations/${file}`),
    read(path.join(migrationsDir, file)),
    "",
  );
}

parts.push(
  "",
  banner("supabase/seed.sql"),
  read(path.join(root, "supabase", "seed.sql")),
  "",
  "",
  read(path.join(root, "scripts", "production-setup-footer.sql")),
  "",
);

fs.writeFileSync(
  path.join(root, "scripts", "production-setup.sql"),
  parts.join("\n"),
);

console.log(
  `production-setup.sql rebuilt from ${migrations.length} migrations + seed.`,
);
