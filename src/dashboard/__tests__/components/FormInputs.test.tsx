import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import * as FormInputs from '../../components/FormInputs';

// Mock constants
vi.mock('../../core/constants', () => ({
  TERMINAL_STYLES: {
    fontSize: '11px',
    fontFamily: 'monospace',
    bg: '#101010',
    text: 'neutral-300',
    border: 'neutral-800',
    borderLight: 'neutral-700',
  },
}));

describe('FormInputs - TextInput', () => {
  it('should render text input', () => {
    render(<FormInputs.TextInput data-testid="text-input" />);

    expect(screen.getByTestId('text-input')).toBeInTheDocument();
  });

  it('should render with type text', () => {
    const { container } = render(<FormInputs.TextInput />);

    const input = container.querySelector('input[type="text"]');
    expect(input).toBeInTheDocument();
  });
});

describe('FormInputs - NumberInput', () => {
  it('should render number input', () => {
    render(<FormInputs.NumberInput data-testid="number-input" />);

    expect(screen.getByTestId('number-input')).toBeInTheDocument();
  });

  it('should render with type number', () => {
    const { container } = render(<FormInputs.NumberInput />);

    const input = container.querySelector('input[type="number"]');
    expect(input).toBeInTheDocument();
  });

  it('should pass min and max props', () => {
    const { container } = render(
      <FormInputs.NumberInput min={0} max={100} />
    );

    const input = container.querySelector('input[type="number"]');
    expect(input?.getAttribute('min')).toBe('0');
    expect(input?.getAttribute('max')).toBe('100');
  });
});

describe('FormInputs - Select', () => {
  it('should render select element', () => {
    render(
      <FormInputs.Select data-testid="select-input">
        <option value="1">Option 1</option>
      </FormInputs.Select>
    );

    expect(screen.getByTestId('select-input')).toBeInTheDocument();
  });

  it('should render children options', () => {
    render(
      <FormInputs.Select>
        <option value="1">Option 1</option>
        <option value="2">Option 2</option>
      </FormInputs.Select>
    );

    expect(screen.getByText('Option 1')).toBeInTheDocument();
    expect(screen.getByText('Option 2')).toBeInTheDocument();
  });
});

describe('FormInputs - Checkbox', () => {
  it('should render checkbox', () => {
    render(<FormInputs.Checkbox data-testid="checkbox" />);

    expect(screen.getByTestId('checkbox')).toBeInTheDocument();
  });

  it('should render with type checkbox', () => {
    const { container } = render(<FormInputs.Checkbox />);

    const input = container.querySelector('input[type="checkbox"]');
    expect(input).toBeInTheDocument();
  });

  it('should pass checked prop', () => {
    const { container } = render(<FormInputs.Checkbox checked={true} />);

    const input = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(input?.checked).toBe(true);
  });
});

describe('FormInputs - RadioButton', () => {
  it('should render radio button', () => {
    render(<FormInputs.RadioButton data-testid="radio" />);

    expect(screen.getByTestId('radio')).toBeInTheDocument();
  });

  it('should render with type radio', () => {
    const { container } = render(<FormInputs.RadioButton />);

    const input = container.querySelector('input[type="radio"]');
    expect(input).toBeInTheDocument();
  });
});

describe('FormInputs - ColorInput', () => {
  it('should render color input', () => {
    render(<FormInputs.ColorInput data-testid="color" />);

    expect(screen.getByTestId('color')).toBeInTheDocument();
  });

  it('should render with type color', () => {
    const { container } = render(<FormInputs.ColorInput />);

    const input = container.querySelector('input[type="color"]');
    expect(input).toBeInTheDocument();
  });
});

describe('FormInputs - FileInput', () => {
  it('should render file input', () => {
    render(<FormInputs.FileInput data-testid="file" />);

    expect(screen.getByTestId('file')).toBeInTheDocument();
  });

  it('should render with type file', () => {
    const { container } = render(<FormInputs.FileInput />);

    const input = container.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
  });
});

describe('FormInputs - Label', () => {
  it('should render label text', () => {
    render(<FormInputs.Label>Label Text</FormInputs.Label>);

    expect(screen.getByText('Label Text')).toBeInTheDocument();
  });

  it('should render as div element', () => {
    const { container } = render(<FormInputs.Label>Label</FormInputs.Label>);

    const label = container.querySelector('div');
    expect(label).toBeInTheDocument();
  });
});

describe('FormInputs - ValidationError', () => {
  it('should not render when value is empty', () => {
    const { container } = render(
      <FormInputs.ValidationError
        value=""
        validation={{ isValid: true, errorMessage: '' }}
      />
    );

    expect(container.firstChild).toBe(null);
  });

  it('should not render when validation is valid', () => {
    const { container } = render(
      <FormInputs.ValidationError
        value="some value"
        validation={{ isValid: true, errorMessage: '' }}
      />
    );

    expect(container.firstChild).toBe(null);
  });

  it('should render error message when invalid', () => {
    render(
      <FormInputs.ValidationError
        value="some value"
        validation={{ isValid: false, errorMessage: 'This field is required' }}
      />
    );

    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('should have error styling', () => {
    const { container } = render(
      <FormInputs.ValidationError
        value="some value"
        validation={{ isValid: false, errorMessage: 'Error' }}
      />
    );

    const error = container.querySelector('.text-red-400');
    expect(error).toBeInTheDocument();
  });
});
