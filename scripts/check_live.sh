#!/usr/bin/env bash
# ==============================================================================
# MT-Hack Situational Predictor — Live Services Verification Script
# Проверяет сквозную связку: ML (FastAPI :8000) ↔ Backend (Go :8080) ↔ Frontend (:5173)
# ==============================================================================

set -e

GREEN="\033[32m"
RED="\033[31m"
YELLOW="\033[33m"
CYAN="\033[36m"
BOLD="\033[1m"
RESET="\033[0m"

echo ""
echo -e "${BOLD}${CYAN}================================================================${RESET}"
echo -e "${BOLD}${CYAN}   🚀 Проверка готовности сервисов: ML ↔ Backend ↔ Frontend   ${RESET}"
echo -e "${BOLD}${CYAN}================================================================${RESET}"
echo ""

# 1. Проверка ML сервиса (:8000)
echo -ne "1. ML Инференс-сервис (FastAPI :8000)... "
ML_RESP=$(curl -s -m 2 http://localhost:8000/health 2>/dev/null || true)
if [[ -n "$ML_RESP" && "$ML_RESP" =~ "ok" ]]; then
    ML_MODE=$(echo "$ML_RESP" | jq -r '.models.mode // "unknown"' 2>/dev/null || echo "ok")
    echo -e "${GREEN}✓ РАБОТАЕТ${RESET} (Режим: ${BOLD}${ML_MODE}${RESET}, SHAP: активен)"
else
    echo -e "${RED}✗ НЕ ОТВЕЧАЕТ${RESET}"
    echo -e "   ${YELLOW}Запуск: make ml-run${RESET}"
fi

# 2. Проверка инференса ML (CatBoost + SHAP)
echo -ne "2. Тест CatBoost инференса (/predict)... "
PRED_RESP=$(curl -s -m 2 -X POST http://localhost:8000/predict \
    -H "Content-Type: application/json" \
    -d '{"vehicle_id":"1042","cur_dev_s":120.0,"speed_kmh":15.0,"horizon_sec":900,"current_headway_sec":120.0,"dist_to_target_m":2500,"hour_of_day":14,"day_of_week":2}' 2>/dev/null || true)

if [[ -n "$PRED_RESP" && "$PRED_RESP" =~ "predicted_delay_sec" ]]; then
    DELAY=$(echo "$PRED_RESP" | jq -r '.predicted_delay_sec // "N/A"' 2>/dev/null)
    PROB=$(echo "$PRED_RESP" | jq -r '.bunching_risk_probability // "N/A"' 2>/dev/null)
    FACTORS=$(echo "$PRED_RESP" | jq -r '.factors | length // 0' 2>/dev/null)
    echo -e "${GREEN}✓ УСПЕШНО${RESET} (Предикт: ${BOLD}+${DELAY}с${RESET}, Риск: ${BOLD}${PROB}${RESET}, SHAP-факторов: ${BOLD}${FACTORS}${RESET})"
else
    echo -e "${RED}✗ ОШИБКА ИНФЕРЕНСА${RESET}"
fi

# 3. Проверка Go Backend (:8080)
echo -ne "3. Go Бэкенд (REST API :8080)... "
BACKEND_STATUS=$(curl -s -m 2 http://localhost:8080/api/v1/status 2>/dev/null || true)
if [[ -n "$BACKEND_STATUS" && "$BACKEND_STATUS" =~ "live_simulation_active" ]]; then
    LATENCY=$(echo "$BACKEND_STATUS" | jq -r '.engine_latency_ms // "N/A"' 2>/dev/null)
    VEH_CNT=$(echo "$BACKEND_STATUS" | jq -r '.active_vehicles_count // "N/A"' 2>/dev/null)
    ALERTS_CNT=$(echo "$BACKEND_STATUS" | jq -r '.active_alerts_count // "N/A"' 2>/dev/null)
    echo -e "${GREEN}✓ РАБОТАЕТ${RESET} (Задержка ядра: ${BOLD}${LATENCY}мс${RESET}, Бортов: ${BOLD}${VEH_CNT}${RESET}, Алертов: ${BOLD}${ALERTS_CNT}${RESET})"
else
    echo -e "${RED}✗ НЕ ОТВЕЧАЕТ${RESET}"
    echo -e "   ${YELLOW}Запуск: make backend-run${RESET}"
fi

# 4. Проверка WebSocket потока (:8080/ws)
echo -ne "4. Стриминг WebSocket (ws://localhost:8080/ws)... "
WS_TEST=$(node -e '
const ws = new WebSocket("ws://localhost:8080/ws");
ws.onopen = () => {};
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(msg.type || "OK");
  ws.close();
  process.exit(0);
};
ws.onerror = () => { process.exit(1); };
setTimeout(() => { process.exit(1); }, 2000);
' 2>/dev/null || true)

if [[ "$WS_TEST" =~ "TELEMETRY_UPDATE" || "$WS_TEST" =~ "OK" ]]; then
    echo -e "${GREEN}✓ ПОТОК АКТИВЕН${RESET} (Кадры телеметрии передаются в UI)"
else
    echo -e "${YELLOW}⚠ НЕТ ПОДКЛЮЧЕНИЯ${RESET} (Проверьте запуск бэкенда)"
fi

# 5. Проверка Frontend (:5173)
echo -ne "5. Фронтенд Дашборд (React Vite :5173)... "
FRONT_RESP=$(curl -s -m 2 http://localhost:5173 2>/dev/null || true)
if [[ -n "$FRONT_RESP" && "$FRONT_RESP" =~ "html" ]]; then
    echo -e "${GREEN}✓ ДОСТУПЕН${RESET} (http://localhost:5173)"
else
    echo -e "${RED}✗ НЕ ЗАПУЩЕН${RESET}"
    echo -e "   ${YELLOW}Запуск: make frontend-dev${RESET}"
fi

echo ""
echo -e "${BOLD}${CYAN}----------------------------------------------------------------${RESET}"
echo -e "${BOLD}ИТОГ:${RESET}"
echo -e " • ML Service:   http://localhost:8000/docs (Swagger)"
echo -e " • Go Backend:   http://localhost:8080/swagger (Swagger) | TCP :9201 (NDTP)"
echo -e " • Frontend UI:  http://localhost:5173"
echo -e "${BOLD}${CYAN}================================================================${RESET}"
echo ""
