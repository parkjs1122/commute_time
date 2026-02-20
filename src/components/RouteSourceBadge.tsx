export default function RouteSourceBadge({
  routeSource,
}: {
  routeSource?: string | null;
}) {
  const isInterLocal = routeSource === "inter_local";

  const colorClasses = isInterLocal
    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
    : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";

  const label = isInterLocal ? "시외" : "시내";

  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${colorClasses}`}
    >
      {isInterLocal ? (
        <svg
          className="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12.75 3.03v.568c0 .334.148.65.405.864l1.068.89c.442.369.535 1.01.216 1.49l-.51.766a2.25 2.25 0 0 1-1.161.886l-.143.048a1.107 1.107 0 0 0-.57 1.664c.369.555.169 1.307-.427 1.605L9 13.125l.423 1.059a.956.956 0 0 1-1.652.928l-.679-.906a1.125 1.125 0 0 0-1.906.172L4.5 15.75l-.612.153M12.75 3.031a9 9 0 0 1 7.862 5.656M12.75 3.031a9 9 0 0 0-8.862 5.656m17.724 0a9 9 0 0 1-4.224 7.902M3.888 8.687a9 9 0 0 0 4.224 7.902m0 0L9.75 18l1.5-1.875M8.112 16.59l-1.224 1.535"
          />
        </svg>
      ) : (
        <svg
          className="h-3 w-3"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21"
          />
        </svg>
      )}
      {label}
    </span>
  );
}
