#!/usr/bin/env node
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env if present
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

import axios from "axios";

const api = axios.create({
  baseURL: "https://api.attio.com/v2",
  headers: {
    Authorization: `Bearer ${process.env.ATTIO_API_KEY}`,
    "Content-Type": "application/json",
  },
});

try {
  const { data } = await api.post("/objects/companies/records/query", { limit: 1 });
  const count = data.data?.length ?? 0;
  console.log("✓ Connected to Attio. API key is valid.");
  console.log(`  (Sample query returned ${count} company/companies.)`);
} catch (err) {
  const status = err.response?.status;
  const body = err.response?.data;
  if (status === 401) {
    console.error("✗ Connection failed: Invalid or missing API key (401).");
  } else if (status) {
    console.error("✗ Connection failed:", status, body ?? err.message);
  } else {
    console.error("✗ Connection failed:", err.message);
  }
  process.exit(1);
}
