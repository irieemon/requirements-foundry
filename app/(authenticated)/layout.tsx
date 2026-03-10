import { AppShell } from "@/components/layout/app-shell";

export default function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <AppShell>
      <main id="main-content" role="main" className="min-h-screen">
        {children}
      </main>
    </AppShell>
  );
}
