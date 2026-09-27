package ndtp

import (
	"context"
	"io"
	"log"
	"net"
	"sync"
	"sync/atomic"
	"time"
)

// NavHandler is called for every successfully decoded navigation cell.
type NavHandler func(nav NavCell)

// Server accepts NDTP TCP connections (one per onboard unit).
type Server struct {
	addr    string
	handler NavHandler

	ln net.Listener

	mu      sync.Mutex
	conns   map[net.Conn]struct{}
	running atomic.Bool
	accepts atomic.Uint64
	packets atomic.Uint64
}

// NewServer creates an NDTP TCP server. addr example: ":9201".
func NewServer(addr string, handler NavHandler) *Server {
	if handler == nil {
		handler = func(NavCell) {}
	}
	return &Server{
		addr:    addr,
		handler: handler,
		conns:   make(map[net.Conn]struct{}),
	}
}

// Start listens and accepts connections until ctx is cancelled.
func (s *Server) Start(ctx context.Context) error {
	ln, err := net.Listen("tcp", s.addr)
	if err != nil {
		return err
	}
	s.ln = ln
	s.running.Store(true)
	log.Printf("[NDTP] listening on %s", s.addr)

	go func() {
		<-ctx.Done()
		s.running.Store(false)
		_ = ln.Close()
		s.closeAll()
	}()

	for {
		conn, err := ln.Accept()
		if err != nil {
			if !s.running.Load() {
				return nil
			}
			// Transient accept errors: brief backoff.
			log.Printf("[NDTP] accept error: %v", err)
			select {
			case <-ctx.Done():
				return nil
			case <-time.After(200 * time.Millisecond):
			}
			continue
		}
		s.accepts.Add(1)
		s.track(conn)
		go s.serveConn(ctx, conn)
	}
}

// Stats returns basic counters for /status enrichment.
func (s *Server) Stats() (running bool, accepts, packets uint64, activeConns int) {
	s.mu.Lock()
	n := len(s.conns)
	s.mu.Unlock()
	return s.running.Load(), s.accepts.Load(), s.packets.Load(), n
}

func (s *Server) track(c net.Conn) {
	s.mu.Lock()
	s.conns[c] = struct{}{}
	s.mu.Unlock()
}

func (s *Server) untrack(c net.Conn) {
	s.mu.Lock()
	delete(s.conns, c)
	s.mu.Unlock()
}

func (s *Server) closeAll() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for c := range s.conns {
		_ = c.Close()
	}
	s.conns = make(map[net.Conn]struct{})
}

func (s *Server) serveConn(ctx context.Context, conn net.Conn) {
	defer func() {
		s.untrack(conn)
		_ = conn.Close()
	}()

	remote := conn.RemoteAddr().String()
	log.Printf("[NDTP] connection from %s", remote)

	_ = conn.SetDeadline(time.Time{}) // clear; we set read deadlines per-loop
	buf := make([]byte, 0, 4096)
	tmp := make([]byte, 2048)
	unitID := uint32(0)
	handshook := false

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		_ = conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		n, err := conn.Read(tmp)
		if err != nil {
			if ne, ok := err.(net.Error); ok && ne.Timeout() {
				// Idle unit — keep connection, continue waiting.
				continue
			}
			if err != io.EOF {
				log.Printf("[NDTP] read %s: %v", remote, err)
			}
			return
		}
		buf = append(buf, tmp[:n]...)

		for {
			frame, consumed, perr := TryParseFrame(buf)
			if perr == ErrIncomplete {
				if consumed > 0 {
					buf = buf[consumed:]
				}
				break
			}
			if consumed > 0 {
				buf = buf[consumed:]
			}
			if perr != nil {
				log.Printf("[NDTP] frame error from %s: %v", remote, perr)
				// Drop one byte to resync if we didn't advance.
				if consumed == 0 && len(buf) > 0 {
					buf = buf[1:]
				}
				continue
			}

			unitID = frame.NPL.PeerAddress
			s.packets.Add(1)

			switch {
			case frame.IsHandshake():
				handshook = true
				log.Printf("[NDTP] handshake unit=%d from %s", unitID, remote)
				// Best-effort reply (emulator ignores body).
				_, _ = conn.Write(BuildConnResult(unitID, frame.NPH.RequestID))

			case frame.IsRealtime():
				if !handshook {
					// Some stacks send realtime after silent connect; accept anyway.
					handshook = true
				}
				nav, err := ParseNav00(frame.Body, unitID)
				if err != nil {
					log.Printf("[NDTP] unit=%d nav parse: %v", unitID, err)
					continue
				}
				if !nav.Valid {
					log.Printf("[NDTP] unit=%d invalid fix skipped", unitID)
					continue
				}
				log.Printf("[NDTP] Unit %d: Lat %.5f, Lon %.5f, Speed %.0f km/h",
					unitID, nav.Latitude, nav.Longitude, nav.SpeedKmh)
				s.handler(nav)

			default:
				log.Printf("[NDTP] unit=%d unhandled service=%d type=%d",
					unitID, frame.NPH.ServiceID, frame.NPH.Type)
			}
		}

		// Cap buffer to avoid unbounded growth on garbage streams.
		if len(buf) > 64*1024 {
			buf = buf[len(buf)-4096:]
		}
	}
}
