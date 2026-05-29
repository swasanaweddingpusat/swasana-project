import type { Metadata } from "next";
import { TutorialClient } from "./_components/tutorial-client";

export const metadata: Metadata = {
  title: "Tutorial",
};

export default function TutorialPage() {
  return <TutorialClient />;
}
