/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import WebhookLoadDriverPanel, { type WebhookLoadConfig } from './WebhookLoadDriverPanel';

function createConfig(overrides: Partial<WebhookLoadConfig> = {}): WebhookLoadConfig {
  return {
    webhookUrl: 'http://localhost:3001/webhooks/wf-1/trigger-1',
    method: 'POST',
    payloadTemplate: '{"event": "test"}',
    rate: { mode: 'fixed', rps: 10, durationSec: 60 },
    headers: {},
    ...overrides,
  };
}

describe('WebhookLoadDriverPanel', () => {
  const defaultProps = {
    webhookUrl: 'http://localhost:3001/webhooks/wf-1/trigger-1',
    method: 'POST' as const,
    initialPayload: '{"event": "initial"}',
    config: createConfig(),
    onChange: vi.fn(),
    disabled: false,
  };

  beforeEach(() => {
    resetAllMocks();
  });

  describe('rendering', () => {
    it('renders panel with title and method badge', () => {
      render(<WebhookLoadDriverPanel {...defaultProps} />);
      
      expect(screen.getByText('Webhook Load Test')).toBeInTheDocument();
      expect(screen.getByText('POST')).toBeInTheDocument();
    });

    it('displays webhook URL', () => {
      render(<WebhookLoadDriverPanel {...defaultProps} />);
      
      expect(screen.getByText('http://localhost:3001/webhooks/wf-1/trigger-1')).toBeInTheDocument();
    });

    it('shows server notice warning', () => {
      render(<WebhookLoadDriverPanel {...defaultProps} />);
      
      expect(screen.getByText(/Requires webhook server on port 3001/)).toBeInTheDocument();
    });

    it('shows estimated total requests', () => {
      render(<WebhookLoadDriverPanel {...defaultProps} />);
      
      // Fixed mode: 10 rps * 60 sec = 600 requests
      expect(screen.getByText('600 requests')).toBeInTheDocument();
    });
  });

  describe('rate mode selection', () => {
    it('has Fixed mode selected by default', () => {
      render(<WebhookLoadDriverPanel {...defaultProps} />);
      
      const fixedBtn = screen.getByRole('button', { name: 'Fixed' });
      expect(fixedBtn).toHaveClass('active');
    });

    it('switches to Ramp mode when clicked', () => {
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} onChange={onChange} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Ramp' }));
      
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        rate: expect.objectContaining({ mode: 'ramp' }),
      }));
    });

    it('switches to Burst mode when clicked', () => {
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} onChange={onChange} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Burst' }));
      
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        rate: expect.objectContaining({ mode: 'burst' }),
      }));
    });

    it('disables mode buttons when disabled prop is true', () => {
      render(<WebhookLoadDriverPanel {...defaultProps} disabled={true} />);
      
      expect(screen.getByRole('button', { name: 'Fixed' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Ramp' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Burst' })).toBeDisabled();
    });
  });

  describe('fixed rate configuration', () => {
    it('shows default 10 RPS display when fixed rate omits rps', () => {
      const cfg = createConfig({
        rate: { mode: 'fixed', durationSec: 55 },
      });
      render(<WebhookLoadDriverPanel {...defaultProps} config={cfg} />);
      
      const rpsInput = screen
        .getByText('Requests/sec')
        .parentElement!.querySelector('input') as HTMLInputElement;
      expect(rpsInput.value).toBe('10');
    });

    it('shows default 60s duration display when fixed rate omits durationSec', () => {
      const cfg = createConfig({
        rate: { mode: 'fixed', rps: 8 },
      });
      render(<WebhookLoadDriverPanel {...defaultProps} config={cfg} />);
      
      const durationInput = screen
        .getByText('Duration (sec)')
        .parentElement!.querySelector('input') as HTMLInputElement;
      expect(durationInput.value).toBe('60');
    });

    it('shows RPS and duration fields for fixed mode', () => {
      render(<WebhookLoadDriverPanel {...defaultProps} />);
      
      expect(screen.getByText('Requests/sec')).toBeInTheDocument();
      expect(screen.getByText('Duration (sec)')).toBeInTheDocument();
    });

    it('updates RPS when changed', () => {
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} onChange={onChange} />);
      
      // Find input by its container label
      const rpsLabel = screen.getByText('Requests/sec');
      const rpsInput = rpsLabel.parentElement?.querySelector('input') as HTMLInputElement;
      fireEvent.change(rpsInput, { target: { value: '25' } });
      
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        rate: expect.objectContaining({ rps: 25 }),
      }));
    });

    it('updates duration when changed', () => {
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} onChange={onChange} />);
      
      const durationLabel = screen.getByText('Duration (sec)');
      const durationInput = durationLabel.parentElement?.querySelector('input') as HTMLInputElement;
      fireEvent.change(durationInput, { target: { value: '120' } });
      
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        rate: expect.objectContaining({ durationSec: 120 }),
      }));
    });
  });

  describe('ramp rate configuration', () => {
    const rampConfig = createConfig({
      rate: { mode: 'ramp', rps: 5, endRps: 50, durationSec: 120 },
    });

    it('shows start/end RPS and duration fields for ramp mode', () => {
      render(<WebhookLoadDriverPanel {...defaultProps} config={rampConfig} />);
      
      expect(screen.getByText('Start RPS')).toBeInTheDocument();
      expect(screen.getByText('End RPS')).toBeInTheDocument();
      expect(screen.getByText('Duration (sec)')).toBeInTheDocument();
    });

    it('calculates ramp total correctly', () => {
      render(<WebhookLoadDriverPanel {...defaultProps} config={rampConfig} />);
      
      // Ramp from 5 to 50 over 120s = avg 27.5 rps * 120s = 3300 requests
      expect(screen.getByText('3,300 requests')).toBeInTheDocument();
    });

    it('shows default ramp start RPS display when rate omits rps', () => {
      const cfg = createConfig({
        rate: { mode: 'ramp', endRps: 10, durationSec: 40 },
      });
      render(<WebhookLoadDriverPanel {...defaultProps} config={cfg} />);
      
      const startInput = screen
        .getByText('Start RPS')
        .parentElement!.querySelector('input') as HTMLInputElement;
      expect(startInput.value).toBe('1');
    });

    it('shows default end RPS display when ramp omits endRps', () => {
      const cfg = createConfig({
        rate: { mode: 'ramp', rps: 4, durationSec: 90 },
      });
      render(<WebhookLoadDriverPanel {...defaultProps} config={cfg} />);
      
      const endInput = screen
        .getByText('End RPS')
        .parentElement!.querySelector('input') as HTMLInputElement;
      expect(endInput.value).toBe('50');
    });

    it('shows default ramp duration display when omitted', () => {
      const cfg = createConfig({
        rate: { mode: 'ramp', rps: 2, endRps: 4 },
      });
      render(<WebhookLoadDriverPanel {...defaultProps} config={cfg} />);
      
      const durInput = screen
        .getByText('Duration (sec)')
        .parentElement!.querySelector('input') as HTMLInputElement;
      expect(durInput.value).toBe('120');
    });
  });

  describe('burst rate configuration', () => {
    const burstConfig = createConfig({
      rate: { mode: 'burst', burstCount: 200 },
    });

    it('shows total requests field for burst mode', () => {
      render(<WebhookLoadDriverPanel {...defaultProps} config={burstConfig} />);
      
      expect(screen.getByText('Total Requests')).toBeInTheDocument();
    });

    it('updates burst count when changed', () => {
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} config={burstConfig} onChange={onChange} />);
      
      const burstLabel = screen.getByText('Total Requests');
      const burstInput = burstLabel.parentElement?.querySelector('input') as HTMLInputElement;
      fireEvent.change(burstInput, { target: { value: '500' } });
      
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        rate: expect.objectContaining({ burstCount: 500 }),
      }));
    });

    it('does not show duration estimate for burst mode', () => {
      render(<WebhookLoadDriverPanel {...defaultProps} config={burstConfig} />);
      
      expect(screen.queryByText(/over \d+s/)).not.toBeInTheDocument();
    });

    it('shows default 100 burst count when burst omits burstCount', () => {
      const cfg = createConfig({
        rate: { mode: 'burst' },
      });
      render(<WebhookLoadDriverPanel {...defaultProps} config={cfg} />);
      
      const burstInput = screen
        .getByText('Total Requests')
        .parentElement!.querySelector('input') as HTMLInputElement;
      expect(burstInput.value).toBe('100');
    });
  });

  describe('payload template', () => {
    it('displays payload template in textarea', () => {
      render(<WebhookLoadDriverPanel {...defaultProps} />);
      
      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveValue('{"event": "test"}');
    });

    it('updates payload when changed', () => {
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} onChange={onChange} />);
      
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: '{"new": "payload"}' } });
      
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        payloadTemplate: '{"new": "payload"}',
      }));
    });

    it('shows generator toggle button', () => {
      render(<WebhookLoadDriverPanel {...defaultProps} />);
      
      expect(screen.getByText('Show Generators')).toBeInTheDocument();
    });

    it('shows generators when toggle clicked', () => {
      render(<WebhookLoadDriverPanel {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Show Generators'));
      
      expect(screen.getByText('Hide Generators')).toBeInTheDocument();
      // Check for some generator syntax
      expect(screen.getByText('{{$uuid}}')).toBeInTheDocument();
    });

    it('resets payload when reset button clicked', () => {
      const onChange = vi.fn();
      const config = createConfig({ payloadTemplate: '{"modified": true}' });
      render(
        <WebhookLoadDriverPanel
          {...defaultProps}
          config={config}
          initialPayload='{"original": true}'
          onChange={onChange}
        />
      );
      
      fireEvent.click(screen.getByText('Reset'));
      
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        payloadTemplate: '{"original": true}',
      }));
    });
  });

  describe('validation errors', () => {
    it('shows validation errors for invalid JSON', () => {
      const config = createConfig({ payloadTemplate: '{"invalid json' });
      render(<WebhookLoadDriverPanel {...defaultProps} config={config} />);
      
      // The validatePayloadTemplate function should catch invalid JSON
      const errors = screen.getAllByText(/Invalid JSON/i);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('shows no errors for valid template', () => {
      const config = createConfig({ payloadTemplate: '{"valid": "json", "id": "{{$uuid}}"}' });
      render(<WebhookLoadDriverPanel {...defaultProps} config={config} />);
      
      // Check that no payload-error divs are rendered
      expect(document.querySelector('.payload-error')).toBeNull();
    });

    it('shows unknown generator errors', () => {
      const config = createConfig({ payloadTemplate: '{"x": "{{$notARealGenerator}}"}' });
      render(<WebhookLoadDriverPanel {...defaultProps} config={config} />);
      
      expect(screen.getByText(/Unknown generator/)).toBeInTheDocument();
    });

    it('renders validation lines for malformed template keys', () => {
      const config = createConfig({ payloadTemplate: '{{$bad}}' });
      render(<WebhookLoadDriverPanel {...defaultProps} config={config} />);
      
      const lines = document.querySelectorAll('.payload-error');
      expect(lines.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('disabled state', () => {
    it('disables all inputs when disabled', () => {
      render(<WebhookLoadDriverPanel {...defaultProps} disabled={true} />);
      
      // Textarea
      expect(screen.getByRole('textbox')).toBeDisabled();
      
      // Rate inputs
      const inputs = screen.getAllByRole('spinbutton');
      inputs.forEach(input => expect(input).toBeDisabled());
      
      // Buttons
      expect(screen.getByText('Show Generators')).toBeDisabled();
      expect(screen.getByText('Reset')).toBeDisabled();
    });
  });

  describe('generator insertion', () => {
    it('inserts generator syntax when generator chip clicked', () => {
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} onChange={onChange} />);
      
      // Show generators
      fireEvent.click(screen.getByText('Show Generators'));
      
      // Click a generator
      fireEvent.click(screen.getByText('{{$uuid}}'));
      
      // Should append to payload since we can't easily mock cursor position
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        payloadTemplate: expect.stringContaining('{{$uuid}}'),
      }));
    });
  });

  describe('rate limits', () => {
    it('enforces minimum RPS of 1', () => {
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} onChange={onChange} />);
      
      const rpsLabel = screen.getByText('Requests/sec');
      const rpsInput = rpsLabel.parentElement?.querySelector('input') as HTMLInputElement;
      fireEvent.change(rpsInput, { target: { value: '0' } });
      
      // Math.max(1, 0 || 10) = Math.max(1, 10) = 10
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        rate: expect.objectContaining({ rps: 10 }),
      }));
    });

    it('uses default RPS 10 when fixed RPS input is non-numeric', () => {
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} onChange={onChange} />);
      
      const rpsLabel = screen.getByText('Requests/sec');
      const rpsInput = rpsLabel.parentElement?.querySelector('input') as HTMLInputElement;
      fireEvent.change(rpsInput, { target: { value: '' } });
      
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        rate: expect.objectContaining({ rps: 10 }),
      }));
    });

    it('enforces minimum duration of 1', () => {
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} onChange={onChange} />);
      
      const durationLabel = screen.getByText('Duration (sec)');
      const durationInput = durationLabel.parentElement?.querySelector('input') as HTMLInputElement;
      fireEvent.change(durationInput, { target: { value: '-5' } });
      
      // Math.max(1, -5) = 1, the component clamps negative values to 1
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        rate: expect.objectContaining({ durationSec: 1 }),
      }));
    });

    it('uses default duration 60 when fixed duration input is non-numeric', () => {
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} onChange={onChange} />);
      
      const durationLabel = screen.getByText('Duration (sec)');
      const durationInput = durationLabel.parentElement?.querySelector('input') as HTMLInputElement;
      fireEvent.change(durationInput, { target: { value: '' } });
      
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        rate: expect.objectContaining({ durationSec: 60 }),
      }));
    });
  });

  describe('handleModeChange defaults', () => {
    it('fills default fixed fields when switching from burst', () => {
      const onChange = vi.fn();
      const config = createConfig({
        rate: { mode: 'burst', burstCount: 42 },
      });
      render(<WebhookLoadDriverPanel {...defaultProps} config={config} onChange={onChange} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Fixed' }));
      
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          rate: expect.objectContaining({
            mode: 'fixed',
            rps: 10,
            durationSec: 60,
          }),
        }),
      );
    });

    it('fills default ramp fields when switching from burst', () => {
      const onChange = vi.fn();
      const config = createConfig({
        rate: { mode: 'burst', burstCount: 10 },
      });
      render(<WebhookLoadDriverPanel {...defaultProps} config={config} onChange={onChange} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Ramp' }));
      
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          rate: expect.objectContaining({
            mode: 'ramp',
            rps: 1,
            endRps: 50,
            durationSec: 120,
          }),
        }),
      );
    });

    it('fills default burst count when switching from fixed', () => {
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} onChange={onChange} />);
      
      fireEvent.click(screen.getByRole('button', { name: 'Burst' }));
      
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          rate: expect.objectContaining({
            mode: 'burst',
            burstCount: 100,
          }),
        }),
      );
    });
  });

  describe('method badge', () => {
    it('shows PUT for put method', () => {
      render(<WebhookLoadDriverPanel {...defaultProps} method="PUT" />);
      expect(screen.getByText('PUT')).toBeInTheDocument();
    });

    it('shows PATCH for patch method', () => {
      render(<WebhookLoadDriverPanel {...defaultProps} method="PATCH" />);
      expect(screen.getByText('PATCH')).toBeInTheDocument();
    });
  });

  describe('active rate mode button', () => {
    it('marks Ramp button active when config is ramp', () => {
      const rampConfig = createConfig({
        rate: { mode: 'ramp', rps: 2, endRps: 20, durationSec: 30 },
      });
      render(<WebhookLoadDriverPanel {...defaultProps} config={rampConfig} />);
      
      expect(screen.getByRole('button', { name: 'Ramp' })).toHaveClass('active');
      expect(screen.getByRole('button', { name: 'Fixed' })).not.toHaveClass('active');
    });

    it('marks Burst button active when config is burst', () => {
      const burstConfig = createConfig({
        rate: { mode: 'burst', burstCount: 50 },
      });
      render(<WebhookLoadDriverPanel {...defaultProps} config={burstConfig} />);
      
      expect(screen.getByRole('button', { name: 'Burst' })).toHaveClass('active');
    });
  });

  describe('duration estimate fallback', () => {
    it('shows over 60s when fixed durationSec is omitted', () => {
      const config = createConfig({
        rate: { mode: 'fixed', rps: 10 },
      });
      render(<WebhookLoadDriverPanel {...defaultProps} config={config} />);
      
      expect(screen.getByText('over 60s')).toBeInTheDocument();
    });

    it('shows over 60s when ramp durationSec is omitted', () => {
      const config = createConfig({
        rate: { mode: 'ramp', rps: 1, endRps: 2 },
      });
      render(<WebhookLoadDriverPanel {...defaultProps} config={config} />);
      
      expect(screen.getByText('over 60s')).toBeInTheDocument();
    });
  });

  describe('ramp input parsing', () => {
    const rampConfig = createConfig({
      rate: { mode: 'ramp', rps: 10, endRps: 20, durationSec: 60 },
    });

    it('falls back to 1 when start RPS is empty', () => {
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} config={rampConfig} onChange={onChange} />);
      
      const startLabel = screen.getByText('Start RPS');
      const startInput = startLabel.parentElement?.querySelector('input') as HTMLInputElement;
      fireEvent.change(startInput, { target: { value: '' } });
      
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        rate: expect.objectContaining({ rps: 1 }),
      }));
    });

    it('falls back to 50 when end RPS is empty', () => {
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} config={rampConfig} onChange={onChange} />);
      
      const endLabel = screen.getByText('End RPS');
      const endInput = endLabel.parentElement?.querySelector('input') as HTMLInputElement;
      fireEvent.change(endInput, { target: { value: '' } });
      
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        rate: expect.objectContaining({ endRps: 50 }),
      }));
    });

    it('falls back to 120 when ramp duration is empty', () => {
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} config={rampConfig} onChange={onChange} />);
      
      const durationLabel = screen.getByText('Duration (sec)');
      const rampDurationInput =
        durationLabel.parentElement?.querySelector('input') as HTMLInputElement;
      fireEvent.change(rampDurationInput, { target: { value: '' } });
      
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        rate: expect.objectContaining({ durationSec: 120 }),
      }));
    });
  });

  describe('burst input parsing', () => {
    const burstConfig = createConfig({
      rate: { mode: 'burst', burstCount: 200 },
    });

    it('falls back to 100 when burst count is empty', () => {
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} config={burstConfig} onChange={onChange} />);
      
      const burstLabel = screen.getByText('Total Requests');
      const burstInput = burstLabel.parentElement?.querySelector('input') as HTMLInputElement;
      fireEvent.change(burstInput, { target: { value: '' } });
      
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        rate: expect.objectContaining({ burstCount: 100 }),
      }));
    });

    it('maps zero burst input to Math.max result using fallback 100', () => {
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} config={burstConfig} onChange={onChange} />);
      
      const burstLabel = screen.getByText('Total Requests');
      const burstInput = burstLabel.parentElement?.querySelector('input') as HTMLInputElement;
      fireEvent.change(burstInput, { target: { value: '0' } });
      
      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
        rate: expect.objectContaining({ burstCount: 100 }),
      }));
    });
  });

  describe('generator panel', () => {
    it('hides generators when toggled twice', () => {
      render(<WebhookLoadDriverPanel {...defaultProps} />);
      
      fireEvent.click(screen.getByText('Show Generators'));
      expect(screen.getByText('Hide Generators')).toBeInTheDocument();
      expect(screen.getByText('Click a generator to insert at cursor position')).toBeInTheDocument();
      
      fireEvent.click(screen.getByText('Hide Generators'));
      expect(screen.queryByText('Click a generator to insert at cursor position')).not.toBeInTheDocument();
    });
  });

  describe('insertGenerator', () => {
    it('appends syntax when textarea is not in DOM', () => {
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} onChange={onChange} />);
      fireEvent.click(screen.getByText('Show Generators'));
      
      const spy = vi.spyOn(document, 'querySelector').mockImplementation((selector) => {
        if (selector === '.webhook-payload-editor') {
          return null;
        }
        return document.body.querySelector(selector as string);
      });
      
      try {
        fireEvent.click(screen.getByText('{{$uuid}}'));
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({
            webhookUrl: 'http://localhost:3001/webhooks/wf-1/trigger-1',
            method: 'POST',
            payloadTemplate: '{"event": "test"}{{$uuid}}',
            rate: defaultProps.config.rate,
            headers: {},
          }),
        );
      } finally {
        spy.mockRestore();
      }
    });

    it('inserts at cursor and runs focus timeout', () => {
      vi.useFakeTimers();
      const onChange = vi.fn();
      render(<WebhookLoadDriverPanel {...defaultProps} onChange={onChange} />);
      fireEvent.click(screen.getByText('Show Generators'));
      
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.focus(textarea);
      textarea.setSelectionRange(2, 2);
      
      fireEvent.click(screen.getByText('{{$uuid}}'));
      
      expect(onChange).toHaveBeenCalled();
      const updated = onChange.mock.calls[0]![0] as WebhookLoadConfig;
      expect(updated.payloadTemplate).toContain('{{$uuid}}');
      expect(updated.payloadTemplate.length).toBeGreaterThan('{"event": "test"}'.length);
      
      vi.runAllTimers();
      expect(document.activeElement).toBe(textarea);
      
      vi.useRealTimers();
    });
  });
});
