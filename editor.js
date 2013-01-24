// (c) Infocatcher 2009-2013
// version 0.3.5pre - 2013-01-24

// https://github.com/Infocatcher/BBCode_Editor/tree/0.3.x

// Dependencies:
//   eventListener object - eventListener.js

var bbCode = {
	//== Settings begin
	language: "ru",
	selectInserted: false,
	attrComma: "", // Empty string or '"'
	validURIMask: /^(\w+:\/+[^\s\/\\'"?&#]+(\/\S*)?|\w+:[^\s\/\\'"?&#]+)$/,
	onlyTagsMask: /^\[(\w+)([^\[\]]+)?\](\[\/\1\])$/,
	onlyTagsCloseTagNum: 3, // Number of brackets with ([/tag])
	getTa: function() {
		return document.MessageForm && document.MessageForm.Message
			|| document.getElementsByTagName("textarea")[0];
	},
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
		this.setInvertSelected(invertSelect);
		this._tag(tag, attr, text);
	},
	urlTag: function(invertSelect) {
		this.setInvertSelected(invertSelect);
		var sel = this.getSel();
		if(this.uriTagFromSel("url", sel))
			return;
		var u = prompt(this._localize("Link:"), "http://");
		if(u && sel)
			this._tag("url", u);
		else if(u != null)
			this._tag("url", false, u);
	},
	imgTag: function(invertSelect) {
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
		this._tag("quote", author);
		this.attrComma = origComma;
	},
	//== API end

	_ta: null,
	_getTa: function() {
		return this._ta || (
			this._ta = this.getTa()
		);
	},
	getSel: function() {
		var ta = this._getTa();
		if(typeof ta.selectionStart == "number") {
			return String(
				window.getSelection && window.getSelection()
				|| document.getSelection && document.getSelection()
			) || ta.value.substring(ta.selectionStart, ta.selectionEnd);
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
		var ta = this._getTa();
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
		return rsElt.parentNode.parentNode.getElementsByTagName("textarea")[0];
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
		root.className = rsType
			? (root.className + " resize-" + rsType).replace(/^\s+/, "")
			: root.className
				.replace(/(^|\s+)resize-[\w-]+(\s+|$)/, " ")
				.replace(/^\s+|\s+$/g, "");
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