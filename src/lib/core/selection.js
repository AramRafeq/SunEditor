'use strict';

import util from '../util';

function Selection(root) {
	this.$el = root.context.element;
	this.$options = root.context.options;
	this._ww = root._ww;
	this._wd = root._wd;
	this._variable = root._variable;
	this._shadowRoot = root._shadowRoot;
	this._fileManager = root._fileManager;
}

Object.defineProperties(Selection.prototype, {
	/**
	 * @description Focus to wysiwyg area using "native focus function"
	 */
	nativeFocus: {
		value: function() {
			const caption = util.getParentElement(this.getSelectionNode(), 'figcaption');
			if (caption) {
				caption.focus();
			} else {
				this.$el.wysiwyg.focus();
			}

			this._editorRange();
		},
		enumerable: true
	},

	/**
	 * @description Focus to wysiwyg area
	 */
	focus: {
		value: function() {
			if (this.$el.wysiwygFrame.style.display === 'none') return;

			if (this.$options.iframe) {
				this.nativeFocus();
			} else {
				try {
					const range = this.getRange();

					if (range.startContainer === range.endContainer && util.isWysiwygDiv(range.startContainer)) {
						const format = util.createElement('P');
						const br = util.createElement('BR');
						format.appendChild(br);
						this.$el.wysiwyg.appendChild(format);
						this.setRange(br, 0, br, 0);
					} else {
						this.setRange(range.startContainer, range.startOffset, range.endContainer, range.endOffset);
					}
				} catch (e) {
					this.nativeFocus();
				}
			}

			event._applyTagEffects();
			if (this._isBalloon) event._toggleToolbarBalloon();
		},
		enumerable: true
	},

	/**
	 * @description If "focusEl" is a component, then that component is selected; if it is a format element, the last text is selected
	 * If "focusEdge" is null, then selected last element
	 * @param {Element|null} focusEl Focus element
	 */
	focusEdge: {
		value: function(focusEl) {
			if (!focusEl) focusEl = this.$el.wysiwyg.lastElementChild;

			const fileComponentInfo = this.getFileComponent(focusEl);
			if (fileComponentInfo) {
				this.selectComponent(fileComponentInfo.target, fileComponentInfo.pluginName);
			} else if (focusEl) {
				focusEl = util.getChildElement(
					focusEl,
					function(current) {
						return current.childNodes.length === 0 || current.nodeType === 3;
					},
					true
				);
				if (!focusEl) this.nativeFocus();
				else this.setRange(focusEl, focusEl.textContent.length, focusEl, focusEl.textContent.length);
			} else {
				this.focus();
			}
		},
		enumerable: true
	},

	/**
	 * @description Set current editor's range object
	 * @param {Node} startCon The startContainer property of the selection object.
	 * @param {Number} startOff The startOffset property of the selection object.
	 * @param {Node} endCon The endContainer property of the selection object.
	 * @param {Number} endOff The endOffset property of the selection object.
	 */
	setRange: {
		value: function(startCon, startOff, endCon, endOff) {
			if (!startCon || !endCon) return;
			if (startOff > startCon.textContent.length) startOff = startCon.textContent.length;
			if (endOff > endCon.textContent.length) endOff = endCon.textContent.length;

			const range = this._wd.createRange();

			try {
				range.setStart(startCon, startOff);
				range.setEnd(endCon, endOff);
			} catch (error) {
				console.warn('[SUNEDITOR.core.focus.error] ' + error);
				this.nativeFocus();
				return;
			}

			const selection = this.getSelection();

			if (selection.removeAllRanges) {
				selection.removeAllRanges();
			}

			selection.addRange(range);
			this._editorRange();
			if (this.$options.iframe) this.nativeFocus();
		},
		enumerable: true
	},

	/**
	 * @description Remove range object and button effect
	 */
	removeRange: {
		value: function() {
			this._variable._range = null;
			this._variable._selectionNode = null;
			this.getSelection().removeAllRanges();

			const commandMap = this.commandMap;
			const activePlugins = this.activePlugins;
			for (let key in commandMap) {
				if (!util.hasOwn(commandMap, key)) continue;
				if (activePlugins.indexOf(key) > -1) {
					plugins[key].active.call(this, null);
				} else if (commandMap.OUTDENT && /^OUTDENT$/i.test(key)) {
					commandMap.OUTDENT.setAttribute('disabled', true);
				} else if (commandMap.INDENT && /^INDENT$/i.test(key)) {
					commandMap.INDENT.removeAttribute('disabled');
				} else {
					util.removeClass(commandMap[key], 'active');
				}
			}
		},
		enumerable: true
	},

	/**
	 * @description Get current editor's range object
	 * @returns {Object}
	 */
	getRange: {
		value: function() {
			return this._variable._range || this._createDefaultRange();
		},
		enumerable: true
	},

	/**
	 * @description If the "range" object is a non-editable area, add a line at the top of the editor and update the "range" object.
	 * Returns a new "range" or argument "range".
	 * @param {Object} range core.getRange()
	 * @returns {Object} range
	 */
	getRange_addLine: {
		value: function(range) {
			if (this._selectionVoid(range)) {
				const wysiwyg = this.$el.wysiwyg;
				const op = util.createElement('P');
				op.innerHTML = '<br>';
				wysiwyg.insertBefore(op, wysiwyg.firstElementChild);
				this.setRange(op.firstElementChild, 0, op.firstElementChild, 1);
				range = this._variable._range;
			}
			return range;
		},
		enumerable: true
	},

	/**
	 * @description Get window selection obejct
	 * @returns {Object}
	 */
	getSelection: {
		value: function() {
			return this._shadowRoot && this._shadowRoot.getSelection ? this._shadowRoot.getSelection() : this._ww.getSelection();
		},
		enumerable: true
	},

	/**
	 * @description Get current select node
	 * @returns {Node}
	 */
	getSelectionNode: {
		value: function() {
			if (util.isWysiwygDiv(this._variable._selectionNode)) this._editorRange();
			if (!this._variable._selectionNode) {
				const selectionNode = util.getChildElement(
					this.$el.wysiwyg.firstChild,
					function(current) {
						return current.childNodes.length === 0 || current.nodeType === 3;
					},
					false
				);
				if (!selectionNode) {
					this._editorRange();
				} else {
					this._variable._selectionNode = selectionNode;
					return selectionNode;
				}
			}
			return this._variable._selectionNode;
		},
		enumerable: true
	},

	/**
	 * @description Saving the range object and the currently selected node of editor
	 * @private
	 */
	_editorRange: {
		value: function() {
			const selection = this.getSelection();
			if (!selection) return null;
			let range = null;
			let selectionNode = null;

			if (selection.rangeCount > 0) {
				range = selection.getRangeAt(0);
			} else {
				range = this._createDefaultRange();
			}

			this._variable._range = range;

			if (range.collapsed) {
				selectionNode = range.commonAncestorContainer;
			} else {
				selectionNode = selection.extentNode || selection.anchorNode;
			}

			this._variable._selectionNode = selectionNode;
		},
		enumerable: true
	},

	/**
	 * @description Return the range object of editor's first child node
	 * @returns {Object}
	 * @private
	 */
	_createDefaultRange: {
		value: function() {
			const wysiwyg = this.$el.wysiwyg;
			wysiwyg.focus();
			const range = this._wd.createRange();

			let focusEl = wysiwyg.firstElementChild;
			if (!focusEl) {
				focusEl = util.createElement('P');
				focusEl.innerHTML = '<br>';
				wysiwyg.appendChild(focusEl);
			}

			range.setStart(focusEl, 0);
			range.setEnd(focusEl, 0);

			return range;
		},
		enumerable: true
	},

	/**
	 * @description Returns true if there is no valid "selection".
	 * @param {Object} range core.getRange()
	 * @returns {Object} range
	 * @private
	 */
	_selectionVoid: {
		value: function(range) {
			const comm = range.commonAncestorContainer;
			return (
				(util.isWysiwygDiv(range.startContainer) && util.isWysiwygDiv(range.endContainer)) ||
				/FIGURE/i.test(comm.nodeName) ||
				this._fileManager.regExp.test(comm.nodeName) ||
				util.isMediaComponent(comm)
			);
		},
		enumerable: true
	}
});

export default Selection;
