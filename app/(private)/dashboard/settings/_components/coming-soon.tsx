import { type LucideIcon } from "lucide-react";

interface ComingSoonProps {
  icon: LucideIcon;
}

export function ComingSoon({ icon: Icon }: ComingSoonProps) {
  return (
    <div className="px-6 py-10">
      <div className="max-w-lg mx-auto text-center border border-dashed border-gray-300 bg-white rounded-lg p-10">
        <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-gray-100 mb-4">
          <Icon className="h-5 w-5 text-gray-600" />
        </div>
        <p className="text-sm text-gray-500">Fitur ini sedang dibangun.</p>
      </div>
    </div>
  );
}
