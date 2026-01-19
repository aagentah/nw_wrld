import { useState, useEffect } from "react";
import { NumberInput } from "../components/FormInputs";

type MatrixGridValueObject = {
  rows?: number;
  cols?: number;
  excludedCells?: string[];
};

export type MatrixGridValue = MatrixGridValueObject | [number, number] | null | undefined;

type MatrixGridNormalized = {
  rows: number;
  cols: number;
  excludedCells: string[];
};

type MatrixGridProps = {
  value: MatrixGridValue;
  onChange: (next: MatrixGridNormalized) => void;
};

export const MatrixGrid = ({ value, onChange }: MatrixGridProps) => {
  const normalizeValue = (val: MatrixGridValue): MatrixGridNormalized => {
    if (Array.isArray(val)) {
      console.warn("[MatrixGrid] Legacy array format detected, converting to object format");
      return { rows: val[0] || 1, cols: val[1] || 1, excludedCells: [] };
    }
    return {
      rows: val?.rows || 1,
      cols: val?.cols || 1,
      excludedCells: val?.excludedCells || [],
    };
  };

  const normalized = normalizeValue(value);
  const [rows, setRows] = useState(normalized.rows);
  const [cols, setCols] = useState(normalized.cols);
  const [excludedCells, setExcludedCells] = useState(normalized.excludedCells);

  useEffect(() => {
    const updated = normalizeValue(value);
    setRows(updated.rows);
    setCols(updated.cols);
    setExcludedCells(updated.excludedCells);
  }, [value]);

  const handleRowsChange = (newRows: string | number) => {
    const numRows = Math.max(1, Math.min(5, parseInt(String(newRows)) || 1));
    const oldRows = rows;
    setRows(numRows);

    const updated = excludedCells.filter((key) => {
      const [r] = key.split("-").map(Number);
      return r <= numRows;
    });

    if (numRows > oldRows) {
      for (let r = oldRows + 1; r <= numRows; r++) {
        for (let c = 1; c <= cols; c++) {
          const cellKey = `${r}-${c}`;
          if (!updated.includes(cellKey)) {
            updated.push(cellKey);
          }
        }
      }
    }

    setExcludedCells(updated);
    onChange({ rows: numRows, cols, excludedCells: updated });
  };

  const handleColsChange = (newCols: string | number) => {
    const numCols = Math.max(1, Math.min(5, parseInt(String(newCols)) || 1));
    const oldCols = cols;
    setCols(numCols);

    const updated = excludedCells.filter((key) => {
      const [, c] = key.split("-").map(Number);
      return c <= numCols;
    });

    if (numCols > oldCols) {
      for (let r = 1; r <= rows; r++) {
        for (let c = oldCols + 1; c <= numCols; c++) {
          const cellKey = `${r}-${c}`;
          if (!updated.includes(cellKey)) {
            updated.push(cellKey);
          }
        }
      }
    }

    setExcludedCells(updated);
    onChange({ rows, cols: numCols, excludedCells: updated });
  };

  const handleCellClick = (row: number, col: number) => {
    const cellKey = `${row}-${col}`;
    const isExcluded = excludedCells.includes(cellKey);
    const newExcludedCells = isExcluded
      ? excludedCells.filter((key) => key !== cellKey)
      : [...excludedCells, cellKey];
    setExcludedCells(newExcludedCells);
    onChange({ rows, cols, excludedCells: newExcludedCells });
  };

  const renderGrid = () => {
    const grid = [];
    for (let row = 1; row <= rows; row++) {
      for (let col = 1; col <= cols; col++) {
        const cellKey = `${row}-${col}`;
        const isExcluded = excludedCells.includes(cellKey);
        const isActive = !isExcluded;

        grid.push(
          <input
            key={cellKey}
            type="checkbox"
            checked={isActive}
            onChange={() => handleCellClick(row, col)}
            style={{
              appearance: "none",
              WebkitAppearance: "none",
              MozAppearance: "none",
              cursor: "pointer",
              width: "14px",
              height: "14px",
              border: "1px solid #d9d9d9",
              backgroundColor: "transparent",
              borderRadius: "2px",
              position: "relative",
              outline: "none",
              flexShrink: 0,
            }}
            title={`${row},${col}${isExcluded ? " (excluded)" : ""}`}
          />
        );
      }
    }
    return grid;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span
            style={{
              fontSize: "9px",
              color: "rgba(217, 217, 217, 0.5)",
              fontFamily:
                '"Roboto Mono", "Apple Symbols", "Segoe UI Symbol", "Symbol", monospace',
            }}
          >
            rows:
          </span>
          <NumberInput
            min={1}
            max={5}
            value={rows}
            onChange={(e) => handleRowsChange(e.target.value)}
            style={{ width: "48px", padding: "2px 4px" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <span
            style={{
              fontSize: "9px",
              color: "rgba(217, 217, 217, 0.5)",
              fontFamily:
                '"Roboto Mono", "Apple Symbols", "Segoe UI Symbol", "Symbol", monospace',
            }}
          >
            cols:
          </span>
          <NumberInput
            min={1}
            max={5}
            value={cols}
            onChange={(e) => handleColsChange(e.target.value)}
            style={{ width: "48px", padding: "2px 4px" }}
          />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <div
          style={{
            fontSize: "9px",
            color: "rgba(217, 217, 217, 0.5)",
            fontFamily:
              '"Roboto Mono", "Apple Symbols", "Segoe UI Symbol", "Symbol", monospace',
          }}
        >
          grid (click cells):
        </div>
        <div
          style={{
            display: "grid",
            gap: "2px",
            gridTemplateRows: `repeat(${rows}, 14px)`,
            gridTemplateColumns: `repeat(${cols}, 14px)`,
            padding: "6px",
            border: "1px solid #333",
            width: "fit-content",
          }}
        >
          {renderGrid()}
        </div>
      </div>
    </div>
  );
};

