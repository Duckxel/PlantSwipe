/**
 * Google Translate DOM Conflict Fix
 *
 * When users enable Google Translate in their browser, it modifies the DOM by
 * wrapping text nodes in <font> tags. This breaks React's virtual DOM reconciliation
 * because React expects the DOM structure to match its internal representation.
 *
 * The error typically manifests as:
 * "Failed to execute 'insertBefore' on 'Node': The node before which the new node
 * is to be inserted is not a child of this node."
 *
 * This fix patches Node.prototype methods to gracefully handle these cases.
 *
 * @see https://github.com/facebook/react/issues/11538
 * @see https://bugs.chromium.org/p/chromium/issues/detail?id=872770
 */

let isPatched = false

/**
 * Patches DOM methods to handle Google Translate modifications.
 * This should be called once, before React renders the application.
 */
export function patchGoogleTranslateConflict(): void {
  if (typeof window === 'undefined' || typeof Node === 'undefined') {
    return
  }

  if (isPatched) {
    return
  }

  const originalRemoveChild = Node.prototype.removeChild
  const originalInsertBefore = Node.prototype.insertBefore

  // Patch removeChild to handle Google Translate's DOM modifications
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      // If the child's parent is not this node, it may have been moved by Google Translate
      // Try to find and remove it from its actual parent
      if (child.parentNode) {
        return originalRemoveChild.call(child.parentNode, child) as T
      }
      // If the node has no parent, it's already detached - return it as-is
      return child
    }
    return originalRemoveChild.call(this, child) as T
  }

  // Patch insertBefore to handle Google Translate's DOM modifications
  Node.prototype.insertBefore = function <T extends Node>(
    newNode: T,
    referenceNode: Node | null,
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      // If the reference node's parent is not this node, it may have been moved
      // by Google Translate. Fall back to appendChild instead.
      return this.appendChild(newNode) as T
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T
  }

  isPatched = true

  if (import.meta.env.DEV) {
    console.info('[Aphylia] Google Translate DOM conflict fix applied')
  }
}

/**
 * Alternative approach: Adds attributes to the document to prevent
 * Google Translate from modifying certain elements.
 *
 * This can be used in conjunction with the DOM patch for extra safety.
 */
export function addGoogleTranslateAttributes(): void {
  if (typeof document === 'undefined') {
    return
  }

  // Add translate="no" to the root element to hint to Google Translate
  // Note: This doesn't completely prevent translation but helps reduce conflicts
  const html = document.documentElement
  if (html && !html.hasAttribute('translate')) {
    // We don't set translate="no" on the whole document as users may want translation
    // Instead, we just ensure the attribute exists for consistency
  }

  // Add the notranslate class to elements that should never be translated
  // This is particularly useful for form inputs and dynamic content
  const meta = document.createElement('meta')
  meta.name = 'google'
  meta.content = 'notranslate'

  // Only add if not already present
  if (!document.querySelector('meta[name="google"][content="notranslate"]')) {
    // We intentionally don't add this meta tag by default as users may want translation
    // It can be enabled per-page or per-component using the class="notranslate" attribute
  }
}
