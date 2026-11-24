/**
 * Shared application state.
 *
 * This module exists so that low-level helpers (error reporting, favourites,
 * …) can read the live Supabase client and session without importing
 * `src/app.js`.  Previously `src/app.js` imported `src/core/errors.js` while
 * `src/core/errors.js` imported `state` back from `src/app.js`, which created
 * an ES module cycle.  Keeping the mutable state in a leaf module removes the
 * cycle: `app.js -> state.js` and `errors.js -> state.js` are both one-way.
 *
 * `src/app.js` re-exports `state` so existing page modules keep working.
 */
import { AUDIENCE_GUEST } from '/src/core/audience.js';

export const state = {
  audience: AUDIENCE_GUEST,
  user: null,
  cart: [],
  storeSettings: {},
  supabase: null,
  initialized: false,
};

export default state;
