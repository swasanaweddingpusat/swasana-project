import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { Users } from "lucide-react";
import type { GroupCard } from "@/lib/queries/my-team";

interface Props {
  groups: GroupCard[];
}

export function TeamGrid({ groups }: Props) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4 text-center px-4">
        <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-secondary">
          <Users className="h-8 w-8 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Belum ada tim</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Tidak ada tim yang tersedia untuk ditampilkan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 pb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map((group) => (
          <Link key={group.id} href={`/dashboard/my-team/${group.id}`}>
            <Card className="shadow-none hover:bg-secondary/50 transition-colors cursor-pointer h-full">
              <CardContent className="p-5">
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{group.name}</p>
                    {group.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{group.description}</p>
                    )}
                  </div>

                  {group.leader && (
                    <div className="flex items-center gap-2">
                      <ProfileAvatar
                        name={group.leader.fullName ?? "—"}
                        src={group.leader.avatarUrl ?? undefined}
                        size="sm"
                      />
                      <div>
                        <p className="text-xs text-muted-foreground">Leader</p>
                        <p className="text-xs font-medium text-foreground">{group.leader.fullName ?? "—"}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    <span>{group._count.members} anggota</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
