"use client";

import { useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useInviteUser, useUpdateUser } from "@/hooks/use-users";
import { inviteUserSchema, updateUserSchema } from "@/lib/validations/user";
import type { UserQueryItem } from "@/lib/queries/users";
import type { RolesQueryResult } from "@/lib/queries/roles";
import type { VenuesQueryResult } from "@/lib/queries/venues";
import type { z } from "zod";

type InviteFormValues = z.infer<typeof inviteUserSchema>;
type UpdateFormValues = z.infer<typeof updateUserSchema>;

interface InviteDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: RolesQueryResult;
  venues: VenuesQueryResult;
  editUser?: UserQueryItem | null;
}

export function InviteDrawer({
  open,
  onOpenChange,
  roles,
  venues,
  editUser,
}: InviteDrawerProps) {
  const isEdit = !!editUser;
  const inviteUser = useInviteUser();
  const updateUser = useUpdateUser();

  const inviteForm = useForm<InviteFormValues>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: { email: "", fullName: "", roleId: "", venueIds: [] },
  });

  const editForm = useForm<UpdateFormValues>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: { userId: "", fullName: "", roleId: "", venueIds: [] },
  });

  const form = isEdit ? editForm : inviteForm;
  const isPending = isEdit ? updateUser.isPending : inviteUser.isPending;

  // Populate edit form when editUser changes
  useEffect(() => {
    if (editUser) {
      const venueIds =
        editUser.profile?.userVenueAccess?.map((v) => v.venue.id) ?? [];
      editForm.reset({
        userId: editUser.profile?.id ?? "",
        fullName: editUser.profile?.fullName ?? "",
        roleId: editUser.profile?.role?.id ?? "",
        venueIds,
      });
    } else {
      inviteForm.reset({ email: "", fullName: "", roleId: "", venueIds: [] });
    }
  }, [editUser, open]); // eslint-disable-line react-hooks/exhaustive-deps

  async function onSubmit(values: InviteFormValues | UpdateFormValues) {
    const formData = new FormData();
    formData.set("venueIds", JSON.stringify(values.venueIds ?? []));

    if (isEdit) {
      const v = values as UpdateFormValues;
      formData.set("userId", editUser!.profile!.id);
      if (v.fullName) formData.set("fullName", v.fullName);
      if (v.roleId) formData.set("roleId", v.roleId);

      const result = await updateUser.mutateAsync(formData);
      if (result.success) {
        toast.success(result.message);
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    } else {
      const v = values as InviteFormValues;
      formData.set("email", v.email);
      formData.set("fullName", v.fullName);
      formData.set("roleId", v.roleId);

      const result = await inviteUser.mutateAsync(formData);
      if (result.success) {
        toast.success(result.message);
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Edit Pengguna" : "Undang Pengguna"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Perbarui informasi pengguna."
              : "Kirim undangan ke pengguna baru."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit as (v: InviteFormValues | UpdateFormValues) => void)}
            className="mt-6 space-y-4 px-1"
          >
            {/* Email — only for invite */}
            {!isEdit && (
              <FormField
                control={inviteForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="email@contoh.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Full Name */}
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Lengkap</FormLabel>
                  <FormControl>
                    <Input placeholder="Nama lengkap" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Role */}
            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Pilih role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Venues */}
            <FormField
              control={form.control}
              name="venueIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Akses Venue</FormLabel>
                  <ScrollArea className="h-40 rounded-md border p-3">
                    <div className="space-y-2">
                      {venues.map((venue) => {
                        const checked = (field.value as string[] | undefined)?.includes(venue.id) ?? false;
                        return (
                          <div key={venue.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`venue-${venue.id}`}
                              checked={checked}
                              onCheckedChange={(val) => {
                                const current = (field.value as string[]) ?? [];
                                if (val) {
                                  field.onChange([...current, venue.id]);
                                } else {
                                  field.onChange(current.filter((id) => id !== venue.id));
                                }
                              }}
                            />
                            <label
                              htmlFor={`venue-${venue.id}`}
                              className="cursor-pointer text-sm"
                            >
                              {venue.name}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Menyimpan..." : isEdit ? "Simpan" : "Kirim Undangan"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
