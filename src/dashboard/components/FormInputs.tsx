import { InputHTMLAttributes, CSSProperties, HTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { TERMINAL_STYLES } from "../core/constants";

export { TERMINAL_STYLES };

export const TextInput = ({
  style,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  style?: CSSProperties;
}) => {
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

export const NumberInput = ({
  style,
  min,
  max,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  style?: CSSProperties;
  min?: string | number;
  max?: string | number;
}) => {
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

export const Select = ({
  style,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  style?: CSSProperties;
  children?: ReactNode;
}) => {
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

export const Checkbox = ({
  style,
  checked,
  defaultChecked,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  style?: CSSProperties;
}) => {
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

export const RadioButton = ({
  style,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  style?: CSSProperties;
}) => {
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

export const ColorInput = ({
  style,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  style?: CSSProperties;
}) => {
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

export const FileInput = ({
  style,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  style?: CSSProperties;
}) => {
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

export const Label = ({
  style,
  children,
  ...props
}: Omit<HTMLAttributes<HTMLDivElement>, "htmlFor"> & {
  htmlFor?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) => {
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

export const ValidationError = ({
  value,
  validation,
}: {
  value: string;
  validation: { isValid: boolean; errorMessage: string };
}) => {
  if (value.trim().length === 0 || validation.isValid) return null;

  return <div className="text-red-400 text-[11px] mt-1 font-mono">{validation.errorMessage}</div>;
};
