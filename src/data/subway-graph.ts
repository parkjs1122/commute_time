/**
 * 지하철 노선 그래프 및 BFS 기반 열차 경유 판별
 *
 * SUBWAY_LINES 데이터로 노선별 인접 리스트 그래프를 구축하고,
 * BFS로 열차가 사용자의 목적지를 실제로 경유하는지 검증합니다.
 */

import {
  SUBWAY_LINES,
  type SubwayLineData,
  normalizeStationName,
} from "./subway-stations";

// ---------------------------------------------------------------------------
// 그래프 자료구조
// ---------------------------------------------------------------------------

type StationNode = string; // 정규화된 역 이름

interface SubwayGraph {
  adjacency: Map<StationNode, Set<StationNode>>;
  stations: Set<StationNode>;
}

// ---------------------------------------------------------------------------
// 그래프 구축
// ---------------------------------------------------------------------------

function buildLineGraph(line: SubwayLineData): SubwayGraph {
  const adjacency = new Map<StationNode, Set<StationNode>>();
  const allStations = new Set<StationNode>();

  const ensureNode = (name: string): StationNode => {
    const normalized = normalizeStationName(name);
    allStations.add(normalized);
    if (!adjacency.has(normalized)) {
      adjacency.set(normalized, new Set());
    }
    return normalized;
  };

  const addEdge = (a: string, b: string) => {
    const na = ensureNode(a);
    const nb = ensureNode(b);
    adjacency.get(na)!.add(nb);
    adjacency.get(nb)!.add(na);
  };

  // 본선 역 연결
  for (let i = 0; i < line.stations.length - 1; i++) {
    addEdge(line.stations[i], line.stations[i + 1]);
  }

  // 순환선: 마지막 역 → 첫 역 연결
  if (line.type === "circular" && line.stations.length > 1) {
    addEdge(line.stations[line.stations.length - 1], line.stations[0]);
  }

  // 분기선 연결
  if (line.branches) {
    for (const branch of line.branches) {
      addEdge(branch.branchPoint, branch.stations[0]);
      for (let i = 0; i < branch.stations.length - 1; i++) {
        addEdge(branch.stations[i], branch.stations[i + 1]);
      }
    }
  }

  return { adjacency, stations: allStations };
}

// ---------------------------------------------------------------------------
// 싱글턴 캐시
// ---------------------------------------------------------------------------

let graphCache: Map<string, SubwayGraph> | null = null;

function getAllGraphs(): Map<string, SubwayGraph> {
  if (!graphCache) {
    graphCache = new Map();
    for (const [lineId, lineData] of Object.entries(SUBWAY_LINES)) {
      graphCache.set(lineId, buildLineGraph(lineData));
    }
  }
  return graphCache;
}

function getLineGraph(lineId: string): SubwayGraph | null {
  return getAllGraphs().get(lineId) ?? null;
}

// ---------------------------------------------------------------------------
// BFS 경로 탐색
// ---------------------------------------------------------------------------

function findPath(
  graph: SubwayGraph,
  from: StationNode,
  to: StationNode
): StationNode[] | null {
  if (from === to) return [from];
  if (!graph.adjacency.has(from) || !graph.adjacency.has(to)) return null;

  const visited = new Set<StationNode>([from]);
  const parent = new Map<StationNode, StationNode>();
  const queue: StationNode[] = [from];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const neighbor of graph.adjacency.get(current)!) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      parent.set(neighbor, current);

      if (neighbor === to) {
        // 경로 역추적
        const path: StationNode[] = [];
        let node: StationNode | undefined = to;
        while (node !== undefined) {
          path.unshift(node);
          node = parent.get(node);
        }
        return path;
      }

      queue.push(neighbor);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// 순환선 방향별 경로 탐색
// ---------------------------------------------------------------------------

/**
 * 순환선(2호선)에서 지정된 방향으로 본선 역을 순회하여 경로를 생성합니다.
 * 분기선 역이 포함된 경우, 분기점까지의 본선 경로 + 분기 경로를 조합합니다.
 */
function getDirectedCircularPath(
  line: SubwayLineData,
  start: StationNode,
  terminal: StationNode,
  direction: string
): StationNode[] | null {
  const normalizedMain = line.stations.map(normalizeStationName);
  const mainLen = normalizedMain.length;
  const isForward = direction === line.directions.forward;

  // 본선에서의 인덱스 찾기
  const startMainIdx = normalizedMain.indexOf(start);
  const terminalMainIdx = normalizedMain.indexOf(terminal);

  // 분기선 역인지 확인하고, 해당 분기 정보 반환
  const findBranchInfo = (
    station: StationNode
  ): { branchIdx: number; stationIdx: number; branchPoint: StationNode } | null => {
    if (!line.branches) return null;
    for (let b = 0; b < line.branches.length; b++) {
      const branch = line.branches[b];
      const normalizedBranch = branch.stations.map(normalizeStationName);
      const idx = normalizedBranch.indexOf(station);
      if (idx !== -1) {
        return {
          branchIdx: b,
          stationIdx: idx,
          branchPoint: normalizeStationName(branch.branchPoint),
        };
      }
    }
    return null;
  };

  // 본선 위에서 방향대로 순회
  const walkMainLine = (
    fromIdx: number,
    toIdx: number
  ): StationNode[] => {
    const path: StationNode[] = [];
    let idx = fromIdx;
    const maxSteps = mainLen + 1;
    let steps = 0;

    while (steps <= maxSteps) {
      path.push(normalizedMain[idx]);
      if (idx === toIdx && path.length > 1) break;
      if (isForward) {
        idx = (idx + 1) % mainLen;
      } else {
        idx = (idx - 1 + mainLen) % mainLen;
      }
      steps++;
    }

    return path;
  };

  // 분기선 내 경로 (분기점 제외, 분기 역만)
  const getBranchPath = (
    branchIdx: number,
    upToStationIdx: number
  ): StationNode[] => {
    const branch = line.branches![branchIdx];
    return branch.stations
      .slice(0, upToStationIdx + 1)
      .map(normalizeStationName);
  };

  const startBranch = startMainIdx === -1 ? findBranchInfo(start) : null;
  const terminalBranch =
    terminalMainIdx === -1 ? findBranchInfo(terminal) : null;

  // Case 1: 둘 다 본선
  if (startMainIdx !== -1 && terminalMainIdx !== -1) {
    return walkMainLine(startMainIdx, terminalMainIdx);
  }

  // Case 2: 출발역이 본선, 종착역이 분기선
  if (startMainIdx !== -1 && terminalBranch) {
    const bpMainIdx = normalizedMain.indexOf(terminalBranch.branchPoint);
    if (bpMainIdx === -1) return null;

    const mainPath = walkMainLine(startMainIdx, bpMainIdx);
    const branchPath = getBranchPath(
      terminalBranch.branchIdx,
      terminalBranch.stationIdx
    );
    return [...mainPath, ...branchPath];
  }

  // Case 3: 출발역이 분기선, 종착역이 본선
  if (startBranch && terminalMainIdx !== -1) {
    const bpMainIdx = normalizedMain.indexOf(startBranch.branchPoint);
    if (bpMainIdx === -1) return null;

    // 분기역에서 분기점까지 역순
    const branch = line.branches![startBranch.branchIdx];
    const reverseBranch = branch.stations
      .slice(0, startBranch.stationIdx + 1)
      .map(normalizeStationName)
      .reverse();

    const mainPath = walkMainLine(bpMainIdx, terminalMainIdx);
    // reverseBranch의 마지막은 분기점이 아니므로, 분기점 포함하여 연결
    return [...reverseBranch, ...mainPath];
  }

  // Case 4: 둘 다 분기선
  if (startBranch && terminalBranch) {
    if (startBranch.branchIdx === terminalBranch.branchIdx) {
      // 같은 분기선 내
      const branch = line.branches![startBranch.branchIdx];
      const stations = branch.stations.map(normalizeStationName);
      if (startBranch.stationIdx <= terminalBranch.stationIdx) {
        return stations.slice(
          startBranch.stationIdx,
          terminalBranch.stationIdx + 1
        );
      }
      return stations
        .slice(terminalBranch.stationIdx, startBranch.stationIdx + 1)
        .reverse();
    }

    // 다른 분기선: 출발 분기 → 본선 → 도착 분기
    const startBp = normalizedMain.indexOf(startBranch.branchPoint);
    const terminalBp = normalizedMain.indexOf(terminalBranch.branchPoint);
    if (startBp === -1 || terminalBp === -1) return null;

    const branch1 = line.branches![startBranch.branchIdx];
    const reverseBranch1 = branch1.stations
      .slice(0, startBranch.stationIdx + 1)
      .map(normalizeStationName)
      .reverse();

    const mainPath = walkMainLine(startBp, terminalBp);
    const branchPath2 = getBranchPath(
      terminalBranch.branchIdx,
      terminalBranch.stationIdx
    );

    return [...reverseBranch1, ...mainPath, ...branchPath2];
  }

  return null;
}

// ---------------------------------------------------------------------------
// 공개 API
// ---------------------------------------------------------------------------

/**
 * 열차(종착역 기준)가 사용자의 목적지를 경유하는지 BFS로 검증합니다.
 *
 * @param lineId - 노선 코드 (예: "1002")
 * @param startStation - 승차역
 * @param destStation - 하차역 (사용자 목적지)
 * @param trainTerminal - 열차 종착역 (API bstatnNm)
 * @param direction - updnLine 값 (순환선 방향 판별용)
 * @returns 열차가 목적지를 경유하면 true
 */
export function willTrainReachStation(
  lineId: string,
  startStation: string,
  destStation: string,
  trainTerminal: string,
  direction?: string
): boolean {
  const graph = getLineGraph(lineId);
  if (!graph) return false;

  const line = SUBWAY_LINES[lineId];
  if (!line) return false;

  const start = normalizeStationName(startStation);
  const dest = normalizeStationName(destStation);
  const terminal = normalizeStationName(trainTerminal);

  if (!graph.stations.has(start) || !graph.stations.has(dest)) return false;
  if (!graph.stations.has(terminal)) return false;
  if (start === dest) return true;

  // 종착역이 목적지와 동일: 출발역에서 도달 가능한지만 확인
  if (dest === terminal) {
    return findPath(graph, start, dest) !== null;
  }

  // 순환선(2호선): 방향 정보를 활용한 경로 탐색
  if (line.type === "circular" && direction) {
    const trainPath = getDirectedCircularPath(line, start, terminal, direction);
    if (!trainPath) return false;
    return trainPath.includes(dest);
  }

  // 직선 노선 (분기 포함): BFS로 start → terminal 경로를 찾고 dest 포함 여부 확인
  const pathToTerminal = findPath(graph, start, terminal);
  if (!pathToTerminal) return false;
  return pathToTerminal.includes(dest);
}

/**
 * 해당 노선의 그래프에 역이 존재하는지 확인합니다.
 */
export function isStationKnown(
  lineId: string,
  stationName: string
): boolean {
  const graph = getLineGraph(lineId);
  return graph?.stations.has(normalizeStationName(stationName)) ?? false;
}
