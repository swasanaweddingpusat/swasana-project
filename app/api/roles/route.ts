import { NextResponse } from "next/server";
import { getRoles } from "@/lib/queries/roles";

export async function GET() {
  try {
    const roles = await getRoles();
    return NextResponse.json(roles);
  } catch {
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}
