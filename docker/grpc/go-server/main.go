package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	pb "grpc-test-server/echo"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/status"
)

type echoServer struct {
	pb.UnimplementedEchoServiceServer
}

func (s *echoServer) Echo(ctx context.Context, req *pb.EchoRequest) (*pb.EchoResponse, error) {
	msg := req.GetMessage()
	if strings.HasPrefix(msg, "@sleep:") {
		msStr := strings.TrimPrefix(msg, "@sleep:")
		ms, err := strconv.Atoi(msStr)
		if err == nil && ms > 0 {
			timer := time.NewTimer(time.Duration(ms) * time.Millisecond)
			select {
			case <-ctx.Done():
				timer.Stop()
				return nil, status.Error(codes.Canceled, "call cancelled")
			case <-timer.C:
				return &pb.EchoResponse{Message: msg}, nil
			}
		}
	}
	return &pb.EchoResponse{Message: msg}, nil
}

func (s *echoServer) ServerStream(req *pb.StreamRequest, stream pb.EchoService_ServerStreamServer) error {
	count := int(req.GetRepeatCount())
	if count <= 0 {
		count = 1
	}
	interval := time.Duration(req.GetIntervalMs()) * time.Millisecond
	base := req.GetMessage()
	if base == "" {
		base = "stream"
	}

	for i := 1; i <= count; i++ {
		if err := stream.Context().Err(); err != nil {
			return err
		}
		msg := base
		if count > 1 {
			msg = fmt.Sprintf("%s [%d/%d]", base, i, count)
		}
		if err := stream.Send(&pb.EchoResponse{Message: msg}); err != nil {
			return err
		}
		if interval > 0 && i < count {
			timer := time.NewTimer(interval)
			select {
			case <-stream.Context().Done():
				timer.Stop()
				return stream.Context().Err()
			case <-timer.C:
			}
		}
	}
	return nil
}

func (s *echoServer) ClientStream(stream pb.EchoService_ClientStreamServer) error {
	var parts []string
	for {
		req, err := stream.Recv()
		if err == io.EOF {
			aggregated := strings.Join(parts, ",")
			return stream.SendAndClose(&pb.EchoResponse{Message: aggregated})
		}
		if err != nil {
			return err
		}
		parts = append(parts, req.GetMessage())
	}
}

func (s *echoServer) BidiStream(stream pb.EchoService_BidiStreamServer) error {
	for {
		req, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
		if err := stream.Send(&pb.EchoResponse{Message: req.GetMessage()}); err != nil {
			return err
		}
	}
}

func startHealthServer(port string) {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"status":  "ok",
			"service": "grpc-test-server",
		})
	})
	log.Printf("health listening on :%s", port)
	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatalf("health server failed: %v", err)
	}
}

func main() {
	grpcPort := os.Getenv("GRPC_PORT")
	if grpcPort == "" {
		grpcPort = "50051"
	}
	healthPort := os.Getenv("HEALTH_PORT")
	if healthPort == "" {
		healthPort = "50052"
	}

	go startHealthServer(healthPort)

	lis, err := net.Listen("tcp", ":"+grpcPort)
	if err != nil {
		log.Fatalf("listen failed: %v", err)
	}

	s := grpc.NewServer()
	pb.RegisterEchoServiceServer(s, &echoServer{})
	reflection.Register(s)

	log.Printf("gRPC echo server listening on :%s (reflection enabled, 4 RPCs)", grpcPort)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("serve failed: %v", err)
	}
}
