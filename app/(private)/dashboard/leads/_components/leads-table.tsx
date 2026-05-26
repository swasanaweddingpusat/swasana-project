"use client";

import { useState, useCallback } from "react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PencilIcon,
  Plus,
  ArrowLeft,
  ArrowRight,
  Search,
  Users,
  FileText,
  LayoutList,
  Columns3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LeadDrawer } from "./lead-drawer";

export interface LeadItem {
  id: string;
  name: string;
  phone: string;
  email: string;
  venue: string;
  category: "weddings" | "mice";
  eventType: string;
  eventDate: string;
  estimatedPax: number;
  packageName: string | null;
  status: { id: string; name: string; color: string };
  source: string;
  salesName: string;
  createdAt: string;
}

const DUMMY_LEADS: LeadItem[] = [
  {
    id: "1",
    name: "Ahmad Fauzi",
    phone: "081234567890",
    email: "ahmad@email.com",
    venue: "Bringhall",
    category: "weddings",
    eventType: "Akad & Resepsi",
    eventDate: "2026-08-15",
    estimatedPax: 500,
    packageName: "Gold",
    status: { id: "1", name: "Cold", color: "#3b82f6" },
    source: "Instagram",
    salesName: "Rina",
    createdAt: "2026-05-01",
  },
  {
    id: "2",
    name: "Budi Santoso",
    phone: "081298765432",
    email: "budi@email.com",
    venue: "Grand Puri 2",
    category: "weddings",
    eventType: "Resepsi",
    eventDate: "2026-09-20",
    estimatedPax: 300,
    packageName: "Platinum",
    status: { id: "2", name: "Warm", color: "#f59e0b" },
    source: "Referral",
    salesName: "Rina",
    createdAt: "2026-05-03",
  },
  {
    id: "3",
    name: "PT Maju Jaya",
    phone: "02112345678",
    email: "info@majujaya.com",
    venue: "Sasana Esthi Sopo",
    category: "mice",
    eventType: "Fullday Meeting 8hrs",
    eventDate: "2026-07-10",
    estimatedPax: 100,
    packageName: null,
    status: { id: "3", name: "Hot", color: "#ef4444" },
    source: "Walk-in",
    salesName: "Deni",
    createdAt: "2026-05-05",
  },
  {
    id: "4",
    name: "Citra Dewi",
    phone: "081355667788",
    email: "citra@email.com",
    venue: "De Rivier Mansion",
    category: "weddings",
    eventType: "Tea Pai & Resepsi",
    eventDate: "2026-10-05",
    estimatedPax: 400,
    packageName: "Sapphire",
    status: { id: "4", name: "Freeze", color: "#6b7280" },
    source: "Instagram",
    salesName: "Rina",
    createdAt: "2026-05-07",
  },
  {
    id: "5",
    name: "Dwi Prasetyo",
    phone: "081277889900",
    email: "dwi@email.com",
    venue: "Lippo Grand Ballroom",
    category: "weddings",
    eventType: "Akad & Resepsi",
    eventDate: "2026-11-22",
    estimatedPax: 600,
    packageName: null,
    status: { id: "5", name: "Lost", color: "#1f2937" },
    source: "Referral",
    salesName: "Deni",
    createdAt: "2026-05-10",
  },
  {
    id: "6",
    name: "PT Global Tech",
    phone: "02198765432",
    email: "hr@globaltech.com",
    venue: "Bripensiunan",
    category: "mice",
    eventType: "Halfday 6hrs",
    eventDate: "2026-06-25",
    estimatedPax: 50,
    packageName: null,
    status: { id: "1", name: "Cold", color: "#3b82f6" },
    source: "Walk-in",
    salesName: "Deni",
    createdAt: "2026-05-12",
  },
];

const ROWS_PER_PAGE = 10;

const PIPELINE_STATUSES = [
  { id: "1", name: "Cold", color: "#3b82f6" },
  { id: "2", name: "Warm", color: "#f59e0b" },
  { id: "3", name: "Hot", color: "#ef4444" },
  { id: "4", name: "Freeze", color: "#6b7280" },
  { id: "5", name: "Lost", color: "#1f2937" },
  { id: "6", name: "Converted", color: "#22c55e" },
];

const ALL_STATUSES = PIPELINE_STATUSES;

function StatusDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

export function LeadsTable() {
  const [viewMode, setViewMode] = useState<"list" | "pipeline">("list");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editLead, setEditLead] = useState<LeadItem | null>(null);
  const [leads, setLeads] = useState<LeadItem[]>(DUMMY_LEADS);

  const handleDragEnd = useCallback((result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    const newStatusId = destination.droppableId;
    const newStatus = PIPELINE_STATUSES.find((s) => s.id === newStatusId);
    if (!newStatus) return;
    setLeads((prev) =>
      prev.map((l) =>
        l.id === draggableId ? { ...l, status: newStatus } : l
      )
    );
    const lead = leads.find((l) => l.id === draggableId);
    if (lead && lead.status.id !== newStatusId) {
      toast.success(`${lead.name} dipindahkan ke ${newStatus.name}`);
    }
  }, [leads]);

  const filtered = leads.filter((lead) => {
    if (statusFilter !== "all" && lead.status.id !== statusFilter) return false;
    if (categoryFilter !== "all" && lead.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matches =
        lead.name.toLowerCase().includes(q) ||
        lead.phone.includes(q) ||
        lead.email.toLowerCase().includes(q) ||
        lead.venue.toLowerCase().includes(q) ||
        lead.eventType.toLowerCase().includes(q) ||
        lead.salesName.toLowerCase().includes(q) ||
        lead.source.toLowerCase().includes(q);
      if (!matches) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE));
  const paginated = filtered.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );

  function handleAdd() {
    setEditLead(null);
    setDrawerOpen(true);
  }

  function handleEdit(lead: LeadItem) {
    setEditLead(lead);
    setDrawerOpen(true);
  }

  function handleBuatQuotation(lead: LeadItem) {
    toast.info(`Buat Quotation untuk ${lead.name} — coming soon.`);
  }

  function handleStatusBadgeClick(statusId: string) {
    setStatusFilter((prev) => (prev === statusId ? "all" : statusId));
    setCurrentPage(1);
  }

  function handleFilterChange(
    setter: (v: string) => void,
    value: string
  ) {
    setter(value);
    setCurrentPage(1);
  }

  const statusCounts = ALL_STATUSES.map((s) => ({
    ...s,
    count: leads.filter((l) => l.status.id === s.id).length,
  }));

  return (
    <>
      <Card>
        <CardContent className="p-0">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center rounded-lg border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                    viewMode === "list"
                      ? "bg-gray-900 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <LayoutList className="size-3.5" />
                  List
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("pipeline")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                    viewMode === "pipeline"
                      ? "bg-gray-900 text-white"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Columns3 className="size-3.5" />
                  Pipeline
                </button>
              </div>
              <span className="text-xs font-medium bg-gray-50 text-gray-600 px-3 py-1 border border-gray-200 rounded-full">
                {filtered.length}
                {search || statusFilter !== "all" || categoryFilter !== "all"
                  ? ` dari ${leads.length}`
                  : " leads"}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Category filter */}
              <Select
                value={categoryFilter}
                onValueChange={(v) => handleFilterChange(setCategoryFilter, v)}
              >
                <SelectTrigger className="h-9 w-36 text-sm">
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  <SelectItem value="weddings">Weddings</SelectItem>
                  <SelectItem value="mice">MICE</SelectItem>
                </SelectContent>
              </Select>

              {/* Status filter */}
              <Select
                value={statusFilter}
                onValueChange={(v) => handleFilterChange(setStatusFilter, v)}
              >
                <SelectTrigger className="h-9 w-38 text-sm">
                  <SelectValue placeholder="Semua Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  {ALL_STATUSES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        <StatusDot color={s.color} />
                        {s.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Cari lead..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9 w-52"
                />
              </div>

              {/* Add button */}
              <Button
                onClick={handleAdd}
                className="bg-gray-900 hover:bg-gray-800 text-white cursor-pointer"
              >
                <Plus className="h-4 w-4 mr-2" />
                Tambah Lead
              </Button>
            </div>
          </div>

          {/* Pipeline status summary badges */}
          <div className="flex items-center gap-2 px-6 py-3 border-b flex-wrap">
            {statusCounts.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => handleStatusBadgeClick(s.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-colors cursor-pointer",
                  statusFilter === s.id
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                )}
              >
                <StatusDot color={statusFilter === s.id ? "#ffffff" : s.color} />
                {s.name}
                <span
                  className={cn(
                    "ml-0.5 font-bold",
                    statusFilter === s.id ? "text-white" : "text-gray-500"
                  )}
                >
                  ({s.count})
                </span>
              </button>
            ))}
            {statusFilter !== "all" && (
              <button
                type="button"
                onClick={() => handleStatusBadgeClick(statusFilter)}
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground cursor-pointer ml-1"
              >
                Reset
              </button>
            )}
          </div>

          {/* List View */}
          {viewMode === "list" && (
            <>
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Users className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">
                    {search
                      ? `Tidak ada hasil untuk "${search}"`
                      : "Belum ada lead."}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table className="min-w-300 text-sm">
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="px-4 whitespace-nowrap">Nama</TableHead>
                        <TableHead className="px-4 whitespace-nowrap">Venue</TableHead>
                        <TableHead className="px-4 whitespace-nowrap">Kategori</TableHead>
                        <TableHead className="px-4 whitespace-nowrap">Event Type</TableHead>
                        <TableHead className="px-4 whitespace-nowrap">Tanggal Event</TableHead>
                        <TableHead className="px-4 whitespace-nowrap text-right">Pax</TableHead>
                        <TableHead className="px-4 whitespace-nowrap">Paket</TableHead>
                        <TableHead className="px-4 whitespace-nowrap">Status</TableHead>
                        <TableHead className="px-4 whitespace-nowrap">Sales</TableHead>
                        <TableHead className="px-4 whitespace-nowrap">Sumber Info</TableHead>
                        <TableHead className="px-4 whitespace-nowrap w-28"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginated.map((lead) => (
                        <TableRow key={lead.id} className="hover:bg-gray-50">
                          <TableCell className="px-4 font-medium max-w-45 truncate" title={lead.name}>
                            <div className="truncate">{lead.name}</div>
                            <div className="text-xs text-muted-foreground">{lead.phone}</div>
                          </TableCell>
                          <TableCell className="px-4 whitespace-nowrap">{lead.venue}</TableCell>
                          <TableCell className="px-4">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs capitalize",
                                lead.category === "weddings"
                                  ? "border-gray-300 text-gray-700"
                                  : "border-gray-400 bg-gray-100 text-gray-800"
                              )}
                            >
                              {lead.category === "weddings" ? "Weddings" : "MICE"}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-4 whitespace-nowrap text-gray-700">
                            {lead.eventType}
                          </TableCell>
                          <TableCell className="px-4 whitespace-nowrap text-gray-700">
                            {new Date(lead.eventDate).toLocaleDateString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="px-4 text-right whitespace-nowrap">
                            {lead.estimatedPax.toLocaleString("id-ID")}
                          </TableCell>
                          <TableCell className="px-4">
                            {lead.packageName ? (
                              <Badge variant="secondary" className="text-xs">
                                {lead.packageName}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="px-4">
                            <span className="flex items-center gap-1.5 whitespace-nowrap">
                              <StatusDot color={lead.status.color} />
                              <span className="text-xs text-gray-700">{lead.status.name}</span>
                            </span>
                          </TableCell>
                          <TableCell className="px-4 text-gray-600 whitespace-nowrap">
                            {lead.salesName}
                          </TableCell>
                          <TableCell className="px-4 text-gray-600 whitespace-nowrap">
                            {lead.source}
                          </TableCell>
                          <TableCell className="px-4">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(lead)}
                                title="Edit lead"
                              >
                                <PencilIcon className="h-4 w-4" />
                              </Button>
                              {lead.status.name === "Hot" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleBuatQuotation(lead)}
                                  title="Buat Quotation"
                                  className="text-gray-700 hover:text-gray-900"
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              )}
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
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" /> Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={cn(
                          "px-3 py-1 rounded-md text-sm font-medium cursor-pointer",
                          currentPage === page
                            ? "bg-gray-200 text-gray-900"
                            : "text-gray-700 hover:bg-gray-100"
                        )}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Pipeline / Kanban View with Drag & Drop */}
          {viewMode === "pipeline" && (
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="overflow-x-auto px-6 py-4">
                <div className="flex gap-4 min-w-max">
                  {PIPELINE_STATUSES.map((status) => {
                    const columnLeads = filtered.filter((l) => l.status.id === status.id);
                    return (
                      <Droppable key={status.id} droppableId={status.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={cn(
                              "w-72 shrink-0 flex flex-col rounded-lg border border-border bg-muted/20 transition-colors",
                              snapshot.isDraggingOver && "bg-muted/50 border-gray-400"
                            )}
                          >
                            {/* Column Header */}
                            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                              <StatusDot color={status.color} />
                              <span className="text-sm font-semibold">{status.name}</span>
                              <span className="ml-auto text-xs font-medium text-muted-foreground bg-background border border-border rounded-full px-2 py-0.5">
                                {columnLeads.length}
                              </span>
                            </div>

                            {/* Cards */}
                            <div className="flex-1 overflow-y-auto p-2 space-y-2 max-h-[calc(100vh-22rem)]">
                              {columnLeads.length === 0 && !snapshot.isDraggingOver ? (
                                <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                                  Tidak ada lead
                                </div>
                              ) : (
                                columnLeads.map((lead, idx) => (
                                  <Draggable key={lead.id} draggableId={lead.id} index={idx}>
                                    {(dragProvided, dragSnapshot) => (
                                      <div
                                        ref={dragProvided.innerRef}
                                        {...dragProvided.draggableProps}
                                        {...dragProvided.dragHandleProps}
                                        className={cn(
                                          "rounded-lg border border-border bg-background p-3 space-y-2 transition-shadow cursor-grab active:cursor-grabbing",
                                          dragSnapshot.isDragging ? "shadow-lg ring-2 ring-gray-300" : "hover:shadow-sm"
                                        )}
                                        onClick={() => {
                                          if (!dragSnapshot.isDragging) {
                                            handleEdit(lead);
                                          }
                                        }}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">{lead.name}</p>
                                            <p className="text-xs text-muted-foreground">{lead.phone}</p>
                                          </div>
                                          <Badge
                                            variant="outline"
                                            className={cn(
                                              "text-[10px] shrink-0 capitalize",
                                              lead.category === "mice" && "bg-gray-100"
                                            )}
                                          >
                                            {lead.category === "weddings" ? "Weddings" : "MICE"}
                                          </Badge>
                                        </div>

                                        <div className="space-y-1 text-xs text-muted-foreground">
                                          <div className="flex justify-between">
                                            <span>Venue</span>
                                            <span className="text-foreground font-medium truncate ml-2">{lead.venue}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>Event</span>
                                            <span className="text-foreground font-medium truncate ml-2">{lead.eventType}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>Tanggal</span>
                                            <span className="text-foreground font-medium">
                                              {new Date(lead.eventDate).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                                            </span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span>Pax</span>
                                            <span className="text-foreground font-medium">{lead.estimatedPax.toLocaleString("id-ID")}</span>
                                          </div>
                                        </div>

                                        <div className="flex items-center justify-between pt-1 border-t border-border">
                                          <span className="text-xs text-muted-foreground">{lead.salesName}</span>
                                          {lead.packageName ? (
                                            <Badge variant="secondary" className="text-[10px]">{lead.packageName}</Badge>
                                          ) : (
                                            <span className="text-[10px] text-muted-foreground">No package</span>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </Draggable>
                                ))
                              )}
                              {provided.placeholder}
                            </div>
                          </div>
                        )}
                      </Droppable>
                    );
                  })}
                </div>
              </div>
            </DragDropContext>
          )}
        </CardContent>
      </Card>

      <LeadDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        editLead={editLead}
      />
    </>
  );
}
