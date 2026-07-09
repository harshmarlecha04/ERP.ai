import ExcelJS from 'exceljs';

/**
 * Reads an Excel file and returns the first sheet's data as a 2D array.
 */
export async function readExcelFile(file: File): Promise<any[][]> {
  const buffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];

  const rows: any[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as any[];
    // ExcelJS row.values is 1-indexed (index 0 is undefined), so slice from 1
    rows.push(values.slice(1).map(v => {
      if (v === null || v === undefined) return '';
      if (typeof v === 'object' && v.result !== undefined) return v.result; // formula cells
      if (typeof v === 'object' && v.text !== undefined) return v.text; // rich text
      return v;
    }));
  });

  return rows;
}
