const XLSX = require('xlsx');

/**
 * Excel 导入通用工具
 * 
 * 使用示例:
 *   const ExcelImporter = require('./shared/excel-import');
 *   const importer = new ExcelImporter({
 *     columns: { name: '姓名', student_no: '学号', ... },
 *     required: ['name', 'student_no'],
 *     parseRows: (row, idx) => { ... return data or null; },
 *     onRow: (data, db) => { ... return { inserted: true }; }
 *   });
 *   const result = importer.import(filePath, db);
 */

class ExcelImporter {
  /**
   * @param {Object} options
   * @param {Object<string,string>} options.columns - key→表头中文名 映射
   * @param {string[]} options.required - 必填列的 key 列表
   * @param {Function} [options.parseRow] - 解析单行, 返回 null 跳过该行
   * @param {Function} options.onRow - 处理单行 (data, db) => { inserted, skipped, error }
   */
  constructor(options) {
    this.columns = options.columns;
    this.required = options.required || [];
    this.parseRow = options.parseRow || null;
    this.onRow = options.onRow;
  }

  /**
   * 从上传文件路径导入 Excel 数据
   * @param {string} filePath - 上传的文件路径
   * @param {object} db - better-sqlite3 数据库实例
   * @returns {{ success: number, skip: number, errors: string[], total: number }}
   */
  import(filePath, db) {
    const wb = XLSX.readFile(filePath);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
    if (!rows.length || rows.length < 2) {
      throw new Error('Excel 文件无数据');
    }

    const headers = rows[0].map(h => String(h || '').trim());
    const idx = {};
    Object.entries(this.columns).forEach(([key, label]) => {
      idx[key] = headers.indexOf(label);
    });

    const missing = this.required.filter(k => idx[k] < 0);
    if (missing.length > 0) {
      throw new Error('缺少必填列: ' + missing.map(k => this.columns[k]).join('、'));
    }

    let success = 0, skip = 0;
    const errors = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      try {
        let data = null;

        if (this.parseRow) {
          data = this.parseRow(row, idx, i);
        } else {
          data = {};
          Object.keys(idx).forEach(k => {
            data[k] = idx[k] >= 0 ? String(row[idx[k]] || '').trim() : '';
          });
        }

        if (data === null) continue;

        const result = this.onRow(data, db);
        if (result.inserted) success++;
        else if (result.skipped) skip++;
        if (result.error) errors.push(result.error);
      } catch (e) {
        errors.push('第' + (i + 1) + '行: ' + e.message);
      }
    }

    return { success, skip, errors: errors.slice(0, 20), total: rows.length - 1 };
  }

  /**
   * 生成 Excel 导入模板并写入响应
   * @param {express.Response} res
   * @param {string} filename - 下载文件名
   * @param {string[][]} [instructions] - 填写说明, 每行一个数组
   */
  static sendTemplate(res, columns, filename, instructions) {
    const headers = Object.values(columns);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([], { header: headers });
    const colWidths = headers.map(h => ({ wch: Math.max(h.length * 2, 10) }));
    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, '数据');

    if (instructions && instructions.length) {
      const is = XLSX.utils.aoa_to_sheet([
        ['填写说明'],
        ...instructions.map(r => [r])
      ]);
      XLSX.utils.book_append_sheet(wb, is, '填写说明');
    }

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=' + encodeURIComponent(filename));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
  }
}

module.exports = ExcelImporter;
