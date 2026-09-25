package ndtp

// CRC16Modbus computes CRC-16/Modbus (poly 0xA001, init 0xFFFF)
// over the given payload (NPH header + body for NDTP frames).
func CRC16Modbus(data []byte) uint16 {
	crc := uint16(0xFFFF)
	for _, b := range data {
		crc ^= uint16(b)
		for i := 0; i < 8; i++ {
			if crc&1 != 0 {
				crc = (crc >> 1) ^ 0xA001
			} else {
				crc >>= 1
			}
		}
	}
	return crc
}

// SwapUint16 swaps the two bytes of a 16-bit value.
// NDTP stores NPL.crc with swapped bytes relative to the raw CRC-16/Modbus.
func SwapUint16(v uint16) uint16 {
	return (v << 8) | (v >> 8)
}
