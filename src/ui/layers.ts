/**
 * The stacking order, in one place.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 *
 * ModalShell sits at 120, and its own comment states the contract: "anything
 * opening from inside a modal must be above this." Nothing enforced it, and
 * nothing connected the two numbers, so the contract held only for as long as
 * whoever moved one remembered the other.
 *
 * It did not hold. The shell was raised from 50 to 120 in Aug 2026 to cover the
 * community app's sidebar. The date picker inside it stayed at 60, written
 * earlier and never revisited -- so picking a date in a sales window opened the
 * calendar BEHIND the modal it belongs to. Its own sub-layers (a time select at
 * 70, a label popover at 80) were consistent with each other and all below 120,
 * which is why the whole group failed together and none of them looked wrong on
 * its own.
 *
 * ── How to use it ───────────────────────────────────────────────────────────
 *
 * Anything that portals to document.body takes a value from here rather than
 * inventing one. Two rules, both learned the hard way:
 *
 *   1. A popover opened from inside a modal must be ABOVE `modal`.
 *   2. Its own children (a select inside that popover) must be above IT.
 *
 * The gaps are deliberate: they leave room to slot a layer between two others
 * without renumbering everything below.
 *
 * Host apps have their own ceilings this must not collide with -- the community
 * app's Select is z-[200] and the admin's DatePicker z-[9999] -- so everything
 * here stays under 200.
 */
export const LAYERS = {
    /** Page furniture: sidebars, sticky bars, headers. Below every overlay. */
    appShell: 60,
    /** ModalShell's backdrop and panel. */
    modal: 120,
    /** A popover opened from inside a modal: calendars, pickers, menus. */
    popoverInModal: 140,
    /** A select or dropdown opened from inside such a popover. */
    popoverChild: 160,
    /** Toasts and confirmations, which must clear everything above. */
    alert: 180,
} as const;

export type LayerName = keyof typeof LAYERS;
