import { describe, it, expect } from "vitest";
import {
    parseCsvRecipientRows, matchTier, planImport, recipientsFromPlan,
    type TierOption,
} from "../lib/recipients";

/**
 * What an import would do, before it does it.
 *
 * ── Why a plan exists at all ────────────────────────────────────────────────
 *
 * Adding somebody consumes a tier's capacity. A half-finished import leaves
 * the host reconciling two lists — who got in, who did not, how much room is
 * left — so the whole outcome is shown first and committed once.
 *
 * The failure this guards against is the quiet one: a row naming a tier that
 * does not exist, or five rows for a tier with three seats. Both look like a
 * successful import right up until somebody counts.
 */

const tiers: TierOption[] = [
    { id: "t-ga", name: "General", remaining: 3, soldOut: false },
    { id: "t-vip", name: "VIP", remaining: 0, soldOut: true },
    { id: "t-open", name: "Open", remaining: null, soldOut: false },
];

describe("reading the file", () => {
    it("takes the address from column one and the tier from column two", () => {
        expect(parseCsvRecipientRows("ana@example.com,VIP\nbo@example.com,General")).toEqual([
            { email: "ana@example.com", tierName: "VIP" },
            { email: "bo@example.com", tierName: "General" },
        ]);
    });

    it("skips a header instead of importing somebody called 'email'", () => {
        expect(parseCsvRecipientRows("email,tier\nana@example.com,VIP"))
            .toEqual([{ email: "ana@example.com", tierName: "VIP" }]);
    });

    it("accepts a file with no tier column at all", () => {
        // Then the whole file falls to the chosen default tier.
        expect(parseCsvRecipientRows("ana@example.com")).toEqual([
            { email: "ana@example.com", tierName: null },
        ]);
    });

    it("deduplicates, so a list pasted twice adds each person once", () => {
        expect(parseCsvRecipientRows("ana@example.com,VIP\nANA@example.com,General"))
            .toHaveLength(1);
    });

    it("survives quotes, blank lines and CRLF", () => {
        expect(parseCsvRecipientRows('"ana@example.com","VIP"\r\n\r\nbo@example.com,General\r\n'))
            .toEqual([
                { email: "ana@example.com", tierName: "VIP" },
                { email: "bo@example.com", tierName: "General" },
            ]);
    });
});

describe("matching a tier by name", () => {
    it("ignores case and surrounding space", () => {
        expect(matchTier("  vip ", tiers)?.id).toBe("t-vip");
    });

    it("refuses to guess at a near miss", () => {
        /*
         * Deliberately exact. Deciding that "VIP Plus" meant "VIP" would seat
         * somebody on the wrong shelf, and this is the one place being wrong
         * is silent — the row reads as imported either way.
         */
        expect(matchTier("VIP Plus", tiers)).toBeNull();
        expect(matchTier("Genera", tiers)).toBeNull();
    });
});

describe("planning the import", () => {
    it("routes each row to the tier its own column names", () => {
        const plan = planImport(
            [{ email: "a@x.com", tierName: "General" }, { email: "b@x.com", tierName: "Open" }],
            tiers, null,
        );
        expect(plan.rows.map((r) => r.tierId)).toEqual(["t-ga", "t-open"]);
        expect(plan.problems).toHaveLength(0);
    });

    it("falls back to the chosen default when a row names no tier", () => {
        const plan = planImport([{ email: "a@x.com", tierName: null }], tiers, "t-ga");
        expect(plan.rows[0]).toMatchObject({ tierId: "t-ga", problem: null });
    });

    it("flags a tier name that does not exist rather than guessing", () => {
        // The typo case. Importing this row anywhere would be a wrong answer.
        const plan = planImport([{ email: "a@x.com", tierName: "Erly Bird" }], tiers, "t-ga");
        expect(plan.rows[0]).toMatchObject({ problem: "unknown-tier", tierName: "Erly Bird", tierId: null });
        expect(plan.ok).toHaveLength(0);
    });

    it("flags a row with no tier and no default", () => {
        const plan = planImport([{ email: "a@x.com", tierName: null }], tiers, null);
        expect(plan.rows[0].problem).toBe("no-tier");
    });

    it("fits what fits and flags the overflow, in file order", () => {
        /*
         * Three seats left, five rows. The first three are importable and the
         * last two are not — rejecting all five would be a worse answer, and
         * silently importing all five would oversell the tier.
         */
        const rows = ["a", "b", "c", "d", "e"].map((n) => ({ email: `${n}@x.com`, tierName: "General" }));
        const plan = planImport(rows, tiers, null);

        expect(plan.ok.map((r) => r.email)).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
        expect(plan.problems.map((r) => r.email)).toEqual(["d@x.com", "e@x.com"]);
        expect(plan.problems.every((r) => r.problem === "tier-full")).toBe(true);
    });

    it("counts earlier rows of the same file against later ones", () => {
        // Row four is judged against what rows one to three already took, not
        // against the tier's starting figure.
        const rows = ["a", "b", "c", "d"].map((n) => ({ email: `${n}@x.com`, tierName: "General" }));
        const plan = planImport(rows, tiers, null);
        expect(plan.rows[3].problem).toBe("tier-full");
    });

    it("takes as many as you like on an uncapped tier", () => {
        const rows = Array.from({ length: 50 }, (_, i) => ({ email: `u${i}@x.com`, tierName: "Open" }));
        const plan = planImport(rows, tiers, null);
        expect(plan.problems).toHaveLength(0);
        expect(plan.perTier.find((t) => t.tierId === "t-open")?.overBy).toBe(0);
    });

    it("refuses everything for a tier that is already sold out", () => {
        const plan = planImport([{ email: "a@x.com", tierName: "VIP" }], tiers, null);
        expect(plan.rows[0].problem).toBe("tier-full");
    });

    it("reports what the import does to each tier", () => {
        // This is the summary the preview shows: how many are going where,
        // and by how much it would overflow.
        const plan = planImport([
            { email: "a@x.com", tierName: "General" },
            { email: "b@x.com", tierName: "General" },
            { email: "c@x.com", tierName: "General" },
            { email: "d@x.com", tierName: "General" },
            { email: "e@x.com", tierName: "Open" },
        ], tiers, null);

        expect(plan.perTier).toEqual(expect.arrayContaining([
            { tierId: "t-ga", name: "General", adding: 4, remaining: 3, overBy: 1 },
            { tierId: "t-open", name: "Open", adding: 1, remaining: null, overBy: 0 },
        ]));
    });

    it("handles a mixed file — some named, some default, some broken", () => {
        const plan = planImport([
            { email: "a@x.com", tierName: "Open" },
            { email: "b@x.com", tierName: null },
            { email: "c@x.com", tierName: "Nope" },
        ], tiers, "t-ga");

        expect(plan.rows[0]).toMatchObject({ tierId: "t-open", problem: null });
        expect(plan.rows[1]).toMatchObject({ tierId: "t-ga", problem: null });
        expect(plan.rows[2]).toMatchObject({ problem: "unknown-tier" });
    });
});

describe("committing a plan", () => {
    it("stages only the rows that can actually be added", () => {
        const plan = planImport([
            { email: "a@x.com", tierName: "Open" },
            { email: "b@x.com", tierName: "Nope" },
        ], tiers, null);

        expect(recipientsFromPlan(plan)).toEqual([{ email: "a@x.com", tierId: "t-open" }]);
    });

    it("carries the tier onto each recipient, which is what the endpoint needs", () => {
        const plan = planImport([{ email: "a@x.com", tierName: "General" }], tiers, null);
        expect(recipientsFromPlan(plan)[0].tierId).toBe("t-ga");
    });
});
