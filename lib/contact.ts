import { constants } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { RequestError } from "./http";

export function contactFile() {
  const configured = process.env.CONTACT_FILE?.trim();
  if (configured && isAbsolute(configured)) return configured;
  if (!configured && process.env.NODE_ENV === "development") {
    return join(process.cwd(), ".heurial-data", "inquiries.jsonl");
  }
  return undefined;
}

export async function saveInquiry(inquiry: { id: string; createdAt: string; name: string; email: string; company: string; message: string }) {
  const path = contactFile();
  if (!path) throw new RequestError(503, "This site’s inquiry inbox is unavailable.");
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const file = await open(path, constants.O_APPEND | constants.O_CREAT | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  try {
    const line = Buffer.from(JSON.stringify(inquiry) + "\n");
    const { bytesWritten } = await file.write(line);
    if (bytesWritten !== line.length) throw new Error("Incomplete inquiry write");
    await file.sync();
  } finally {
    await file.close();
  }
}
