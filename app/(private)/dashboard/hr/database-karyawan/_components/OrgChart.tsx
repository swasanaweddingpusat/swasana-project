"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEmployees } from "@/hooks/use-employees";
import { useDepartments } from "@/hooks/use-departments";
import {
  AltArrowDown,
  AltArrowRight,
  Buildings3,
  Structure,
  UsersGroupRounded,
} from "@solar-icons/react";
import type { EmployeeListItem } from "@/lib/queries/employees";
import type { DepartmentItem } from "@/lib/queries/departments";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface DeptGroup {
  department: DepartmentItem;
  employees: EmployeeListItem[];
  children: DeptGroup[];
}

// ─── EmployeeCard ────────────────────────────────────────────────────────────

function EmployeeCard({ employee }: { employee: EmployeeListItem }) {
  return (
    <Link
      href={`/dashboard/hr/database-karyawan/${employee.id}`}
      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-all hover:shadow-md"
    >
      <Avatar className="h-9 w-9 shrink-0">
        <AvatarImage src={employee.avatarUrl ?? undefined} alt={employee.fullName ?? ""} />
        <AvatarFallback className="text-xs">
          {getInitials(employee.fullName ?? "?")}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{employee.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {employee.position?.name ?? "Belum ditentukan"}
        </p>
      </div>
    </Link>
  );
}

// ─── DeptBranch ──────────────────────────────────────────────────────────────

function DeptBranch({
  group,
  level,
  expanded,
  toggleExpand,
}: {
  group: DeptGroup;
  level: number;
  expanded: Set<string>;
  toggleExpand: (id: string) => void;
}) {
  const isExpanded = expanded.has(group.department.id);
  const totalEmployees = group.employees.length;
  const hasContent = totalEmployees > 0 || group.children.length > 0;

  return (
    <div className="relative">
      {/* Connector line for non-root */}
      {level > 0 && (
        <div
          className="absolute top-0 border-l-2 border-border"
          style={{
            left: `${level * 32 - 16}px`,
            height: "20px",
          }}
        />
      )}

      {/* Department header */}
      <div
        className="flex items-center gap-2"
        style={{ paddingLeft: `${level * 32}px` }}
      >
        {/* Horizontal connector */}
        {level > 0 && (
          <div className="absolute border-t-2 border-border" style={{
            left: `${level * 32 - 16}px`,
            width: "16px",
            top: "20px",
          }} />
        )}

        <button
          type="button"
          className="flex items-center gap-2 rounded-xl bg-primary/5 px-4 py-3 transition-colors hover:bg-primary/10"
          onClick={() => {
            if (hasContent) {
              toggleExpand(group.department.id);
            }
          }}
        >
          {hasContent ? (
            isExpanded ? (
              <AltArrowDown weight="BoldDuotone" className="h-4 w-4 text-primary" />
            ) : (
              <AltArrowRight weight="BoldDuotone" className="h-4 w-4 text-primary" />
            )
          ) : (
            <Buildings3 weight="BoldDuotone" className="h-4 w-4 text-primary" />
          )}
          <span className="text-sm font-semibold">{group.department.name}</span>
          {group.department.head?.fullName && (
            <span className="text-xs text-muted-foreground">
              &mdash; {group.department.head.fullName}
            </span>
          )}
          <Badge variant="secondary" className="ml-1 rounded-full text-xs">
            <UsersGroupRounded weight="BoldDuotone" className="mr-0.5 h-3 w-3" />
            {totalEmployees}
          </Badge>
        </button>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div style={{ paddingLeft: `${level * 32 + 16}px` }}>
          {/* Vertical connector line */}
          <div className="relative border-l-2 border-border pl-6">
            {/* Employee cards */}
            {group.employees.length > 0 && (
              <div className="space-y-2 py-2">
                {group.employees.map((emp) => (
                  <div key={emp.id} className="relative">
                    {/* Horizontal connector */}
                    <div className="absolute -left-6 top-1/2 w-6 border-t-2 border-border" />
                    <EmployeeCard employee={emp} />
                  </div>
                ))}
              </div>
            )}

            {/* Child department groups */}
            {group.children.length > 0 && (
              <div className="space-y-3 py-2">
                {group.children.map((child) => (
                  <div key={child.department.id} className="relative">
                    <div className="absolute -left-6 top-5 w-6 border-t-2 border-border" />
                    <DeptBranch
                      group={child}
                      level={0}
                      expanded={expanded}
                      toggleExpand={toggleExpand}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── OrgChart ────────────────────────────────────────────────────────────────

export function OrgChart() {
  const { data: employeesData, isLoading: loadingEmployees } = useEmployees({ limit: 200 });
  const { data: departments, isLoading: loadingDepts } = useDepartments();

  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const isLoading = loadingEmployees || loadingDepts;

  // Build department tree with employees grouped
  const tree = useMemo(() => {
    if (!departments || !employeesData) return [];

    const employees = employeesData.data;

    // Group employees by departmentId
    const empByDept = new Map<string, EmployeeListItem[]>();
    const unassigned: EmployeeListItem[] = [];

    for (const emp of employees) {
      if (emp.department?.id) {
        const list = empByDept.get(emp.department.id);
        if (list) {
          list.push(emp);
        } else {
          empByDept.set(emp.department.id, [emp]);
        }
      } else {
        unassigned.push(emp);
      }
    }

    // Build department tree
    function buildGroup(dept: DepartmentItem): DeptGroup {
      const childDepts = departments!
        .filter((d) => d.parentId === dept.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);

      return {
        department: dept,
        employees: empByDept.get(dept.id) ?? [],
        children: childDepts.map(buildGroup),
      };
    }

    const rootDepts = departments
      .filter((d) => d.parentId === null)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const groups = rootDepts.map(buildGroup);

    // Add unassigned group if any
    if (unassigned.length > 0) {
      groups.push({
        department: {
          id: "__unassigned__",
          name: "Belum Ditentukan",
          description: null,
          parentId: null,
          sortOrder: 9999,
          isActive: true,
          head: null,
          _count: { profiles: unassigned.length, children: 0 },
        },
        employees: unassigned,
        children: [],
      });
    }

    return groups;
  }, [departments, employeesData]);

  // Toggle expand
  const toggleExpand = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Expand all
  const handleExpandAll = useCallback(() => {
    if (!departments) return;
    setExpanded(new Set(departments.map((d) => d.id).concat("__unassigned__")));
  }, [departments]);

  // Collapse all
  const handleCollapseAll = useCallback(() => {
    setExpanded(new Set());
  }, []);

  const totalEmployees = employeesData?.total ?? 0;

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="font-heading text-lg">Struktur Organisasi</CardTitle>
            {totalEmployees > 0 && (
              <p className="mt-1 text-sm text-muted-foreground">
                {totalEmployees} karyawan &middot; {departments?.length ?? 0} departemen
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={handleExpandAll}
            >
              Buka Semua
            </button>
            <button
              type="button"
              className="rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={handleCollapseAll}
            >
              Tutup Semua
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-12 w-64 rounded-xl" />
                <div className="ml-8 space-y-2">
                  <Skeleton className="h-14 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && tree.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Structure
              weight="BoldDuotone"
              className="h-12 w-12 text-muted-foreground/40"
            />
            <p className="mt-3 text-sm text-muted-foreground">
              Belum ada data untuk ditampilkan
            </p>
          </div>
        )}

        {/* Tree */}
        {!isLoading && tree.length > 0 && (
          <div className="space-y-4">
            {tree.map((group) => (
              <DeptBranch
                key={group.department.id}
                group={group}
                level={0}
                expanded={expanded}
                toggleExpand={toggleExpand}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
