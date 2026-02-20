export const ROUTE_TYPE_BADGE: Record<
  string,
  { label: string; className: string }
> = {
  commute: {
    label: "출근",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  },
  return: {
    label: "퇴근",
    className:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  },
  other: {
    label: "기타",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400",
  },
};
