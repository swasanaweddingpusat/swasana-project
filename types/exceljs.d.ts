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
    underline?: boolean;
  }

  interface ExcelBorderSide {
    style?: "thin" | "medium" | "thick";
    color?: ExcelColor;
  }

  interface ExcelBorder {
    top?: ExcelBorderSide;
    left?: ExcelBorderSide;
    bottom?: ExcelBorderSide;
    right?: ExcelBorderSide;
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
    border: ExcelBorder;
    numFmt: string;
  }

  export interface Row {
    font: ExcelFont;
    alignment: ExcelAlignment;
    height?: number;
    getCell(indexOrKey: number | string): Cell;
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
    views: Array<{ state: "frozen"; xSplit?: number; ySplit?: number }>;
    properties: { defaultRowHeight?: number };
    autoFilter?: string;
    pageSetup: {
      orientation?: "portrait" | "landscape";
      fitToPage?: boolean;
      fitToWidth?: number;
      fitToHeight?: number;
      margins?: {
        left: number;
        right: number;
        top: number;
        bottom: number;
        header: number;
        footer: number;
      };
    };
    addRow(row: readonly unknown[]): Row;
    getCell(address: string | number): Cell;
    getRow(index: number): Row;
    mergeCells(range: string): void;
  }

  export class Workbook {
    creator: string;
    lastModifiedBy: string;
    created: Date;
    modified: Date;
    addWorksheet(name: string, options?: { properties?: { tabColor?: ExcelColor } }): Worksheet;
    xlsx: {
      writeBuffer(): Promise<Buffer>;
    };
  }
}
