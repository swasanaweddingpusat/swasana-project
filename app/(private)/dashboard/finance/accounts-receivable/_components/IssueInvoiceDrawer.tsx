"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Drawer } from "@/components/shared/drawer";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useIssueInvoice } from "@/hooks/use-invoices";
import { fmtRp } from "./ar-format";

export interface IssueInvoiceDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  termId: string;
  termName: string;
  termAmount: number;
  termDueDate?: string | null;
  bookingId: string;
}

const INVOICE_TYPE_LABELS: Record<string, string> = {
  dp: "DP (Uang Muka)",
  progress: "Progress",
  pelunasan: "Pelunasan",
  lainnya: "Lainnya",
};

// Local form schema — dueDate as string to avoid zodResolver/z.coerce.date type friction.
const formSchema = z.object({
  invoiceType: z.enum(["dp", "progress", "pelunasan", "lainnya"]),
  dueDateStr: z.string().optional(),
  notes: z.string().max(500, "Catatan maksimal 500 karakter").optional(),
});

type FormValues = z.infer<typeof formSchema>;

export function IssueInvoiceDrawer({
  open,
  onOpenChange,
  termId,
  termName,
  termAmount,
  termDueDate,
}: IssueInvoiceDrawerProps): React.ReactElement {
  const { mutate, isPending } = useIssueInvoice();

  const defaultDueDateStr = termDueDate
    ? new Date(termDueDate).toISOString().slice(0, 10)
    : "";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      invoiceType: undefined,
      dueDateStr: defaultDueDateStr,
      notes: "",
    },
  });

  // Sync when drawer target changes.
  useEffect(() => {
    form.reset({
      invoiceType: undefined,
      dueDateStr: termDueDate
        ? new Date(termDueDate).toISOString().slice(0, 10)
        : "",
      notes: "",
    });
  }, [termId, termDueDate, form]);

  function onSubmit(values: FormValues): void {
    mutate(
      {
        termId,
        invoiceType: values.invoiceType,
        dueDate: values.dueDateStr ? new Date(values.dueDateStr) : undefined,
        notes: values.notes ?? undefined,
      },
      {
        onSuccess: (data) => {
          toast.success(`Invoice ${data.invoiceNumber} berhasil diterbitkan`);
          onOpenChange(false);
        },
        onError: (err) => {
          toast.error((err as Error).message ?? "Gagal menerbitkan invoice");
        },
      },
    );
  }

  return (
    <Drawer
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Terbitkan Invoice"
      maxWidth="sm:max-w-lg"
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-5 px-1 pb-6"
        >
          {/* Summary readonly */}
          <div className="rounded-2xl border border-border bg-secondary/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
              Termin
            </p>
            <p className="text-sm font-medium text-foreground">{termName}</p>
            <p className="text-xl font-heading font-bold text-foreground mt-0.5">
              {fmtRp(termAmount)}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Jumlah beku — sama dengan nilai termin saat invoice diterbitkan
            </p>
          </div>

          {/* Jenis Invoice */}
          <FormField
            control={form.control}
            name="invoiceType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Jenis Invoice</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  value={field.value ?? ""}
                >
                  <FormControl>
                    <SelectTrigger className="rounded-xl">
                      <SelectValue placeholder="Pilih jenis invoice" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(INVOICE_TYPE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Tanggal Jatuh Tempo */}
          <FormField
            control={form.control}
            name="dueDateStr"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tanggal Jatuh Tempo</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    className="rounded-xl"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Catatan */}
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Catatan (opsional)</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    value={field.value ?? ""}
                    placeholder="Catatan tambahan untuk invoice ini..."
                    maxLength={500}
                    rows={3}
                    className="rounded-xl resize-none"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={isPending}
            className="w-full rounded-full gap-2"
          >
            {isPending ? "Menerbitkan..." : "Terbitkan Invoice"}
          </Button>
        </form>
      </Form>
    </Drawer>
  );
}
