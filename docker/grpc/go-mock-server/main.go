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
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	pb "grpc-test-server/echo"

	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/reflection"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	"google.golang.org/protobuf/reflect/protodesc"
	"google.golang.org/protobuf/reflect/protoreflect"
	"google.golang.org/protobuf/types/descriptorpb"
)

const (
	defaultMockStatusCode = 12 // UNIMPLEMENTED
)

type mockRuleSet struct {
	Rules           []mockRule           `json:"rules"`
	DefaultResponse *mockDefaultResponse `json:"defaultResponse,omitempty"`
}

type mockRule struct {
	ID        string        `json:"id"`
	Name      string        `json:"name"`
	Enabled   bool          `json:"enabled"`
	Priority  int           `json:"priority"`
	Predicate mockPredicate `json:"predicate"`
	Response  mockResponse  `json:"response"`
}

type mockPredicate struct {
	Kind       string          `json:"kind"`
	Method     string          `json:"method,omitempty"`
	Service    string          `json:"service,omitempty"`
	Key        string          `json:"key,omitempty"`
	Value      string          `json:"value,omitempty"`
	Path       string          `json:"path,omitempty"`
	Predicates []mockPredicate `json:"predicates,omitempty"`
	Predicate  *mockPredicate  `json:"predicate,omitempty"`
}

type mockResponse struct {
	StatusCode          *int     `json:"statusCode,omitempty"`
	Message             string   `json:"message,omitempty"`
	Messages            []string `json:"messages,omitempty"`
	LatencyMs           *int     `json:"latencyMs,omitempty"`
	InterMessageDelayMs *int     `json:"interMessageDelayMs,omitempty"`
	Body                any      `json:"body,omitempty"`
}

type mockDefaultResponse struct {
	StatusCode *int   `json:"statusCode,omitempty"`
	Message    string `json:"message,omitempty"`
}

type mockEvaluationContext struct {
	Service     string
	Method      string
	Metadata    map[string]string
	RequestBody any
}

type mockEvaluation struct {
	Matched     bool
	UsedDefault bool
	RuleID      string
	RuleName    string
	Response    mockResponse
}

type descriptorCheck struct {
	Path         string `json:"path"`
	ExpectedSvc  string `json:"expectedService"`
	Loaded       bool   `json:"loaded"`
	ServiceFound bool   `json:"serviceFound"`
}

type mockEngine struct {
	mu         sync.RWMutex
	rules      mockRuleSet
	rulePath   string
	descriptor descriptorCheck
}

type mockGrpcServer struct {
	pb.UnimplementedEchoServiceServer
	engine *mockEngine
}

func loadRuleSet(path string) (mockRuleSet, error) {
	if strings.TrimSpace(path) == "" {
		return mockRuleSet{}, fmt.Errorf("MOCK_RULE_SET_FILE is required")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return mockRuleSet{}, fmt.Errorf("read rule set: %w", err)
	}
	var rules mockRuleSet
	if err := json.Unmarshal(raw, &rules); err != nil {
		return mockRuleSet{}, fmt.Errorf("parse rule set: %w", err)
	}
	if len(rules.Rules) == 0 {
		return mockRuleSet{}, fmt.Errorf("rule set has no rules")
	}
	for idx := range rules.Rules {
		if strings.TrimSpace(rules.Rules[idx].ID) == "" {
			return mockRuleSet{}, fmt.Errorf("rule at index %d is missing id", idx)
		}
		if strings.TrimSpace(rules.Rules[idx].Name) == "" {
			rules.Rules[idx].Name = rules.Rules[idx].ID
		}
	}
	return rules, nil
}

func loadDescriptorSet(path, expectedService string) (descriptorCheck, error) {
	check := descriptorCheck{
		Path:        path,
		ExpectedSvc: expectedService,
	}
	if strings.TrimSpace(path) == "" {
		return check, nil
	}

	raw, err := os.ReadFile(path)
	if err != nil {
		return check, fmt.Errorf("read descriptor set: %w", err)
	}

	set := &descriptorpb.FileDescriptorSet{}
	if err := proto.Unmarshal(raw, set); err != nil {
		return check, fmt.Errorf("parse descriptor set: %w", err)
	}

	files, err := protodesc.NewFiles(set)
	if err != nil {
		return check, fmt.Errorf("load descriptor files: %w", err)
	}
	check.Loaded = true

	if strings.TrimSpace(expectedService) == "" {
		return check, nil
	}

	want := protoreflect.FullName(expectedService)
	found := false
	files.RangeFiles(func(fd protoreflect.FileDescriptor) bool {
		services := fd.Services()
		for i := 0; i < services.Len(); i++ {
			if services.Get(i).FullName() == want {
				found = true
				return false
			}
		}
		return true
	})
	if !found {
		return check, fmt.Errorf("expected service %q not found in descriptor set", expectedService)
	}
	check.ServiceFound = true
	return check, nil
}

func normalizeMetadata(ctx context.Context) map[string]string {
	out := map[string]string{}
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return out
	}
	for key, values := range md {
		if len(values) == 0 {
			continue
		}
		out[strings.ToLower(strings.TrimSpace(key))] = values[0]
	}
	return out
}

func toComparableString(value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case string:
		return typed
	case bool:
		if typed {
			return "true"
		}
		return "false"
	case float64:
		return strconv.FormatFloat(typed, 'f', -1, 64)
	case float32:
		return strconv.FormatFloat(float64(typed), 'f', -1, 64)
	case int, int8, int16, int32, int64:
		return fmt.Sprintf("%d", typed)
	case uint, uint8, uint16, uint32, uint64:
		return fmt.Sprintf("%d", typed)
	default:
		bytes, err := json.Marshal(typed)
		if err != nil {
			return fmt.Sprintf("%v", typed)
		}
		return string(bytes)
	}
}

func resolveBodyPath(value any, path string) (any, bool) {
	if strings.TrimSpace(path) == "" {
		return nil, false
	}
	segments := strings.Split(path, ".")
	current := value
	for _, rawSeg := range segments {
		segment := strings.TrimSpace(rawSeg)
		if segment == "" {
			return nil, false
		}
		switch typed := current.(type) {
		case map[string]any:
			next, ok := typed[segment]
			if !ok {
				return nil, false
			}
			current = next
		case map[string]string:
			next, ok := typed[segment]
			if !ok {
				return nil, false
			}
			current = next
		case []any:
			index, err := strconv.Atoi(segment)
			if err != nil || index < 0 || index >= len(typed) {
				return nil, false
			}
			current = typed[index]
		default:
			return nil, false
		}
	}
	return current, true
}

func evaluatePredicate(predicate mockPredicate, evalCtx mockEvaluationContext) bool {
	switch predicate.Kind {
	case "method_equals":
		return evalCtx.Method == predicate.Method
	case "service_equals":
		return evalCtx.Service == predicate.Service
	case "metadata_equals":
		value, ok := evalCtx.Metadata[strings.ToLower(strings.TrimSpace(predicate.Key))]
		return ok && value == predicate.Value
	case "metadata_exists":
		_, ok := evalCtx.Metadata[strings.ToLower(strings.TrimSpace(predicate.Key))]
		return ok
	case "body_path_equals":
		value, ok := resolveBodyPath(evalCtx.RequestBody, predicate.Path)
		return ok && toComparableString(value) == predicate.Value
	case "body_path_exists":
		_, ok := resolveBodyPath(evalCtx.RequestBody, predicate.Path)
		return ok
	case "and":
		if len(predicate.Predicates) == 0 {
			return false
		}
		for _, child := range predicate.Predicates {
			if !evaluatePredicate(child, evalCtx) {
				return false
			}
		}
		return true
	case "or":
		for _, child := range predicate.Predicates {
			if evaluatePredicate(child, evalCtx) {
				return true
			}
		}
		return false
	case "not":
		if predicate.Predicate == nil {
			return false
		}
		return !evaluatePredicate(*predicate.Predicate, evalCtx)
	case "expression":
		// Intentionally not supported in the fixture service.
		return false
	default:
		return false
	}
}

func statusCodeFromResponse(response mockResponse, defaultStatus int) int {
	if response.StatusCode != nil {
		return *response.StatusCode
	}
	return defaultStatus
}

func statusMessageFromResponse(response mockResponse, fallback string) string {
	if strings.TrimSpace(response.Message) != "" {
		return response.Message
	}
	if strings.TrimSpace(fallback) != "" {
		return fallback
	}
	return "Mock rule did not return a response body"
}

func (engine *mockEngine) evaluate(evalCtx mockEvaluationContext) mockEvaluation {
	engine.mu.RLock()
	defer engine.mu.RUnlock()

	rules := append([]mockRule{}, engine.rules.Rules...)
	sort.SliceStable(rules, func(i, j int) bool {
		if rules[i].Priority == rules[j].Priority {
			return rules[i].ID < rules[j].ID
		}
		return rules[i].Priority > rules[j].Priority
	})

	for _, rule := range rules {
		if !rule.Enabled {
			continue
		}
		if evaluatePredicate(rule.Predicate, evalCtx) {
			return mockEvaluation{
				Matched:  true,
				RuleID:   rule.ID,
				RuleName: rule.Name,
				Response: rule.Response,
			}
		}
	}

	defaultMessage := "No matching mock rule"
	defaultStatus := defaultMockStatusCode
	if engine.rules.DefaultResponse != nil {
		if engine.rules.DefaultResponse.StatusCode != nil {
			defaultStatus = *engine.rules.DefaultResponse.StatusCode
		}
		if strings.TrimSpace(engine.rules.DefaultResponse.Message) != "" {
			defaultMessage = engine.rules.DefaultResponse.Message
		}
	}
	return mockEvaluation{
		Matched:     false,
		UsedDefault: true,
		Response: mockResponse{
			StatusCode: &defaultStatus,
			Message:    defaultMessage,
		},
	}
}

func applyLatency(ctx context.Context, ms *int) error {
	if ms == nil || *ms <= 0 {
		return nil
	}
	timer := time.NewTimer(time.Duration(*ms) * time.Millisecond)
	defer timer.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-timer.C:
		return nil
	}
}

func makeStatusError(response mockResponse, fallbackMessage string, defaultStatus int) error {
	statusCode := statusCodeFromResponse(response, defaultStatus)
	if statusCode <= 0 {
		return nil
	}
	if statusCode > int(codes.Unauthenticated) {
		statusCode = int(codes.Unknown)
	}
	return status.Error(codes.Code(statusCode), statusMessageFromResponse(response, fallbackMessage))
}

func messageFromRule(response mockResponse, fallback string) string {
	if strings.TrimSpace(response.Message) != "" {
		return response.Message
	}
	if bodyMap, ok := response.Body.(map[string]any); ok {
		if message, ok := bodyMap["message"].(string); ok && strings.TrimSpace(message) != "" {
			return message
		}
	}
	return fallback
}

func (s *mockGrpcServer) Echo(ctx context.Context, req *pb.EchoRequest) (*pb.EchoResponse, error) {
	eval := s.engine.evaluate(mockEvaluationContext{
		Service:     "echo.EchoService",
		Method:      "Echo",
		Metadata:    normalizeMetadata(ctx),
		RequestBody: map[string]any{"message": req.GetMessage()},
	})

	if err := applyLatency(ctx, eval.Response.LatencyMs); err != nil {
		return nil, status.Error(codes.Canceled, "call cancelled")
	}
	defaultStatus := 0
	if eval.UsedDefault {
		defaultStatus = defaultMockStatusCode
	}
	if statusErr := makeStatusError(eval.Response, "Mock rule returned non-success status", defaultStatus); statusErr != nil {
		return nil, statusErr
	}

	return &pb.EchoResponse{Message: messageFromRule(eval.Response, req.GetMessage())}, nil
}

func (s *mockGrpcServer) CreateComplexEcho(ctx context.Context, req *pb.ComplexEchoRequest) (*pb.ComplexEchoResponse, error) {
	eval := s.engine.evaluate(mockEvaluationContext{
		Service:  "echo.EchoService",
		Method:   "CreateComplexEcho",
		Metadata: normalizeMetadata(ctx),
		RequestBody: map[string]any{
			"message":    req.GetMessage(),
			"labels":     req.GetLabels(),
			"attributes": req.GetAttributes(),
		},
	})

	if err := applyLatency(ctx, eval.Response.LatencyMs); err != nil {
		return nil, status.Error(codes.Canceled, "call cancelled")
	}
	defaultStatus := 0
	if eval.UsedDefault {
		defaultStatus = defaultMockStatusCode
	}
	if statusErr := makeStatusError(eval.Response, "Mock rule returned non-success status", defaultStatus); statusErr != nil {
		return nil, statusErr
	}

	message := messageFromRule(eval.Response, req.GetMessage())
	if strings.TrimSpace(message) == "" {
		message = "mock-complex"
	}
	return &pb.ComplexEchoResponse{
		RequestId:      fmt.Sprintf("mock-%d", time.Now().UnixNano()),
		Message:        message,
		Labels:         req.GetLabels(),
		Attributes:     req.GetAttributes(),
		ReceivedUnixMs: time.Now().UnixMilli(),
	}, nil
}

func (s *mockGrpcServer) ServerStream(req *pb.StreamRequest, stream pb.EchoService_ServerStreamServer) error {
	eval := s.engine.evaluate(mockEvaluationContext{
		Service:     "echo.EchoService",
		Method:      "ServerStream",
		Metadata:    normalizeMetadata(stream.Context()),
		RequestBody: map[string]any{"message": req.GetMessage(), "repeat_count": req.GetRepeatCount(), "interval_ms": req.GetIntervalMs()},
	})

	if err := applyLatency(stream.Context(), eval.Response.LatencyMs); err != nil {
		return status.Error(codes.Canceled, "call cancelled")
	}
	defaultStatus := 0
	if eval.UsedDefault {
		defaultStatus = defaultMockStatusCode
	}
	if statusErr := makeStatusError(eval.Response, "Mock rule returned non-success status", defaultStatus); statusErr != nil {
		return statusErr
	}

	messages := eval.Response.Messages
	if len(messages) == 0 {
		messages = []string{messageFromRule(eval.Response, "mock-stream")}
	}

	for idx, msg := range messages {
		if err := stream.Send(&pb.EchoResponse{Message: msg}); err != nil {
			return err
		}
		if idx < len(messages)-1 {
			if err := applyLatency(stream.Context(), eval.Response.InterMessageDelayMs); err != nil {
				return status.Error(codes.Canceled, "call cancelled")
			}
		}
	}
	return nil
}

func (s *mockGrpcServer) ClientStream(stream pb.EchoService_ClientStreamServer) error {
	messages := make([]string, 0, 4)
	for {
		req, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}
		messages = append(messages, req.GetMessage())
	}

	eval := s.engine.evaluate(mockEvaluationContext{
		Service:     "echo.EchoService",
		Method:      "ClientStream",
		Metadata:    normalizeMetadata(stream.Context()),
		RequestBody: map[string]any{"messages": messages},
	})
	if err := applyLatency(stream.Context(), eval.Response.LatencyMs); err != nil {
		return status.Error(codes.Canceled, "call cancelled")
	}
	defaultStatus := 0
	if eval.UsedDefault {
		defaultStatus = defaultMockStatusCode
	}
	if statusErr := makeStatusError(eval.Response, "Mock rule returned non-success status", defaultStatus); statusErr != nil {
		return statusErr
	}

	joined := strings.Join(messages, ",")
	return stream.SendAndClose(&pb.EchoResponse{Message: messageFromRule(eval.Response, joined)})
}

func (s *mockGrpcServer) BidiStream(stream pb.EchoService_BidiStreamServer) error {
	for {
		req, err := stream.Recv()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}

		eval := s.engine.evaluate(mockEvaluationContext{
			Service:     "echo.EchoService",
			Method:      "BidiStream",
			Metadata:    normalizeMetadata(stream.Context()),
			RequestBody: map[string]any{"message": req.GetMessage()},
		})
		if err := applyLatency(stream.Context(), eval.Response.LatencyMs); err != nil {
			return status.Error(codes.Canceled, "call cancelled")
		}
		defaultStatus := 0
		if eval.UsedDefault {
			defaultStatus = defaultMockStatusCode
		}
		if statusErr := makeStatusError(eval.Response, "Mock rule returned non-success status", defaultStatus); statusErr != nil {
			return statusErr
		}
		if err := stream.Send(&pb.EchoResponse{Message: messageFromRule(eval.Response, req.GetMessage())}); err != nil {
			return err
		}
	}
}

func startHealthServer(port string, engine *mockEngine) {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, _ *http.Request) {
		engine.mu.RLock()
		payload := map[string]any{
			"status":      "ok",
			"service":     "grpc-go-mock-servicer",
			"ruleSetPath": engine.rulePath,
			"ruleCount":   len(engine.rules.Rules),
			"descriptor":  engine.descriptor,
		}
		engine.mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(payload)
	})
	mux.HandleFunc("/rules", func(w http.ResponseWriter, _ *http.Request) {
		engine.mu.RLock()
		rules := append([]mockRule{}, engine.rules.Rules...)
		engine.mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"ruleCount": len(rules),
			"rules":     rules,
		})
	})

	addr := ":" + port
	log.Printf("mock health server listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("mock health server failed: %v", err)
	}
}

func main() {
	grpcPort := strings.TrimSpace(os.Getenv("MOCK_GRPC_PORT"))
	if grpcPort == "" {
		grpcPort = "50061"
	}
	healthPort := strings.TrimSpace(os.Getenv("MOCK_HEALTH_PORT"))
	if healthPort == "" {
		healthPort = "50062"
	}

	rulePath := strings.TrimSpace(os.Getenv("MOCK_RULE_SET_FILE"))
	if rulePath == "" {
		rulePath = "/app/config/rules.json"
	}
	descriptorPath := strings.TrimSpace(os.Getenv("MOCK_DESCRIPTOR_SET_FILE"))
	if descriptorPath == "" {
		descriptorPath = "/app/config/echo.protoset"
	}
	descriptorService := strings.TrimSpace(os.Getenv("MOCK_DESCRIPTOR_SERVICE"))
	if descriptorService == "" {
		descriptorService = "echo.EchoService"
	}

	rules, err := loadRuleSet(rulePath)
	if err != nil {
		log.Fatalf("mock rule set load failed: %v", err)
	}

	descriptor, err := loadDescriptorSet(descriptorPath, descriptorService)
	if err != nil {
		log.Fatalf("descriptor loading failed: %v", err)
	}

	engine := &mockEngine{
		rules:      rules,
		rulePath:   rulePath,
		descriptor: descriptor,
	}

	go startHealthServer(healthPort, engine)

	lis, err := net.Listen("tcp", ":"+grpcPort)
	if err != nil {
		log.Fatalf("listen failed: %v", err)
	}

	srv := grpc.NewServer()
	pb.RegisterEchoServiceServer(srv, &mockGrpcServer{engine: engine})
	reflection.Register(srv)

	log.Printf("go mock servicer listening on :%s (rules=%d, descriptorLoaded=%t, serviceFound=%t)",
		grpcPort,
		len(rules.Rules),
		descriptor.Loaded,
		descriptor.ServiceFound,
	)
	if err := srv.Serve(lis); err != nil {
		log.Fatalf("serve failed: %v", err)
	}
}
