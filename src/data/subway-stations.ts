/**
 * 수도권 지하철 노선별 역 순서 데이터 및 방향 판별 함수
 *
 * 각 노선의 역을 상행 종점 → 하행 종점 순서로 저장하고,
 * startStation과 endStation의 위치를 비교하여 상행/하행(또는 외선/내선)을 판별합니다.
 */

export interface SubwayLineData {
  type: "linear" | "circular";
  /** API updnLine 값과 매칭되는 방향 라벨 */
  directions: {
    forward: string; // 인덱스 증가 방향 (예: "하행", "외선")
    backward: string; // 인덱스 감소 방향 (예: "상행", "내선")
  };
  /** 역 순서 (backward 종점 → forward 종점) */
  stations: string[];
  /** 분기 노선 */
  branches?: {
    branchPoint: string;
    stations: string[];
  }[];
}

// prettier-ignore
export const SUBWAY_LINES: Record<string, SubwayLineData> = {
  // ─────────────────────────────────────────
  // 1호선: 소요산 ↔ 인천 / 신창 / 서동탄 / 광명
  // 상행 = 소요산 방면, 하행 = 인천·신창 방면
  // ─────────────────────────────────────────
  "1001": {
    type: "linear",
    directions: { forward: "하행", backward: "상행" },
    stations: [
      // 연천 연장 구간
      "연천", "전곡",
      // 소요산 ~ 구로 (본선)
      "소요산", "동두천", "보산", "동두천중앙", "지행", "덕정", "덕계",
      "양주", "녹양", "가능", "의정부", "회룡", "망월사", "도봉산",
      "도봉", "방학", "창동", "녹천", "월계", "광운대", "석계",
      "신이문", "외대앞", "회기", "청량리", "제기동", "신설동", "동묘앞",
      "동대문", "종로5가", "종로3가", "종각", "시청", "서울역",
      "남영", "용산", "노량진", "대방", "신길", "영등포", "신도림", "구로",
    ],
    branches: [
      {
        // 경인선 (인천 방면)
        branchPoint: "구로",
        stations: [
          "구일", "개봉", "오류동", "온수", "역곡", "소사", "부천",
          "중동", "송내", "부개", "부평", "백운", "동암", "간석",
          "주안", "도화", "제물포", "도원", "동인천", "인천",
        ],
      },
      {
        // 경부선·장항선 (신창 방면)
        branchPoint: "구로",
        stations: [
          "가산디지털단지", "독산", "금천구청", "석수", "관악", "안양",
          "명학", "금정", "군포", "당정", "의왕", "성균관대", "화서",
          "수원", "세류", "병점", "세마", "오산대", "오산", "진위",
          "송탄", "서정리", "평택지제", "평택", "성환", "직산", "두정",
          "천안", "봉명", "쌍용", "아산", "배방", "온양온천", "신창",
        ],
      },
      {
        // 서동탄 지선
        branchPoint: "병점",
        stations: ["서동탄"],
      },
      {
        // 광명 셔틀
        branchPoint: "금천구청",
        stations: ["광명"],
      },
    ],
  },

  // ─────────────────────────────────────────
  // 2호선: 순환선 + 성수지선 + 신정지선
  // 외선 = 시계방향, 내선 = 반시계방향
  // ─────────────────────────────────────────
  "1002": {
    type: "circular",
    directions: { forward: "외선", backward: "내선" },
    stations: [
      // 외선(시계방향) 순서
      "시청", "을지로입구", "을지로3가", "을지로4가", "동대문역사문화공원",
      "신당", "상왕십리", "왕십리", "한양대", "뚝섬", "성수",
      "건대입구", "구의", "강변", "잠실나루", "잠실", "잠실새내",
      "종합운동장", "삼성", "선릉", "역삼", "강남", "교대", "서초",
      "방배", "사당", "낙성대", "서울대입구", "봉천", "신림", "신대방",
      "구로디지털단지", "대림", "신도림", "문래", "영등포구청", "당산",
      "합정", "홍대입구", "신촌", "이대", "아현", "충정로",
    ],
    branches: [
      {
        // 성수지선: 성수 → 신설동
        branchPoint: "성수",
        stations: ["용답", "신답", "용두", "신설동"],
      },
      {
        // 신정지선: 신도림 → 까치산
        branchPoint: "신도림",
        stations: ["도림천", "양천구청", "신정네거리", "까치산"],
      },
    ],
  },

  // ─────────────────────────────────────────
  // 3호선: 대화 ↔ 오금
  // 상행 = 대화 방면, 하행 = 오금 방면
  // ─────────────────────────────────────────
  "1003": {
    type: "linear",
    directions: { forward: "하행", backward: "상행" },
    stations: [
      "대화", "주엽", "정발산", "마두", "백석", "대곡", "화정", "원당",
      "원흥", "삼송", "지축", "구파발", "연신내", "불광", "녹번", "홍제",
      "무악재", "독립문", "경복궁", "안국", "종로3가", "을지로3가",
      "충무로", "동대입구", "약수", "금호", "옥수", "압구정", "신사",
      "잠원", "고속터미널", "교대", "남부터미널", "양재", "매봉", "도곡",
      "대치", "학여울", "대청", "일원", "수서", "가락시장", "경찰병원", "오금",
    ],
  },

  // ─────────────────────────────────────────
  // 4호선: 진접 ↔ 오이도
  // 상행 = 진접/당고개 방면, 하행 = 오이도 방면
  // ─────────────────────────────────────────
  "1004": {
    type: "linear",
    directions: { forward: "하행", backward: "상행" },
    stations: [
      // 진접 연장 구간
      "진접", "오남", "별내별가람",
      // 당고개 ~ 오이도
      "당고개", "상계", "노원", "창동", "쌍문", "수유", "미아",
      "미아사거리", "길음", "성신여대입구", "한성대입구", "혜화",
      "동대문", "동대문역사문화공원", "충무로", "명동", "회현", "서울역",
      "숙대입구", "삼각지", "신용산", "이촌", "동작", "총신대입구(이수)", "사당",
      "남태령", "선바위", "경마공원", "대공원", "과천", "정부과천청사",
      "인덕원", "평촌", "범계", "금정", "산본", "수리산", "대야미",
      "반월", "상록수", "한대앞", "중앙", "고잔", "초지", "안산",
      "신길온천", "정왕", "오이도",
    ],
  },

  // ─────────────────────────────────────────
  // 5호선: 방화 ↔ 하남검단산 (+ 마천지선)
  // 상행 = 방화 방면, 하행 = 하남검단산·마천 방면
  // ─────────────────────────────────────────
  "1005": {
    type: "linear",
    directions: { forward: "하행", backward: "상행" },
    stations: [
      "방화", "개화산", "김포공항", "송정", "마곡", "발산", "우장산",
      "화곡", "까치산", "신정", "목동", "오목교", "양평", "영등포구청",
      "영등포시장", "신길", "여의도", "여의나루", "마포", "공덕", "애오개",
      "충정로", "서대문", "광화문", "종로3가", "을지로4가",
      "동대문역사문화공원", "청구", "신금호", "행당", "왕십리", "마장",
      "답십리", "장한평", "군자", "아차산", "광나루", "천호", "강동",
      "길동", "굽은다리", "명일", "고덕", "상일동", "강일", "미사",
      "하남풍산", "하남시청", "하남검단산",
    ],
    branches: [
      {
        // 마천지선
        branchPoint: "강동",
        stations: ["둔촌동", "올림픽공원", "방이", "오금", "개롱", "거여", "마천"],
      },
    ],
  },

  // ─────────────────────────────────────────
  // 6호선: 응암순환 ↔ 신내
  // 상행 = 응암순환 방면, 하행 = 신내 방면
  // 응암 루프 구간: 역촌→불광→독바위→연신내→구산→응암
  // ─────────────────────────────────────────
  "1006": {
    type: "linear",
    directions: { forward: "하행", backward: "상행" },
    stations: [
      // 응암순환 구간 (상행 종점 방향)
      "역촌", "불광", "독바위", "연신내", "구산",
      // 응암 ~ 신내 (본선)
      "응암", "새절", "증산", "디지털미디어시티", "월드컵경기장",
      "마포구청", "망원", "합정", "상수", "광흥창", "대흥", "공덕",
      "효창공원앞", "삼각지", "녹사평", "이태원", "한강진", "버티고개",
      "약수", "청구", "신당", "동묘앞", "창신", "보문", "안암", "고려대",
      "월곡", "상월곡", "돌곶이", "석계", "태릉입구", "화랑대", "봉화산", "신내",
    ],
  },

  // ─────────────────────────────────────────
  // 7호선: 장암 ↔ 석남
  // 상행 = 장암 방면, 하행 = 석남 방면
  // ─────────────────────────────────────────
  "1007": {
    type: "linear",
    directions: { forward: "하행", backward: "상행" },
    stations: [
      "장암", "도봉산", "수락산", "마들", "노원", "중계", "하계",
      "공릉", "태릉입구", "먹골", "중화", "상봉", "면목", "사가정",
      "용마산", "중곡", "군자", "어린이대공원", "건대입구", "뚝섬유원지",
      "청담", "강남구청", "학동", "논현", "반포", "고속터미널", "내방",
      "이수", "남성", "숭실대입구", "상도", "장승배기", "신대방삼거리",
      "보라매", "신풍", "대림", "남구로", "가산디지털단지", "철산",
      "광명사거리", "천왕", "온수", "까치울", "부천종합운동장", "춘의",
      "신중동", "부천시청", "상동", "삼산체육관", "굴포천", "부평구청",
      "산곡", "석남",
    ],
  },

  // ─────────────────────────────────────────
  // 8호선: 암사 ↔ 모란
  // 상행 = 암사 방면, 하행 = 모란 방면
  // ─────────────────────────────────────────
  "1008": {
    type: "linear",
    directions: { forward: "하행", backward: "상행" },
    stations: [
      "암사", "천호", "강동구청", "몽촌토성", "잠실", "석촌",
      "송파", "가락시장", "문정", "장지", "복정", "산성", "남한산성입구",
      "단대오거리", "신흥", "수진", "모란",
    ],
  },

  // ─────────────────────────────────────────
  // 9호선: 개화 ↔ 중앙보훈병원
  // 상행 = 개화 방면, 하행 = 중앙보훈병원 방면
  // ─────────────────────────────────────────
  "1009": {
    type: "linear",
    directions: { forward: "하행", backward: "상행" },
    stations: [
      "개화", "김포공항", "공항시장", "신방화", "마곡나루", "양천향교",
      "가양", "증미", "등촌", "염창", "신목동", "선유도", "당산",
      "국회의사당", "여의도", "샛강", "노량진", "노들", "흑석", "동작",
      "구반포", "신반포", "고속터미널", "사평", "신논현", "언주",
      "선정릉", "삼성중앙", "봉은사", "종합운동장", "삼전", "석촌고분",
      "석촌", "송파나루", "한성백제", "올림픽공원", "둔촌오륜", "중앙보훈병원",
    ],
  },

  // ─────────────────────────────────────────
  // 경의중앙선: 문산 ↔ 지평
  // 상행 = 문산 방면, 하행 = 지평 방면
  // ─────────────────────────────────────────
  "1063": {
    type: "linear",
    directions: { forward: "하행", backward: "상행" },
    stations: [
      "문산", "파주", "월롱", "금촌", "금릉", "운정", "야당", "탄현",
      "일산", "풍산", "백마", "곡산", "대곡", "능곡", "행신", "강매",
      "화전", "수색", "디지털미디어시티", "가좌", "홍대입구", "서강대",
      "공덕", "효창공원앞", "용산", "이촌", "서빙고", "한남", "옥수",
      "응봉", "왕십리", "청량리", "회기", "중랑", "상봉", "망우",
      "양원", "구리", "도농", "양정", "덕소", "도심", "팔당",
      "운길산", "양수", "신원", "국수", "아신", "오빈", "양평",
      "원덕", "용문", "지평",
    ],
  },

  // ─────────────────────────────────────────
  // 공항철도: 서울역 ↔ 인천공항2터미널
  // 상행 = 서울역 방면, 하행 = 인천공항2터미널 방면
  // ─────────────────────────────────────────
  "1065": {
    type: "linear",
    directions: { forward: "하행", backward: "상행" },
    stations: [
      "서울역", "공덕", "홍대입구", "디지털미디어시티", "마곡나루",
      "김포공항", "계양", "검암", "청라국제도시", "영종", "운서",
      "공항화물청사", "인천공항1터미널", "인천공항2터미널",
    ],
  },

  // ─────────────────────────────────────────
  // 경춘선: 청량리 ↔ 춘천
  // 상행 = 청량리 방면, 하행 = 춘천 방면
  // ─────────────────────────────────────────
  "1067": {
    type: "linear",
    directions: { forward: "하행", backward: "상행" },
    stations: [
      "청량리", "회기", "중랑", "상봉", "망우", "신내", "갈매", "별내",
      "퇴계원", "사릉", "금곡", "평내호평", "천마산", "마석", "대성리",
      "청평", "상천", "가평", "굴봉산", "백양리", "강촌", "김유정",
      "남춘천", "춘천",
    ],
  },

  // ─────────────────────────────────────────
  // 수인분당선: 청량리 ↔ 인천
  // 상행 = 청량리 방면, 하행 = 인천 방면
  // ─────────────────────────────────────────
  "1075": {
    type: "linear",
    directions: { forward: "하행", backward: "상행" },
    stations: [
      "청량리", "왕십리", "서울숲", "압구정로데오", "강남구청", "선정릉",
      "선릉", "한티", "도곡", "구룡", "개포동", "대모산입구", "수서",
      "복정", "가천대", "태평", "모란", "야탑", "이매", "서현", "수내",
      "정자", "미금", "오리", "죽전", "보정", "구성", "신갈", "기흥",
      "상갈", "청명", "영통", "망포", "매탄권선", "수원시청", "매교",
      "수원", "고색", "오목천", "어천", "야목", "사리", "한대앞",
      "중앙", "고잔", "초지", "원인재", "연수", "송도", "인하대",
      "숭의", "신포", "인천",
    ],
  },

  // ─────────────────────────────────────────
  // 신분당선: 신사 ↔ 광교
  // 상행 = 신사 방면, 하행 = 광교 방면
  // ─────────────────────────────────────────
  "1077": {
    type: "linear",
    directions: { forward: "하행", backward: "상행" },
    stations: [
      "신사", "논현", "신논현", "강남", "양재", "양재시민의숲",
      "청계산입구", "판교", "정자", "미금", "동천", "수지구청",
      "성복", "상현", "광교중앙", "광교",
    ],
  },

  // ─────────────────────────────────────────
  // 우이신설경전철: 북한산우이 ↔ 신설동
  // 상행 = 북한산우이 방면, 하행 = 신설동 방면
  // ─────────────────────────────────────────
  "1092": {
    type: "linear",
    directions: { forward: "하행", backward: "상행" },
    stations: [
      "북한산우이", "솔밭공원", "4.19민주묘지", "가오리", "화계",
      "삼양", "삼양사거리", "솔샘", "북한산보국문", "정릉",
      "성신여대입구", "보문", "신설동",
    ],
  },

  // ─────────────────────────────────────────
  // 서해선: 소사 ↔ 원시
  // 상행 = 소사 방면, 하행 = 원시 방면
  // ─────────────────────────────────────────
  "1093": {
    type: "linear",
    directions: { forward: "하행", backward: "상행" },
    stations: [
      "소사", "소새울", "시흥대야", "신천", "신현", "시흥시청",
      "시흥능곡", "달미", "선부", "초지", "원곡", "원시",
    ],
  },

  // ─────────────────────────────────────────
  // 경강선: 판교 ↔ 여주
  // 상행 = 판교 방면, 하행 = 여주 방면
  // ─────────────────────────────────────────
  "1081": {
    type: "linear",
    directions: { forward: "하행", backward: "상행" },
    stations: [
      "판교", "이매", "삼동", "경기광주", "초월", "곤지암",
      "신둔도예촌", "이천", "부발", "세종대왕릉", "여주",
    ],
  },

  // ─────────────────────────────────────────
  // 신림선: 샛강 ↔ 관악산
  // 상행 = 샛강 방면, 하행 = 관악산 방면
  // ─────────────────────────────────────────
  "1094": {
    type: "linear",
    directions: { forward: "하행", backward: "상행" },
    stations: [
      "샛강", "대방", "서울지방병무청", "보라매", "보라매공원",
      "보라매병원", "당곡", "신림", "서원", "서울대벤처타운", "관악산",
    ],
  },

  // ─────────────────────────────────────────
  // GTX-A: 운정중앙 ↔ 동탄
  // 상행 = 운정중앙 방면, 하행 = 동탄 방면
  // ─────────────────────────────────────────
  "1032": {
    type: "linear",
    directions: { forward: "하행", backward: "상행" },
    stations: [
      "운정중앙", "킨텍스", "대곡", "연신내", "서울역",
      "삼성", "수서", "성남", "용인", "동탄",
    ],
  },
};

// ─────────────────────────────────────────
// 역 이름 정규화
// ─────────────────────────────────────────
export function normalizeStationName(name: string): string {
  return name
    .replace(/역$/, "") // "강남역" → "강남"
    .replace(/\s+/g, "") // 공백 제거
    .trim();
}

// ─────────────────────────────────────────
// 위치 맵 생성 (역 이름 → 위치 번호)
// ─────────────────────────────────────────
interface StationPosition {
  index: number;
  isMainLine: boolean;
  branchIndex?: number; // branches 배열 내 인덱스
}

function buildPositionMap(
  line: SubwayLineData
): Map<string, StationPosition> {
  const map = new Map<string, StationPosition>();

  // 본선 역
  for (let i = 0; i < line.stations.length; i++) {
    map.set(normalizeStationName(line.stations[i]), {
      index: i,
      isMainLine: true,
    });
  }

  // 분기 노선 역
  if (line.branches) {
    for (let b = 0; b < line.branches.length; b++) {
      const branch = line.branches[b];
      const branchPointName = normalizeStationName(branch.branchPoint);
      const bpPos = map.get(branchPointName);
      if (!bpPos) continue;

      for (let i = 0; i < branch.stations.length; i++) {
        const stName = normalizeStationName(branch.stations[i]);
        // 이미 본선에 존재하는 역은 건너뜀 (분기점 자체 등)
        if (map.has(stName)) continue;
        map.set(stName, {
          // 분기점 이후 위치: 본선 길이 + 분기 오프셋 + 분기 내 인덱스
          index: line.stations.length + b * 1000 + i,
          isMainLine: false,
          branchIndex: b,
        });
      }
    }
  }

  return map;
}

// 분기점의 본선 인덱스 조회
function getBranchPointMainIndex(
  line: SubwayLineData,
  branchIdx: number,
  posMap: Map<string, StationPosition>
): number | undefined {
  if (!line.branches || !line.branches[branchIdx]) return undefined;
  const bpName = normalizeStationName(line.branches[branchIdx].branchPoint);
  return posMap.get(bpName)?.index;
}

// ─────────────────────────────────────────
// 방향 판별 함수
// ─────────────────────────────────────────

/**
 * 지하철 노선의 역 순서를 기반으로 이동 방향을 판별합니다.
 *
 * @param subwayId - 노선 코드 (예: "1001")
 * @param startStation - 출발역 이름
 * @param endStation - 도착역 이름
 * @returns API updnLine 값 ("상행"|"하행"|"외선"|"내선") 또는 판별 불가 시 null
 */
export function determineSubwayDirection(
  subwayId: string,
  startStation: string,
  endStation: string
): string | null {
  const line = SUBWAY_LINES[subwayId];
  if (!line) return null;

  const posMap = buildPositionMap(line);

  const startName = normalizeStationName(startStation);
  const endName = normalizeStationName(endStation);

  const startPos = posMap.get(startName);
  const endPos = posMap.get(endName);

  if (!startPos || !endPos) return null;
  if (startPos.index === endPos.index) return null;

  // ─── 순환 노선 (2호선) ───
  if (line.type === "circular") {
    const mainLen = line.stations.length;

    // 둘 다 본선(순환구간)에 있는 경우: 최단 경로 방향 계산
    if (startPos.isMainLine && endPos.isMainLine) {
      const clockwise =
        (endPos.index - startPos.index + mainLen) % mainLen;
      const counterClockwise = mainLen - clockwise;
      // 시계방향(외선)이 짧거나 같으면 외선, 아니면 내선
      return clockwise <= counterClockwise
        ? line.directions.forward
        : line.directions.backward;
    }

    // 하나 이상이 지선에 있는 경우: 지선의 분기점을 기준으로 판별
    // 지선은 본선에서 분기되므로, 분기점과의 관계로 방향 결정
    const getEffectiveMainIndex = (pos: StationPosition): number | null => {
      if (pos.isMainLine) return pos.index;
      if (pos.branchIndex !== undefined) {
        return (
          getBranchPointMainIndex(line, pos.branchIndex, posMap) ?? null
        );
      }
      return null;
    };

    const startMainIdx = getEffectiveMainIndex(startPos);
    const endMainIdx = getEffectiveMainIndex(endPos);

    if (startMainIdx === null || endMainIdx === null) return null;

    // 같은 지선 내 이동
    if (
      !startPos.isMainLine &&
      !endPos.isMainLine &&
      startPos.branchIndex === endPos.branchIndex
    ) {
      // 분기점에서 멀어지는 방향 = forward, 가까워지는 방향 = backward
      return endPos.index > startPos.index
        ? line.directions.forward
        : line.directions.backward;
    }

    // 본선-지선 간 이동 or 다른 지선 간 이동: 본선 인덱스로 방향 결정
    if (startMainIdx === endMainIdx) {
      // 같은 분기점: 본선→지선이면 forward, 지선→본선이면 backward
      return !startPos.isMainLine
        ? line.directions.backward
        : line.directions.forward;
    }

    const cw = (endMainIdx - startMainIdx + mainLen) % mainLen;
    const ccw = mainLen - cw;
    return cw <= ccw ? line.directions.forward : line.directions.backward;
  }

  // ─── 직선 노선 ───

  // 둘 다 본선
  if (startPos.isMainLine && endPos.isMainLine) {
    return endPos.index > startPos.index
      ? line.directions.forward
      : line.directions.backward;
  }

  // 하나 이상이 지선에 있는 경우: 분기점의 본선 위치를 대리로 사용
  const getEffectiveIndex = (pos: StationPosition): number => {
    if (pos.isMainLine) return pos.index;
    // 지선 역: 분기점 인덱스 + 1 (분기는 항상 forward 방향으로 확장)
    if (pos.branchIndex !== undefined) {
      const bpIdx = getBranchPointMainIndex(line, pos.branchIndex, posMap);
      if (bpIdx !== undefined) return bpIdx + 1;
    }
    return pos.index;
  };

  // 같은 지선 내 이동
  if (
    !startPos.isMainLine &&
    !endPos.isMainLine &&
    startPos.branchIndex === endPos.branchIndex
  ) {
    return endPos.index > startPos.index
      ? line.directions.forward
      : line.directions.backward;
  }

  const effectiveStart = getEffectiveIndex(startPos);
  const effectiveEnd = getEffectiveIndex(endPos);

  if (effectiveEnd > effectiveStart) return line.directions.forward;
  if (effectiveEnd < effectiveStart) return line.directions.backward;

  // effectiveIndex가 같은 경우 (본선역과 인접 지선역)
  // 본선→지선 = forward, 지선→본선 = backward
  if (startPos.isMainLine && !endPos.isMainLine) {
    return line.directions.forward;
  }
  if (!startPos.isMainLine && endPos.isMainLine) {
    return line.directions.backward;
  }

  return null;
}
