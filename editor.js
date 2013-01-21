// (c) Infocatcher 2009-2012
// version 0.4.0a3pre - 2012-02-14

// Dependencies:
//   eventListener object - eventListener.js

// Usage:
//	var editor = new Editor("textareaId", {
//		selectInserted: true,
//		onToggle: function(visualMode) {
//			// Show current mode
//		}
//	});
//	editor.tag(event, 'b');

function Editor(ta, options) {
	this.selectInserted = false;
	ta = this.ta = this.$(ta);
	if(options)
		for(var p in options)
			this[p] = options[p];
	this.we = new WysiwygEditor(ta, this);
	this.we.__editor = this;
	this.onWysiwygToggle();
}
Editor.prototype = {
	//== Settings begin
	language: "ru",
	attrComma: "", // Empty string or '"'
	validURIMask: /^(\w+:\/+[^\s\/\\'"?&#]+(\/\S*)?|\w+:[^\s\/\\'"?&#]+)$/,
	onlyTagsMask: /^\[(\w+)([^\[\]]+)?\](\[\/\1\])$/,
	onlyTagsCloseTagNum: 3, // Number of brackets with ([/tag])
	preMode: undefined, // WYSIWYG
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
		}
	},
	_localize: function(s) {
		return this.strings[s] && this.strings[s][this.language] || s;
	},

	//== API begin
	insert: function(invertSelect, text) {
		this.setInvertSelected(invertSelect);
		this._insert(text);
	},
	tag: function(invertSelect, tag, attr, text) {
		if(this.we.active) {
			this.we.insertTag(tag, attr);
			return;
		}
		this.setInvertSelected(invertSelect);
		this._tag(tag, attr, text);
	},
	urlTag: function(invertSelect) {
		var sel = this.getSel();
		if(this.we.active) {
			//~ todo: try detect selected link
			//if(this.we.editorFocused()) {
			//	this.we.focus();
			//	var s = window.getSelection().getRangeAt(0).commonAncestorContainer;
			//	alert(s.parentNode.nodeName);
			//}
			var u = this.trim(sel);
			if(!this.isValidURI(u))
				u = prompt(this._localize("Link:"), "http://");
			u && this.we.insertTag("url", u);
			return;
		}
		this.setInvertSelected(invertSelect);
		if(this.uriTagFromSel("url", sel))
			return;
		var u = prompt(this._localize("Link:"), "http://");
		if(u && sel)
			this._tag("url", u);
		else if(u != null)
			this._tag("url", false, u);
	},
	imgTag: function(invertSelect) {
		if(this.we.active) {
			var u = this.trim(this.getSel());
			if(!this.isValidURI(u))
				u = prompt(this._localize("Link to image:"), "http://");
			u && this.we.insertTag("img", u);
			return;
		}
		this.setInvertSelected(invertSelect);
		if(this.uriTagFromSel("img"))
			return;
		var u = prompt(this._localize("Link to image:"), "http://");
		u && this._tag("img", false, u);
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
		if(this.we.active)
			this.we.insertRawTag("quote", author);
		else
			this._tag("quote", author);
		this.attrComma = origComma;
	},
	toggle: function(visualMode) {
		if(visualMode != undefined && visualMode == this.we.active)
			return;
		this.we.toggle();
		this.onWysiwygToggle();
	},
	onWysiwygToggle: function() {
		var root = document.documentElement || document.body;
		this.setClass(root, "editor-mode-plain", !this.we.active);
		this.setClass(root, "editor-mode-wysiwyg", this.we.active);
		if("onToggle" in this)
			this.onToggle(this.we.active);
	},
	focus: function() {
		if(this.we.active)
			this.we.ww.focus();
		else
			this.ta.focus();
	},

	//== API end

	$: function(id) {
		if(typeof id == "string")
			return document.getElementById(id) || document.getElementsByName(id)[0];
		return id;
	},
	getSel: function() {
		var ta = this.ta;
		if(typeof ta.selectionStart == "number") {
			return String(
				window.getSelection && window.getSelection()
				|| document.getSelection && document.getSelection()
			) || ta.style.display != "none" && ta.value.substring(ta.selectionStart, ta.selectionEnd)
			|| "";
		}
		return document.selection && document.selection.createRange().text || "";
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
		if(typeof ta.selectionStart == "number") {
			var sTop = ta.scrollTop;
			var sHeight = ta.scrollHeight;
			var sLeft = ta.scrollLeft;
			// var sWidth = ta.scrollWidth;

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
		else
			ta.value += text;
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
	this.ww = this.ta.nextSibling;
	this.active = false;
	this.init();
}
WysiwygEditor.prototype = {
	init: function() {
		this.available = this.getAvailable();
		if(!this.available)
			return;

		var preMode = this.__editor.preMode;
		this.preMode = preMode === undefined
			? /(^|-)pre(-|$)/.test(this.getStyles(this.ww, "whiteSpace"))
			: !!preMode;
		this.toggle();

		eventListener.add(window,   "focus",     this.focusHandler, this, true);
		eventListener.add(document, "mousedown", this.focusHandler, this, true);
		eventListener.add(document, "click",     this.focusHandler, this, true);

		eventListener.add(window, "unload", function() {
			eventListener.remove(window, "unload", arguments.callee);
			if(this.active)
				this.ta.value = this.getBBCode(); // Fails sometimes ?
			this.__editor = null;
		}, this);
	},
	toggle: function() {
		if(!this.available)
			return;
		//var wwMode = this.ta.style.display != "none";
		var wwMode = !this.active;
		var show = wwMode ? this.ww : this.ta;
		var hide = wwMode ? this.ta : this.ww;
		show.style.width  = resizer.getStyle(hide, "width");
		show.style.height = resizer.getStyle(hide, "height");
		if(wwMode)
			show.innerHTML = this.getHTML();
		else
			show.value = this.getBBCode();
		show.style.display = "";
		hide.style.display = "none";
		show.focus && show.focus();
		this.active = wwMode;

		// Hack for Firefox 10 - 13.0a1
		// With sibling <div> doubleclick in textarea doesn't select word
		if(wwMode)
			this.ta.parentNode.insertBefore(this.ww, this.ta.nextSibling);
		else
			this.ta.parentNode.removeChild(this.ww);
	},
	getAvailable: function() {
		return "execCommand" in document;
	},
	getFocusedNode: function() {
		//~ todo: use another way in old browsers
		if("activeElement" in document)
			return document.activeElement;
		if("querySelector" in document)
			return document.querySelector(":focus");
		return null;
	},
	_useTags: function() {
		// Firefox bug (?)
		// Without this we can get inline styles for <div contenteditable="true">
		// And styles like <div contenteditable="true" style="... font-weight: bold;">
		// can't be removed with "removeformat" command.
		try {
			//~ todo: "useCSS" for old versions?
			document.execCommand("styleWithCSS", false, false);
		}
		catch(e) {
		}
	},
	insertTag: function(tag, arg) {
		//~ todo: check ww focused! (document.execCommand() in IE8 modify HTML everywhere)
		if(!this.editorFocused())
			return;
		var cmd;
		switch(tag) {
			case "b": cmd = "bold"; break;
			case "i": cmd = "italic"; break;
			case "u": cmd = "underline"; break;
			case "s": cmd = "strikeThrough"; break;

			case "font": cmd = "fontName"; break;
			case "size": cmd = "fontSize"; break;
			case "color": cmd = "foreColor"; break;
			case "hr": cmd = "insertHorizontalRule"; break;

			case "img": cmd = "insertImage"; break;
			case "url": cmd = "createlink"; break;

			case "center": cmd = "justifyCenter"; break;
			case "left": cmd = "justifyLeft"; break;
			case "right": cmd = "justifyRight"; break;

			case "sub": cmd = "subscript"; break;
			case "sup": cmd = "superscript"; break;

			case "pre": cmd = "formatBlock", arg = "<pre>"; break;
		}
		this.execCommand(cmd, arg);
	},
	execCommand: function(cmd, arg) {
		this._useTags();
		document.execCommand(cmd, false, arg || null);
		this.focus();
		this.select();
	},
	insertRawTag: function(tag, attr, html) {
		this.insertHTML(
			this.encodeHTML(
				"[" + tag
				+ (attr ? "=" + this.__editor.attrComma + attr + this.__editor.attrComma : "")
				+ "]"
			)
			+ (html || this.getSelectionHTML())
			+ this.encodeHTML("[/" + tag + "]")
		);
	},
	focus: function() {
		this.ww.focus && this.ww.focus(); //~ todo: doesn't work in Opera
	},
	select: function() {
		if(!this.__editor.selectInserted) {
			var sel = window.getSelection && window.getSelection()
				|| document.getSelection && document.getSelection();
			if(sel)
				sel.collapseToEnd();
			else {
				var r = document.selection.createRange();
				r.collapse(false);
				r.select();
			}
		}
	},
	insertHTML: function(html) {
		if(!this.editorFocused())
			return;

		if(this.__editor.selectInserted) {
			var id = "_selectPoint_" + Math.random().toString().substr(2) + new Date().getTime();
			html = '<span id="' + id + '">' + html + "</span>";
		}

		try {
			if(!document.queryCommandEnabled("insertHTML"))
				return;

			document.execCommand("insertHTML", false, html);
			if(this.__editor.selectInserted) {
				var sel = window.getSelection && window.getSelection()
					|| document.getSelection && document.getSelection();
				var r = document.createRange();
				r.selectNodeContents(document.getElementById(id));
				sel.removeAllRanges();
				sel.addRange(r);
			}
		}
		catch(e) {
			if(document.selection && document.selection.createRange) {
				var r = document.selection.createRange();
				r.pasteHTML(html); //~ todo: this doesn't close tags opened before selection
				if(this.__editor.selectInserted) {
					r = r.duplicate();
					r.moveToElementText(document.getElementById(id));
				}
				r.select();
			}
		}
		this.focus();
	},
	removeFormatting: function() {
		if(!this.editorFocused())
			return;
		this.execCommand("removeFormat");
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

	focusHandler: function(e) {
		var focused = this.getFocusedNode();
		if(focused == this.focused)
			return;
		this.prevFocused = this.focused;
		this.focused = focused;
	},
	editorFocused: function() {
		if(/*@cc_on ! @*/ false) // IE
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

		//~ todo: don't parse [code] ... [/code]
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

			//.replace(/\[pre\]/ig, "<pre>")
			//.replace(/\[\/pre\]/ig, "</pre>")

			// Tags with parameters

			.replace(/\[size=('|")?(.+?)\1\]/ig, function(s, comma, size) {
				// +1, -1, 3, etc.
				if(/^(\+|-)?(\d+)$/.test(size)) {
					if(RegExp.$1)
						size = RegExp.$1 == "-" ? "smaller" : "larger";
					else {
						var n = Number(RegExp.$2);
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

			.replace(/\[font=('|")?(.+?)\1\]/ig, function(s, comma, font) {
				var fonts = font.split(",");
				for(var i = 0, l = fonts.length; i < l; ++i)
					if(/[^a-z ]/i.test(fonts[i]))
						return s;
				return '<span style="font-family: ' + font + ';">';
			})
			.replace(/\[\/font\]/ig, "</span>")

			.replace(/\[color=('|")?(#[\da-f]{3}|#[\da-f]{6}|[a-z]{3,})\1\]/ig, function(s, comma, color) {
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
				src = _this.encodeHTML(src); //?
				return '<img src="' + src + '" alt="[img]"></img>';
			})
			//~ todo: smileys

			// Single tags
			.replace(/\[hr(\s*\/)?\]/g, "<hr/>")
			.replace(/\[br(\s*\/)?\]/g, "<br/>")

			.replace(/\n/g, "<br/>\n")

			.replace(/\[pre\]([\s\S]+?)\[\/pre\]/ig, function(s, code) {
				code = code.replace(/<br\/?>\n/, "\n"); // Undo nl2br()
				return '<pre class="bb-pre">' + code + '</pre>';
			})
		;


		if(_extractedCodes.length) {
			bb = bb.replace(new RegExp(_codeRndSubst, "g"), function(s) {
				return _extractedCodes.shift() || s;
			});
		}

		return bb;
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
	getBBCode: function(node) {
		if(!node)
			node = this.ww;
		else if(node.nodeType == 3 /*Node.TEXT_NODE*/) {
			var text = this.getNodeText(node);
			if(!this.preMode) {
				text = text
					.replace(/[\n\r\t ]+/g, " ") // Note: \s may also remove &nbsp;
					.replace(/^[\t ]+/mg, "");
			}
			return text;
		}

		var ret = "";

		var tagOpen = "";
		var tagClose = "";
		var hasBlockBBTag = false;

		if(node != this.ww) {
			var nn = node.nodeName.toLowerCase();
			if(nn == "br")
				return "\n";

			var isLink = nn == "a" && node.href;

			if(isLink) { //~ todo: visited links
				if("_dummyLink" in this)
					var dummyLink = this._dummyLink;
				else {
					var dummyLink = document.createElement("a");
					dummyLink.id = "_wysiwygDummyLink";
					dummyLink.href = "#" + dummyLink.id;
					this.ww.parentNode.appendChild(dummyLink);
					this._dummyLink = dummyLink;
				}
				var linkStyles = this.getStyles(dummyLink);
			}

			var styles = this.getStyles(node);
			//var isFirstLevel = node.parentNode == this.ww;
			var parentStyles = this.getStyles(node.parentNode);

			var isNew = function(prop) {
				var isNew = styles[prop] != parentStyles[prop];
				if(isNew && isLink)
					return styles[prop] != linkStyles[prop];
				return isNew;
			};
			if((styles.fontWeight == "bold" || Number(styles.fontWeight) > 400) && isNew("fontWeight"))
				tagOpen += "[b]", tagClose = "[/b]" + tagClose;
			if(styles.fontStyle == "italic" && isNew("fontStyle"))
				tagOpen += "[i]", tagClose = "[/i]" + tagClose;
			if(
				/(^|\s)underline(\s|$)/i.test(styles.textDecoration)
				&& (!parentStyles || !/(^|\s)underline(\s|$)/i.test(parentStyles.textDecoration))
				&& (!isLink || !/(^|\s)underline(\s|$)/i.test(linkStyles.textDecoration))
			)
				tagOpen += "[u]", tagClose = "[/u]" + tagClose;
			if(
				/(^|\s)line-through(\s|$)/i.test(styles.textDecoration)
				&& (!parentStyles || !/(^|\s)line-through(\s|$)/i.test(parentStyles.textDecoration))
				&& (!isLink || !/(^|\s)line-through(\s|$)/i.test(linkStyles.textDecoration))
			)
				tagOpen += "[s]", tagClose = "[/s]" + tagClose;
			if(/(^|-)pre(-|$)/.test(styles.whiteSpace) && isNew("whiteSpace"))
				tagOpen += "[pre]", tagClose = "[/pre]" + tagClose, hasBlockBBTag = true;
			if(isNew("textAlign")) {
				// We can get text-align: -moz-right; here!
				var align = (styles.textAlign || "")
					.replace(/^-[^-]+-/, "");
				if(align == "left" || align == "center" || align == "right") {
					tagOpen += "[" + align + "]", tagClose = "[/" + align + "]" + tagClose;
					hasBlockBBTag = true;
				}
			}
			if(styles.verticalAlign == "sub" && isNew("verticalAlign"))
				tagOpen += "[sub]", tagClose = "[/sub]" + tagClose;
			if(styles.verticalAlign == "super" && isNew("verticalAlign"))
				tagOpen += "[sup]", tagClose = "[/sup]" + tagClose;
			if(styles.backgroundColor && isNew("backgroundColor") && styles.color == styles.backgroundColor) {
				//~ todo: compare converted colors?
				tagOpen += "[spoiler]", tagClose = "[/spoiler]" + tagClose;
				var _isSpoiler = true;
			}
			if(!_isSpoiler && styles.color && isNew("color")) {
				tagOpen += "[color=" + this.convertColor(styles.color) + "]";
				tagClose = "[/color]" + tagClose;
			}
			if(isNew("fontSize")) {
				var bbSize;
				var size = /(^|\s|;)font-size:\s*([^\s;]+)/i.test(node.style.cssText)
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
				else if(/^\d+(?:\.\d+)?(em|%|px|pt)$/.test(size))
					bbSize = size;
				if(bbSize)
					tagOpen += "[size=" + bbSize + "]", tagClose = "[/size]" + tagClose;
			}
			if(isNew("fontFamily"))
				tagOpen += "[font=" + styles.fontFamily + "]", tagClose = "[/font]" + tagClose;
			if(isLink) {
				//tagOpen += "[url=" + node.href + "]";
				tagOpen += node.href == this.decodeHTML(node.innerHTML) ? "[url]" : "[url=" + node.href + "]";
				tagClose = "[/url]" + tagClose;
			}
			if(!hasBlockBBTag && styles.display == "block")
				tagClose += "\n";
			if(nn == "img" && node.src) {
				//~ todo: smileys
				tagOpen += "[img]";
				tagClose = "[/img]" + tagClose;
				return tagOpen + node.src + tagClose;
			}
		}

		ret += tagOpen;

		var childs = node.childNodes;
		for(var i = 0, l = childs.length; i < l; ++i) {
			var child = childs[i];
			ret += this.getBBCode(child);
		}

		ret += tagClose;

		return ret;
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
		if(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/.test(color))
			return this.getColorName(
				"#"
				+ this.padLeft(Number(RegExp.$1).toString(16))
				+ this.padLeft(Number(RegExp.$2).toString(16))
				+ this.padLeft(Number(RegExp.$3).toString(16))
			);
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
	getColorName: function(color) {
		if(color in this.colors)
			return this.colors[color];
		return color;
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
		if(ta.style.display != "none")
			return ta;
		return ta.nextSibling;
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
		if(this.area)
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