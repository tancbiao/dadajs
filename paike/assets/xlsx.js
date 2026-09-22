/* ============================================================
 *  xlsx.js —— 零依赖 XLSX 生成（ZIP store 模式，纯前端离线可用）
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- CRC32 ---------- */
  const CRC_TABLE = (function () {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c >>> 0;
    }
    return t;
  })();
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  const enc = new TextEncoder();
  function utf8(s) { return enc.encode(s); }

  /* ---------- ZIP (store) ---------- */
  function zip(files) {
    const chunks = [], central = [];
    let offset = 0;
    const dt = { time: 0x9C00, date: 0x5A21 }; // 任意固定时间戳

    files.forEach(f => {
      const nameBuf = utf8(f.name), data = f.data;
      const crc = crc32(data);
      const lh = new Uint8Array(30 + nameBuf.length);
      const dv = new DataView(lh.buffer);
      dv.setUint32(0, 0x04034b50, true);
      dv.setUint16(4, 20, true);
      dv.setUint16(6, 0x0800, true);
      dv.setUint16(8, 0, true);
      dv.setUint16(10, dt.time, true);
      dv.setUint16(12, dt.date, true);
      dv.setUint32(14, crc, true);
      dv.setUint32(18, data.length, true);
      dv.setUint32(22, data.length, true);
      dv.setUint16(26, nameBuf.length, true);
      dv.setUint16(28, 0, true);
      lh.set(nameBuf, 30);
      chunks.push(lh, data);

      const ch = new Uint8Array(46 + nameBuf.length);
      const cv = new DataView(ch.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);
      cv.setUint16(6, 20, true);
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, dt.time, true);
      cv.setUint16(14, dt.date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, data.length, true);
      cv.setUint32(24, data.length, true);
      cv.setUint16(28, nameBuf.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      ch.set(nameBuf, 46);
      central.push(ch);

      offset += lh.length + data.length;
    });

    const cdSize = central.reduce((a, b) => a + b.length, 0);
    const eocd = new Uint8Array(22);
    const ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, files.length, true);
    ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    return new Blob(chunks.concat(central, [eocd]), {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  /* ---------- 列号转字母 ---------- */
  function colName(n) {
    let s = '';
    while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = (n - 1 - m) / 26; }
    return s;
  }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/\u0000/g, '');
  }

  /* ---------- Sheet 描述 ----------
   * sheet = {
   *   name, cols:[{w:number}], rows:[ {h:number, cells:[{v, s, merge:[r,c]}]} ]
   * }
   * 样式索引：0 默认 1 标题 2 表头 3 侧栏 4 内容 5+ 科目色
   * ------------------------------------------------ */

  const FONTS = [
    '<font><sz val="11"/><name val="宋体"/></font>',
    '<font><b/><sz val="18"/><name val="微软雅黑"/></font>',
    '<font><b/><sz val="11"/><name val="微软雅黑"/></font>',
    '<font><sz val="11"/><name val="微软雅黑"/></font>',
    '<font><b/><sz val="11"/><color rgb="FF334155"/><name val="微软雅黑"/></font>'
  ];
  let EXTRA_FILLS = [];     // 科目配色
  let EXTRA_STYLES = [];    // 科目样式索引

  function buildStyles() {
    const fills = [
      '<fill><patternFill patternType="none"/></fill>',
      '<fill><patternFill patternType="gray125"/></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFDCE6F1"/><bgColor indexed="64"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF9E6"/><bgColor indexed="64"/></patternFill></fill>'
    ];
    EXTRA_FILLS.forEach(c => {
      fills.push('<fill><patternFill patternType="solid"><fgColor rgb="FF' + c + '"/><bgColor indexed="64"/></patternFill></fill>');
    });

    const borders = [
      '<border><left/><right/><top/><bottom/><diagonal/></border>',
      '<border><left style="thin"><color rgb="FF9AA5B1"/></left><right style="thin"><color rgb="FF9AA5B1"/></right>' +
      '<top style="thin"><color rgb="FF9AA5B1"/></top><bottom style="thin"><color rgb="FF9AA5B1"/></bottom><diagonal/></border>'
    ];

    const xfs = [
      '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',                       // 0 默认
      '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"' +
        ' applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>',        // 1 标题
      '<xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1"' +
        ' applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>', // 2 表头
      '<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1"' +
        ' applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>', // 3 侧栏
      '<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1"' +
        ' applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>', // 4 内容
      '<xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1"' +
        ' applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>'  // 5 提示行
    ];
    EXTRA_STYLES.forEach((c, i) => {
      xfs.push('<xf numFmtId="0" fontId="3" fillId="' + (5 + i) + '" borderId="1" xfId="0"' +
        ' applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' +
        '<alignment horizontal="center" vertical="center" wrapText="1"/></xf>');
    });

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="' + FONTS.length + '">' + FONTS.join('') + '</fonts>' +
      '<fills count="' + fills.length + '">' + fills.join('') + '</fills>' +
      '<borders count="' + borders.length + '">' + borders.join('') + '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + xfs.length + '">' + xfs.join('') + '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="常规" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';
  }

  function sheetXml(sheet) {
    let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';

    if (sheet.cols && sheet.cols.length) {
      xml += '<cols>';
      sheet.cols.forEach((w, i) => {
        xml += '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + (w || 10) + '" customWidth="1"/>';
      });
      xml += '</cols>';
    }

    xml += '<sheetData>';
    sheet.rows.forEach((row, ri) => {
      xml += '<row r="' + (ri + 1) + '"' + (row.h ? ' ht="' + row.h + '" customHeight="1"' : '') + '>';
      (row.cells || []).forEach((cell, ci) => {
        if (!cell || cell.v === undefined || cell.v === null || cell.v === '') {
          if (cell && cell.s !== undefined) xml += '<c r="' + colName(ci + 1) + (ri + 1) + '" s="' + cell.s + '"/>';
          return;
        }
        xml += '<c r="' + colName(ci + 1) + (ri + 1) + '"' +
          (cell.s !== undefined ? ' s="' + cell.s + '"' : '') + ' t="inlineStr">' +
          '<is><t xml:space="preserve">' + esc(cell.v) + '</t></is></c>';
      });
      xml += '</row>';
    });
    xml += '</sheetData>';

    const merges = [];
    sheet.rows.forEach((row, ri) => {
      (row.cells || []).forEach((cell, ci) => {
        if (cell && cell.merge) {
          // cell.merge = [跨行数-1, 跨列数-1]
          merges.push(colName(ci + 1) + (ri + 1) + ':' +
            colName(ci + 1 + cell.merge[1]) + (ri + 1 + cell.merge[0]));
        }
      });
    });
    if (merges.length) {
      xml += '<mergeCells count="' + merges.length + '">' +
        merges.map(m => '<mergeCell ref="' + m + '"/>').join('') + '</mergeCells>';
    }

    xml += '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>';
    xml += '</worksheet>';
    return xml;
  }

  function build(sheets, filename) {
    EXTRA_FILLS = []; EXTRA_STYLES = [];
    // 预留科目配色槽位（占位，业务层用 styleIndexFor 取）
    global.__XLSX_FILL_START = 6;

    const n = sheets.length;
    let contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    for (let i = 1; i <= n; i++) {
      contentTypes += '<Override PartName="/xl/worksheets/sheet' + i + '.xml" ' +
        'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
    }
    contentTypes += '</Types>';

    const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';

    let wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
    sheets.forEach((s, i) => {
      wb += '<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
    });
    wb += '</sheets></workbook>';

    let wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    sheets.forEach((s, i) => {
      wbRels += '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
    });
    wbRels += '<Relationship Id="rId' + (n + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
    wbRels += '</Relationships>';

    const files = [
      { name: '[Content_Types].xml', data: utf8(contentTypes) },
      { name: '_rels/.rels', data: utf8(rootRels) },
      { name: 'xl/workbook.xml', data: utf8(wb) },
      { name: 'xl/_rels/workbook.xml.rels', data: utf8(wbRels) }
    ];
    const styleXml = utf8(buildStyles());
    sheets.forEach((s, i) => {
      files.push({ name: 'xl/worksheets/sheet' + (i + 1) + '.xml', data: utf8(sheetXml(s)) });
    });
    files.push({ name: 'xl/styles.xml', data: styleXml });
    // styles 的 rel id 需保持 n+1，插入顺序无所谓（rels 按 Id 定位）
    // 但 files 顺序会影响 central directory，不影响正确性

    return zip(files);
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
  }

  global.Xlsx = { build, download, colName, esc };
})(window);
