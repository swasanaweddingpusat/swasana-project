"use client";

import Image from "next/image";
import {
  Book2,
  Buildings,
  CalendarMark,
  CardReceive,
  ClipboardText,
  DocumentText,
  Home,
  Letter,
  Phone,
  Shield,
  User,
  UserCircle,
} from "@solar-icons/react";
import type { IconProps } from "@solar-icons/react";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/shared/drawer";
import type { OnboardingFormLinkItem } from "@/lib/queries/onboardingFormLinks";

interface OnboardingSubmissionDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: OnboardingFormLinkItem | null;
}

function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ForwardRefExoticComponent<Omit<IconProps, "ref"> & React.RefAttributes<SVGSVGElement>>;
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon weight="BoldDuotone" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-medium text-foreground break-words">
          {value ?? "-"}
        </span>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-heading font-semibold text-foreground border-b border-border pb-2 mb-1">
        {title}
      </h3>
      <div className="flex flex-col divide-y divide-border/50">{children}</div>
    </div>
  );
}

function FilePreview({
  label,
  url,
}: {
  label: string;
  url: string | null | undefined;
}) {
  if (!url) {
    return (
      <div className="flex items-center gap-3 py-2.5">
        <DocumentText weight="BoldDuotone" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted-foreground">{label}</span>
          <span className="text-sm text-muted-foreground italic">Belum diunggah</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 py-2.5">
      <div className="flex items-center gap-3">
        <DocumentText weight="BoldDuotone" className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="ml-7 block overflow-hidden rounded-xl border border-border"
      >
        <Image
          src={url}
          alt={label}
          width={400}
          height={160}
          unoptimized
          className="h-40 w-full object-cover transition-opacity hover:opacity-80"
        />
      </a>
    </div>
  );
}

export function OnboardingSubmissionDetailDrawer({
  isOpen,
  onClose,
  item,
}: OnboardingSubmissionDetailDrawerProps) {
  const sub = item?.submission;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Detail Submission Onboarding"
      maxWidth="sm:max-w-lg"
    >
      {!sub ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <ClipboardText weight="BoldDuotone" className="h-10 w-10 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Belum ada data submission untuk link ini.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6 pb-6">
          {/* Header card */}
          <div className="flex items-center gap-4 rounded-2xl border border-border bg-muted/30 p-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <UserCircle weight="BoldDuotone" className="h-6 w-6 text-primary" />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-base font-heading font-semibold text-foreground truncate">
                {sub.fullName}
              </span>
              <span className="text-sm text-muted-foreground truncate">{sub.email}</span>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="secondary" className="rounded-full text-xs">
                  {sub.divisi}
                </Badge>
                <Badge variant="outline" className="rounded-full text-xs">
                  {sub.jabatan}
                </Badge>
              </div>
            </div>
          </div>

          {/* Info Posisi */}
          <Section title="Informasi Posisi">
            <InfoRow icon={Buildings} label="Venue / Lokasi" value={sub.venue?.name} />
            <InfoRow icon={ClipboardText} label="Divisi" value={sub.divisi} />
            <InfoRow icon={ClipboardText} label="Jabatan" value={sub.jabatan} />
            <InfoRow icon={CalendarMark} label="Tanggal Bergabung" value={formatDate(sub.joinDate)} />
          </Section>

          {/* Data Pribadi */}
          <Section title="Data Pribadi">
            <InfoRow icon={User} label="Nama Lengkap" value={sub.fullName} />
            <InfoRow icon={User} label="Nama Panggilan" value={sub.nickName} />
            <InfoRow icon={Home} label="Tempat Lahir" value={sub.placeOfBirth} />
            <InfoRow icon={CalendarMark} label="Tanggal Lahir" value={formatDate(sub.dateOfBirth)} />
            <InfoRow icon={Phone} label="No. Telepon" value={sub.phoneNumber} />
            <InfoRow icon={Letter} label="Email" value={sub.email} />
            <InfoRow icon={User} label="Status Pernikahan" value={sub.maritalStatus} />
            <InfoRow icon={Book2} label="Pendidikan Terakhir" value={sub.lastEducation} />
            <InfoRow icon={User} label="Jumlah Anak" value={sub.numberOfChildren} />
            <InfoRow icon={User} label="Nama Ibu Kandung" value={sub.motherName} />
          </Section>

          {/* Alamat */}
          <Section title="Alamat">
            <InfoRow icon={Home} label="Alamat KTP" value={sub.ktpAddress} />
            <InfoRow icon={Home} label="Alamat Domisili" value={sub.currentAddress} />
          </Section>

          {/* Kontak Darurat */}
          <Section title="Kontak Darurat">
            <InfoRow icon={Shield} label="Nama" value={sub.emergencyContactName} />
            <InfoRow icon={Shield} label="Hubungan" value={sub.emergencyContactRel} />
            <InfoRow icon={Phone} label="No. Telepon" value={sub.emergencyContactPhone} />
          </Section>

          {/* Data Bank */}
          <Section title="Informasi Bank">
            <InfoRow icon={CardReceive} label="Nama Bank" value={sub.bankName} />
            <InfoRow icon={CardReceive} label="No. Rekening" value={sub.bankAccountNumber} />
          </Section>

          {/* Dokumen */}
          <Section title="Dokumen">
            <FilePreview label="Foto KTP" url={sub.ktpFileUrl} />
            <FilePreview label="Foto KK" url={sub.kkFileUrl} />
            <FilePreview label="Pas Foto" url={sub.photoUrl} />
          </Section>

          {/* Footer */}
          <div className="text-xs text-muted-foreground text-right border-t border-border pt-3">
            Disubmit pada {formatDate(sub.submittedAt)}
          </div>
        </div>
      )}
    </Drawer>
  );
}
