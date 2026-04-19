"use client";

import { UserMenu } from "./user-menu";

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between shrink-0">
      {/* Left: page context / empty */}
      <div className="flex-1" />

      {/* Right: user avatar dropdown */}
      <UserMenu />
    </header>
  );
}
