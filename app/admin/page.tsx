import { redirect } from "next/navigation";

// Slate does not apply the static-file rewrite used by the local server.
export default function AdminPage() {
  // The version makes browsers load the current tracker instead of a year-old cached copy.
  redirect(`/admin/index.html?v=${process.env.TRACKER_VERSION}`);
}
