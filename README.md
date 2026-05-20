# @cobuntu/management-ui-shared

Shared primitives consumed by [`@cobuntu/event-management-ui`](https://github.com/cobuntuHello/cobuntu-event-management-ui) and [`@cobuntu/product-management-ui`](https://github.com/cobuntuHello/cobuntu-product-management-ui).

Both packages used to ship their own copy of the same `ModalShell`, `TextField`, `NumberField`, etc. — primitives drifted (e.g. modal shell on events fixed scroll long after the product side). This package eliminates that drift.

## How it's consumed

Both packages add this as a **git dependency** in their `package.json`:

```json
{
  "dependencies": {
    "@cobuntu/management-ui-shared": "git+ssh://git@github.com:cobuntuHello/cobuntu-management-ui-shared.git#<sha-or-tag>"
  }
}
```

Apps that transitively depend on it (the admin app, the community app) must list it in `transpilePackages`:

```js
// next.config.js
module.exports = {
  transpilePackages: [
    '@cobuntu/event-management-ui',
    '@cobuntu/product-management-ui',
    '@cobuntu/management-ui-shared',
  ],
};
```

Then import:

```tsx
import { ModalShell, TextField, BillingRadio } from '@cobuntu/management-ui-shared';
```

### Pinning

- **Production**: pin to a specific commit SHA or version tag.
- **Development**: `#main` is fine; bump the lockfile by re-running `npm install`.

## v0.1.0 scope

- `ModalShell` — fixed height, internal scroll container, header/footer slots, backdrop dismissal.
- `TextField` — labeled text input with hint + error states. Consistent padding/border across both modals.
- `NumberField` — numeric input with min/max + step. Used for installment fields, attendance caps, etc.
- `SectionCard` — flat card wrapper used inside modal steps.
- `WizardProgress` — step indicator for multi-step modal flow.
- `DiscardPrompt` — confirm-discard dialog when closing a modal with unsaved changes.
- `BillingRadio` — One-time / Recurring / Installment plan radio. Mutually exclusive by design.
- `DiscountModeRadio` — Free / Percent off / Flat off / Fixed price (member-pricing modes).

## Development

```bash
npm install
npm run typecheck
npm test
```

Peer dependencies:
- React >=19
- React DOM >=19
- Next >=16

Ships TypeScript source directly — no build step. Consumers' Next.js build (via `transpilePackages`) compiles it.

## Versioning

- v0.x — pre-stable. Both consumer packages bump SHAs in lockstep with feature work.
- Tags follow the SHA refs in consumer `package.json` lines.
