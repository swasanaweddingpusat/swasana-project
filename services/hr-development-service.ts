import type {
  TrainingProgramItem,
  EmployeeDevelopmentItem,
  EmployeeCertificationItem,
} from "@/lib/queries/hrDevelopment";

export async function fetchTrainingPrograms(): Promise<TrainingProgramItem[]> {
  const res = await fetch("/api/hr/training-programs");
  if (!res.ok) throw new Error("Failed to fetch training programs");
  return res.json() as Promise<TrainingProgramItem[]>;
}

export async function fetchEmployeeDevelopments(): Promise<EmployeeDevelopmentItem[]> {
  const res = await fetch("/api/hr/employee-developments");
  if (!res.ok) throw new Error("Failed to fetch employee developments");
  return res.json() as Promise<EmployeeDevelopmentItem[]>;
}

export async function fetchEmployeeCertifications(): Promise<EmployeeCertificationItem[]> {
  const res = await fetch("/api/hr/employee-certifications");
  if (!res.ok) throw new Error("Failed to fetch employee certifications");
  return res.json() as Promise<EmployeeCertificationItem[]>;
}
