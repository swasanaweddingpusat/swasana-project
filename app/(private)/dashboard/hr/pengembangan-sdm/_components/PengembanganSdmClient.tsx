"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AddCircle,
  MedalStar,
  Pen,
  SquareAcademicCap,
  TrashBinTrash,
  UserCheck,
} from "@solar-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEmployees } from "@/hooks/use-employees";
import {
  useTrainingPrograms,
  useDeleteTrainingProgram,
  useEmployeeDevelopments,
  useDeleteEmployeeDevelopment,
  useEmployeeCertifications,
  useDeleteEmployeeCertification,
} from "@/hooks/use-hr-development";
import type { TrainingProgramItem, EmployeeDevelopmentItem, EmployeeCertificationItem } from "@/lib/queries/hrDevelopment";
import { TrainingProgramDrawer } from "@/app/(private)/dashboard/hr/pengembangan-sdm/_components/TrainingProgramDrawer";
import { EmployeeDevelopmentDrawer } from "@/app/(private)/dashboard/hr/pengembangan-sdm/_components/EmployeeDevelopmentDrawer";
import { CertificationDrawer } from "@/app/(private)/dashboard/hr/pengembangan-sdm/_components/CertificationDrawer";

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Terjadwal",
  ONGOING: "Berlangsung",
  COMPLETED: "Selesai",
  CANCELLED: "Dibatalkan",
};

const LEVEL_LABELS: Record<string, string> = {
  BEGINNER: "Pemula",
  INTERMEDIATE: "Menengah",
  ADVANCED: "Lanjutan",
};

const CERT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Aktif",
  PENDING: "Menunggu",
  EXPIRED: "Kedaluwarsa",
};

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-heading font-semibold text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
        <div className="h-full bg-primary transition-all" style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{value}%</span>
    </div>
  );
}

export function PengembanganSdmClient() {
  const { data: trainingPrograms = [] } = useTrainingPrograms();
  const { data: employeeDevelopments = [] } = useEmployeeDevelopments();
  const { data: employeeCertifications = [] } = useEmployeeCertifications();
  const { data: employeesResult } = useEmployees({ page: 1, limit: 200, status: "active" });

  const deleteTrainingMutation = useDeleteTrainingProgram();
  const deleteDevelopmentMutation = useDeleteEmployeeDevelopment();
  const deleteCertificationMutation = useDeleteEmployeeCertification();

  const employees = useMemo(() => employeesResult?.data ?? [], [employeesResult?.data]);

  const [trainingDrawerOpen, setTrainingDrawerOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<TrainingProgramItem | null>(null);

  const [developmentDrawerOpen, setDevelopmentDrawerOpen] = useState(false);
  const [editingDevelopment, setEditingDevelopment] = useState<EmployeeDevelopmentItem | null>(null);

  const [certificationDrawerOpen, setCertificationDrawerOpen] = useState(false);
  const [editingCertification, setEditingCertification] = useState<EmployeeCertificationItem | null>(null);

  function openTrainingDrawer(item?: TrainingProgramItem) {
    setEditingTraining(item ?? null);
    setTrainingDrawerOpen(true);
  }

  function closeTrainingDrawer() {
    setTrainingDrawerOpen(false);
    setEditingTraining(null);
  }

  function openDevelopmentDrawer(item?: EmployeeDevelopmentItem) {
    setEditingDevelopment(item ?? null);
    setDevelopmentDrawerOpen(true);
  }

  function closeDevelopmentDrawer() {
    setDevelopmentDrawerOpen(false);
    setEditingDevelopment(null);
  }

  function openCertificationDrawer(item?: EmployeeCertificationItem) {
    setEditingCertification(item ?? null);
    setCertificationDrawerOpen(true);
  }

  function closeCertificationDrawer() {
    setCertificationDrawerOpen(false);
    setEditingCertification(null);
  }

  async function handleDeleteTraining(id: string) {
    const result = await deleteTrainingMutation.mutateAsync(id);
    if (result.success) {
      toast.success("Program pelatihan dihapus");
      return;
    }
    toast.error(result.error ?? "Gagal menghapus program");
  }

  async function handleDeleteDevelopment(id: string) {
    const result = await deleteDevelopmentMutation.mutateAsync(id);
    if (result.success) {
      toast.success("Pengembangan karyawan dihapus");
      return;
    }
    toast.error(result.error ?? "Gagal menghapus pengembangan");
  }

  async function handleDeleteCertification(id: string) {
    const result = await deleteCertificationMutation.mutateAsync(id);
    if (result.success) {
      toast.success("Sertifikasi dihapus");
      return;
    }
    toast.error(result.error ?? "Gagal menghapus sertifikasi");
  }

  const stats = useMemo(() => ({
    activePrograms: trainingPrograms.filter((p) => p.status === "ONGOING").length,
    totalDevelopments: employeeDevelopments.length,
    activeCertifications: employeeCertifications.filter((c) => c.status === "ACTIVE").length,
  }), [trainingPrograms, employeeDevelopments, employeeCertifications]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-heading font-semibold text-foreground">Pengembangan SDM</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Kelola program pelatihan, pengembangan skill, dan sertifikasi karyawan.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {stats.activePrograms} program berjalan
          </Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {stats.totalDevelopments} pengembangan
          </Badge>
          <Badge variant="secondary" className="rounded-full px-3 py-1">
            {stats.activeCertifications} sertifikasi aktif
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="rounded-full bg-muted p-3 text-foreground">
              <SquareAcademicCap weight="BoldDuotone" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Program pelatihan</p>
              <p className="text-2xl font-heading font-semibold">{trainingPrograms.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="rounded-full bg-muted p-3 text-foreground">
              <UserCheck weight="BoldDuotone" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pengembangan aktif</p>
              <p className="text-2xl font-heading font-semibold">{stats.totalDevelopments}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="flex items-start gap-3 p-5">
            <div className="rounded-full bg-muted p-3 text-foreground">
              <MedalStar weight="BoldDuotone" className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sertifikasi aktif</p>
              <p className="text-2xl font-heading font-semibold">{stats.activeCertifications}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pelatihan" className="w-full">
        <TabsList className="flex h-auto w-full flex-col gap-1 rounded-2xl p-1 sm:grid sm:grid-cols-3 sm:gap-0">
          <TabsTrigger value="pelatihan" className="rounded-xl gap-2">
            <SquareAcademicCap weight="BoldDuotone" className="h-4 w-4" />
            Program Pelatihan
          </TabsTrigger>
          <TabsTrigger value="pengembangan" className="rounded-xl gap-2">
            <UserCheck weight="BoldDuotone" className="h-4 w-4" />
            Pengembangan Karyawan
          </TabsTrigger>
          <TabsTrigger value="sertifikasi" className="rounded-xl gap-2">
            <MedalStar weight="BoldDuotone" className="h-4 w-4" />
            Sertifikasi
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pelatihan" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button className="rounded-full gap-2" onClick={() => openTrainingDrawer()}>
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />Tambah Program
            </Button>
          </div>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="space-y-2">
              <SectionTitle
                title="Daftar Program Pelatihan"
                description="Semua program pelatihan yang terdaftar."
              />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama Program</TableHead>
                      <TableHead>Tanggal Mulai</TableHead>
                      <TableHead>Tanggal Selesai</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Peserta</TableHead>
                      <TableHead>Progres</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trainingPrograms.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                          Belum ada program pelatihan.
                        </TableCell>
                      </TableRow>
                    ) : (
                      trainingPrograms.map((item: TrainingProgramItem) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-foreground">{item.name}</span>
                              {item.description && (
                                <span className="text-xs text-muted-foreground line-clamp-1">{item.description}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(item.startDate)}</TableCell>
                          <TableCell className="text-sm">{formatDate(item.endDate)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                item.status === "COMPLETED"
                                  ? "default"
                                  : item.status === "ONGOING"
                                  ? "secondary"
                                  : item.status === "CANCELLED"
                                  ? "destructive"
                                  : "outline"
                              }
                              className="rounded-full"
                            >
                              {STATUS_LABELS[item.status] ?? item.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{item.participantsCount}</TableCell>
                          <TableCell>
                            <ProgressBar value={item.completionPercentage} />
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-full"
                                onClick={() => openTrainingDrawer(item)}
                              >
                                <Pen weight="BoldDuotone" className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                                onClick={() => handleDeleteTraining(item.id)}
                                disabled={deleteTrainingMutation.isPending}
                              >
                                <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pengembangan" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button className="rounded-full gap-2" onClick={() => openDevelopmentDrawer()}>
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />Tambah Pengembangan
            </Button>
          </div>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="space-y-2">
              <SectionTitle
                title="Daftar Pengembangan Karyawan"
                description="Rencana pengembangan skill semua karyawan."
              />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Karyawan</TableHead>
                      <TableHead>Skill</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Tanggal Mulai</TableHead>
                      <TableHead>Target Selesai</TableHead>
                      <TableHead>Progres</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeDevelopments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                          Belum ada data pengembangan karyawan.
                        </TableCell>
                      </TableRow>
                    ) : (
                      employeeDevelopments.map((item: EmployeeDevelopmentItem) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-foreground">{item.profile.fullName}</span>
                              <span className="text-xs text-muted-foreground">{item.profile.employeeNumber ?? "-"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{item.skill}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="rounded-full">
                              {LEVEL_LABELS[item.level] ?? item.level}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(item.startDate)}</TableCell>
                          <TableCell className="text-sm">{formatDate(item.targetCompletionDate)}</TableCell>
                          <TableCell>
                            <ProgressBar value={item.progressPercentage} />
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-full"
                                onClick={() => openDevelopmentDrawer(item)}
                              >
                                <Pen weight="BoldDuotone" className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                                onClick={() => handleDeleteDevelopment(item.id)}
                                disabled={deleteDevelopmentMutation.isPending}
                              >
                                <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sertifikasi" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button className="rounded-full gap-2" onClick={() => openCertificationDrawer()}>
              <AddCircle weight="BoldDuotone" className="h-4 w-4" />Tambah Sertifikasi
            </Button>
          </div>

          <Card className="rounded-2xl shadow-sm">
            <CardHeader className="space-y-2">
              <SectionTitle
                title="Daftar Sertifikasi Karyawan"
                description="Semua sertifikasi yang dimiliki karyawan."
              />
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Karyawan</TableHead>
                      <TableHead>Nama Sertifikasi</TableHead>
                      <TableHead>Tanggal Terbit</TableHead>
                      <TableHead>Tanggal Kedaluwarsa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employeeCertifications.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                          Belum ada data sertifikasi karyawan.
                        </TableCell>
                      </TableRow>
                    ) : (
                      employeeCertifications.map((item: EmployeeCertificationItem) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-medium text-foreground">{item.profile.fullName}</span>
                              <span className="text-xs text-muted-foreground">{item.profile.employeeNumber ?? "-"}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{item.certificationName}</TableCell>
                          <TableCell className="text-sm">{formatDate(item.issueDate)}</TableCell>
                          <TableCell className="text-sm">{formatDate(item.expiryDate)}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                item.status === "ACTIVE"
                                  ? "default"
                                  : item.status === "EXPIRED"
                                  ? "destructive"
                                  : "secondary"
                              }
                              className="rounded-full"
                            >
                              {CERT_STATUS_LABELS[item.status] ?? item.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-full"
                                onClick={() => openCertificationDrawer(item)}
                              >
                                <Pen weight="BoldDuotone" className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-full text-destructive hover:text-destructive"
                                onClick={() => handleDeleteCertification(item.id)}
                                disabled={deleteCertificationMutation.isPending}
                              >
                                <TrashBinTrash weight="BoldDuotone" className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <TrainingProgramDrawer
        isOpen={trainingDrawerOpen}
        onClose={closeTrainingDrawer}
        editItem={editingTraining}
      />
      <EmployeeDevelopmentDrawer
        isOpen={developmentDrawerOpen}
        onClose={closeDevelopmentDrawer}
        editItem={editingDevelopment}
        employees={employees}
      />
      <CertificationDrawer
        isOpen={certificationDrawerOpen}
        onClose={closeCertificationDrawer}
        editItem={editingCertification}
        employees={employees}
      />
    </div>
  );
}
