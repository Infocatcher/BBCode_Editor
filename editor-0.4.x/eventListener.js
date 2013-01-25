// (c) Infocatcher 2011
// version 0.2.0 - 2011-08-05

var eventListener = {
	add: function(target, type, func, context, capturePhase) {
		this.set(target, type, func, context, capturePhase, true);
	},
	remove: function(target, type, func, capturePhase) {
		this.set(target, type, func, null, capturePhase, false);
	},
	set: function(target, type, func, context, capturePhase, add) {
		var wrpFunc = "__eventListenerWrappedFunction" in func && func.__eventListenerWrappedFunction;
		if(!wrpFunc) {
			if(add) {
				var _this = this;
				wrpFunc = func.__eventListenerWrappedFunction = function(e) {
					return func.call(context || window, _this.fixEvent(e, target));
				};
			}
			else
				wrpFunc = func;
		}
		var ael = "addEventListener" in target;
		target[
			ael
				? add ? "addEventListener" : "removeEventListener"
				: add ? "attachEvent"      : "detachEvent"
		](ael ? type : "on" + type, wrpFunc, capturePhase || false);
	},
	fixEvent: function(e, target) {
		if(!e)
			e = window.event;
		var patch = {};
		if(!e.target)
			patch.target = e.srcElement;
		if(e.relatedTarget === undefined && (e.fromElement || e.toElement))
			patch.relatedTarget = e.fromElement == (e.srcElement || e.target) ? e.toElement : e.fromElement;
		if(e.which == undefined && e.button != undefined)
			patch.button = !e.button || e.button & 1
				? 0
				: e.button & 2
					? 2
					: e.button & 4
						? 1
						: 0;
		if(!e.preventDefault)
			patch.preventDefault = function() {
				e.returnValue = false;
			};
		if(!e.stopPropagation)
			patch.stopPropagation = function() {
				e.cancelBubble = true;
			};
		if(!e.currentTarget)
			patch.currentTarget = target;
		if(!e.eventPhase)
			e.eventPhase = (e.srcElement || e.target) == target ? 2 /*AT_TARGET*/ : 3 /*BUBBLING_PHASE*/;

		for(var p in patch)
			if(!this.setProperty(e, p, patch[p])) {
				patch._originalEvent = e;
				return this.addProperties(patch, e);
			}
		return e;
	},
	setProperty: function(o, p, v) {
		try {
			o[p] = v;
			return true;
		}
		catch(e) {
		}
		if(Object.defineProperty) try {
			Object.defineProperty(o, p, {
				value: v,
				enumerable: true
			});
			return true;
		}
		catch(e) {
		}
		if(o.__defineGetter__) try {
			o.__defineGetter__(p, function() {
				return v;
			});
			return true;
		}
		catch(e) {
		}
		return false;
	},
	addProperties: function(o, add) {
		for(var p in add) if(!(p in o)) {
			var v = add[p];
			o[p] = typeof v == "function"
				? (function(f) {
					return function() {
						return f.apply(add, arguments);
					};
				})(v)
				: v;
		}
		return o;
	}
};