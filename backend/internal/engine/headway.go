package engine

import (
	"math"
	"sort"
	"sync"

	"github.com/mt-hack-predictor/backend/internal/models"
)

const (
	DefaultPlanHeadwaySec = 480.0 // 8 minutes default scheduled interval
	MinHoldingDurationSec = 60    // 1 minute
	MaxHoldingDurationSec = 300   // 5 minutes
)

// HeadwayInfo contains computed headway interval and bunching assessment.
type HeadwayInfo struct {
	VehicleID          string
	AheadVehicleID     string
	HeadwaySec         float64
	PlanHeadwaySec     float64
	HeadwayRatio       float64
	BunchingRisk       float64 // 0.0 - 1.0
	Status             string  // "ON_TIME", "DELAYED", "BUNCHING_RISK"
	RecommendedHoldSec int
}

// HeadwayCalculator computes real-time headway and bunching risks for fleet routes.
type HeadwayCalculator struct {
	mu             sync.RWMutex
	planHeadwaySec float64
}

// NewHeadwayCalculator creates a headway calculator with given target headway.
func NewHeadwayCalculator(planHeadwaySec float64) *HeadwayCalculator {
	if planHeadwaySec <= 0 {
		planHeadwaySec = DefaultPlanHeadwaySec
	}
	return &HeadwayCalculator{
		planHeadwaySec: planHeadwaySec,
	}
}

// AssessFleetHeadways evaluates dynamic intervals for all active vehicles on each route.
func (h *HeadwayCalculator) AssessFleetHeadways(vehicles []models.Vehicle) map[string]HeadwayInfo {
	h.mu.RLock()
	plan := h.planHeadwaySec
	h.mu.RUnlock()

	out := make(map[string]HeadwayInfo)

	// Group by route
	byRoute := make(map[string][]models.Vehicle)
	for _, v := range vehicles {
		route := v.RouteID
		if route == "" {
			route = "default"
		}
		byRoute[route] = append(byRoute[route], v)
	}

	for _, vList := range byRoute {
		if len(vList) < 2 {
			for _, v := range vList {
				headway := v.HeadwaySeconds
				if headway <= 0 {
					headway = plan
				}
				ratio := headway / plan
				risk := 0.0
				if ratio < 0.35 || headway < 180 {
					risk = 0.85
				}
				out[v.ID] = HeadwayInfo{
					VehicleID:      v.ID,
					HeadwaySec:     headway,
					PlanHeadwaySec: plan,
					HeadwayRatio:   ratio,
					BunchingRisk:   risk,
					Status:         statusFromRisk(risk, v.DelaySeconds),
				}
			}
			continue
		}

		// Sort vehicles chronologically by timestamp / simulated progression
		// For spatial routes we sort by (latitude + longitude) or bearing
		sort.Slice(vList, func(i, j int) bool {
			return (vList[i].Latitude + vList[i].Longitude) < (vList[j].Latitude + vList[j].Longitude)
		})

		for i := 0; i < len(vList); i++ {
			curr := vList[i]
			// Find preceding vehicle
			aheadIdx := (i + 1) % len(vList)
			ahead := vList[aheadIdx]

			// Calculate spatial distance
			dMeters := haversine(curr.Latitude, curr.Longitude, ahead.Latitude, ahead.Longitude)
			
			// Approximate time headway based on avg speed (or fallback to existing HeadwaySeconds)
			avgSpeedMs := math.Max(curr.SpeedKmH, 15.0) / 3.6
			timeHeadway := dMeters / avgSpeedMs
			if curr.HeadwaySeconds > 0 && curr.HeadwaySeconds < timeHeadway {
				timeHeadway = curr.HeadwaySeconds
			}
			if timeHeadway > 1800 {
				timeHeadway = plan
			}

			ratio := timeHeadway / plan
			risk := 0.0
			holdSec := 0

			if ratio < 0.35 || timeHeadway < 180.0 {
				risk = 0.85
				// Holding duration: balance headway towards target plan
				delta := plan - timeHeadway
				holdSec = int(math.Min(MaxHoldingDurationSec, math.Max(MinHoldingDurationSec, delta*0.5)))
			} else if ratio < 0.65 {
				risk = 0.45
			}

			out[curr.ID] = HeadwayInfo{
				VehicleID:          curr.ID,
				AheadVehicleID:     ahead.ID,
				HeadwaySec:         timeHeadway,
				PlanHeadwaySec:     plan,
				HeadwayRatio:       ratio,
				BunchingRisk:       risk,
				Status:             statusFromRisk(risk, curr.DelaySeconds),
				RecommendedHoldSec: holdSec,
			}
		}
	}

	return out
}

func statusFromRisk(risk float64, delaySec float64) string {
	if risk >= 0.7 {
		return "BUNCHING_RISK"
	}
	if delaySec > 180.0 {
		return "DELAYED"
	}
	return "ON_TIME"
}

func haversine(lat1, lon1, lat2, lon2 float64) float64 {
	rad := math.Pi / 180.0
	phi1 := lat1 * rad
	phi2 := lat2 * rad
	dPhi := (lat2 - lat1) * rad
	dLambda := (lon2 - lon1) * rad

	a := math.Sin(dPhi/2.0)*math.Sin(dPhi/2.0) +
		math.Cos(phi1)*math.Cos(phi2)*math.Sin(dLambda/2.0)*math.Sin(dLambda/2.0)
	return 6371000.0 * 2.0 * math.Atan2(math.Sqrt(a), math.Sqrt(1.0-a))
}
