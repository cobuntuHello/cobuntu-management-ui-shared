/**
 * Manage-page exports (T-397): one table, written as Excel or CSV.
 *
 * Anna's Food for Thought export (24 Nov 2026) opened in Excel with "GonÃ§alo"
 * for "Gonçalo" and a garbled dash for gifted tickets' price: the CSV had no
 * byte-order mark. These pin the CSV fixes, check the workbook is a valid zip
 * whose parts say what Excel needs, and the menu that picks between them.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
    columnLetter, crc32, excelSerial, safeFileBase, safeSheetName, toCsv, toXlsx, type ExportTable,
} from "../export/tableExport";
import { ExportMenu } from "../export/ExportMenu";
import { ManageLedger } from "../ledger/ManageLedger";
import type { ItemLedger, LedgerMovement } from "../ledger/types";
import { defaultTranslate } from "../listings/copy";

const TABLE: ExportTable = {
    sheetName: "Food for Thought #1",
    columns: [
        { header: "Name" }, { header: "Ticket price", kind: "money" }, { header: "Date", kind: "date" }, { header: "Seats", kind: "number" },
    ],
    rows: [
        ["Gonçalo Pinto", 36.9, new Date(2026, 10, 17), 1],
        ["João \"Jo\" Paulo, Jr.", 0, null, 2],
        ["=HYPERLINK(\"x\")", null, new Date(2026, 10, 19), null],
    ],
};

/** The files inside a stored zip, read back by hand (the writer never compresses). */
function unzip(bytes: Uint8Array): Map<string, string> {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const dec = new TextDecoder();
    const out = new Map<string, string>();
    let at = 0;
    while (view.getUint32(at, true) === 0x04034b50) {
        const crc = view.getUint32(at + 14, true);
        const size = view.getUint32(at + 18, true);
        const nameLen = view.getUint16(at + 26, true);
        const name = dec.decode(bytes.subarray(at + 30, at + 30 + nameLen));
        const data = bytes.subarray(at + 30 + nameLen, at + 30 + nameLen + size);
        expect({ name, crc: crc32(data) }).toEqual({ name, crc });
        out.set(name, dec.decode(data));
        at += 30 + nameLen + size;
    }
    expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(bytes.length - 22 + 10, true)).toBe(out.size);
    return out;
}

describe("CSV", () => {
    it("starts with a UTF-8 byte-order mark, so Excel reads accents as accents", () => {
        const csv = toCsv(TABLE);
        expect(csv.charCodeAt(0)).toBe(0xfeff);
        expect(csv).toContain("Gonçalo Pinto");
        expect(csv).not.toMatch(/[—–]/);
    });

    it("quotes what needs quoting, uses CRLF, writes money with two decimals and dates as YYYY-MM-DD", () => {
        const lines = toCsv(TABLE).slice(1).split("\r\n");
        expect(lines[0]).toBe("Name,Ticket price,Date,Seats");
        expect(lines[1]).toBe("Gonçalo Pinto,36.90,2026-11-17,1");
        expect(lines[2]).toBe('"João ""Jo"" Paulo, Jr.",0.00,,2');
        expect(lines[4]).toBe("");
    });

    it("never lets a cell run as a formula", () => {
        expect(toCsv(TABLE)).toContain(`"'=HYPERLINK(""x"")"`);
        expect(toCsv({ sheetName: "s", columns: [{ header: "a" }], rows: [["-1+1"], ["@SUM(A1)"]] })).toContain("'-1+1\r\n'@SUM(A1)");
    });

    it("keeps a negative amount a number", () => {
        expect(toCsv({ sheetName: "s", columns: [{ header: "a", kind: "money" }], rows: [[-12.5]] })).toContain("\r\n-12.50\r\n");
    });
});

describe("Excel workbook", () => {
    it("is a valid zip holding the six parts Excel needs", () => {
        const parts = unzip(toXlsx(TABLE));
        expect([...parts.keys()].sort()).toEqual([
            "[Content_Types].xml", "_rels/.rels", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/workbook.xml", "xl/worksheets/sheet1.xml",
        ]);
        expect(parts.get("xl/workbook.xml")).toContain('<sheet name="Food for Thought #1" sheetId="1" r:id="rId1"/>');
    });

    it("writes text as text, money and seats as numbers, dates as dates, with a bold frozen header", () => {
        const sheet = unzip(toXlsx(TABLE)).get("xl/worksheets/sheet1.xml")!;
        expect(sheet).toContain('<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Name</t></is></c>');
        expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">Gonçalo Pinto</t></is></c>');
        expect(sheet).toContain('<c r="B2" s="2"><v>36.9</v></c>');
        expect(sheet).toContain(`<c r="C2" s="3"><v>${excelSerial(new Date(2026, 10, 17))}</v></c>`);
        expect(sheet).toContain('<c r="D3"><v>2</v></c>');
        expect(sheet).toContain('state="frozen"');
        expect(sheet).toContain('<autoFilter ref="A1:D4"/>');
        // Text that looks like a formula stays text in a workbook, escaped.
        expect(sheet).toContain("=HYPERLINK(&quot;x&quot;)");
        expect(sheet).not.toContain("<f>");
    });

    it("drops characters XML cannot hold rather than writing a file Excel refuses", () => {
        const sheet = unzip(toXlsx({ sheetName: "s", columns: [{ header: "a" }], rows: [["bad\u0001char & <tag>"]] })).get("xl/worksheets/sheet1.xml")!;
        expect(sheet).toContain("badchar &amp; &lt;tag&gt;");
    });

    it("names columns and sheets the way Excel does", () => {
        expect([0, 25, 26, 27, 51, 52, 701, 702].map(columnLetter)).toEqual(["A", "Z", "AA", "AB", "AZ", "BA", "ZZ", "AAA"]);
        expect(safeSheetName("Attendees: Food/Thought [1] *final* and a very long tail")).toBe("Attendees Food Thought 1 final");
        expect(safeSheetName("")).toBe("Sheet1");
        expect(excelSerial(new Date(1900, 0, 1))).toBe(2);
        expect(excelSerial(new Date(2026, 10, 24, 12))).toBe(46350.5);
        expect(safeFileBase("food/for:thought #1")).toBe("food-for-thought #1");
    });
});

describe("Export menu", () => {
    it("opens on the button and hands back the picked format", () => {
        const onExport = vi.fn();
        render(<ExportMenu label="Export" onExport={onExport} />);
        expect(screen.queryByRole("menu")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        fireEvent.click(screen.getByRole("menuitem", { name: "Excel (.xlsx)" }));
        expect(onExport).toHaveBeenLastCalledWith("xlsx");
        expect(screen.queryByRole("menu")).toBeNull();
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        fireEvent.click(screen.getByRole("menuitem", { name: "CSV (.csv)" }));
        expect(onExport).toHaveBeenLastCalledWith("csv");
    });

    it("closes on Escape", () => {
        render(<ExportMenu label="Export" onExport={() => undefined} />);
        fireEvent.click(screen.getByRole("button", { name: "Export" }));
        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByRole("menu")).toBeNull();
    });
});

describe("the item ledger's export", () => {
    const movement = (over: Partial<LedgerMovement>): LedgerMovement => ({
        key: Math.random().toString(36), kind: "sale", at: "2026-11-20T10:00:00Z", currency: "EUR", sign: 1,
        gross: 3690, communityCut: 240, sellerNet: 3296, status: "PAID", buyerName: "Gonçalo", ...over,
    } as LedgerMovement);
    const ledger = (movements: LedgerMovement[]): ItemLedger => ({ kind: "product", currency: "EUR", movements });

    it("writes money in euros, not cents, and a refund as a negative amount", async () => {
        const blobs: Blob[] = [];
        const create = vi.spyOn(URL, "createObjectURL").mockImplementation((b) => { blobs.push(b as Blob); return "blob:x"; });
        vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
        render(<ManageLedger ledger={ledger([movement({}), movement({ kind: "refund", sign: -1, gross: 3690, sellerNet: 3296, status: "COMPLETED" })])} t={defaultTranslate} />);
        fireEvent.click(screen.getByRole("button", { name: defaultTranslate("ledgerExportCsv") }));
        fireEvent.click(screen.getByRole("menuitem", { name: "CSV (.csv)" }));
        const csv = await blobs[0].text();
        expect(csv).toContain("36.90");
        expect(csv).toContain("-36.90");
        expect(csv).not.toContain("3690");
        expect(csv).toContain("Gonçalo");
        create.mockRestore();
    });
});
