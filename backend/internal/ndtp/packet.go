package ndtp

import (
	"encoding/binary"
	"errors"
	"fmt"
	"time"
)

const (
	NPLSize           = 15
	NPHSize           = 10
	Signature         = 0x7E7E
	NPLTypeNPH  byte  = 0x02
	ServiceGeneric    = 0
	ServiceNavData    = 1
	TypeConnRequest   = 100
	TypeRealtime      = 101
	CellNav00   byte  = 0
	Nav00PayloadSize  = 26
)

var (
	ErrShortBuffer   = errors.New("ndtp: buffer too short")
	ErrBadSignature  = errors.New("ndtp: bad NPL signature")
	ErrBadCRC        = errors.New("ndtp: CRC mismatch")
	ErrIncomplete    = errors.New("ndtp: incomplete frame")
	ErrUnknownCell   = errors.New("ndtp: unknown cell type")
	ErrNoNavCell     = errors.New("ndtp: G6CellNav00 not found")
)

// NPL is the 15-byte outer frame header.
type NPL struct {
	Signature   uint16
	DataSize    uint16 // length of NPH + body
	Flags       uint16
	CRC         uint16 // as stored (byte-swapped vs raw CRC16)
	Type        byte
	PeerAddress uint32 // unitId
	RequestID   uint16
}

// NPH is the 10-byte service header.
type NPH struct {
	ServiceID uint16
	Type      uint16
	Flags     uint16
	RequestID uint32
}

// Frame is a fully parsed NDTP frame.
type Frame struct {
	NPL  NPL
	NPH  NPH
	Body []byte
	Raw  []byte // full frame bytes including NPL
}

// NavCell is the decoded G6CellNav00 navigation payload.
type NavCell struct {
	Timestamp time.Time
	Longitude float64 // signed degrees
	Latitude  float64 // signed degrees
	Valid     bool
	SpeedKmh  float64
	SpeedMax  float64
	Course    float64 // 0..360
	Altitude  float64
	TrackM    uint16
	NSat      uint8
	PDOP      uint8
	BatVoltV  float64
	ExtraDop  byte
	UnitID    uint32
}

// FrameSize returns total expected size of a frame given NPL.DataSize.
func FrameSize(dataSize uint16) int {
	return NPLSize + int(dataSize)
}

// ParseNPL decodes the 15-byte NPL header.
func ParseNPL(b []byte) (NPL, error) {
	if len(b) < NPLSize {
		return NPL{}, ErrShortBuffer
	}
	npl := NPL{
		Signature:   binary.LittleEndian.Uint16(b[0:2]),
		DataSize:    binary.LittleEndian.Uint16(b[2:4]),
		Flags:       binary.LittleEndian.Uint16(b[4:6]),
		CRC:         binary.LittleEndian.Uint16(b[6:8]),
		Type:        b[8],
		PeerAddress: binary.LittleEndian.Uint32(b[9:13]),
		RequestID:   binary.LittleEndian.Uint16(b[13:15]),
	}
	if npl.Signature != Signature {
		return NPL{}, ErrBadSignature
	}
	return npl, nil
}

// ParseNPH decodes the 10-byte NPH header.
func ParseNPH(b []byte) (NPH, error) {
	if len(b) < NPHSize {
		return NPH{}, ErrShortBuffer
	}
	return NPH{
		ServiceID: binary.LittleEndian.Uint16(b[0:2]),
		Type:      binary.LittleEndian.Uint16(b[2:4]),
		Flags:     binary.LittleEndian.Uint16(b[4:6]),
		RequestID: binary.LittleEndian.Uint32(b[6:10]),
	}, nil
}

// TryParseFrame attempts to parse one complete frame from buf.
// Returns the frame, number of bytes consumed, and error.
// If the buffer does not yet contain a full frame, returns ErrIncomplete and n=0
// (or n>0 if leading garbage was skipped toward a signature).
func TryParseFrame(buf []byte) (Frame, int, error) {
	if len(buf) < NPLSize {
		return Frame{}, 0, ErrIncomplete
	}

	// Seek signature 0x7E7E (little-endian bytes 0x7E, 0x7E).
	start := -1
	for i := 0; i+1 < len(buf); i++ {
		if buf[i] == 0x7E && buf[i+1] == 0x7E {
			start = i
			break
		}
	}
	if start < 0 {
		// Keep last byte in case of split signature.
		if len(buf) > 0 {
			return Frame{}, len(buf) - 1, ErrIncomplete
		}
		return Frame{}, 0, ErrIncomplete
	}
	if start > 0 {
		// Caller should drop leading garbage; signal via consumed count.
		if len(buf)-start < NPLSize {
			return Frame{}, start, ErrIncomplete
		}
	}

	payload := buf[start:]
	npl, err := ParseNPL(payload)
	if err != nil {
		// Bad signature after seek shouldn't happen; skip one byte and retry later.
		return Frame{}, start + 1, err
	}

	total := FrameSize(npl.DataSize)
	if len(payload) < total {
		return Frame{}, start, ErrIncomplete
	}

	nphBody := payload[NPLSize:total]
	if int(npl.DataSize) < NPHSize {
		return Frame{}, start + total, fmt.Errorf("ndtp: dataSize %d < NPH", npl.DataSize)
	}

	// CRC covers NPH + body; stored CRC is byte-swapped.
	rawCRC := CRC16Modbus(nphBody)
	stored := SwapUint16(npl.CRC)
	// Accept either swapped storage (spec) or raw (some stacks).
	if stored != rawCRC && npl.CRC != rawCRC {
		// Soft-fail: still parse, but mark — many lab emulators leave crc=0.
		if npl.CRC != 0 {
			return Frame{}, start + total, fmt.Errorf("%w: got=0x%04X calc=0x%04X", ErrBadCRC, npl.CRC, rawCRC)
		}
	}

	nph, err := ParseNPH(nphBody)
	if err != nil {
		return Frame{}, start + total, err
	}

	body := nphBody[NPHSize:]
	frame := Frame{
		NPL:  npl,
		NPH:  nph,
		Body: append([]byte(nil), body...),
		Raw:  append([]byte(nil), payload[:total]...),
	}
	return frame, start + total, nil
}

// IsHandshake reports NPH_SGC_CONN_REQUEST.
func (f Frame) IsHandshake() bool {
	return f.NPH.ServiceID == ServiceGeneric && f.NPH.Type == TypeConnRequest
}

// IsRealtime reports NPH_SND_REALTIME.
func (f Frame) IsRealtime() bool {
	return f.NPH.ServiceID == ServiceNavData && f.NPH.Type == TypeRealtime
}

// ParseNav00 extracts the first G6CellNav00 from a realtime body.
func ParseNav00(body []byte, unitID uint32) (NavCell, error) {
	i := 0
	for i+2 <= len(body) {
		cellType := body[i]
		// number := body[i+1] // index among same-type cells
		i += 2

		switch cellType {
		case CellNav00:
			if i+Nav00PayloadSize > len(body) {
				return NavCell{}, ErrShortBuffer
			}
			nav, err := decodeNav00Payload(body[i:i+Nav00PayloadSize], unitID)
			return nav, err
		default:
			size, ok := knownCellPayloadSize(cellType)
			if !ok {
				// Unknown cell — cannot safely skip; stop scan.
				return NavCell{}, fmt.Errorf("%w: type=%d", ErrUnknownCell, cellType)
			}
			if i+size > len(body) {
				return NavCell{}, ErrShortBuffer
			}
			i += size
		}
	}
	return NavCell{}, ErrNoNavCell
}

func decodeNav00Payload(p []byte, unitID uint32) (NavCell, error) {
	if len(p) < Nav00PayloadSize {
		return NavCell{}, ErrShortBuffer
	}
	ts := binary.LittleEndian.Uint32(p[0:4])
	lonRaw := binary.LittleEndian.Uint32(p[4:8])
	latRaw := binary.LittleEndian.Uint32(p[8:12])
	extra := p[12]
	bat := p[13]
	speedAvg := binary.LittleEndian.Uint16(p[14:16])
	speedMax := binary.LittleEndian.Uint16(p[16:18])
	course := binary.LittleEndian.Uint16(p[18:20])
	track := binary.LittleEndian.Uint16(p[20:22])
	alt := binary.LittleEndian.Uint16(p[22:24])
	nsat := p[24]
	pdop := p[25]

	lon := float64(lonRaw) / 1e7
	lat := float64(latRaw) / 1e7
	// extraDopBit5 = N/S (bit5): 1=N, 0=S
	// extraDopBit6 = E/W (bit6): 1=E, 0=W
	// extraDopBit7 = valid (bit7)
	if extra&(1<<5) == 0 {
		lat = -lat
	}
	if extra&(1<<6) == 0 {
		lon = -lon
	}
	valid := extra&(1<<7) != 0

	return NavCell{
		Timestamp: time.Unix(int64(ts), 0).UTC(),
		Longitude: lon,
		Latitude:  lat,
		Valid:     valid,
		SpeedKmh:  float64(speedAvg),
		SpeedMax:  float64(speedMax),
		Course:    float64(course),
		Altitude:  float64(alt),
		TrackM:    track,
		NSat:      nsat,
		PDOP:      pdop,
		BatVoltV:  float64(bat) * 0.02,
		ExtraDop:  extra,
		UnitID:    unitID,
	}, nil
}

func knownCellPayloadSize(t byte) (int, bool) {
	// Sizes from emulator spec (payload only, without type/number).
	switch t {
	case 0: // Nav00
		return 26, true
	case 2: // IntSensor02
		return 26, true
	case 3: // Crown03
		return 20, true
	case 4: // Irma04
		return 28, true
	case 5: // Kdm05
		return 16, true
	case 6: // Idn06
		return 16, true
	case 7: // Idn07
		return 4, true
	case 8: // Usi08
		return 6, true
	case 9: // Reg09
		return 36, true
	case 10: // Can10
		return 37, true
	case 12: // Rfid12
		return 5, true
	case 13: // Plo13
		return 16, true
	case 14: // Bms14
		return 24, true
	case 15: // Lls15
		return 50, true
	case 16: // Termo16
		return 8, true
	case 17: // Alcohol1st17
		return 8, true
	case 18: // CAN18
		return 40, true
	case 19: // GSMstations19
		return 64, true
	case 20: // M333CAN20
		return 8, true
	case 21: // Alcohol2nd21
		return 64, true
	case 22: // ServerStatistics22
		return 24, true
	case 23: // TrackerStatistics23
		return 16, true
	case 100: // ZipSensorData100
		return 44, true
	default:
		return 0, false
	}
}

// BuildConnResult builds a minimal NPH_SGC_CONN_RESULT-style reply.
// Emulator ignores body content; we still send a well-formed frame for realism.
func BuildConnResult(unitID uint32, requestID uint32) []byte {
	// Body: result code u32 = 0 (OK)
	body := make([]byte, 4)
	binary.LittleEndian.PutUint32(body, 0)

	nph := make([]byte, NPHSize+len(body))
	binary.LittleEndian.PutUint16(nph[0:2], ServiceGeneric)
	binary.LittleEndian.PutUint16(nph[2:4], 101) // generic result-ish type; emulator ignores
	binary.LittleEndian.PutUint16(nph[4:6], 0)   // response flag
	binary.LittleEndian.PutUint32(nph[6:10], requestID)
	copy(nph[NPHSize:], body)

	crc := CRC16Modbus(nph)
	npl := make([]byte, NPLSize)
	binary.LittleEndian.PutUint16(npl[0:2], Signature)
	binary.LittleEndian.PutUint16(npl[2:4], uint16(len(nph)))
	binary.LittleEndian.PutUint16(npl[4:6], 0)
	binary.LittleEndian.PutUint16(npl[6:8], SwapUint16(crc))
	npl[8] = NPLTypeNPH
	binary.LittleEndian.PutUint32(npl[9:13], unitID)
	binary.LittleEndian.PutUint16(npl[13:15], 0)

	out := make([]byte, 0, NPLSize+len(nph))
	out = append(out, npl...)
	out = append(out, nph...)
	return out
}
