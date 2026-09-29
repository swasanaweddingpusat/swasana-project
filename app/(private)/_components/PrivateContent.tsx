"use client";

import type { JSX, ReactNode } from "react";
import { usePathname } from "next/navigation";

interface PrivateContentProps {
  children: ReactNode;
}

export function PrivateContent({ children }: PrivateContentProps): JSX.Element {
  const pathname = usePathname();
  const className =
    pathname === "/chat-ai"
      ? "flex-1 p-0"
      : "flex-1 p-4 pb-24 md:pb-6 lg:p-6";

  return <main className={className}>{children}</main>;
}
