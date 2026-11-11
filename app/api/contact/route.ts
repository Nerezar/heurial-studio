import { randomUUID } from "node:crypto";
import { cleanAttribution, HEARD_OPTIONS, resolveSource } from "@/lib/attribution";
import { saveInquiry } from "@/lib/contact";
import { getText, handleError, makeQuota, readObject, reply, RequestError } from "@/lib/http";

export const runtime = "nodejs";
const checkQuota = makeQuota(15);

export async function POST(request: Request) {
  try {
    checkQuota();
    const body = await readObject(request, 8192);
    const name = getText(body, "name", "Name", 2, 100);
    const email = getText(body, "email", "Email", 3, 254);
    const company = getText(body, "company", "Company", 0, 120);
    const message = getText(body, "message", "Message", 10, 1200, true);
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || body.website) {
      throw new RequestError(400, "Check your email address and form fields.");
    }
    const heard = typeof body.heard === "string" && body.heard in HEARD_OPTIONS ? body.heard : undefined;
    const attribution = cleanAttribution(body.attribution);
    const { source, sourceDetail } = resolveSource(attribution, heard);
    const id = randomUUID();
    await saveInquiry({
      id, createdAt: new Date().toISOString(), name, email, company, message,
      source, sourceDetail, heard: heard ?? "", attribution, status: "new",
    });
    return reply({ id }, 201);
  } catch (error) {
    return handleError(error);
  }
}
