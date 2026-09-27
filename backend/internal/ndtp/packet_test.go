package ndtp

import (
	"encoding/binary"
	"testing"
	"time"
)

func TestCRC16Modbus(t *testing.T) {
	data := []byte("123456789")
	crc := CRC16Modbus(data)
	if crc != 0x4B37 {
		t.Fatalf("expected CRC 0x4B37, got 0x%04X", crc)
	}

	swapped := SwapUint16(crc)
	if swapped != 0x374B {
		t.Fatalf("expected swapped 0x374B, got 0x%04X", swapped)
	}
}

func TestBuildConnResult(t *testing.T) {
	unitID := uint32(1166336)
	reqID := uint32(42)

	frameBytes := BuildConnResult(unitID, reqID)
	if len(frameBytes) < NPLSize+NPHSize {
		t.Fatalf("frame too short: %d", len(frameBytes))
	}

	frame, consumed, err := TryParseFrame(frameBytes)
	if err != nil {
		t.Fatalf("failed to parse ConnResult: %v", err)
	}
	if consumed != len(frameBytes) {
		t.Fatalf("expected consumed %d, got %d", len(frameBytes), consumed)
	}
	if frame.NPL.PeerAddress != unitID {
		t.Fatalf("expected unit %d, got %d", unitID, frame.NPL.PeerAddress)
	}
}

func TestParseNav00(t *testing.T) {
	// Construct a synthetic Nav00 cell
	payload := make([]byte, Nav00PayloadSize)
	ts := uint32(time.Now().Unix())
	binary.LittleEndian.PutUint32(payload[0:4], ts)
	binary.LittleEndian.PutUint32(payload[4:8], uint32(376173000)) // 37.6173 lon
	binary.LittleEndian.PutUint32(payload[8:12], uint32(557558000)) // 55.7558 lat
	// Bit 5 = N (1), Bit 6 = E (1), Bit 7 = valid (1) -> 0b11100000 = 0xE0
	payload[12] = 0xE0
	payload[13] = 100                                    // battery
	binary.LittleEndian.PutUint16(payload[14:16], 35)    // 35 km/h
	binary.LittleEndian.PutUint16(payload[16:18], 45)    // max 45 km/h
	binary.LittleEndian.PutUint16(payload[18:20], 180)   // course
	binary.LittleEndian.PutUint16(payload[20:22], 1200)  // track
	binary.LittleEndian.PutUint16(payload[22:24], 150)   // alt
	payload[24] = 8                                      // nsat
	payload[25] = 12                                     // pdop

	body := append([]byte{CellNav00, 0}, payload...)

	nav, err := ParseNav00(body, 12345)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !nav.Valid {
		t.Fatal("expected valid nav cell")
	}
	if nav.UnitID != 12345 {
		t.Fatalf("expected unit 12345, got %d", nav.UnitID)
	}
	if nav.SpeedKmh != 35 {
		t.Fatalf("expected speed 35, got %.1f", nav.SpeedKmh)
	}
	if nav.Latitude < 55.75 || nav.Latitude > 55.76 {
		t.Fatalf("unexpected latitude: %.6f", nav.Latitude)
	}
	if nav.Longitude < 37.61 || nav.Longitude > 37.62 {
		t.Fatalf("unexpected longitude: %.6f", nav.Longitude)
	}
}

func TestTryParseFrame_Incomplete(t *testing.T) {
	buf := []byte{0x7E, 0x7E, 0x10, 0x00} // partial header
	_, consumed, err := TryParseFrame(buf)
	if err != ErrIncomplete {
		t.Fatalf("expected ErrIncomplete, got %v", err)
	}
	if consumed != 0 {
		t.Fatalf("expected 0 consumed on partial, got %d", consumed)
	}
}
