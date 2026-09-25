package engine

import (
	"fmt"
	"math"

	"github.com/mt-hack-predictor/backend/internal/models"
)

// Economic constant for Moscow urban transit (rubles per passenger-hour of travel time savings)
const ValueOfPassengerHourRub = 450.0

// WhatIfRequest describes an interactive intervention to simulate.
type WhatIfRequest struct {
	Action          string `json:"action"` // "HOLDING" or "DISPATCH_RESERVE"
	RouteID         string `json:"route_id"`
	TargetVehicleID string `json:"target_vehicle_id,omitempty"`
	HoldSeconds     int    `json:"hold_seconds,omitempty"`
	InsertStopID    string `json:"insert_stop_id,omitempty"`
	DailyPassengers int    `json:"daily_passengers,omitempty"` // default 25,000 on trunk corridor
}

// WhatIfResult details simulated headway variance, passenger wait time, and economic impact.
type WhatIfResult struct {
	Action               string    `json:"action"`
	TargetVehicleID      string    `json:"target_vehicle_id"`
	BaselineWaitTimeMin  float64   `json:"baseline_wait_time_min"`
	SimulatedWaitTimeMin float64   `json:"simulated_wait_time_min"`
	WaitTimeReductionPct float64   `json:"wait_time_reduction_pct"`
	SavedPassengerHours  float64   `json:"saved_passenger_hours_daily"`
	EconomicBenefitRub   float64   `json:"economic_benefit_rub_daily"`
	PunctualityBeforePct float64   `json:"punctuality_before_pct"`
	PunctualityAfterPct  float64   `json:"punctuality_after_pct"`
	HeadwaysBeforeSec    []float64 `json:"headways_before_sec"`
	HeadwaysAfterSec     []float64 `json:"headways_after_sec"`
	WeldingExplanation   string    `json:"welding_explanation"`
}

// ComputeWeldingWaitTime calculates mean passenger waiting time using Welding's formula (1957):
// E[W] = (H_mean / 2) * (1 + Var(H) / H_mean^2)
func ComputeWeldingWaitTime(headwaysSec []float64) float64 {
	if len(headwaysSec) == 0 {
		return 0.0
	}
	sum := 0.0
	for _, h := range headwaysSec {
		sum += h
	}
	mean := sum / float64(len(headwaysSec))
	if mean <= 0 {
		return 0.0
	}

	variance := 0.0
	for _, h := range headwaysSec {
		diff := h - mean
		variance += diff * diff
	}
	variance /= float64(len(headwaysSec))

	// Welding equation in seconds
	ewSec := (mean / 2.0) * (1.0 + (variance / (mean * mean)))
	return ewSec / 60.0 // return in minutes
}

// SimulateWhatIf performs What-If scenario modeling on current fleet vehicles.
func SimulateWhatIf(req WhatIfRequest, vehicles []models.Vehicle) WhatIfResult {
	dailyPax := req.DailyPassengers
	if dailyPax <= 0 {
		dailyPax = 25000 // typical Moscow trunk route daily volume
	}

	// Extract current headways
	headwaysBefore := make([]float64, 0, len(vehicles))
	for _, v := range vehicles {
		if req.RouteID == "" || v.RouteID == req.RouteID || req.RouteID == "all" {
			h := v.HeadwaySeconds
			if h <= 0 {
				h = 480.0
			}
			headwaysBefore = append(headwaysBefore, h)
		}
	}
	if len(headwaysBefore) < 2 {
		// Default synthetic baseline if fleet is small
		headwaysBefore = []float64{90.0, 870.0, 480.0}
	}

	headwaysAfter := make([]float64, len(headwaysBefore))
	copy(headwaysAfter, headwaysBefore)

	holdSec := req.HoldSeconds
	if holdSec <= 0 {
		holdSec = 150
	}

	switch req.Action {
	case "DISPATCH_RESERVE":
		// Find largest gap and bisect it with reserve vehicle
		maxIdx := 0
		maxH := headwaysAfter[0]
		for i, h := range headwaysAfter {
			if h > maxH {
				maxH = h
				maxIdx = i
			}
		}
		// Split gap into two equal intervals
		half := maxH / 2.0
		headwaysAfter[maxIdx] = half
		headwaysAfter = append(headwaysAfter, half)

	case "HOLDING":
		fallthrough
	default:
		// Target vehicle or first bunched vehicle gets holding buffer
		targetIdx := 0
		for i, h := range headwaysBefore {
			if h < 180.0 {
				targetIdx = i
				break
			}
		}
		// Holding shifts headway: following gap increases by holdSec, preceding decreases
		headwaysAfter[targetIdx] += float64(holdSec)
		nextIdx := (targetIdx + 1) % len(headwaysAfter)
		if headwaysAfter[nextIdx] > float64(holdSec)+60.0 {
			headwaysAfter[nextIdx] -= float64(holdSec)
		}
	}

	waitBeforeMin := ComputeWeldingWaitTime(headwaysBefore)
	waitAfterMin := ComputeWeldingWaitTime(headwaysAfter)

	reductionPct := 0.0
	if waitBeforeMin > 0 {
		reductionPct = ((waitBeforeMin - waitAfterMin) / waitBeforeMin) * 100.0
		if reductionPct < 0 {
			reductionPct = 0
		}
	}

	// Calculate saved passenger hours: delta_wait_minutes * daily_passengers / 60
	savedPaxHours := ((waitBeforeMin - waitAfterMin) * float64(dailyPax)) / 60.0
	if savedPaxHours < 0 {
		savedPaxHours = 0
	}
	economicBenefit := savedPaxHours * ValueOfPassengerHourRub

	// Calculate punctuality rate shift
	punctBefore := calcPunctualityPct(headwaysBefore)
	punctAfter := math.Min(100.0, punctBefore+reductionPct*0.6)

	explanation := fmt.Sprintf(
		"По формуле Велдинга E[W] = (H_mean/2)*(1 + Var(H)/H_mean^2), выравнивание интервала сокращает ожидание на %.1f мин (с %.1f до %.1f мин). Экономический эффект: ~%.0f ₽/день.",
		waitBeforeMin-waitAfterMin, waitBeforeMin, waitAfterMin, economicBenefit,
	)

	return WhatIfResult{
		Action:               req.Action,
		TargetVehicleID:      req.TargetVehicleID,
		BaselineWaitTimeMin:  roundFloat(waitBeforeMin, 2),
		SimulatedWaitTimeMin: roundFloat(waitAfterMin, 2),
		WaitTimeReductionPct: roundFloat(reductionPct, 1),
		SavedPassengerHours:  roundFloat(savedPaxHours, 1),
		EconomicBenefitRub:   roundFloat(economicBenefit, 0),
		PunctualityBeforePct: roundFloat(punctBefore, 1),
		PunctualityAfterPct:  roundFloat(punctAfter, 1),
		HeadwaysBeforeSec:    headwaysBefore,
		HeadwaysAfterSec:     headwaysAfter,
		WeldingExplanation:   explanation,
	}
}

func calcPunctualityPct(headways []float64) float64 {
	if len(headways) == 0 {
		return 100.0
	}
	onTime := 0
	for _, h := range headways {
		if h >= 300.0 && h <= 660.0 { // Within 5 to 11 min interval window
			onTime++
		}
	}
	return (float64(onTime) / float64(len(headways))) * 100.0
}

func roundFloat(val float64, precision int) float64 {
	pow := math.Pow(10, float64(precision))
	return math.Round(val*pow) / pow
}
