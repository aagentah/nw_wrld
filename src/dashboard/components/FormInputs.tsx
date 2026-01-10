import React from "react";
import { TERMINAL_STYLES } from "../core/constants";

export { TERMINAL_STYLES };

export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  style?: React.CSSProperties;
}

export const TextInput = ({ style, ...props }: TextInputProps) => {
  return (
    <input
      type="text"
      style={{
        fontSize: TERMINAL_STYLES.fontSize,
        fontFamily: TERMINAL_STYLES.fontFamily,
        backgroundColor: TERMINAL_STYLES.bg,
        color: TERMINAL_STYLES.text,
        border: `1px solid ${TERMINAL_STYLES.border}`,
        outline: "none",
        padding: "4px 0",
        ...style,
      }}
      {...props}
    />
  );
};

export interface NumberInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  style?: React.CSSProperties;
  min?: number | string;
  max?: number | string;
}

export const NumberInput = ({ style, min, max, ...props }: NumberInputProps) => {
  return (
    <input
      type="number"
      min={min ?? undefined}
      max={max ?? undefined}
      style={{
        fontSize: TERMINAL_STYLES.fontSize,
        fontFamily: TERMINAL_STYLES.fontFamily,
        border: `1px solid ${TERMINAL_STYLES.border}`,
        backgroundColor: TERMINAL_STYLES.bg,
        color: TERMINAL_STYLES.text,
        width: "64px",
        outline: "none",
        padding: "2px 0",
        ...style,
      }}
      {...props}
    />
  );
};

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  style?: React.CSSProperties;
}

export const Select = ({ style, children, ...props }: SelectProps) => {
  return (
    <select
      style={{
        fontSize: TERMINAL_STYLES.fontSize,
        fontFamily: TERMINAL_STYLES.fontFamily,
        border: `1px solid ${TERMINAL_STYLES.border}`,
        backgroundColor: TERMINAL_STYLES.bg,
        color: TERMINAL_STYLES.text,
        outline: "none",
        padding: "2px 0",
        ...style,
      }}
      {...props}
    >
      {children}
    </select>
  );
};

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  style?: React.CSSProperties;
}

export const Checkbox = ({ style, checked, defaultChecked, ...props }: CheckboxProps) => {
  return (
    <input
      type="checkbox"
      style={{
        appearance: "none",
        WebkitAppearance: "none",
        MozAppearance: "none",
        cursor: "pointer",
        width: "14px",
        height: "14px",
        border: `1px solid ${TERMINAL_STYLES.borderLight}`,
        backgroundColor: "transparent",
        borderRadius: "2px",
        position: "relative",
        outline: "none",
        flexShrink: 0,
        ...style,
      }}
      checked={checked}
      defaultChecked={defaultChecked}
      {...props}
    />
  );
};

export interface RadioButtonProps extends React.InputHTMLAttributes<HTMLInputElement> {
  style?: React.CSSProperties;
}

export const RadioButton = ({ style, ...props }: RadioButtonProps) => {
  return (
    <input
      type="radio"
      style={{
        appearance: "none",
        WebkitAppearance: "none",
        MozAppearance: "none",
        marginRight: "8px",
        cursor: "pointer",
        width: "14px",
        height: "14px",
        border: `1px solid ${TERMINAL_STYLES.borderLight}`,
        backgroundColor: "transparent",
        borderRadius: "50%",
        position: "relative",
        outline: "none",
        flexShrink: 0,
        ...style,
      }}
      {...props}
    />
  );
};

export interface ColorInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  style?: React.CSSProperties;
}

export const ColorInput = ({ style, ...props }: ColorInputProps) => {
  return (
    <input
      type="color"
      style={{
        width: "48px",
        height: "24px",
        padding: 0,
        border: `1px solid ${TERMINAL_STYLES.border}`,
        cursor: "pointer",
        ...style,
      }}
      {...props}
    />
  );
};

export interface FileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  style?: React.CSSProperties;
}

export const FileInput = ({ style, ...props }: FileInputProps) => {
  return (
    <input
      type="file"
      style={{
        fontSize: TERMINAL_STYLES.fontSize,
        fontFamily: TERMINAL_STYLES.fontFamily,
        color: TERMINAL_STYLES.text,
        backgroundColor: TERMINAL_STYLES.bg,
        border: "none",
        outline: "none",
        padding: "2px 0",
        ...style,
      }}
      {...props}
    />
  );
};

export interface LabelProps extends React.HTMLAttributes<HTMLDivElement> {
  style?: React.CSSProperties;
  children: React.ReactNode;
}

export const Label = ({ style, children, ...props }: LabelProps) => {
  return (
    <div
      style={{
        marginBottom: "4px",
        color: TERMINAL_STYLES.text,
        fontSize: TERMINAL_STYLES.fontSize,
        fontFamily: TERMINAL_STYLES.fontFamily,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
};

export interface Validation {
  isValid: boolean;
  errorMessage: string;
}

export interface ValidationErrorProps {
  value: string;
  validation: Validation;
}

export const ValidationError = ({ value, validation }: ValidationErrorProps) => {
  if (value.trim().length === 0 || validation.isValid) return null;

  return (
    <div className="text-red-400 text-[11px] mt-1 font-mono">
      {validation.errorMessage}
    </div>
  );
};
