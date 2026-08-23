import { sites } from "@openai/sites-vite-plugin";
import fs from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import vinext from "vinext";
import { defineConfig, type Plugin } from "vite";
import hostingConfig from "./.openai/hosting.json";

const { r2 } = hostingConfig;
const wishesCsvPath = path.resolve(process.cwd(), "data", "wishes.csv");
const wishesCsvHeader = "id,name,message,created_at\n";
let csvOperationQueue = Promise.resolve();

type Wish = { id: number; name: string; message: string; createdAt: string };

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

async function ensureWishesCsv() {
  await fs.mkdir(path.dirname(wishesCsvPath), { recursive: true });
  try {
    await fs.access(wishesCsvPath);
  } catch {
    await fs.writeFile(wishesCsvPath, wishesCsvHeader, "utf8");
  }
}

async function readWishesCsv(): Promise<Wish[]> {
  await ensureWishesCsv();
  const content = await fs.readFile(wishesCsvPath, "utf8");
  return content
    .split(/\r?\n/)
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const [id, name, message, createdAt] = parseCsvLine(line);
      return { id: Number(id), name, message, createdAt };
    });
}

function runCsvOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = csvOperationQueue.then(operation, operation);
  csvOperationQueue = result.then(() => undefined, () => undefined);
  return result;
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

async function readRequestJson(request: IncomingMessage) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 10_000) throw new Error("Request is too large");
  }
  return JSON.parse(body || "{}");
}

function localCsvWishes(): Plugin {
  return {
    name: "local-csv-wishes",
    configureServer(server) {
      server.middlewares.use("/api/wishes", async (request, response) => {
        try {
          if (request.method === "GET") {
            const wishes = await runCsvOperation(readWishesCsv);
            sendJson(response, 200, { wishes: wishes.slice(-50).reverse() });
            return;
          }
          if (request.method === "POST") {
            const payload = (await readRequestJson(request)) as { name?: string; message?: string };
            const name = payload.name?.trim().replace(/\s+/g, " ") ?? "";
            const message = payload.message?.trim().replace(/\s+/g, " ") ?? "";
            if (!name || !message) {
              sendJson(response, 400, { error: "Name and message are required" });
              return;
            }
            if (name.length > 60 || message.length > 500) {
              sendJson(response, 400, { error: "Wish is too long" });
              return;
            }
            const wish = await runCsvOperation(async () => {
              const wishes = await readWishesCsv();
              const row: Wish = {
                id: (wishes.at(-1)?.id ?? 0) + 1,
                name,
                message,
                createdAt: new Date().toISOString(),
              };
              const csvRow = [row.id, row.name, row.message, row.createdAt].map(csvField).join(",") + "\n";
              await fs.appendFile(wishesCsvPath, csvRow, "utf8");
              return row;
            });
            sendJson(response, 201, { wish });
            return;
          }
          response.setHeader("allow", "GET, POST");
          sendJson(response, 405, { error: "Method not allowed" });
        } catch (error) {
          sendJson(response, 500, { error: error instanceof Error ? error.message : "Unexpected error" });
        }
      });
    },
  };
}

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      allowedHosts: [".trycloudflare.com"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      localCsvWishes(),
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
