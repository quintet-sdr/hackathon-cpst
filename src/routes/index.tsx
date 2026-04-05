import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'

import { lectures, sciencePoints, sciencePointsById } from '#/features/science-guide/data'
import {
  buildLectureRoute,
  buildMaxPointsDistanceRoute,
  buildUserRoute,
} from '#/features/science-guide/routing'
import type { BuiltRoute, ScenarioType, SciencePoint } from '#/features/science-guide/types'

const ScienceGuideMap = lazy(async () => {
  const module = await import('../components/ScienceGuideMap')

  return {
    default: module.ScienceGuideMap,
  }
})

const INITIAL_DISTANCE_LIMIT_KM = 4

interface RouteBuildSnapshot {
  scenario: ScenarioType
  lectureId: number
  pointIds: number[]
  distanceLimitKm: number
}

function formatDistanceLimitInput(valueKm: number): string {
  return Number.isInteger(valueKm) ? String(valueKm) : valueKm.toFixed(1)
}

function sanitizeDistanceInput(rawValue: string): string {
  const normalized = rawValue.replace(',', '.').replace(/[^\d.]/g, '')
  let value = ''
  let hasDot = false

  for (const char of normalized) {
    if (char === '.') {
      if (hasDot) {
        continue
      }

      hasDot = true
      value += char
      continue
    }

    value += char
  }

  // Keep the input compact: "05" -> "5", but preserve "0." while typing decimals.
  if (/^0\d+/.test(value) && !value.startsWith('0.')) {
    value = String(Number(value))
  }

  return value
}

function parseDistanceLimitInputStrict(rawValue: string): {
  valueKm: number | null
  error: string | null
} {
  const normalized = rawValue.trim().replace(',', '.')
  if (!normalized) {
    return { valueKm: null, error: 'Введите лимит дистанции в километрах' }
  }

  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return {
      valueKm: null,
      error: 'Используйте число в формате 5 или 5.5',
    }
  }

  const valueKm = Number(normalized)
  if (!Number.isFinite(valueKm) || valueKm <= 0) {
    return {
      valueKm: null,
      error: 'Лимит дистанции должен быть больше нуля',
    }
  }

  if (!Number.isInteger(valueKm * 2)) {
    return {
      valueKm: null,
      error: 'Допустим шаг 0.5 км',
    }
  }

  return { valueKm, error: null }
}

function serializeRouteBuildSnapshot(snapshot: RouteBuildSnapshot): string {
  return JSON.stringify(snapshot)
}

export const Route = createFileRoute('/')({
  ssr: false,
  component: App,
})

function App() {
  const [activeScenario, setActiveScenario] = useState<ScenarioType>('lecture')
  const [selectedLectureId, setSelectedLectureId] = useState<number>(lectures[0]?.id ?? 1)
  const [selectedPointIds, setSelectedPointIds] = useState<number[]>([])
  const [selectedPointId, setSelectedPointId] = useState<number | null>(null)
  const [hoveredPointId, setHoveredPointId] = useState<number | null>(null)
  const [distanceLimitKm, setDistanceLimitKm] = useState<number>(INITIAL_DISTANCE_LIMIT_KM)
  const [distanceLimitInput, setDistanceLimitInput] = useState<string>(
    formatDistanceLimitInput(INITIAL_DISTANCE_LIMIT_KM),
  )
  const [distanceLimitError, setDistanceLimitError] = useState<string | null>(null)
  const [routeResult, setRouteResult] = useState<BuiltRoute | null>(null)
  const [lastBuiltSnapshot, setLastBuiltSnapshot] = useState<RouteBuildSnapshot | null>(null)
  const [routeError, setRouteError] = useState<string | null>(null)
  const [isRouting, setIsRouting] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const selectedPoint =
    (selectedPointId ? sciencePointsById.get(selectedPointId) : undefined) ?? null

  const basketPoints = useMemo(
    () => selectedPointIds.map((id) => sciencePointsById.get(id)).filter(Boolean) as SciencePoint[],
    [selectedPointIds],
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

    if (activeScenario === 'user-route') {
      const nonBasketPoints = sciencePoints.filter((point) => !selectedPointIds.includes(point.id))
      const basketPointsInOrder = sciencePoints.filter((point) => selectedPointIds.includes(point.id))

      return [...nonBasketPoints, ...basketPointsInOrder]
    }

    return sciencePoints
  }, [activeScenario, selectedLectureId, selectedPointIds])

  const distanceValidation = useMemo(
    () => parseDistanceLimitInputStrict(distanceLimitInput),
    [distanceLimitInput],
  )

  const canBuildRouteByScenario =
    (activeScenario !== 'user-route' || selectedPointIds.length >= 2)
    && (activeScenario !== 'distance-max' || distanceValidation.error === null)

  const canBuildRoute = canBuildRouteByScenario && !isRouting

  const normalizedDistanceLimitForSnapshot = distanceValidation.valueKm ?? distanceLimitKm
  const currentRouteSnapshot = useMemo<RouteBuildSnapshot>(
    () => ({
      scenario: activeScenario,
      lectureId: selectedLectureId,
      pointIds: selectedPointIds,
      distanceLimitKm: normalizedDistanceLimitForSnapshot,
    }),
    [activeScenario, selectedLectureId, selectedPointIds, normalizedDistanceLimitForSnapshot],
  )

  const isRouteOutOfSync =
    canBuildRouteByScenario
    && serializeRouteBuildSnapshot(currentRouteSnapshot)
      !== serializeRouteBuildSnapshot(
        lastBuiltSnapshot
          ?? {
            scenario: 'lecture',
            lectureId: -1,
            pointIds: [],
            distanceLimitKm: -1,
          },
      )

  const showLecturesSection = activeScenario === 'lecture'
  const showBasketSection = activeScenario !== 'distance-max'

  function handleDistanceLimitBlur() {
    const parsed = parseDistanceLimitInputStrict(distanceLimitInput)
    if (parsed.error || parsed.valueKm === null) {
      setDistanceLimitError(parsed.error)
      return
    }

    setDistanceLimitError(null)
    setDistanceLimitKm(parsed.valueKm)
    setDistanceLimitInput(formatDistanceLimitInput(parsed.valueKm))
  }

  async function handleBuildRoute(reason: 'manual' | 'auto' = 'manual') {
    if (activeScenario === 'user-route' && selectedPointIds.length < 2) {
      setRouteError('Для пользовательского маршрута выберите минимум 2 точки')
      setRouteResult(null)
      return
    }

    let validatedDistanceLimitKm = distanceLimitKm
    if (activeScenario === 'distance-max') {
      const parsed = parseDistanceLimitInputStrict(distanceLimitInput)
      if (parsed.error || parsed.valueKm === null) {
        setDistanceLimitError(parsed.error)
        setRouteError(parsed.error)
        setRouteResult(null)
        return
      }

      validatedDistanceLimitKm = parsed.valueKm
      setDistanceLimitKm(parsed.valueKm)
      setDistanceLimitInput(formatDistanceLimitInput(parsed.valueKm))
      setDistanceLimitError(null)
    }

    const snapshotForBuild: RouteBuildSnapshot = {
      scenario: activeScenario,
      lectureId: selectedLectureId,
      pointIds: selectedPointIds,
      distanceLimitKm: validatedDistanceLimitKm,
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setIsRouting(true)
    setRouteError(null)

    try {
      const result =
        activeScenario === 'lecture'
          ? await buildLectureRoute(selectedLectureId, controller.signal)
          : activeScenario === 'user-route'
            ? await buildUserRoute(selectedPointIds, controller.signal)
            : await buildMaxPointsDistanceRoute({
                maxDistanceMeters: validatedDistanceLimitKm * 1000,
                candidatePointIds: sciencePoints.map((point) => point.id),
                startPointId: selectedPointId ?? undefined,
              }, controller.signal)

      setRouteResult(result)
      setLastBuiltSnapshot(snapshotForBuild)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        if (!controller.signal.aborted) {
          setRouteError('Сервис маршрутов не ответил вовремя, попробуйте снова')
          setRouteResult(null)
        }

        return
      }

      const message = error instanceof Error ? error.message : 'Route build failed'
      setRouteError(
        reason === 'auto'
          ? `Автопостроение лекции не удалось: ${message}`
          : message,
      )
      setRouteResult(null)
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setIsRouting(false)
      }
    }
  }

  function addPointToBasket(pointId: number) {
    setSelectedPointIds((current) => {
      if (current.includes(pointId)) {
        return current
      }

      return [...current, pointId]
    })
    setSelectedPointId(pointId)
  }

  function removePointFromBasket(pointId: number) {
    setSelectedPointIds((current) => current.filter((id) => id !== pointId))
    setSelectedPointId(pointId)
  }

  function togglePointInBasket(pointId: number) {
    if (selectedPointIds.includes(pointId)) {
      removePointFromBasket(pointId)
      return
    }

    addPointToBasket(pointId)
  }

  function handleDistanceLimitInputChange(value: string) {
    setDistanceLimitInput(sanitizeDistanceInput(value))
    setDistanceLimitError(null)
  }

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (activeScenario === 'lecture') {
      void handleBuildRoute('auto')
    }
  }, [activeScenario, selectedLectureId])

  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    [],
  )

  useEffect(() => {
    if (activeScenario !== 'distance-max') {
      setDistanceLimitError(null)
    }
  }, [activeScenario])

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
                      ? 'border-[rgba(27,102,43,0.42)] bg-[rgba(165,236,127,0.3)] text-[var(--sea-ink)]'
                      : 'border-[var(--line)] bg-[rgba(244,253,239,0.86)] text-black hover:bg-[rgba(250,255,247,0.98)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          {showLecturesSection ? (
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
                          ? 'border-[rgba(27,102,43,0.42)] bg-[rgba(165,236,127,0.3)]'
                          : 'border-[var(--line)] bg-[rgba(244,253,239,0.86)] hover:bg-[rgba(250,255,247,0.98)]'
                      }`}
                    >
                      <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">{lecture.title}</p>
                      <p className="mt-1 text-xs text-black">{lecture.description}</p>
                    </button>
                  )
                })}
              </div>
            </section>
          ) : null}

          {showBasketSection ? (
            <section className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="island-kicker m-0">Корзина точек</p>
                <button
                  type="button"
                  onClick={() => setSelectedPointIds([])}
                  className="rounded-lg border border-[var(--line)] bg-[rgba(244,253,239,0.86)] px-2 py-1 text-xs font-semibold text-black hover:bg-[rgba(250,255,247,0.98)]"
                >
                  Очистить
                </button>
              </div>

              <div className="min-h-32 max-h-44 space-y-2 overflow-auto pr-1">
                {basketPoints.length === 0 ? (
                  <p className="m-0 rounded-xl border border-dashed border-[var(--line)] bg-[rgba(248,255,244,0.88)] px-3 py-2 text-xs text-black">
                    Добавляйте точки через кнопку + в списке ниже.
                  </p>
                ) : (
                  basketPoints.map((point) => (
                    <div
                      key={point.id}
                      className={`rounded-xl border px-3 py-2 ${
                        hoveredPointId === point.id
                          ? 'border-[rgba(27,102,43,0.42)] bg-[rgba(165,236,127,0.26)]'
                          : 'border-[var(--line)] bg-[rgba(242,252,237,0.84)]'
                      }`}
                      onMouseEnter={() => setHoveredPointId(point.id)}
                      onMouseLeave={() => setHoveredPointId(null)}
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setSelectedPointId(point.id)}
                          className="flex-1 text-left text-sm font-semibold text-[var(--sea-ink)]"
                        >
                          {point.name}
                        </button>
                        <button
                          type="button"
                          onClick={() => removePointFromBasket(point.id)}
                          className="point-action-button point-action-button--remove"
                          aria-label={`Удалить ${point.name} из корзины`}
                          title="Удалить из корзины"
                        >
                          −
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}

          <section className="mt-5">
            <p className="island-kicker mb-2">Список точек</p>
            <div className="min-h-52 max-h-52 space-y-2 overflow-auto pr-1">
              {visibleSidebarPoints.map((point) => {
                const inBasket = selectedPointIds.includes(point.id)

                return (
                  <div
                    key={`visible-${point.id}`}
                    className={`rounded-xl border px-3 py-2 ${
                      hoveredPointId === point.id
                        ? 'border-[rgba(27,102,43,0.42)] bg-[rgba(165,236,127,0.26)]'
                        : selectedPointIds.includes(point.id)
                          ? 'border-[rgba(27,102,43,0.38)] bg-[rgba(232,250,221,0.92)]'
                          : 'border-[var(--line)] bg-[rgba(244,253,239,0.86)]'
                    }`}
                    onMouseEnter={() => setHoveredPointId(point.id)}
                    onMouseLeave={() => setHoveredPointId(null)}
                  >
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedPointId(point.id)}
                        className="flex-1 text-left"
                      >
                        <p className="m-0 text-sm font-semibold text-black">{point.name}</p>
                        <p className="mt-0.5 text-xs text-black">
                          {activeScenario === 'distance-max'
                            ? 'Точка доступна для маршрута'
                            : inBasket}
                        </p>
                      </button>
                      {activeScenario !== 'distance-max' ? (
                        <button
                          type="button"
                          onClick={() =>
                            inBasket
                              ? removePointFromBasket(point.id)
                              : addPointToBasket(point.id)
                          }
                          className={`point-action-button ${
                            inBasket
                              ? 'point-action-button--remove'
                              : 'point-action-button--add'
                          }`}
                          aria-label={
                            inBasket
                              ? `Удалить ${point.name} из корзины`
                              : `Добавить ${point.name} в корзину`
                          }
                          title={inBasket ? 'Удалить из корзины' : 'Добавить в корзину'}
                        >
                          {inBasket ? '−' : '+'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {activeScenario === 'user-route' ? (
            <p className="mt-2 rounded-xl border border-dashed border-[var(--line)] bg-white/35 px-3 py-2 text-xs text-black">
              Для пользовательского маршрута выберите минимум 2 точки. Порядок в корзине задает порядок обхода.
            </p>
          ) : null}

          {activeScenario === 'distance-max' ? (
            <section className="mt-5">
              <p className="island-kicker mb-2">Лимит дистанции</p>
              <label className="block">
                <span className="text-xs text-black">км</span>
                <input
                  value={distanceLimitInput}
                  onChange={(event) => handleDistanceLimitInputChange(event.target.value)}
                  onBlur={handleDistanceLimitBlur}
                  type="text"
                  inputMode="decimal"
                  placeholder="только цифры: 5 или 5.5"
                  className="mt-1 w-full rounded-xl border border-[var(--line)] bg-[rgba(250,255,247,0.98)] px-3 py-2 text-sm text-black placeholder:text-black/70 outline-none focus:border-[rgba(27,102,43,0.42)]"
                />
              </label>
              {distanceLimitError ? (
                <p className="mt-2 text-xs font-semibold text-[#ba4d4d]">{distanceLimitError}</p>
              ) : null}
            </section>
          ) : null}

          <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[rgba(245,253,241,0.9)] p-3">
            <p className="island-kicker mb-2 text-black">Сводка маршрута</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="m-0 text-xs text-black">Длина</p>
                <p className="m-0 text-sm font-semibold text-black">{summaryDistanceKm} км</p>
              </div>
              <div>
                <p className="m-0 text-xs text-black">Время</p>
                <p className="m-0 text-sm font-semibold text-black">{summaryDurationMin} мин</p>
              </div>
              <div>
                <p className="m-0 text-xs text-black">Точки</p>
                <p className="m-0 text-sm font-semibold text-black">{routeResult?.waypointIds.length ?? 0}</p>
              </div>
            </div>
            {routeError ? (
              <p className="mt-2 text-xs font-semibold text-[#ba4d4d]">{routeError}</p>
            ) : null}
          </section>

          <section className="mt-5 rounded-2xl border border-[var(--line)] bg-[rgba(245,253,241,0.92)] p-3 text-black">
            <p className="island-kicker mb-2 text-black">Выбранная точка</p>
            {selectedPoint ? (
              <>
                <div className="h-28 rounded-xl border border-[var(--line)] bg-[linear-gradient(130deg,rgba(165,236,127,0.28),rgba(12,71,32,0.14))]" />
                <p className="mt-3 mb-1 text-sm font-semibold text-black">{selectedPoint.name}</p>
                <p className="m-0 text-xs text-black">{selectedPoint.description}</p>
              </>
            ) : (
              <p className="m-0 text-xs text-black">
                Выберите точку на карте или в корзине, чтобы увидеть описание.
              </p>
            )}
          </section>
        </aside>

        <section className="island-shell rise-in rounded-3xl p-2 sm:p-3">
          {isClient ? (
            <Suspense
              fallback={(
                <div className="planner-map grid place-items-center rounded-[1.15rem] border border-[var(--line)] bg-[rgba(244,253,239,0.86)] text-sm font-semibold text-black">
                  Загрузка карты...
                </div>
              )}
            >
              <ScienceGuideMap
                points={sciencePoints}
                selectedPointIds={selectedPointIds}
                selectedPointId={selectedPointId}
                hoveredPointId={hoveredPointId}
                routeWaypointIds={routeResult?.waypointIds ?? []}
                routeCoordinates={routeResult?.coordinates ?? null}
                onHoverPoint={setHoveredPointId}
                onSelectPoint={setSelectedPointId}
                onTogglePointInBasket={togglePointInBasket}
                canTogglePointInBasket={showBasketSection}
              />
            </Suspense>
          ) : (
            <div className="planner-map grid place-items-center rounded-[1.15rem] border border-[var(--line)] bg-[rgba(244,253,239,0.86)] text-sm font-semibold text-black">
              Подготовка клиентского режима...
            </div>
          )}

          {isRouteOutOfSync ? (
            <button
              type="button"
              disabled={!canBuildRoute}
              onClick={() => void handleBuildRoute('manual')}
              className="map-sync-button"
            >
              {isRouting ? 'Обновление...' : 'Обновить маршрут'}
            </button>
          ) : null}
        </section>
      </section>
    </main>
  )
}
