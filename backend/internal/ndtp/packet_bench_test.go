package ndtp

import (
	"encoding/binary"
	"testing"
	"time"
)

func BenchmarkCRC16Modbus(b *testing.B) {
	data := []byte("0123456789ABCDEF0123456789ABCDEF")
	b.SetBytes(int64(len(data)))
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_ = CRC16Modbus(data)
	}
}

func BenchmarkParseNav00(b *testing.B) {
	payload := make([]byte, Nav00PayloadSize)
	binary.LittleEndian.PutUint32(payload[0:4], uint32(time.Now().Unix()))
	binary.LittleEndian.PutUint32(payload[4:8], uint32(376173000))
	binary.LittleEndian.PutUint32(payload[8:12], uint32(557558000))
	payload[12] = 0xE0
	payload[13] = 100
	binary.LittleEndian.PutUint16(payload[14:16], 35)
	binary.LittleEndian.PutUint16(payload[16:18], 45)
	binary.LittleEndian.PutUint16(payload[18:20], 180)
	binary.LittleEndian.PutUint16(payload[20:22], 1200)
	binary.LittleEndian.PutUint16(payload[22:24], 150)
	payload[24] = 8
	payload[25] = 12

	body := append([]byte{CellNav00, 0x00}, payload...)
	unitID := uint32(1166336)

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := ParseNav00(body, unitID)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkTryParseFrame(b *testing.B) {
	unitID := uint32(1166336)
	reqID := uint32(42)
	frameBytes := BuildConnResult(unitID, reqID)

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, _, err := TryParseFrame(frameBytes)
		if err != nil {
			b.Fatal(err)
		}
	}
}
