// (c) Infocatcher 2009-2013
// version 0.4.0a6 - 2013-06-03

// https://github.com/Infocatcher/BBCode_Editor

// Dependencies:
//   eventListener object - eventListener.js

// Usage:
//	var editor = new Editor("textareaId"[, optionsObject]);
//	editor.tag(event, 'b');

function Editor(ta, options) {
	ta = this.ta = this.inputField = this.$(ta);

	if(options)
		for(var p in options) if(options.hasOwnProperty(p))
			this[p] = options[p];
	if(this.language === undefined)
		this.language = this.detectLanguage();
	this.root = this.$(this.root) || document.body || document.documentElement;
	this.we = new WysiwygEditor(ta, this);
	this._onWysiwygToggle();
	this.initBackups();

	ta.__editor = this;
	eventListener.add(window, "unload", function() {
		eventListener.remove(window, "unload", arguments.callee);
		this.lastBackup();
		this.we.destroy();
		ta.__editor = this.we = this.ta = this.inputField = this.root = null;
	}, this);
}
Editor.prototype = {
	//== Settings begin
	language: undefined,
	isVisual: true, // Initial mode
	selectInserted: false,
	smileys: {},
	attrComma: "", // Empty string or '"'
	validURIMask: /^(\w+:\/+[^\s\/\\'"?&#]+(\/\S*)?|\w+:[^\s\/\\'"?&#]+)$/,
	onlyTagsMask: /^\[(\w+)([^\[\]]+)?\](\[\/\1\])$/,
	onlyTagsCloseTagNum: 3, // Number of brackets with ([/tag])
	onWysiwygNA: function() {},
	onWysiwygToggle: function() {},
	allowSizeUnits: false,
	preMode: undefined, // WYSIWYG
	shortifyColors: true, // #ffcc00 -> #fc0
	root: null, // Root node to set editor-noWysiwyg/editor-mode-plain/editor-mode-wysiwyg class
	backupEnabled: true,
	backupInterval: 15e3, // Delay between autobackups or -1 to disable
	backupExpire: 24*60*60e3, // Don't use (and remove) older backups
	//== Settings end

	strings: {
		"Link:": {
			ru: "Ссылка:"
		},
		"Link to image:": {
			ru: "Ссылка на изображение:"
		},
		"Link description (you can leave this field empty):": {
			ru: "Описание ссылки (можно оставить поле пустым):"
		},
		"Quote author (you can leave this field empty):": {
			ru: "Автор цитаты (можно оставить поле пустым):"
		},
		"image: ": {
			ru: "изображение: "
		}
	},
	_localize: function(s) {
		return this.strings[s] && this.strings[s][this.language] || s;
	},
	detectLanguage: function() {
		var lng = navigator.language || navigator.browserLanguage || "";
		if(
			/^ru/i.test(lng) // browser language
			|| !lng && /\sянвар[ья]\s/i.test(new Date(0).toLocaleString()) // or russian letters in date
		)
			return "ru";
		return "en";
	},

	//== API begin
	insert: function(invertSelect, text) {
		this.setInvertSelected(invertSelect);
		if(this.isVisual) {
			this.we.insertText(text);
			return;
		}
		this._insert(text);
	},
	tag: function(invertSelect, tag, attr, text) {
		this.setInvertSelected(invertSelect);
		if(this.isVisual) {
			this.we.insertTag(tag, attr);
			return;
		}
		this._tag(tag, attr, text);
	},
	urlTag: function(invertSelect) {
		this.setInvertSelected(invertSelect);
		var sel = this.getSel();
		if(this.isVisual) {
			var u = this.trim(sel);
			if(!this.isValidURI(u)) {
				var a = this.we.getNodeFromSelection("a");
				u = a && a.href || this.we.getUrlFromSelection() || "http://";
				u = prompt(this._localize("Link:"), u);
				if(a && u && !sel)
					this.we.selectNodeContents(a);
			}
			u && this.we.insertTag("url", u);
			return;
		}
		if(this.uriTagFromSel("url", sel))
			return;
		var u = prompt(this._localize("Link:"), "http://");
		if(u && sel)
			this._tag("url", u);
		else if(u != null)
			this._tag("url", false, u);
	},
	removeUrlTag: function(invertSelect) {
		if(!this.isVisual || !this.we.editorFocused())
			return;
		this.setInvertSelected(invertSelect);
		var a = !this.getSel() && this.we.getNodeFromSelection("a");
		a && this.we.selectNodeContents(a);
		//~ todo: wrong caret position after insert
		this.we.execCommand("unLink");
	},
	imgTag: function(invertSelect) {
		this.setInvertSelected(invertSelect);
		if(this.isVisual) {
			var u = this.trim(this.getSel());
			if(!this.isValidURI(u))
				u = prompt(this._localize("Link to image:"), "http://");
			u && this.we.insertImage(u);
			return;
		}
		if(this.uriTagFromSel("img"))
			return;
		var u = prompt(this._localize("Link to image:"), "http://");
		u && this._tag("img", false, u);
	},
	smile: function(invertSelect, alt, src) {
		this.setInvertSelected(invertSelect);
		if(this.isVisual)
			this.we.insertSmile(alt, src);
		else
			this._insert(alt);
	},
	quoteTag: function(invertSelect) {
		this.setInvertSelected(invertSelect);
		var author = prompt(this._localize("Quote author (you can leave this field empty):"), "");
		if(author == null)
			return;
		var origComma = this.attrComma;
		if(/\[|\]/.test(author)) {
			var comma = origComma;
			if(author.indexOf("'") != -1)
				comma = '"';
			else if(author.indexOf('"') != -1)
				comma = "'";
			else if(!comma)
				comma = '"';
			this.attrComma = comma;
		}
		else if(/^".*"$/.test(author))
			this.attrComma = "'";
		else if(/^'.*'$/.test(author))
			this.attrComma = '"';
		if(this.isVisual)
			this.we.insertRawTag("quote", author);
		else
			this._tag("quote", author);
		this.attrComma = origComma;
	},
	toggle: function(visualMode) {
		if(visualMode != undefined && visualMode == this.isVisual)
			return;
		this.we.toggle();
		this._onWysiwygToggle();
	},
	restoreBackup: function() {
		this.restoreFromBackup();
		this.clearBackupData();
		this.focus();
	},
	clearBackup: function() {
		this.clearBackupData();
		this.focus();
	},
	focus: function() {
		if(this.isVisual)
			this.we.focus();
		else
			this.ta.focus();
	},
	//== API end

	_onWysiwygToggle: function() {
		var root = this.root;
		var isVisual = this.isVisual;
		this.setClass(root, "editor-mode-plain", !isVisual);
		this.setClass(root, "editor-mode-wysiwyg", isVisual);
		this.onWysiwygToggle(isVisual);
	},
	_onWysiwygNA: function() {
		this._onWysiwygToggle();
		var root = this.root;
		this.addClass(root, "editor-noWysiwyg");
		this.onWysiwygNA();
	},

	$: function(id) {
		if(typeof id == "string")
			return document.getElementById(id) || document.getElementsByName(id)[0];
		return id;
	},
	getSel: function() {
		var ta = this.ta;
		if(document.selection && document.selection.createRange)
			return document.selection && document.selection.createRange().text || "";
		return String(
			window.getSelection && window.getSelection()
			|| document.getSelection && document.getSelection()
		)
		|| !this.isVisual && ta.value.substring(ta.selectionStart, ta.selectionEnd)
		|| "";
	},
	setInvertSelected: function(e) {
		if(e === undefined)
			e = window.event;
		this.invertSelect = e && typeof e == "object"
			? e.ctrlKey || e.shiftKey || e.altKey || e.metaKey
			: e;
	},
	getSelectInserted: function(invertSelect) {
		var si = this.selectInserted;
		if(this.invertSelect) {
			this.invertSelect = false;
			si = !si;
		}
		return si;
	},
	_tag: function(tag, attr, text, start, end) {
		this._insert(
			(start || "")
			+ "[" + tag + (attr ? "=" + this.attrComma + attr + this.attrComma : "") + "]"
			+ (text || this.getSel())
			+ "[/" + tag + "]"
			+ (end || "")
		);
	},
	_insert: function(text) {
		var ta = this.ta;
		ta.focus();
		var onlyTagsShift = this.onlyTagsMask.test(text) ? RegExp["$" + this.onlyTagsCloseTagNum].length : 0;
		try { // Google Chrome
			if(document.queryCommandEnabled("insertText")) {
				var ss = ta.selectionStart;
				var se = ss + text.length - onlyTagsShift;
				var v = ta.value;
				document.execCommand("insertText", false, text);
				if(ta.value == v)
					throw "not changed";
				ta.selectionStart = this.getSelectInserted() && !onlyTagsShift ? ss : se;
				ta.selectionEnd = se;
				return;
			}
		}
		catch(e) {
		}

		if(typeof ta.selectionStart == "number") {
			var sTop = ta.scrollTop;
			var sHeight = ta.scrollHeight;
			var sLeft = ta.scrollLeft;
			//var sWidth = ta.scrollWidth;

			var ss = ta.selectionStart;
			var val = ta.value;
			ta.value = val.substring(0, ss) + text + val.substring(ta.selectionEnd, val.length);
			var se = ss + text.length - onlyTagsShift;
			ta.selectionStart = this.getSelectInserted() && !onlyTagsShift ? ss : se;
			ta.selectionEnd = se;

			ta.scrollTop = sTop + (ta.scrollHeight - sHeight);
			ta.scrollLeft = sLeft; // + (ta.scrollWidth - sWidth);
		}
		else if(document.selection) { // IE
			var r = document.selection.createRange();
			r.text = text;
			if(onlyTagsShift)
				r.moveEnd("character", -onlyTagsShift);
			else if(this.getSelectInserted())
				r.moveStart("character", -text.replace(/\r\n/g, "\n").length);
			r.select();
		}
		else {
			ta.value += text;
		}
	},
	uriTagFromSel: function(tag, sel) {
		sel = this.getSel();
		var u = this.trim(sel);
		if(!this.isValidURI(u))
			return false;
		var desc = prompt(this._localize("Link description (you can leave this field empty):"), "");
		if(desc == null)
			return true;
		this._tag(
			tag || "url",
			desc && u,
			desc || u,
			/^(\s+)/.test(sel) ? RegExp.$1 : "",
			/(\s+)$/.test(sel) ? RegExp.$1 : ""
		);
		return true;
	},

	storage: null,
	_backupTimer: 0,
	_savedData: "",
	initBackups: function() {
		this.addClass(this.root, "editor-noBackup");
		if(!this.backupEnabled)
			return;
		if("localStorage" in window) try {
			this.storage = localStorage;
		}
		catch(e) {
		}
		if(!this.storage)
			return;
		var key = location.pathname.replace(/[^\/]+$/, "") // foo/index.php -> foo/
			+ "#" + (this.ta.id || this.ta.name);
		this.backupKey = "editor:backup" + key;
		this.backupTimeKey = "editor:backupTime" + key;
		var _this = this;
		if(this.backupInterval > 0) {
			this._backupTimer = setInterval(function() {
				_this.backup();
			}, this.backupInterval);
		}
		setTimeout(function() { // Pseudo async (accessing storage may be slow)
			_this.showBackupControls();
		}, 0);
	},
	showBackupControls: function() {
		var data = this.getBackupData();
		if(
			data && !(
				this.isVisual // Restored by browser itself?
					? this.ww.hasChildNodes()
					: this.ta.value
			)
		)
			this.removeClass(this.root, "editor-noBackup");
	},
	lastBackup: function() {
		if(!this.storage)
			return;
		clearInterval(this._backupTimer);
		this.backup();
		this.storage = null;
	},
	backup: function() {
		var data = this.isVisual
			? "html:" + this.ww.innerHTML
			: "text:" + this.ta.value;
		if(data != this._savedData && data.length > 5) {
			this._savedData = data;
			this.storage.setItem(this.backupKey, data);
			this.storage.setItem(this.backupTimeKey, new Date().getTime());
		}
	},
	getBackupData: function() {
		if(!this.storage)
			return "";
		var time = this.storage.getItem(this.backupTimeKey);
		if(!time)
			return "";
		if(new Date().getTime() - time > this.backupExpire) { // Too old
			this.clearBackupData();
			return "";
		}
		var data = this.storage.getItem(this.backupKey);
		if(!data || data.length <= 5)
			return "";
		return data;
	},
	clearBackupData: function() {
		if(!this.storage)
			return;
		this.storage.removeItem(this.backupTimeKey);
		this.storage.removeItem(this.backupKey);
		this.addClass(this.root, "editor-noBackup");
	},
	restoreFromBackup: function() {
		var data = this.getBackupData();
		if(!data)
			return;
		var isHtml = data.substr(0, 5) == "html:";
		data = data.substr(5);
		this.toggle(isHtml);
		if(isHtml)
			this.ww.innerHTML = data;
		else
			this.ta.value = data;
	},

	isValidURI: function(uri) {
		return this.validURIMask.test(uri);
	},
	trim: function(s) {
		return s.replace(/^\s+|\s+$/g, "");
	},
	addClass: function(elt, clss) {
		if("classList" in elt) {
			elt.classList.add(clss);
			return;
		}
		this.removeClass(elt, clss);
		elt.className = (elt.className + " " + clss).replace(/^\s+/, "");
	},
	removeClass: function(elt, clss) {
		if("classList" in elt) {
			elt.classList.remove(clss);
			return;
		}
		elt.className = elt.className
			.replace(new RegExp("(^|\\s+)" + clss + "(\\s+|$)"), " ")
			.replace(/^\s+|\s+$/g, "");
	},
	setClass: function(elt, clss, add) {
		this[add ? "addClass" : "removeClass"](elt, clss);
	}
};

function WysiwygEditor(ta, editor) {
	this.ta = ta;
	this.__editor = editor;
	this.ww = editor.ww = ta.nextSibling;
	this.init(editor);
}
WysiwygEditor.prototype = {
	active: false,
	init: function(editor) {
		this.available = "execCommand" in document && this.ww.contentEditable == "true";
		if(!this.available) {
			editor.isVisual = false;
			editor._onWysiwygNA();
			this.destroyRefs();
			return;
		}

		var preMode = editor.preMode;
		this.preMode = preMode === undefined
			? /(^|-)pre(-|$)/.test(this.getStyles(this.ww, "whiteSpace"))
			: !!preMode;
		this.shortifyColors = editor.shortifyColors;
		if(editor.isVisual)
			this.toggle();

		if("onresizestart" in this.ww) // IE
			this.ww.onresizestart = function() { return false; };

		var fh = this.focusHandler;
		eventListener.add(window,   "focus",     fh, this, true);
		eventListener.add(document, "mousedown", fh, this, true);
		eventListener.add(document, "click",     fh, this, true);
	},
	destroy: function() {
		var fh = this.focusHandler;
		eventListener.remove(window,   "focus",     fh, true);
		eventListener.remove(document, "mousedown", fh, true);
		eventListener.remove(document, "click",     fh, true);
		if(this.active)
			this.ta.value = this.getBBCode(); // Fails sometimes ?
		this.destroyRefs();
	},
	destroyRefs: function() {
		this.__editor = this.__editor.ww = this.ta = this.ww = null;
	},
	_smileysInitialized: false,
	initSmileys: function() {
		if(this._smileysInitialized)
			return;
		this._smileysInitialized = true;
		var sml = this.smileys = {};
		var smileys = this.__editor.smileys;

		var resolver = document.createElement("a");
		function resolve(url) {
			resolver.href = url;
			return resolver.href;
		}
		resolver.href = "test";
		if(resolver.href == "test") { // Old IE
			resolver = new Image(); // All images should be already loaded, so no additional traffic
			resolve = function(url) {
				resolver.src = url;
				return resolver.src;
			};
		}

		for(var src in smileys) if(smileys.hasOwnProperty(src))
			sml[resolve(src)] = smileys[src];
	},
	_firstToggle: true,
	toggle: function() {
		if(!this.available)
			return;
		var wwMode = !this.active;
		var show = wwMode ? this.ww : this.ta;
		var hide = wwMode ? this.ta : this.ww;
		var s = this.getStyles(hide);
		show.style.width  = s.width;
		show.style.height = s.height;

		// Hack for Firefox <= 13.0
		// With sibling <div contenteditable="true"> double click in textarea doesn't select word
		if(
			/Firefox\/(\d+\.\d+)/.test(navigator.userAgent)
			&& RegExp.$1 <= 13
		) {
			if(wwMode)
				this.ta.parentNode.insertBefore(this.ww, this.ta.nextSibling);
			else
				this.ta.parentNode.removeChild(this.ww);
		}

		show.style.display = "";
		hide.style.display = "none";
		this.active = this.__editor.isVisual = wwMode;
		this.__editor.inputField = show;

		if(wwMode) {
			this.focus();
			var newHTML = this.getHTML();
			if(!this.compareHTML(show.innerHTML, newHTML)) {
				try {
					this.selectNodeContents(show);
					this.insertHTML(newHTML, false);
					if(newHTML && !show.innerHTML)
						throw "empty";
				}
				catch(e) {
					if(e != "empty")
						setTimeout(function() { throw e; }, 0);
					var fallback = true;
				}
				if(this._firstToggle || fallback)
					show.innerHTML = newHTML;
				this._firstToggle = false;
			}

			try {
				document.execCommand("enableObjectResizing", false, false);
			}
			catch(e) {
			}
			// Firefox bug (?)
			// Without this we can get inline styles for <div contenteditable="true">
			// And styles like <div contenteditable="true" style="... font-weight: bold;">
			// can't be removed using "removeformat" command.
			//~ todo: "useCSS" for old versions?
			try {
				document.execCommand("styleWithCSS", false, false);
			}
			catch(e) {
			}
		}
		else {
			this.ta.focus();
			var v = this.getBBCode();
			if(show.value != v)
				show.value = v;
		}
	},
	compareHTML: function(oldHTML, newHTML) {
		oldHTML = oldHTML
			.replace(/<\/?\w+/g, function(s) {
				return s.toLowerCase();
			})
			.replace(/<br\s*\/?>/g, "<br/>")
			.replace(/<(\/)?b>/g, "<$1strong>")
			.replace(/<(\/)?i>/g, "<$1em>")
			.replace(/<(\/)?u>/g, "<$1ins>")
			.replace(/<(\/)?s(trike)?>/g, "<$1del>");
		if(!this.preMode) {
			var removeSpaces = function(s) {
				return s
					.replace(/[\n\r\t ]+/g, " ")
					.replace(/(^|<br\/>)[ \t]+/g, "$1");
			};
			oldHTML = removeSpaces(oldHTML);
			newHTML = removeSpaces(newHTML);
		}
		return oldHTML == newHTML;
	},
	getFocusedNode: function(e) {
		if("activeElement" in document)
			return document.activeElement;
		if("querySelector" in document)
			return document.querySelector(":focus");
		if(e) {
			var trg = e.target;
			if(e.type == "focus")
				return trg.ownerDocument && trg;
			for(var node = trg; node; node = node.parentNode) {
				if(node.contentEditable == "true")
					return node;
				switch(node.nodeName.toLowerCase()) {
					case "a":
					case "input":
					case "button":
					case "select":
					case "textarea":
					case "iframe":
					case "frame":
					case "body":
					case "html":
						return node;
				}
			}
		}
		setTimeout(function() {
			throw new Error("WysiwygEditor: Can't get focused node!");
		}, 0);
		return null;
	},
	insertTag: function(tag, arg) {
		if(!this.editorFocused())
			return;
		var cmd;
		switch(tag) {
			case "b":      cmd = "bold";                 break;
			case "i":      cmd = "italic";               break;
			case "u":      cmd = "underline";            break;
			case "s":      cmd = "strikeThrough";        break;
			case "font":   cmd = "fontName";             break;
			case "size":   cmd = "fontSize";             break;
			case "color":  cmd = "foreColor";            break;
			case "hr":     cmd = "insertHorizontalRule"; break;
			case "img":    cmd = "insertImage";          break;
			case "url":    cmd = "createlink";           break;
			case "center": cmd = "justifyCenter";        break;
			case "left":   cmd = "justifyLeft";          break;
			case "right":  cmd = "justifyRight";         break;
			case "sub":    cmd = "subscript";            break;
			case "sup":    cmd = "superscript";          break;
			case "pre":
				this.toggleBlockTag(tag);
				return;
		}
		this.execCommand(cmd, arg);
	},
	execCommand: function(cmd, arg) {
		document.execCommand(cmd, false, arg || null);
		this.focus();
		this.select();
	},
	toggleBlockTag: function(tag) {
		this.removeTag(tag) || this.execCommand("formatBlock", "<" + tag + ">");
	},
	getRange: function() {
		var sel = window.getSelection && window.getSelection()
			|| document.getSelection && document.getSelection();
		return sel && sel.getRangeAt(0)
			|| document.selection && document.selection.createRange();
	},
	getNodeFromSelection: function(tagOrChecker) {
		var checker = typeof tagOrChecker == "function"
			? tagOrChecker
			: function(node) {
				return node.nodeName.toLowerCase() == tagOrChecker;
			};
		this.focus();
		var rng = this.getRange();
		if(!rng)
			return null;
		for(
			var node = rng.commonAncestorContainer || rng.parentElement();
			node && node != this.ww;
			node = node.parentNode
		) {
			if(checker(node))
				return node;
		}
		return null;
	},
	getUrlFromSelection: function() {
		this.focus();
		var rng = this.getRange();
		if(!rng)
			return "";
		var tmp = document.createElement("div");
		if(rng.cloneContents)
			tmp.appendChild(rng.cloneContents());
		else
			tmp.innerHTML = rng.htmlText;
		var links = tmp.getElementsByTagName("a");
		return links.length && links[0].href || "";
	},
	removeTag: function(tagOrChecker) {
		var node = this.getNodeFromSelection(tagOrChecker);
		if(!node)
			return false;
		var p = node.parentNode;
		while(node.hasChildNodes())
			p.insertBefore(node.firstChild, node);
		if(this.getStyles(node).display == "block")
			p.insertBefore(document.createElement("br"), node);
		p.removeChild(node);
		return true;
	},
	insertRawTag: function(tag, attr, html) {
		this.focus();
		if(!html)
			html = this.getSelectionHTML();
		var onlyTags = !html;
		var closeTag = this.encodeHTML("[/" + tag + "]");
		this.insertHTML(
			this.encodeHTML(
				"[" + tag
				+ (attr ? "=" + this.__editor.attrComma + attr + this.__editor.attrComma : "")
				+ "]"
			)
			+ html + closeTag,
			onlyTags ? true : undefined, // We should enable selectInserted for old IE versions
			onlyTags && closeTag.length
		);
	},
	focus: function() {
		var ww = this.ww;
		if(!ww.focus)
			return;
		if(!window.opera || this._firstToggle) {
			ww.focus();
			return;
		}
		try { // Try restore selection in Opera
			var sel = window.getSelection();
			var rng = sel.getRangeAt(0);
			ww.focus();
			for(var p = rng.commonAncestorContainer; p; p = p.parentNode) {
				if(p == ww) {
					sel.addRange(rng);
					break;
				}
			}
		}
		catch(e) {
			setTimeout(function() { throw e; }, 0);
		}
	},
	select: function() {
		if(this.__editor.getSelectInserted())
			return;
		var sel = window.getSelection && window.getSelection()
			|| document.getSelection && document.getSelection();
		if(sel)
			sel.collapseToEnd();
		else {
			var r = document.selection.createRange();
			r.collapse(false);
			r.select();
		}
	},
	insertHTML: function(html, selectInserted, onlyTagsShift) {
		if(!this.editorFocused())
			return;

		if(selectInserted === undefined)
			selectInserted = this.__editor.getSelectInserted();
		var id = "_wysiwygInsPoint_" + new Date().getTime() + "_" + Math.random().toString().substr(2);
		html = onlyTagsShift
			? html.slice(0, -onlyTagsShift) + '<span id="' + id + '"></span>' + html.slice(-onlyTagsShift)
			: '<span id="' + id + '">' + html + "</span>";

		try {
			if(!document.queryCommandEnabled("insertHTML"))
				return;
			document.execCommand("insertHTML", false, html);
		}
		catch(e) {
			if(document.selection && document.selection.createRange) {
				var r = document.selection.createRange();
				r.pasteHTML(html); //~ todo: this doesn't close tags opened before selection
			}
		}
		this.selectNodeContents(document.getElementById(id), !selectInserted);
		this.focus();
	},
	insertText: function(str) {
		this.insertHTML(this.encodeHTML(str));
	},
	selectNodeContents: function(node, collapse) {
		var sel = window.getSelection && window.getSelection()
			|| document.getSelection && document.getSelection();
		if(sel) {
			var r = document.createRange();
			r.selectNodeContents(node);
			if(collapse)
				r.collapse(false);
			sel.removeAllRanges();
			sel.addRange(r);
			return;
		}
		var r = document.selection.createRange();
		r = r.duplicate();
		r.moveToElementText(node);
		if(collapse)
			r.moveStart("textedit", -1);
		r.select();
	},
	removeFormatting: function() {
		if(!this.editorFocused())
			return;
		this.execCommand("removeFormat");
	},
	insertImage: function(src, attrs) {
		this.focus();
		if(!attrs)
			attrs = {};
		if(!attrs.hasOwnProperty("alt"))
			attrs.alt = this.getImageAlt(src);
		var attrsStr = "";
		for(var name in attrs) if(attrs.hasOwnProperty(name))
			attrsStr += " " + name + '="' + this.encodeHTML(attrs[name]) + '"';
		this.insertHTML('<img src="' + this.encodeHTML(src) + '"' + attrsStr + " />");
	},
	insertSmile: function(alt, src) {
		this.insertImage(src, {
			alt: alt,
			title: alt,
			"class": "bb-smile"
		});
	},

	getSelectionHTML: function() {
		var sel = window.getSelection && window.getSelection()
			|| document.getSelection && document.getSelection();
		if(sel) {
			var tmp = document.createElement("div");
			tmp.appendChild(sel.getRangeAt(0).cloneContents());
			return tmp.innerHTML;
		}
		return document.selection && document.selection.createRange().htmlText || "";
	},

	focused: null,
	prevFocused: null,
	focusHandler: function(e) {
		var focused = this.getFocusedNode(e);
		if(!focused)
			return;
		var prevFocused = this.focused;
		if(focused == prevFocused)
			return;
		this.prevFocused = prevFocused;
		this.focused = focused;
	},
	editorFocused: function() {
		if(/*@cc_on @_jscript_version < 9 || @*/ false) // IE < 9
			return this.focused == this.ww;
		return this.prevFocused == this.ww || this.focused == this.ww;
	},

	getHTML: function() {
		//~ not fully implemented
		var bb = this.ta.value.replace(/\r\n?|\n\r?/g, "\n"); // Normalize line breaks

		bb = this.encodeHTML(bb);

		var _extractedCodes = [];
		var _codeRndSubst;
		bb = bb.replace(
			/\[code\]([\s\S]*?(?:\[code\][\s\S]*?\[\/code\][\s\S]*?)*?)\[\/code\]/ig,
			function(s, code) {
				_extractedCodes.push(s);
				if(!_codeRndSubst) // Note: optimized for small codes count!
					_codeRndSubst = "<<code#" + Math.random().toString().substr(2) + new Date().getTime() + ">>";
				return _codeRndSubst;
			}
		);

		var br = this.preMode ? "<br/>" : "<br/>\n";
		var _this = this;
		bb = bb
			// Simple tags
			.replace(/\[b\]/ig, "<strong>")
			.replace(/\[\/b\]/ig, "</strong>")
			.replace(/\[i\]/ig, "<em>")
			.replace(/\[\/i\]/ig, "</em>")
			.replace(/\[u\]/ig, "<ins>")
			.replace(/\[\/u\]/ig, "</ins>")
			.replace(/\[s\]/ig, "<del>")
			.replace(/\[\/s\]/ig, "</del>")

			.replace(/\[left\]/ig, '<div align="left">')
			.replace(/\[\/left\]/ig, "</div>")
			.replace(/\[center\]/ig, '<div align="center">')
			.replace(/\[\/center\]/ig, "</div>")
			.replace(/\[right\]/ig, '<div align="right">')
			.replace(/\[\/right\]/ig, "</div>")

			.replace(/\[sub\]/ig, "<sub>")
			.replace(/\[\/sub\]/ig, "</sub>")
			.replace(/\[sup\]/ig, "<sup>")
			.replace(/\[\/sup\]/ig, "</sup>")

			.replace(/\[spoiler\]/ig, '<span class="bb-spoiler-inline" style="color: black; background: black;">')
			.replace(/\[\/spoiler\]/ig, "</span>")

			// Tags with parameters
			.replace(/\[size=('|"|&quot;)?(.+?)\1\]/ig, function(s, comma, size) {
				// +1, -1, 3, etc.
				if(/^(\+|-)?(\d+)$/.test(size)) {
					if(RegExp.$1)
						size = RegExp.$1 == "-" ? "smaller" : "larger";
					else {
						var n = +RegExp.$2;
						if     (n <= 1) size = "x-small"; // xx-small
						else if(n == 2) size = "small";
						else if(n == 3) size = "medium";
						else if(n == 4) size = "large";
						else if(n == 5) size = "x-large";
						else            size = "xx-large";
					}
				}
				// em, %, px, pt
				else if(/^\d+(?:\.\d+)?(em|%|px|pt)$/.test(size)) {
					var unit = RegExp.$1;
					var min, max;
					if     (unit == "em") { min = 0.5; max = 3;   }
					else if(unit == "%")  { min = 50;  max = 300; }
					else if(unit == "px") { min = 9;   max = 33;  }
					else if(unit == "pt") { min = 7;   max = 25;  }
					size = Math.max(min, Math.min(max, parseFloat(size))) + unit;
				}
				// x-small, large, etc.
				else if(!/^(?:xx?-small|small|medium|large|xx?-large|smaller|larger)$/.test(size))
					return s;
				return '<span style="font-size: ' + size + ';">';
			})
			.replace(/\[\/size\]/ig, "</span>")

			.replace(/\[font=('|"|&quot;)?(.+?)\1\]/ig, function(s, comma, font) {
				var fonts = font.split(",");
				for(var i = 0, l = fonts.length; i < l; ++i)
					if(/[^a-z ]/i.test(fonts[i]))
						return s;
				return '<span style="font-family: ' + font + ';">';
			})
			.replace(/\[\/font\]/ig, "</span>")

			.replace(/\[color=('|"|&quot;)?(#[\da-f]{3}|#[\da-f]{6}|[a-z]{3,})\1\]/ig, function(s, comma, color) {
				return '<span style="color: ' + color + ';">';
			})
			.replace(/\[\/color\]/ig, "</span>")

			.replace(/\[url\](.*?)\[\/url\]/ig, function(s, url) {
				if(!/^(?:https?|ftps?):\/\//i.test(url) && !/^mailto:/i.test(url))
					url = "http://" + url;
				url = _this.encodeHTML(url);
				return '<a href="' + url + '" title="' + url + '">' + url + '</a>';
			})
			.replace(/\[url=(.*?)\]([\s\S]*?)\[\/url\]/ig, function(s, url, text) {
				if(!/^(?:https?|ftps?):\/\//i.test(url) && !/^mailto:/i.test(url))
					url = "http://" + url;
				url = _this.encodeHTML(url);
				return '<a href="' + url + '" title="' + url + '">' + text + '</a>';
			})
			.replace(/\[img\](\S+?)\[\/img\]/ig, function(s, src) {
				if(!/^(?:https?|ftps?):\/\//i.test(src))
					src = "http://" + src;
				src = _this.encodeHTML(src);
				return '<img src="' + src + '" alt="' + _this.getImageAlt(src) + '"></img>';
			})

			// Single tags
			.replace(/\[hr(\s*\/)?\]/g, "<hr/>")
			.replace(/\[br(\s*\/)?\]/g, "<br/>")

			.replace(/\n/g, br)

			.replace(/\[pre\]([\s\S]+?)\[\/pre\]/ig, function(s, code) {
				code = code.replace(/<br\/?>\n/, "\n"); // Undo nl2br()
				return '<pre class="bb-pre">' + code + '</pre>';
			});

		var smileys = this.__editor.smileys;
		for(var src in smileys) if(smileys.hasOwnProperty(src)) {
			var hSrc = this.encodeHTML(src);
			var vars = smileys[src];
			for(var i = 0, l = vars.length; i < l; ++i) {
				var str = vars[i];
				var hStr = this.encodeHTML(str);
				var pattern = new RegExp(this.escapeRegExp(str) + "(?=[^\">]|$)", "g");
				var img = '<img src="' + hSrc + '" alt="' + hStr + '" title="' + hStr + '" class="bb-smile"></img>';
				bb = bb.replace(pattern, function(s, offset, orig) {
					if(
						offset
						//~ todo: check only for smileys like "8)" ?
						&& /^\d/.test(orig.charAt(offset - 1)) // Previous char
					)
						return s;
					return img;
				});
			}
		}

		if(_extractedCodes.length) {
			bb = bb.replace(new RegExp(_codeRndSubst, "g"), function(s) {
				return _extractedCodes.shift() || s;
			});
		}

		return bb;
	},
	getImageAlt: function(src) {
		return "[" + this.__editor._localize("image: ") + src + "]";
	},
	encodeHTML: function(s) {
		return s
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;");
	},
	decodeHTML: function(s) {
		return s
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&quot;/g, '"')
			.replace(/&amp;/g, "&");
	},
	escapeRegExp: function(s) {
		return s.replace(/[\\\/.^$+*?|()\[\]{}]/g, "\\$&");
	},
	_linkStyles: null,
	_dummyLink: null,
	_visitedLinkStyles: null,
	_dummyVisitedLink: null,
	_preStyles: null,
	_dummyPre: null,
	getBBCode: function(node, _root) {
		if(!node)
			node = this.ww;
		if(!_root) {
			_root = node;
			var isFirstCall = true;
		}
		else if(node.nodeType == 3 /*Node.TEXT_NODE*/) {
			var text = this.getNodeText(node);
			if(!this.preMode) {
				text = text.replace(/[\n\r\t ]+/g, " "); // Note: \s may also remove &nbsp;
				if(node.previousSibling && node.previousSibling.nodeName.toLowerCase() == "br")
					text = text.replace(/^[ \t]+/, "");
			}
			return text;
		}
		else if(node.nodeType == 8 /*Node.COMMENT_NODE*/) {
			return "";
		}

		var tagOpen = "";
		var tagClose = "";
		var attrComma = this.__editor.attrComma;

		if(node != _root) {
			var nn = node.nodeName.toLowerCase();
			if(nn == "br")
				return "\n";
			if(nn == "hr")
				return "[hr]";
			if(nn == "script" || nn == "style")
				return "";

			var styles = this.getStyles(node);
			if(
				styles.display == "none"
				|| styles.visibility == "collapse"
				|| styles.visibility == "hidden"
			)
				return "";
			var parentStyles = this.getStyles(node.parentNode);

			var hasBlockBBTag = false;
			var isLink = nn == "a" && node.href;

			if(isLink) {
				var linkStyles = this._linkStyles;
				var visitedLinkStyles = this._visitedLinkStyles;
				if(!linkStyles) {
					var dummyLink = this._dummyLink = document.createElement("a");
					dummyLink.className = "_wysiwygDummyLink";
					dummyLink.href = "#_wysiwygDummyLink";
					_root.parentNode.appendChild(dummyLink);
					linkStyles = this._linkStyles = this.getStyles(dummyLink);

					var dummyVisitedLink = this._dummyVisitedLink = document.createElement("a");
					dummyVisitedLink.className = "_wysiwygDummyVisitedLink";
					dummyVisitedLink.href = "";
					_root.parentNode.appendChild(dummyVisitedLink);
					visitedLinkStyles = this._visitedLinkStyles = this.getStyles(dummyVisitedLink);
				}
			}

			var isNew = function(prop) {
				var val = styles[prop];
				var isNew = val != parentStyles[prop];
				if(isNew && isLink) {
					return val != linkStyles[prop]
						&& val != visitedLinkStyles[prop];
				}
				return isNew;
			};
			if((styles.fontWeight == "bold" || styles.fontWeight > 400) && isNew("fontWeight"))
				tagOpen += "[b]", tagClose = "[/b]" + tagClose;
			if(styles.fontStyle == "italic" && isNew("fontStyle"))
				tagOpen += "[i]", tagClose = "[/i]" + tagClose;
			var underlinePattern = /(^|\s)underline(\s|$)/i;
			if(
				underlinePattern.test(styles.textDecoration)
				&& !underlinePattern.test(parentStyles.textDecoration)
				&& (
					!isLink
					|| !underlinePattern.test(linkStyles.textDecoration)
					|| !underlinePattern.test(visitedLinkStyles.textDecoration)
				)
			)
				tagOpen += "[u]", tagClose = "[/u]" + tagClose;
			var strikePattern = /(^|\s)line-through(\s|$)/i;
			if(
				strikePattern.test(styles.textDecoration)
				&& !strikePattern.test(parentStyles.textDecoration)
				&& (
					!isLink
					|| !strikePattern.test(linkStyles.textDecoration)
					|| !strikePattern.test(visitedLinkStyles.textDecoration)
				)
			)
				tagOpen += "[s]", tagClose = "[/s]" + tagClose;
			if(/(^|-)pre(-|$)/.test(styles.whiteSpace) && isNew("whiteSpace")) {
				tagOpen += "[pre]", tagClose = "[/pre]" + tagClose;
				hasBlockBBTag = true;
				var _isPre = true;

				var preStyles = this._preStyles;
				if(!preStyles) {
					var dummyPre = this._dummyPre = document.createElement("pre");
					dummyPre.className = "_wysiwygDummyPre";
					dummyPre.style.margin = dummyPre.style.padding = 0;
					_root.parentNode.appendChild(dummyPre);
					preStyles = this._preStyles = this.getStyles(dummyPre);
				}
			}
			if(isNew("textAlign")) {
				// We can get text-align: -moz-right; here!
				var align = (styles.textAlign || "")
					.replace(/^-[^-]+-/, "");
				if(align == "left" || align == "center" || align == "right") {
					tagOpen += "[" + align + "]", tagClose = "[/" + align + "]" + tagClose;
					hasBlockBBTag = true;
				}
			}
			if(styles.verticalAlign == "sub" && isNew("verticalAlign")) {
				tagOpen += "[sub]", tagClose = "[/sub]" + tagClose;
				var _ignoreSize = true;
			}
			if(styles.verticalAlign == "super" && isNew("verticalAlign")) {
				tagOpen += "[sup]", tagClose = "[/sup]" + tagClose;
				var _ignoreSize = true;
			}
			if(styles.backgroundColor && isNew("backgroundColor") && styles.color == styles.backgroundColor) {
				//~ todo: compare converted colors?
				tagOpen += "[spoiler]", tagClose = "[/spoiler]" + tagClose;
				var _isSpoiler = true;
			}
			if(!_isSpoiler && styles.color && isNew("color")) {
				tagOpen += "[color=" + attrComma + this.convertColor(styles.color) + attrComma + "]";
				tagClose = "[/color]" + tagClose;
			}
			if(!_ignoreSize && isNew("fontSize")) {
				var bbSize;
				var own = /(^|\s|;)font-size:\s*([^\s;]+)/i.test(node.style.cssText);
				var size = own
					? RegExp.$2 // Real value instead of computed px!
					: styles.fontSize;
				if     (size == "smaller")  bbSize = "-1";
				else if(size == "larger")   bbSize = "+1";
				else if(size == "xx-small") bbSize = "1";
				else if(size == "x-small")  bbSize = "1";
				else if(size == "small")    bbSize = "2";
				else if(size == "medium")   bbSize = "3";
				else if(size == "large")    bbSize = "4";
				else if(size == "x-large")  bbSize = "5";
				else if(size == "xx-large") bbSize = "6";
				else if(
					(!own || !this.__editor.allowSizeUnits)
					&& /^\d+(?:\.\d+)?px$/.test(size)
				) { // Looks like <H1>..<H6>
					var px = parseFloat(size);
					if     (px <= 10) bbSize = "1"; // 10px
					else if(px <= 14) bbSize = "2"; // 13px
					else if(px <= 16) bbSize = "3"; // 15px
					else if(px <= 20) bbSize = "4"; // 18px
					else if(px <= 26) bbSize = "5"; // 23px
					else              bbSize = "6"; // 30px
				}
				else if(
					this.__editor.allowSizeUnits
					&& /^\d+(?:\.\d+)?(em|%|px|pt)$/.test(size)
				)
					bbSize = size;
				if(bbSize)
					tagOpen += "[size=" + attrComma + bbSize + attrComma + "]", tagClose = "[/size]" + tagClose;
			}
			if(isNew("fontFamily") && (!_isPre || styles.fontFamily != preStyles.fontFamily)) {
				var fonts = styles.fontFamily.split(",");
				for(var i = 0, l = fonts.length; i < l; ++i)
					fonts[i] = fonts[i].replace(/^("|')(.*)\1$/, "$2");
				tagOpen += "[font=" + attrComma + fonts.join(",") + attrComma + "]", tagClose = "[/font]" + tagClose;
			}
			if(isLink) {
				//tagOpen += "[url=" + node.href + "]";
				tagOpen += node.href == this.decodeHTML(node.innerHTML)
					? "[url]"
					: "[url=" + attrComma + node.href + attrComma + "]";
				tagClose = "[/url]" + tagClose;
			}
			if(!hasBlockBBTag && styles.display == "block")
				tagClose += "\n";
			if(nn == "img" && node.src) {
				var src = node.src;
				this.initSmileys();
				var smileys = this.smileys;
				if(smileys.hasOwnProperty(src)) {
					var alt = node.alt;
					var vars = smileys[src];
					for(var i = 0, l = vars.length; i < l; ++i)
						if(vars[i] == alt)
							return alt;
					return vars[0];
				}
				tagOpen += "[img]";
				tagClose = "[/img]" + tagClose;
				return tagOpen + src + tagClose;
			}
		}

		var internal = "";
		var childs = node.childNodes;
		for(var i = 0, l = childs.length; i < l; ++i) {
			var child = childs[i];
			internal += this.getBBCode(child, _root);
		}

		// Buggy empty tags on Opera after insertHTML()
		// Looks like selectNodeContents() fails sometimes
		if(!internal && window.opera)
			return "";

		if(isFirstCall) {
			var dl = this._dummyLink;
			if(dl) {
				var dvl = this._dummyVisitedLink;
				dl.parentNode.removeChild(dl);
				dvl.parentNode.removeChild(dvl);
				this._dummyLink = this._linkStyles = null;
				this._dummyVisitedLink = this._visitedLinkStyles = null;
			}
			var dp = this._dummyPre;
			if(dp) {
				dp.parentNode.removeChild(dp);
				this._dummyPre = this._preStyles = null;
			}
		}
		return tagOpen + internal + tagClose;
	},
	getStyles: function(node) {
		return window.getComputedStyle
			? window.getComputedStyle(node, null)
			: node.currentStyle; // IE
	},
	convertColor: function(color) {
		if(/^#[\da-f]{6}$/i.test(color))
			return this.getColorName(color.toLowerCase());
		if(/^#[\da-f]{3}$/i.test(color)) {
			var cs = color.split("");
			return this.getColorName("#" + (cs[1] + cs[1] + cs[2] + cs[2] + cs[3] + cs[3]).toLowerCase());
		}
		if(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i.test(color)) {
			return this.getColorName(
				"#"
				+ this.padLeft((+RegExp.$1).toString(16))
				+ this.padLeft((+RegExp.$2).toString(16))
				+ this.padLeft((+RegExp.$3).toString(16))
			);
		}
		return color;
	},
	padLeft: function(n) {
		var chr = "0";
		var cnt = 2;
		n = String(n);
		var l = n.length;
		return l < cnt
			? new Array(cnt - n.length + 1).join(chr) + n
			: n;
	},
	colors: {
		"#f0f8ff": "AliceBlue",
		"#faebd7": "AntiqueWhite",
		"#00ffff": "Aqua",
		"#7fffd4": "Aquamarine",
		"#f0ffff": "Azure",
		"#f5f5dc": "Beige",
		"#ffe4c4": "Bisque",
		"#000000": "Black",
		"#ffebcd": "BlanchedAlmond",
		"#0000ff": "Blue",
		"#8a2be2": "BlueViolet",
		"#a52a2a": "Brown",
		"#deb887": "BurlyWood",
		"#5f9ea0": "CadetBlue",
		"#7fff00": "Chartreuse",
		"#d2691e": "Chocolate",
		"#ff7f50": "Coral",
		"#6495ed": "CornflowerBlue",
		"#fff8dc": "Cornsilk",
		"#dc143c": "Crimson",
		//"#00ffff": "Cyan",
		"#00008b": "DarkBlue",
		"#008b8b": "DarkCyan",
		"#b8860b": "DarkGoldenRod",
		"#a9a9a9": "DarkGray",
		"#006400": "DarkGreen",
		"#bdb76b": "DarkKhaki",
		"#8b008b": "DarkMagenta",
		"#556b2f": "DarkOliveGreen",
		"#ff8c00": "Darkorange",
		"#9932cc": "DarkOrchid",
		"#8b0000": "DarkRed",
		"#e9967a": "DarkSalmon",
		"#8fbc8f": "DarkSeaGreen",
		"#483d8b": "DarkSlateBlue",
		"#2f4f4f": "DarkSlateGray",
		"#00ced1": "DarkTurquoise",
		"#9400d3": "DarkViolet",
		"#ff1493": "DeepPink",
		"#00bfff": "DeepSkyBlue",
		"#696969": "DimGray",
		"#1e90ff": "DodgerBlue",
		"#b22222": "FireBrick",
		"#fffaf0": "FloralWhite",
		"#228b22": "ForestGreen",
		//"#ff00ff": "Fuchsia",
		"#dcdcdc": "Gainsboro",
		"#f8f8ff": "GhostWhite",
		"#ffd700": "Gold",
		"#daa520": "GoldenRod",
		"#808080": "Gray",
		"#008000": "Green",
		"#adff2f": "GreenYellow",
		"#f0fff0": "HoneyDew",
		"#ff69b4": "HotPink",
		"#cd5c5c": "IndianRed",
		"#4b0082": "Indigo",
		"#fffff0": "Ivory",
		"#f0e68c": "Khaki",
		"#e6e6fa": "Lavender",
		"#fff0f5": "LavenderBlush",
		"#7cfc00": "LawnGreen",
		"#fffacd": "LemonChiffon",
		"#add8e6": "LightBlue",
		"#f08080": "LightCoral",
		"#e0ffff": "LightCyan",
		"#fafad2": "LightGoldenRodYellow",
		"#90ee90": "LightGreen",
		"#d3d3d3": "LightGrey",
		"#ffb6c1": "LightPink",
		"#ffa07a": "LightSalmon",
		"#20b2aa": "LightSeaGreen",
		"#87cefa": "LightSkyBlue",
		"#778899": "LightSlateGray",
		"#b0c4de": "LightSteelBlue",
		"#ffffe0": "LightYellow",
		"#00ff00": "Lime",
		"#32cd32": "LimeGreen",
		"#faf0e6": "Linen",
		"#ff00ff": "Magenta",
		"#800000": "Maroon",
		"#66cdaa": "MediumAquaMarine",
		"#0000cd": "MediumBlue",
		"#ba55d3": "MediumOrchid",
		"#9370db": "MediumPurple",
		"#3cb371": "MediumSeaGreen",
		"#7b68ee": "MediumSlateBlue",
		"#00fa9a": "MediumSpringGreen",
		"#48d1cc": "MediumTurquoise",
		"#c71585": "MediumVioletRed",
		"#191970": "MidnightBlue",
		"#f5fffa": "MintCream",
		"#ffe4e1": "MistyRose",
		"#ffe4b5": "Moccasin",
		"#ffdead": "NavajoWhite",
		"#000080": "Navy",
		"#fdf5e6": "OldLace",
		"#808000": "Olive",
		"#6b8e23": "OliveDrab",
		"#ffa500": "Orange",
		"#ff4500": "OrangeRed",
		"#da70d6": "Orchid",
		"#eee8aa": "PaleGoldenRod",
		"#98fb98": "PaleGreen",
		"#afeeee": "PaleTurquoise",
		"#db7093": "PaleVioletRed",
		"#ffefd5": "PapayaWhip",
		"#ffdab9": "PeachPuff",
		"#cd853f": "Peru",
		"#ffc0cb": "Pink",
		"#dda0dd": "Plum",
		"#b0e0e6": "PowderBlue",
		"#800080": "Purple",
		"#ff0000": "Red",
		"#bc8f8f": "RosyBrown",
		"#4169e1": "RoyalBlue",
		"#8b4513": "SaddleBrown",
		"#fa8072": "Salmon",
		"#f4a460": "SandyBrown",
		"#2e8b57": "SeaGreen",
		"#fff5ee": "SeaShell",
		"#a0522d": "Sienna",
		"#c0c0c0": "Silver",
		"#87ceeb": "SkyBlue",
		"#6a5acd": "SlateBlue",
		"#708090": "SlateGray",
		"#fffafa": "Snow",
		"#00ff7f": "SpringGreen",
		"#4682b4": "SteelBlue",
		"#d2b48c": "Tan",
		"#008080": "Teal",
		"#d8bfd8": "Thistle",
		"#ff6347": "Tomato",
		"#40e0d0": "Turquoise",
		"#ee82ee": "Violet",
		"#f5deb3": "Wheat",
		"#ffffff": "White",
		"#f5f5f5": "WhiteSmoke",
		"#ffff00": "Yellow",
		"#9acd32": "YellowGreen"
	},
	getColorName: function(hex) {
		if(hex in this.colors)
			return this.colors[hex];
		if(this.shortifyColors && /^#([\da-f])\1([\da-f])\2([\da-f])\3$/.test(hex))
			return "#" + RegExp.$1 + RegExp.$2 + RegExp.$3;
		return hex;
	},
	getNodeText: function(node) {
		return node.textContent || node.innerText || node.nodeValue || "";
	}
};

var resizer = {
	//== Settings begin
	minWidth: 140,
	minHeight: 60,
	maxWidth: function() {
		return Math.max(
			150,
			(
				Math.max(document.documentElement.clientWidth, document.body.clientWidth)
				|| screen.availWidth
				|| screen.width
			) - 30
		);
	},
	maxHeight: Number.MAX_VALUE,
	noHorizScroll: true,
	addHeight: 120,
	getArea: function(rsElt) {
		var ta = rsElt.parentNode.parentNode.getElementsByTagName("textarea")[0];
		return ta.__editor && ta.__editor.inputField || ta;
	},
	//== Settings end

	init: function() {
		eventListener.add(document, "mousedown", this.startResize,  this);
		eventListener.add(document, "mouseup",   this.stopResize,   this);
		eventListener.add(document, "dblclick",  this.increaseSize, this);
		eventListener.add(window, "unload", function() {
			eventListener.remove(window, "unload", arguments.callee);
			eventListener.remove(document, "mousedown", this.startResize);
			eventListener.remove(document, "mouseup",   this.stopResize);
			eventListener.remove(document, "dblclick",  this.increaseSize);
		}, this);
	},
	getResizeType: function(e) {
		var tar = e.target;
		return /(^|\s)resizer-(\S+)(\s|$)/.test(tar.className)
			? RegExp.$2
			: null;
	},
	startResize: function(e) {
		if(e.button != 0)
			return;
		this.stopResize();
		var tar = e.target;
		var rsType = this.getResizeType(e);
		if(!rsType)
			return;
		var hasModifiers = e.shiftKey || e.ctrlKey || e.altKey || e.metaKey;
		switch(rsType) {
			case "right":        this.rx = true,         this.ry = hasModifiers; break;
			case "bottom":       this.rx = hasModifiers, this.ry = true;         break;
			case "right-bottom": this.rx = true,         this.ry = true;         break;
			default: return;
		}
		this.stopEvent(e);

		this.area = this.getArea(tar);
		this.w = this.getWH("width");
		this.h = this.getWH("height");
		this.x = e.pageX || e.screenX;
		this.y = e.pageY || e.screenY;
		this.rc = this.getOffset(this.area);

		eventListener.add(document, "mousemove", this.doResize, this);
		this.setResizeCursor(rsType);
	},
	setResizeCursor: function(rsType) {
		var root = document.documentElement || document.body;
		var clss = root.className
			.replace(/(^|\s+)resize-[\w-]+(\s+|$)/, " ")
			.replace(/^\s+|\s+$/g, "");
		root.className = rsType
			? (clss + " resize-" + rsType).replace(/^\s+/, "")
			: clss;
	},
	stopResize: function(e) {
		if(!this.area)
			return;
		eventListener.remove(document, "mousemove", this.doResize);
		this.area = null;
		this.setResizeCursor(null);
	},
	doResize: function(e) {
		if(!this.area)
			return;
		this.stopEvent(e);
		var rc = this.getOffset(this.area);
		if(this.rx)
			this.setWidth(this.area, this.w + (e.pageX || e.screenX) - this.x + this.rc.left - rc.left);
		if(this.ry)
			this.setHeight(this.area, this.h + (e.pageY || e.screenY) - this.y + this.rc.top - rc.top);
	},
	getOffset: function(node) { // Based on code from http://javascript.ru/ui/offset
		if(node.getBoundingClientRect)
			return this.getOffsetRect(node);
		return this.getOffsetSum(node);
	},
	getOffsetSum: function(node) { // Based on code from http://javascript.ru/ui/offset
		var top  = 0;
		var left = 0;
		for(; node; node = node.offsetParent) {
			top  += parseInt(node.offsetTop);
			left += parseInt(node.offsetLeft);
		}
		return {
			top:  top,
			left: left
		};
	},
	getOffsetRect: function(node) { // Based on code from http://javascript.ru/ui/offset
		var box = node.getBoundingClientRect();
		var b = document.body;
		var de = document.documentElement;
		var scrollTop  = window.pageYOffset || de.scrollTop  || b.scrollTop;
		var scrollLeft = window.pageXOffset || de.scrollLeft || b.scrollLeft;
		var clientTop  = de.clientTop  || b.clientTop  || 0;
		var clientLeft = de.clientLeft || b.clientLeft || 0;
		var top  = box.top  + scrollTop  - clientTop;
		var left = box.left + scrollLeft - clientLeft;
		return {
			top:  Math.round(top),
			left: Math.round(left)
		};
	},
	increaseSize: function(e) {
		var tar = e.target;
		var rsType = this.getResizeType(e);
		if(!rsType)
			return;
		this.area = this.getArea(tar);
		var rsRight  = rsType.indexOf("right")  != -1;
		var rsBottom = rsType.indexOf("bottom") != -1;
		if(rsBottom)
			this.setHeight(this.area, this.getWH("height") + this.getParam("addHeight"));
		var mw = this.getParam("maxWidth");
		if(rsRight || rsBottom && this.getWH("width") > mw) {
			this.setWidth(this.area, mw);
			this.correctWidth(mw);
		}
		this.area = null;
	},
	correctWidth: function(mw) {
		if(!this.noHorizScroll)
			return;
		var sw = this.getScrollWidth();
		if(sw > 0)
			this.setWidth(this.area, (mw || this.getParam("maxWidth")) - sw, true);
	},
	getScrollWidth: function() {
		var elt = document.documentElement;
		if(document.body.scrollWidth > elt.scrollWidth)
			elt = document.body;
		return elt.scrollWidth - elt.clientWidth;
	},
	setWidth: function(ta, w, correction) {
		ta.style.width = this.mm(w, this.getParam("minWidth"), this.getParam("maxWidth")) + "px";
	},
	setHeight: function(ta, h) {
		ta.style.height = this.mm(h, this.getParam("minHeight"), this.getParam("maxHeight")) + "px";
	},
	stopEvent: function(e) {
		e.preventDefault && e.preventDefault();
		e.stopPropagation && e.stopPropagation();
	},
	getWH: function(prop) {
		return parseInt(this.getStyle(this.area, prop)) || 0;
	},
	getStyle: function(elt, prop) {
		if(window.getComputedStyle)
			return window.getComputedStyle(elt, null)[prop];
		// Hello, stupid IE!
		var s = elt.currentStyle[prop == "cssFloat" ? "styleFloat" : prop];
		return s && (prop == "width" || prop == "height") && !/^\d+(px)?$/.test(s)
			? elt["offset" + prop.charAt(0).toUpperCase() + prop.substr(1)]
			: s;
	},
	mm: function(n, min, max) {
		return Math.max(Math.min(n, max), min);
	},
	getParam: function(pName) {
		var pVal = this[pName];
		if(typeof pVal == "function")
			return pVal();
		return pVal;
	}
};
resizer.init();