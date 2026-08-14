declare module "exceljs" {
  /** Warna ARGB, mis. "FF0F4159". */
  interface ExcelColor {
    argb?: string;
  }

  interface ExcelFill {
    type: "pattern";
    pattern: "solid";
    fgColor?: ExcelColor;
    bgColor?: ExcelColor;
  }

  interface ExcelFont {
    bold?: boolean;
    color?: ExcelColor;
    size?: number;
    name?: string;
  }

  interface ExcelAlignment {
    vertical?: "top" | "middle" | "bottom";
    horizontal?: "left" | "center" | "right";
    wrapText?: boolean;
  }

  export interface Cell {
    value: unknown;
    fill: ExcelFill;
    font: ExcelFont;
    alignment: ExcelAlignment;
  }

  export interface Row {
    font: ExcelFont;
    alignment: ExcelAlignment;
    eachCell(callback: (cell: Cell, colNumber: number) => void): void;
    eachCell(
      opt: { includeEmpty: boolean },
      callback: (cell: Cell, colNumber: number) => void,
    ): void;
  }

  export interface Column {
    width?: number;
    eachCell?(
      opt: { includeEmpty: boolean },
      callback: (cell: Cell, rowNumber: number) => void,
    ): void;
  }

  export interface Worksheet {
    columns: Column[];
    addRow(row: readonly unknown[]): Row;
  }

  export class Workbook {
    addWorksheet(name: string): Worksheet;
    xlsx: {
      writeBuffer(): Promise<Buffer>;
    };
  }
}
