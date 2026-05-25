declare module 'pdf-parse' {
  interface PDFData {
    text: string;
    numpages: number;
    info: {
      Title?: string;
      Author?: string;
    };
  }
  function parse(dataBuffer: Buffer): Promise<PDFData>;
  export = parse;
}
