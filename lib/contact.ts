import { constants } from "node:fs";
import { mkdir, open } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import type { Attribution } from "./attribution";
import { RequestError } from "./http";

export type Inquiry = {
  id: string;
  createdAt: string;
  name: string;
  email: string;
  company: string;
  message: string;
  source: string; // one label, e.g. "Instagram", "Referral", "Search"
  sourceDetail: string; // how the label was decided, so wrong guesses are easy to spot
  heard: string; // what they picked on the form, if anything
  attribution: Attribution; // raw tracking data from the visit
  status: "new";
};

/**
 * Where inquiries are kept. Today: one file (local development, or a server with a persistent disk).
 * Next: a Zoho Catalyst Data Store backend with the same two methods, so the live site can save leads
 * and the hosted tracker can read them.
 */
interface InquiryStore {
  save(inquiry: Inquiry): Promise<void>;
}

export function contactFile() {
  const configured = process.env.CONTACT_FILE?.trim();
  if (configured && isAbsolute(configured)) return configured;
  if (!configured && process.env.NODE_ENV === "development") {
    return join(process.cwd(), ".heurial-data", "inquiries.jsonl");
  }
  return undefined;
}

function fileStore(path: string): InquiryStore {
  return {
    async save(inquiry) {
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
    },
  };
}

/**
 * Sends the inquiry to the Catalyst "inquiries" function, which saves it in the Data Store.
 * The shared key stays on the server; browsers never see it.
 */
function catalystStore(url: string, key: string): InquiryStore {
  return {
    async save(inquiry) {
      const row = {
        inquiry_id: inquiry.id,
        created_at: inquiry.createdAt,
        name: inquiry.name,
        email: inquiry.email,
        company: inquiry.company,
        message: inquiry.message,
        source: inquiry.source,
        source_detail: inquiry.sourceDetail.slice(0, 200),
        heard: inquiry.heard,
        attribution: JSON.stringify(inquiry.attribution).slice(0, 1500),
        status: inquiry.status,
      };
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Heurial-Key": key },
          body: JSON.stringify(row),
          signal: AbortSignal.timeout(10_000),
          cache: "no-store",
        });
      } catch {
        throw new RequestError(503, "We couldn’t reach the inquiry inbox. Please try again, or email hello@heurial.studio.");
      }
      if (response.status !== 201) {
        console.error(`Inquiry inbox returned ${response.status}`);
        throw new RequestError(503, "We couldn’t save your inquiry. Please try again, or email hello@heurial.studio.");
      }
    },
  };
}

function inquiryStore(): InquiryStore | undefined {
  // The live site uses Catalyst when both settings exist; otherwise a local file (development).
  const url = process.env.INQUIRY_FUNCTION_URL?.trim();
  const key = process.env.INQUIRY_FUNCTION_KEY?.trim();
  if (url && key && url.startsWith("https://")) return catalystStore(url, key);
  if (url && key && process.env.NODE_ENV === "development" && url.startsWith("http://127.0.0.1")) return catalystStore(url, key);
  const path = contactFile();
  return path ? fileStore(path) : undefined;
}

/** True when the site can accept form submissions; otherwise the contact page shows the email fallback. */
export function inquiryInboxReady() {
  return Boolean(inquiryStore());
}

export async function saveInquiry(inquiry: Inquiry) {
  const store = inquiryStore();
  if (!store) throw new RequestError(503, "This site’s inquiry inbox is unavailable.");
  await store.save(inquiry);
}
