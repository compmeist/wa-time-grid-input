import { LitElement, html, css } from 'https://cdn.jsdelivr.net/npm/lit@3/+esm';

/**
 * <wa-time-grid-input>
 *
 * A Web Awesome compatible time picker built with Lit 3 as a standard
 * form-associated custom element (extends LitElement extends HTMLElement).
 *
 * free-text input bound to a "h:mm AM" string,
 *    hour tiles keep the current minutes, minute tiles keep the current
 *    hour/period. Grid layout: AM hours in the first two rows, PM hours in
 *    the next two rows, minute tiles in their own right-hand column. The
 *    minute tiles step by the `minute-interval` attribute (default 15), so
 *    the count and labels resolve at render time: 12 tiles for 5, 4 for 15.
 *  
 *    Done/close semantics, onSelect/onClose callbacks (here: input/change
 *    events plus wa-show/wa-hide).
 *
 * Styling follows the Web Awesome design philosophy: outside the shadow root
 * use WA utility classes (wa-stack, wa-cluster, wa-gap-*); inside, all
 * visuals are built from WA design tokens (--wa-space-*, --wa-color-*,
 * --wa-border-*, --wa-font-size-*, --wa-shadow-*) with plain fallbacks, so
 * the picker themes automatically and still renders with no theme loaded.
 * The trigger input mirrors <wa-input> function and style: label, hint,
 * placeholder, size, appearance, pill, with-clear, required, disabled,
 * readonly, name/value form participation, and input/change events.
 *
 * Differences from the examples (intentional):
 *  - No minute fine-tune slider: the brief asks for the compact hour +
 *    minute tile grid only.
 *  - Tiles are native <button> elements styled with WA tokens instead of
 *    28 <wa-button> instances (avoids 28 tab stops and a hard WA runtime
 *    dependency inside the shadow root).
 *  - Picking an hour keeps the popup open so a minute can follow; picking
 *    a minute completes the time and closes the popup.
 */

const HOURS_ROW_A = ['12', '1', '2', '3', '4', '5'];
const HOURS_ROW_B = ['6', '7', '8', '9', '10', '11'];

// Step (in minutes) between minute tiles. The tile labels and count derive
// from this at render time: 60 / step tiles labelled "00" up to ":55".
const DEFAULT_MINUTE_INTERVAL = 15;

// Normalize user input to a usable step in minutes (mirrors the legacy
// jQuery timepicker, which steps its minute list by a configurable
// interval). Non-numeric, zero, and negative values fall back to the
// default; anything above 60 clamps to 60 (a single "00" tile).
export function normalizeMinuteInterval(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return DEFAULT_MINUTE_INTERVAL;
  return Math.min(n, 60);
}

// Minute tile labels from "00" up to (excluding) ":60", stepping by the
// normalized interval. Divisors of 60 give exact grids (5 -> 12 tiles,
// 15 -> 4 tiles); other steps simply stop before 60.
export function minuteTiles(interval) {
  const step = normalizeMinuteInterval(interval);
  const tiles = [];
  for (let m = 0; m < 60; m += step) tiles.push(String(m).padStart(2, '0'));
  return tiles;
}

// Accepts "8", "8:00", "8 AM", "8:00 AM", "2:30pm", "14:30" (24h converted).
const DISPLAY_RE = /^\s*(\d{1,2})(?:\s*[:.h]\s*(\d{1,2}))?\s*(?:([aApP])\.?\s*([mM])?)?.*$/;

function parseTime(str) {
  if (typeof str !== 'string') return null;
  const m = DISPLAY_RE.exec(str);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  let min = m[2] === undefined || m[2] === '' ? 0 : parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(min)) return null;
  if (m[3]) {
    const period = m[3].toUpperCase() === 'A' ? 'AM' : 'PM';
    if (h < 1 || h > 12 || min > 59) return null;
    return { hour: String(h), minute: String(min).padStart(2, '0'), period };
  }
  // No AM/PM marker: treat as 24-hour input and convert.
  if (h > 23 || min > 59) return null;
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return { hour: String(h), minute: String(min).padStart(2, '0'), period };
}

function formatTime(parts) {
  return `${parts.hour}:${parts.minute} ${parts.period}`;
}

const padHour = (h) => (h === '12' ? '12' : h.padStart(2, '0'));

export class WaTimeGridInput extends LitElement {
  static formAssociated = true;

  static properties = {
    label: { type: String },
    hint: { type: String },
    placeholder: { type: String },
    name: { type: String },
    value: { type: String },
    defaultValue: { type: String, attribute: 'default-value' },
    required: { type: Boolean, reflect: true },
    disabled: { type: Boolean, reflect: true },
    readonly: { type: Boolean, reflect: true },
    size: { type: String, reflect: true },
    appearance: { type: String, reflect: true },
    pill: { type: Boolean, reflect: true },
    withClear: { type: Boolean, attribute: 'with-clear', reflect: true },
    open: { type: Boolean, reflect: true },
    minuteInterval: { type: Number, attribute: 'minute-interval', reflect: true },
    _showLabel: { state: true },
    _showHint: { state: true },
  };

  static styles = css`
    :host {
      --_font: var(--wa-font-size-m, 1rem);
      display: block;
      max-width: 22rem;
    }
    :host([size='xs']) { --_font: var(--wa-font-size-xs, 0.75rem); }
    :host([size='s']) { --_font: var(--wa-font-size-s, 0.875rem); }
    :host([size='l']) { --_font: var(--wa-font-size-l, 1.125rem); }
    :host([size='xl']) { --_font: var(--wa-font-size-xl, 1.25rem); }

    .label {
      font-size: var(--wa-font-size-s, 0.875rem);
      font-weight: 600;
      margin-block-end: var(--wa-space-3xs, 0.25rem);
    }
    .label[hidden], .hint[hidden] { display: none; }

    .anchor { position: relative; }

    .field {
      display: flex;
      align-items: center;
      gap: var(--wa-space-2xs, 0.375rem);
      font-size: var(--_font);
      color: var(--wa-color-text-normal, #1b1b1b);
      background: var(--wa-color-surface-default, #fff);
      border: var(--wa-border-width-s, 1px) solid var(--wa-color-neutral-border-normal, #c8c8c8);
      border-radius: var(--wa-border-radius-m, 0.375rem);
      padding: 0.45em 0.6em;
    }
    :host([appearance='filled']) .field {
      background: var(--wa-color-neutral-fill-quiet, #f0f0f0);
      border-color: transparent;
    }
    :host([appearance='filled-outlined']) .field {
      background: var(--wa-color-neutral-fill-quiet, #f0f0f0);
    }
    :host([pill]) .field { border-radius: var(--wa-border-radius-pill, 9999px); }
    .field:focus-within {
      outline: 2px solid var(--wa-color-brand-fill-loud, Highlight);
      outline-offset: 1px;
    }
    :host([disabled]) .field { opacity: 0.55; }

    .field input {
      flex: 1;
      min-width: 0;
      border: 0;
      padding: 0;
      background: transparent;
      color: inherit;
      font: inherit;
    }
    .field input:focus { outline: none; }
    .field input::placeholder { color: var(--wa-color-text-quiet, #767676); }

    slot[name='start']::slotted(*), slot[name='end']::slotted(*) { display: flex; }

    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 0;
      padding: 0.1em;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
      border-radius: var(--wa-border-radius-s, 0.25rem);
    }
    .icon-btn:hover { background: var(--wa-color-neutral-fill-quiet, #eee); }
    .icon-btn:focus-visible {
      outline: 2px solid var(--wa-color-brand-fill-loud, Highlight);
      outline-offset: 1px;
    }
    .icon-btn svg { width: 1.1em; height: 1.1em; }

    .popup {
      position: absolute;
      inset-inline: 0;
      top: calc(100% + var(--wa-space-2xs, 0.375rem));
      /* Floor the bounding box itself past the anchor width so it can grow
         in x below a narrow input: 6 hour tiles + --min-cols minute tiles
         at minimum track size + period-label column + (7 + --min-cols)
         gaps/offset + own padding. em resolves against the popup font,
         pinned to the grid's below. --min-cols is set inline per render
         from the minute tile count, so the floor tracks minute-interval. */
      font-size: var(--_font);
      min-width: calc(
        (6 + var(--min-cols, 1)) * 2.4em + 2em + (7 + var(--min-cols, 1)) * var(--wa-space-3xs, 0.25rem) + 2 * var(--wa-space-s, 0.75rem)
      );
      display: none;
      background: var(--wa-color-surface-default, #fff);
      color: var(--wa-color-text-normal, #1b1b1b);
      border: var(--wa-border-width-s, 1px) solid var(--wa-color-neutral-border-normal, #c8c8c8);
      border-radius: var(--wa-border-radius-l, 0.5rem);
      box-shadow: var(--wa-shadow-m, 0 0.5em 1em rgba(0, 0, 0, 0.2));
      padding: var(--wa-space-s, 0.75rem);
      z-index: 10;
    }
    :host([open]) .popup { display: block; }

    .grid {
      display: grid;
      grid-template-columns: auto repeat(6, minmax(2.4em, 1fr)) auto;
      gap: var(--wa-space-3xs, 0.25rem);
      align-items: stretch;
      font-size: var(--_font);
      /* Floor so tiles never spill out of the popup when the input is narrow:
         6 hour tiles + --min-cols minute tiles at minimum track size +
         period-label column + (7 + --min-cols) gaps/offset, all in the
         grid's own em so it tracks size. For the default interval of 15
         (--min-cols: 1) this is exactly the old 7-tile floor. */
      min-width: calc((6 + var(--min-cols, 1)) * 2.4em + 2em + (7 + var(--min-cols, 1)) * var(--wa-space-3xs, 0.25rem));
    }
    .grid-header {
      font-size: 0.78em;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--wa-color-text-quiet, #666);
      text-align: center;
      align-self: center;
    }
    .grid-header.hour { grid-column: 1 / 8; }
    .period {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8em;
      font-weight: 700;
      color: var(--wa-color-text-quiet, #666);
    }
    .grid-header.min-col {
      border-inline-start: var(--wa-border-width-s, 1px) solid var(--wa-color-neutral-border-normal, #c8c8c8);
      padding-inline-start: var(--wa-space-3xs, 0.25rem);
    }
    /* Right-hand minute panel: spans the four hour rows and flows tiles
       top-to-bottom into as many 2.4em columns as needed
       (columns = ceil(tileCount / 4)), so the popup keeps the hour grid's
       height and only grows in x. Minute tiles keep the same minimum track
       size as hour tiles; --min-cols (set inline per render) feeds the
       bounding-box floors above. */
    .minutes {
      grid-column: 8;
      grid-row: 2 / span 4;
      display: grid;
      grid-template-rows: repeat(4, minmax(0, 1fr));
      grid-auto-flow: column;
      grid-auto-columns: minmax(2.4em, 1fr);
      gap: var(--wa-space-3xs, 0.25rem);
      border-inline-start: var(--wa-border-width-s, 1px) solid var(--wa-color-neutral-border-normal, #c8c8c8);
      padding-inline-start: var(--wa-space-3xs, 0.25rem);
      min-width: 0;
      min-height: 0;
    }
    .minutes .tile { min-height: 0; }

    .tile {
      font: inherit;
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      line-height: 1.2;
      padding: 0.32em 0;
      background: transparent;
      color: inherit;
      border: var(--wa-border-width-s, 1px) solid var(--wa-color-neutral-border-normal, #c8c8c8);
      border-radius: var(--wa-border-radius-s, 0.25rem);
      cursor: pointer;
    }
    .tile:hover {
      background: var(--wa-color-neutral-fill-quiet, #f0f0f0);
      text-decoration: underline;
      text-decoration-thickness: 0.15em;
    }
    .tile:focus-visible {
      outline: 2px solid var(--wa-color-brand-fill-loud, Highlight);
      outline-offset: 1px;
    }
    .tile[aria-pressed='true'] {
      background: var(--wa-color-brand-fill-loud, #006ce0);
      border-color: transparent;
      color: var(--wa-color-brand-on-loud, #fff);
      text-decoration: none;
    }
    .tile:disabled { opacity: 0.5; cursor: not-allowed; }

    .hint {
      font-size: var(--wa-font-size-s, 0.875rem);
      color: var(--wa-color-text-quiet, #666);
      margin-block-start: var(--wa-space-3xs, 0.25rem);
    }
  `;

  constructor() {
    super();
    this.label = '';
    this.hint = '';
    this.placeholder = 'h:mm AM';
    this.name = '';
    this.value = '8:00 AM';
    this.defaultValue = '';
    this.required = false;
    this.disabled = false;
    this.readonly = false;
    this.size = 'm';
    this.appearance = 'outlined';
    this.pill = false;
    this.withClear = false;
    this.open = false;
    this.minuteInterval = DEFAULT_MINUTE_INTERVAL;
    this._showLabel = false;
    this._showHint = false;
    this._customError = '';
    this._uid = `wtgp-${Math.random().toString(36).slice(2, 8)}`;
    try {
      this._internals = this.attachInternals();
    } catch {
      this._internals = null;
    }
  }

  connectedCallback() {
    super.connectedCallback();
    if (this._defaultValue === undefined) {
      this._defaultValue = this.defaultValue || this.value;
    }
    this._syncSlots();
    this._syncForm();
  }

  updated(changed) {
    if (changed.has('open')) {
      if (this.open) {
        document.addEventListener('pointerdown', this._onDocumentPointerDown);
      } else {
        document.removeEventListener('pointerdown', this._onDocumentPointerDown);
      }
    }
    if (changed.has('value') || changed.has('required') || changed.has('name')) {
      this._syncForm();
    }
    if (changed.has('label') || changed.has('hint')) this._syncSlots();
  }

  disconnectedCallback() {
    document.removeEventListener('pointerdown', this._onDocumentPointerDown);
    super.disconnectedCallback();
  }

  // -- public API (mirrors wa-input / wa-dropdown conventions) --

  show() {
    if (this.disabled || this.open) return;
    const ev = new CustomEvent('wa-show', { bubbles: true, composed: true, cancelable: true });
    if (!this.dispatchEvent(ev)) return;
    this.open = true;
    this.dispatchEvent(new CustomEvent('wa-after-show', { bubbles: true, composed: true }));
  }

  hide() {
    if (!this.open) return;
    const ev = new CustomEvent('wa-hide', { bubbles: true, composed: true, cancelable: true });
    if (!this.dispatchEvent(ev)) return;
    this.open = false;
    this.dispatchEvent(new CustomEvent('wa-after-hide', { bubbles: true, composed: true }));
  }

  focus(options) {
    this.shadowRoot?.querySelector('input')?.focus(options);
  }

  blur() {
    this.shadowRoot?.querySelector('input')?.blur();
  }

  setCustomValidity(message) {
    this._customError = message ?? '';
    this._syncForm();
  }

  resetValidity() {
    this._customError = '';
    this._syncForm();
  }

  formResetCallback() {
    this.value = this._defaultValue ?? '';
    this.hide();
    this._syncForm();
  }

  formStateRestoreCallback(state) {
    if (typeof state === 'string') {
      this.value = state;
      this._syncForm();
    }
  }

  get valueAsDate() {
    const p = parseTime(this.value);
    if (!p) return null;
    const d = new Date();
    let h = parseInt(p.hour, 10) % 12;
    if (p.period === 'PM') h += 12;
    d.setHours(h, parseInt(p.minute, 10), 0, 0);
    return d;
  }

  get valueAsNumber() {
    const d = this.valueAsDate;
    return d ? d.getHours() * 3600000 + d.getMinutes() * 60000 : NaN;
  }

  // -- internals --

  _parsed() {
    return parseTime(this.value);
  }

  _syncForm() {
    if (!this._internals) return;
    const p = parseTime(this.value);
    this._internals.setFormValue(p ? formatTime(p) : '');
    if (this._customError) {
      this._internals.setValidity({ customError: true }, this._customError);
    } else if (this.required && !p) {
      this._internals.setValidity({ valueMissing: true }, 'Please select a time.');
    } else {
      this._internals.setValidity({});
    }
  }

  _syncSlots() {
    const labelSlot = this.shadowRoot?.querySelector('slot[name="label"]');
    const hintSlot = this.shadowRoot?.querySelector('slot[name="hint"]');
    this._showLabel = !!this.label || !!labelSlot?.assignedNodes().length;
    this._showHint = !!this.hint || !!hintSlot?.assignedNodes().length;
  }

  _emitInput() {
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  }

  _emitChange() {
    this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }

  _commit(text, { close = false } = {}) {
    if (this.disabled) return;
    const before = this.value;
    this.value = text;
    this._syncForm();
    this._emitInput();
    if (this.value !== before) this._emitChange();
    if (close) this.hide();
  }

  _pickHour(hour, period) {
    if (this.disabled || this.readonly) return;
    const minute = this._parsed()?.minute ?? '00';
    this._commit(`${hour}:${minute} ${period}`);
    // Stay open so a minute tile can follow (matches the Vue example,
    // whose dropdown only closes on mouseleave).
  }

  _pickMinute(minute) {
    if (this.disabled || this.readonly) return;
    const p = this._parsed();
    const hour = p?.hour ?? '8';
    const period = p?.period ?? 'AM';
    this._commit(`${hour}:${minute} ${period}`, { close: true });
    this.focus();
  }

  _onTextInput(e) {
    if (this.disabled || this.readonly) return;
    this.value = e.target.value;
    this._syncForm();
    this._emitInput();
  }

  _onTextCommit() {
    if (this.disabled || this.readonly) return;
    const p = parseTime(this.value);
    // Snap free typing to canonical "h:mm AM" form on commit.
    this._commit(p ? formatTime(p) : this.value, { close: true });
  }

  _onTextKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      this._onTextCommit();
    } else if (e.key === 'Escape' && this.open) {
      e.stopPropagation();
      this.hide();
    } else if (e.key === 'ArrowDown' && (e.altKey || e.metaKey) && !this.open) {
      e.preventDefault();
      this.show();
    }
  }

  _onDocumentPointerDown = (e) => {
    if (!this.open) return;
    if (e.composedPath().includes(this)) return;
    this.hide();
  };

  _clear(e) {
    e.stopPropagation();
    if (this.disabled || this.readonly) return;
    this.value = '';
    this._syncForm();
    this._emitInput();
    this._emitChange();
    this.dispatchEvent(new CustomEvent('wa-clear', { bubbles: true, composed: true }));
    this.focus();
  }

  _hourRows() {
    return [
      { period: 'AM', periodLabel: 'AM', hours: HOURS_ROW_A },
      { period: 'AM', periodLabel: '', hours: HOURS_ROW_B },
      { period: 'PM', periodLabel: 'PM', hours: HOURS_ROW_A },
      { period: 'PM', periodLabel: '', hours: HOURS_ROW_B },
    ];
  }

  _minuteInterval() {
    return normalizeMinuteInterval(this.minuteInterval);
  }

  _minutes() {
    return minuteTiles(this._minuteInterval());
  }

  _minuteCols() {
    return Math.max(1, Math.ceil(this._minutes().length / 4));
  }

  render() {
    const p = this._parsed();
    const gridId = `${this._uid}-grid`;
    const showClear = this.withClear && !!this.value && !this.disabled && !this.readonly;
    const minutes = this._minutes();
    const minuteInterval = this._minuteInterval();
    const minCols = this._minuteCols();
    return html`
      <div part="form-control">
        <div class="label" part="form-control-label" ?hidden=${!this._showLabel}>
          <slot name="label" @slotchange=${this._syncSlots}>${this.label}</slot>
        </div>
        <div class="anchor">
          <div class="field" part="input-wrapper">
            <slot name="start"></slot>
            <input
              part="input"
              .value=${this.value}
              placeholder=${this.placeholder}
              ?disabled=${this.disabled}
              ?readonly=${this.readonly}
              inputmode="numeric"
              autocomplete="off"
              aria-expanded=${this.open ? 'true' : 'false'}
              aria-controls=${gridId}
              @input=${this._onTextInput}
              @change=${this._onTextCommit}
              @keydown=${this._onTextKeydown}
              @click=${() => { if (!this.open) this.show(); }}
            />
            <slot name="end"></slot>
            ${showClear
              ? html`<button
                  type="button"
                  class="icon-btn"
                  part="clear-button"
                  aria-label="Clear time"
                  @click=${this._clear}
                ><slot name="clear-icon"
                  ><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"
                    ><path d="M3 3l10 10M13 3L3 13" /></svg></slot
                ></button>`
              : ''}
            <button
              type="button"
              class="icon-btn"
              part="expand-button"
              aria-label=${this.open ? 'Close time picker' : 'Open time picker'}
              aria-expanded=${this.open ? 'true' : 'false'}
              aria-controls=${gridId}
              ?disabled=${this.disabled}
              @click=${() => (this.open ? this.hide() : this.show())}
            ><slot name="expand-icon"
              ><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"
                ><circle cx="8" cy="8" r="6.2" /><path d="M8 4.5V8l2.5 1.5" /></svg></slot
            ></button>
          </div>
          <div class="popup" part="popup" role="dialog" aria-label="Choose a time" style=${`--min-cols:${minCols}`}>
            <div class="grid" part="grid" role="group" aria-label=${`Hours and minutes, every ${minuteInterval} minutes`} id=${gridId}>
              <span class="grid-header hour" part="grid-header">Hour</span>
              <span class="grid-header min-col" part="grid-header">Min</span>
              ${this._hourRows().map(
                (row) => html`
                  <span class="period" part="period-label">${row.periodLabel}</span>
                  ${row.hours.map((h) => {
                    const selected = !!p && p.hour === h && p.period === row.period;
                    return html`<button
                      type="button"
                      class="tile"
                      part="tile${selected ? ' tile-selected' : ''}"
                      aria-pressed=${selected ? 'true' : 'false'}
                      aria-label=${`${h} ${row.period}`}
                      ?disabled=${this.disabled}
                      @click=${() => this._pickHour(h, row.period)}
                    >${padHour(h)}</button>`;
                  })}
                `
              )}
              <div class="minutes" part="minutes">
                ${minutes.map((mm) => {
                  const selected = !!p && p.minute === mm;
                  return html`<button
                    type="button"
                    class="tile min-col"
                    part="tile${selected ? ' tile-selected' : ''}"
                    aria-pressed=${selected ? 'true' : 'false'}
                    aria-label=${`:${mm}`}
                    ?disabled=${this.disabled}
                    @click=${() => this._pickMinute(mm)}
                  >${mm}</button>`;
                })}
              </div>
            </div>
          </div>
        </div>
        <div class="hint" part="hint" ?hidden=${!this._showHint}>
          <slot name="hint" @slotchange=${this._syncSlots}>${this.hint}</slot>
        </div>
      </div>
    `;
  }
}

customElements.define('wa-time-grid-input', WaTimeGridInput);
