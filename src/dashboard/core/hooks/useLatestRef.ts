import { useEffect, useRef, type MutableRefObject } from "react";

export const useLatestRef = <T,>(value: T): MutableRefObject<T> => {
  const ref = useRef<T>(value);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref;
};

