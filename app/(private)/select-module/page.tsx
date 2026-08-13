import Link from "next/link";
import { redirect } from "next/navigation";
import { Wallet, UsersGroupRounded, TicketSale, CartLarge, Widget } from "@solar-icons/react";
import { auth } from "@/lib/auth";
import { getAccessibleModules } from "@/lib/queries/modules";

export const metadata = { title: "Pilih Module" };

const ICONS: Record<string, typeof Widget> = { Wallet, UsersGroupRounded, TicketSale, CartLarge };

export default async function SelectModulePage(): Promise<React.JSX.Element> {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const modules = await getAccessibleModules(session.user.roleId);
  if (modules.length === 1) redirect(`/${modules[0].key}/overview`);
  if (modules.length === 0) redirect("/");

  return (
    <div className="mx-auto max-w-2xl py-10">
      <h1 className="text-center font-heading text-2xl text-foreground">Pilih Module</h1>
      <p className="mt-1 text-center text-muted-foreground">
        Pilih area kerja yang ingin Anda buka.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {modules.map((m) => {
          const Icon = ICONS[m.icon ?? ""] ?? Widget;
          return (
            <Link
              key={m.key}
              href={`/${m.key}/overview`}
              className="flex items-center gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <Icon weight="BoldDuotone" className="size-8" />
              <span className="font-medium">{m.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
