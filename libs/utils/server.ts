import csv from "async-csv";

export function parseCsv<T=any>(csvData: string): Promise<T>  {
  return csv.parse(csvData, { columns: true }) as Promise<T>
}