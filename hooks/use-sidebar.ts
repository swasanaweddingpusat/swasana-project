"use client";

import { useState, useCallback } from "react";

export function useSidebar(defaultCollapsed = false) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const toggle = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const collapse = useCallback(() => {
    setIsCollapsed(true);
  }, []);

  const expand = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  return { isCollapsed, toggle, collapse, expand };
}
