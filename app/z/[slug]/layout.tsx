import { ZoneShell } from "@/components/zone-shell";

export default async function ZoneLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <ZoneShell slug={slug}>{children}</ZoneShell>;
}
