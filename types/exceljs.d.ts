declare module "exceljs" {
  export class Workbook {
    addWorksheet(name: string): any;
    xlsx: {
      writeBuffer(): Promise<Buffer>;
    };
  }
}
