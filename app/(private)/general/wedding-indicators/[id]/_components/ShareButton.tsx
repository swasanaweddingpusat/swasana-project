"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ShareModal } from "@/components/shared/wedding-indicators/ShareModal";
import { Link as LinkIcon } from "@solar-icons/react";

interface ShareButtonProps {
  indicatorId: string;
  coupleName: string;
}

export function ShareButton({ indicatorId, coupleName }: ShareButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <LinkIcon weight="BoldDuotone" className="h-4 w-4 mr-1.5" />
        Share
      </Button>
      <ShareModal
        indicatorId={indicatorId}
        coupleName={coupleName}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
