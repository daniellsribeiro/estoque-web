import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const AUTH_COOKIE_NAME = "estoque_auth";

export default async function Home() {
  const cookieStore = await cookies();
  const hasSession = Boolean(cookieStore.get(AUTH_COOKIE_NAME));
  redirect(hasSession ? "/painel" : "/login");
}
