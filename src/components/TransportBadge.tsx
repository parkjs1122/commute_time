/** 시외/고속버스 lineName 패턴 */
const INTERCITY_LINE_NAMES = ["시외버스", "고속버스", "시외", "고속", "EXPRESS_BUS", "INTERCITY_BUS"];

/** 영문 vehicle type → 한국어 표시명 */
const LINE_NAME_LABELS: Record<string, string> = {
  EXPRESS_BUS: "고속버스",
  INTERCITY_BUS: "시외버스",
  TRAIN: "열차",
};

function isIntercityBus(lineName: string): boolean {
  return INTERCITY_LINE_NAMES.some(
    (name) => lineName === name || lineName.includes(name)
  );
}

function displayLineName(lineName: string): string {
  return LINE_NAME_LABELS[lineName] ?? lineName;
}

export default function TransportBadge({
  type,
  lineName,
  isSchedule,
}: {
  type: "bus" | "subway" | "train";
  lineName: string;
  isSchedule?: boolean;
}) {
  const intercity = type === "bus" && (isSchedule || isIntercityBus(lineName));

  const colorClasses =
    type === "train"
      ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
      : intercity
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
        : type === "bus"
          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
          : "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300";

  const label =
    type === "train"
      ? ""
      : intercity
        ? ""
        : type === "bus"
          ? "버스"
          : "지하철";

  const icon =
    type === "train" ? (
      // 기차 아이콘
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
          d="M12 2C8 2 5 3 5 6v9c0 1.5 1 3 3 3l-1.5 2h11L16 18c2 0 3-1.5 3-3V6c0-3-3-4-7-4ZM8.5 16a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm7 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2ZM17 11H7V6h10v5Z"
        />
      </svg>
    ) : type === "bus" ? (
      // 버스 아이콘
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
          d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
        />
      </svg>
    ) : (
      // 지하철 아이콘
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
          d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z"
        />
      </svg>
    );

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClasses}`}
    >
      {icon}
      {label}{label ? " " : ""}{displayLineName(lineName)}
    </span>
  );
}
