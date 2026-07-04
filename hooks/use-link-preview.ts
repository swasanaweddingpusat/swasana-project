import { useQuery } from "@tanstack/react-query";

interface LinkPreviewData {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string | null;
}

export function useLinkPreview(url: string | null) {
  return useQuery<LinkPreviewData>({
    queryKey: ["link-preview", url],
    queryFn: async () => {
      const res = await fetch(`/api/link-preview?url=${encodeURIComponent(url!)}`);
      return res.json() as Promise<LinkPreviewData>;
    },
    enabled: !!url,
    staleTime: 1000 * 60 * 60,
    retry: false,
  });
}
