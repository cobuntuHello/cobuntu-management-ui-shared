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
.cbtl-crumb{display:flex;align-items:center;gap:8px;min-width:0;font-size:15px;line-height:1.3;color:var(--cbtl-ink)}
.cbtl-crumb-back{flex:none;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(128,128,128,.06);color:var(--cbtl-ink);text-decoration:none}
.cbtl-crumb-back:hover{background:rgba(128,128,128,.12)}
.cbtl-crumb-step{display:flex;align-items:center;gap:8px;min-width:0}
.cbtl-crumb-sep{flex:none;opacity:.2}
.cbtl-crumb-link{color:var(--cbtl-ink);opacity:.5;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px}
a.cbtl-crumb-link:hover{opacity:.8}
.cbtl-crumb-cur{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
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
.cbtl-hbtn[aria-disabled="true"]{color:var(--cbtl-faint);border-color:var(--cbtl-line-soft);background:var(--cbtl-card);cursor:not-allowed}
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
.cbtl-section{display:flex;flex-direction:column;gap:16px;min-width:0}
.cbtl-secs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
.cbtl-sec{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:12px;padding:16px;border-radius:14px;border:none;background:var(--cbtl-sand);text-align:left;cursor:pointer;min-width:0}
.cbtl-sec[aria-current=page]{background:var(--cbtl-card);box-shadow:0 0 0 1.5px var(--cbtl-ink),0 10px 24px -12px rgba(25,23,20,.35)}
.cbtl-sec:not([aria-current=page]):hover{background:var(--cbtl-card);box-shadow:0 0 0 1px var(--cbtl-line),0 10px 22px -16px rgba(25,23,20,.4);transform:translateY(-1px)}
.cbtl-sec:focus-visible{outline:2px solid var(--cbtl-ink);outline-offset:2px}
.cbtl-sec-ic{width:40px;height:40px;flex:none;border-radius:11px;display:flex;align-items:center;justify-content:center}
.cbtl-sec[data-sec=overview] .cbtl-sec-ic{background:#e5ecf7;color:#3f63a6}
.cbtl-sec[data-sec=earnings] .cbtl-sec-ic{background:#e2f0e8;color:#2f7a57}
.cbtl-sec[data-sec=negotiation] .cbtl-sec-ic{background:#f0e6f4;color:#8a4fa0}
.cbtl-sec:not([aria-current=page]):hover[data-sec=overview] .cbtl-sec-ic{background:#d3def1}
.cbtl-sec:not([aria-current=page]):hover[data-sec=earnings] .cbtl-sec-ic{background:#cfe6d9}
.cbtl-sec:not([aria-current=page]):hover[data-sec=negotiation] .cbtl-sec-ic{background:#e6d6ee}
.cbtl-sec[aria-current=page][data-sec=overview] .cbtl-sec-ic{background:#3f63a6;color:#fff}
.cbtl-sec[aria-current=page][data-sec=earnings] .cbtl-sec-ic{background:#2f7a57;color:#fff}
.cbtl-sec[aria-current=page][data-sec=negotiation] .cbtl-sec-ic{background:#8a4fa0;color:#fff}
.cbtl-sec-text{display:flex;flex-direction:column;gap:2px;min-width:0;width:100%}
.cbtl-sec-text b{font-size:15px;font-weight:600}
.cbtl-sec-text small{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--cbtl-faint);min-width:0}
.cbtl-sec[aria-current=page] .cbtl-sec-text small{color:var(--cbtl-muted)}
.cbtl-sec-dot{width:7px;height:7px;border-radius:50%;background:#8a4fa0;flex:none}
.cbtl-sec[data-sec=earnings] .cbtl-sec-dot{background:var(--cbtl-amber)}
.cbtl-sec-badge{position:absolute;top:14px;right:14px;min-width:22px;height:22px;padding:0 7px;border-radius:999px;background:var(--cbtl-ink);color:#fff;font-size:11px;font-weight:600;display:flex;align-items:center;justify-content:center}
.cbtl-dbar{position:sticky;bottom:12px;z-index:5;display:flex;align-items:center;gap:14px;padding:14px 16px 14px 14px;border-radius:16px;background:#191714;color:#fff;box-shadow:0 12px 32px -14px rgba(25,23,20,.5)}
.cbtl-dbar-state{flex:1;min-width:0;display:flex;align-items:center;gap:14px}
.cbtl-si{width:40px;height:40px;flex:none;border-radius:11px;display:flex;align-items:center;justify-content:center}
.cbtl-si[data-tone=you],.cbtl-si[data-tone=answer]{background:rgba(240,189,99,.16);color:#f0bd63}
.cbtl-si[data-tone=them],.cbtl-si[data-tone=paused]{background:rgba(255,255,255,.09);color:#c9c2b8}
.cbtl-si[data-tone=live]{background:rgba(124,197,160,.16);color:#7cc5a0}
.cbtl-si[data-tone=closed]{background:rgba(240,138,124,.15);color:#f08a7c}
.cbtl-dbar-text{display:flex;flex-direction:column;gap:2px;min-width:0}
.cbtl-dbar-eyebrow{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#c9c2b8}
.cbtl-dbar-eyebrow[data-tone=you],.cbtl-dbar-eyebrow[data-tone=answer]{color:#f0bd63}
.cbtl-dbar-eyebrow[data-tone=live]{color:#7cc5a0}.cbtl-dbar-eyebrow[data-tone=closed]{color:#f08a7c}
.cbtl-dbar-text b{font-size:14px;font-weight:600}
.cbtl-dbar-text small{font-size:12px;color:rgba(255,255,255,.65);line-height:1.4}
.cbtl-dbar-moves{flex:none;display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.cbtl-dbtn{height:40px;padding:0 16px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:transparent;font-size:13px;font-weight:500;white-space:nowrap;cursor:pointer}
.cbtl-dbtn[data-kind=primary]{border:none;background:#fff;color:#191714;font-weight:600;padding:0 18px}
.cbtl-dbtn[data-kind=text]{border:none;color:rgba(255,255,255,.75);text-decoration:underline;text-underline-offset:3px;padding:0 8px}
.cbtl-dbtn:disabled{opacity:.45;cursor:not-allowed}
.cbtl-mk{flex:none;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;overflow:hidden;background:var(--cbtl-sand);color:var(--cbtl-muted);font-size:11px;font-weight:600}
.cbtl-mk[data-sq]{border-radius:8px}.cbtl-mk[data-pad]{padding:3px}
.cbtl-mk img{width:100%;height:100%;object-fit:cover}.cbtl-mk[data-pad] img{object-fit:contain}.cbtl-mk i{font-style:normal}
.cbtl-earn{display:flex;flex-direction:column;gap:16px}
.cbtl-terms{display:flex;align-items:center;gap:16px;padding:16px 20px;border-radius:16px;background:var(--cbtl-card);border:1px solid var(--cbtl-line)}
.cbtl-terms-ic{width:44px;height:44px;flex:none;border-radius:12px;background:#e2f0e8;color:#2f7a57;display:flex;align-items:center;justify-content:center}
.cbtl-terms-text{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;font-size:13px;color:var(--cbtl-muted)}
.cbtl-terms-top{display:flex;align-items:baseline;gap:10px;color:var(--cbtl-ink)}
.cbtl-terms-top b{font-size:16px;font-weight:600}
.cbtl-terms-top strong{font-family:var(--cbtl-display);font-size:20px;font-weight:var(--cbtl-strong)}
.cbtl-terms-top small{font-size:13px;color:var(--cbtl-faint)}
.cbtl-terms-marks{display:flex;flex:none}.cbtl-terms-marks .cbtl-mk+.cbtl-mk{margin-left:-8px;box-shadow:0 0 0 2px var(--cbtl-card)}
.cbtl-panel{display:flex;flex-direction:column;gap:16px;padding:20px 22px;border-radius:16px;background:var(--cbtl-card);border:1px solid var(--cbtl-line)}
.cbtl-panel-head{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.cbtl-panel-title{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.cbtl-panel-title b{font-size:15px;font-weight:600}.cbtl-panel-title small{font-size:12px;color:var(--cbtl-faint)}
.cbtl-seg{display:inline-flex;flex-wrap:wrap;padding:3px;border-radius:12px;background:var(--cbtl-sand);gap:2px;max-width:100%}
.cbtl-seg button{height:34px;padding:0 12px;border-radius:9px;border:none;background:transparent;font-size:13px;color:var(--cbtl-muted);white-space:nowrap;cursor:pointer}
.cbtl-seg button b{font-weight:600;color:var(--cbtl-ink);margin-left:4px}
.cbtl-seg button[aria-pressed=true]{background:var(--cbtl-card);color:var(--cbtl-ink);box-shadow:0 1px 3px rgba(25,23,20,.14)}
.cbtl-panel-body{display:grid;grid-template-columns:176px minmax(0,1fr);gap:24px;align-items:center}
.cbtl-panel-body[data-every]{grid-template-columns:176px minmax(0,1fr) 230px}
.cbtl-panel-free{font-size:14px;color:var(--cbtl-muted);padding:18px 0}
.cbtl-ring{position:relative;flex:none;display:inline-block}
.cbtl-ring svg{display:block}
.cbtl-ring-hole{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.cbtl-ring-hole b{font-size:20px;font-weight:600}.cbtl-ring-hole small{font-size:11px;color:var(--cbtl-faint);max-width:96px}
.cbtl-lines{display:flex;flex-direction:column;min-width:0}
.cbtl-line{display:flex;align-items:center;gap:12px;min-height:44px;font-size:14px;padding:0 10px;margin:0 -10px;border-radius:10px}
.cbtl-line[data-mine]{background:var(--cbtl-green-soft);color:#2f6a4f}
.cbtl-sw{width:10px;height:10px;border-radius:3px;flex:none}
.cbtl-line-name{flex:1;min-width:0;display:flex;flex-direction:column}
.cbtl-line-name b{font-weight:500}.cbtl-line[data-mine] .cbtl-line-name b{font-weight:600}
.cbtl-line-name small{font-size:12px;color:var(--cbtl-faint)}.cbtl-line[data-mine] .cbtl-line-name small{color:#2f6a4f}
.cbtl-line-amt{font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.cbtl-every{display:flex;flex-direction:column;gap:4px;padding-left:24px;border-left:1px solid var(--cbtl-line-soft);align-self:stretch;justify-content:center}
.cbtl-every .cbtl-kicker{padding:0 10px 4px}
.cbtl-every-row{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:9px;border:none;background:transparent;font-size:13px;color:var(--cbtl-muted);text-align:left;cursor:pointer;font-variant-numeric:tabular-nums}
.cbtl-every-row b{font-weight:600;color:#2f6a4f;white-space:nowrap}
.cbtl-every-row[aria-current=true]{background:var(--cbtl-sand);color:var(--cbtl-ink);font-weight:600}
.cbtl-panel[data-placeholder] .cbtl-sw{background:var(--cbtl-line)}
.cbtl-panel[data-placeholder] .cbtl-line[data-mine]{background:var(--cbtl-sand);color:var(--cbtl-ink)}
.cbtl-panel[data-placeholder] .cbtl-line[data-mine] .cbtl-line-name small{color:var(--cbtl-faint)}
.cbtl-ghost{display:inline-block;flex:none;width:64px;height:10px;border-radius:5px;background:var(--cbtl-sand)}
.cbtl-panel-foot{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;padding-top:14px;border-top:1px solid var(--cbtl-line-soft);font-size:13.5px;line-height:1.5;color:var(--cbtl-muted)}
.cbtl-panel-foot>span{flex:1;min-width:220px;max-width:62ch}
.cbtl-donation{display:flex;align-items:center;gap:10px;padding-top:14px;border-top:1px solid var(--cbtl-line-soft);font-size:13px;color:var(--cbtl-muted);line-height:1.45}
.cbtl-donation svg{flex:none;color:var(--cbtl-faint)}
.cbtl-empty-card{display:flex;flex-direction:column;gap:6px;padding:22px 26px;border-radius:16px;background:var(--cbtl-card);border:1px solid var(--cbtl-line);font-size:14px;color:var(--cbtl-muted);line-height:1.5}
.cbtl-empty-card b{font-family:var(--cbtl-display);font-size:19px;font-weight:var(--cbtl-strong);color:var(--cbtl-ink)}
.cbtl-empty-card[data-ring]{flex-direction:row;align-items:center;gap:26px}
.cbtl-empty-text{display:flex;flex-direction:column;gap:8px;max-width:460px}.cbtl-empty-text .cbtl-hbtn{align-self:flex-start}
.cbtl-sofar{display:flex;flex-direction:column;gap:14px;padding:18px 20px;border-radius:16px;background:var(--cbtl-card);border:1px solid var(--cbtl-line)}
.cbtl-stats4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.cbtl-stat4{display:flex;flex-direction:column;gap:4px;padding:14px 16px;border-radius:12px;background:var(--cbtl-sand);min-width:0}
.cbtl-stat4 small{font-size:12px;color:var(--cbtl-muted)}.cbtl-stat4 b{font-size:21px;font-weight:600;font-variant-numeric:tabular-nums}
.cbtl-stat4[data-keep]{background:var(--cbtl-green-soft);color:#2f6a4f}.cbtl-stat4[data-keep] small{color:#2f6a4f}
.cbtl-ov{display:flex;flex-direction:column;gap:24px}
.cbtl-ov-top{display:flex;gap:28px;align-items:flex-start}
.cbtl-ov-media{flex:none;width:280px;display:flex;flex-direction:column;gap:8px}
.cbtl-ov-photo{position:relative;width:100%;aspect-ratio:4/3;border-radius:12px;overflow:hidden;background:var(--cbtl-sand);color:var(--cbtl-faint);display:flex;align-items:center;justify-content:center}
.cbtl-ov-photo img{width:100%;height:100%;object-fit:cover;display:block}
.cbtl-ov-count{position:absolute;top:12px;left:12px;height:30px;padding:0 10px;display:inline-flex;align-items:center;gap:6px;border-radius:999px;background:rgba(0,0,0,.6);color:#fff;font-size:12px;font-weight:600}
.cbtl .cbtl-ov-arrow{position:absolute;top:50%;transform:translateY(-50%);width:32px;height:32px;border-radius:50%;border:none;background:rgba(255,255,255,.88);color:#191714;display:flex;align-items:center;justify-content:center;cursor:pointer}
.cbtl-ov-arrow[data-side=prev]{left:10px}.cbtl-ov-arrow[data-side=next]{right:10px}
.cbtl-ov-thumbs{display:flex;gap:8px;overflow-x:auto;padding:2px}
.cbtl-ov-thumb{flex:none;width:52px;height:52px;border-radius:9px;overflow:hidden;border:none;padding:0;cursor:pointer;background:var(--cbtl-sand)}
.cbtl-ov-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.cbtl-ov-thumb[aria-current=true]{box-shadow:0 0 0 2px var(--cbtl-card),0 0 0 3.5px var(--cbtl-ink)}
.cbtl-ov-rows{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.cbtl-irow{display:flex;align-items:center;gap:12px;padding:4px 0;min-width:0}
.cbtl-irow-ic{width:44px;height:44px;flex:none;border-radius:10px;border:1px solid var(--cbtl-line);background:var(--cbtl-card);display:flex;align-items:center;justify-content:center;color:var(--cbtl-faint)}
.cbtl-irow-v{flex:1;min-width:0;display:flex;flex-direction:column;gap:1px}
.cbtl-irow-v small{font-size:12px;color:var(--cbtl-faint)}
.cbtl-irow-v b{font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cbtl-irow-v b[data-muted]{font-weight:400;color:var(--cbtl-faint)}
.cbtl-irow-person{display:flex;align-items:center;gap:8px;min-width:0}
.cbtl-irow-person b{font-size:14px;font-weight:500}.cbtl-irow-person small{font-size:12px;color:var(--cbtl-faint)}
.cbtl-ov-sec{display:flex;flex-direction:column;gap:12px;padding-top:22px;border-top:1px solid var(--cbtl-line-soft)}
.cbtl-ov-sec-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.cbtl-ov-h{margin:0;font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--cbtl-faint)}
.cbtl-ov-prose{max-width:68ch}
.cbtl-ov-prose p{margin:0 0 12px;font-size:15px;line-height:1.65;color:var(--cbtl-ink)}
.cbtl-ov-prose p:last-child{margin-bottom:0}
.cbtl-ov-facts{display:flex;flex-direction:column;gap:4px}
.cbtl-chat{display:flex;flex-direction:column;border-radius:16px;background:var(--cbtl-card);border:1px solid var(--cbtl-line);overflow:hidden}
.cbtl-chat-list{display:flex;flex-direction:column;gap:4px;padding:16px;max-height:520px;min-height:220px;overflow:auto;background:#fbfaf8}
.cbtl-chat-empty{margin:auto;color:var(--cbtl-faint);font-size:13.5px}
.cbtl-chat-day{align-self:center;margin:8px 0;padding:3px 10px;border-radius:999px;background:var(--cbtl-sand);font-size:12px;color:var(--cbtl-muted)}
.cbtl-chat-event{align-self:center;margin:6px 0;padding:5px 12px;border-radius:999px;border:1px dashed var(--cbtl-line);font-size:12px;color:var(--cbtl-muted);text-align:center}
.cbtl-chat-row{display:flex;align-items:flex-end;gap:8px;max-width:78%}
.cbtl-chat-row[data-mine]{align-self:flex-end;flex-direction:row-reverse}
.cbtl-bub{padding:8px 10px 6px;border-radius:14px 14px 14px 4px;background:#edecec;font-size:14px;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere}
.cbtl-chat-row[data-mine] .cbtl-bub{background:#ece1f0;border-radius:14px 14px 4px 14px}
.cbtl-bub small{display:block;text-align:right;margin-top:2px;font-size:11px;color:var(--cbtl-faint)}
.cbtl-chat-compose{display:flex;gap:8px;align-items:center;padding:10px 12px;border-top:1px solid var(--cbtl-line-soft)}
.cbtl-chat-input{flex:1;min-width:0;height:44px;padding:0 14px;border-radius:22px;border:1px solid var(--cbtl-line);background:var(--cbtl-bg);font:inherit;font-size:14px;color:var(--cbtl-ink)}
.cbtl .cbtl-chat-send{width:44px;height:44px;flex:none;border-radius:50%;border:none;background:var(--cbtl-commit);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}
.cbtl-chat-send:disabled{opacity:.4;cursor:not-allowed}
.cbtl-wide{max-width:960px;padding:0;gap:0;background:var(--cbtl-bg)}
.cbtl-wide-head{display:flex;align-items:flex-start;gap:12px;padding:24px 28px 18px}
.cbtl-wide-head>span{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.cbtl-x{width:40px;height:40px;flex:none;border-radius:50%;border:none;background:var(--cbtl-sand);display:flex;align-items:center;justify-content:center;cursor:pointer}
.cbtl-pkgs{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;padding:0 28px}
.cbtl-pkg{display:flex;flex-direction:column;gap:10px;padding:16px 18px;border-radius:16px;background:var(--cbtl-card);border:1px solid var(--cbtl-line);text-align:left;cursor:pointer}
.cbtl-pkg[aria-checked=true]{border-color:var(--cbtl-ink);box-shadow:0 0 0 1px var(--cbtl-ink),0 14px 28px -20px rgba(25,23,20,.55)}
.cbtl-pkg-top{display:flex;align-items:center;gap:10px}.cbtl-pkg-top b{font-size:15px;font-weight:600}
.cbtl-rad{width:18px;height:18px;flex:none;border-radius:50%;border:1.5px solid #c9c2b8}
.cbtl-pkg[aria-checked=true] .cbtl-rad{border:5px solid var(--cbtl-ink)}
.cbtl-pkg-rate{display:flex;align-items:baseline;gap:6px}
.cbtl-pkg-rate strong{font-family:var(--cbtl-display);font-size:32px;font-weight:var(--cbtl-strong);letter-spacing:-.02em;line-height:1}
.cbtl-pkg-rate small{font-size:12px;color:var(--cbtl-faint)}
.cbtl-pkg-desc{font-size:13px;line-height:1.45;color:var(--cbtl-muted)}
.cbtl-wide-pad{padding:16px 28px 24px}
.cbtl-wide-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:16px 28px;background:var(--cbtl-card);border-top:1px solid var(--cbtl-line);position:sticky;bottom:0}
.cbtl-wide-sum{flex:1;min-width:200px;font-size:13px;color:var(--cbtl-muted)}.cbtl-wide-sum b{font-weight:600;color:var(--cbtl-ink)}
/* T-414: custom terms for one listing; Cobuntu Premium (canvas page "Change terms") */
.cbtl-kick{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--cbtl-faint)}
.cbtl-ct{max-width:760px}
.cbtl-ct-body{display:flex;flex-direction:column;gap:24px;padding:8px 28px 24px}
.cbtl-ct-sec{display:flex;flex-direction:column;gap:12px}
.cbtl-ct-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
.cbtl-ct-now{font-size:13px;color:var(--cbtl-muted)}
.cbtl-ct-step{display:flex;align-items:center;gap:12px}
.cbtl-ct-step>button{width:52px;height:56px;flex:none;border-radius:14px;border:1px solid var(--cbtl-line);background:var(--cbtl-card);font:inherit;font-size:22px;color:var(--cbtl-ink);cursor:pointer}
.cbtl-ct-field{flex:1;display:flex;align-items:baseline;justify-content:center;gap:4px;height:64px;border-radius:16px;background:var(--cbtl-card);border:1.5px solid var(--cbtl-ink);box-sizing:border-box}
.cbtl-ct-field input{width:90px;border:none;background:transparent;font-family:var(--cbtl-display);font-size:40px;font-weight:600;text-align:right;color:var(--cbtl-ink);padding:8px 0 0;outline:none}
.cbtl-ct-field b{font-family:var(--cbtl-display);font-size:30px;font-weight:600}
.cbtl-ct-picks{position:relative;display:flex;padding:4px;border-radius:14px;background:var(--cbtl-sand);gap:4px}
.cbtl-ct-picks button{position:relative;z-index:1;flex:1;min-height:44px;border-radius:10px;border:none;background:transparent;font:inherit;font-size:14px;color:var(--cbtl-muted);cursor:pointer;line-height:1.1}
.cbtl-ct-picks button small{display:block;font-size:11px;color:var(--cbtl-faint)}
.cbtl-ct-picks button[aria-pressed="true"]{color:var(--cbtl-ink);font-weight:600}
.cbtl-ct-thumb{position:absolute;top:4px;bottom:4px;left:4px;width:calc((100% - 8px - (var(--n) - 1) * 4px) / var(--n));border-radius:10px;background:var(--cbtl-card);box-shadow:0 1px 3px rgba(25,23,20,.14);transform:translateX(calc(var(--i) * (100% + 4px)));pointer-events:none}
.cbtl-ct-thumb[data-off]{opacity:0}
@media (prefers-reduced-motion: no-preference){.cbtl-ct-thumb{transition:transform .32s cubic-bezier(.2,.8,.2,1),opacity .2s ease}.cbtl-ct-picks button{transition:color .2s ease}}
.cbtl-ask{display:flex;align-items:center;gap:28px;flex-wrap:wrap;padding:22px 24px;border-radius:18px;background:var(--cbtl-card);border:1px solid var(--cbtl-line)}
.cbtl-ask-who{flex:1;min-width:240px;display:flex;align-items:center;gap:16px}
.cbtl-ask-mark{width:52px;height:52px;flex:none;border-radius:14px;overflow:hidden;background:var(--cbtl-sand);display:flex;align-items:center;justify-content:center}
.cbtl-ask-mark img{width:100%;height:100%;object-fit:cover}
.cbtl-ask-text{display:flex;flex-direction:column;gap:5px;min-width:0}
.cbtl-ask-text b{font-family:var(--cbtl-display);font-size:22px;font-weight:600;letter-spacing:-.01em;line-height:1.15}
.cbtl-ask-text small{font-size:13px;line-height:1.5;color:var(--cbtl-muted)}
.cbtl-ask-terms{display:flex;align-items:center;gap:12px;color:var(--cbtl-faint)}
.cbtl-ask-chip{display:flex;flex-direction:column;gap:4px;width:124px;padding:12px 14px;box-sizing:border-box;border-radius:14px;background:var(--cbtl-sand);color:var(--cbtl-muted)}
.cbtl-ask-chip small{font-size:12px}
.cbtl-ask-chip b{font-family:var(--cbtl-display);font-size:26px;font-weight:600;line-height:1}
.cbtl-ask-chip[data-new]{background:var(--cbtl-card);border:1.5px solid var(--cbtl-ink);color:var(--cbtl-ink)}
.cbtl-cmp{display:flex;flex-direction:column;gap:8px;padding:16px 18px;border-radius:16px;background:var(--cbtl-card);border:1px solid var(--cbtl-line)}
.cbtl-cmp-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 14px;border-radius:12px;background:var(--cbtl-sand);font-size:13px;color:var(--cbtl-muted);font-variant-numeric:tabular-nums}
.cbtl-cmp-row b{font-size:16px;font-weight:600;color:var(--cbtl-ink)}
.cbtl-cmp-row[data-ask]{background:var(--cbtl-green-soft);color:var(--cbtl-green-ink);font-weight:600}
.cbtl-cmp-row[data-ask] b{color:var(--cbtl-green-ink)}
.cbtl-cmp small{font-size:12px;color:var(--cbtl-faint);padding:0 4px}
.cbtl-prem{display:flex;align-items:center;gap:28px;flex-wrap:wrap;padding:24px 26px;border-radius:20px;background:#232a35;color:#fff}
.cbtl-prem-who{flex:1;min-width:240px;display:flex;align-items:center;gap:16px}
.cbtl-prem-mark{width:56px;height:56px;flex:none;border-radius:16px;background:#fff8f1;display:flex;align-items:center;justify-content:center}
.cbtl-prem-text{display:flex;flex-direction:column;gap:6px;min-width:0}
.cbtl-prem-kick{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#e7b866}
.cbtl-prem-text b{font-family:var(--cbtl-display);font-size:22px;font-weight:600;letter-spacing:-.01em;line-height:1.15}
.cbtl-prem-text small{font-size:13px;line-height:1.5;color:rgba(255,255,255,.68)}
.cbtl-prem-cmp{width:320px;max-width:100%;display:flex;flex-direction:column;gap:6px}
.cbtl-prem-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px;padding:0 14px;border-radius:12px;background:rgba(255,255,255,.07);font-size:13px;color:rgba(255,255,255,.68);font-variant-numeric:tabular-nums}
.cbtl-prem-row b{font-size:15px;font-weight:600;color:rgba(255,255,255,.88)}
.cbtl-prem-row[data-with]{background:rgba(198,131,70,.18);box-shadow:inset 0 0 0 1px rgba(231,184,102,.45);color:#f3c98a;font-weight:600}
.cbtl-prem-row[data-with] b{color:#fff}
.cbtl-prem-gain{display:flex;align-items:center;gap:8px}
.cbtl-prem-gain i{font-style:normal;height:22px;padding:0 8px;border-radius:999px;background:#e7b866;color:#2a2416;font-size:12px;font-weight:700;display:inline-flex;align-items:center}
.cbtl-prem-acts{display:flex;flex-direction:column;gap:6px;min-width:150px}
.cbtl-prem-go{min-height:46px;padding:0 18px;border-radius:12px;border:none;background:#c68346;font:inherit;font-size:14px;font-weight:600;color:#fff;cursor:pointer;white-space:nowrap}
.cbtl-prem-go:disabled{opacity:.5;cursor:default}
.cbtl-prem-later{min-height:36px;border:none;background:transparent;font:inherit;font-size:13px;color:rgba(255,255,255,.55);cursor:pointer}
.cbtl-prem-in{flex-direction:column;align-items:stretch;gap:14px;padding:20px 22px}
.cbtl-prem-in .cbtl-prem-mark{width:48px;height:48px;border-radius:14px}
.cbtl-prem-note{font-size:12px;line-height:1.5;color:rgba(255,255,255,.6)}
.cbtl-prem-step{display:flex;flex-direction:column;gap:12px}
.cbtl-prem-int{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.cbtl-prem-int button{display:flex;flex-direction:column;gap:2px;align-items:flex-start;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:transparent;color:#fff;font:inherit;text-align:left;cursor:pointer}
.cbtl-prem-int button small{font-size:12px;color:rgba(255,255,255,.6)}
.cbtl-prem-int button[aria-checked="true"]{border-color:#e7b866;background:rgba(231,184,102,.12)}
.cbtl-prem-waiver{display:flex;gap:10px;align-items:flex-start;font-size:13px;color:rgba(255,255,255,.8);cursor:pointer}
.cbtl-prem-waiver input{width:18px;height:18px;margin:1px 0 0;accent-color:#c68346}
.cbtl-prem-sheet{max-width:460px;background:#232a35}
.cbtl-acc{max-width:640px}
.cbtl-acc-head{display:flex;flex-direction:column;gap:8px;padding:28px 28px 6px}
.cbtl-acc-head h3{margin:0;font-family:var(--cbtl-display);font-size:26px;font-weight:600;letter-spacing:-.01em;line-height:1.15}
.cbtl-acc-head p{margin:0;font-size:14px;line-height:1.55;color:var(--cbtl-muted)}
.cbtl-acc-body{display:flex;flex-direction:column;gap:16px;padding:18px 28px 24px}
.cbtl-acc-lines{display:flex;flex-direction:column;padding:6px 18px;border-radius:18px;background:var(--cbtl-card);border:1px solid var(--cbtl-line)}
.cbtl-acc-row{display:flex;align-items:center;gap:12px;min-height:46px;font-size:14px;border-top:1px solid var(--cbtl-line-soft)}
.cbtl-acc-row:first-child{border-top:none}
.cbtl-acc-row>span{flex:1}
.cbtl-acc-row small{color:var(--cbtl-faint)}
.cbtl-acc-row b{font-weight:600;font-variant-numeric:tabular-nums}
.cbtl-acc-row[data-mine]{margin:6px -10px 0;padding:0 10px;border-radius:12px;background:var(--cbtl-green-soft);color:var(--cbtl-green-ink);font-weight:600;border-top:none}
.cbtl-acc-dot{width:10px;height:10px;border-radius:3px;background:var(--cbtl-green);flex:none}
.cbtl-acc-mk{width:28px;height:28px;flex:none;border-radius:8px;overflow:hidden;background:var(--cbtl-sand);display:flex;align-items:center;justify-content:center}
.cbtl-acc-mk img{width:100%;height:100%;object-fit:cover}
.cbtl-acc-mk[data-stripe]{background:#635BFF}
.cbtl-chg{position:relative;max-width:1000px}
.cbtl-chg .cbtl-wide-head{align-items:center}
.cbtl-chg-logo{width:44px;height:44px;flex:none;border-radius:12px;object-fit:cover}
.cbtl-chg-body{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:16px;padding:0 28px 24px;align-items:start}
.cbtl-chg-cards{display:flex;flex-direction:column;gap:12px;min-width:0}
.cbtl-chg-card{display:flex;flex-direction:column;gap:14px;padding:18px 18px 16px;border-radius:16px;background:var(--cbtl-card);border:1px solid var(--cbtl-line);text-align:left;font:inherit;color:var(--cbtl-ink);cursor:pointer}
.cbtl-chg-card:hover{border-color:#c9c2b8}
.cbtl-chg-card[aria-checked=true]{border-color:var(--cbtl-ink);box-shadow:0 0 0 1px var(--cbtl-ink),0 14px 30px -20px rgba(25,23,20,.55)}
.cbtl-chg-card[aria-checked=true] .cbtl-rad{border:6px solid var(--cbtl-ink)}
.cbtl-chg-top{display:flex;align-items:flex-start;gap:12px}
.cbtl-chg-top .cbtl-rad{width:20px;height:20px;margin-top:2px;box-sizing:border-box}
.cbtl-chg-name{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:6px}
.cbtl-chg-name b{font-size:16px;font-weight:600}
.cbtl-chg-name small{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:999px;background:var(--cbtl-sand);color:var(--cbtl-muted);font-size:11px;font-weight:600}
.cbtl-chg-rate{flex:none;font-family:var(--cbtl-display);font-size:30px;font-weight:600;letter-spacing:-.02em;line-height:1;color:var(--cbtl-muted)}
.cbtl-chg-card[aria-checked=true] .cbtl-chg-rate{color:var(--cbtl-ink)}
.cbtl-chg-points{display:flex;flex-direction:column;gap:7px;padding-left:32px}
.cbtl-chg-points>span{display:flex;align-items:center;gap:9px;font-size:13px;color:var(--cbtl-ink)}
.cbtl-chg-points svg{flex:none;color:#2f7a57}
.cbtl-chg-points>span[data-yours]{color:var(--cbtl-faint)}
.cbtl-chg-points>span[data-yours] svg{color:#c9c2b8}
.cbtl-terms .cbtl-chg-points{flex-direction:row;flex-wrap:wrap;gap:6px 16px;padding-left:0;margin-top:6px}
.cbtl-terms-btn{flex:none}
.cbtl-chg-keep{display:flex;align-items:center;gap:10px;margin-left:32px;padding:10px 12px;border-radius:10px;background:var(--cbtl-sand);font-size:13px;color:var(--cbtl-muted);font-variant-numeric:tabular-nums}
.cbtl-chg-keep>span{flex:1}
.cbtl-chg-keep small{font-size:12px}
.cbtl-chg-keep b{font-size:15px;font-weight:600;color:var(--cbtl-ink)}
.cbtl-chg-card[aria-checked=true] .cbtl-chg-keep{background:var(--cbtl-green-soft);color:var(--cbtl-green-ink)}
.cbtl-chg-card[aria-checked=true] .cbtl-chg-keep b{color:var(--cbtl-green-ink)}
.cbtl-chg-chart{display:flex;flex-direction:column;gap:16px;padding:20px 22px 14px;border-radius:18px;background:var(--cbtl-card);border:1px solid var(--cbtl-line);min-width:0}
.cbtl-chg-chart-head{display:flex;flex-direction:column;gap:2px}
.cbtl-chg-chart-head small{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--cbtl-faint)}
.cbtl-chg-chart-head b{font-size:15px;font-weight:600}
.cbtl-chg-ring{position:relative;width:216px;height:216px;align-self:center}
.cbtl-chg-ring svg{width:100%;height:100%;display:block}
.cbtl-chg-hole{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;text-align:center}
.cbtl-chg-hole small{font-size:12px;color:var(--cbtl-faint)}
.cbtl-chg-hole small:first-child{font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase}
.cbtl-chg-hole b{font-size:21px;font-weight:600;letter-spacing:-.01em;color:var(--cbtl-green-ink);font-variant-numeric:tabular-nums}
.cbtl-chg-legend{display:flex;flex-direction:column}
.cbtl-chg-lg{display:flex;align-items:center;gap:10px;min-height:44px;font-size:14px}
.cbtl-chg-lg>span:not(.cbtl-chg-mk){flex:1;min-width:0}
.cbtl-chg-lg small{display:block;font-size:12px;font-weight:400;color:var(--cbtl-faint)}
.cbtl-chg-lg b{font-weight:600;font-variant-numeric:tabular-nums}
.cbtl-chg-lg[data-mine]{margin:0 -10px;padding:0 10px;border-radius:10px;background:var(--cbtl-green-soft);color:var(--cbtl-green-ink);font-weight:600}
.cbtl-chg-sw{width:10px;height:10px;border-radius:3px;flex:none}
.cbtl-chg-mk{width:28px;height:28px;flex:none;border-radius:8px;overflow:hidden;background:var(--cbtl-sand);display:flex;align-items:center;justify-content:center}
.cbtl-chg-mk img{width:100%;height:100%;object-fit:cover}
.cbtl-chg-mk[data-round]{border-radius:50%}
.cbtl-chg-note{display:flex;align-items:center;gap:12px}
.cbtl-chg-clock{width:34px;height:34px;flex:none;border-radius:10px;background:#fbf1dc;color:#7a5414;display:flex;align-items:center;justify-content:center}
.cbtl-chg-confirm{position:absolute;inset:0;z-index:2;background:rgba(25,23,20,.45);display:flex;align-items:center;justify-content:center;padding:16px;border-radius:inherit}
.cbtl-chg-confirm-card{width:100%;max-width:560px;box-sizing:border-box;background:var(--cbtl-card);border-radius:20px;padding:24px 24px 18px;display:flex;flex-direction:column;gap:14px;box-shadow:0 30px 60px -25px rgba(25,23,20,.6)}
.cbtl-chg-confirm-card h3{margin:0;font-family:var(--cbtl-display);font-size:22px;font-weight:600}
.cbtl-chg-confirm-card p{margin:0;font-size:14px;line-height:1.5;color:var(--cbtl-muted)}
.cbtl-chg-states{display:flex;align-items:center;gap:10px;color:var(--cbtl-faint)}
.cbtl-chg-states>span{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;padding:12px 14px;border-radius:12px;background:var(--cbtl-card);box-shadow:inset 0 0 0 1.5px var(--cbtl-ink);color:var(--cbtl-ink)}
.cbtl-chg-states>span[data-was]{background:var(--cbtl-sand);box-shadow:none}
.cbtl-chg-states small{font-size:12px;color:var(--cbtl-muted)}
.cbtl-chg-states b{font-size:14px;font-weight:600}
.cbtl-chg-confirm-card .cbtl-chg-kept{font-size:13px}
.cbtl-chg-confirm-foot{display:flex;justify-content:flex-end;gap:8px;padding-top:4px}
@media (prefers-reduced-motion: no-preference){.cbtl-chg-card{transition:border-color .2s ease,box-shadow .2s ease}}
@container (max-width: 640px){
.cbtl-chg-body{grid-template-columns:1fr;padding:0 16px 16px}.cbtl-chg-chart{display:none}.cbtl-chg-note{display:none}.cbtl-chg-points{padding-left:30px}.cbtl-chg-keep{margin-left:30px}.cbtl-chg-states{flex-direction:column;align-items:stretch}.cbtl-terms{flex-wrap:wrap}.cbtl-terms-btn{flex:1 1 100%}
.cbtl-ct-body{padding:8px 16px 20px}.cbtl-acc-head{padding:22px 16px 4px}.cbtl-acc-body{padding:14px 16px 18px}.cbtl-ask{gap:16px;padding:18px}.cbtl-ask-terms{width:100%;justify-content:space-between}.cbtl-ask-chip{flex:1;width:auto}.cbtl-prem{gap:16px;padding:18px}.cbtl-prem-cmp,.cbtl-prem-acts{width:100%}
.cbtl-crumb{font-size:14px}.cbtl-crumb-link{max-width:110px}
.cbtl-secs{gap:8px}.cbtl-sec{padding:12px 10px;gap:8px}.cbtl-sec-ic{width:32px;height:32px;border-radius:9px}
.cbtl-sec-text b{font-size:13px}.cbtl-sec-text small{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block}
.cbtl-sec-badge{top:10px;right:10px}
.cbtl-dbar{flex-direction:column;align-items:stretch;gap:12px;bottom:8px}
.cbtl-dbar-moves{width:100%}.cbtl-dbtn{flex:1 1 0;height:44px}.cbtl-dbtn[data-kind=primary]{flex:1.4 1 0}
.cbtl-panel{padding:16px}
.cbtl-panel-body,.cbtl-panel-body[data-every]{grid-template-columns:1fr;justify-items:center}
.cbtl-lines,.cbtl-every{width:100%}
.cbtl-every{padding-left:0;border-left:0;border-top:1px solid var(--cbtl-line-soft);padding-top:12px}
.cbtl-seg{flex-wrap:nowrap;overflow-x:auto}
.cbtl-terms{padding:12px 14px}.cbtl-terms-marks{display:none}
.cbtl-stats4{grid-template-columns:repeat(2,minmax(0,1fr))}
.cbtl-empty-card[data-ring]{flex-direction:column;align-items:flex-start}
.cbtl-ov-top{flex-direction:column;gap:16px}.cbtl-ov-media{width:100%}
.cbtl-chat-row{max-width:88%}
.cbtl-wide{max-width:none}
.cbtl-wide-head,.cbtl-pkgs,.cbtl-wide-pad,.cbtl-wide-foot{padding-left:16px;padding-right:16px}
.cbtl-pkgs{grid-template-columns:1fr}
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
@media (prefers-reduced-motion: no-preference){.cbtl-node-btn,.cbtl-btn,.cbtl-chip{transition:box-shadow .15s ease,background .15s ease}.cbtl-sec{transition:box-shadow .15s ease,background .15s ease,transform .15s ease}.cbtl-sec-ic{transition:background .15s ease}}
`;
