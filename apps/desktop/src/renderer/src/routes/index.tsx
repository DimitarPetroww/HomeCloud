import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const version = useQuery({
    queryKey: ["app-version"],
    queryFn: () => window.homecloud.getAppVersion(),
  });

  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Home Cloud</h1>
      <p className="text-muted-foreground">Desktop app v{version.data ?? "…"}</p>
    </div>
  );
}
