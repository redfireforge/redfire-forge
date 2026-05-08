/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx-js-style';
import { downloadExcel } from './csvTemplateExcel';

vi.mock('../../../shared/utils/fileSaver', () => ({
  saveFile: vi.fn().mockResolvedValue(undefined),
}));

describe('downloadExcel', () => {
  it('serializes workbook to blob and invokes saveFile', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([['x']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    await downloadExcel(wb, 'tpl.xlsx');
    const { saveFile } = await import('../../../shared/utils/fileSaver');
    expect(saveFile).toHaveBeenCalledWith(
      expect.any(Blob),
      expect.objectContaining({
        filename: 'tpl.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        description: 'Excel file',
      }),
    );
  });
});
