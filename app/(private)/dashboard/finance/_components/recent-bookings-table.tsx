"use client";

import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { FinanceBooking } from "@/types/finance";

interface RecentBookingsTableProps {
  bookings: FinanceBooking[];
  loading: boolean;
}

const columns = ["No", "Name", "Phone Number", "Booking Date", "Status Booking", "Payment Status", "Payment Method"];

function formatDate(dateStr: string): string {
  try {
    return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric" }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function BookingStatusBadge({ status }: { status: FinanceBooking["bookingStatus"] }) {
  const variant = status === "Confirmed" ? "default" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

export function RecentBookingsTable({ bookings, loading }: RecentBookingsTableProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-[#1D1D1D]">Recently Bookings</h3>
        <Link href="/dashboard/bookings" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          See all bookings
        </Link>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary hover:bg-secondary">
              {columns.map((col) => (
                <TableHead key={col} className="text-xs font-medium px-3 py-3">{col}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i} className="h-18">
                  {columns.map((_, j) => (
                    <TableCell key={j} className="px-3 py-2"><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : bookings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-18 text-center text-sm text-muted-foreground">
                  No bookings found
                </TableCell>
              </TableRow>
            ) : (
              bookings.map((booking, idx) => (
                <TableRow key={booking.id} className="h-18">
                  <TableCell className="px-3 py-2 text-sm">{idx + 1}</TableCell>
                  <TableCell className="px-3 py-2 text-sm font-medium">{booking.customerName}</TableCell>
                  <TableCell className="px-3 py-2 text-sm">{booking.customerPhone}</TableCell>
                  <TableCell className="px-3 py-2 text-sm">{formatDate(booking.bookingDate)}</TableCell>
                  <TableCell className="px-3 py-2"><BookingStatusBadge status={booking.bookingStatus} /></TableCell>
                  <TableCell className="px-3 py-2 text-sm">{booking.paymentStatus}</TableCell>
                  <TableCell className="px-3 py-2">
                    {booking.paymentMethod !== "-"
                      ? <Badge variant="outline">{booking.paymentMethod}</Badge>
                      : <span className="text-sm text-muted-foreground">-</span>
                    }
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
