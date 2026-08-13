import type { Metadata } from "next";
import { connection } from "next/server";
import { TutorialClient } from "./_components/tutorial-client";
import { getTutorialCategories } from "@/lib/queries/tutorials";

export const metadata: Metadata = {
  title: "Tutorial",
};

export default async function TutorialPage() {
  await connection();
  const categories = await getTutorialCategories();

  return <TutorialClient initialCategories={categories} />;
}
