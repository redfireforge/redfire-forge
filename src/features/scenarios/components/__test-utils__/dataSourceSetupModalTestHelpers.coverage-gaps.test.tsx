/**
 * @vitest-environment jsdom
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import {
  makeFullPanelModalMock,
  makeSetupStepVariablesMock,
  makeSetupStepValidateMock,
  makeSetupStepReviewMock,
  makeColumnOrderPopoverMock,
  makeCsvTemplateMock,
  makeDataSourceSetupUtilsMock,
  makeTemplateHelpersMock,
  makeExecutorMock,
  makeApplyAuthHeadersMock,
  makeDataSourceImportMock,
  makeUuidMock,
  createTestScenario,
  scenarioWithExtraValidateColumn,
  ensurePathVariableChecked,
} from './dataSourceSetupModalTestHelpers';

describe('dataSourceSetupModalTestHelpers coverage gaps', () => {
  it('buildConfiguredColumnDefs includes enabled body selections and skips disabled ones', () => {
    const utils = makeDataSourceSetupUtilsMock();
    const test = createTestScenario({
      validation: { mode: 'none', expectedFields: [] },
    } as any);

    const defs = utils.buildConfiguredColumnDefs({
      mode: 'configure',
      test,
      pathVars: [],
      bodySelections: {
        enabledBody: { enabled: true, name: 'enabledBody' },
        disabledBody: { enabled: false, name: 'disabledBody' },
      },
    } as any);

    expect(defs.some((d) => d.type === 'body' && d.mapping === 'enabledBody')).toBe(true);
    expect(defs.some((d) => d.type === 'body' && d.mapping === 'disabledBody')).toBe(false);
  });

  it('template token helpers return true for moustache tokens and false otherwise', () => {
    const utils = makeDataSourceSetupUtilsMock();
    const templateHelpers = makeTemplateHelpersMock();

    expect(utils.isTemplateToken('{{authToken}}')).toBe(true);
    expect(utils.isTemplateToken('authToken')).toBe(false);

    expect(templateHelpers.isTemplateToken('{{baseUrl}}')).toBe(true);
    expect(templateHelpers.isTemplateToken('baseUrl')).toBe(false);
  });

  it('mock component factories render and execute callback branches', () => {
    const FullPanel = makeFullPanelModalMock().default;
    const onClose = vi.fn();
    const fullPanel = render(
      <FullPanel title={<span>T</span>} footer={<span>F</span>} onClose={onClose}>
        <span>B</span>
      </FullPanel>,
    );
    fireEvent.click(fullPanel.getByTestId('full-panel-close'));
    expect(onClose).toHaveBeenCalledTimes(1);

    const Variables = makeSetupStepVariablesMock().default;
    const toggleSegment = vi.fn();
    const setVarName = vi.fn();
    const setParamSelection = vi.fn();
    const setHeaderSelection = vi.fn();
    const setBodySelection = vi.fn();
    const setWorkingAuthType = vi.fn();
    const patchWorkingAuth = vi.fn();
    const setUrlTemplateInput = vi.fn();
    const setIsTemplateCustomized = vi.fn();

    const variablesView = render(
      <Variables
        analysis={{ segments: [{ index: 0, segment: 'users', variableName: 'id0' }] }}
        selections={{ 0: { checked: false, name: 'id0' } }}
        toggleSegment={toggleSegment}
        setVarName={setVarName}
        urlParams={[{ key: 'channel', value: 'WEB' }]}
        setParamSelection={setParamSelection}
        headerCandidates={[{ key: 'Authorization', value: 'Bearer x' }]}
        setHeaderSelection={setHeaderSelection}
        bodyVariableCandidates={['payload.id']}
        setBodySelection={setBodySelection}
        setWorkingAuthType={setWorkingAuthType}
        patchWorkingAuth={patchWorkingAuth}
        autoUrlTemplate="https://x/{{id0}}"
        setUrlTemplateInput={setUrlTemplateInput}
        setIsTemplateCustomized={setIsTemplateCustomized}
      />,
    );
    fireEvent.click(variablesView.getByTestId('exercise-variable-callbacks'));
    fireEvent.click(variablesView.getByTestId('check-0'));
    fireEvent.change(variablesView.getByTestId('name-0'), { target: { value: 'idRenamed' } });
    expect(toggleSegment).toHaveBeenCalledWith(0);
    expect(setVarName).toHaveBeenCalledWith(0, 'idRenamed');
    expect(setWorkingAuthType).toHaveBeenCalledWith('bearer');

    const Validate = makeSetupStepValidateMock().default;
    const setValidationMode = vi.fn();
    const setValidateFields = vi.fn();
    const handleFetchForValidate = vi.fn();
    const setArrayModes = vi.fn();
    const validateView = render(
      <Validate
        validationMode="selective"
        setValidationMode={setValidationMode}
        validateFields={[{ jsonPath: 'x.y' }]}
        setValidateFields={setValidateFields}
        sampleJson='{"ok":true}'
        handleFetchForValidate={handleFetchForValidate}
        fetching={true}
        fetchError={{ message: 'e' }}
        setArrayModes={setArrayModes}
      />,
    );
    fireEvent.click(validateView.getByTestId('set-mode-none'));
    fireEvent.click(validateView.getByTestId('set-mode-full'));
    fireEvent.click(validateView.getByTestId('append-validate-field'));
    fireEvent.click(validateView.getByTestId('set-array-unordered'));
    fireEvent.click(validateView.getByTestId('run-fetch-validate'));
    expect(setValidationMode).toHaveBeenCalled();
    expect(setValidateFields).toHaveBeenCalled();
    expect(handleFetchForValidate).toHaveBeenCalled();

    const Review = makeSetupStepReviewMock().default;
    const setCopyName = vi.fn();
    const reviewView = render(
      <Review
        copyName="Copy"
        setCopyName={setCopyName}
        validationModeLabel="None"
        buildUrlTemplate={() => 'https://x/{{id}}'}
        reviewPathVariables={[{ variableName: 'id', sourceValue: '1' }]}
      />,
    );
    fireEvent.change(reviewView.getByTestId('copy-name'), { target: { value: 'Copy2' } });
    expect(setCopyName).toHaveBeenCalledWith('Copy2');

    const Popover = makeColumnOrderPopoverMock().default;
    const onApply = vi.fn();
    const onClosePopover = vi.fn();
    const popover = render(<Popover items={[1, 2]} onApply={onApply} onClose={onClosePopover} />);
    fireEvent.click(popover.getByTestId('col-order-apply'));
    fireEvent.click(popover.getByTestId('col-order-close'));
    expect(onApply).toHaveBeenCalledWith([1, 2]);
    expect(onClosePopover).toHaveBeenCalledTimes(1);
  });

  it('utility mocks cover parse and configured-def branches', () => {
    const csv = makeCsvTemplateMock();
    expect(csv.analyzeUrlPath('https://api.example.com/users/123').segments).toHaveLength(2);
    expect(csv.parseUrl('https://api.example.com/path?a=1').params).toEqual([{ key: 'a', value: '1' }]);
    expect(csv.parseUrl('not-a-url').params).toEqual([]);

    const utils = makeDataSourceSetupUtilsMock();
    const test = scenarioWithExtraValidateColumn();
    const defs = utils.buildConfiguredColumnDefs({
      mode: 'export',
      test: {
        ...test,
        dataSource: {
          id: 'ds-1',
          columns: [
            { id: 'c1', name: 'dupe', type: 'validate', mapping: 'meta' },
            { id: 'c2', name: 'other', type: 'body', mapping: 'x' },
          ],
          rows: [],
          source: { type: 'inline' },
        },
      } as any,
      pathVars: [{ segmentIndex: 0, variableName: 'userId' }],
      urlParams: [{ key: 'channel', value: 'WEB' }],
      paramSelections: { channel: { enabled: true, name: 'channel' } },
      headerSelections: {
        Authorization: { enabled: true, name: '' },
        Disabled: { enabled: false, name: 'x' },
      },
      bodySelections: {
        enabledBody: { enabled: true, name: 'enabledBody' },
        disabledBody: { enabled: false, name: 'disabledBody' },
      },
    } as any);

    expect(defs.some((d) => d.type === 'name')).toBe(true);
    expect(defs.some((d) => d.type === 'path' && d.mapping === 'userId')).toBe(true);
    expect(defs.some((d) => d.type === 'param' && d.mapping === 'channel')).toBe(true);
    expect(defs.some((d) => d.type === 'header' && d.mapping === 'Authorization')).toBe(true);
    expect(defs.some((d) => d.type === 'body' && d.mapping === 'enabledBody')).toBe(true);
    expect(defs.some((d) => d.type === 'body' && d.mapping === 'disabledBody')).toBe(false);
    expect(defs.filter((d) => d.type === 'validate' && d.mapping === 'meta')).toHaveLength(1);

    expect(utils.buildUrlTemplate('a', [], 'preview')).toBe('preview');
    expect(utils.isTemplateToken('{{x}}')).toBe(true);
    expect(utils.isTemplateToken('x')).toBe(false);

    const executor = makeExecutorMock();
    const auth = makeApplyAuthHeadersMock();
    const importMock = makeDataSourceImportMock();
    const uuid = makeUuidMock();
    expect(typeof executor.proxyFetch).toBe('function');
    expect(typeof auth.applyAuthHeaders).toBe('function');
    expect(importMock.extractJsonPath()).toBe('');
    expect(uuid.v4().startsWith('mock-uuid-')).toBe(true);
  });

  it('covers nullish fallback branches in review and configured defs', () => {
    const Review = makeSetupStepReviewMock().default;
    const setCopyName = vi.fn();
    const review = render(
      <Review copyName="X" setCopyName={setCopyName} validationModeLabel="None" />,
    );
    expect(review.getByTestId('review-url-preview').textContent).toBe('');
    expect(review.getByTestId('path-projection-order').textContent).toBe('');

    const utils = makeDataSourceSetupUtilsMock();
    const defs = utils.buildConfiguredColumnDefs({
      mode: 'run',
      test: createTestScenario({
        validation: { mode: 'selective', expectedFields: [{ jsonPath: 'meta.id' }] as any },
      }) as any,
      pathVars: [],
      urlParams: [{ key: 'missingSelection', value: '1' }],
      paramSelections: {},
      headerSelections: {},
      bodySelections: {},
    } as any);

    expect(defs.some((d) => d.type === 'param')).toBe(false);
    const validateDef = defs.find((d) => d.type === 'validate' && d.mapping === 'meta.id');
    expect(validateDef?.sampleValue).toBe('');
  });

  it('covers variables and validate fallback no-op branches', () => {
    const Variables = makeSetupStepVariablesMock().default;
    const toggleSegment = vi.fn();
    const setVarName = vi.fn();
    const v = render(
      <Variables
        analysis={{ segments: [{ index: 0, segment: 'users', variableName: 'id0' }] }}
        selections={{}}
        toggleSegment={toggleSegment}
        setVarName={setVarName}
        urlParams={[]}
        headerCandidates={[]}
        bodyVariableCandidates={[]}
      />,
    );
    fireEvent.click(v.getByTestId('exercise-variable-callbacks'));
    fireEvent.click(v.getByTestId('check-0'));
    fireEvent.change(v.getByTestId('name-0'), { target: { value: 'id0' } });
    expect(v.getByTestId('check-0')).toHaveProperty('checked', false);
    expect((v.getByTestId('name-0') as HTMLInputElement).value).toBe('');
    expect(toggleSegment).toHaveBeenCalledTimes(1);
    expect(setVarName).toHaveBeenCalledWith(0, 'id0');

    const Validate = makeSetupStepValidateMock().default;
    const setValidationMode = vi.fn();
    const setValidateFields = vi.fn();
    const validate = render(
      <Validate
        validationMode="none"
        setValidationMode={setValidationMode}
        validateFields={[]}
        setValidateFields={setValidateFields}
        handleFetchForValidate={() => undefined}
        fetching={false}
        fetchError={null}
      />,
    );
    expect(validate.getByTestId('sample-json-preview').textContent).toBe('');
    expect(validate.getByTestId('first-validate-path').textContent).toBe('');
    expect(validate.getByTestId('fetching').textContent).toBe('no');
    expect(validate.getByTestId('fetch-error').textContent).toBe('');
    fireEvent.click(validate.getByTestId('set-array-unordered'));
    expect(setValidationMode).not.toHaveBeenCalledWith('full');
  });

  it('ensurePathVariableChecked only clicks when unchecked', () => {
    const onChange0 = vi.fn();
    const onChange1 = vi.fn();
    render(
      <>
        <input data-testid="check-0" type="checkbox" defaultChecked={false} onChange={onChange0} />
        <input data-testid="check-1" type="checkbox" defaultChecked={true} onChange={onChange1} />
      </>,
    );

    ensurePathVariableChecked(0);
    ensurePathVariableChecked(1);
    expect(onChange0).toHaveBeenCalledTimes(1);
    expect(onChange1).not.toHaveBeenCalled();
  });
});
