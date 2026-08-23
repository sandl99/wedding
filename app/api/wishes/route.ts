import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const wishesCsvHeader = "id,name,message,created_at\n";
let csvOperationQueue = Promise.resolve();

type Wish = {
  id: number;
  name: string;
  message: string;
  createdAt: string;
};

function getWishesCsvPath() {
  const configuredPath = process.env.WISHES_CSV_PATH?.trim();
  return configuredPath
    ? path.resolve(configuredPath)
    : path.resolve(process.cwd(), "data", "wishes.csv");
}

function csvField(value: string | number) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function parseCsvLine(line: string) {
  const fields: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }

  fields.push(field);
  return fields;
}

async function ensureWishesCsv(csvPath: string) {
  await fs.mkdir(path.dirname(csvPath), { recursive: true });
  try {
    await fs.writeFile(csvPath, wishesCsvHeader, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
  }
}

async function readWishesCsv(csvPath: string): Promise<Wish[]> {
  await ensureWishesCsv(csvPath);
  const content = await fs.readFile(csvPath, "utf8");

  return content
    .split(/\r?\n/)
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const [id, name, message, createdAt] = parseCsvLine(line);
      return { id: Number(id), name, message, createdAt };
    })
    .filter((wish) => Number.isFinite(wish.id));
}

function runCsvOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = csvOperationQueue.then(operation, operation);
  csvOperationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function json(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function normalizeField(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

export async function GET() {
  try {
    const wishes = await runCsvOperation(() => readWishesCsv(getWishesCsvPath()));
    return json({ wishes: wishes.slice(-50).reverse() });
  } catch (error) {
    console.error("Unable to read wishes CSV", error);
    return json({ error: "Unable to load wishes" }, 500);
  }
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    const body = await request.text();
    if (body.length > 10_000) return json({ error: "Request is too large" }, 413);
    payload = JSON.parse(body || "{}");
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const name = normalizeField(record.name);
  const message = normalizeField(record.message);

  if (!name || !message) return json({ error: "Name and message are required" }, 400);
  if (name.length > 60 || message.length > 500) return json({ error: "Wish is too long" }, 400);

  try {
    const wish = await runCsvOperation(async () => {
      const csvPath = getWishesCsvPath();
      const wishes = await readWishesCsv(csvPath);
      const row: Wish = {
        id: wishes.reduce((highest, existing) => Math.max(highest, existing.id), 0) + 1,
        name,
        message,
        createdAt: new Date().toISOString(),
      };
      const csvRow = [row.id, row.name, row.message, row.createdAt].map(csvField).join(",") + "\n";
      await fs.appendFile(csvPath, csvRow, "utf8");
      return row;
    });

    return json({ wish }, 201);
  } catch (error) {
    console.error("Unable to write wishes CSV", error);
    return json({ error: "Unable to save wish" }, 500);
  }
}
