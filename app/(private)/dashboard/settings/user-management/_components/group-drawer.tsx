"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { X, UserPlus } from "lucide-react";
import { createGroupSchema, updateGroupSchema } from "@/lib/validations/user";
import { createGroup, updateGroup, addGroupMember, removeGroupMember } from "@/actions/group";
import type { GroupQueryItem } from "@/lib/queries/groups";
import type { UsersQueryResult } from "@/lib/queries/users";
import type { z } from "zod";
import { cn } from "../../../../../../lib/utils";

type CreateFormValues = z.infer<typeof createGroupSchema>;
type UpdateFormValues = z.infer<typeof updateGroupSchema>;

interface GroupDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editGroup?: GroupQueryItem | null;
  users: UsersQueryResult;
  onSaved: (group: GroupQueryItem, isEdit: boolean) => void;
}

function getInitials(name: string | null | undefined, fallback: string) {
  if (name) return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  return fallback[0]?.toUpperCase() ?? "?";
}

export function GroupDrawer({ open, onOpenChange, editGroup, users, onSaved }: GroupDrawerProps) {
  const isEdit = !!editGroup;
  const [isPending, setIsPending] = useState(false);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null);

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createGroupSchema),
    defaultValues: { name: "", description: "", leaderId: "" },
  });

  const prevOpenRef = useRef(false);

  useEffect(() => {
    const justOpened = open && !prevOpenRef.current;
    prevOpenRef.current = open;
    if (!justOpened) return;

    queueMicrotask(() => {
      if (editGroup) {
        form.reset({
          name: editGroup.name,
          description: editGroup.description ?? "",
          leaderId: editGroup.leaderId ?? "",
        });
        setMemberIds(editGroup.members.map((m) => m.userId));
      } else {
        form.reset({ name: "", description: "", leaderId: "" });
        setMemberIds([]);
      }
    });
  }, [open, editGroup]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(values: CreateFormValues | UpdateFormValues) {
    setIsPending(true);
    const payload = {
      ...values,
      leaderId: (values.leaderId as string) || undefined,
    };

    const result = isEdit ? await updateGroup(payload) : await createGroup(payload);
    setIsPending(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success(isEdit ? "Grup berhasil diperbarui." : "Grup berhasil dibuat.");
    onSaved(result.group as unknown as GroupQueryItem, isEdit);
    onOpenChange(false);
  }

  async function handleAddMember(userId: string) {
    if (!editGroup || memberIds.includes(userId)) return;
    setAddingMemberId(userId);
    const result = await addGroupMember(editGroup.id, userId);
    setAddingMemberId(null);
    if (result.success) {
      setMemberIds((prev) => [...prev, userId]);
      toast.success("Anggota ditambahkan.");
    } else {
      toast.error(result.error);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!editGroup) return;
    const result = await removeGroupMember(editGroup.id, userId);
    if (result.success) {
      setMemberIds((prev) => prev.filter((id) => id !== userId));
      toast.success("Anggota dihapus dari grup.");
    } else {
      toast.error(result.error);
    }
  }

  const memberProfiles = users.users
    .filter((u) => u.profile && memberIds.includes(u.profile.id))
    .map((u) => u.profile!);

  const availableUsers = users.users.filter(
    (u) => u.profile && !memberIds.includes(u.profile.id)
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className={cn('w-full', 'sm:max-w-md', 'flex', 'flex-col')}>
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Grup" : "Buat Grup"}</SheetTitle>
          <SheetDescription>
            {isEdit ? "Perbarui informasi dan anggota grup." : "Buat grup baru untuk mengatur akses data."}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className={cn('flex-1', 'pr-1')}>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit as (v: CreateFormValues | UpdateFormValues) => void)}
              className={cn('mt-4', 'space-y-4', 'px-1')}
            >
              {/* Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nama Grup</FormLabel>
                    <FormControl>
                      <Input placeholder="Contoh: Tim Sales Jakarta" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Deskripsi</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Deskripsi singkat grup (opsional)"
                        rows={2}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Leader */}
              <FormField
                control={form.control}
                name="leaderId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Leader</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={(field.value as string) ?? ""}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih leader (opsional)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.users
                          .filter((u) => u.profile)
                          .map((u) => (
                            <SelectItem key={u.profile!.id} value={u.profile!.id}>
                              {u.profile!.fullName ?? u.email}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className={cn('flex', 'justify-end', 'gap-2', 'pt-2')}>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Menyimpan..." : isEdit ? "Simpan" : "Buat Grup"}
                </Button>
              </div>
            </form>
          </Form>

          {/* Members section — only shown when editing */}
          {isEdit && (
            <>
              <Separator className="my-5" />
              <div className={cn('space-y-3', 'px-1')}>
                <p className={cn('text-sm', 'font-medium')}>Anggota Grup</p>

                {/* Current members */}
                {memberProfiles.length === 0 ? (
                  <p className={cn('text-muted-foreground', 'text-sm')}>Belum ada anggota.</p>
                ) : (
                  <div className="space-y-2">
                    {memberProfiles.map((profile) => (
                      <div key={profile.id} className={cn('flex', 'items-center', 'justify-between', 'rounded-md', 'border', 'px-3', 'py-2')}>
                        <div className={cn('flex', 'items-center', 'gap-2')}>
                          <Avatar className={cn('h-7', 'w-7')}>
                            <AvatarImage src={profile.avatarUrl ?? undefined} />
                            <AvatarFallback className="text-xs">
                              {getInitials(profile.fullName, profile.fullName ?? "")}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className={cn('text-sm', 'font-medium', 'leading-none')}>
                              {profile.fullName ?? profile.fullName ?? ""}
                            </p>
                            {profile.role && (
                              <Badge variant="outline" className={cn('mt-1', 'text-xs')}>
                                {profile.role.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn('h-7', 'w-7', 'text-destructive', 'hover:text-destructive')}
                          onClick={() => handleRemoveMember(profile.id)}
                        >
                          <X className={cn('h-3.5', 'w-3.5')} />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add member */}
                {availableUsers.length > 0 && (
                  <div className="space-y-2">
                    <p className={cn('text-muted-foreground', 'text-xs')}>Tambah anggota:</p>
                    <div className="space-y-1">
                      {availableUsers.map((u) => (
                        <div
                          key={u.profile!.id}
                          className={cn('flex', 'items-center', 'justify-between', 'rounded-md', 'px-3', 'py-1.5', 'hover:bg-muted')}
                        >
                          <div className={cn('flex', 'items-center', 'gap-2')}>
                            <Avatar className={cn('h-6', 'w-6')}>
                              <AvatarImage src={u.profile!.avatarUrl ?? undefined} />
                              <AvatarFallback className="text-xs">
                                {getInitials(u.profile!.fullName, u.email)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{u.profile!.fullName ?? u.email}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={cn('h-7', 'w-7')}
                            disabled={addingMemberId === u.profile!.id}
                            onClick={() => handleAddMember(u.profile!.id)}
                          >
                            <UserPlus className={cn('h-3.5', 'w-3.5')} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
