import JoinLoop from "@/components/join-loop";
export const metadata = { robots: { index: false, follow: false } };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <JoinLoop id={id} restore />;
}
