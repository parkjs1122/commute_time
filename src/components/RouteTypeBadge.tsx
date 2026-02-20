import { ROUTE_TYPE_BADGE } from "@/lib/constants";

export default function RouteTypeBadge({
  routeType,
}: {
  routeType: string;
}) {
  const badge = ROUTE_TYPE_BADGE[routeType];
  if (!badge) return null;

  return (
    <span
      className={`shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
    >
      {badge.label}
    </span>
  );
}
