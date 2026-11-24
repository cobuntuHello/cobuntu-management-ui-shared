/**
 * The listing page v2's styles: one stylesheet, scoped to `.cbtl`.
 *
 * ── Why not Tailwind like the old panel ─────────────────────────────────────
 *
 * The page also runs on a venue's own site (tejahouse.com), which has no
 * Tailwind; the old panel's classes rendered unstyled there. Plain CSS scoped
 * to one root class renders the same in all three homes, and every value comes
 * from the approved boards (the canvas' ListingPage.dc.html).
 *
 * Tokens are prefixed (`--cbtl-*`) so they never collide with a host's own
 * `--ink` or `--paper`; a host re-themes through the `theme` prop, which sets
 * them on the root. The layout follows the CONTAINER, not the window
 * (`container-type: inline-size`), so the phone layout appears wherever the
 * page is narrow: a phone, or a side pane on a desktop.
 */
export interface ListingTheme {
    /** The one colour that commits (Approve & publish); defaults to ink. */
    brand?: string;
    /** The date tile's band. */
    accent?: string;
    /** Headings and big numbers. */
    display?: string;
    /** Everything else. */
    body?: string;
    /** Card corners. */
    radius?: string;
    /** "Bold" text. A site whose only face has one weight sets 400 here. */
    strong?: number;
    /**
     * The page background behind the cards; "transparent" shows the host's own.
     * It paints the page only: the tinted surfaces inside the cards (the ring's
     * hole, tiles, inputs) keep `--cbtl-bg`, so a see-through page never makes
     * them see-through too.
     */
    background?: string;
}

export function themeVars(t: ListingTheme | undefined): Record<string, string> {
    const v: Record<string, string> = {};
    if (!t) return v;
    if (t.brand) v["--cbtl-commit"] = t.brand;
    if (t.accent) v["--cbtl-accent"] = t.accent;
    if (t.display) v["--cbtl-display"] = t.display;
    if (t.body) v["--cbtl-body"] = t.body;
    if (t.radius) v["--cbtl-radius"] = t.radius;
    if (t.strong) v["--cbtl-strong"] = String(t.strong);
    if (t.background) v["--cbtl-page"] = t.background;
    return v;
}

export const LISTING_PAGE_CSS = `
.cbtl{--cbtl-bg:#f6f4f0;--cbtl-card:#fff;--cbtl-line:#e6e1d9;--cbtl-line-soft:#efebe4;--cbtl-ink:#191714;--cbtl-muted:#5c574f;--cbtl-faint:#99928a;
--cbtl-green:#4e9c78;--cbtl-green-ink:#3d7d5f;--cbtl-green-soft:#e9f2ed;--cbtl-amber:#e0a94e;--cbtl-amber-ink:#8a6420;--cbtl-amber-soft:#fbf1de;--cbtl-amber-tint:#fffaf0;
--cbtl-blue-ink:#3d5a80;--cbtl-blue-soft:#eef1f7;--cbtl-blue-line:#b9c4d6;--cbtl-red:#a8443c;--cbtl-red-line:#ecc9c5;--cbtl-sand:#f1eee9;
--cbtl-commit:#191714;--cbtl-accent:#6E1A2B;--cbtl-display:Fraunces,Georgia,serif;--cbtl-body:Inter,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;--cbtl-radius:16px;--cbtl-strong:600;
container-type:inline-size;font-family:var(--cbtl-body);color:var(--cbtl-ink);background:var(--cbtl-page,var(--cbtl-bg));font-size:14px;line-height:1.4;box-sizing:border-box}
.cbtl *,.cbtl *::before,.cbtl *::after{box-sizing:border-box}
.cbtl button{font:inherit;color:inherit}
.cbtl-inner{display:flex;flex-direction:column;gap:18px;max-width:900px;margin:0 auto;padding:24px 0 48px}
.cbtl-crumb{font-size:13px;color:var(--cbtl-faint);display:flex;gap:6px;flex-wrap:wrap}
.cbtl-crumb a{color:var(--cbtl-faint);text-decoration:none}.cbtl-crumb a:hover{color:var(--cbtl-ink)}
.cbtl-crumb-back{display:inline-flex;align-items:center;gap:4px}
.cbtl-crumb b{font-weight:400;color:var(--cbtl-muted)}
.cbtl-head{display:flex;gap:16px;align-items:center}
.cbtl-title{font-family:var(--cbtl-display);font-weight:var(--cbtl-strong);letter-spacing:-.015em;line-height:1.15;font-size:24px;margin:0}
.cbtl-sub{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:13px;color:var(--cbtl-muted);margin-top:8px}
.cbtl-sub-name{font-weight:500;color:var(--cbtl-ink)}.cbtl-sub-tag{color:var(--cbtl-faint)}
.cbtl-tools{flex:none;display:flex;gap:8px;align-items:center;margin-left:auto}
/* The header's buttons, for both hosts' tools: one size, outlined, or solid with data-kind="primary". */
.cbtl-hbtn{display:inline-flex;align-items:center;justify-content:center;gap:7px;height:40px;padding:0 14px;box-sizing:border-box;font:inherit;font-size:13px;font-weight:500;color:var(--cbtl-ink);background:var(--cbtl-card);border:1px solid var(--cbtl-line);border-radius:10px;text-decoration:none;cursor:pointer;white-space:nowrap}
.cbtl-hbtn:hover{background:var(--cbtl-sand)}
.cbtl-hbtn[data-kind="primary"]{color:#fff;background:var(--cbtl-commit);border-color:var(--cbtl-commit);font-weight:600;padding:0 16px}
.cbtl-hbtn[data-kind="primary"]:hover{opacity:.9;background:var(--cbtl-commit)}
.cbtl-card{background:var(--cbtl-card);border:1px solid var(--cbtl-line);border-radius:var(--cbtl-radius)}
.cbtl-track{padding:22px 24px 18px;display:flex;align-items:flex-start}
.cbtl-node{position:relative;flex:1 1 0;min-width:0;display:flex;flex-direction:column;align-items:center;gap:5px;text-align:center}
.cbtl-node-line{position:absolute;z-index:0;top:27px;right:50%;width:100%;height:3px;border-radius:2px;background:var(--cbtl-line)}
.cbtl-node-line[data-done]{background:var(--cbtl-green)}
.cbtl-node-btn{position:relative;z-index:1;width:56px;height:56px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0}
.cbtl-node-btn[data-tone=done]{background:var(--cbtl-green);color:#fff;border:0}
.cbtl-node-btn[data-tone=you]{background:var(--cbtl-amber-tint);color:var(--cbtl-amber-ink);border:2px solid var(--cbtl-amber)}
.cbtl-node-btn[data-tone=them]{background:var(--cbtl-blue-soft);color:var(--cbtl-blue-ink);border:2px solid var(--cbtl-blue-line)}
.cbtl-node-btn[data-tone=live]{background:var(--cbtl-ink);color:#fff;border:0}
.cbtl-node-btn[data-tone=locked]{background:var(--cbtl-sand);color:#a8a199;border:2px dashed #d6d0c6}
.cbtl-node-btn[aria-pressed=true]{box-shadow:0 0 0 4px #fff,0 0 0 6px var(--cbtl-ring,var(--cbtl-ink))}
.cbtl-node-btn[data-tone=done][aria-pressed=true]{--cbtl-ring:var(--cbtl-green)}
.cbtl-node-btn[data-tone=you][aria-pressed=true]{--cbtl-ring:var(--cbtl-amber)}
.cbtl-node-btn[data-tone=them][aria-pressed=true]{--cbtl-ring:#7f9fc9}
.cbtl-node-btn[data-tone=locked][aria-pressed=true]{--cbtl-ring:#d6d0c6}
.cbtl-badge{position:absolute;top:-4px;right:-4px;min-width:20px;height:20px;border-radius:10px;padding:0 5px;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;border:2px solid #fff;color:#fff;background:var(--cbtl-amber)}
.cbtl-badge[data-done]{background:var(--cbtl-green-ink)}
.cbtl-node-label{font-size:14px;font-weight:500}.cbtl-node-label[data-on]{font-weight:700}
.cbtl-l-short{display:none}
.cbtl-node-sub{font-size:12px;line-height:1.3;color:var(--cbtl-faint)}
.cbtl-node-sub[data-tone=you]{color:var(--cbtl-amber-ink)}.cbtl-node-sub[data-tone=done]{color:var(--cbtl-green-ink)}.cbtl-node-sub[data-tone=them]{color:var(--cbtl-blue-ink)}.cbtl-node-sub[data-tone=live]{color:var(--cbtl-ink)}
.cbtl-pane{overflow:hidden}
.cbtl-pane-head{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:18px 24px;border-bottom:1px solid var(--cbtl-line-soft)}
.cbtl-kicker{font-size:11.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--cbtl-faint)}
.cbtl-pane-title{font-family:var(--cbtl-display);font-size:22px;font-weight:var(--cbtl-strong);letter-spacing:-.01em;margin:0}
.cbtl-sides{display:flex;gap:10px;align-items:center}
.cbtl-avatar{flex:none;width:28px;height:28px;border-radius:50%;background:var(--cbtl-ink);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;overflow:hidden;object-fit:cover}
.cbtl-avatar img{width:100%;height:100%;object-fit:cover}
.cbtl-tick{font-size:10px;font-weight:700;margin-left:-10px;margin-top:16px;width:16px;height:16px;border-radius:50%;border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;background:#c9c3ba}
.cbtl-tick[data-tone=ok]{background:var(--cbtl-green)}.cbtl-tick[data-tone=wait]{background:var(--cbtl-amber)}
.cbtl-pill{font-size:12px;font-weight:600;border-radius:999px;padding:4px 11px;white-space:nowrap;background:var(--cbtl-sand);color:var(--cbtl-muted)}
.cbtl-pill[data-tone=wait]{background:var(--cbtl-amber-soft);color:var(--cbtl-amber-ink)}
.cbtl-pill[data-tone=ok]{background:var(--cbtl-green-soft);color:var(--cbtl-green-ink)}
.cbtl-pill[data-tone=them]{background:var(--cbtl-blue-soft);color:var(--cbtl-blue-ink)}
.cbtl-body{display:grid;grid-template-columns:250px minmax(0,1fr);gap:24px;padding:22px 24px}
.cbtl-body[data-single]{grid-template-columns:minmax(0,1fr)}
.cbtl-col{display:flex;flex-direction:column;gap:18px;min-width:0}
.cbtl-col-left{gap:8px}
.cbtl-bar{display:flex;justify-content:space-between;align-items:center;gap:12px;background:#fbfaf7;border-top:1px solid var(--cbtl-line-soft);padding:16px 24px}
.cbtl-hint{font-size:13px;color:var(--cbtl-muted);line-height:1.45}
.cbtl-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end}
.cbtl-btn{font-weight:var(--cbtl-strong);border-radius:11px;cursor:pointer;min-height:44px;padding:0 16px;font-size:14px;border:1px solid var(--cbtl-line);background:var(--cbtl-card);color:var(--cbtl-ink);display:inline-flex;align-items:center;justify-content:center;gap:6px;text-decoration:none;white-space:nowrap}
.cbtl-btn[data-kind=go]{border:0;background:var(--cbtl-commit);color:#fff;padding:0 18px}
.cbtl-btn[data-kind=no]{border-color:var(--cbtl-red-line);color:var(--cbtl-red)}
.cbtl-btn[data-size=s]{min-height:34px;padding:0 12px;font-size:13px;border-radius:10px}
.cbtl-btn[data-size=icon]{min-height:34px;width:34px;padding:0;font-size:13px;border-radius:10px}
.cbtl-btn:disabled{opacity:.45;cursor:not-allowed}
.cbtl-more{display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--cbtl-line-soft);padding:12px 24px 16px}
.cbtl-chip{display:inline-flex;gap:6px;align-items:center;font-size:13px;border:1px solid var(--cbtl-line);border-radius:999px;padding:6px 12px;background:var(--cbtl-card);cursor:pointer}
.cbtl-chip[aria-expanded=true]{background:var(--cbtl-sand)}
.cbtl-drawer{padding:4px 24px 18px;display:flex;flex-direction:column;gap:8px;font-size:13.5px}
.cbtl-slot-head{font-size:11.5px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--cbtl-faint)}
.cbtl-photo{position:relative;display:block;height:240px;border-radius:14px;overflow:hidden;background:var(--cbtl-sand)}
.cbtl-photo img{width:100%;height:100%;object-fit:cover;display:block}
.cbtl-photo span{position:absolute;left:10px;bottom:10px;font-size:12.5px;font-weight:600;color:#fff;background:rgba(25,23,20,.62);border-radius:8px;padding:4px 9px}
.cbtl-pic{height:240px;border-radius:14px;background:var(--cbtl-bg);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:var(--cbtl-muted);text-align:center;padding:14px}
.cbtl-pic[data-live]{background:var(--cbtl-ink);color:#fff}
.cbtl-pic b{font-size:13px;font-weight:600;color:inherit}.cbtl-pic small{font-size:12px;opacity:.75}
.cbtl-day{flex:none;width:62px;border-radius:12px;overflow:hidden;border:1px solid var(--cbtl-line);text-align:center}
.cbtl-day b{display:block;background:var(--cbtl-accent);color:#fff;font-size:11px;font-weight:700;letter-spacing:.08em;padding:3px 0}
.cbtl-day span{display:block;font-family:var(--cbtl-display);font-size:26px;font-weight:var(--cbtl-strong);line-height:1.15}
.cbtl-day small{display:block;font-size:11px;color:var(--cbtl-faint);padding-bottom:4px}
.cbtl-times{display:flex;gap:8px;flex-wrap:wrap;flex:1 1 200px}
.cbtl-time{display:inline-flex;gap:7px;align-items:center;font-size:13px;padding:7px 11px;border-radius:10px;background:var(--cbtl-bg)}
.cbtl-time[data-main]{background:#f4e6e9;color:var(--cbtl-accent)}
.cbtl-stats{display:grid;gap:10px;grid-template-columns:repeat(3,minmax(0,1fr))}
.cbtl-stat{display:flex;flex-direction:column;gap:2px;padding:11px 14px;border-radius:12px;background:var(--cbtl-bg)}
.cbtl-stat b{font-size:18px;font-weight:var(--cbtl-strong)}.cbtl-stat small{font-size:12px;color:var(--cbtl-faint)}
.cbtl-facts{display:flex;flex-direction:column;gap:8px;font-size:13.5px}
.cbtl-fact{display:flex;flex-direction:column;gap:2px}.cbtl-fact small{font-size:12px;color:var(--cbtl-faint)}
.cbtl-donut-card{display:flex;flex-direction:column;gap:14px;align-items:center;border-radius:14px;background:var(--cbtl-bg);padding:14px}
.cbtl-donut-card h4{margin:0;font-size:12.5px;font-weight:600;color:var(--cbtl-muted);align-self:stretch;text-align:center}
.cbtl-donut{position:relative;flex:none;width:168px;height:168px;border-radius:50%}
.cbtl-donut-hole{position:absolute;inset:25px;border-radius:50%;background:var(--cbtl-bg);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.cbtl-donut-hole b{font-family:var(--cbtl-display);font-weight:var(--cbtl-strong);color:var(--cbtl-green-ink);font-size:24px}
.cbtl-donut-hole small{font-size:11px;color:var(--cbtl-faint);line-height:1.25;padding:0 10px}
.cbtl-legend{display:flex;flex-direction:column;gap:7px;min-width:0;align-self:stretch}
.cbtl-legend-row{display:flex;gap:10px;align-items:center;padding:7px 8px;border-radius:12px;background:var(--cbtl-card)}
.cbtl-legend-row[data-mine]{background:var(--cbtl-green-soft)}
.cbtl-legend-row div{flex:1 1 auto;min-width:0;display:flex;flex-direction:column}
.cbtl-legend-row div b{font-size:13.5px;font-weight:600}.cbtl-legend-row div small{font-size:11.5px;color:var(--cbtl-faint);line-height:1.3}
.cbtl-legend-row>span:last-child{flex:none;font-variant-numeric:tabular-nums;font-size:14px;font-weight:600}
.cbtl-legend-row[data-mine]>span:last-child{font-family:var(--cbtl-display);font-size:17px;color:var(--cbtl-green-ink)}
.cbtl-agreed{font-size:11.5px;color:var(--cbtl-faint);text-align:center;padding-top:2px}
.cbtl-face{flex:none;width:32px;height:32px;border-radius:50%;padding:2.5px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#fff;box-shadow:inset 0 0 0 2.5px var(--cbtl-face-ring,var(--cbtl-line))}
.cbtl-face img{width:100%;height:100%;border-radius:50%;object-fit:cover;display:block}
.cbtl-face i{width:100%;height:100%;border-radius:50%;background:#5b7aa0;color:#fff;font-size:10px;font-weight:700;font-style:normal;display:flex;align-items:center;justify-content:center}
.cbtl-face[data-ticket]{background:var(--cbtl-sand);color:var(--cbtl-muted)}
.cbtl-blurwrap{position:relative;display:block}
.cbtl-blur{filter:blur(4px);opacity:.45;pointer-events:none;user-select:none}
.cbtl-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:12px}
.cbtl-overlay-card{display:flex;flex-direction:column;align-items:center;gap:8px;text-align:center;max-width:340px;background:#fff;border:1px solid var(--cbtl-line);border-radius:14px;padding:16px 18px;box-shadow:0 8px 28px rgba(25,23,20,.14)}
.cbtl-overlay-card i{width:42px;height:42px;border-radius:50%;background:var(--cbtl-ink);color:#fff;font-size:13px;font-weight:700;font-style:normal;display:flex;align-items:center;justify-content:center}
.cbtl-overlay-card b{font-size:15px;font-weight:700;line-height:1.3}.cbtl-overlay-card small{font-size:12.5px;color:var(--cbtl-muted);line-height:1.45}
.cbtl-table{display:flex;flex-direction:column}
.cbtl-thead,.cbtl-trow{display:grid;grid-template-columns:var(--cbtl-cols);gap:10px;align-items:center}
.cbtl-thead{padding-bottom:6px;font-size:12px;font-weight:600;color:var(--cbtl-muted)}.cbtl-thead span+span{text-align:right}
.cbtl-trow{padding:7px 10px}
.cbtl-trow[data-k=price]{padding:10px;border-bottom:1px solid var(--cbtl-line-soft);margin-bottom:6px}
.cbtl-trow[data-k=sub]{padding:10px 10px 7px;border-top:1px dashed #d6d0c6;margin-top:4px}
.cbtl-trow[data-k=keep]{padding:11px 10px;background:var(--cbtl-green-soft);border-radius:12px;margin-top:8px}
.cbtl-trow>div{display:flex;gap:10px;align-items:center;min-width:0}
.cbtl-trow>div>div{display:flex;flex-direction:column;min-width:0}
.cbtl-trow>div>div b{font-size:14px;font-weight:500}.cbtl-trow[data-k=price]>div>div b,.cbtl-trow[data-k=sub]>div>div b{font-weight:600}.cbtl-trow[data-k=keep]>div>div b{font-size:15px;font-weight:700}
.cbtl-trow>div>div small{font-size:11.5px;color:var(--cbtl-faint)}
.cbtl-amt{text-align:right;font-variant-numeric:tabular-nums;font-size:14px;color:var(--cbtl-muted)}
.cbtl-trow[data-k=price] .cbtl-amt{font-size:15px;font-weight:600;color:var(--cbtl-ink)}
.cbtl-trow[data-k=sub] .cbtl-amt{font-weight:600}
.cbtl-trow[data-k=keep] .cbtl-amt{font-family:var(--cbtl-display);font-weight:var(--cbtl-strong);color:var(--cbtl-green-ink);font-size:18px}
.cbtl-trow[data-k=keep] .cbtl-amt[data-big]{font-size:22px}
.cbtl-small{font-size:12px;color:var(--cbtl-faint)}
.cbtl-up-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;flex-wrap:wrap}
.cbtl-up-head span:last-child{font-size:12.5px;color:var(--cbtl-muted)}
.cbtl-tiles{display:flex;gap:10px}
.cbtl-tile{flex:1 1 0;min-width:0;display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:14px;background:var(--cbtl-green-soft)}
.cbtl-tile[data-tone=next]{background:var(--cbtl-amber-soft)}
.cbtl-tile small:first-child{font-size:12px;font-weight:600;color:var(--cbtl-green-ink)}.cbtl-tile[data-tone=next] small:first-child{color:var(--cbtl-amber-ink)}
.cbtl-tile b{font-family:var(--cbtl-display);font-weight:var(--cbtl-strong);line-height:1.15;font-variant-numeric:tabular-nums;font-size:28px;color:var(--cbtl-green-ink)}
.cbtl-tile[data-tone=next] b{color:var(--cbtl-amber-ink)}
.cbtl-tile small:last-child{font-size:12px;color:var(--cbtl-muted)}
.cbtl-list{display:flex;flex-direction:column;border:1px solid var(--cbtl-line);border-radius:14px;overflow:hidden;background:#fff}
.cbtl-row{display:flex;flex-wrap:wrap;gap:12px;align-items:center;padding:12px 16px;border-bottom:1px solid var(--cbtl-line-soft);background:#fff}
.cbtl-row:last-child{border-bottom:0}
.cbtl-row[data-tone=next],.cbtl-row[data-tone=act]{background:var(--cbtl-amber-tint)}.cbtl-row[data-tone=incl]{background:#faf9f6}
.cbtl-row-main{flex:1 1 120px;min-width:0;display:flex;flex-direction:column;gap:2px}
.cbtl-row-main b{font-size:14px;font-weight:600}.cbtl-row-main small{font-size:12px;color:var(--cbtl-muted)}
.cbtl-row-side{flex:none;margin-left:auto;display:flex;flex-direction:column;align-items:flex-end;gap:4px}
.cbtl-row-side b{font-size:15px;font-weight:600;font-variant-numeric:tabular-nums}
.cbtl-row-btns{display:flex;gap:4px}
.cbtl-state{display:inline-flex;align-items:center;gap:4px;font-size:12px;font-weight:600;color:var(--cbtl-green-ink)}
.cbtl-state[data-tone=next]{border-radius:999px;padding:2px 9px;background:var(--cbtl-amber-soft);color:var(--cbtl-amber-ink)}
.cbtl-state[data-tone=off]{color:var(--cbtl-faint)}.cbtl-state[data-tone=bad]{color:var(--cbtl-red)}
.cbtl-card-line{font-size:12px;color:var(--cbtl-muted);display:flex;gap:6px;align-items:center;flex-wrap:wrap}
.cbtl-link{font-weight:600;color:var(--cbtl-ink);text-decoration:underline;cursor:pointer;background:none;border:0;padding:0;font-size:inherit}
.cbtl-dtile{flex:none;width:46px;border-radius:10px;overflow:hidden;text-align:center;background:#fff;border:1px solid var(--cbtl-line)}
.cbtl-dtile b{display:block;font-size:10px;font-weight:700;letter-spacing:.08em;padding:2px 0;background:var(--cbtl-sand);color:var(--cbtl-muted)}
.cbtl-dtile span{display:block;font-family:var(--cbtl-display);font-size:18px;font-weight:var(--cbtl-strong);line-height:1.25;padding-bottom:3px;color:var(--cbtl-muted)}
.cbtl-dtile[data-next]{border-color:#ecd3a0}.cbtl-dtile[data-next] b{background:var(--cbtl-amber-ink);color:#fff}.cbtl-dtile[data-next] span{color:var(--cbtl-ink)}
.cbtl-dash{flex:none;width:46px;height:42px;border-radius:10px;border:1.5px dashed #d6d0c6;color:var(--cbtl-faint);display:flex;align-items:center;justify-content:center}
.cbtl-dash[data-act]{border-color:#e0c48f;color:var(--cbtl-amber-ink)}
.cbtl-group{display:block;padding:8px 16px 6px;background:#faf9f6;border-bottom:1px solid var(--cbtl-line-soft);font-size:11.5px;font-weight:600;color:var(--cbtl-faint)}
.cbtl-result{display:flex;justify-content:space-between;align-items:center;gap:14px;border-radius:14px;padding:14px 16px;background:var(--cbtl-bg)}
.cbtl-result[data-live]{background:var(--cbtl-green-soft)}
.cbtl-result div{display:flex;flex-direction:column;gap:3px;min-width:0}
.cbtl-result div b{font-size:14px;font-weight:600}.cbtl-result div span{font-size:12.5px;color:var(--cbtl-muted)}.cbtl-result div small{font-size:12px;color:var(--cbtl-faint)}
.cbtl-result>strong{flex:none;font-family:var(--cbtl-display);font-weight:var(--cbtl-strong);white-space:nowrap;font-size:28px}
.cbtl-result[data-live]>strong{color:var(--cbtl-green-ink)}
.cbtl-msgs{display:flex;flex-direction:column;gap:10px}
.cbtl-topic{display:flex;flex-direction:column;gap:10px;padding-bottom:14px;border-bottom:1px solid var(--cbtl-line-soft)}
.cbtl-topic:last-child{border-bottom:0;padding-bottom:0}
.cbtl-topic-head{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.cbtl-topic-head b{font-size:15px;font-weight:600}
.cbtl-msg{display:flex;gap:10px;align-items:flex-end}.cbtl-msg[data-mine]{flex-direction:row-reverse}
.cbtl-bubble{max-width:78%;font-size:14px;line-height:1.45;padding:10px 13px;border-radius:14px;background:var(--cbtl-sand);border-bottom-left-radius:4px;white-space:pre-wrap;overflow-wrap:anywhere}
.cbtl-msg[data-mine] .cbtl-bubble{background:var(--cbtl-ink);color:#fff;border-bottom-left-radius:14px;border-bottom-right-radius:4px}
.cbtl-input,.cbtl-textarea,.cbtl-select{width:100%;border:1px solid var(--cbtl-line);border-radius:10px;padding:10px 12px;font:inherit;font-size:14px;background:var(--cbtl-bg);color:var(--cbtl-ink)}
.cbtl-input{height:42px}
.cbtl-textarea{min-height:84px;resize:vertical}
.cbtl-checks{display:flex;flex-direction:column;gap:8px}
.cbtl-check{display:flex;gap:10px;align-items:center;font-size:13.5px;padding:10px 12px;border-radius:10px;background:var(--cbtl-amber-soft);color:var(--cbtl-amber-ink);border:0;text-align:left;width:100%;cursor:default}
.cbtl-check[data-ok]{background:var(--cbtl-green-soft);color:#2f6a4f}
.cbtl-check[data-step]{cursor:pointer}
.cbtl-check i{flex:none;width:20px;height:20px;border-radius:50%;font-size:11px;font-weight:700;font-style:normal;display:flex;align-items:center;justify-content:center;color:#fff;background:var(--cbtl-amber)}
.cbtl-check[data-ok] i{background:var(--cbtl-green)}
.cbtl-check span{flex:1 1 auto}.cbtl-check small{font-size:12px;color:var(--cbtl-faint);white-space:nowrap}
.cbtl-backdrop{position:fixed;inset:0;z-index:120;background:rgba(25,23,20,.42);display:flex;align-items:center;justify-content:center;padding:16px}
.cbtl-sheet{width:100%;max-width:520px;max-height:calc(100vh - 32px);overflow:auto;background:#fff;border-radius:18px;padding:20px;display:flex;flex-direction:column;gap:14px;box-shadow:0 18px 50px rgba(25,23,20,.25)}
.cbtl-sheet h3{margin:0;font-family:var(--cbtl-display);font-size:21px;font-weight:var(--cbtl-strong)}
.cbtl-sheet p{margin:0;font-size:13.5px;color:var(--cbtl-muted);line-height:1.5}
.cbtl-sheet-foot{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.cbtl-field{display:flex;flex-direction:column;gap:6px}
.cbtl-label{font-size:12.5px;font-weight:600;color:var(--cbtl-muted)}.cbtl-label i{font-style:normal;font-weight:400;color:var(--cbtl-faint)}
.cbtl-choices{display:flex;gap:6px;flex-wrap:wrap}
.cbtl-choice{border:1px solid var(--cbtl-line);background:#fff;border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer}
.cbtl-choice[aria-checked=true]{background:var(--cbtl-ink);border-color:var(--cbtl-ink);color:#fff}
.cbtl-slots{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:6px}
.cbtl-slot{border:1px solid var(--cbtl-line);background:#fff;border-radius:9px;padding:7px 0;font-size:13px;cursor:pointer}
.cbtl-slot[aria-pressed=true]{background:var(--cbtl-ink);color:#fff;border-color:var(--cbtl-ink)}
.cbtl-slot:disabled{opacity:.35;cursor:not-allowed;text-decoration:line-through}
.cbtl-error{font-size:13px;color:var(--cbtl-red)}
.cbtl-toast{position:fixed;top:16px;right:16px;z-index:130;background:var(--cbtl-ink);color:#fff;border-radius:12px;padding:10px 14px;font-size:13.5px;box-shadow:0 8px 28px rgba(25,23,20,.25)}
.cbtl-empty{padding:40px 0;text-align:center;color:var(--cbtl-muted)}
@container (max-width: 640px){
.cbtl-inner{gap:14px;padding:16px 0 40px}
.cbtl-head{flex-wrap:wrap}.cbtl-title{font-size:19px}
.cbtl-tools{width:100%;margin-left:0}.cbtl-hbtn{flex:1 1 0;height:44px}
.cbtl-l-long{display:none}.cbtl-l-short{display:inline}
.cbtl-track{padding:16px 8px 14px}.cbtl-node-btn{width:44px;height:44px}.cbtl-node-line{top:21px}.cbtl-node-label{font-size:12.5px}.cbtl-node-sub{font-size:11px}
.cbtl-pane-head{flex-direction:column;align-items:flex-start;padding:16px}
.cbtl-body{display:flex;flex-direction:column;gap:18px;padding:18px 16px}
.cbtl-photo,.cbtl-pic{height:160px}
.cbtl-bar{flex-direction:column;align-items:stretch;padding:14px 16px}.cbtl-actions{flex-direction:column}
.cbtl-more,.cbtl-drawer{padding-left:16px;padding-right:16px}
.cbtl-tile b{font-size:24px}.cbtl-row{padding:12px}.cbtl-group{padding:8px 12px 6px}.cbtl-dtile,.cbtl-dash{width:42px}
.cbtl-result>strong{font-size:24px}.cbtl-trow[data-k=keep] .cbtl-amt[data-big]{font-size:19px}
.cbtl-backdrop{align-items:flex-end;padding:0}.cbtl-sheet{border-radius:18px 18px 0 0;max-height:92vh}
}
@media (prefers-reduced-motion: no-preference){.cbtl-node-btn,.cbtl-btn,.cbtl-chip{transition:box-shadow .15s ease,background .15s ease}}
`;
