import { describe, expect, it } from "vitest";
import { LAYERS } from "../ui/layers";

/**
 * The stacking contract, asserted rather than commented.
 *
 * ModalShell's comment already said "anything opening from inside a modal must
 * be above this". It was true when written and false by August: the shell moved
 * from 50 to 120 and the management packages' date picker stayed at 60, so
 * picking a date in a sales window opened the calendar behind its own modal.
 *
 * A comment cannot fail. These can.
 */
describe("the layer scale", () => {
    it("puts a popover opened inside a modal above the modal", () => {
        expect(LAYERS.popoverInModal).toBeGreaterThan(LAYERS.modal);
    });

    it("puts that popover's own dropdown above it", () => {
        expect(LAYERS.popoverChild).toBeGreaterThan(LAYERS.popoverInModal);
    });

    it("keeps the modal above ordinary page furniture", () => {
        expect(LAYERS.modal).toBeGreaterThan(LAYERS.appShell);
    });

    it("keeps alerts above everything", () => {
        const others = Object.entries(LAYERS).filter(([k]) => k !== "alert");
        for (const [, v] of others) expect(LAYERS.alert).toBeGreaterThan(v);
    });

    /*
     * Host apps have ceilings of their own -- the community app's Select is
     * z-[200], the admin's DatePicker z-[9999]. Everything here must stay under
     * the lowest of those, or a modal starts covering the app's own controls.
     */
    it("stays below the host apps' own overlays", () => {
        for (const v of Object.values(LAYERS)) expect(v).toBeLessThan(200);
    });

    /*
     * Gaps are deliberate: they leave room to slot a layer between two others
     * without renumbering. Adjacent values would force exactly the renumbering
     * that produced this bug.
     */
    it("leaves room between layers", () => {
        const sorted = Object.values(LAYERS).sort((a, b) => a - b);
        for (let i = 1; i < sorted.length; i++) {
            expect(sorted[i] - sorted[i - 1]).toBeGreaterThanOrEqual(10);
        }
    });
});
