package engine

import (
	"math"

	"github.com/mt-hack-predictor/backend/internal/models"
)

// BusinessKPIs encapsulates executive decision-support metrics for the TsODD situational center.
type BusinessKPIs struct {
	PunctualityRatePct        float64 `json:"punctuality_rate_pct"`
	HeadwayUniformityPct      float64 `json:"headway_uniformity_pct"`
	AveragePassengerWaitMin   float64 `json:"average_passenger_wait_min"`
	ActiveBunchedPairsCount   int     `json:"active_bunched_pairs_count"`
	PreventedIncidentsCount   int     `json:"prevented_incidents_count"`
	SavedPassengerHoursDaily  float64 `json:"saved_passenger_hours_daily"`
	EconomicSavingsRubDaily   float64 `json:"economic_savings_rub_daily"`
	ActiveTrackedVehicles     int     `json:"active_tracked_vehicles"`
	ActiveAlertsCount         int     `json:"active_alerts_count"`
}

// ComputeBusinessKPIs computes high-level executive and passenger-centric metrics.
func ComputeBusinessKPIs(
	vehicles []models.Vehicle,
	alerts []models.Alert,
	preventedCount int,
) BusinessKPIs {
	if len(vehicles) == 0 {
		return BusinessKPIs{
			PunctualityRatePct:      100.0,
			HeadwayUniformityPct:    100.0,
			AveragePassengerWaitMin: 4.0,
			ActiveTrackedVehicles:   0,
		}
	}

	headways := make([]float64, 0, len(vehicles))
	onTimeCount := 0
	bunchedPairs := 0

	for _, v := range vehicles {
		if v.Status == "ON_TIME" || v.Status == "REGULATING" {
			onTimeCount++
		}
		if v.Status == "BUNCHING_RISK" || (v.HeadwaySeconds > 0 && v.HeadwaySeconds < 180.0) {
			bunchedPairs++
		}
		h := v.HeadwaySeconds
		if h <= 0 {
			h = 480.0
		}
		headways = append(headways, h)
	}

	punctuality := (float64(onTimeCount) / float64(len(vehicles))) * 100.0
	waitMin := ComputeWeldingWaitTime(headways)

	// Coefficient of variation for headway uniformity
	uniformity := 100.0
	if len(headways) > 1 {
		sum := 0.0
		for _, h := range headways {
			sum += h
		}
		mean := sum / float64(len(headways))
		if mean > 0 {
			variance := 0.0
			for _, h := range headways {
				diff := h - mean
				variance += diff * diff
			}
			stdDev := math.Sqrt(variance / float64(len(headways)))
			cv := stdDev / mean
			uniformity = math.Max(0.0, (1.0-cv)*100.0)
		}
	}

	// Each prevented incident typically saves ~2.5 min of excess wait for ~1,200 corridor passengers
	savedHours := float64(preventedCount) * (2.5 / 60.0) * 1200.0
	economicSavings := savedHours * ValueOfPassengerHourRub

	return BusinessKPIs{
		PunctualityRatePct:        roundFloat(punctuality, 1),
		HeadwayUniformityPct:      roundFloat(uniformity, 1),
		AveragePassengerWaitMin:   roundFloat(waitMin, 1),
		ActiveBunchedPairsCount:   bunchedPairs,
		PreventedIncidentsCount:   preventedCount,
		SavedPassengerHoursDaily:  roundFloat(savedHours, 1),
		EconomicSavingsRubDaily:   roundFloat(economicSavings, 0),
		ActiveTrackedVehicles:     len(vehicles),
		ActiveAlertsCount:         len(alerts),
	}
}
