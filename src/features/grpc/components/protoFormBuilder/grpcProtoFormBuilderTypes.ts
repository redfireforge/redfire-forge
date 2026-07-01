import type { GrpcFieldSchema, GrpcMessageSchema } from '../../../../shared/grpc/contracts';

export interface GrpcProtoFieldRowProps {
  field: GrpcFieldSchema;
  value: unknown;
  disabled?: boolean;
  messageIndex?: Map<string, GrpcMessageSchema>;
  onChange: (value: unknown) => void;
  onFieldError?: (hasError: boolean) => void;
  fieldErrorKey?: string;
  inputTestId?: string;
}

export interface GrpcProtoOneofGroupRowProps {
  oneofName: string;
  members: GrpcFieldSchema[];
  body: Record<string, unknown>;
  disabled?: boolean;
  messageIndex?: Map<string, GrpcMessageSchema>;
  onSelectMember: (member: GrpcFieldSchema, raw: unknown) => void;
  onFieldError: (fieldKey: string, hasError: boolean) => void;
}
