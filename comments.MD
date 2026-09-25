
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

