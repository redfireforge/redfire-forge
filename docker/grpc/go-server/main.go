package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
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

	pbApi "grpc-test-server/api"
	pb "grpc-test-server/echo"
	pbEliza "grpc-test-server/eliza"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials"
	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/status"
)

type echoServer struct {
	pb.UnimplementedEchoServiceServer
}

type elizaServer struct {
	pbEliza.UnimplementedElizaServiceServer
}

func (s *elizaServer) Say(ctx context.Context, req *pbEliza.SayRequest) (*pbEliza.SayResponse, error) {
	select {
	case <-ctx.Done():
		return nil, status.Error(codes.Canceled, "call cancelled")
	default:
	}

	text := strings.TrimSpace(req.GetSentence())
	if text == "" {
		text = "hello"
	}

	return &pbEliza.SayResponse{Sentence: text}, nil
}

func (s *elizaServer) Introduce(req *pbEliza.IntroduceRequest, stream pbEliza.ElizaService_IntroduceServer) error {
	base := strings.TrimSpace(req.GetSentence())
	if base == "" {
		base = "Hi, I am Eliza"
	}

	parts := []string{
		base,
		"I can reflect your statements",
		"Try Converse for a bidirectional exchange",
	}

	for _, part := range parts {
		if err := stream.Context().Err(); err != nil {
			return err
		}
		if err := stream.Send(&pbEliza.IntroduceResponse{Sentence: part}); err != nil {
			return err
		}
	}

	return nil
}

func (s *elizaServer) Converse(stream pbEliza.ElizaService_ConverseServer) error {
	for {
		req, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}

		text := strings.TrimSpace(req.GetSentence())
		if text == "" {
			text = "..."
		}

		if err := stream.Send(&pbEliza.ConverseResponse{Sentence: text}); err != nil {
			return err
		}
	}
}

func handleApiLookup(ctx context.Context, req *pbApi.LookupRequest) (*pbApi.LookupResponse, error) {
	select {
	case <-ctx.Done():
		return nil, status.Error(codes.Canceled, "call cancelled")
	default:
	}

	ref := req.GetRef()
	resolvedID := strings.TrimSpace(ref.GetId())
	if resolvedID == "" {
		resolvedID = "unknown"
	}

	return &pbApi.LookupResponse{
		Status:     "ok",
		ResolvedId: resolvedID,
	}, nil
}

func apiUnknownServiceHandler(_ any, stream grpc.ServerStream) error {
	transport := grpc.ServerTransportStreamFromContext(stream.Context())
	if transport == nil || transport.Method() != "/api.ApiService/Lookup" {
		return status.Error(codes.Unimplemented, "unknown service/method")
	}

	var req pbApi.LookupRequest
	if err := stream.RecvMsg(&req); err != nil && err != io.EOF {
		return err
	}

	resp, err := handleApiLookup(stream.Context(), &req)
	if err != nil {
		return err
	}

	if err := stream.SendMsg(resp); err != nil {
		return err
	}

	return nil
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

func (s *echoServer) CreateComplexEcho(ctx context.Context, req *pb.ComplexEchoRequest) (*pb.ComplexEchoResponse, error) {
	if err := ctx.Err(); err != nil {
		return nil, status.Error(codes.Canceled, "call cancelled")
	}

	message := req.GetMessage()
	if strings.TrimSpace(message) == "" {
		message = "complex-echo"
	}

	labels := req.GetLabels()
	if labels == nil {
		labels = []string{}
	}

	attributes := req.GetAttributes()
	if attributes == nil {
		attributes = map[string]string{}
	}

	requestID := fmt.Sprintf("complex-%d", time.Now().UnixNano())
	resp := &pb.ComplexEchoResponse{
		RequestId:       requestID,
		Message:         message,
		Labels:          labels,
		Attributes:      attributes,
		ReceivedUnixMs:  time.Now().UnixMilli(),
		ShippingAddress: req.GetShippingAddress(),
		Deadline:        req.GetDeadline(),
	}

	// The request/response oneof wrapper types are distinct generated types even
	// though the members mirror each other 1:1 — re-wrap rather than assign directly.
	switch member := req.GetPaymentMethod().(type) {
	case *pb.ComplexEchoRequest_Card:
		resp.PaymentMethod = &pb.ComplexEchoResponse_Card{Card: member.Card}
	case *pb.ComplexEchoRequest_Invoice:
		resp.PaymentMethod = &pb.ComplexEchoResponse_Invoice{Invoice: member.Invoice}
	}

	return resp, nil
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

func loadServerCredentials() (credentials.TransportCredentials, bool, error) {
	certFile := strings.TrimSpace(os.Getenv("TLS_CERT_FILE"))
	keyFile := strings.TrimSpace(os.Getenv("TLS_KEY_FILE"))
	clientCAFile := strings.TrimSpace(os.Getenv("TLS_CLIENT_CA_FILE"))

	if certFile == "" || keyFile == "" {
		return nil, false, nil
	}

	serverCert, err := tls.LoadX509KeyPair(certFile, keyFile)
	if err != nil {
		return nil, false, fmt.Errorf("load TLS key pair: %w", err)
	}

	tlsConfig := &tls.Config{
		Certificates: []tls.Certificate{serverCert},
		MinVersion:   tls.VersionTLS12,
	}

	mtlsEnabled := false
	if clientCAFile != "" {
		caPem, err := os.ReadFile(clientCAFile)
		if err != nil {
			return nil, false, fmt.Errorf("read client CA: %w", err)
		}
		pool := x509.NewCertPool()
		if ok := pool.AppendCertsFromPEM(caPem); !ok {
			return nil, false, fmt.Errorf("parse client CA: no certificates found")
		}
		tlsConfig.ClientAuth = tls.RequireAndVerifyClientCert
		tlsConfig.ClientCAs = pool
		mtlsEnabled = true
	}

	return credentials.NewTLS(tlsConfig), mtlsEnabled, nil
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

	serverOptions := []grpc.ServerOption{
		grpc.UnknownServiceHandler(apiUnknownServiceHandler),
	}

	transportLabel := "plaintext"
	creds, mtlsEnabled, err := loadServerCredentials()
	if err != nil {
		log.Fatalf("TLS setup failed: %v", err)
	}
	if creds != nil {
		serverOptions = append(serverOptions, grpc.Creds(creds))
		if mtlsEnabled {
			transportLabel = "mtls"
		} else {
			transportLabel = "tls"
		}
	}

	s := grpc.NewServer(serverOptions...)
	pb.RegisterEchoServiceServer(s, &echoServer{})
	pbEliza.RegisterElizaServiceServer(s, &elizaServer{})
	reflection.Register(s)

	log.Printf("gRPC test server listening on :%s (%s; reflection enabled: EchoService, ElizaService; grpcurl compatibility: api.ApiService/Lookup)", grpcPort, transportLabel)
	if err := s.Serve(lis); err != nil {
		log.Fatalf("serve failed: %v", err)
	}
}
