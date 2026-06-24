I reviewed `pg.js` and here are my **highest-value enhancement suggestions**, grouped and prioritized.

### 1) Reliability & correctness (highest priority)
1. **Normalize date parsing in one helper**  
   Right now dates are parsed in many places (`formatDate`, each render mode, etc.) with mixed assumptions (Unix seconds vs JS date string).  
   ➜ Add a single `parseProjectDate(value)` helper and use it everywhere.

2. **Handle ISO week edge cases correctly**  
   In weeks mode, week rollover assumes 52 weeks (`if (wn > 52)`), but some years have week 53.  
   ➜ Compute ISO weeks per year properly to avoid week misalignment around year boundaries.

3. **Avoid duplicate event listeners on rerender**  
   `attachTooltipEvents(container)` is called after each render and adds listeners each time.  
   ➜ Attach once (or remove before re-attach) to prevent memory/perf issues and repeated tooltip behavior.

4. **Fix language mismatch in status labels**  
   `getStatusLabel` handles `completed/done/archived/active`, but not localized raw values like `terminé` in label mapping (while color mapping does).  
   ➜ Centralize status normalization (`normalizeStatus`) and reuse for both color + label.

---

### 2) Performance improvements
5. **Reduce repeated expensive loops per project**  
   Each mode recomputes many date intersections with nested loops.  
   ➜ Extract shared overlap logic and precompute timeline intervals once per render mode.

6. **Minimize full `innerHTML` rebuilds for small updates**  
   Navigation and mode switches are okay with full rerender, but tooltip/state updates shouldn’t trigger heavy operations.  
   ➜ Keep full render for view changes, but isolate dynamic micro-updates (tooltip, today line state where possible).

7. **Debounce/guard live reload more robustly**  
   Current `grist.onRecords` uses a timeout, good start.  
   ➜ Add “in-flight fetch” guard (skip overlapping fetches) to avoid race conditions and stale repaint.

---

### 3) Maintainability & code quality
8. **Split `renderGanttView()` into per-mode renderers**  
   `renderGanttView` is very large and hard to evolve.  
   ➜ Refactor into:
   - `renderWeeksMode(...)`
   - `renderMonthsMode(...)`
   - `renderDaysMode(...)`
   - `renderYearMode(...)`
   - shared utilities (`buildTimeline`, `findBarSpan`, `renderTodayIndicator`)

9. **Replace many `var` with `const/let`**  
   Improves scoping safety and readability.

10. **Move inline styles into CSS classes**  
   There are many inline style strings in template HTML.  
   ➜ Use `pg.css` classes to simplify JS and make visual tweaks safer.

11. **Centralize literals/constants**  
   Widths like `80`, `70`, `36`, and colors are scattered.  
   ➜ Put in a constants map for easier tuning.

---

### 4) UX & accessibility
12. **Improve keyboard and screen reader support**  
   Gantt bars are divs without ARIA semantics.  
   ➜ Add `tabindex`, `aria-label`, and keyboard tooltip trigger (`focus/blur`).

13. **Add filters and sorting**  
   Useful for many projects: status filter, lead filter, sort by start date.

14. **Better empty/error states with i18n**  
   Some strings are hard-coded in French (`Erreur de chargement...`, `Rien à exporter`).  
   ➜ Move all visible text to i18n keys.

15. **Optional legend for status colors**  
   Add a small legend in footer for Active/Completed/Archived/On Hold.

---

### 5) Security / platform robustness
16. **Reconsider dynamic CDN injection for html2canvas**  
   Runtime script injection can fail or violate CSP in enterprise setups.  
   ➜ Prefer bundling html2canvas via project dependencies and loading locally.

17. **Harden sanitizer slightly**  
   Existing sanitizer is good baseline, but if used in attributes/styles in future, centralize stronger escaping utilities.

---

## Suggested implementation order (practical roadmap)
1. **Stability pass**: date parsing helper, ISO week fix, listener attach-once, status normalization.
2. **Refactor pass**: split `renderGanttView` into per-mode functions + shared overlap utilities.
3. **UX/i18n pass**: move hardcoded strings to i18n, accessibility improvements, legend + filters.
4. **Infra pass**: local html2canvas dependency and constants/css cleanup.

If you want, I can now produce a **concrete patch plan** (file-level, function-level) and then implement it once you toggle to Act mode.