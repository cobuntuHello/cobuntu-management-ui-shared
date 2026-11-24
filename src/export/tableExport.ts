/**
 * One table, two files: a real Excel workbook (.xlsx) or a CSV (T-397).
 *
 * Every export on the manage pages (attendees, sales, ledgers) builds an
 * ExportTable and hands it here, so they all get the same fixes:
 *
 *   - CSV starts with a UTF-8 byte-order mark. Without it Excel reads the file
 *     as Windows-1252 and "Gonçalo" arrives as "GonÃ§alo" (Anna's Food for
 *     Thought export, 24 Nov 2026).
 *   - The .xlsx needs no guessing at all: text is text, numbers are numbers,
 *     dates are dates, whatever the opener's language. Excel set to Portuguese
 *     splits a CSV on ";" and squashes a comma CSV into one column; a workbook
 *     has no separator.
 *   - A CSV text cell that starts with = + - @ is prefixed with ' so a
 *     spreadsheet never runs it as a formula (a buyer's name is user input).
 *
 * The workbook is written by hand (a zip of six XML parts, stored without
 * compression) rather than with a library: the files are small, and a new
 * dependency here would ripple through every package and both apps' lockfiles.
 */

export type ExportCell = string | number | Date | null | undefined;

export interface ExportColumn {
    header: string;
    /** How the cell is written in the workbook. Text by default. */
    kind?: "text" | "number" | "money" | "date";
    /** Width in characters; a sensible one is picked from the content otherwise. */
    width?: number;
}

export interface ExportTable {
    /** The sheet's name (Excel keeps 31 characters). */
    sheetName: string;
    columns: ExportColumn[];
    rows: ExportCell[][];
}

export type ExportFormat = "xlsx" | "csv";

// ─── CSV ─────────────────────────────────────────────────────────────────────

const FORMULA_START = /^[=+\-@\t\r]/;

function csvField(value: ExportCell, kind: ExportColumn["kind"]): string {
    if (value == null) return "";
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : isoDay(value);
    if (typeof value === "number") {
        if (!Number.isFinite(value)) return "";
        return kind === "money" ? value.toFixed(2) : String(value);
    }
    let s = String(value);
    if (FORMULA_START.test(s)) s = `'${s}`;
    return /[",\r\n]|^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC 4180 with CRLF line ends, behind a UTF-8 byte-order mark. */
export function toCsv(table: ExportTable): string {
    const lines = [table.columns.map((c) => csvField(c.header, "text")).join(",")];
    for (const row of table.rows) {
        lines.push(table.columns.map((c, i) => csvField(row[i], c.kind)).join(","));
    }
    return `﻿${lines.join("\r\n")}\r\n`;
}

// ─── XLSX ────────────────────────────────────────────────────────────────────

// Characters XML 1.0 cannot carry at all (control characters other than tab and line ends).
// eslint-disable-next-line no-control-regex
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

function xmlText(s: string): string {
    return s.replace(XML_INVALID, "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** "A", "B", ... "Z", "AA" ... */
export function columnLetter(index: number): string {
    let n = index + 1;
    let s = "";
    while (n > 0) {
        const r = (n - 1) % 26;
        s = String.fromCharCode(65 + r) + s;
        n = Math.floor((n - 1) / 26);
    }
    return s;
}

/** Excel's day number for a moment, on the viewer's calendar (1900 system). */
export function excelSerial(d: Date): number {
    const local = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds());
    return (local - Date.UTC(1899, 11, 30)) / 86_400_000;
}

function isoDay(d: Date): string {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** A sheet name Excel accepts: no []:*?/\ and at most 31 characters. */
export function safeSheetName(name: string): string {
    const cleaned = name.replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31).trim();
    return cleaned || "Sheet1";
}

// Styles: 0 default, 1 bold header, 2 money (#,##0.00), 3 date (locale short date, builtin 14).
const STYLES_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>'
    + '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>'
    + '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>'
    + '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + '<cellXfs count="4">'
    + '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
    + '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
    + '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
    + '</cellXfs>'
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
    + '</styleSheet>';

function cellXml(ref: string, value: ExportCell, kind: ExportColumn["kind"]): string {
    if (value == null || value === "") return "";
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? "" : `<c r="${ref}" s="3"><v>${excelSerial(value)}</v></c>`;
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value)) return "";
        return `<c r="${ref}"${kind === "money" ? ' s="2"' : ""}><v>${value}</v></c>`;
    }
    // Inline strings: never parsed as formulas, so no ' prefix is needed here.
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlText(String(value))}</t></is></c>`;
}

function columnWidths(table: ExportTable): number[] {
    return table.columns.map((c, i) => {
        if (c.width) return c.width;
        let longest = c.header.length;
        for (const row of table.rows.slice(0, 500)) {
            const v = row[i];
            const len = v instanceof Date ? 11 : v == null ? 0 : String(v).length;
            if (len > longest) longest = len;
        }
        return Math.min(Math.max(longest + 2, 8), 60);
    });
}

function sheetXml(table: ExportTable): string {
    const lastCol = columnLetter(Math.max(table.columns.length - 1, 0));
    const lastRow = table.rows.length + 1;
    const cols = columnWidths(table)
        .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
    const header = `<row r="1">${table.columns
        .map((c, i) => `<c r="${columnLetter(i)}1" s="1" t="inlineStr"><is><t xml:space="preserve">${xmlText(c.header)}</t></is></c>`)
        .join("")}</row>`;
    const body = table.rows.map((row, r) => {
        const n = r + 2;
        return `<row r="${n}">${table.columns.map((c, i) => cellXml(`${columnLetter(i)}${n}`, row[i], c.kind)).join("")}</row>`;
    }).join("");
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        + `<dimension ref="A1:${lastCol}${lastRow}"/>`
        // The header row stays in view while scrolling.
        + '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        + `<cols>${cols}</cols>`
        + `<sheetData>${header}${body}</sheetData>`
        + (table.columns.length ? `<autoFilter ref="A1:${lastCol}${lastRow}"/>` : "")
        + '</worksheet>';
}

function workbookParts(table: ExportTable): Array<{ name: string; xml: string }> {
    const sheet = xmlText(safeSheetName(table.sheetName));
    return [
        {
            name: "[Content_Types].xml",
            xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                + '<Default Extension="xml" ContentType="application/xml"/>'
                + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
                + '</Types>',
        },
        {
            name: "_rels/.rels",
            xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
                + '</Relationships>',
        },
        {
            name: "xl/workbook.xml",
            xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                + `<sheets><sheet name="${sheet}" sheetId="1" r:id="rId1"/></sheets>`
                + (table.columns.length
                    ? `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${sheet.replace(/'/g, "''")}'!$A$1:$${columnLetter(table.columns.length - 1)}$${table.rows.length + 1}</definedName></definedNames>`
                    : "")
                + '</workbook>',
        },
        {
            name: "xl/_rels/workbook.xml.rels",
            xml: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
                + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
                + '</Relationships>',
        },
        { name: "xl/styles.xml", xml: STYLES_XML },
        { name: "xl/worksheets/sheet1.xml", xml: sheetXml(table) },
    ];
}

// ─── Zip (stored, no compression) ────────────────────────────────────────────

let CRC_TABLE: Uint32Array | null = null;

export function crc32(bytes: Uint8Array): number {
    if (!CRC_TABLE) {
        CRC_TABLE = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            CRC_TABLE[n] = c >>> 0;
        }
    }
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

/** A zip archive of the given files, stored (method 0). */
export function zipStored(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
    const enc = new TextEncoder();
    const chunks: Uint8Array[] = [];
    const central: Uint8Array[] = [];
    let offset = 0;
    // 1 Jan 2026, 00:00 in DOS time: a fixed stamp keeps the bytes reproducible.
    const dosTime = 0;
    const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;
    for (const f of files) {
        const name = enc.encode(f.name);
        const crc = crc32(f.data);
        const local = new DataView(new ArrayBuffer(30));
        local.setUint32(0, 0x04034b50, true);
        local.setUint16(4, 20, true);
        local.setUint16(6, 0x0800, true); // names are UTF-8
        local.setUint16(8, 0, true);
        local.setUint16(10, dosTime, true);
        local.setUint16(12, dosDate, true);
        local.setUint32(14, crc, true);
        local.setUint32(18, f.data.length, true);
        local.setUint32(22, f.data.length, true);
        local.setUint16(26, name.length, true);
        local.setUint16(28, 0, true);
        chunks.push(new Uint8Array(local.buffer), name, f.data);

        const cd = new DataView(new ArrayBuffer(46));
        cd.setUint32(0, 0x02014b50, true);
        cd.setUint16(4, 20, true);
        cd.setUint16(6, 20, true);
        cd.setUint16(8, 0x0800, true);
        cd.setUint16(10, 0, true);
        cd.setUint16(12, dosTime, true);
        cd.setUint16(14, dosDate, true);
        cd.setUint32(16, crc, true);
        cd.setUint32(20, f.data.length, true);
        cd.setUint32(24, f.data.length, true);
        cd.setUint16(28, name.length, true);
        cd.setUint16(30, 0, true);
        cd.setUint16(32, 0, true);
        cd.setUint16(34, 0, true);
        cd.setUint16(36, 0, true);
        cd.setUint32(38, 0, true);
        cd.setUint32(42, offset, true);
        central.push(new Uint8Array(cd.buffer), name);
        offset += 30 + name.length + f.data.length;
    }
    const centralSize = central.reduce((a, c) => a + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, centralSize, true);
    end.setUint32(16, offset, true);
    const all = [...chunks, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((a, c) => a + c.length, 0));
    let at = 0;
    for (const c of all) { out.set(c, at); at += c.length; }
    return out;
}

/** The workbook's bytes. */
export function toXlsx(table: ExportTable): Uint8Array {
    const enc = new TextEncoder();
    return zipStored(workbookParts(table).map((p) => ({ name: p.name, data: enc.encode(p.xml) })));
}

// ─── Download ────────────────────────────────────────────────────────────────

const MIME: Record<ExportFormat, string> = {
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv;charset=utf-8",
};

/** A file name without characters a file system refuses. */
export function safeFileBase(name: string): string {
    return name.replace(/[\\/:*?"<>|\u0000-\u001F]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "export";
}

/** The file for a table, as a Blob, and its name. */
export function exportFile(table: ExportTable, format: ExportFormat, fileBase: string): { blob: Blob; filename: string } {
    const body = format === "xlsx" ? toXlsx(table) : toCsv(table);
    return { blob: new Blob([body as BlobPart], { type: MIME[format] }), filename: `${safeFileBase(fileBase)}.${format}` };
}

/** Saves the table in the browser. */
export function downloadTable(table: ExportTable, format: ExportFormat, fileBase: string): void {
    const { blob, filename } = exportFile(table, format, fileBase);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Some browsers read the URL after click() returns.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
