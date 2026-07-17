FROM golang:1.22-alpine AS builder

RUN apk add --no-cache protobuf-dev protoc

WORKDIR /src

COPY proto/*.proto ./proto/
COPY go-server/go.mod go-server/go.sum* ./go-server/

WORKDIR /src/go-server

RUN go mod download

RUN go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.35.2 && \
    go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.5.1

ENV PATH="/go/bin:${PATH}"

RUN mkdir -p echo api eliza && \
    protoc --proto_path=/src/proto \
      --go_out=echo --go_opt=paths=source_relative \
      --go-grpc_out=echo --go-grpc_opt=paths=source_relative \
            /src/proto/echo.proto && \
        protoc --proto_path=/src/proto \
            --go_out=api --go_opt=paths=source_relative \
            --go-grpc_out=api --go-grpc_opt=paths=source_relative \
            /src/proto/api.proto && \
        protoc --proto_path=/src/proto \
            --go_out=eliza --go_opt=paths=source_relative \
            --go-grpc_out=eliza --go-grpc_opt=paths=source_relative \
            /src/proto/eliza.proto

COPY go-server/main.go ./

RUN go mod tidy

RUN CGO_ENABLED=0 go build -o /grpc-test-server .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates wget

WORKDIR /app

COPY --from=builder /grpc-test-server /app/grpc-test-server

ENV GRPC_PORT=50051
ENV HEALTH_PORT=50052

EXPOSE 50051 50052

CMD ["/app/grpc-test-server"]
