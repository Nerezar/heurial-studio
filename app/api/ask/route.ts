import { getText, handleError, makeQuota, readObject, reply } from "@/lib/http";
import { retrieve, selectPassages } from "@/lib/retrieval";

const checkQuota = makeQuota(40);

export async function POST(request: Request) {
  try {
    checkQuota();
    const body = await readObject(request, 4096);
    const question = getText(body, "question", "Question", 3, 400);
    const matches = retrieve(question);
    if (!matches.length) return reply({ passages: [], mode: "no-match" });
    const result = await selectPassages(question, matches);
    return reply({
      mode: result.mode,
      passages: result.passages.map(({ id, title, text }) => ({ title, text, href: `/resources#${id}` })),
    });
  } catch (error) {
    return handleError(error);
  }
}
