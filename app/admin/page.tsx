import { redirect } from "next/navigation";

// Slate does not apply the static-file rewrite used by the local server.
export default function AdminPage() {
  redirect("/admin/index.html");
}
