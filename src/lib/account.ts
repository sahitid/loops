import { cookies } from "next/headers";
import { changeDocument, readDocument } from "./documents";
import { seal, unseal } from "./security";
export type Account = {
  id: string;
  email: string;
  verified: boolean;
  groups: string[];
  challenge?: {
    hash: string;
    expires: number;
    failures: number;
    requestId: string;
  };
  sentAt?: number;
  window?: number;
  sends?: number;
};
export async function currentAccount() {
  const token = (await cookies()).get("loops_account")?.value || "";
  const session = unseal<{ id: string }>(token, "session");
  if (!session) return null;
  const account = await readDocument<Account>(session.id);
  return account?.value.verified ? account.value : null;
}
export async function rememberAccount(id: string) {
  (await cookies()).set(
    "loops_account",
    seal({ purpose: "session", id, exp: Date.now() + 30 * 86400000 }),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 86400,
    },
  );
}
export async function addGroup(account: Account, group: string) {
  await changeDocument<Account, void>(
    account.id,
    () => account,
    (value) => {
      if (!value.groups.includes(group)) value.groups.push(group);
    },
  );
}
