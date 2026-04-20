"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { PencilIcon, Trash2, Plus, CalendarDays, ArrowLeft, ArrowRight, Search, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBookings, useDeleteBooking } from "@/hooks/use-bookings";
import { BookingDrawer } from "./booking-drawer";
import type { BookingsResult, BookingListItem } from "@/lib/queries/bookings";

const ROWS_PER_PAGE = 10;

const STATUS_COLORS: Record<string, string> = {
  Pending: "bg-yellow-100 text-yellow-800",
  Uploaded: "bg-blue-100 text-blue-800",
  Confirmed: "bg-green-100 text-green-800",
  Rejected: "bg-red-100 text-red-800",
  Canceled: "bg-gray-100 text-gray-700",
  Lost: "bg-purple-100 text-purple-800",
};

function formatPrice(price: unknown) {
  return `Rp ${new Intl.NumberFormat("id-ID").format(Number(price))}`;
}

export function BookingsTable({ initialData }: { initialData: BookingsResult }) {
  const router = useRouter();
  const { data: bookings = initialData } = useBookings(initialData);
  const deleteMut = useDeleteBooking();

  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BookingListItem | null>(null);

  const filtered = bookings.filter((b: BookingListItem) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (b.snapCustomer?.name ?? "").toLowerCase().includes(q) ||
      (b.snapVenue?.venueName ?? "").toLowerCase().includes(q) ||
      (b.snapPackage?.packageName ?? "").toLowerCase().includes(q) ||
      (b.sales?.fullName ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
  const paginated = filtered.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);

  async function handleDelete() {
    if (!deleteTarget) return;
    const result = await deleteMut.mutateAsync(deleteTarget.id);
    if (!result.success) toast.error(result.error);
    else toast.success("Booking dihapus.");
    setDeleteTarget(null);
  }

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold">List Bookings</h2>
              <span className="text-xs font-medium bg-gray-50 text-gray-600 px-3 py-1 border border-gray-200 rounded-full">
                {filtered.length} {search ? `dari ${bookings.length}` : "booking"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cari booking..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                  className="pl-9 w-[220px]"
                />
              </div>
              <Button onClick={() => setDrawerOpen(true)} className="cursor-pointer bg-gray-900 hover:bg-gray-800 text-white">
                <Plus className="h-4 w-4 mr-2" /> Tambah Booking
              </Button>
            </div>
          </div>

          {/* Table */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <CalendarDays className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">{search ? `Tidak ada hasil untuk "${search}"` : "Belum ada booking."}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1100px] text-sm">
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="px-3 w-[50px]">No</TableHead>
                    <TableHead className="px-3">Customer</TableHead>
                    <TableHead className="px-3">Venue</TableHead>
                    <TableHead className="px-3">Package</TableHead>
                    <TableHead className="px-3">Variant</TableHead>
                    <TableHead className="px-3">Booking Date</TableHead>
                    <TableHead className="px-3">Status</TableHead>
                    <TableHead className="px-3">Sales</TableHead>
                    <TableHead className="px-3 w-[100px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((booking: BookingListItem, idx: number) => (
                    <TableRow key={booking.id} className="hover:bg-gray-50">
                      <TableCell className="px-3">{(currentPage - 1) * ROWS_PER_PAGE + idx + 1}</TableCell>
                      <TableCell className="px-3 font-medium">{booking.snapCustomer?.name ?? "—"}</TableCell>
                      <TableCell className="px-3">{booking.snapVenue?.venueName ?? "—"}{booking.snapVenue?.brandCode ? ` (${booking.snapVenue.brandCode})` : ""}</TableCell>
                      <TableCell className="px-3">{booking.snapPackage?.packageName ?? "—"}</TableCell>
                      <TableCell className="px-3">
                        {booking.snapPackageVariant ? `${booking.snapPackageVariant.variantName} · ${booking.snapPackageVariant.pax} pax · ${formatPrice(booking.snapPackageVariant.price)}` : "—"}
                      </TableCell>
                      <TableCell className="px-3 whitespace-nowrap">{format(new Date(booking.bookingDate), "dd MMM yyyy")}</TableCell>
                      <TableCell className="px-3">
                        <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[booking.bookingStatus] ?? "")}>
                          {booking.bookingStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 text-gray-500">{booking.sales?.fullName ?? "—"}</TableCell>
                      <TableCell className="px-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => router.push(`/dashboard/bookings/${booking.id}`)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDrawerOpen(true)}>
                            <PencilIcon className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(booking)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center px-6 py-4 border-t">
              <Button variant="outline" onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))} disabled={currentPage === 1}>
                <ArrowLeft className="w-4 h-4 mr-2" /> Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={cn("px-3 py-1 rounded-md text-sm font-medium cursor-pointer", currentPage === page ? "bg-gray-200 text-gray-900" : "text-gray-700 hover:bg-gray-100")}>
                    {page}
                  </button>
                ))}
              </div>
              <Button variant="outline" onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>
                Next <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <BookingDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Booking</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus booking <strong>{deleteTarget?.snapCustomer?.name ?? "ini"}</strong>? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
