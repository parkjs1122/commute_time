import TransportBadge from "@/components/TransportBadge";

interface LegData {
  id?: string;
  type: string;
  lineNames: string[];
  startStation?: string | null;
  endStation?: string | null;
  sectionTime: number;
}

export default function LegDetail({ legs }: { legs: LegData[] }) {
  return (
    <div className="space-y-2.5">
      {legs.map((leg, index) => {
        const key = leg.id ?? index;

        if (leg.type === "walk") {
          return (
            <div
              key={key}
              className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
            >
              <svg
                className="h-3.5 w-3.5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0"
                />
              </svg>
              <span>도보 {leg.sectionTime}분</span>
            </div>
          );
        }

        const names =
          leg.lineNames.length > 0
            ? leg.lineNames
            : [leg.type === "bus" ? "버스" : "지하철"];

        return (
          <div key={key}>
            {(leg.startStation || leg.endStation) && (
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                <svg
                  className="h-3.5 w-3.5 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0 1 15 0Z"
                  />
                </svg>
                <span>
                  {leg.startStation ?? "승차"} &rarr;{" "}
                  {leg.endStation ?? "하차"}
                </span>
                {leg.sectionTime > 0 && (
                  <span className="text-gray-400 dark:text-gray-500">
                    · {leg.sectionTime}분
                  </span>
                )}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-1.5 pl-1">
              {names.map((name, nameIdx) => (
                <TransportBadge
                  key={`${key}-${nameIdx}`}
                  type={leg.type === "subway" ? "subway" : "bus"}
                  lineName={name}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
