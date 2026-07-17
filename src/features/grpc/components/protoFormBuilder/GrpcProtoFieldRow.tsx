import { isGrpcWellKnownFieldType } from '../../utils/grpcProtoFormValues';
import { fieldNoteLabel, fieldTypeBadgeLabel } from '../../utils/grpcProtoFormFieldLabels';
import { GrpcProtoScalarFieldControl } from './GrpcProtoScalarFieldControl';
import { resolveNestedMessageSchema } from '../../utils/grpcBodyComposer';
import {
  GrpcProtoAnyFieldRow,
  GrpcProtoNestedMessageFieldRow,
  GrpcProtoWktJsonFieldRow,
  GrpcProtoWktScalarFieldRow,
} from './GrpcProtoWktRows';
import { GrpcProtoMapFieldRow, GrpcProtoRepeatedFieldRow } from './GrpcProtoRepeatedMapRows';
import type { GrpcProtoFieldRowProps } from './grpcProtoFormBuilderTypes';

export function GrpcProtoFieldRow(props: GrpcProtoFieldRowProps) {
  const { field, messageIndex } = props;

  if (field.isMap) {
    return <GrpcProtoMapFieldRow {...props} />;
  }

  if (field.label === 'repeated') {
    return <GrpcProtoRepeatedFieldRow {...props} fieldErrorKey={props.fieldErrorKey ?? field.name} />;
  }

  if (field.type === 'message') {
    return (
      <GrpcProtoNestedMessageFieldRow
        {...props}
        messageSchema={resolveNestedMessageSchema(field, messageIndex)}
      />
    );
  }

  if (field.type === 'google.protobuf.Any') {
    return <GrpcProtoAnyFieldRow {...props} />;
  }

  if (isGrpcWellKnownFieldType(field.type)
    && (field.type === 'google.protobuf.Struct'
      || field.type === 'google.protobuf.Value')) {
    return <GrpcProtoWktJsonFieldRow {...props} />;
  }

  if (isGrpcWellKnownFieldType(field.type)) {
    return <GrpcProtoWktScalarFieldRow {...props} />;
  }

  return (
    <div className="grpc-proto-field-row" data-testid={`grpc-proto-field-${field.name}`}>
      <div className="grpc-proto-field-name">
        {field.name}
        <span className={`grpc-proto-type-badge grpc-proto-type-badge--${field.type}`}>
          {fieldTypeBadgeLabel(field)}
        </span>
      </div>
      <div className="grpc-proto-field-control">
        <GrpcProtoScalarFieldControl
          field={field}
          value={props.value}
          disabled={props.disabled}
          onChange={props.onChange}
          onFieldError={props.onFieldError}
        />
      </div>
      <span className="grpc-proto-field-note">{fieldNoteLabel(field)}</span>
    </div>
  );
}
