import { defaultValueForGrpcField, resolveActiveOneofMember } from '../../utils/grpcProtoFormValues';
import { GrpcProtoFieldRow } from './GrpcProtoFieldRow';
import { CustomSelect } from '@shared/components/CustomSelect';
import type { GrpcProtoOneofGroupRowProps } from './grpcProtoFormBuilderTypes';

export function GrpcProtoOneofGroupRow({
  oneofName,
  members,
  body,
  displayMode = 'standalone',
  disabled,
  messageIndex,
  onSelectMember,
  onFieldError,
}: GrpcProtoOneofGroupRowProps) {
  const activeName = resolveActiveOneofMember(members, body) ?? members[0]?.name ?? '';
  const activeMember = members.find((member) => member.name === activeName) ?? members[0];

  const handleMemberChange = (nextMemberName: string) => {
    const nextMember = members.find((member) => member.name === nextMemberName);
    if (!nextMember) return;
    onSelectMember(nextMember, defaultValueForGrpcField(nextMember));
  };

  if (!activeMember) {
    return null;
  }

  const controls = (
    <>
      <div className="grpc-proto-oneof-controls">
        <div className="grpc-proto-oneof-meta">
          <span className="grpc-proto-oneof-meta-label">Choose active branch</span>
          <span className="grpc-proto-oneof-meta-value">{activeMember.name}</span>
        </div>
        <div className="grpc-proto-oneof-radio-row" role="radiogroup" aria-label={`${oneofName} oneof`}>
          {members.map((member) => (
            <button
              key={member.name}
              type="button"
              role="radio"
              aria-checked={activeMember.name === member.name}
              className={`grpc-proto-oneof-radio${activeMember.name === member.name ? ' grpc-proto-oneof-radio--active' : ''}`}
              data-testid={`grpc-proto-oneof-radio-${oneofName}-${member.name}`}
              disabled={disabled}
              onClick={() => handleMemberChange(member.name)}
            >
              {member.name}
            </button>
          ))}
        </div>
        <label className="grpc-proto-oneof-label visually-hidden" htmlFor={`grpc-proto-oneof-select-${oneofName}`}>
          Active field
        </label>
        <CustomSelect
          className="grpc-proto-oneof-select visually-hidden"
          data-testid={`grpc-proto-oneof-select-${oneofName}`}
          aria-label="Active field"
          value={activeMember.name}
          disabled={disabled}
          onChange={(v) => handleMemberChange(v)}
          options={members.map((member) => ({
            value: member.name,
            label: member.name,
          }))}
        />
      </div>
      <GrpcProtoFieldRow
        key={activeMember.name}
        field={activeMember}
        value={body[activeMember.name]}
        disabled={disabled}
        messageIndex={messageIndex}
        onChange={(raw) => onSelectMember(activeMember, raw)}
        onFieldError={(hasError) => onFieldError(activeMember.name, hasError)}
        fieldErrorKey={`${oneofName}.${activeMember.name}`}
      />
    </>
  );

  if (displayMode === 'embedded') {
    return (
      <div className="grpc-proto-oneof-embedded" data-testid={`grpc-proto-oneof-${oneofName}`}>
        {controls}
      </div>
    );
  }

  return (
    <div
      className="grpc-proto-field-row grpc-proto-field-row--oneof"
      data-testid={`grpc-proto-oneof-${oneofName}`}
    >
      <div className="grpc-proto-field-header">
        <div className="grpc-proto-field-name">
          {oneofName}
          <span className="grpc-proto-type-badge grpc-proto-type-badge--oneof">oneof</span>
        </div>
      </div>
      {controls}
    </div>
  );
}
