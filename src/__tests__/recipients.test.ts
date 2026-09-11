import { describe, it, expect } from "vitest";
import {
    recipientKey, fromPerson, looksLikeEmail, parseCsvEmails,
    addRecipients, visibleSuggestions, userIdsOf, emailsOf,
    recipientsToApi, perRecipientMessages, type Recipient,
} from "../lib/recipients";

/**
 * Staging people, from wherever they came from.
 *
 * The recurring bug in this area is DEDUPE BY THE WRONG KEY. A live example is
 * on screen right now: the events "Recently invited" row shows the same person
 * four times, because the backend dedupes invitations on the invitation's email
 * rather than on the user. One person invited under two addresses becomes two
 * chips with one name.
 *
 * Everything here keys on the USER ID when there is one, and these tests exist
 * to keep it that way.
 */

const ana = { id: "u-ana", name: "Ana Neto", usertag: "ana", profileImage: null };
const sofia = { id: "u-sofia", name: "Sofia", usertag: "sofia", profileImage: null };

describe("identity", () => {
    it("keys a user by id, not by their address", () => {
        // The whole point: the same person under two addresses is one person.
        const a: Recipient = { id: "u-ana", email: "ana@work.com" };
        const b: Recipient = { id: "u-ana", email: "ana@personal.com" };
        expect(recipientKey(a)).toBe(recipientKey(b));
    });

    it("keys an account-less recipient by address, case-insensitively", () => {
        expect(recipientKey({ email: "Ana@Example.com" })).toBe(recipientKey({ email: "ana@example.com " }));
    });

    it("does not confuse a user with an address", () => {
        expect(recipientKey({ id: "u-ana" })).not.toBe(recipientKey({ email: "u-ana" }));
    });
});

describe("what counts as an address", () => {
    it("accepts the shapes a strict regex tends to reject", () => {
        // This decides whether to OFFER an address, not whether it can receive
        // mail. Rejecting a valid one means somebody cannot invite a colleague.
        for (const v of ["a@b.co", "ana+tag@example.com", "ana@sub.domain.museum", "ünïcode@example.com"]) {
            expect(looksLikeEmail(v)).toBe(true);
        }
    });

    it("rejects what is plainly not one", () => {
        for (const v of ["", "ana", "@example.com", "ana@", "two words@example.com"]) {
            expect(looksLikeEmail(v)).toBe(false);
        }
    });
});

describe("CSV import", () => {
    it("takes the first column", async () => {
        expect(parseCsvEmails("ana@example.com,Ana,Porto\nbo@example.com,Bo,Lisbon"))
            .toEqual(["ana@example.com", "bo@example.com"]);
    });

    it("skips a header row instead of importing a person called 'email'", () => {
        expect(parseCsvEmails("email,name\nana@example.com,Ana")).toEqual(["ana@example.com"]);
    });

    it("deduplicates, so a list pasted twice is one invitation each", () => {
        expect(parseCsvEmails("ana@example.com\nANA@example.com\nbo@example.com"))
            .toEqual(["ana@example.com", "bo@example.com"]);
    });

    it("survives quotes, blank lines and CRLF", () => {
        expect(parseCsvEmails('"ana@example.com",Ana\r\n\r\n\'bo@example.com\',Bo\r\n'))
            .toEqual(["ana@example.com", "bo@example.com"]);
    });

    it("returns nothing rather than junk when the column is not addresses", () => {
        // Guessing which of six columns holds the email is how you import a
        // column of first names. Better to import nothing and say so.
        expect(parseCsvEmails("Ana,ana@example.com\nBo,bo@example.com")).toEqual([]);
    });
});

describe("staging", () => {
    it("does not stage the same person twice from two sources", async () => {
        // Picked from the roster AND present in an imported CSV — what happens
        // when somebody imports a list they had already half worked through.
        const staged = addRecipients([fromPerson(ana)], [{ id: "u-ana", email: "ana@example.com" }]);
        expect(staged).toHaveLength(1);
    });

    it("keeps a new array, because callers hold this in React state", () => {
        const before: Recipient[] = [fromPerson(ana)];
        const after = addRecipients(before, [fromPerson(sofia)]);
        expect(after).not.toBe(before);
        expect(before).toHaveLength(1);
    });

    it("preserves the order things were added in", () => {
        const out = addRecipients([fromPerson(ana)], [fromPerson(sofia), { email: "z@example.com" }]);
        expect(out.map(recipientKey)).toEqual(["u:u-ana", "u:u-sofia", "e:z@example.com"]);
    });
});

describe("splitting for the send endpoint", () => {
    const staged: Recipient[] = [
        fromPerson(ana),
        { id: "u-sofia", email: "sofia@example.com" },   // a member: has BOTH
        { email: "outsider@example.com" },
    ];

    it("takes the ids of everyone who has an account", () => {
        expect(userIdsOf(staged)).toEqual(["u-ana", "u-sofia"]);
    });

    it("does NOT also send a member's address — that invites them twice", () => {
        // Sofia is a member whose address we happen to know. Passing her in
        // both arrays is how one person gets two emails and two invitation
        // rows, which is the duplicate the events endpoint dedupes badly.
        expect(emailsOf(staged)).toEqual(["outsider@example.com"]);
    });

    it("returns empty arrays, not undefined, for an empty staging list", () => {
        // Callers spread these into a request body behind `length > 0`.
        expect(userIdsOf([])).toEqual([]);
        expect(emailsOf([])).toEqual([]);
    });
});

describe("splitting for the handle-keyed endpoints", () => {
    const member: Recipient = {
        id: "u-ana", name: "Ana Neto", usertag: "ana-neto", email: "ana@example.com",
    };
    const outsider: Recipient = { email: "outsider@example.com" };

    it("sends a member by handle, never also by address", () => {
        /*
         * The one that matters. Ana is a member whose address the roster
         * happens to know. Putting her in BOTH arrays is one person, two
         * invitation rows and two emails.
         */
        expect(recipientsToApi([member])).toEqual({ usertags: ["ana-neto"], emails: [] });
    });

    it("sends somebody with no account by address", () => {
        expect(recipientsToApi([outsider])).toEqual({
            usertags: [], emails: ["outsider@example.com"],
        });
    });

    it("keeps a mixed list in its two halves", () => {
        expect(recipientsToApi([member, outsider])).toEqual({
            usertags: ["ana-neto"], emails: ["outsider@example.com"],
        });
    });

    it("trims an address rather than posting whitespace", () => {
        expect(recipientsToApi([{ email: "  bo@example.com " }]).emails).toEqual(["bo@example.com"]);
    });

    it("drops somebody the endpoint could not look up at all", () => {
        // An account with no handle and no address. An empty string is a 400
        // that costs the operator the whole batch.
        expect(recipientsToApi([{ id: "u-ghost" }, member])).toEqual({
            usertags: ["ana-neto"], emails: [],
        });
    });

    it("returns both arrays empty rather than undefined", () => {
        expect(recipientsToApi([])).toEqual({ usertags: [], emails: [] });
    });

    it("carries only the people who actually wrote their own note", () => {
        // Everyone else falls back to customMessage server-side. An empty
        // override would replace their shared note with nothing.
        expect(perRecipientMessages([{ ...member, note: "Bring the slides" }, outsider]))
            .toEqual([{ usertag: "ana-neto", message: "Bring the slides" }]);
    });

    it("addresses an override the same way the main list does", () => {
        expect(perRecipientMessages([{ ...outsider, note: "Details attached" }]))
            .toEqual([{ email: "outsider@example.com", message: "Details attached" }]);
    });

    it("treats a whitespace-only note as no note, and trims the rest", () => {
        expect(perRecipientMessages([{ ...member, note: "   " }])).toEqual([]);
        expect(perRecipientMessages([{ ...member, note: " See you\n" }])[0].message).toBe("See you");
    });
});

describe("suggestion rows", () => {
    it("drops somebody already staged", async () => {
        const rows = [{ label: "Recently invited", people: [ana, sofia] }];
        const out = visibleSuggestions(rows, [fromPerson(ana)]);
        expect(out[0].people.map((p) => p.id)).toEqual(["u-sofia"]);
    });

    it("shows a person ONCE across rows — the duplicate-chips bug", () => {
        /*
         * Somebody can be both recently invited and a frequent attendee. Offered
         * in both rows, they render as two identical chips — which is exactly
         * what the events invite modal does today.
         */
        const rows = [
            { label: "Recently invited", people: [ana, sofia] },
            { label: "Frequent attendees", people: [ana] },
        ];
        const out = visibleSuggestions(rows, []);
        const allIds = out.flatMap((r) => r.people.map((p) => p.id));
        expect(allIds).toEqual(["u-ana", "u-sofia"]);
        expect(new Set(allIds).size).toBe(allIds.length);
    });

    it("shows a person once WITHIN a row, even if the server repeats them", () => {
        // The backend dedupes invitations on email, so the same user under two
        // addresses arrives twice. The UI must not render that.
        const rows = [{ label: "Recently invited", people: [ana, ana, ana, ana] }];
        expect(visibleSuggestions(rows, [])[0].people).toHaveLength(1);
    });

    it("hides a row that has nothing left in it", () => {
        // An empty heading is furniture. A newer host should see a cleaner
        // surface, not three labels over nothing.
        const rows = [{ label: "Recently invited", people: [ana] }];
        expect(visibleSuggestions(rows, [fromPerson(ana)])).toEqual([]);
    });
});
