declare module 'xlsx' {
  export namespace utils {
    export function book_new(): any;
    export function aoa_to_sheet(data: any[][], opts?: any): any;
    export function book_append_sheet(wb: any, ws: any, name: string): void;
    export function sheet_add_aoa(ws: any, data: any[][], opts?: any): any;
    export function table_to_sheet(table: any, opts?: any): any;
    export function json_to_sheet(data: any[], opts?: any): any;
  }
  export function writeFile(wb: any, filename: string, opts?: any): any;
  export function write(wb: any, opts?: any): any;
  export function readFile(filename: string, opts?: any): any;
  export function read(data: any, opts?: any): any;
  const _default: {
    utils: typeof utils;
    writeFile: typeof writeFile;
    write: typeof write;
    readFile: typeof readFile;
    read: typeof read;
  };
  export default _default;
}
