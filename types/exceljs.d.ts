declare module "exceljs" {
  export interface Worksheet {
    addRow(row: readonly unknown[]): void;
  }

  export class Workbook {
    addWorksheet(name: string): Worksheet;
    xlsx: {
      writeBuffer(): Promise<Buffer>;
    };
  }
}
