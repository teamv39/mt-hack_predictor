# План: Полный фикс карт (TileServer / прокси / маршрут / UX)

## Контекст

Карта в `MapView.tsx` отображается криво: тайлы режутся/белые зоны, маршрут м3 не совпадает с улицами, оверлеи (полигоны заторов, остановки, автобусы на горизонтах) живут своей жизнью. Причины — (1) прокси TileServer GL хрупкий (хардкод `localhost:5173` в vite, абсолютный `glyphs`), (2) стиль дублирован, (3) маршрут/остановки/позиции автобусов захардкожены в трёх местах, `route` из пропсов игнорируется, координаты `[lat,lng]` vs `[lng,lat]` перепутаны, полилайн — 5 прямых отрезков не по дорогам, (4) нет `maxBounds`/`maxZoom`/лоадера. Цель — сделать карты стабильными на любом `HOST:PORT`, выровнять маршрут с реальной картой Москвы и привести компонент к поддерживаемому виду.

Текущая инфраструктура: `maptiler/tileserver-gl` + `moscow_transport.mbtiles` (Planetiler maxzoom 14, `exclude building`), `map-service/config.json` `domains:[]` + `bounds [36.8,55.1,38.2,56.1]`, `vite proxy /tiles → localhost:8085` с `Host`+`X-Forwarded-Path`, `nginx /tiles/ → tileserver:80/`. Стили `transport.json`/`transport-dark.json` — 28 слоёв, `url: /tiles/data/...`, `glyphs: http://localhost:5173/tiles/fonts/...` (абсолютный — сломано в проде).

## Фаза 1 — Инфраструктура и прокси (P0, без этого карта белая)

**Файлы:** `map-service/styles/transport.json`, `transport-dark.json`, `frontend/vite.config.js`, `frontend/nginx.conf`, `docker-compose.yml`

1. `glyphs` в обоих стилях → относительный `/tiles/fonts/{fontstack}/{range}.pbf` (сейчас абсолютный с хардкодом порта). Проверить `sprite` если появится.
2. Убрать хардкод `Host: localhost:5173` из `vite.config.js`. Заменить на динамический: `headers: { 'X-Forwarded-Path': '/tiles' }` без подделки `Host`, либо `transformRequest` в MapLibre. Вариант А: оставить `domains:[]` + полагаться на `Host` браузера (vite сам прокидывает `Host` origin'а). Вариант Б (надёжнее): добавить `--public_url http://localhost:5173/tiles` в `docker-compose.yml` для dev и env-переменную для прод (`${PUBLIC_TILE_URL:-/tiles}`). Выбрать один и зафиксировать.
3. `docker-compose.yml` — добавить `PUBLIC_TILE_URL` или `allowedHosts` если выбран тот путь. Без хардкода порта в репо.
4. Проверка: `curl /tiles/styles/transport/style.json` → `glyphs` без `localhost`, тайл `13/4954/2564.pbf` 200, шрифт `Noto Sans Regular/0-255.pbf` 200 через оба прокси.

## Фаза 2 — Стили: один базовый + темизация рантаймом

**Файлы:** `map-service/styles/transport.json`, `transport-dark.json` (потом один), `frontend/src/components/MapView.tsx` (~строки 446–462)

1. Выделить `transport.base.json` (общие слои/источники). `transport.json` и `transport-dark.json` генерить из него или оставить один + `setPaintProperty` на `style.load` (палитра `background`, `water`, `park`, `transportation`). Убрать 95% дублирования.
2. Добавить `Noto Sans Bold` в `text-font` для `poi-*`/`road-name` где нужен, подключить второй стек в `glyphs` (в `data/fonts` уже есть Bold/Regular).
3. Заложить `maxzoom`/`minzoom` в стиле согласовано с mbtiles (14).

## Фаза 3 — Единый источник маршрута, остановок, позиций

**Файлы:** `frontend/src/mock/telemetry.ts` (MOCK_ROUTE_DATA, MOCK_STOPS), `frontend/src/components/MapView.tsx` (m3Coordinates, stopsList, amberPolygon, displayedVehicles), `frontend/src/hooks/useTelemetry.ts`, `frontend/src/App.tsx`

Критика: `MapView` принимает `route: RouteData` но деструктурирует мимо (строка 68–77), рисует свой `m3Coordinates`. `MOCK_ROUTE_DATA.greenPolyline` — `[lat,lng]`, MapView — `[lng,lat]`. `MOCK_STOPS` 2 точки vs `stopsList` 5 точек. Полилайн — прямые между остановками, не по улицам. Позиции автобусов на `+15/+30/+45` — хардкод на каждую комбинацию, не вдоль линии.

1. Нормализовать `RouteData`: все координаты `[lng,lat]` (GeoJSON), добавить `routeGeometry: [lng,lat][]` — реальная трасса м3 по улицам (взять из OSM relation `ref=м3` или вручную по Бакунинской/Спартаковской, минимум 15–20 точек). `greenPolyline/orangePolyline/redCorridorPolyline` — либо убрать, либо свести к одной `routeGeometry`.
2. `MOCK_STOPS` — расширить до 5 остановок (Покровка, Бауманская, Бакунинская, Электрозаводская, Семёновская) с реальными `[lon,lat]`, убрать `stopsList` из `MapView`, рендерить из `props.route.stops`.
3. `MapView` — использовать `props.route` (исправить деструктуризацию), удалить `m3Coordinates`/`stopsList` хардкод. Источник `m3-route` → `route.routeGeometry`.
4. Полигоны заторов — привязать к сегментам `routeGeometry` (буфер вокруг участка Бауманская→Электрозаводская), не абсолютные 4-угольники.
5. Позиции автобусов на горизонтах — интерполяция вдоль `routeGeometry` через `@turf/turf` (`along`, `length`, `lineSlice`) вместо хардкода `latitude/longitude` на каждую ветку. Добавить `@turf/turf` или `@turf/along` в `frontend/package.json`.
6. Удалить vestigial `leaflet`/`react-leaflet`/`@types/leaflet` если не используются, убрать дубль `maplibre-gl.css` импорта (`main.tsx` + `index.css`).

## Фаза 4 — Карта как компонент: границы, лоадер, ошибки, UX

**Файлы:** `MapView.tsx` (инициализация, слои, маркеры)

1. `new maplibregl.Map` — добавить `maxBounds: [[36.8,55.1],[38.2,56.1]]`, `minZoom: 10`, `maxZoom: 14` (или 16 с `maxNativeZoom:14`), `attributionControl: true`.
2. Заменить `fetch HEAD` probe (3s timeout, вечно падает в `TileServer GL not reachable`) на `GET` с ретраем или убрать вовсе — положиться на `map.on("error")` + баннер «карты недоступны». Добавить скелетон/спиннер пока `map.load` не fired.
3. `setupSituationalLayers` — гард `if (map.getSource(...)) return` уже есть, добавить `map.isStyleLoaded()` и обработку гонки `setStyle`→`style.load` (сейчас слои теряются если `style.load` не успел).
4. Остановки — `circle` + `symbol` слои из `route.stops` GeoJSON вместо 5 DOM-маркеров. Кластер/скрытие на мелких зумах. Оставить DOM только если нужен богатый HTML.
5. `renderWorldCopies: false` оставить, но с `maxBounds` чтобы не было серой пустоты.
6. `map.on("error")` — показывать UI-баннер, не только `console.warn`.

## Фаза 5 — Данные тайлов (опционально, если нужно z15+)

**Файлы:** `map-service/scripts/build_tiles.sh`, `map-service/data/moscow_transport.mbtiles`

- Пересобрать с `--maxzoom=16` (или оставить 14 + `maxNativeZoom:14` на клиенте). Сейчас overzoom на `z15+` размывает. Если не критично — отложить.

## Порядок внедрения

1→4→3→2→5. Фаза 1 разблокирует карту, фаза 4 делает её юзабельной, фаза 3 выравнивает маршрут, фаза 2 чистит техдолг, фаза 5 — по необходимости.

## Верификация

- `curl -s http://localhost:5173/tiles/styles/transport/style.json | jq .glyphs` — без `localhost:5173`
- `curl -s http://localhost:5173/tiles/data/moscow-transport/13/4954/2564.pbf -o /dev/null -w %{http_code}` — 200
- `curl -s http://localhost:5173/tiles/fonts/Noto\ Sans\ Regular/0-255.pbf -o /dev/null -w %{http_code}` — 200
- `vite dev` на другом порту (`--port 5174`) — карта грузится без правки `vite.config.js`
- `docker compose up --build` — карта грузится через nginx `:80/tiles/`
- Отключить tileserver — виден лоадер/баннер, не белая карта, фолбэк не требует интернета (или сообщение)
- `route` из `MOCK_ROUTE_DATA` рендерится на улицах (Бакунинская/Спартаковская), остановки совпадают с линией, автобусы на `+15/+30/+45` движутся вдоль маршрута
- `z10` — карта зажата в `maxBounds`, `z14` — детализация без размытия, `z15+` — overzoom или нативные тайлы
- Тёмная тема — переключение без потери слоёв/маркеров
- `npm run build` + `tsc --noEmit` без ошибок, линтер чист
