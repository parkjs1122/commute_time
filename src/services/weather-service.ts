/**
 * Weather service using Open-Meteo API (free, no API key required)
 * https://open-meteo.com/
 */

export interface WeatherData {
  temperature: number; // 현재 기온 (°C)
  weatherCode: number; // WMO weather code
  description: string; // 한글 날씨 설명
  isRainy: boolean;    // 비/눈 여부
  icon: string;        // 날씨 아이콘 키
}

// WMO Weather Codes → Korean description + icon
const WEATHER_CODES: Record<number, { description: string; icon: string; rainy: boolean }> = {
  0: { description: "맑음", icon: "sunny", rainy: false },
  1: { description: "대체로 맑음", icon: "partly_cloudy", rainy: false },
  2: { description: "구름 약간", icon: "partly_cloudy", rainy: false },
  3: { description: "흐림", icon: "cloudy", rainy: false },
  45: { description: "안개", icon: "foggy", rainy: false },
  48: { description: "짙은 안개", icon: "foggy", rainy: false },
  51: { description: "가벼운 이슬비", icon: "drizzle", rainy: true },
  53: { description: "이슬비", icon: "drizzle", rainy: true },
  55: { description: "짙은 이슬비", icon: "drizzle", rainy: true },
  61: { description: "약한 비", icon: "rainy", rainy: true },
  63: { description: "비", icon: "rainy", rainy: true },
  65: { description: "강한 비", icon: "heavy_rain", rainy: true },
  66: { description: "빗방울(빙결)", icon: "rainy", rainy: true },
  67: { description: "강한 빗방울(빙결)", icon: "heavy_rain", rainy: true },
  71: { description: "약한 눈", icon: "snowy", rainy: true },
  73: { description: "눈", icon: "snowy", rainy: true },
  75: { description: "강한 눈", icon: "snowy", rainy: true },
  77: { description: "싸락눈", icon: "snowy", rainy: true },
  80: { description: "소나기", icon: "rainy", rainy: true },
  81: { description: "소나기", icon: "rainy", rainy: true },
  82: { description: "강한 소나기", icon: "heavy_rain", rainy: true },
  85: { description: "약한 눈보라", icon: "snowy", rainy: true },
  86: { description: "눈보라", icon: "snowy", rainy: true },
  95: { description: "뇌우", icon: "thunderstorm", rainy: true },
  96: { description: "뇌우+우박", icon: "thunderstorm", rainy: true },
  99: { description: "강한 뇌우+우박", icon: "thunderstorm", rainy: true },
};

// In-memory cache (1 hour TTL)
let weatherCache: { data: WeatherData; expiresAt: number } | null = null;

// Default coordinates: Seoul (Gwanghwamun)
const DEFAULT_LAT = 37.5759;
const DEFAULT_LNG = 126.9769;

export async function getWeather(
  lat: number = DEFAULT_LAT,
  lng: number = DEFAULT_LNG
): Promise<WeatherData | null> {
  // Check cache
  if (weatherCache && Date.now() < weatherCache.expiresAt) {
    return weatherCache.data;
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=Asia/Seoul`;
    const response = await fetch(url, { next: { revalidate: 3600 } });

    if (!response.ok) return null;

    const json = await response.json();
    const current = json.current;

    if (!current) return null;

    const code = current.weather_code as number;
    const info = WEATHER_CODES[code] ?? { description: "알 수 없음", icon: "unknown", rainy: false };

    const data: WeatherData = {
      temperature: Math.round(current.temperature_2m),
      weatherCode: code,
      description: info.description,
      isRainy: info.rainy,
      icon: info.icon,
    };

    // Cache for 1 hour
    weatherCache = { data, expiresAt: Date.now() + 60 * 60 * 1000 };

    return data;
  } catch (error) {
    console.error("[WeatherService] Error:", error);
    return null;
  }
}
