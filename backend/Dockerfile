# Multi-stage Dockerfile for Go Backend Core
FROM golang:alpine AS builder

WORKDIR /build

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /build/server ./cmd/server

# Final minimal runner image (< 20MB)
FROM alpine:3.20

RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app

COPY --from=builder /build/server /app/server

EXPOSE 8080 9201

CMD ["/app/server"]
