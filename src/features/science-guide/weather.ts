interface OpenWeatherCondition {
  main: string
  description: string
  icon: string
}

interface OpenWeatherCurrentResponse {
  weather?: OpenWeatherCondition[]
  main?: {
    temp?: number
  }
  wind?: {
    speed?: number
  }
  rain?: {
    '1h'?: number
    '3h'?: number
  }
  snow?: {
    '1h'?: number
    '3h'?: number
  }
}

interface OpenWeatherForecastItem {
  dt: number
  pop?: number
  weather?: OpenWeatherCondition[]
  wind?: {
    speed?: number
  }
  rain?: {
    '3h'?: number
  }
  snow?: {
    '3h'?: number
  }
}

interface OpenWeatherForecastResponse {
  list?: OpenWeatherForecastItem[]
}

interface OpenWeatherUvResponse {
  value?: number
}

export interface WeatherOverview {
  temperatureC: number
  description: string
  iconUrl: string | null
  windSpeedMs: number
  uvIndex: number | null
  warnings: string[]
  sourcePointName: string
}

const OPENWEATHER_API_KEY =
  String(import.meta.env.VITE_OPENWEATHER_API_KEY ?? '').trim()

function normalizeDescription(description: string): string {
  if (!description) {
    return 'Без описания'
  }

  return description.charAt(0).toUpperCase() + description.slice(1)
}

function hasRecentPrecipitation(current: OpenWeatherCurrentResponse): boolean {
  const rain1h = current.rain?.['1h'] ?? current.rain?.['3h'] ?? 0
  const snow1h = current.snow?.['1h'] ?? current.snow?.['3h'] ?? 0
  const weatherMain = current.weather?.[0]?.main ?? ''

  return rain1h > 0 || snow1h > 0 || /rain|drizzle|thunderstorm|snow/i.test(weatherMain)
}

function hasFutureRain(forecastItems: OpenWeatherForecastItem[]): boolean {
  return forecastItems.some((item) => {
    const precipitationAmount = (item.rain?.['3h'] ?? 0) + (item.snow?.['3h'] ?? 0)
    const precipitationProbability = item.pop ?? 0

    return precipitationAmount > 0 || precipitationProbability >= 0.45
  })
}

function hasFutureStrongWind(forecastItems: OpenWeatherForecastItem[]): boolean {
  return forecastItems.some((item) => (item.wind?.speed ?? 0) >= 8)
}

function hasHighUv(uvIndex: number | null): boolean {
  return uvIndex !== null && uvIndex >= 6
}

async function fetchJson<T>(url: URL, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal })
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('OpenWeather API key отклонен (401). Проверьте ключ и тариф.')
    }

    throw new Error(`Не удалось получить погоду: HTTP ${response.status}`)
  }

  return (await response.json()) as T
}

async function fetchUvIndex(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<number | null> {
  const uvUrl = new URL('https://api.openweathermap.org/data/2.5/uvi')
  uvUrl.searchParams.set('lat', String(lat))
  uvUrl.searchParams.set('lon', String(lon))
  uvUrl.searchParams.set('appid', OPENWEATHER_API_KEY)

  try {
    const payload = await fetchJson<OpenWeatherUvResponse>(uvUrl, signal)
    return typeof payload.value === 'number' ? payload.value : null
  } catch {
    // UV endpoint is optional in free setups; do not fail whole popup.
    return null
  }
}

export async function fetchWeatherOverview(
  lat: number,
  lon: number,
  sourcePointName: string,
  signal?: AbortSignal,
): Promise<WeatherOverview> {
  if (!OPENWEATHER_API_KEY) {
    throw new Error('Не найден VITE_OPENWEATHER_API_KEY в .env (перезапустите dev-сервер после изменения .env)')
  }

  const weatherUrl = new URL('https://api.openweathermap.org/data/2.5/weather')
  weatherUrl.searchParams.set('lat', String(lat))
  weatherUrl.searchParams.set('lon', String(lon))
  weatherUrl.searchParams.set('units', 'metric')
  weatherUrl.searchParams.set('lang', 'ru')
  weatherUrl.searchParams.set('appid', OPENWEATHER_API_KEY)

  const forecastUrl = new URL('https://api.openweathermap.org/data/2.5/forecast')
  forecastUrl.searchParams.set('lat', String(lat))
  forecastUrl.searchParams.set('lon', String(lon))
  forecastUrl.searchParams.set('units', 'metric')
  forecastUrl.searchParams.set('lang', 'ru')
  forecastUrl.searchParams.set('appid', OPENWEATHER_API_KEY)

  const [currentPayload, forecastPayload, uvIndex] = await Promise.all([
    fetchJson<OpenWeatherCurrentResponse>(weatherUrl, signal),
    fetchJson<OpenWeatherForecastResponse>(forecastUrl, signal),
    fetchUvIndex(lat, lon, signal),
  ])

  const currentWeather = currentPayload.weather?.[0]
  if (!currentWeather || typeof currentPayload.main?.temp !== 'number') {
    throw new Error('OpenWeather вернул неполные данные')
  }

  const upcomingItems = (forecastPayload.list ?? []).slice(0, 4)
  const warnings: string[] = []

  if (hasRecentPrecipitation(currentPayload)) {
    warnings.push('Недавние осадки: тропа может быть скользкой.')
  }

  if (hasFutureRain(upcomingItems)) {
    warnings.push('Ожидаются осадки в ближайшие часы.')
  }

  if (hasFutureStrongWind(upcomingItems)) {
    warnings.push('Ожидается усиление ветра, планируйте маршрут осторожнее.')
  }

  if (hasHighUv(uvIndex)) {
    warnings.push('Повышенный УФ-индекс: возьмите защиту от солнца.')
  }

  return {
    temperatureC: currentPayload.main.temp,
    description: normalizeDescription(currentWeather.description),
    iconUrl: currentWeather.icon
      ? `https://openweathermap.org/img/wn/${currentWeather.icon}@2x.png`
      : null,
    windSpeedMs: currentPayload.wind?.speed ?? 0,
    uvIndex,
    warnings,
    sourcePointName,
  }
}
