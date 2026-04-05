import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import {
  Circle,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
} from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

import { lectures, sciencePoints, sciencePointsById } from '#/features/science-guide/data'
import {
  buildLectureRoute,
  buildMaxPointsDistanceRoute,
  buildUserRoute,
} from '#/features/science-guide/routing'
import type { BuiltRoute, ScenarioType, SciencePoint } from '#/features/science-guide/types'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const [activeScenario, setActiveScenario] = useState<ScenarioType>('lecture')
  const [selectedLectureId, setSelectedLectureId] = useState<number>(lectures[0]?.id ?? 1)
  const [selectedPointIds, setSelectedPointIds] = useState<number[]>([])
  const [selectedPointId, setSelectedPointId] = useState<number | null>(null)
  const [hoveredPointId, setHoveredPointId] = useState<number | null>(null)
  const [distanceLimitKm, setDistanceLimitKm] = useState<number>(4)
  const [routeResult, setRouteResult] = useState<BuiltRoute | null>(null)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [isRouting, setIsRouting] = useState(false)

  const selectedPoint =
    (selectedPointId ? sciencePointsById.get(selectedPointId) : undefined) ?? null

  const basketPoints = useMemo(
    () => selectedPointIds.map((id) => sciencePointsById.get(id)).filter(Boolean) as SciencePoint[],
    [selectedPointIds],
  )

  const routeWaypointSet = useMemo(
    () => new Set(routeResult?.waypointIds ?? []),
    [routeResult?.waypointIds],
  )

  const visibleSidebarPoints = useMemo(() => {
    if (activeScenario === 'lecture') {
      const lecture = lectures.find((item) => item.id === selectedLectureId)
      if (!lecture) {
        return []
      }

      return lecture.includedPoints
        .map((id) => sciencePointsById.get(id))
        .filter((point): point is SciencePoint => Boolean(point))
    }

    if (selectedPointIds.length > 0) {
      return selectedPointIds
        .map((id) => sciencePointsById.get(id))
        .filter((point): point is SciencePoint => Boolean(point))
    }

    return sciencePoints
  }, [activeScenario, selectedLectureId, selectedPointIds])

  async function handleBuildRoute() {
    setIsRouting(true)
    setRouteError(null)

    try {
      const result =
        activeScenario === 'lecture'
          ? await buildLectureRoute(selectedLectureId)
          : activeScenario === 'user-route'
            ? await buildUserRoute(selectedPointIds[0] ?? 0, selectedPointIds[1] ?? 0)
            : await buildMaxPointsDistanceRoute({
                maxDistanceMeters: distanceLimitKm * 1000,
                candidatePointIds:
                  selectedPointIds.length > 0
                    ? selectedPointIds
                    : sciencePoints.map((point) => point.id),
                startPointId: selectedPointIds[0],
              })

      setRouteResult(result)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Route build failed'
      setRouteError(message)
      setRouteResult(null)
    } finally {
      setIsRouting(false)
    }
  }

  function togglePointInBasket(pointId: number) {
    setSelectedPointIds((current) => {
      if (current.includes(pointId)) {
        return current.filter((id) => id !== pointId)
      }

      return [...current, pointId]
    })
    setSelectedPointId(pointId)
  }

  const summaryDistanceKm = ((routeResult?.metrics.distanceMeters ?? 0) / 1000).toFixed(2)
  const summaryDurationMin = Math.round((routeResult?.metrics.durationSeconds ?? 0) / 60)

  return (
    <main className="planner-root px-3 pb-6 pt-5 sm:px-4 sm:pb-8">
      <section className="planner-grid gap-4">
        <aside className="island-shell rise-in planner-sidebar rounded-3xl p-4 sm:p-5">
          <section>
            <p className="island-kicker mb-2">Сценарий</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
              {[
                ['lecture', 'Лекция'],
                ['user-route', 'Пользовательский маршрут'],
                ['distance-max', 'Маршрут по дистанции'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setActiveScenario(value as ScenarioType)}
                  className={`rounded-xl border px-3 py-2 text-left text-sm font-semibold ${
                    activeScenario === value
                      ? 'border-[rgba(40,142,146,0.58)] bg-[rgba(79,184,178,0.19)] text-[var(--sea-ink)]'
                      : 'border-[var(--line)] bg-white/45 text-[var(--sea-ink-soft)] hover:bg-white/72'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="mt-5">
            <p className="island-kicker mb-2">Лекции</p>
            <div className="space-y-2">
              {lectures.map((lecture) => {
                const isActive = lecture.id === selectedLectureId
                return (
                  <button
                    key={lecture.id}
                    type="button"
                    onClick={() => setSelectedLectureId(lecture.id)}
                    className={`w-full rounded-xl border p-3 text-left ${
                      isActive
                        ? 'border-[rgba(40,142,146,0.58)] bg-[rgba(79,184,178,0.17)]'
                        : 'border-[var(--line)] bg-white/50 hover:bg-white/72'
                    }`}
                  >
                    <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">{lecture.title}</p>
                    <p className="mt-1 text-xs text-[var(--sea-ink-soft)]">{lecture.description}</p>
                  </button>
                )
              })}
            </div>
          </section>

          <section className="mt-5">
            <div className="mb-2 flex items-center justify-between">
              <p className="island-kicker m-0">Корзина точек</p>
              <button
                type="button"
                onClick={() => setSelectedPointIds([])}
                className="rounded-lg border border-[var(--line)] bg-white/55 px-2 py-1 text-xs font-semibold text-[var(--sea-ink-soft)] hover:bg-white/78"
              >
                Очистить
              </button>
            </div>

            <div className="max-h-44 space-y-2 overflow-auto pr-1">
              {basketPoints.length === 0 ? (
                <p className="m-0 rounded-xl border border-dashed border-[var(--line)] bg-white/35 px-3 py-2 text-xs text-[var(--sea-ink-soft)]">
                  Нажмите на точки на карте, чтобы добавить их в корзину.
                </p>
              ) : (
                basketPoints.map((point) => (
                  <div
                    key={point.id}
                    className={`rounded-xl border px-3 py-2 ${
                      hoveredPointId === point.id
                        ? 'border-[rgba(40,142,146,0.58)] bg-[rgba(79,184,178,0.16)]'
                        : 'border-[var(--line)] bg-white/45'
                    }`}
                    onMouseEnter={() => setHoveredPointId(point.id)}
                    onMouseLeave={() => setHoveredPointId(null)}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedPointId(point.id)}
                      className="w-full text-left text-sm font-semibold text-[var(--sea-ink)]"
                    >
                      {point.name}
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="mt-5">
            <p className="island-kicker mb-2">Список точек</p>
            <div className="max-h-52 space-y-2 overflow-auto pr-1">
              {visibleSidebarPoints.map((point) => (
                <div
                  key={`visible-${point.id}`}
                  className={`rounded-xl border px-3 py-2 ${
                    hoveredPointId === point.id
                      ? 'border-[rgba(40,142,146,0.58)] bg-[rgba(79,184,178,0.16)]'
                      : 'border-[var(--line)] bg-white/45'
                  }`}
                  onMouseEnter={() => setHoveredPointId(point.id)}
                  onMouseLeave={() => setHoveredPointId(null)}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedPointId(point.id)}
                    className="w-full text-left text-sm font-semibold text-[var(--sea-ink)]"
                  >
                    {point.name}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {activeScenario === 'distance-max' ? (
            <section className="mt-5">
              <p className="island-kicker mb-2">Лимит дистанции</p>
              <label className="block">
                <span className="text-xs text-[var(--sea-ink-soft)]">км</span>
                <input
                  value={distanceLimitKm}
                  min={0.5}
                  step={0.5}
                  onChange={(event) => setDistanceLimitKm(Number(event.target.value))}
                  type="number"
                  className="mt-1 w-full rounded-xl border border-[var(--line)] bg-white/65 px-3 py-2 text-sm text-[var(--sea-ink)] outline-none focus:border-[rgba(40,142,146,0.58)]"
                />
              </label>
            </section>
          ) : null}

          <section className="mt-5 rounded-2xl border border-[var(--line)] bg-white/50 p-3">
            <p className="island-kicker mb-2">Сводка маршрута</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="m-0 text-xs text-[var(--sea-ink-soft)]">Длина</p>
                <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">{summaryDistanceKm} км</p>
              </div>
              <div>
                <p className="m-0 text-xs text-[var(--sea-ink-soft)]">Время</p>
                <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">{summaryDurationMin} мин</p>
              </div>
              <div>
                <p className="m-0 text-xs text-[var(--sea-ink-soft)]">Точки</p>
                <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">{routeResult?.waypointIds.length ?? 0}</p>
              </div>
            </div>
            <button
              type="button"
              disabled={isRouting}
              onClick={handleBuildRoute}
              className="mt-3 w-full rounded-xl border border-[rgba(40,142,146,0.58)] bg-[rgba(79,184,178,0.19)] px-3 py-2 text-sm font-semibold text-[var(--sea-ink)] hover:bg-[rgba(79,184,178,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRouting ? 'Построение...' : 'Построить маршрут'}
            </button>
            {routeError ? (
              <p className="mt-2 text-xs font-semibold text-[#ba4d4d]">{routeError}</p>
            ) : null}
          </section>

          <section className="mt-5 rounded-2xl border border-[var(--line)] bg-white/55 p-3">
            <p className="island-kicker mb-2">Выбранная точка</p>
            {selectedPoint ? (
              <>
                <div className="h-28 rounded-xl border border-[var(--line)] bg-[linear-gradient(130deg,rgba(79,184,178,0.18),rgba(47,106,74,0.1))]" />
                <p className="mt-3 mb-1 text-sm font-semibold text-[var(--sea-ink)]">{selectedPoint.name}</p>
                <p className="m-0 text-xs text-[var(--sea-ink-soft)]">{selectedPoint.description}</p>
              </>
            ) : (
              <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
                Выберите точку на карте или в корзине, чтобы увидеть описание.
              </p>
            )}
          </section>
        </aside>

        <section className="island-shell rise-in rounded-3xl p-2 sm:p-3">
          <MapContainer
            bounds={[
              [55.741, 48.697],
              [55.785, 48.768],
            ]}
            className="planner-map rounded-[1.15rem]"
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

            {sciencePoints.map((point) => {
              const isHovered = hoveredPointId === point.id
              const isSelected = selectedPointId === point.id
              const inBasket = selectedPointIds.includes(point.id)
              const inRoute = routeWaypointSet.has(point.id)

              return (
                <Circle
                  key={point.id}
                  center={[point.lat, point.lon]}
                  pathOptions={{
                    color: isSelected
                      ? '#15555b'
                      : isHovered
                        ? '#1b8f95'
                        : inRoute
                          ? '#2a7f55'
                          : '#3d7378',
                    fillColor: inBasket ? '#7ed3bf' : '#f6fbf7',
                    fillOpacity: inBasket ? 0.9 : 0.72,
                    weight: isHovered || isSelected ? 3 : 2,
                  }}
                  eventHandlers={{
                    mouseover: () => setHoveredPointId(point.id),
                    mouseout: () => setHoveredPointId(null),
                    click: () => togglePointInBasket(point.id),
                  }}
                >
                  <Tooltip>
                    {point.name}
                  </Tooltip>
                </Circle>
              )
            })}

            {routeResult ? (
              <Polyline
                positions={routeResult.coordinates}
                pathOptions={{ color: '#1d7f86', weight: 5, opacity: 0.9 }}
              />
            ) : null}
          </MapContainer>
        </section>
      </section>
    </main>
  )
}
