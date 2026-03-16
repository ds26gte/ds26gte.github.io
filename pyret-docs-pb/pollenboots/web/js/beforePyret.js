/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "./node_modules/q/q.js":
/*!*****************************!*\
  !*** ./node_modules/q/q.js ***!
  \*****************************/
/***/ ((module) => {

// vim:ts=4:sts=4:sw=4:
/*!
 *
 * Copyright 2009-2012 Kris Kowal under the terms of the MIT
 * license found at http://github.com/kriskowal/q/raw/master/LICENSE
 *
 * With parts by Tyler Close
 * Copyright 2007-2009 Tyler Close under the terms of the MIT X license found
 * at http://www.opensource.org/licenses/mit-license.html
 * Forked at ref_send.js version: 2009-05-11
 *
 * With parts by Mark Miller
 * Copyright (C) 2011 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

(function (definition) {
    "use strict";

    // This file will function properly as a <script> tag, or a module
    // using CommonJS and NodeJS or RequireJS module formats.  In
    // Common/Node/RequireJS, the module exports the Q API and when
    // executed as a simple <script>, it creates a Q global instead.

    // Montage Require
    if (typeof bootstrap === "function") {
        bootstrap("promise", definition);

    // CommonJS
    } else if (true) {
        module.exports = definition();

    // RequireJS
    } else { var previousQ, global; }

})(function () {
"use strict";

var hasStacks = false;
try {
    throw new Error();
} catch (e) {
    hasStacks = !!e.stack;
}

// All code after this point will be filtered from stack traces reported
// by Q.
var qStartingLine = captureLine();
var qFileName;

// shims

// used for fallback in "allResolved"
var noop = function () {};

// Use the fastest possible means to execute a task in a future turn
// of the event loop.
var nextTick =(function () {
    // linked list of tasks (single, with head node)
    var head = {task: void 0, next: null};
    var tail = head;
    var flushing = false;
    var requestTick = void 0;
    var isNodeJS = false;
    // queue for late tasks, used by unhandled rejection tracking
    var laterQueue = [];

    function flush() {
        /* jshint loopfunc: true */
        var task, domain;

        while (head.next) {
            head = head.next;
            task = head.task;
            head.task = void 0;
            domain = head.domain;

            if (domain) {
                head.domain = void 0;
                domain.enter();
            }
            runSingle(task, domain);

        }
        while (laterQueue.length) {
            task = laterQueue.pop();
            runSingle(task);
        }
        flushing = false;
    }
    // runs a single function in the async queue
    function runSingle(task, domain) {
        try {
            task();

        } catch (e) {
            if (isNodeJS) {
                // In node, uncaught exceptions are considered fatal errors.
                // Re-throw them synchronously to interrupt flushing!

                // Ensure continuation if the uncaught exception is suppressed
                // listening "uncaughtException" events (as domains does).
                // Continue in next event to avoid tick recursion.
                if (domain) {
                    domain.exit();
                }
                setTimeout(flush, 0);
                if (domain) {
                    domain.enter();
                }

                throw e;

            } else {
                // In browsers, uncaught exceptions are not fatal.
                // Re-throw them asynchronously to avoid slow-downs.
                setTimeout(function () {
                    throw e;
                }, 0);
            }
        }

        if (domain) {
            domain.exit();
        }
    }

    nextTick = function (task) {
        tail = tail.next = {
            task: task,
            domain: isNodeJS && process.domain,
            next: null
        };

        if (!flushing) {
            flushing = true;
            requestTick();
        }
    };

    if (typeof process === "object" &&
        process.toString() === "[object process]" && process.nextTick) {
        // Ensure Q is in a real Node environment, with a `process.nextTick`.
        // To see through fake Node environments:
        // * Mocha test runner - exposes a `process` global without a `nextTick`
        // * Browserify - exposes a `process.nexTick` function that uses
        //   `setTimeout`. In this case `setImmediate` is preferred because
        //    it is faster. Browserify's `process.toString()` yields
        //   "[object Object]", while in a real Node environment
        //   `process.nextTick()` yields "[object process]".
        isNodeJS = true;

        requestTick = function () {
            process.nextTick(flush);
        };

    } else if (typeof setImmediate === "function") {
        // In IE10, Node.js 0.9+, or https://github.com/NobleJS/setImmediate
        if (typeof window !== "undefined") {
            requestTick = setImmediate.bind(window, flush);
        } else {
            requestTick = function () {
                setImmediate(flush);
            };
        }

    } else if (typeof MessageChannel !== "undefined") {
        // modern browsers
        // http://www.nonblocking.io/2011/06/windownexttick.html
        var channel = new MessageChannel();
        // At least Safari Version 6.0.5 (8536.30.1) intermittently cannot create
        // working message ports the first time a page loads.
        channel.port1.onmessage = function () {
            requestTick = requestPortTick;
            channel.port1.onmessage = flush;
            flush();
        };
        var requestPortTick = function () {
            // Opera requires us to provide a message payload, regardless of
            // whether we use it.
            channel.port2.postMessage(0);
        };
        requestTick = function () {
            setTimeout(flush, 0);
            requestPortTick();
        };

    } else {
        // old browsers
        requestTick = function () {
            setTimeout(flush, 0);
        };
    }
    // runs a task after all other tasks have been run
    // this is useful for unhandled rejection tracking that needs to happen
    // after all `then`d tasks have been run.
    nextTick.runAfter = function (task) {
        laterQueue.push(task);
        if (!flushing) {
            flushing = true;
            requestTick();
        }
    };
    return nextTick;
})();

// Attempt to make generics safe in the face of downstream
// modifications.
// There is no situation where this is necessary.
// If you need a security guarantee, these primordials need to be
// deeply frozen anyway, and if you don’t need a security guarantee,
// this is just plain paranoid.
// However, this **might** have the nice side-effect of reducing the size of
// the minified code by reducing x.call() to merely x()
// See Mark Miller’s explanation of what this does.
// http://wiki.ecmascript.org/doku.php?id=conventions:safe_meta_programming
var call = Function.call;
function uncurryThis(f) {
    return function () {
        return call.apply(f, arguments);
    };
}
// This is equivalent, but slower:
// uncurryThis = Function_bind.bind(Function_bind.call);
// http://jsperf.com/uncurrythis

var array_slice = uncurryThis(Array.prototype.slice);

var array_reduce = uncurryThis(
    Array.prototype.reduce || function (callback, basis) {
        var index = 0,
            length = this.length;
        // concerning the initial value, if one is not provided
        if (arguments.length === 1) {
            // seek to the first value in the array, accounting
            // for the possibility that is is a sparse array
            do {
                if (index in this) {
                    basis = this[index++];
                    break;
                }
                if (++index >= length) {
                    throw new TypeError();
                }
            } while (1);
        }
        // reduce
        for (; index < length; index++) {
            // account for the possibility that the array is sparse
            if (index in this) {
                basis = callback(basis, this[index], index);
            }
        }
        return basis;
    }
);

var array_indexOf = uncurryThis(
    Array.prototype.indexOf || function (value) {
        // not a very good shim, but good enough for our one use of it
        for (var i = 0; i < this.length; i++) {
            if (this[i] === value) {
                return i;
            }
        }
        return -1;
    }
);

var array_map = uncurryThis(
    Array.prototype.map || function (callback, thisp) {
        var self = this;
        var collect = [];
        array_reduce(self, function (undefined, value, index) {
            collect.push(callback.call(thisp, value, index, self));
        }, void 0);
        return collect;
    }
);

var object_create = Object.create || function (prototype) {
    function Type() { }
    Type.prototype = prototype;
    return new Type();
};

var object_hasOwnProperty = uncurryThis(Object.prototype.hasOwnProperty);

var object_keys = Object.keys || function (object) {
    var keys = [];
    for (var key in object) {
        if (object_hasOwnProperty(object, key)) {
            keys.push(key);
        }
    }
    return keys;
};

var object_toString = uncurryThis(Object.prototype.toString);

function isObject(value) {
    return value === Object(value);
}

// generator related shims

// FIXME: Remove this function once ES6 generators are in SpiderMonkey.
function isStopIteration(exception) {
    return (
        object_toString(exception) === "[object StopIteration]" ||
        exception instanceof QReturnValue
    );
}

// FIXME: Remove this helper and Q.return once ES6 generators are in
// SpiderMonkey.
var QReturnValue;
if (typeof ReturnValue !== "undefined") {
    QReturnValue = ReturnValue;
} else {
    QReturnValue = function (value) {
        this.value = value;
    };
}

// long stack traces

var STACK_JUMP_SEPARATOR = "From previous event:";

function makeStackTraceLong(error, promise) {
    // If possible, transform the error stack trace by removing Node and Q
    // cruft, then concatenating with the stack trace of `promise`. See #57.
    if (hasStacks &&
        promise.stack &&
        typeof error === "object" &&
        error !== null &&
        error.stack &&
        error.stack.indexOf(STACK_JUMP_SEPARATOR) === -1
    ) {
        var stacks = [];
        for (var p = promise; !!p; p = p.source) {
            if (p.stack) {
                stacks.unshift(p.stack);
            }
        }
        stacks.unshift(error.stack);

        var concatedStacks = stacks.join("\n" + STACK_JUMP_SEPARATOR + "\n");
        error.stack = filterStackString(concatedStacks);
    }
}

function filterStackString(stackString) {
    var lines = stackString.split("\n");
    var desiredLines = [];
    for (var i = 0; i < lines.length; ++i) {
        var line = lines[i];

        if (!isInternalFrame(line) && !isNodeFrame(line) && line) {
            desiredLines.push(line);
        }
    }
    return desiredLines.join("\n");
}

function isNodeFrame(stackLine) {
    return stackLine.indexOf("(module.js:") !== -1 ||
           stackLine.indexOf("(node.js:") !== -1;
}

function getFileNameAndLineNumber(stackLine) {
    // Named functions: "at functionName (filename:lineNumber:columnNumber)"
    // In IE10 function name can have spaces ("Anonymous function") O_o
    var attempt1 = /at .+ \((.+):(\d+):(?:\d+)\)$/.exec(stackLine);
    if (attempt1) {
        return [attempt1[1], Number(attempt1[2])];
    }

    // Anonymous functions: "at filename:lineNumber:columnNumber"
    var attempt2 = /at ([^ ]+):(\d+):(?:\d+)$/.exec(stackLine);
    if (attempt2) {
        return [attempt2[1], Number(attempt2[2])];
    }

    // Firefox style: "function@filename:lineNumber or @filename:lineNumber"
    var attempt3 = /.*@(.+):(\d+)$/.exec(stackLine);
    if (attempt3) {
        return [attempt3[1], Number(attempt3[2])];
    }
}

function isInternalFrame(stackLine) {
    var fileNameAndLineNumber = getFileNameAndLineNumber(stackLine);

    if (!fileNameAndLineNumber) {
        return false;
    }

    var fileName = fileNameAndLineNumber[0];
    var lineNumber = fileNameAndLineNumber[1];

    return fileName === qFileName &&
        lineNumber >= qStartingLine &&
        lineNumber <= qEndingLine;
}

// discover own file name and line number range for filtering stack
// traces
function captureLine() {
    if (!hasStacks) {
        return;
    }

    try {
        throw new Error();
    } catch (e) {
        var lines = e.stack.split("\n");
        var firstLine = lines[0].indexOf("@") > 0 ? lines[1] : lines[2];
        var fileNameAndLineNumber = getFileNameAndLineNumber(firstLine);
        if (!fileNameAndLineNumber) {
            return;
        }

        qFileName = fileNameAndLineNumber[0];
        return fileNameAndLineNumber[1];
    }
}

function deprecate(callback, name, alternative) {
    return function () {
        if (typeof console !== "undefined" &&
            typeof console.warn === "function") {
            console.warn(name + " is deprecated, use " + alternative +
                         " instead.", new Error("").stack);
        }
        return callback.apply(callback, arguments);
    };
}

// end of shims
// beginning of real work

/**
 * Constructs a promise for an immediate reference, passes promises through, or
 * coerces promises from different systems.
 * @param value immediate reference or promise
 */
function Q(value) {
    // If the object is already a Promise, return it directly.  This enables
    // the resolve function to both be used to created references from objects,
    // but to tolerably coerce non-promises to promises.
    if (value instanceof Promise) {
        return value;
    }

    // assimilate thenables
    if (isPromiseAlike(value)) {
        return coerce(value);
    } else {
        return fulfill(value);
    }
}
Q.resolve = Q;

/**
 * Performs a task in a future turn of the event loop.
 * @param {Function} task
 */
Q.nextTick = nextTick;

/**
 * Controls whether or not long stack traces will be on
 */
Q.longStackSupport = false;

// enable long stacks if Q_DEBUG is set
if (typeof process === "object" && process && process.env && process.env.Q_DEBUG) {
    Q.longStackSupport = true;
}

/**
 * Constructs a {promise, resolve, reject} object.
 *
 * `resolve` is a callback to invoke with a more resolved value for the
 * promise. To fulfill the promise, invoke `resolve` with any value that is
 * not a thenable. To reject the promise, invoke `resolve` with a rejected
 * thenable, or invoke `reject` with the reason directly. To resolve the
 * promise to another thenable, thus putting it in the same state, invoke
 * `resolve` with that other thenable.
 */
Q.defer = defer;
function defer() {
    // if "messages" is an "Array", that indicates that the promise has not yet
    // been resolved.  If it is "undefined", it has been resolved.  Each
    // element of the messages array is itself an array of complete arguments to
    // forward to the resolved promise.  We coerce the resolution value to a
    // promise using the `resolve` function because it handles both fully
    // non-thenable values and other thenables gracefully.
    var messages = [], progressListeners = [], resolvedPromise;

    var deferred = object_create(defer.prototype);
    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, operands) {
        var args = array_slice(arguments);
        if (messages) {
            messages.push(args);
            if (op === "when" && operands[1]) { // progress operand
                progressListeners.push(operands[1]);
            }
        } else {
            Q.nextTick(function () {
                resolvedPromise.promiseDispatch.apply(resolvedPromise, args);
            });
        }
    };

    // XXX deprecated
    promise.valueOf = function () {
        if (messages) {
            return promise;
        }
        var nearerValue = nearer(resolvedPromise);
        if (isPromise(nearerValue)) {
            resolvedPromise = nearerValue; // shorten chain
        }
        return nearerValue;
    };

    promise.inspect = function () {
        if (!resolvedPromise) {
            return { state: "pending" };
        }
        return resolvedPromise.inspect();
    };

    if (Q.longStackSupport && hasStacks) {
        try {
            throw new Error();
        } catch (e) {
            // NOTE: don't try to use `Error.captureStackTrace` or transfer the
            // accessor around; that causes memory leaks as per GH-111. Just
            // reify the stack trace as a string ASAP.
            //
            // At the same time, cut off the first line; it's always just
            // "[object Promise]\n", as per the `toString`.
            promise.stack = e.stack.substring(e.stack.indexOf("\n") + 1);
        }
    }

    // NOTE: we do the checks for `resolvedPromise` in each method, instead of
    // consolidating them into `become`, since otherwise we'd create new
    // promises with the lines `become(whatever(value))`. See e.g. GH-252.

    function become(newPromise) {
        resolvedPromise = newPromise;
        promise.source = newPromise;

        array_reduce(messages, function (undefined, message) {
            Q.nextTick(function () {
                newPromise.promiseDispatch.apply(newPromise, message);
            });
        }, void 0);

        messages = void 0;
        progressListeners = void 0;
    }

    deferred.promise = promise;
    deferred.resolve = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(Q(value));
    };

    deferred.fulfill = function (value) {
        if (resolvedPromise) {
            return;
        }

        become(fulfill(value));
    };
    deferred.reject = function (reason) {
        if (resolvedPromise) {
            return;
        }

        become(reject(reason));
    };
    deferred.notify = function (progress) {
        if (resolvedPromise) {
            return;
        }

        array_reduce(progressListeners, function (undefined, progressListener) {
            Q.nextTick(function () {
                progressListener(progress);
            });
        }, void 0);
    };

    return deferred;
}

/**
 * Creates a Node-style callback that will resolve or reject the deferred
 * promise.
 * @returns a nodeback
 */
defer.prototype.makeNodeResolver = function () {
    var self = this;
    return function (error, value) {
        if (error) {
            self.reject(error);
        } else if (arguments.length > 2) {
            self.resolve(array_slice(arguments, 1));
        } else {
            self.resolve(value);
        }
    };
};

/**
 * @param resolver {Function} a function that returns nothing and accepts
 * the resolve, reject, and notify functions for a deferred.
 * @returns a promise that may be resolved with the given resolve and reject
 * functions, or rejected by a thrown exception in resolver
 */
Q.Promise = promise; // ES6
Q.promise = promise;
function promise(resolver) {
    if (typeof resolver !== "function") {
        throw new TypeError("resolver must be a function.");
    }
    var deferred = defer();
    try {
        resolver(deferred.resolve, deferred.reject, deferred.notify);
    } catch (reason) {
        deferred.reject(reason);
    }
    return deferred.promise;
}

promise.race = race; // ES6
promise.all = all; // ES6
promise.reject = reject; // ES6
promise.resolve = Q; // ES6

// XXX experimental.  This method is a way to denote that a local value is
// serializable and should be immediately dispatched to a remote upon request,
// instead of passing a reference.
Q.passByCopy = function (object) {
    //freeze(object);
    //passByCopies.set(object, true);
    return object;
};

Promise.prototype.passByCopy = function () {
    //freeze(object);
    //passByCopies.set(object, true);
    return this;
};

/**
 * If two promises eventually fulfill to the same value, promises that value,
 * but otherwise rejects.
 * @param x {Any*}
 * @param y {Any*}
 * @returns {Any*} a promise for x and y if they are the same, but a rejection
 * otherwise.
 *
 */
Q.join = function (x, y) {
    return Q(x).join(y);
};

Promise.prototype.join = function (that) {
    return Q([this, that]).spread(function (x, y) {
        if (x === y) {
            // TODO: "===" should be Object.is or equiv
            return x;
        } else {
            throw new Error("Can't join: not the same: " + x + " " + y);
        }
    });
};

/**
 * Returns a promise for the first of an array of promises to become settled.
 * @param answers {Array[Any*]} promises to race
 * @returns {Any*} the first promise to be settled
 */
Q.race = race;
function race(answerPs) {
    return promise(function (resolve, reject) {
        // Switch to this once we can assume at least ES5
        // answerPs.forEach(function (answerP) {
        //     Q(answerP).then(resolve, reject);
        // });
        // Use this in the meantime
        for (var i = 0, len = answerPs.length; i < len; i++) {
            Q(answerPs[i]).then(resolve, reject);
        }
    });
}

Promise.prototype.race = function () {
    return this.then(Q.race);
};

/**
 * Constructs a Promise with a promise descriptor object and optional fallback
 * function.  The descriptor contains methods like when(rejected), get(name),
 * set(name, value), post(name, args), and delete(name), which all
 * return either a value, a promise for a value, or a rejection.  The fallback
 * accepts the operation name, a resolver, and any further arguments that would
 * have been forwarded to the appropriate method above had a method been
 * provided with the proper name.  The API makes no guarantees about the nature
 * of the returned object, apart from that it is usable whereever promises are
 * bought and sold.
 */
Q.makePromise = Promise;
function Promise(descriptor, fallback, inspect) {
    if (fallback === void 0) {
        fallback = function (op) {
            return reject(new Error(
                "Promise does not support operation: " + op
            ));
        };
    }
    if (inspect === void 0) {
        inspect = function () {
            return {state: "unknown"};
        };
    }

    var promise = object_create(Promise.prototype);

    promise.promiseDispatch = function (resolve, op, args) {
        var result;
        try {
            if (descriptor[op]) {
                result = descriptor[op].apply(promise, args);
            } else {
                result = fallback.call(promise, op, args);
            }
        } catch (exception) {
            result = reject(exception);
        }
        if (resolve) {
            resolve(result);
        }
    };

    promise.inspect = inspect;

    // XXX deprecated `valueOf` and `exception` support
    if (inspect) {
        var inspected = inspect();
        if (inspected.state === "rejected") {
            promise.exception = inspected.reason;
        }

        promise.valueOf = function () {
            var inspected = inspect();
            if (inspected.state === "pending" ||
                inspected.state === "rejected") {
                return promise;
            }
            return inspected.value;
        };
    }

    return promise;
}

Promise.prototype.toString = function () {
    return "[object Promise]";
};

Promise.prototype.then = function (fulfilled, rejected, progressed) {
    var self = this;
    var deferred = defer();
    var done = false;   // ensure the untrusted promise makes at most a
                        // single call to one of the callbacks

    function _fulfilled(value) {
        try {
            return typeof fulfilled === "function" ? fulfilled(value) : value;
        } catch (exception) {
            return reject(exception);
        }
    }

    function _rejected(exception) {
        if (typeof rejected === "function") {
            makeStackTraceLong(exception, self);
            try {
                return rejected(exception);
            } catch (newException) {
                return reject(newException);
            }
        }
        return reject(exception);
    }

    function _progressed(value) {
        return typeof progressed === "function" ? progressed(value) : value;
    }

    Q.nextTick(function () {
        self.promiseDispatch(function (value) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_fulfilled(value));
        }, "when", [function (exception) {
            if (done) {
                return;
            }
            done = true;

            deferred.resolve(_rejected(exception));
        }]);
    });

    // Progress propagator need to be attached in the current tick.
    self.promiseDispatch(void 0, "when", [void 0, function (value) {
        var newValue;
        var threw = false;
        try {
            newValue = _progressed(value);
        } catch (e) {
            threw = true;
            if (Q.onerror) {
                Q.onerror(e);
            } else {
                throw e;
            }
        }

        if (!threw) {
            deferred.notify(newValue);
        }
    }]);

    return deferred.promise;
};

Q.tap = function (promise, callback) {
    return Q(promise).tap(callback);
};

/**
 * Works almost like "finally", but not called for rejections.
 * Original resolution value is passed through callback unaffected.
 * Callback may return a promise that will be awaited for.
 * @param {Function} callback
 * @returns {Q.Promise}
 * @example
 * doSomething()
 *   .then(...)
 *   .tap(console.log)
 *   .then(...);
 */
Promise.prototype.tap = function (callback) {
    callback = Q(callback);

    return this.then(function (value) {
        return callback.fcall(value).thenResolve(value);
    });
};

/**
 * Registers an observer on a promise.
 *
 * Guarantees:
 *
 * 1. that fulfilled and rejected will be called only once.
 * 2. that either the fulfilled callback or the rejected callback will be
 *    called, but not both.
 * 3. that fulfilled and rejected will not be called in this turn.
 *
 * @param value      promise or immediate reference to observe
 * @param fulfilled  function to be called with the fulfilled value
 * @param rejected   function to be called with the rejection exception
 * @param progressed function to be called on any progress notifications
 * @return promise for the return value from the invoked callback
 */
Q.when = when;
function when(value, fulfilled, rejected, progressed) {
    return Q(value).then(fulfilled, rejected, progressed);
}

Promise.prototype.thenResolve = function (value) {
    return this.then(function () { return value; });
};

Q.thenResolve = function (promise, value) {
    return Q(promise).thenResolve(value);
};

Promise.prototype.thenReject = function (reason) {
    return this.then(function () { throw reason; });
};

Q.thenReject = function (promise, reason) {
    return Q(promise).thenReject(reason);
};

/**
 * If an object is not a promise, it is as "near" as possible.
 * If a promise is rejected, it is as "near" as possible too.
 * If it’s a fulfilled promise, the fulfillment value is nearer.
 * If it’s a deferred promise and the deferred has been resolved, the
 * resolution is "nearer".
 * @param object
 * @returns most resolved (nearest) form of the object
 */

// XXX should we re-do this?
Q.nearer = nearer;
function nearer(value) {
    if (isPromise(value)) {
        var inspected = value.inspect();
        if (inspected.state === "fulfilled") {
            return inspected.value;
        }
    }
    return value;
}

/**
 * @returns whether the given object is a promise.
 * Otherwise it is a fulfilled value.
 */
Q.isPromise = isPromise;
function isPromise(object) {
    return object instanceof Promise;
}

Q.isPromiseAlike = isPromiseAlike;
function isPromiseAlike(object) {
    return isObject(object) && typeof object.then === "function";
}

/**
 * @returns whether the given object is a pending promise, meaning not
 * fulfilled or rejected.
 */
Q.isPending = isPending;
function isPending(object) {
    return isPromise(object) && object.inspect().state === "pending";
}

Promise.prototype.isPending = function () {
    return this.inspect().state === "pending";
};

/**
 * @returns whether the given object is a value or fulfilled
 * promise.
 */
Q.isFulfilled = isFulfilled;
function isFulfilled(object) {
    return !isPromise(object) || object.inspect().state === "fulfilled";
}

Promise.prototype.isFulfilled = function () {
    return this.inspect().state === "fulfilled";
};

/**
 * @returns whether the given object is a rejected promise.
 */
Q.isRejected = isRejected;
function isRejected(object) {
    return isPromise(object) && object.inspect().state === "rejected";
}

Promise.prototype.isRejected = function () {
    return this.inspect().state === "rejected";
};

//// BEGIN UNHANDLED REJECTION TRACKING

// This promise library consumes exceptions thrown in handlers so they can be
// handled by a subsequent promise.  The exceptions get added to this array when
// they are created, and removed when they are handled.  Note that in ES6 or
// shimmed environments, this would naturally be a `Set`.
var unhandledReasons = [];
var unhandledRejections = [];
var reportedUnhandledRejections = [];
var trackUnhandledRejections = true;

function resetUnhandledRejections() {
    unhandledReasons.length = 0;
    unhandledRejections.length = 0;

    if (!trackUnhandledRejections) {
        trackUnhandledRejections = true;
    }
}

function trackRejection(promise, reason) {
    if (!trackUnhandledRejections) {
        return;
    }
    if (typeof process === "object" && typeof process.emit === "function") {
        Q.nextTick.runAfter(function () {
            if (array_indexOf(unhandledRejections, promise) !== -1) {
                process.emit("unhandledRejection", reason, promise);
                reportedUnhandledRejections.push(promise);
            }
        });
    }

    unhandledRejections.push(promise);
    if (reason && typeof reason.stack !== "undefined") {
        unhandledReasons.push(reason.stack);
    } else {
        unhandledReasons.push("(no stack) " + reason);
    }
}

function untrackRejection(promise) {
    if (!trackUnhandledRejections) {
        return;
    }

    var at = array_indexOf(unhandledRejections, promise);
    if (at !== -1) {
        if (typeof process === "object" && typeof process.emit === "function") {
            Q.nextTick.runAfter(function () {
                var atReport = array_indexOf(reportedUnhandledRejections, promise);
                if (atReport !== -1) {
                    process.emit("rejectionHandled", unhandledReasons[at], promise);
                    reportedUnhandledRejections.splice(atReport, 1);
                }
            });
        }
        unhandledRejections.splice(at, 1);
        unhandledReasons.splice(at, 1);
    }
}

Q.resetUnhandledRejections = resetUnhandledRejections;

Q.getUnhandledReasons = function () {
    // Make a copy so that consumers can't interfere with our internal state.
    return unhandledReasons.slice();
};

Q.stopUnhandledRejectionTracking = function () {
    resetUnhandledRejections();
    trackUnhandledRejections = false;
};

resetUnhandledRejections();

//// END UNHANDLED REJECTION TRACKING

/**
 * Constructs a rejected promise.
 * @param reason value describing the failure
 */
Q.reject = reject;
function reject(reason) {
    var rejection = Promise({
        "when": function (rejected) {
            // note that the error has been handled
            if (rejected) {
                untrackRejection(this);
            }
            return rejected ? rejected(reason) : this;
        }
    }, function fallback() {
        return this;
    }, function inspect() {
        return { state: "rejected", reason: reason };
    });

    // Note that the reason has not been handled.
    trackRejection(rejection, reason);

    return rejection;
}

/**
 * Constructs a fulfilled promise for an immediate reference.
 * @param value immediate reference
 */
Q.fulfill = fulfill;
function fulfill(value) {
    return Promise({
        "when": function () {
            return value;
        },
        "get": function (name) {
            return value[name];
        },
        "set": function (name, rhs) {
            value[name] = rhs;
        },
        "delete": function (name) {
            delete value[name];
        },
        "post": function (name, args) {
            // Mark Miller proposes that post with no name should apply a
            // promised function.
            if (name === null || name === void 0) {
                return value.apply(void 0, args);
            } else {
                return value[name].apply(value, args);
            }
        },
        "apply": function (thisp, args) {
            return value.apply(thisp, args);
        },
        "keys": function () {
            return object_keys(value);
        }
    }, void 0, function inspect() {
        return { state: "fulfilled", value: value };
    });
}

/**
 * Converts thenables to Q promises.
 * @param promise thenable promise
 * @returns a Q promise
 */
function coerce(promise) {
    var deferred = defer();
    Q.nextTick(function () {
        try {
            promise.then(deferred.resolve, deferred.reject, deferred.notify);
        } catch (exception) {
            deferred.reject(exception);
        }
    });
    return deferred.promise;
}

/**
 * Annotates an object such that it will never be
 * transferred away from this process over any promise
 * communication channel.
 * @param object
 * @returns promise a wrapping of that object that
 * additionally responds to the "isDef" message
 * without a rejection.
 */
Q.master = master;
function master(object) {
    return Promise({
        "isDef": function () {}
    }, function fallback(op, args) {
        return dispatch(object, op, args);
    }, function () {
        return Q(object).inspect();
    });
}

/**
 * Spreads the values of a promised array of arguments into the
 * fulfillment callback.
 * @param fulfilled callback that receives variadic arguments from the
 * promised array
 * @param rejected callback that receives the exception if the promise
 * is rejected.
 * @returns a promise for the return value or thrown exception of
 * either callback.
 */
Q.spread = spread;
function spread(value, fulfilled, rejected) {
    return Q(value).spread(fulfilled, rejected);
}

Promise.prototype.spread = function (fulfilled, rejected) {
    return this.all().then(function (array) {
        return fulfilled.apply(void 0, array);
    }, rejected);
};

/**
 * The async function is a decorator for generator functions, turning
 * them into asynchronous generators.  Although generators are only part
 * of the newest ECMAScript 6 drafts, this code does not cause syntax
 * errors in older engines.  This code should continue to work and will
 * in fact improve over time as the language improves.
 *
 * ES6 generators are currently part of V8 version 3.19 with the
 * --harmony-generators runtime flag enabled.  SpiderMonkey has had them
 * for longer, but under an older Python-inspired form.  This function
 * works on both kinds of generators.
 *
 * Decorates a generator function such that:
 *  - it may yield promises
 *  - execution will continue when that promise is fulfilled
 *  - the value of the yield expression will be the fulfilled value
 *  - it returns a promise for the return value (when the generator
 *    stops iterating)
 *  - the decorated function returns a promise for the return value
 *    of the generator or the first rejected promise among those
 *    yielded.
 *  - if an error is thrown in the generator, it propagates through
 *    every following yield until it is caught, or until it escapes
 *    the generator function altogether, and is translated into a
 *    rejection for the promise returned by the decorated generator.
 */
Q.async = async;
function async(makeGenerator) {
    return function () {
        // when verb is "send", arg is a value
        // when verb is "throw", arg is an exception
        function continuer(verb, arg) {
            var result;

            // Until V8 3.19 / Chromium 29 is released, SpiderMonkey is the only
            // engine that has a deployed base of browsers that support generators.
            // However, SM's generators use the Python-inspired semantics of
            // outdated ES6 drafts.  We would like to support ES6, but we'd also
            // like to make it possible to use generators in deployed browsers, so
            // we also support Python-style generators.  At some point we can remove
            // this block.

            if (typeof StopIteration === "undefined") {
                // ES6 Generators
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    return reject(exception);
                }
                if (result.done) {
                    return Q(result.value);
                } else {
                    return when(result.value, callback, errback);
                }
            } else {
                // SpiderMonkey Generators
                // FIXME: Remove this case when SM does ES6 generators.
                try {
                    result = generator[verb](arg);
                } catch (exception) {
                    if (isStopIteration(exception)) {
                        return Q(exception.value);
                    } else {
                        return reject(exception);
                    }
                }
                return when(result, callback, errback);
            }
        }
        var generator = makeGenerator.apply(this, arguments);
        var callback = continuer.bind(continuer, "next");
        var errback = continuer.bind(continuer, "throw");
        return callback();
    };
}

/**
 * The spawn function is a small wrapper around async that immediately
 * calls the generator and also ends the promise chain, so that any
 * unhandled errors are thrown instead of forwarded to the error
 * handler. This is useful because it's extremely common to run
 * generators at the top-level to work with libraries.
 */
Q.spawn = spawn;
function spawn(makeGenerator) {
    Q.done(Q.async(makeGenerator)());
}

// FIXME: Remove this interface once ES6 generators are in SpiderMonkey.
/**
 * Throws a ReturnValue exception to stop an asynchronous generator.
 *
 * This interface is a stop-gap measure to support generator return
 * values in older Firefox/SpiderMonkey.  In browsers that support ES6
 * generators like Chromium 29, just use "return" in your generator
 * functions.
 *
 * @param value the return value for the surrounding generator
 * @throws ReturnValue exception with the value.
 * @example
 * // ES6 style
 * Q.async(function* () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      return foo + bar;
 * })
 * // Older SpiderMonkey style
 * Q.async(function () {
 *      var foo = yield getFooPromise();
 *      var bar = yield getBarPromise();
 *      Q.return(foo + bar);
 * })
 */
Q["return"] = _return;
function _return(value) {
    throw new QReturnValue(value);
}

/**
 * The promised function decorator ensures that any promise arguments
 * are settled and passed as values (`this` is also settled and passed
 * as a value).  It will also ensure that the result of a function is
 * always a promise.
 *
 * @example
 * var add = Q.promised(function (a, b) {
 *     return a + b;
 * });
 * add(Q(a), Q(B));
 *
 * @param {function} callback The function to decorate
 * @returns {function} a function that has been decorated.
 */
Q.promised = promised;
function promised(callback) {
    return function () {
        return spread([this, all(arguments)], function (self, args) {
            return callback.apply(self, args);
        });
    };
}

/**
 * sends a message to a value in a future turn
 * @param object* the recipient
 * @param op the name of the message operation, e.g., "when",
 * @param args further arguments to be forwarded to the operation
 * @returns result {Promise} a promise for the result of the operation
 */
Q.dispatch = dispatch;
function dispatch(object, op, args) {
    return Q(object).dispatch(op, args);
}

Promise.prototype.dispatch = function (op, args) {
    var self = this;
    var deferred = defer();
    Q.nextTick(function () {
        self.promiseDispatch(deferred.resolve, op, args);
    });
    return deferred.promise;
};

/**
 * Gets the value of a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to get
 * @return promise for the property value
 */
Q.get = function (object, key) {
    return Q(object).dispatch("get", [key]);
};

Promise.prototype.get = function (key) {
    return this.dispatch("get", [key]);
};

/**
 * Sets the value of a property in a future turn.
 * @param object    promise or immediate reference for object object
 * @param name      name of property to set
 * @param value     new value of property
 * @return promise for the return value
 */
Q.set = function (object, key, value) {
    return Q(object).dispatch("set", [key, value]);
};

Promise.prototype.set = function (key, value) {
    return this.dispatch("set", [key, value]);
};

/**
 * Deletes a property in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of property to delete
 * @return promise for the return value
 */
Q.del = // XXX legacy
Q["delete"] = function (object, key) {
    return Q(object).dispatch("delete", [key]);
};

Promise.prototype.del = // XXX legacy
Promise.prototype["delete"] = function (key) {
    return this.dispatch("delete", [key]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param value     a value to post, typically an array of
 *                  invocation arguments for promises that
 *                  are ultimately backed with `resolve` values,
 *                  as opposed to those backed with URLs
 *                  wherein the posted value can be any
 *                  JSON serializable object.
 * @return promise for the return value
 */
// bound locally because it is used by other methods
Q.mapply = // XXX As proposed by "Redsandro"
Q.post = function (object, name, args) {
    return Q(object).dispatch("post", [name, args]);
};

Promise.prototype.mapply = // XXX As proposed by "Redsandro"
Promise.prototype.post = function (name, args) {
    return this.dispatch("post", [name, args]);
};

/**
 * Invokes a method in a future turn.
 * @param object    promise or immediate reference for target object
 * @param name      name of method to invoke
 * @param ...args   array of invocation arguments
 * @return promise for the return value
 */
Q.send = // XXX Mark Miller's proposed parlance
Q.mcall = // XXX As proposed by "Redsandro"
Q.invoke = function (object, name /*...args*/) {
    return Q(object).dispatch("post", [name, array_slice(arguments, 2)]);
};

Promise.prototype.send = // XXX Mark Miller's proposed parlance
Promise.prototype.mcall = // XXX As proposed by "Redsandro"
Promise.prototype.invoke = function (name /*...args*/) {
    return this.dispatch("post", [name, array_slice(arguments, 1)]);
};

/**
 * Applies the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param args      array of application arguments
 */
Q.fapply = function (object, args) {
    return Q(object).dispatch("apply", [void 0, args]);
};

Promise.prototype.fapply = function (args) {
    return this.dispatch("apply", [void 0, args]);
};

/**
 * Calls the promised function in a future turn.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q["try"] =
Q.fcall = function (object /* ...args*/) {
    return Q(object).dispatch("apply", [void 0, array_slice(arguments, 1)]);
};

Promise.prototype.fcall = function (/*...args*/) {
    return this.dispatch("apply", [void 0, array_slice(arguments)]);
};

/**
 * Binds the promised function, transforming return values into a fulfilled
 * promise and thrown errors into a rejected one.
 * @param object    promise or immediate reference for target function
 * @param ...args   array of application arguments
 */
Q.fbind = function (object /*...args*/) {
    var promise = Q(object);
    var args = array_slice(arguments, 1);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};
Promise.prototype.fbind = function (/*...args*/) {
    var promise = this;
    var args = array_slice(arguments);
    return function fbound() {
        return promise.dispatch("apply", [
            this,
            args.concat(array_slice(arguments))
        ]);
    };
};

/**
 * Requests the names of the owned properties of a promised
 * object in a future turn.
 * @param object    promise or immediate reference for target object
 * @return promise for the keys of the eventually settled object
 */
Q.keys = function (object) {
    return Q(object).dispatch("keys", []);
};

Promise.prototype.keys = function () {
    return this.dispatch("keys", []);
};

/**
 * Turns an array of promises into a promise for an array.  If any of
 * the promises gets rejected, the whole array is rejected immediately.
 * @param {Array*} an array (or promise for an array) of values (or
 * promises for values)
 * @returns a promise for an array of the corresponding values
 */
// By Mark Miller
// http://wiki.ecmascript.org/doku.php?id=strawman:concurrency&rev=1308776521#allfulfilled
Q.all = all;
function all(promises) {
    return when(promises, function (promises) {
        var pendingCount = 0;
        var deferred = defer();
        array_reduce(promises, function (undefined, promise, index) {
            var snapshot;
            if (
                isPromise(promise) &&
                (snapshot = promise.inspect()).state === "fulfilled"
            ) {
                promises[index] = snapshot.value;
            } else {
                ++pendingCount;
                when(
                    promise,
                    function (value) {
                        promises[index] = value;
                        if (--pendingCount === 0) {
                            deferred.resolve(promises);
                        }
                    },
                    deferred.reject,
                    function (progress) {
                        deferred.notify({ index: index, value: progress });
                    }
                );
            }
        }, void 0);
        if (pendingCount === 0) {
            deferred.resolve(promises);
        }
        return deferred.promise;
    });
}

Promise.prototype.all = function () {
    return all(this);
};

/**
 * Returns the first resolved promise of an array. Prior rejected promises are
 * ignored.  Rejects only if all promises are rejected.
 * @param {Array*} an array containing values or promises for values
 * @returns a promise fulfilled with the value of the first resolved promise,
 * or a rejected promise if all promises are rejected.
 */
Q.any = any;

function any(promises) {
    if (promises.length === 0) {
        return Q.resolve();
    }

    var deferred = Q.defer();
    var pendingCount = 0;
    array_reduce(promises, function (prev, current, index) {
        var promise = promises[index];

        pendingCount++;

        when(promise, onFulfilled, onRejected, onProgress);
        function onFulfilled(result) {
            deferred.resolve(result);
        }
        function onRejected() {
            pendingCount--;
            if (pendingCount === 0) {
                deferred.reject(new Error(
                    "Can't get fulfillment value from any promise, all " +
                    "promises were rejected."
                ));
            }
        }
        function onProgress(progress) {
            deferred.notify({
                index: index,
                value: progress
            });
        }
    }, undefined);

    return deferred.promise;
}

Promise.prototype.any = function () {
    return any(this);
};

/**
 * Waits for all promises to be settled, either fulfilled or
 * rejected.  This is distinct from `all` since that would stop
 * waiting at the first rejection.  The promise returned by
 * `allResolved` will never be rejected.
 * @param promises a promise for an array (or an array) of promises
 * (or values)
 * @return a promise for an array of promises
 */
Q.allResolved = deprecate(allResolved, "allResolved", "allSettled");
function allResolved(promises) {
    return when(promises, function (promises) {
        promises = array_map(promises, Q);
        return when(all(array_map(promises, function (promise) {
            return when(promise, noop, noop);
        })), function () {
            return promises;
        });
    });
}

Promise.prototype.allResolved = function () {
    return allResolved(this);
};

/**
 * @see Promise#allSettled
 */
Q.allSettled = allSettled;
function allSettled(promises) {
    return Q(promises).allSettled();
}

/**
 * Turns an array of promises into a promise for an array of their states (as
 * returned by `inspect`) when they have all settled.
 * @param {Array[Any*]} values an array (or promise for an array) of values (or
 * promises for values)
 * @returns {Array[State]} an array of states for the respective values.
 */
Promise.prototype.allSettled = function () {
    return this.then(function (promises) {
        return all(array_map(promises, function (promise) {
            promise = Q(promise);
            function regardless() {
                return promise.inspect();
            }
            return promise.then(regardless, regardless);
        }));
    });
};

/**
 * Captures the failure of a promise, giving an oportunity to recover
 * with a callback.  If the given promise is fulfilled, the returned
 * promise is fulfilled.
 * @param {Any*} promise for something
 * @param {Function} callback to fulfill the returned promise if the
 * given promise is rejected
 * @returns a promise for the return value of the callback
 */
Q.fail = // XXX legacy
Q["catch"] = function (object, rejected) {
    return Q(object).then(void 0, rejected);
};

Promise.prototype.fail = // XXX legacy
Promise.prototype["catch"] = function (rejected) {
    return this.then(void 0, rejected);
};

/**
 * Attaches a listener that can respond to progress notifications from a
 * promise's originating deferred. This listener receives the exact arguments
 * passed to ``deferred.notify``.
 * @param {Any*} promise for something
 * @param {Function} callback to receive any progress notifications
 * @returns the given promise, unchanged
 */
Q.progress = progress;
function progress(object, progressed) {
    return Q(object).then(void 0, void 0, progressed);
}

Promise.prototype.progress = function (progressed) {
    return this.then(void 0, void 0, progressed);
};

/**
 * Provides an opportunity to observe the settling of a promise,
 * regardless of whether the promise is fulfilled or rejected.  Forwards
 * the resolution to the returned promise when the callback is done.
 * The callback can return a promise to defer completion.
 * @param {Any*} promise
 * @param {Function} callback to observe the resolution of the given
 * promise, takes no arguments.
 * @returns a promise for the resolution of the given promise when
 * ``fin`` is done.
 */
Q.fin = // XXX legacy
Q["finally"] = function (object, callback) {
    return Q(object)["finally"](callback);
};

Promise.prototype.fin = // XXX legacy
Promise.prototype["finally"] = function (callback) {
    callback = Q(callback);
    return this.then(function (value) {
        return callback.fcall().then(function () {
            return value;
        });
    }, function (reason) {
        // TODO attempt to recycle the rejection with "this".
        return callback.fcall().then(function () {
            throw reason;
        });
    });
};

/**
 * Terminates a chain of promises, forcing rejections to be
 * thrown as exceptions.
 * @param {Any*} promise at the end of a chain of promises
 * @returns nothing
 */
Q.done = function (object, fulfilled, rejected, progress) {
    return Q(object).done(fulfilled, rejected, progress);
};

Promise.prototype.done = function (fulfilled, rejected, progress) {
    var onUnhandledError = function (error) {
        // forward to a future turn so that ``when``
        // does not catch it and turn it into a rejection.
        Q.nextTick(function () {
            makeStackTraceLong(error, promise);
            if (Q.onerror) {
                Q.onerror(error);
            } else {
                throw error;
            }
        });
    };

    // Avoid unnecessary `nextTick`ing via an unnecessary `when`.
    var promise = fulfilled || rejected || progress ?
        this.then(fulfilled, rejected, progress) :
        this;

    if (typeof process === "object" && process && process.domain) {
        onUnhandledError = process.domain.bind(onUnhandledError);
    }

    promise.then(void 0, onUnhandledError);
};

/**
 * Causes a promise to be rejected if it does not get fulfilled before
 * some milliseconds time out.
 * @param {Any*} promise
 * @param {Number} milliseconds timeout
 * @param {Any*} custom error message or Error object (optional)
 * @returns a promise for the resolution of the given promise if it is
 * fulfilled before the timeout, otherwise rejected.
 */
Q.timeout = function (object, ms, error) {
    return Q(object).timeout(ms, error);
};

Promise.prototype.timeout = function (ms, error) {
    var deferred = defer();
    var timeoutId = setTimeout(function () {
        if (!error || "string" === typeof error) {
            error = new Error(error || "Timed out after " + ms + " ms");
            error.code = "ETIMEDOUT";
        }
        deferred.reject(error);
    }, ms);

    this.then(function (value) {
        clearTimeout(timeoutId);
        deferred.resolve(value);
    }, function (exception) {
        clearTimeout(timeoutId);
        deferred.reject(exception);
    }, deferred.notify);

    return deferred.promise;
};

/**
 * Returns a promise for the given value (or promised value), some
 * milliseconds after it resolved. Passes rejections immediately.
 * @param {Any*} promise
 * @param {Number} milliseconds
 * @returns a promise for the resolution of the given promise after milliseconds
 * time has elapsed since the resolution of the given promise.
 * If the given promise rejects, that is passed immediately.
 */
Q.delay = function (object, timeout) {
    if (timeout === void 0) {
        timeout = object;
        object = void 0;
    }
    return Q(object).delay(timeout);
};

Promise.prototype.delay = function (timeout) {
    return this.then(function (value) {
        var deferred = defer();
        setTimeout(function () {
            deferred.resolve(value);
        }, timeout);
        return deferred.promise;
    });
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided as an array, and returns a promise.
 *
 *      Q.nfapply(FS.readFile, [__filename])
 *      .then(function (content) {
 *      })
 *
 */
Q.nfapply = function (callback, args) {
    return Q(callback).nfapply(args);
};

Promise.prototype.nfapply = function (args) {
    var deferred = defer();
    var nodeArgs = array_slice(args);
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Passes a continuation to a Node function, which is called with the given
 * arguments provided individually, and returns a promise.
 * @example
 * Q.nfcall(FS.readFile, __filename)
 * .then(function (content) {
 * })
 *
 */
Q.nfcall = function (callback /*...args*/) {
    var args = array_slice(arguments, 1);
    return Q(callback).nfapply(args);
};

Promise.prototype.nfcall = function (/*...args*/) {
    var nodeArgs = array_slice(arguments);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.fapply(nodeArgs).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Wraps a NodeJS continuation passing function and returns an equivalent
 * version that returns a promise.
 * @example
 * Q.nfbind(FS.readFile, __filename)("utf-8")
 * .then(console.log)
 * .done()
 */
Q.nfbind =
Q.denodeify = function (callback /*...args*/) {
    var baseArgs = array_slice(arguments, 1);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        Q(callback).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nfbind =
Promise.prototype.denodeify = function (/*...args*/) {
    var args = array_slice(arguments);
    args.unshift(this);
    return Q.denodeify.apply(void 0, args);
};

Q.nbind = function (callback, thisp /*...args*/) {
    var baseArgs = array_slice(arguments, 2);
    return function () {
        var nodeArgs = baseArgs.concat(array_slice(arguments));
        var deferred = defer();
        nodeArgs.push(deferred.makeNodeResolver());
        function bound() {
            return callback.apply(thisp, arguments);
        }
        Q(bound).fapply(nodeArgs).fail(deferred.reject);
        return deferred.promise;
    };
};

Promise.prototype.nbind = function (/*thisp, ...args*/) {
    var args = array_slice(arguments, 0);
    args.unshift(this);
    return Q.nbind.apply(void 0, args);
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback with a given array of arguments, plus a provided callback.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param {Array} args arguments to pass to the method; the callback
 * will be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nmapply = // XXX As proposed by "Redsandro"
Q.npost = function (object, name, args) {
    return Q(object).npost(name, args);
};

Promise.prototype.nmapply = // XXX As proposed by "Redsandro"
Promise.prototype.npost = function (name, args) {
    var nodeArgs = array_slice(args || []);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * Calls a method of a Node-style object that accepts a Node-style
 * callback, forwarding the given variadic arguments, plus a provided
 * callback argument.
 * @param object an object that has the named method
 * @param {String} name name of the method of object
 * @param ...args arguments to pass to the method; the callback will
 * be provided by Q and appended to these arguments.
 * @returns a promise for the value or error
 */
Q.nsend = // XXX Based on Mark Miller's proposed "send"
Q.nmcall = // XXX Based on "Redsandro's" proposal
Q.ninvoke = function (object, name /*...args*/) {
    var nodeArgs = array_slice(arguments, 2);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    Q(object).dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

Promise.prototype.nsend = // XXX Based on Mark Miller's proposed "send"
Promise.prototype.nmcall = // XXX Based on "Redsandro's" proposal
Promise.prototype.ninvoke = function (name /*...args*/) {
    var nodeArgs = array_slice(arguments, 1);
    var deferred = defer();
    nodeArgs.push(deferred.makeNodeResolver());
    this.dispatch("post", [name, nodeArgs]).fail(deferred.reject);
    return deferred.promise;
};

/**
 * If a function would like to support both Node continuation-passing-style and
 * promise-returning-style, it can end its internal promise chain with
 * `nodeify(nodeback)`, forwarding the optional nodeback argument.  If the user
 * elects to use a nodeback, the result will be sent there.  If they do not
 * pass a nodeback, they will receive the result promise.
 * @param object a result (or a promise for a result)
 * @param {Function} nodeback a Node.js-style callback
 * @returns either the promise or nothing
 */
Q.nodeify = nodeify;
function nodeify(object, nodeback) {
    return Q(object).nodeify(nodeback);
}

Promise.prototype.nodeify = function (nodeback) {
    if (nodeback) {
        this.then(function (value) {
            Q.nextTick(function () {
                nodeback(null, value);
            });
        }, function (error) {
            Q.nextTick(function () {
                nodeback(error);
            });
        });
    } else {
        return this;
    }
};

Q.noConflict = function() {
    throw new Error("Q.noConflict only works when Q is used as a global");
};

// All code before this point will be filtered from stack traces.
var qEndingLine = captureLine();

return Q;

});


/***/ }),

/***/ "./node_modules/url.js/url.js":
/*!************************************!*\
  !*** ./node_modules/url.js/url.js ***!
  \************************************/
/***/ ((module, exports, __webpack_require__) => {

var __WEBPACK_AMD_DEFINE_FACTORY__, __WEBPACK_AMD_DEFINE_RESULT__;// Copyright 2013-2014 Kevin Cox

/*******************************************************************************
*                                                                              *
*  This software is provided 'as-is', without any express or implied           *
*  warranty. In no event will the authors be held liable for any damages       *
*  arising from the use of this software.                                      *
*                                                                              *
*  Permission is granted to anyone to use this software for any purpose,       *
*  including commercial applications, and to alter it and redistribute it      *
*  freely, subject to the following restrictions:                              *
*                                                                              *
*  1. The origin of this software must not be misrepresented; you must not     *
*     claim that you wrote the original software. If you use this software in  *
*     a product, an acknowledgment in the product documentation would be       *
*     appreciated but is not required.                                         *
*                                                                              *
*  2. Altered source versions must be plainly marked as such, and must not be  *
*     misrepresented as being the original software.                           *
*                                                                              *
*  3. This notice may not be removed or altered from any source distribution.  *
*                                                                              *
*******************************************************************************/

+function(){
"use strict";

var array = /\[([^\[]*)\]$/;

/// URL Regex.
/**
 * This regex splits the URL into parts.  The capture groups catch the important
 * bits.
 * 
 * Each section is optional, so to work on any part find the correct top level
 * `(...)?` and mess around with it.
 */
var regex = /^(?:([a-z]*):)?(?:\/\/)?(?:([^:@]*)(?::([^@]*))?@)?([a-z-._]+)?(?::([0-9]*))?(\/[^?#]*)?(?:\?([^#]*))?(?:#(.*))?$/i;
//               1 - scheme                2 - user    3 = pass 4 - host        5 - port  6 - path        7 - query    8 - hash

var noslash = ["mailto","bitcoin"];

var self = {
	/** Parse a query string.
	 *
	 * This function parses a query string (sometimes called the search
	 * string).  It takes a query string and returns a map of the results.
	 *
	 * Keys are considered to be everything up to the first '=' and values are
	 * everything afterwords.  Since URL-decoding is done after parsing, keys
	 * and values can have any values, however, '=' have to be encoded in keys
	 * while '?' and '&' have to be encoded anywhere (as they delimit the
	 * kv-pairs).
	 *
	 * Keys and values will always be strings, except if there is a key with no
	 * '=' in which case it will be considered a flag and will be set to true.
	 * Later values will override earlier values.
	 *
	 * Array keys are also supported.  By default keys in the form of `name[i]`
	 * will be returned like that as strings.  However, if you set the `array`
	 * flag in the options object they will be parsed into arrays.  Note that
	 * although the object returned is an `Array` object all keys will be
	 * written to it.  This means that if you have a key such as `k[forEach]`
	 * it will overwrite the `forEach` function on that array.  Also note that
	 * string properties always take precedence over array properties,
	 * irrespective of where they are in the query string.
	 *
	 *   url.get("array[1]=test&array[foo]=bar",{array:true}).array[1]  === "test"
	 *   url.get("array[1]=test&array[foo]=bar",{array:true}).array.foo === "bar"
	 *   url.get("array=notanarray&array[0]=1",{array:true}).array      === "notanarray"
	 *
	 * If array parsing is enabled keys in the form of `name[]` will
	 * automatically be given the next available index.  Note that this can be
	 * overwritten with later values in the query string.  For this reason is
	 * is best not to mix the two formats, although it is safe (and often
	 * useful) to add an automatic index argument to the end of a query string.
	 *
	 *   url.get("a[]=0&a[]=1&a[0]=2", {array:true})  -> {a:["2","1"]};
	 *   url.get("a[0]=0&a[1]=1&a[]=2", {array:true}) -> {a:["0","1","2"]};
	 *
	 * @param{string} q The query string (the part after the '?').
	 * @param{{full:boolean,array:boolean}=} opt Options.
	 *
	 * - full: If set `q` will be treated as a full url and `q` will be built.
	 *   by calling #parse to retrieve the query portion.
	 * - array: If set keys in the form of `key[i]` will be treated
	 *   as arrays/maps.
	 *
	 * @return{!Object.<string, string|Array>} The parsed result.
	 */
	"get": function(q, opt){
		q = q || "";
		if ( typeof opt          == "undefined" ) opt = {};
		if ( typeof opt["full"]  == "undefined" ) opt["full"] = false;
		if ( typeof opt["array"] == "undefined" ) opt["array"] = false;
		
		if ( opt["full"] === true )
		{
			q = self["parse"](q, {"get":false})["query"] || "";
		}
		
		var o = {};
		
		var c = q.split("&");
		for (var i = 0; i < c.length; i++)
		{
			if (!c[i].length) continue;
			
			var d = c[i].indexOf("=");
			var k = c[i], v = true;
			if ( d >= 0 )
			{
				k = c[i].substr(0, d);
				v = c[i].substr(d+1);
				
				v = decodeURIComponent(v);
			}
			
			if (opt["array"])
			{
				var inds = [];
				var ind;
				var curo = o;
				var curk = k;
				while (ind = curk.match(array)) // Array!
				{
					curk = curk.substr(0, ind.index);
					inds.unshift(decodeURIComponent(ind[1]));
				}
				curk = decodeURIComponent(curk);
				if (inds.some(function(i)
				{
					if ( typeof curo[curk] == "undefined" ) curo[curk] = [];
					if (!Array.isArray(curo[curk]))
					{
						//console.log("url.get: Array property "+curk+" already exists as string!");
						return true;
					}
					
					curo = curo[curk];
					
					if ( i === "" ) i = curo.length;
					
					curk = i;
				})) continue;
				curo[curk] = v;
				continue;
			}
			
			k = decodeURIComponent(k);
			
			//typeof o[k] == "undefined" || console.log("Property "+k+" already exists!");
			o[k] = v;
		}
		
		return o;
	},
	
	/** Build a get query from an object.
	 *
	 * This constructs a query string from the kv pairs in `data`.  Calling
	 * #get on the string returned should return an object identical to the one
	 * passed in except all non-boolean scalar types become strings and all
	 * object types become arrays (non-integer keys are still present, see
	 * #get's documentation for more details).
	 *
	 * This always uses array syntax for describing arrays.  If you want to
	 * serialize them differently (like having the value be a JSON array and
	 * have a plain key) you will need to do that before passing it in.
	 *
	 * All keys and values are supported (binary data anyone?) as they are
	 * properly URL-encoded and #get properly decodes.
	 *
	 * @param{Object} data The kv pairs.
	 * @param{string} prefix The properly encoded array key to put the
	 *   properties.  Mainly intended for internal use.
	 * @return{string} A URL-safe string.
	 */
	"buildget": function(data, prefix){
		var itms = [];
		for ( var k in data )
		{
			var ek = encodeURIComponent(k);
			if ( typeof prefix != "undefined" )
				ek = prefix+"["+ek+"]";
			
			var v = data[k];
			
			switch (typeof v)
			{
				case 'boolean':
					if(v) itms.push(ek);
					break;
				case 'number':
					v = v.toString();
				case 'string':
					itms.push(ek+"="+encodeURIComponent(v));
					break;
				case 'object':
					itms.push(self["buildget"](v, ek));
					break;
			}
		}
		return itms.join("&");
	},
	
	/** Parse a URL
	 * 
	 * This breaks up a URL into components.  It attempts to be very liberal
	 * and returns the best result in most cases.  This means that you can
	 * often pass in part of a URL and get correct categories back.  Notably,
	 * this works for emails and Jabber IDs, as well as adding a '?' to the
	 * beginning of a string will parse the whole thing as a query string.  If
	 * an item is not found the property will be undefined.  In some cases an
	 * empty string will be returned if the surrounding syntax but the actual
	 * value is empty (example: "://example.com" will give a empty string for
	 * scheme.)  Notably the host name will always be set to something.
	 * 
	 * Returned properties.
	 * 
	 * - **scheme:** The url scheme. (ex: "mailto" or "https")
	 * - **user:** The username.
	 * - **pass:** The password.
	 * - **host:** The hostname. (ex: "localhost", "123.456.7.8" or "example.com")
	 * - **port:** The port, as a number. (ex: 1337)
	 * - **path:** The path. (ex: "/" or "/about.html")
	 * - **query:** "The query string. (ex: "foo=bar&v=17&format=json")
	 * - **get:** The query string parsed with get.  If `opt.get` is `false` this
	 *   will be absent
	 * - **hash:** The value after the hash. (ex: "myanchor")
	 *   be undefined even if `query` is set.
	 *
	 * @param{string} url The URL to parse.
	 * @param{{get:Object}=} opt Options:
	 *
	 * - get: An options argument to be passed to #get or false to not call #get.
	 *    **DO NOT** set `full`.
	 *
	 * @return{!Object} An object with the parsed values.
	 */
	"parse": function(url, opt) {
		
		if ( typeof opt == "undefined" ) opt = {};
		
		var md = url.match(regex) || [];
		
		var r = {
			"url":    url,
			
			"scheme": md[1],
			"user":   md[2],
			"pass":   md[3],
			"host":   md[4],
			"port":   md[5] && +md[5],
			"path":   md[6],
			"query":  md[7],
			"hash":   md[8],
		};
		
		if ( opt.get !== false )
			r["get"] = r["query"] && self["get"](r["query"], opt.get);
		
		return r;
	},
	
	/** Build a URL from components.
	 * 
	 * This pieces together a url from the properties of the passed in object.
	 * In general passing the result of `parse()` should return the URL.  There
	 * may differences in the get string as the keys and values might be more
	 * encoded then they were originally were.  However, calling `get()` on the
	 * two values should yield the same result.
	 * 
	 * Here is how the parameters are used.
	 * 
	 *  - url: Used only if no other values are provided.  If that is the case
	 *     `url` will be returned verbatim.
	 *  - scheme: Used if defined.
	 *  - user: Used if defined.
	 *  - pass: Used if defined.
	 *  - host: Used if defined.
	 *  - path: Used if defined.
	 *  - query: Used only if `get` is not provided and non-empty.
	 *  - get: Used if non-empty.  Passed to #buildget and the result is used
	 *    as the query string.
	 *  - hash: Used if defined.
	 * 
	 * These are the options that are valid on the options object.
	 * 
	 *  - useemptyget: If truthy, a question mark will be appended for empty get
	 *    strings.  This notably makes `build()` and `parse()` fully symmetric.
	 *
	 * @param{Object} data The pieces of the URL.
	 * @param{Object} opt Options for building the url.
	 * @return{string} The URL.
	 */
	"build": function(data, opt){
		opt = opt || {};
		
		var r = "";
		
		if ( typeof data["scheme"] != "undefined" )
		{
			r += data["scheme"];
			r += (noslash.indexOf(data["scheme"])>=0)?":":"://";
		}
		if ( typeof data["user"] != "undefined" )
		{
			r += data["user"];
			if ( typeof data["pass"] == "undefined" )
			{
				r += "@";
			}
		}
		if ( typeof data["pass"] != "undefined" ) r += ":" + data["pass"] + "@";
		if ( typeof data["host"] != "undefined" ) r += data["host"];
		if ( typeof data["port"] != "undefined" ) r += ":" + data["port"];
		if ( typeof data["path"] != "undefined" ) r += data["path"];
		
		if (opt["useemptyget"])
		{
			if      ( typeof data["get"]   != "undefined" ) r += "?" + self["buildget"](data["get"]);
			else if ( typeof data["query"] != "undefined" ) r += "?" + data["query"];
		}
		else
		{
			// If .get use it.  If .get leads to empty, use .query.
			var q = data["get"] && self["buildget"](data["get"]) || data["query"];
			if (q) r += "?" + q;
		}
		
		if ( typeof data["hash"] != "undefined" ) r += "#" + data["hash"];
		
		return r || data["url"] || "";
	},
};

if ( true ) !(__WEBPACK_AMD_DEFINE_FACTORY__ = (self),
		__WEBPACK_AMD_DEFINE_RESULT__ = (typeof __WEBPACK_AMD_DEFINE_FACTORY__ === 'function' ?
		(__WEBPACK_AMD_DEFINE_FACTORY__.call(exports, __webpack_require__, exports, module)) :
		__WEBPACK_AMD_DEFINE_FACTORY__),
		__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
else {}

}();


/***/ }),

/***/ "./src/web/js/modal-prompt.js":
/*!************************************!*\
  !*** ./src/web/js/modal-prompt.js ***!
  \************************************/
/***/ ((module, exports, __webpack_require__) => {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;/**
 * Module for managing modal prompt instances.
 * NOTE: This module is currently limited in a number
 *       of ways. For one, it only allows radio
 *       input options. Additionally, it hard-codes in
 *       a number of other behaviors which are specific
 *       to the image import style prompt (for which
 *       this module was written).
 *       If desired, this module may be made more
 *       general-purpose in the future, but, for now,
 *       be aware of these limitations.
 */
!(__WEBPACK_AMD_DEFINE_ARRAY__ = [__webpack_require__(/*! q */ "./node_modules/q/q.js")], __WEBPACK_AMD_DEFINE_RESULT__ = (function (Q) {
  function autoHighlightBox(text) {
    var textBox = $("<input type='text'>").addClass("auto-highlight");
    textBox.attr("readonly", "readonly");
    textBox.on("focus", function () {
      $(this).select();
    });
    textBox.on("mouseup", function () {
      $(this).select();
    });
    textBox.val(text);
    return textBox;
  }

  // Allows asynchronous requesting of prompts
  var promptQueue = Q();
  var styles = ["radio", "tiles", "text", "copyText", "confirm"];
  window.modals = [];

  /**
   * Represents an option to present the user
   * @typedef {Object} ModalOption
   * @property {string} message - The message to show the user which
               describes this option
   * @property {string} value - The value to return if this option is chosen
   * @property {string} [example] - A code snippet to show with this option
   */

  /**
   * Constructor for modal prompts.
   * @param {ModalOption[]} options - The options to present the user
   */
  function Prompt(options) {
    window.modals.push(this);
    if (!options || styles.indexOf(options.style) === -1 || !options.options || typeof options.options.length !== "number" || options.options.length === 0) {
      throw new Error("Invalid Prompt Options", options);
    }
    this.options = options;
    this.modal = $("#promptModal");
    if (this.options.style === "radio") {
      this.elts = $($.parseHTML("<table></table>")).addClass("choiceContainer");
    } else if (this.options.style === "text") {
      this.elts = $("<div>").addClass("choiceContainer");
    } else if (this.options.style === "copyText") {
      this.elts = $("<div>").addClass("choiceContainer");
    } else if (this.options.style === "confirm") {
      this.elts = $("<div>").addClass("choiceContainer");
    } else {
      this.elts = $($.parseHTML("<div></div>")).addClass("choiceContainer");
    }
    this.title = $(".modal-header > h3", this.modal);
    this.modalContent = $(".modal-content", this.modal);
    this.closeButton = $(".close", this.modal);
    this.submitButton = $(".submit", this.modal);
    if (this.options.submitText) {
      this.submitButton.text(this.options.submitText);
    } else {
      this.submitButton.text("Submit");
    }
    if (this.options.cancelText) {
      this.closeButton.text(this.options.cancelText);
    } else {
      this.closeButton.text("Cancel");
    }
    this.modalContent.toggleClass("narrow", !!this.options.narrow);
    this.isCompiled = false;
    this.deferred = Q.defer();
    this.promise = this.deferred.promise;
  }

  /**
   * Type for handlers of responses from modal prompts
   * @callback promptCallback
   * @param {string} resp - The response from the user
   */

  /**
   * Shows this prompt to the user (will wait until any active
   * prompts have finished)
   * @param {promptCallback} [callback] - Optional callback which is passed the
   *        result of the prompt
   * @returns A promise resolving to either the result of `callback`, if provided,
   *          or the result of the prompt, otherwise.
   */
  Prompt.prototype.show = function (callback) {
    // Use the promise queue to make sure there's no other
    // prompt being shown currently
    if (this.options.hideSubmit) {
      this.submitButton.hide();
    } else {
      this.submitButton.show();
    }
    this.closeButton.click(this.onClose.bind(this));
    this.modal.keypress(function (e) {
      if (e.which == 13) {
        this.submitButton.click();
        return false;
      }
    }.bind(this));
    this.submitButton.click(this.onSubmit.bind(this));
    var docClick = function (e) {
      // If the prompt is active and the background is clicked,
      // then close.
      if ($(e.target).is(this.modal) && this.deferred) {
        this.onClose(e);
        $(document).off("click", docClick);
      }
    }.bind(this);
    $(document).click(docClick);
    var docKeydown = function (e) {
      if (e.key === "Escape") {
        this.onClose(e);
        $(document).off("keydown", docKeydown);
      }
    }.bind(this);
    $(document).keydown(docKeydown);
    this.title.text(this.options.title);
    this.populateModal();
    this.modal.css('display', 'block');
    $(":input:enabled:visible:first", this.modal).focus().select();
    if (callback) {
      return this.promise.then(callback);
    } else {
      return this.promise;
    }
  };

  /**
   * Clears the contents of the modal prompt.
   */
  Prompt.prototype.clearModal = function () {
    this.submitButton.off();
    this.closeButton.off();
    this.elts.empty();
  };

  /**
   * Populates the contents of the modal prompt with the
   * options in this prompt.
   */
  Prompt.prototype.populateModal = function () {
    function createRadioElt(option, idx) {
      var elt = $($.parseHTML("<input name=\"pyret-modal\" type=\"radio\">"));
      var id = "r" + idx.toString();
      var label = $($.parseHTML("<label for=\"" + id + "\"></label>"));
      elt.attr("id", id);
      elt.attr("value", option.value);
      label.text(option.message);
      var eltContainer = $($.parseHTML("<td class=\"pyret-modal-option-radio\"></td>"));
      eltContainer.append(elt);
      var labelContainer = $($.parseHTML("<td class=\"pyret-modal-option-message\"></td>"));
      labelContainer.append(label);
      var container = $($.parseHTML("<tr class=\"pyret-modal-option\"></tr>"));
      container.append(eltContainer);
      container.append(labelContainer);
      if (option.example) {
        var example = $($.parseHTML("<div></div>"));
        var cm = CodeMirror(example[0], {
          value: option.example,
          mode: 'pyret',
          lineNumbers: false,
          readOnly: "nocursor" // this makes it readOnly & not focusable as a form input
        });
        setTimeout(function () {
          cm.refresh();
        }, 1);
        var exampleContainer = $($.parseHTML("<td class=\"pyret-modal-option-example\"></td>"));
        exampleContainer.append(example);
        container.append(exampleContainer);
      }
      return container;
    }
    function createTileElt(option, idx) {
      var elt = $($.parseHTML("<button name=\"pyret-modal\" class=\"tile\"></button>"));
      elt.attr("id", "t" + idx.toString());
      elt.append($("<b>").text(option.message)).append($("<p>").text(option.details));
      for (var evt in option.on) elt.on(evt, option.on[evt]);
      return elt;
    }
    function createTextElt(option) {
      var elt = $("<div class=\"pyret-modal-text\">");
      var input = $("<input id='modal-prompt-text' type='text'>").val(option.defaultValue);
      if (option.drawElement) {
        elt.append(option.drawElement(input));
      } else {
        elt.append($("<label for='modal-prompt-text'>").addClass("textLabel").text(option.message));
        elt.append(input);
      }
      return elt;
    }
    function createCopyTextElt(option) {
      var elt = $("<div>");
      elt.append($("<p>").addClass("textLabel").text(option.message));
      if (option.text) {
        var box = autoHighlightBox(option.text);
        //      elt.append($("<span>").text("(" + option.details + ")"));
        elt.append(box);
        box.focus();
      }
      return elt;
    }
    function createConfirmElt(option) {
      return $("<p>").text(option.message);
    }
    var that = this;
    function createElt(option, i) {
      if (that.options.style === "radio") {
        return createRadioElt(option, i);
      } else if (that.options.style === "tiles") {
        return createTileElt(option, i);
      } else if (that.options.style === "text") {
        return createTextElt(option);
      } else if (that.options.style === "copyText") {
        return createCopyTextElt(option);
      } else if (that.options.style === "confirm") {
        return createConfirmElt(option);
      }
    }
    var optionElts;
    // Cache results
    //    if (true) {
    optionElts = this.options.options.map(createElt);
    //      this.compiledElts = optionElts;
    //      this.isCompiled = true;
    //    } else {
    //      optionElts = this.compiledElts;
    //    }
    $("input[type='radio']", optionElts[0]).attr('checked', true);
    this.elts.append(optionElts);
    $(".modal-body", this.modal).empty().append(this.elts);
  };

  /**
   * Handler which is called when the user does not select anything
   */
  Prompt.prototype.onClose = function (e) {
    this.modal.css('display', 'none');
    this.clearModal();
    this.deferred.resolve(null);
    delete this.deferred;
    delete this.promise;
  };

  /**
   * Handler which is called when the user presses "submit"
   */
  Prompt.prototype.onSubmit = function (e) {
    if (this.options.style === "radio") {
      var retval = $("input[type='radio']:checked", this.modal).val();
    } else if (this.options.style === "text") {
      var retval = $("input[type='text']", this.modal).val();
    } else if (this.options.style === "copyText") {
      var retval = true;
    } else if (this.options.style === "confirm") {
      var retval = true;
    } else {
      var retval = true; // Just return true if they clicked submit
    }
    this.modal.css('display', 'none');
    this.clearModal();
    this.deferred.resolve(retval);
    delete this.deferred;
    delete this.promise;
  };
  return Prompt;
}).apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
		__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be isolated against other modules in the chunk.
(() => {
/*!***********************************!*\
  !*** ./src/web/js/beforePyret.js ***!
  \***********************************/
function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
/* global $ jQuery CPO CodeMirror storageAPI Q createProgramCollectionAPI makeShareAPI */

var originalPageLoad = Date.now();
console.log("originalPageLoad: ", originalPageLoad);
var isEmbedded = window.parent !== window;
var shareAPI = makeShareAPI(undefined);
var url = window.url = __webpack_require__(/*! url.js */ "./node_modules/url.js/url.js");
var modalPrompt = __webpack_require__(/*! ./modal-prompt.js */ "./src/web/js/modal-prompt.js");
window.modalPrompt = modalPrompt;
var LOG = true;
window.ct_log = function /* varargs */
() {
  if (window.console && LOG) {
    console.log.apply(console, arguments);
  }
};
window.ct_error = function /* varargs */
() {
  if (window.console && LOG) {
    console.error.apply(console, arguments);
  }
};
var initialParams = url.parse(document.location.href);
var params = url.parse("/?" + initialParams["hash"]);
window.highlightMode = "mcmh"; // what is this for?
window.clearFlash = function () {
  $(".notificationArea").empty();
};
window.whiteToBlackNotification = function () {
  /*
  $(".notificationArea .active").css("background-color", "white");
  $(".notificationArea .active").animate({backgroundColor: "#111111" }, 1000);
  */
};
window.stickError = function (message, more) {
  CPO.sayAndForget(message);
  clearFlash();
  var err = $("<span>").addClass("error").text(message);
  if (more) {
    err.attr("title", more);
  }
  err.tooltip();
  $(".notificationArea").prepend(err);
  whiteToBlackNotification();
};
window.flashError = function (message) {
  CPO.sayAndForget(message);
  clearFlash();
  var err = $("<span>").addClass("error").text(message);
  $(".notificationArea").prepend(err);
  whiteToBlackNotification();
  err.fadeOut(7000);
};
window.flashMessage = function (message) {
  CPO.sayAndForget(message);
  clearFlash();
  var msg = $("<span>").addClass("active").text(message);
  $(".notificationArea").prepend(msg);
  whiteToBlackNotification();
  msg.fadeOut(7000);
};
window.stickMessage = function (message) {
  CPO.sayAndForget(message);
  clearFlash();
  var msg = $("<span>").addClass("active").text(message);
  $(".notificationArea").prepend(msg);
  whiteToBlackNotification();
};
window.stickRichMessage = function (content) {
  CPO.sayAndForget(content.text());
  clearFlash();
  $(".notificationArea").prepend($("<span>").addClass("active").append(content));
  whiteToBlackNotification();
};
window.mkWarningUpper = function () {
  return $("<div class='warning-upper'>");
};
window.mkWarningLower = function () {
  return $("<div class='warning-lower'>");
};
var Documents = function () {
  function Documents() {
    this.documents = new Map();
  }
  Documents.prototype.has = function (name) {
    return this.documents.has(name);
  };
  Documents.prototype.get = function (name) {
    return this.documents.get(name);
  };
  Documents.prototype.set = function (name, doc) {
    if (logger.isDetailed) logger.log("doc.set", {
      name: name,
      value: doc.getValue()
    });
    return this.documents.set(name, doc);
  };
  Documents.prototype["delete"] = function (name) {
    if (logger.isDetailed) logger.log("doc.del", {
      name: name
    });
    return this.documents["delete"](name);
  };
  Documents.prototype.forEach = function (f) {
    return this.documents.forEach(f);
  };
  return Documents;
}();
var VERSION_CHECK_INTERVAL = 120000 + 30000 * Math.random();
function checkVersion() {
  $.get("/current-version").then(function (resp) {
    resp = JSON.parse(resp);
    if (resp.version && resp.version !== undefined) {
      window.flashMessage("A new version of Pyret is available. Save and reload the page to get the newest version.");
    }
  });
}
if (!isEmbedded) {
  window.setInterval(checkVersion, VERSION_CHECK_INTERVAL);
}
window.CPO = {
  save: function save() {},
  autoSave: function autoSave() {},
  documents: new Documents()
};
$(function () {
  var CONTEXT_FOR_NEW_FILES = "use context starter2024\n";
  var CONTEXT_PREFIX = /^use context\s+/;
  function merge(obj, extension) {
    var newobj = {};
    Object.keys(obj).forEach(function (k) {
      newobj[k] = obj[k];
    });
    Object.keys(extension).forEach(function (k) {
      newobj[k] = extension[k];
    });
    return newobj;
  }
  var animationDiv = null;
  function closeAnimationIfOpen() {
    if (animationDiv) {
      animationDiv.empty();
      animationDiv.dialog("destroy");
      animationDiv = null;
    }
  }
  CPO.makeEditor = function (container, options) {
    var initial = "";
    if (options.hasOwnProperty("initial")) {
      initial = options.initial;
    }
    var textarea = jQuery("<textarea aria-hidden='true'>");
    textarea.val(initial);
    container.append(textarea);
    var runFun = function runFun(code, replOptions) {
      options.run(code, {
        cm: CM
      }, replOptions);
    };
    var useLineNumbers = !options.simpleEditor;
    var useFolding = !options.simpleEditor;
    var gutters = !options.simpleEditor ? ["help-gutter", "CodeMirror-linenumbers", "CodeMirror-foldgutter"] : [];
    function reindentAllLines(cm) {
      var last = cm.lineCount();
      cm.operation(function () {
        for (var i = 0; i < last; ++i) cm.indentLine(i);
      });
    }
    var CODE_LINE_WIDTH = 100;
    var rulers, rulersMinCol;

    // place a vertical line in code editor, and not repl
    if (options.simpleEditor) {
      rulers = [];
    } else {
      rulers = [{
        color: "#317BCF",
        column: CODE_LINE_WIDTH,
        lineStyle: "dashed",
        className: "hidden"
      }];
      rulersMinCol = CODE_LINE_WIDTH;
    }
    var mac = CodeMirror.keyMap["default"] === CodeMirror.keyMap.macDefault;
    console.log("Using keymap: ", CodeMirror.keyMap["default"], "macDefault: ", CodeMirror.keyMap.macDefault, "mac: ", mac);
    var modifier = mac ? "Cmd" : "Ctrl";
    var cmOptions = {
      extraKeys: CodeMirror.normalizeKeyMap(_defineProperty(_defineProperty({
        "Shift-Enter": function ShiftEnter(cm) {
          runFun(cm.getValue());
        },
        "Shift-Ctrl-Enter": function ShiftCtrlEnter(cm) {
          runFun(cm.getValue());
        },
        "Tab": "indentAuto",
        "Ctrl-I": reindentAllLines,
        "Esc Left": "goBackwardSexp",
        "Alt-Left": "goBackwardSexp",
        "Esc Right": "goForwardSexp",
        "Alt-Right": "goForwardSexp",
        "Ctrl-Left": "goBackwardToken",
        "Ctrl-Right": "goForwardToken"
      }, "".concat(modifier, "-F"), "findPersistent"), "".concat(modifier, "-/"), "toggleComment")),
      indentUnit: 2,
      tabSize: 2,
      viewportMargin: Infinity,
      lineNumbers: useLineNumbers,
      matchKeywords: true,
      matchBrackets: true,
      styleSelectedText: true,
      foldGutter: useFolding,
      gutters: gutters,
      lineWrapping: true,
      logging: true,
      rulers: rulers,
      rulersMinCol: rulersMinCol,
      scrollPastEnd: true
    };
    cmOptions = merge(cmOptions, options.cmOptions || {});
    var CM = CodeMirror.fromTextArea(textarea[0], cmOptions);
    function firstLineIsNamespace() {
      var firstline = CM.getLine(0);
      var match = firstline.match(CONTEXT_PREFIX);
      return match !== null;
    }
    var namespacemark = null;
    function setContextLine(newContextLine) {
      var hasNamespace = firstLineIsNamespace();
      if (!hasNamespace && namespacemark !== null) {
        namespacemark.clear();
      }
      if (!hasNamespace) {
        CM.replaceRange(newContextLine, {
          line: 0,
          ch: 0
        }, {
          line: 0,
          ch: 0
        });
      } else {
        CM.replaceRange(newContextLine, {
          line: 0,
          ch: 0
        }, {
          line: 1,
          ch: 0
        });
      }
    }
    if (!options.simpleEditor) {
      var gutterQuestionWrapper = document.createElement("div");
      gutterQuestionWrapper.className = "gutter-question-wrapper";
      var gutterTooltip = document.createElement("span");
      gutterTooltip.className = "gutter-question-tooltip";
      gutterTooltip.innerText = "The use context line tells Pyret to load tools for a specific class context. It can be changed through the main Pyret menu. Most of the time you won't need to change this at all.";
      var gutterQuestion = document.createElement("img");
      gutterQuestion.src = window.APP_BASE_URL + "/img/question.png";
      gutterQuestion.className = "gutter-question";
      gutterQuestionWrapper.appendChild(gutterQuestion);
      gutterQuestionWrapper.appendChild(gutterTooltip);
      CM.setGutterMarker(0, "help-gutter", gutterQuestionWrapper);
      CM.getWrapperElement().onmouseleave = function (e) {
        CM.clearGutter("help-gutter");
      };

      // NOTE(joe): This seems to be the best way to get a hover on a mark: https://github.com/codemirror/CodeMirror/issues/3529
      CM.getWrapperElement().onmousemove = function (e) {
        var lineCh = CM.coordsChar({
          left: e.clientX,
          top: e.clientY
        });
        var markers = CM.findMarksAt(lineCh);
        if (markers.length === 0) {
          CM.clearGutter("help-gutter");
        }
        if (lineCh.line === 0 && markers[0] === namespacemark) {
          CM.setGutterMarker(0, "help-gutter", gutterQuestionWrapper);
        } else {
          CM.clearGutter("help-gutter");
        }
      };
      CM.on("change", function (change) {
        function doesNotChangeFirstLine(c) {
          return c.from.line !== 0;
        }
        if (change.curOp.changeObjs && change.curOp.changeObjs.every(doesNotChangeFirstLine)) {
          return;
        }
        var hasNamespace = firstLineIsNamespace();
        if (hasNamespace) {
          if (namespacemark) {
            namespacemark.clear();
          }
          namespacemark = CM.markText({
            line: 0,
            ch: 0
          }, {
            line: 1,
            ch: 0
          }, {
            attributes: {
              useline: true
            },
            className: "useline",
            atomic: true,
            inclusiveLeft: true,
            inclusiveRight: false
          });
        }
      });
    }
    if (useLineNumbers) {
      CM.display.wrapper.appendChild(mkWarningUpper()[0]);
      CM.display.wrapper.appendChild(mkWarningLower()[0]);
    }
    getTopTierMenuitems();
    return {
      cm: CM,
      setContextLine: setContextLine,
      refresh: function refresh() {
        CM.refresh();
      },
      run: function run() {
        runFun(CM.getValue());
      },
      focus: function focus() {
        CM.focus();
      },
      focusCarousel: null //initFocusCarousel
    };
  };
  CPO.RUN_CODE = function () {
    console.log("Running before ready", arguments);
  };
  function setUsername(target) {
    return gwrap.load({
      name: 'plus',
      version: 'v1'
    }).then(function (api) {
      api.people.get({
        userId: "me"
      }).then(function (user) {
        var name = user.displayName;
        if (user.emails && user.emails[0] && user.emails[0].value) {
          name = user.emails[0].value;
        }
        target.text(name);
      });
    });
  }
  storageAPI.then(function (api) {
    api.collection.then(function () {
      $(".loginOnly").show();
      $(".logoutOnly").hide();
      setUsername($("#username"));
    });
    api.collection.fail(function () {
      $(".loginOnly").hide();
      $(".logoutOnly").show();
    });
  });
  storageAPI = storageAPI.then(function (api) {
    return api.api;
  });
  $("#fullConnectButton").click(function () {
    reauth(false,
    // Don't do an immediate load (this will require login)
    true // Use the full set of scopes for this login
    );
  });
  $("#connectButton").click(function () {
    $("#connectButton").text("Connecting...");
    $("#connectButton").attr("disabled", "disabled");
    $('#connectButtonli').attr('disabled', 'disabled');
    $("#connectButton").attr("tabIndex", "-1");
    //$("#topTierUl").attr("tabIndex", "0");
    getTopTierMenuitems();
    storageAPI = createProgramCollectionAPI("code.pyret.org", false);
    storageAPI.then(function (api) {
      api.collection.then(function () {
        $(".loginOnly").show();
        $(".logoutOnly").hide();
        document.activeElement.blur();
        $("#bonniemenubutton").focus();
        setUsername($("#username"));
        if (params["get"] && params["get"]["program"]) {
          var toLoad = api.api.getFileById(params["get"]["program"]);
          console.log("Logged in and has program to load: ", toLoad);
          loadProgram(toLoad);
          programToSave = toLoad;
        } else {
          programToSave = Q.fcall(function () {
            return null;
          });
        }
      });
      api.collection.fail(function () {
        $("#connectButton").text("Connect to Google Drive");
        $("#connectButton").attr("disabled", false);
        $('#connectButtonli').attr('disabled', false);
        //$("#connectButton").attr("tabIndex", "0");
        document.activeElement.blur();
        $("#connectButton").focus();
        //$("#topTierUl").attr("tabIndex", "-1");
      });
    });
    storageAPI = storageAPI.then(function (api) {
      return api.api;
    });
  });

  /*
    initialProgram holds a promise for a Drive File object or null
     It's null if the page doesn't have a #share or #program url
     If the url does have a #program or #share, the promise is for the
    corresponding object.
  */
  var initialProgram;
  if (params["get"] && params["get"]["shareurl"]) {
    initialProgram = makeUrlFile(params["get"]["shareurl"]);
  } else {
    initialProgram = storageAPI.then(function (api) {
      var programLoad = null;
      if (params["get"] && params["get"]["program"]) {
        enableFileOptions();
        programLoad = api.getFileById(params["get"]["program"]);
        programLoad.then(function (p) {
          showShareContainer(p);
        });
      } else if (params["get"] && params["get"]["share"]) {
        logger.log('shared-program-load', {
          id: params["get"]["share"]
        });
        programLoad = api.getSharedFileById(params["get"]["share"]);
        programLoad.then(function (file) {
          // NOTE(joe): If the current user doesn't own or have access to this file
          // (or isn't logged in) this will simply fail with a 401, so we don't do
          // any further permission checking before showing the link.
          file.getOriginal().then(function (response) {
            console.log("Response for original: ", response);
            var original = $("#open-original").show().off("click");
            var id = response.result.value;
            original.removeClass("hidden");
            original.click(function () {
              window.open(window.APP_BASE_URL + "/editor#program=" + id, "_blank");
            });
          });
        });
      } else {
        programLoad = null;
      }
      if (programLoad) {
        programLoad.fail(function (err) {
          console.error(err);
          window.stickError("The program failed to load.");
        });
        return programLoad;
      } else {
        return null;
      }
    })["catch"](function (e) {
      console.error("storageAPI failed to load, proceeding without saving programs: ", e);
      return null;
    });
  }
  function setTitle(progName) {
    document.title = progName + " - code.pyret.org";
    $("#showFilename").text("File: " + progName);
  }
  CPO.setTitle = setTitle;
  var filename = false;
  $("#download a").click(function () {
    var downloadElt = $("#download a");
    var contents = CPO.editor.cm.getValue();
    var downloadBlob = window.URL.createObjectURL(new Blob([contents], {
      type: 'text/plain'
    }));
    if (!filename) {
      filename = 'untitled_program.arr';
    }
    if (filename.indexOf(".arr") !== filename.length - 4) {
      filename += ".arr";
    }
    downloadElt.attr({
      download: filename,
      href: downloadBlob
    });
    $("#download").append(downloadElt);
  });
  function showModal(currentContext) {
    function drawElement(input) {
      var element = $("<div>");
      var greeting = $("<p>");
      var shared = $("<tt>shared-gdrive(...)</tt>");
      var currentContextElt = $("<tt>" + currentContext + "</tt>");
      greeting.append("Enter the context to use for the program, or choose “Cancel” to keep the current context of ", currentContextElt, ".");
      var essentials = $("<tt>starter2024</tt>");
      var list = $("<ul>").append($("<li>").append("The default is ", essentials, ".")).append($("<li>").append("You might use something like ", shared, " if one was provided as part of a course."));
      element.append(greeting);
      element.append($("<p>").append(list));
      var useContext = $("<tt>use context</tt>").css({
        'flex-grow': '0',
        'padding-right': '1em'
      });
      var inputWrapper = $("<div>").append(input).css({
        'flex-grow': '1'
      });
      var entry = $("<div>").css({
        display: 'flex',
        'flex-direction': 'row',
        'justify-content': 'flex-start',
        'align-items': 'baseline'
      });
      entry.append(useContext).append(inputWrapper);
      element.append(entry);
      return element;
    }
    var namespaceResult = new modalPrompt({
      title: "Choose a Context",
      style: "text",
      options: [{
        drawElement: drawElement,
        submitText: "Change Namespace",
        defaultValue: currentContext
      }]
    });
    namespaceResult.show(function (result) {
      if (!result) {
        return;
      }
      CPO.editor.setContextLine("use context " + result.trim() + "\n");
    });
  }
  $("#choose-context").on("click", function () {
    var firstLine = CPO.editor.cm.getLine(0);
    var contextLen = firstLine.match(CONTEXT_PREFIX);
    showModal(contextLen === null ? "" : firstLine.slice(contextLen[0].length));
  });
  var TRUNCATE_LENGTH = 20;
  function truncateName(name) {
    if (name.length <= TRUNCATE_LENGTH + 1) {
      return name;
    }
    return name.slice(0, TRUNCATE_LENGTH / 2) + "…" + name.slice(name.length - TRUNCATE_LENGTH / 2, name.length);
  }
  function updateName(p) {
    filename = p.getName();
    $("#filename").text(" (" + truncateName(filename) + ")");
    $("#filename").attr('title', filename);
    setTitle(filename);
    showShareContainer(p);
  }
  function loadProgram(p) {
    programToSave = p;
    return p.then(function (prog) {
      if (prog !== null) {
        updateName(prog);
        if (prog.shared) {
          window.stickMessage("You are viewing a shared program. Any changes you make will not be saved. You can use File -> Save a copy to save your own version with any edits you make.");
        }
        return prog.getContents();
      } else {
        if (params["get"]["editorContents"] && !(params["get"]["program"] || params["get"]["share"])) {
          return params["get"]["editorContents"];
        } else {
          return CONTEXT_FOR_NEW_FILES;
        }
      }
    });
  }
  function say(msg, forget) {
    if (msg === "") return;
    var announcements = document.getElementById("announcementlist");
    var li = document.createElement("LI");
    li.appendChild(document.createTextNode(msg));
    announcements.insertBefore(li, announcements.firstChild);
    if (forget) {
      setTimeout(function () {
        announcements.removeChild(li);
      }, 1000);
    }
  }
  function sayAndForget(msg) {
    console.log('doing sayAndForget', msg);
    say(msg, true);
  }
  function cycleAdvance(currIndex, maxIndex, reverseP) {
    var nextIndex = currIndex + (reverseP ? -1 : +1);
    nextIndex = (nextIndex % maxIndex + maxIndex) % maxIndex;
    return nextIndex;
  }
  function populateFocusCarousel(editor) {
    if (!editor.focusCarousel) {
      editor.focusCarousel = [];
    }
    var fc = editor.focusCarousel;
    var docmain = document.getElementById("main");
    if (!fc[0]) {
      var toolbar = document.getElementById('Toolbar');
      fc[0] = toolbar;
      //fc[0] = document.getElementById("headeronelegend");
      //getTopTierMenuitems();
      //fc[0] = document.getElementById('bonniemenubutton');
    }
    if (!fc[1]) {
      var docreplMain = docmain.getElementsByClassName("replMain");
      var docreplMain0;
      if (docreplMain.length === 0) {
        docreplMain0 = undefined;
      } else if (docreplMain.length === 1) {
        docreplMain0 = docreplMain[0];
      } else {
        for (var i = 0; i < docreplMain.length; i++) {
          if (docreplMain[i].innerText !== "") {
            docreplMain0 = docreplMain[i];
          }
        }
      }
      fc[1] = docreplMain0;
    }
    if (!fc[2]) {
      var docrepl = docmain.getElementsByClassName("repl");
      var docreplcode = docrepl[0].getElementsByClassName("prompt-container")[0].getElementsByClassName("CodeMirror")[0];
      fc[2] = docreplcode;
    }
    if (!fc[3]) {
      fc[3] = document.getElementById("announcements");
    }
  }
  function cycleFocus(reverseP) {
    //console.log('doing cycleFocus', reverseP);
    var editor = this.editor;
    populateFocusCarousel(editor);
    var fCarousel = editor.focusCarousel;
    var maxIndex = fCarousel.length;
    var currentFocusedElt = fCarousel.find(function (node) {
      if (!node) {
        return false;
      } else {
        return node.contains(document.activeElement);
      }
    });
    var currentFocusIndex = fCarousel.indexOf(currentFocusedElt);
    var nextFocusIndex = currentFocusIndex;
    var focusElt;
    do {
      nextFocusIndex = cycleAdvance(nextFocusIndex, maxIndex, reverseP);
      focusElt = fCarousel[nextFocusIndex];
      //console.log('trying focusElt', focusElt);
    } while (!focusElt);
    var focusElt0;
    if (focusElt.classList.contains('toolbarregion')) {
      //console.log('settling on toolbar region')
      getTopTierMenuitems();
      focusElt0 = document.getElementById('bonniemenubutton');
    } else if (focusElt.classList.contains("replMain") || focusElt.classList.contains("CodeMirror")) {
      //console.log('settling on defn window')
      var textareas = focusElt.getElementsByTagName("textarea");
      //console.log('txtareas=', textareas)
      //console.log('txtarea len=', textareas.length)
      if (textareas.length === 0) {
        //console.log('I')
        focusElt0 = focusElt;
      } else if (textareas.length === 1) {
        //console.log('settling on inter window')
        focusElt0 = textareas[0];
      } else {
        //console.log('settling on defn window')
        /*
        for (var i = 0; i < textareas.length; i++) {
          if (textareas[i].getAttribute('tabIndex')) {
            focusElt0 = textareas[i];
          }
        }
        */
        focusElt0 = textareas[textareas.length - 1];
        focusElt0.removeAttribute('tabIndex');
      }
    } else {
      //console.log('settling on announcement region', focusElt)
      focusElt0 = focusElt;
    }
    document.activeElement.blur();
    focusElt0.click();
    focusElt0.focus();
    //console.log('(cf)docactelt=', document.activeElement);
  }
  var programLoaded = loadProgram(initialProgram);
  var programToSave = initialProgram;
  function showShareContainer(p) {
    //console.log('called showShareContainer');
    if (!p.shared) {
      $("#shareContainer").empty();
      $('#publishli').show();
      $("#shareContainer").append(shareAPI.makeShareLink(p));
      getTopTierMenuitems();
    }
  }
  function nameOrUntitled() {
    return filename || "Untitled";
  }
  function autoSave() {
    programToSave.then(function (p) {
      if (p !== null && !p.shared) {
        save();
      }
    });
  }
  function enableFileOptions() {
    $("#filemenuContents *").removeClass("disabled");
  }
  function menuItemDisabled(id) {
    return $("#" + id).hasClass("disabled");
  }
  function newEvent(e) {
    window.open(window.APP_BASE_URL + "/editor");
  }
  function saveEvent(e) {
    if (menuItemDisabled("save")) {
      return;
    }
    return save();
  }

  /*
    save : string (optional) -> undef
     If a string argument is provided, create a new file with that name and save
    the editor contents in that file.
     If no filename is provided, save the existing file referenced by the editor
    with the current editor contents.  If no filename has been set yet, just
    set the name to "Untitled".
   */
  function save(newFilename) {
    var useName, create;
    if (newFilename !== undefined) {
      useName = newFilename;
      create = true;
    } else if (filename === false) {
      filename = "Untitled";
      create = true;
    } else {
      useName = filename; // A closed-over variable
      create = false;
    }
    window.stickMessage("Saving...");
    var savedProgram = programToSave.then(function (p) {
      if (p !== null && p.shared && !create) {
        return p; // Don't try to save shared files
      }
      if (create) {
        programToSave = storageAPI.then(function (api) {
          return api.createFile(useName);
        }).then(function (p) {
          // showShareContainer(p); TODO(joe): figure out where to put this
          history.pushState(null, null, "#program=" + p.getUniqueId());
          updateName(p); // sets filename
          enableFileOptions();
          return p;
        });
        return programToSave.then(function (p) {
          return save();
        });
      } else {
        return programToSave.then(function (p) {
          if (p === null) {
            return null;
          } else {
            return p.save(CPO.editor.cm.getValue(), false);
          }
        }).then(function (p) {
          if (p !== null) {
            window.flashMessage("Program saved as " + p.getName());
          }
          return p;
        });
      }
    });
    savedProgram.fail(function (err) {
      window.stickError("Unable to save", "Your internet connection may be down, or something else might be wrong with this site or saving to Google.  You should back up any changes to this program somewhere else.  You can try saving again to see if the problem was temporary, as well.");
      console.error(err);
    });
    return savedProgram;
  }
  function saveAs() {
    if (menuItemDisabled("saveas")) {
      return;
    }
    programToSave.then(function (p) {
      var name = p === null ? "Untitled" : p.getName();
      var saveAsPrompt = new modalPrompt({
        title: "Save a copy",
        style: "text",
        submitText: "Save",
        narrow: true,
        options: [{
          message: "The name for the copy:",
          defaultValue: name
        }]
      });
      return saveAsPrompt.show().then(function (newName) {
        if (newName === null) {
          return null;
        }
        window.stickMessage("Saving...");
        return save(newName);
      }).fail(function (err) {
        console.error("Failed to rename: ", err);
        window.flashError("Failed to rename file");
      });
    });
  }
  function rename() {
    programToSave.then(function (p) {
      var renamePrompt = new modalPrompt({
        title: "Rename this file",
        style: "text",
        narrow: true,
        submitText: "Rename",
        options: [{
          message: "The new name for the file:",
          defaultValue: p.getName()
        }]
      });
      // null return values are for the "cancel" path
      return renamePrompt.show().then(function (newName) {
        if (newName === null) {
          return null;
        }
        window.stickMessage("Renaming...");
        programToSave = p.rename(newName);
        return programToSave;
      }).then(function (p) {
        if (p === null) {
          return null;
        }
        updateName(p);
        window.flashMessage("Program saved as " + p.getName());
      }).fail(function (err) {
        console.error("Failed to rename: ", err);
        window.flashError("Failed to rename file");
      });
    }).fail(function (err) {
      console.error("Unable to rename: ", err);
    });
  }
  $("#runButton").click(function () {
    CPO.autoSave();
  });
  $("#new").click(newEvent);
  $("#save").click(saveEvent);
  $("#rename").click(rename);
  $("#saveas").click(saveAs);
  var focusableElts = $(document).find('#header .focusable');
  //console.log('focusableElts=', focusableElts)
  var theToolbar = $(document).find('#Toolbar');
  function getTopTierMenuitems() {
    //console.log('doing getTopTierMenuitems')
    var topTierMenuitems = $(document).find('#header ul li.topTier').toArray();
    topTierMenuitems = topTierMenuitems.filter(function (elt) {
      return !(elt.style.display === 'none' || elt.getAttribute('disabled') === 'disabled');
    });
    var numTopTierMenuitems = topTierMenuitems.length;
    for (var i = 0; i < numTopTierMenuitems; i++) {
      var ithTopTierMenuitem = topTierMenuitems[i];
      var iChild = $(ithTopTierMenuitem).children().first();
      //console.log('iChild=', iChild);
      iChild.find('.focusable').attr('aria-setsize', numTopTierMenuitems.toString()).attr('aria-posinset', (i + 1).toString());
    }
    return topTierMenuitems;
  }
  function updateEditorHeight() {
    var toolbarHeight = document.getElementById('topTierUl').offsetHeight;
    // gets bumped to 67 on initial resize perturbation, but actual value is indeed 40
    if (toolbarHeight < 80) toolbarHeight = 40;
    toolbarHeight += 'px';
    document.getElementById('REPL').style.paddingTop = toolbarHeight;
    var docMain = document.getElementById('main');
    var docReplMain = docMain.getElementsByClassName('replMain');
    if (docReplMain.length !== 0) {
      docReplMain[0].style.paddingTop = toolbarHeight;
    }
  }
  $(window).on('resize', updateEditorHeight);
  function insertAriaPos(submenu) {
    //console.log('doing insertAriaPos', submenu)
    var arr = submenu.toArray();
    //console.log('arr=', arr);
    var len = arr.length;
    for (var i = 0; i < len; i++) {
      var elt = arr[i];
      //console.log('elt', i, '=', elt);
      elt.setAttribute('aria-setsize', len.toString());
      elt.setAttribute('aria-posinset', (i + 1).toString());
    }
  }
  document.addEventListener('click', function () {
    hideAllTopMenuitems();
  });
  theToolbar.click(function (e) {
    e.stopPropagation();
  });
  theToolbar.keydown(function (e) {
    //console.log('toolbar keydown', e);
    //most any key at all
    var kc = e.keyCode;
    if (kc === 27) {
      // escape
      hideAllTopMenuitems();
      //console.log('calling cycleFocus from toolbar')
      CPO.cycleFocus();
      e.stopPropagation();
    } else if (kc === 9 || kc === 37 || kc === 38 || kc === 39 || kc === 40) {
      // an arrow
      var target = $(this).find('[tabIndex=-1]');
      getTopTierMenuitems();
      document.activeElement.blur(); //needed?
      target.first().focus(); //needed?
      //console.log('docactelt=', document.activeElement);
      e.stopPropagation();
    } else {
      hideAllTopMenuitems();
    }
  });
  function clickTopMenuitem(e) {
    hideAllTopMenuitems();
    var thisElt = $(this);
    //console.log('doing clickTopMenuitem on', thisElt);
    var topTierUl = thisElt.closest('ul[id=topTierUl]');
    if (thisElt[0].hasAttribute('aria-hidden')) {
      return;
    }
    if (thisElt[0].getAttribute('disabled') === 'disabled') {
      return;
    }
    //var hiddenP = (thisElt[0].getAttribute('aria-expanded') === 'false');
    //hiddenP always false?
    var thisTopMenuitem = thisElt.closest('li.topTier');
    //console.log('thisTopMenuitem=', thisTopMenuitem);
    var t1 = thisTopMenuitem[0];
    var submenuOpen = thisElt[0].getAttribute('aria-expanded') === 'true';
    if (!submenuOpen) {
      //console.log('hiddenp true branch');
      hideAllTopMenuitems();
      thisTopMenuitem.children('ul.submenu').attr('aria-hidden', 'false').show();
      thisTopMenuitem.children().first().find('[aria-expanded]').attr('aria-expanded', 'true');
    } else {
      //console.log('hiddenp false branch');
      thisTopMenuitem.children('ul.submenu').attr('aria-hidden', 'true').hide();
      thisTopMenuitem.children().first().find('[aria-expanded]').attr('aria-expanded', 'false');
    }
    e.stopPropagation();
  }
  var expandableElts = $(document).find('#header [aria-expanded]');
  expandableElts.click(clickTopMenuitem);
  function hideAllTopMenuitems() {
    //console.log('doing hideAllTopMenuitems');
    var topTierUl = $(document).find('#header ul[id=topTierUl]');
    topTierUl.find('[aria-expanded]').attr('aria-expanded', 'false');
    topTierUl.find('ul.submenu').attr('aria-hidden', 'true').hide();
  }
  var nonexpandableElts = $(document).find('#header .topTier > div > button:not([aria-expanded])');
  nonexpandableElts.click(hideAllTopMenuitems);
  function switchTopMenuitem(destTopMenuitem, destElt) {
    //console.log('doing switchTopMenuitem', destTopMenuitem, destElt);
    //console.log('dtmil=', destTopMenuitem.length);
    hideAllTopMenuitems();
    if (destTopMenuitem && destTopMenuitem.length !== 0) {
      var elt = destTopMenuitem[0];
      var eltId = elt.getAttribute('id');
      destTopMenuitem.children('ul.submenu').attr('aria-hidden', 'false').show();
      destTopMenuitem.children().first().find('[aria-expanded]').attr('aria-expanded', 'true');
    }
    if (destElt) {
      //destElt.attr('tabIndex', '0').focus();
      destElt.focus();
    }
  }
  var showingHelpKeys = false;
  function showHelpKeys() {
    showingHelpKeys = true;
    $('#help-keys').fadeIn(100);
    reciteHelp();
  }
  focusableElts.keydown(function (e) {
    //console.log('focusable elt keydown', e);
    var kc = e.keyCode;
    //$(this).blur(); // Delete?
    var withinSecondTierUl = true;
    var topTierUl = $(this).closest('ul[id=topTierUl]');
    var secondTierUl = $(this).closest('ul.submenu');
    if (secondTierUl.length === 0) {
      withinSecondTierUl = false;
    }
    if (kc === 27) {
      //console.log('escape pressed i')
      $('#help-keys').fadeOut(500);
    }
    if (kc === 27 && withinSecondTierUl) {
      // escape
      var destTopMenuitem = $(this).closest('li.topTier');
      var possElts = destTopMenuitem.find('.focusable:not([disabled])').filter(':visible');
      switchTopMenuitem(destTopMenuitem, possElts.first());
      e.stopPropagation();
    } else if (kc === 39) {
      // rightarrow
      //console.log('rightarrow pressed');
      var srcTopMenuitem = $(this).closest('li.topTier');
      //console.log('srcTopMenuitem=', srcTopMenuitem);
      srcTopMenuitem.children().first().find('.focusable').attr('tabIndex', '-1');
      var topTierMenuitems = getTopTierMenuitems();
      //console.log('ttmi* =', topTierMenuitems);
      var ttmiN = topTierMenuitems.length;
      var j = topTierMenuitems.indexOf(srcTopMenuitem[0]);
      //console.log('j initial=', j);
      for (var i = (j + 1) % ttmiN; i !== j; i = (i + 1) % ttmiN) {
        var destTopMenuitem = $(topTierMenuitems[i]);
        //console.log('destTopMenuitem(a)=', destTopMenuitem);
        var possElts = destTopMenuitem.find('.focusable:not([disabled])').filter(':visible');
        //console.log('possElts=', possElts)
        if (possElts.length > 0) {
          //console.log('final i=', i);
          //console.log('landing on', possElts.first());
          switchTopMenuitem(destTopMenuitem, possElts.first());
          e.stopPropagation();
          break;
        }
      }
    } else if (kc === 37) {
      // leftarrow
      //console.log('leftarrow pressed');
      var srcTopMenuitem = $(this).closest('li.topTier');
      //console.log('srcTopMenuitem=', srcTopMenuitem);
      srcTopMenuitem.children().first().find('.focusable').attr('tabIndex', '-1');
      var topTierMenuitems = getTopTierMenuitems();
      //console.log('ttmi* =', topTierMenuitems);
      var ttmiN = topTierMenuitems.length;
      var j = topTierMenuitems.indexOf(srcTopMenuitem[0]);
      //console.log('j initial=', j);
      for (var i = (j + ttmiN - 1) % ttmiN; i !== j; i = (i + ttmiN - 1) % ttmiN) {
        var destTopMenuitem = $(topTierMenuitems[i]);
        //console.log('destTopMenuitem(b)=', destTopMenuitem);
        //console.log('i=', i)
        var possElts = destTopMenuitem.find('.focusable:not([disabled])').filter(':visible');
        //console.log('possElts=', possElts)
        if (possElts.length > 0) {
          //console.log('final i=', i);
          //console.log('landing on', possElts.first());
          switchTopMenuitem(destTopMenuitem, possElts.first());
          e.stopPropagation();
          break;
        }
      }
    } else if (kc === 38) {
      // uparrow
      //console.log('uparrow pressed');
      var submenu;
      if (withinSecondTierUl) {
        var nearSibs = $(this).closest('div').find('.focusable').filter(':visible');
        //console.log('nearSibs=', nearSibs);
        var myId = $(this)[0].getAttribute('id');
        //console.log('myId=', myId);
        submenu = $([]);
        var thisEncountered = false;
        for (var i = nearSibs.length - 1; i >= 0; i--) {
          if (thisEncountered) {
            //console.log('adding', nearSibs[i]);
            submenu = submenu.add($(nearSibs[i]));
          } else if (nearSibs[i].getAttribute('id') === myId) {
            thisEncountered = true;
          }
        }
        //console.log('submenu so far=', submenu);
        var farSibs = $(this).closest('li').prevAll().find('div:not(.disabled)').find('.focusable').filter(':visible');
        submenu = submenu.add(farSibs);
        if (submenu.length === 0) {
          submenu = $(this).closest('li').closest('ul').find('div:not(.disabled)').find('.focusable').filter(':visible').last();
        }
        if (submenu.length > 0) {
          submenu.last().focus();
        } else {
          /*
          //console.log('no actionable submenu found')
          var topmenuItem = $(this).closest('ul.submenu').closest('li')
          .children().first().find('.focusable:not([disabled])').filter(':visible');
          if (topmenuItem.length > 0) {
            topmenuItem.first().focus();
          } else {
            //console.log('no actionable topmenuitem found either')
          }
          */
        }
      }
      e.stopPropagation();
    } else if (kc === 40) {
      // downarrow
      //console.log('downarrow pressed');
      var submenuDivs;
      var submenu;
      if (!withinSecondTierUl) {
        //console.log('1st tier')
        submenuDivs = $(this).closest('li').children('ul').find('div:not(.disabled)');
        submenu = submenuDivs.find('.focusable').filter(':visible');
        insertAriaPos(submenu);
      } else {
        //console.log('2nd tier')
        var nearSibs = $(this).closest('div').find('.focusable').filter(':visible');
        //console.log('nearSibs=', nearSibs);
        var myId = $(this)[0].getAttribute('id');
        //console.log('myId=', myId);
        submenu = $([]);
        var thisEncountered = false;
        for (var i = 0; i < nearSibs.length; i++) {
          if (thisEncountered) {
            //console.log('adding', nearSibs[i]);
            submenu = submenu.add($(nearSibs[i]));
          } else if (nearSibs[i].getAttribute('id') === myId) {
            thisEncountered = true;
          }
        }
        //console.log('submenu so far=', submenu);
        var farSibs = $(this).closest('li').nextAll().find('div:not(.disabled)').find('.focusable').filter(':visible');
        submenu = submenu.add(farSibs);
        if (submenu.length === 0) {
          submenu = $(this).closest('li').closest('ul').find('div:not(.disabled)').find('.focusable').filter(':visible');
        }
      }
      //console.log('submenu=', submenu)
      if (submenu.length > 0) {
        submenu.first().focus();
      } else {
        //console.log('no actionable submenu found')
      }
      e.stopPropagation();
    } else if (kc === 27) {
      //console.log('esc pressed');
      hideAllTopMenuitems();
      if (showingHelpKeys) {
        showingHelpKeys = false;
      } else {
        //console.log('calling cycleFocus ii')
        CPO.cycleFocus();
      }
      e.stopPropagation();
      e.preventDefault();
      //$(this).closest('nav').closest('main').focus();
    } else if (kc === 9) {
      if (e.shiftKey) {
        hideAllTopMenuitems();
        CPO.cycleFocus(true);
      }
      e.stopPropagation();
      e.preventDefault();
    } else if (kc === 13 || kc === 17 || kc === 20 || kc === 32) {
      // 13=enter 17=ctrl 20=capslock 32=space
      //console.log('stopprop 1')
      e.stopPropagation();
    } else if (kc >= 112 && kc <= 123) {
      //console.log('doprop 1')
      // fn keys
      // go ahead, propagate
    } else if (e.ctrlKey && kc === 191) {
      //console.log('C-? pressed')
      showHelpKeys();
      e.stopPropagation();
    } else {
      //console.log('stopprop 2')
      e.stopPropagation();
    }
    //e.stopPropagation();
  });

  // shareAPI.makeHoverMenu($("#filemenu"), $("#filemenuContents"), false, function(){});
  // shareAPI.makeHoverMenu($("#bonniemenu"), $("#bonniemenuContents"), false, function(){});

  var codeContainer = $("<div>").addClass("replMain");
  codeContainer.attr("role", "region").attr("aria-label", "Definitions");
  //attr("tabIndex", "-1");
  $("#main").prepend(codeContainer);
  if (params["get"]["hideDefinitions"]) {
    $(".replMain").attr("aria-hidden", true).attr("tabindex", '-1');
  }
  var isControlled = params["get"]["controlled"];
  var hasWarnOnExit = "warnOnExit" in params["get"];
  var skipWarning = hasWarnOnExit && params["get"]["warnOnExit"] === "false";
  if (!isControlled && !skipWarning) {
    $(window).bind("beforeunload", function () {
      return "Because this page can load slowly, and you may have outstanding changes, we ask that you confirm before leaving the editor in case closing was an accident.";
    });
  }
  CPO.editor = CPO.makeEditor(codeContainer, {
    runButton: $("#runButton"),
    simpleEditor: false,
    run: CPO.RUN_CODE,
    initialGas: 100,
    scrollPastEnd: true
  });
  CPO.editor.cm.setOption("readOnly", "nocursor");
  CPO.editor.cm.setOption("longLines", new Map());
  function removeShortenedLine(lineHandle) {
    var rulers = CPO.editor.cm.getOption("rulers");
    var rulersMinCol = CPO.editor.cm.getOption("rulersMinCol");
    var longLines = CPO.editor.cm.getOption("longLines");
    if (lineHandle.text.length <= rulersMinCol) {
      lineHandle.rulerListeners.forEach(function (f, evt) {
        return lineHandle.off(evt, f);
      });
      longLines["delete"](lineHandle);
      // console.log("Removed ", lineHandle);
      refreshRulers();
    }
  }
  function deleteLine(lineHandle) {
    var longLines = CPO.editor.cm.getOption("longLines");
    lineHandle.rulerListeners.forEach(function (f, evt) {
      return lineHandle.off(evt, f);
    });
    longLines["delete"](lineHandle);
    // console.log("Removed ", lineHandle);
    refreshRulers();
  }
  function refreshRulers() {
    var rulers = CPO.editor.cm.getOption("rulers");
    var longLines = CPO.editor.cm.getOption("longLines");
    var minLength;
    if (longLines.size === 0) {
      minLength = 0; // if there are no long lines, then we don't care about showing any rulers
    } else {
      minLength = Number.MAX_VALUE;
      longLines.forEach(function (lineNo, lineHandle) {
        if (lineHandle.text.length < minLength) {
          minLength = lineHandle.text.length;
        }
      });
    }
    for (var i = 0; i < rulers.length; i++) {
      if (rulers[i].column >= minLength) {
        rulers[i].className = "hidden";
      } else {
        rulers[i].className = undefined;
      }
    }
    // gotta set the option twice, or else CM short-circuits and ignores it
    CPO.editor.cm.setOption("rulers", undefined);
    CPO.editor.cm.setOption("rulers", rulers);
  }
  CPO.editor.cm.on('changes', function (instance, changeObjs) {
    var minLine = instance.lastLine(),
      maxLine = 0;
    var rulersMinCol = instance.getOption("rulersMinCol");
    var longLines = instance.getOption("longLines");
    changeObjs.forEach(function (change) {
      if (minLine > change.from.line) {
        minLine = change.from.line;
      }
      if (maxLine < change.from.line + change.text.length) {
        maxLine = change.from.line + change.text.length;
      }
    });
    var changed = false;
    instance.eachLine(minLine, maxLine, function (lineHandle) {
      if (lineHandle.text.length > rulersMinCol) {
        if (!longLines.has(lineHandle)) {
          changed = true;
          longLines.set(lineHandle, lineHandle.lineNo());
          lineHandle.rulerListeners = new Map([["change", removeShortenedLine], ["delete", function () {
            // needed because the delete handler gets no arguments at all
            deleteLine(lineHandle);
          }]]);
          lineHandle.rulerListeners.forEach(function (f, evt) {
            return lineHandle.on(evt, f);
          });
          // console.log("Added ", lineHandle);
        }
      } else {
        if (longLines.has(lineHandle)) {
          changed = true;
          longLines["delete"](lineHandle);
          // console.log("Removed ", lineHandle);
        }
      }
    });
    if (changed) {
      refreshRulers();
    }
  });
  programLoaded.then(function (c) {
    CPO.documents.set("definitions://", CPO.editor.cm.getDoc());
    if (c === "") {
      c = CONTEXT_FOR_NEW_FILES;
    }
    if (c.startsWith("<scriptsonly")) {
      // this is blocks file. Open it with /blocks
      window.location.href = window.location.href.replace('editor', 'blocks');
    }
    if (!params["get"]["controlled"]) {
      // NOTE(joe): Clearing history to address https://github.com/brownplt/pyret-lang/issues/386,
      // in which undo can revert the program back to empty
      CPO.editor.cm.setValue(c);
      CPO.editor.cm.clearHistory();
    } else {
      var hideWhenControlled = ["#fullConnectButton", "#logging", "#logout"];
      var removeWhenControlled = ["#connectButtonli"];
      hideWhenControlled.forEach(function (s) {
        return $(s).hide();
      });
      removeWhenControlled.forEach(function (s) {
        return $(s).remove();
      });
    }
  });
  programLoaded.fail(function (error) {
    console.error("Program contents did not load: ", error);
    CPO.documents.set("definitions://", CPO.editor.cm.getDoc());
  });
  console.log("About to load Pyret: ", originalPageLoad, Date.now());
  var pyretLoad = document.createElement('script');
  console.log(window.PYRET);
  pyretLoad.src = window.PYRET;
  pyretLoad.type = "text/javascript";
  pyretLoad.setAttribute("crossorigin", "anonymous");
  document.body.appendChild(pyretLoad);
  var pyretLoad2 = document.createElement('script');
  function logFailureAndManualFetch(url, e) {
    // NOTE(joe): The error reported by the "error" event has essentially no
    // information on it; it's just a notification that _something_ went wrong.
    // So, we log that something happened, then immediately do an AJAX request
    // call for the same URL, to see if we can get more information. This
    // doesn't perfectly tell us about the original failure, but it's
    // something.

    // In addition, if someone is seeing the Pyret failed to load error, but we
    // don't get these logging events, we have a strong hint that something is
    // up with their network.
    logger.log('pyret-load-failure', {
      event: 'initial-failure',
      url: url,
      // The timestamp appears to count from the beginning of page load,
      // which may approximate download time if, say, requests are timing out
      // or getting cut off.

      timeStamp: e.timeStamp
    });
    var manualFetch = $.ajax(url);
    manualFetch.then(function (res) {
      // Here, we log the first 100 characters of the response to make sure
      // they resemble the Pyret blob
      logger.log('pyret-load-failure', {
        event: 'success-with-ajax',
        contentsPrefix: res.slice(0, 100)
      });
    });
    manualFetch.fail(function (res) {
      logger.log('pyret-load-failure', {
        event: 'failure-with-ajax',
        status: res.status,
        statusText: res.statusText,
        // Since responseText could be a long error page, and we don't want to
        // log huge pages, we slice it to 100 characters, which is enough to
        // tell us what's going on (e.g. AWS failure, network outage).
        responseText: res.responseText.slice(0, 100)
      });
    });
  }
  $(pyretLoad).on("error", function (e) {
    logFailureAndManualFetch(window.PYRET, e);
    pyretLoad2.src = undefined;
    pyretLoad2.type = "text/javascript";
    document.body.appendChild(pyretLoad2);
  });
  $(pyretLoad2).on("error", function (e) {
    $("#loader").hide();
    $("#runPart").hide();
    $("#breakButton").hide();
    window.stickError("Pyret failed to load; check your connection or try refreshing the page.  If this happens repeatedly, please report it as a bug.");
    logFailureAndManualFetch(undefined, e);
  });
  function makeEvent() {
    var handlers = [];
    function on(handler) {
      handlers.push(handler);
    }
    function trigger(v) {
      handlers.forEach(function (h) {
        return h(v);
      });
    }
    return [on, trigger];
  }
  var _makeEvent = makeEvent(),
    _makeEvent2 = _slicedToArray(_makeEvent, 2),
    onRun = _makeEvent2[0],
    triggerOnRun = _makeEvent2[1];
  var _makeEvent3 = makeEvent(),
    _makeEvent4 = _slicedToArray(_makeEvent3, 2),
    onInteraction = _makeEvent4[0],
    triggerOnInteraction = _makeEvent4[1];
  var _makeEvent5 = makeEvent(),
    _makeEvent6 = _slicedToArray(_makeEvent5, 2),
    onLoad = _makeEvent6[0],
    triggerOnLoad = _makeEvent6[1];
  programLoaded.fin(function () {
    CPO.editor.focus();
    CPO.editor.cm.setOption("readOnly", false);
  });
  CPO.autoSave = autoSave;
  CPO.save = save;
  CPO.updateName = updateName;
  CPO.showShareContainer = showShareContainer;
  CPO.loadProgram = loadProgram;
  CPO.storageAPI = storageAPI;
  CPO.cycleFocus = cycleFocus;
  CPO.say = say;
  CPO.sayAndForget = sayAndForget;
  CPO.events = {
    onRun: onRun,
    triggerOnRun: triggerOnRun,
    onInteraction: onInteraction,
    triggerOnInteraction: triggerOnInteraction,
    onLoad: onLoad,
    triggerOnLoad: triggerOnLoad
  };

  // We never want interactions to be hidden *when running code*.
  // So hideInteractions should go away as soon as run is clicked
  CPO.events.onRun(function () {
    document.body.classList.remove("hideInteractions");
  });
  var initialState = params["get"]["initialState"];
  if (typeof acquireVsCodeApi === "function") {
    window.MESSAGES = makeEvents({
      CPO: CPO,
      sendPort: acquireVsCodeApi(),
      receivePort: window,
      initialState: initialState
    });
  } else if (window.parent && window.parent !== window) {
    window.MESSAGES = makeEvents({
      CPO: CPO,
      sendPort: window.parent,
      receivePort: window,
      initialState: initialState
    });
  }
});
})();

/******/ })()
;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoianMvYmVmb3JlUHlyZXQuanMiLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0EsTUFBTSxTQUFTLElBQXlEO0FBQ3hFOztBQUVBO0FBQ0EsTUFBTSxLQUFLLDBCQStCTjs7QUFFTCxDQUFDO0FBQ0Q7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsRUFBRTtBQUNGO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGdCQUFnQjtBQUNoQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBLFVBQVU7QUFDVjtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUEsY0FBYztBQUNkO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsaUJBQWlCO0FBQ2pCO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUEsTUFBTTtBQUNOO0FBQ0E7QUFDQTtBQUNBLFVBQVU7QUFDVjtBQUNBO0FBQ0E7QUFDQTs7QUFFQSxNQUFNO0FBQ047QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUEsTUFBTTtBQUNOO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsQ0FBQzs7QUFFRDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGNBQWM7QUFDZDtBQUNBO0FBQ0EsZUFBZSxnQkFBZ0I7QUFDL0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSx3QkFBd0IsaUJBQWlCO0FBQ3pDO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM7QUFDVDtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBOztBQUVBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxFQUFFO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLDhCQUE4QixL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O0FBQ2I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0EsS0FBSztBQUNMOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxtQ0FBbUMsZUFBZTtBQUNsRDs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQSxtQ0FBbUMsZUFBZTtBQUNsRDs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsTUFBTTtBQUNOO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxhQUFhO0FBQ2I7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTs7QUFFQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0EsS0FBSztBQUNMLGlCQUFpQjtBQUNqQixLQUFLOztBQUVMO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQTtBQUNBLFNBQVM7QUFDVDtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGNBQWM7QUFDZDtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMLGlCQUFpQjtBQUNqQixLQUFLO0FBQ0w7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxVQUFVO0FBQ1Y7QUFDQTtBQUNBLEtBQUs7QUFDTDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0EsS0FBSztBQUNMO0FBQ0EsS0FBSztBQUNMOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGtCQUFrQjtBQUNsQjtBQUNBO0FBQ0E7QUFDQTtBQUNBLGtCQUFrQjtBQUNsQjtBQUNBO0FBQ0EsY0FBYztBQUNkO0FBQ0E7QUFDQTtBQUNBO0FBQ0Esa0JBQWtCO0FBQ2xCO0FBQ0E7QUFDQSxzQkFBc0I7QUFDdEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLElBQUk7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSTtBQUNKO0FBQ0E7QUFDQSxXQUFXLFVBQVU7QUFDckIsYUFBYSxVQUFVO0FBQ3ZCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM7QUFDVDtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxvQkFBb0IsU0FBUztBQUM3QjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLO0FBQ0w7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFdBQVcsUUFBUTtBQUNuQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsY0FBYztBQUNkO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxxQkFBcUI7QUFDckI7QUFDQTtBQUNBLDBDQUEwQywrQkFBK0I7QUFDekU7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMOztBQUVBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxXQUFXLFFBQVE7QUFDbkI7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLGFBQWE7QUFDYjtBQUNBLEtBQUs7O0FBRUw7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0EsU0FBUztBQUNULEtBQUs7QUFDTDs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsV0FBVyxhQUFhO0FBQ3hCO0FBQ0EsYUFBYSxjQUFjO0FBQzNCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLFNBQVM7QUFDVCxLQUFLO0FBQ0w7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQSxXQUFXLE1BQU07QUFDakIsV0FBVyxVQUFVO0FBQ3JCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsV0FBVyxNQUFNO0FBQ2pCLFdBQVcsVUFBVTtBQUNyQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxXQUFXLE1BQU07QUFDakIsV0FBVyxVQUFVO0FBQ3JCO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNULEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQSxTQUFTO0FBQ1QsS0FBSztBQUNMOztBQUVBO0FBQ0E7QUFDQTtBQUNBLFdBQVcsTUFBTTtBQUNqQjtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxjQUFjO0FBQ2Q7QUFDQTtBQUNBLFNBQVM7QUFDVDs7QUFFQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQSxXQUFXLE1BQU07QUFDakIsV0FBVyxRQUFRO0FBQ25CLFdBQVcsTUFBTTtBQUNqQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUs7O0FBRUw7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0E7QUFDQSxLQUFLOztBQUVMO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0EsV0FBVyxNQUFNO0FBQ2pCLFdBQVcsUUFBUTtBQUNuQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQUVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTO0FBQ1Q7QUFDQSxLQUFLO0FBQ0w7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUztBQUNUO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsSUFBSTtBQUNKO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUFFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7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O0lBQzFDamhCLE1BQU0sQ0FBQ2toQixRQUFRLEdBQUdDLFVBQVUsQ0FBQztNQUMzQjNaLEdBQUcsRUFBRUEsR0FBRztNQUNSNFosUUFBUSxFQUFFSCxnQkFBZ0IsQ0FBQyxDQUFDO01BQzVCSSxXQUFXLEVBQUVyaEIsTUFBTTtNQUNuQmdoQixZQUFZLEVBQVpBO0lBQ0YsQ0FBQyxDQUFDO0VBQ0osQ0FBQyxNQUNJLElBQUloaEIsTUFBTSxDQUFDK0YsTUFBTSxJQUFLL0YsTUFBTSxDQUFDK0YsTUFBTSxLQUFLL0YsTUFBTyxFQUFHO0lBQ3JEQSxNQUFNLENBQUNraEIsUUFBUSxHQUFHQyxVQUFVLENBQUM7TUFBRTNaLEdBQUcsRUFBRUEsR0FBRztNQUFFNFosUUFBUSxFQUFFcGhCLE1BQU0sQ0FBQytGLE1BQU07TUFBRXNiLFdBQVcsRUFBRXJoQixNQUFNO01BQUVnaEIsWUFBWSxFQUFaQTtJQUFhLENBQUMsQ0FBQztFQUN4RztBQUNGLENBQUMsQ0FBQyxDIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vY29kZS5weXJldC5vcmcvLi9ub2RlX21vZHVsZXMvcS9xLmpzIiwid2VicGFjazovL2NvZGUucHlyZXQub3JnLy4vbm9kZV9tb2R1bGVzL3VybC5qcy91cmwuanMiLCJ3ZWJwYWNrOi8vY29kZS5weXJldC5vcmcvLi9zcmMvd2ViL2pzL21vZGFsLXByb21wdC5qcyIsIndlYnBhY2s6Ly9jb2RlLnB5cmV0Lm9yZy93ZWJwYWNrL2Jvb3RzdHJhcCIsIndlYnBhY2s6Ly9jb2RlLnB5cmV0Lm9yZy8uL3NyYy93ZWIvanMvYmVmb3JlUHlyZXQuanMiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gdmltOnRzPTQ6c3RzPTQ6c3c9NDpcbi8qIVxuICpcbiAqIENvcHlyaWdodCAyMDA5LTIwMTIgS3JpcyBLb3dhbCB1bmRlciB0aGUgdGVybXMgb2YgdGhlIE1JVFxuICogbGljZW5zZSBmb3VuZCBhdCBodHRwOi8vZ2l0aHViLmNvbS9rcmlza293YWwvcS9yYXcvbWFzdGVyL0xJQ0VOU0VcbiAqXG4gKiBXaXRoIHBhcnRzIGJ5IFR5bGVyIENsb3NlXG4gKiBDb3B5cmlnaHQgMjAwNy0yMDA5IFR5bGVyIENsb3NlIHVuZGVyIHRoZSB0ZXJtcyBvZiB0aGUgTUlUIFggbGljZW5zZSBmb3VuZFxuICogYXQgaHR0cDovL3d3dy5vcGVuc291cmNlLm9yZy9saWNlbnNlcy9taXQtbGljZW5zZS5odG1sXG4gKiBGb3JrZWQgYXQgcmVmX3NlbmQuanMgdmVyc2lvbjogMjAwOS0wNS0xMVxuICpcbiAqIFdpdGggcGFydHMgYnkgTWFyayBNaWxsZXJcbiAqIENvcHlyaWdodCAoQykgMjAxMSBHb29nbGUgSW5jLlxuICpcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcbiAqXG4gKiBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcbiAqXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxuICpcbiAqL1xuXG4oZnVuY3Rpb24gKGRlZmluaXRpb24pIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIC8vIFRoaXMgZmlsZSB3aWxsIGZ1bmN0aW9uIHByb3Blcmx5IGFzIGEgPHNjcmlwdD4gdGFnLCBvciBhIG1vZHVsZVxuICAgIC8vIHVzaW5nIENvbW1vbkpTIGFuZCBOb2RlSlMgb3IgUmVxdWlyZUpTIG1vZHVsZSBmb3JtYXRzLiAgSW5cbiAgICAvLyBDb21tb24vTm9kZS9SZXF1aXJlSlMsIHRoZSBtb2R1bGUgZXhwb3J0cyB0aGUgUSBBUEkgYW5kIHdoZW5cbiAgICAvLyBleGVjdXRlZCBhcyBhIHNpbXBsZSA8c2NyaXB0PiwgaXQgY3JlYXRlcyBhIFEgZ2xvYmFsIGluc3RlYWQuXG5cbiAgICAvLyBNb250YWdlIFJlcXVpcmVcbiAgICBpZiAodHlwZW9mIGJvb3RzdHJhcCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgIGJvb3RzdHJhcChcInByb21pc2VcIiwgZGVmaW5pdGlvbik7XG5cbiAgICAvLyBDb21tb25KU1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGV4cG9ydHMgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIG1vZHVsZSA9PT0gXCJvYmplY3RcIikge1xuICAgICAgICBtb2R1bGUuZXhwb3J0cyA9IGRlZmluaXRpb24oKTtcblxuICAgIC8vIFJlcXVpcmVKU1xuICAgIH0gZWxzZSBpZiAodHlwZW9mIGRlZmluZSA9PT0gXCJmdW5jdGlvblwiICYmIGRlZmluZS5hbWQpIHtcbiAgICAgICAgZGVmaW5lKGRlZmluaXRpb24pO1xuXG4gICAgLy8gU0VTIChTZWN1cmUgRWNtYVNjcmlwdClcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZXMgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgaWYgKCFzZXMub2soKSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VzLm1ha2VRID0gZGVmaW5pdGlvbjtcbiAgICAgICAgfVxuXG4gICAgLy8gPHNjcmlwdD5cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB3aW5kb3cgIT09IFwidW5kZWZpbmVkXCIgfHwgdHlwZW9mIHNlbGYgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICAgICAgLy8gUHJlZmVyIHdpbmRvdyBvdmVyIHNlbGYgZm9yIGFkZC1vbiBzY3JpcHRzLiBVc2Ugc2VsZiBmb3JcbiAgICAgICAgLy8gbm9uLXdpbmRvd2VkIGNvbnRleHRzLlxuICAgICAgICB2YXIgZ2xvYmFsID0gdHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIiA/IHdpbmRvdyA6IHNlbGY7XG5cbiAgICAgICAgLy8gR2V0IHRoZSBgd2luZG93YCBvYmplY3QsIHNhdmUgdGhlIHByZXZpb3VzIFEgZ2xvYmFsXG4gICAgICAgIC8vIGFuZCBpbml0aWFsaXplIFEgYXMgYSBnbG9iYWwuXG4gICAgICAgIHZhciBwcmV2aW91c1EgPSBnbG9iYWwuUTtcbiAgICAgICAgZ2xvYmFsLlEgPSBkZWZpbml0aW9uKCk7XG5cbiAgICAgICAgLy8gQWRkIGEgbm9Db25mbGljdCBmdW5jdGlvbiBzbyBRIGNhbiBiZSByZW1vdmVkIGZyb20gdGhlXG4gICAgICAgIC8vIGdsb2JhbCBuYW1lc3BhY2UuXG4gICAgICAgIGdsb2JhbC5RLm5vQ29uZmxpY3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICBnbG9iYWwuUSA9IHByZXZpb3VzUTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzO1xuICAgICAgICB9O1xuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiVGhpcyBlbnZpcm9ubWVudCB3YXMgbm90IGFudGljaXBhdGVkIGJ5IFEuIFBsZWFzZSBmaWxlIGEgYnVnLlwiKTtcbiAgICB9XG5cbn0pKGZ1bmN0aW9uICgpIHtcblwidXNlIHN0cmljdFwiO1xuXG52YXIgaGFzU3RhY2tzID0gZmFsc2U7XG50cnkge1xuICAgIHRocm93IG5ldyBFcnJvcigpO1xufSBjYXRjaCAoZSkge1xuICAgIGhhc1N0YWNrcyA9ICEhZS5zdGFjaztcbn1cblxuLy8gQWxsIGNvZGUgYWZ0ZXIgdGhpcyBwb2ludCB3aWxsIGJlIGZpbHRlcmVkIGZyb20gc3RhY2sgdHJhY2VzIHJlcG9ydGVkXG4vLyBieSBRLlxudmFyIHFTdGFydGluZ0xpbmUgPSBjYXB0dXJlTGluZSgpO1xudmFyIHFGaWxlTmFtZTtcblxuLy8gc2hpbXNcblxuLy8gdXNlZCBmb3IgZmFsbGJhY2sgaW4gXCJhbGxSZXNvbHZlZFwiXG52YXIgbm9vcCA9IGZ1bmN0aW9uICgpIHt9O1xuXG4vLyBVc2UgdGhlIGZhc3Rlc3QgcG9zc2libGUgbWVhbnMgdG8gZXhlY3V0ZSBhIHRhc2sgaW4gYSBmdXR1cmUgdHVyblxuLy8gb2YgdGhlIGV2ZW50IGxvb3AuXG52YXIgbmV4dFRpY2sgPShmdW5jdGlvbiAoKSB7XG4gICAgLy8gbGlua2VkIGxpc3Qgb2YgdGFza3MgKHNpbmdsZSwgd2l0aCBoZWFkIG5vZGUpXG4gICAgdmFyIGhlYWQgPSB7dGFzazogdm9pZCAwLCBuZXh0OiBudWxsfTtcbiAgICB2YXIgdGFpbCA9IGhlYWQ7XG4gICAgdmFyIGZsdXNoaW5nID0gZmFsc2U7XG4gICAgdmFyIHJlcXVlc3RUaWNrID0gdm9pZCAwO1xuICAgIHZhciBpc05vZGVKUyA9IGZhbHNlO1xuICAgIC8vIHF1ZXVlIGZvciBsYXRlIHRhc2tzLCB1c2VkIGJ5IHVuaGFuZGxlZCByZWplY3Rpb24gdHJhY2tpbmdcbiAgICB2YXIgbGF0ZXJRdWV1ZSA9IFtdO1xuXG4gICAgZnVuY3Rpb24gZmx1c2goKSB7XG4gICAgICAgIC8qIGpzaGludCBsb29wZnVuYzogdHJ1ZSAqL1xuICAgICAgICB2YXIgdGFzaywgZG9tYWluO1xuXG4gICAgICAgIHdoaWxlIChoZWFkLm5leHQpIHtcbiAgICAgICAgICAgIGhlYWQgPSBoZWFkLm5leHQ7XG4gICAgICAgICAgICB0YXNrID0gaGVhZC50YXNrO1xuICAgICAgICAgICAgaGVhZC50YXNrID0gdm9pZCAwO1xuICAgICAgICAgICAgZG9tYWluID0gaGVhZC5kb21haW47XG5cbiAgICAgICAgICAgIGlmIChkb21haW4pIHtcbiAgICAgICAgICAgICAgICBoZWFkLmRvbWFpbiA9IHZvaWQgMDtcbiAgICAgICAgICAgICAgICBkb21haW4uZW50ZXIoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJ1blNpbmdsZSh0YXNrLCBkb21haW4pO1xuXG4gICAgICAgIH1cbiAgICAgICAgd2hpbGUgKGxhdGVyUXVldWUubGVuZ3RoKSB7XG4gICAgICAgICAgICB0YXNrID0gbGF0ZXJRdWV1ZS5wb3AoKTtcbiAgICAgICAgICAgIHJ1blNpbmdsZSh0YXNrKTtcbiAgICAgICAgfVxuICAgICAgICBmbHVzaGluZyA9IGZhbHNlO1xuICAgIH1cbiAgICAvLyBydW5zIGEgc2luZ2xlIGZ1bmN0aW9uIGluIHRoZSBhc3luYyBxdWV1ZVxuICAgIGZ1bmN0aW9uIHJ1blNpbmdsZSh0YXNrLCBkb21haW4pIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRhc2soKTtcblxuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBpZiAoaXNOb2RlSlMpIHtcbiAgICAgICAgICAgICAgICAvLyBJbiBub2RlLCB1bmNhdWdodCBleGNlcHRpb25zIGFyZSBjb25zaWRlcmVkIGZhdGFsIGVycm9ycy5cbiAgICAgICAgICAgICAgICAvLyBSZS10aHJvdyB0aGVtIHN5bmNocm9ub3VzbHkgdG8gaW50ZXJydXB0IGZsdXNoaW5nIVxuXG4gICAgICAgICAgICAgICAgLy8gRW5zdXJlIGNvbnRpbnVhdGlvbiBpZiB0aGUgdW5jYXVnaHQgZXhjZXB0aW9uIGlzIHN1cHByZXNzZWRcbiAgICAgICAgICAgICAgICAvLyBsaXN0ZW5pbmcgXCJ1bmNhdWdodEV4Y2VwdGlvblwiIGV2ZW50cyAoYXMgZG9tYWlucyBkb2VzKS5cbiAgICAgICAgICAgICAgICAvLyBDb250aW51ZSBpbiBuZXh0IGV2ZW50IHRvIGF2b2lkIHRpY2sgcmVjdXJzaW9uLlxuICAgICAgICAgICAgICAgIGlmIChkb21haW4pIHtcbiAgICAgICAgICAgICAgICAgICAgZG9tYWluLmV4aXQoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2V0VGltZW91dChmbHVzaCwgMCk7XG4gICAgICAgICAgICAgICAgaWYgKGRvbWFpbikge1xuICAgICAgICAgICAgICAgICAgICBkb21haW4uZW50ZXIoKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB0aHJvdyBlO1xuXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIEluIGJyb3dzZXJzLCB1bmNhdWdodCBleGNlcHRpb25zIGFyZSBub3QgZmF0YWwuXG4gICAgICAgICAgICAgICAgLy8gUmUtdGhyb3cgdGhlbSBhc3luY2hyb25vdXNseSB0byBhdm9pZCBzbG93LWRvd25zLlxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBlO1xuICAgICAgICAgICAgICAgIH0sIDApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGRvbWFpbikge1xuICAgICAgICAgICAgZG9tYWluLmV4aXQoKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIG5leHRUaWNrID0gZnVuY3Rpb24gKHRhc2spIHtcbiAgICAgICAgdGFpbCA9IHRhaWwubmV4dCA9IHtcbiAgICAgICAgICAgIHRhc2s6IHRhc2ssXG4gICAgICAgICAgICBkb21haW46IGlzTm9kZUpTICYmIHByb2Nlc3MuZG9tYWluLFxuICAgICAgICAgICAgbmV4dDogbnVsbFxuICAgICAgICB9O1xuXG4gICAgICAgIGlmICghZmx1c2hpbmcpIHtcbiAgICAgICAgICAgIGZsdXNoaW5nID0gdHJ1ZTtcbiAgICAgICAgICAgIHJlcXVlc3RUaWNrKCk7XG4gICAgICAgIH1cbiAgICB9O1xuXG4gICAgaWYgKHR5cGVvZiBwcm9jZXNzID09PSBcIm9iamVjdFwiICYmXG4gICAgICAgIHByb2Nlc3MudG9TdHJpbmcoKSA9PT0gXCJbb2JqZWN0IHByb2Nlc3NdXCIgJiYgcHJvY2Vzcy5uZXh0VGljaykge1xuICAgICAgICAvLyBFbnN1cmUgUSBpcyBpbiBhIHJlYWwgTm9kZSBlbnZpcm9ubWVudCwgd2l0aCBhIGBwcm9jZXNzLm5leHRUaWNrYC5cbiAgICAgICAgLy8gVG8gc2VlIHRocm91Z2ggZmFrZSBOb2RlIGVudmlyb25tZW50czpcbiAgICAgICAgLy8gKiBNb2NoYSB0ZXN0IHJ1bm5lciAtIGV4cG9zZXMgYSBgcHJvY2Vzc2AgZ2xvYmFsIHdpdGhvdXQgYSBgbmV4dFRpY2tgXG4gICAgICAgIC8vICogQnJvd3NlcmlmeSAtIGV4cG9zZXMgYSBgcHJvY2Vzcy5uZXhUaWNrYCBmdW5jdGlvbiB0aGF0IHVzZXNcbiAgICAgICAgLy8gICBgc2V0VGltZW91dGAuIEluIHRoaXMgY2FzZSBgc2V0SW1tZWRpYXRlYCBpcyBwcmVmZXJyZWQgYmVjYXVzZVxuICAgICAgICAvLyAgICBpdCBpcyBmYXN0ZXIuIEJyb3dzZXJpZnkncyBgcHJvY2Vzcy50b1N0cmluZygpYCB5aWVsZHNcbiAgICAgICAgLy8gICBcIltvYmplY3QgT2JqZWN0XVwiLCB3aGlsZSBpbiBhIHJlYWwgTm9kZSBlbnZpcm9ubWVudFxuICAgICAgICAvLyAgIGBwcm9jZXNzLm5leHRUaWNrKClgIHlpZWxkcyBcIltvYmplY3QgcHJvY2Vzc11cIi5cbiAgICAgICAgaXNOb2RlSlMgPSB0cnVlO1xuXG4gICAgICAgIHJlcXVlc3RUaWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcHJvY2Vzcy5uZXh0VGljayhmbHVzaCk7XG4gICAgICAgIH07XG5cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBzZXRJbW1lZGlhdGUgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAvLyBJbiBJRTEwLCBOb2RlLmpzIDAuOSssIG9yIGh0dHBzOi8vZ2l0aHViLmNvbS9Ob2JsZUpTL3NldEltbWVkaWF0ZVxuICAgICAgICBpZiAodHlwZW9mIHdpbmRvdyAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgcmVxdWVzdFRpY2sgPSBzZXRJbW1lZGlhdGUuYmluZCh3aW5kb3csIGZsdXNoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJlcXVlc3RUaWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIHNldEltbWVkaWF0ZShmbHVzaCk7XG4gICAgICAgICAgICB9O1xuICAgICAgICB9XG5cbiAgICB9IGVsc2UgaWYgKHR5cGVvZiBNZXNzYWdlQ2hhbm5lbCAhPT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAvLyBtb2Rlcm4gYnJvd3NlcnNcbiAgICAgICAgLy8gaHR0cDovL3d3dy5ub25ibG9ja2luZy5pby8yMDExLzA2L3dpbmRvd25leHR0aWNrLmh0bWxcbiAgICAgICAgdmFyIGNoYW5uZWwgPSBuZXcgTWVzc2FnZUNoYW5uZWwoKTtcbiAgICAgICAgLy8gQXQgbGVhc3QgU2FmYXJpIFZlcnNpb24gNi4wLjUgKDg1MzYuMzAuMSkgaW50ZXJtaXR0ZW50bHkgY2Fubm90IGNyZWF0ZVxuICAgICAgICAvLyB3b3JraW5nIG1lc3NhZ2UgcG9ydHMgdGhlIGZpcnN0IHRpbWUgYSBwYWdlIGxvYWRzLlxuICAgICAgICBjaGFubmVsLnBvcnQxLm9ubWVzc2FnZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJlcXVlc3RUaWNrID0gcmVxdWVzdFBvcnRUaWNrO1xuICAgICAgICAgICAgY2hhbm5lbC5wb3J0MS5vbm1lc3NhZ2UgPSBmbHVzaDtcbiAgICAgICAgICAgIGZsdXNoKCk7XG4gICAgICAgIH07XG4gICAgICAgIHZhciByZXF1ZXN0UG9ydFRpY2sgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAvLyBPcGVyYSByZXF1aXJlcyB1cyB0byBwcm92aWRlIGEgbWVzc2FnZSBwYXlsb2FkLCByZWdhcmRsZXNzIG9mXG4gICAgICAgICAgICAvLyB3aGV0aGVyIHdlIHVzZSBpdC5cbiAgICAgICAgICAgIGNoYW5uZWwucG9ydDIucG9zdE1lc3NhZ2UoMCk7XG4gICAgICAgIH07XG4gICAgICAgIHJlcXVlc3RUaWNrID0gZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgc2V0VGltZW91dChmbHVzaCwgMCk7XG4gICAgICAgICAgICByZXF1ZXN0UG9ydFRpY2soKTtcbiAgICAgICAgfTtcblxuICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIG9sZCBicm93c2Vyc1xuICAgICAgICByZXF1ZXN0VGljayA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHNldFRpbWVvdXQoZmx1c2gsIDApO1xuICAgICAgICB9O1xuICAgIH1cbiAgICAvLyBydW5zIGEgdGFzayBhZnRlciBhbGwgb3RoZXIgdGFza3MgaGF2ZSBiZWVuIHJ1blxuICAgIC8vIHRoaXMgaXMgdXNlZnVsIGZvciB1bmhhbmRsZWQgcmVqZWN0aW9uIHRyYWNraW5nIHRoYXQgbmVlZHMgdG8gaGFwcGVuXG4gICAgLy8gYWZ0ZXIgYWxsIGB0aGVuYGQgdGFza3MgaGF2ZSBiZWVuIHJ1bi5cbiAgICBuZXh0VGljay5ydW5BZnRlciA9IGZ1bmN0aW9uICh0YXNrKSB7XG4gICAgICAgIGxhdGVyUXVldWUucHVzaCh0YXNrKTtcbiAgICAgICAgaWYgKCFmbHVzaGluZykge1xuICAgICAgICAgICAgZmx1c2hpbmcgPSB0cnVlO1xuICAgICAgICAgICAgcmVxdWVzdFRpY2soKTtcbiAgICAgICAgfVxuICAgIH07XG4gICAgcmV0dXJuIG5leHRUaWNrO1xufSkoKTtcblxuLy8gQXR0ZW1wdCB0byBtYWtlIGdlbmVyaWNzIHNhZmUgaW4gdGhlIGZhY2Ugb2YgZG93bnN0cmVhbVxuLy8gbW9kaWZpY2F0aW9ucy5cbi8vIFRoZXJlIGlzIG5vIHNpdHVhdGlvbiB3aGVyZSB0aGlzIGlzIG5lY2Vzc2FyeS5cbi8vIElmIHlvdSBuZWVkIGEgc2VjdXJpdHkgZ3VhcmFudGVlLCB0aGVzZSBwcmltb3JkaWFscyBuZWVkIHRvIGJlXG4vLyBkZWVwbHkgZnJvemVuIGFueXdheSwgYW5kIGlmIHlvdSBkb27igJl0IG5lZWQgYSBzZWN1cml0eSBndWFyYW50ZWUsXG4vLyB0aGlzIGlzIGp1c3QgcGxhaW4gcGFyYW5vaWQuXG4vLyBIb3dldmVyLCB0aGlzICoqbWlnaHQqKiBoYXZlIHRoZSBuaWNlIHNpZGUtZWZmZWN0IG9mIHJlZHVjaW5nIHRoZSBzaXplIG9mXG4vLyB0aGUgbWluaWZpZWQgY29kZSBieSByZWR1Y2luZyB4LmNhbGwoKSB0byBtZXJlbHkgeCgpXG4vLyBTZWUgTWFyayBNaWxsZXLigJlzIGV4cGxhbmF0aW9uIG9mIHdoYXQgdGhpcyBkb2VzLlxuLy8gaHR0cDovL3dpa2kuZWNtYXNjcmlwdC5vcmcvZG9rdS5waHA/aWQ9Y29udmVudGlvbnM6c2FmZV9tZXRhX3Byb2dyYW1taW5nXG52YXIgY2FsbCA9IEZ1bmN0aW9uLmNhbGw7XG5mdW5jdGlvbiB1bmN1cnJ5VGhpcyhmKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIGNhbGwuYXBwbHkoZiwgYXJndW1lbnRzKTtcbiAgICB9O1xufVxuLy8gVGhpcyBpcyBlcXVpdmFsZW50LCBidXQgc2xvd2VyOlxuLy8gdW5jdXJyeVRoaXMgPSBGdW5jdGlvbl9iaW5kLmJpbmQoRnVuY3Rpb25fYmluZC5jYWxsKTtcbi8vIGh0dHA6Ly9qc3BlcmYuY29tL3VuY3Vycnl0aGlzXG5cbnZhciBhcnJheV9zbGljZSA9IHVuY3VycnlUaGlzKEFycmF5LnByb3RvdHlwZS5zbGljZSk7XG5cbnZhciBhcnJheV9yZWR1Y2UgPSB1bmN1cnJ5VGhpcyhcbiAgICBBcnJheS5wcm90b3R5cGUucmVkdWNlIHx8IGZ1bmN0aW9uIChjYWxsYmFjaywgYmFzaXMpIHtcbiAgICAgICAgdmFyIGluZGV4ID0gMCxcbiAgICAgICAgICAgIGxlbmd0aCA9IHRoaXMubGVuZ3RoO1xuICAgICAgICAvLyBjb25jZXJuaW5nIHRoZSBpbml0aWFsIHZhbHVlLCBpZiBvbmUgaXMgbm90IHByb3ZpZGVkXG4gICAgICAgIGlmIChhcmd1bWVudHMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICAvLyBzZWVrIHRvIHRoZSBmaXJzdCB2YWx1ZSBpbiB0aGUgYXJyYXksIGFjY291bnRpbmdcbiAgICAgICAgICAgIC8vIGZvciB0aGUgcG9zc2liaWxpdHkgdGhhdCBpcyBpcyBhIHNwYXJzZSBhcnJheVxuICAgICAgICAgICAgZG8ge1xuICAgICAgICAgICAgICAgIGlmIChpbmRleCBpbiB0aGlzKSB7XG4gICAgICAgICAgICAgICAgICAgIGJhc2lzID0gdGhpc1tpbmRleCsrXTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICgrK2luZGV4ID49IGxlbmd0aCkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKCk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSB3aGlsZSAoMSk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gcmVkdWNlXG4gICAgICAgIGZvciAoOyBpbmRleCA8IGxlbmd0aDsgaW5kZXgrKykge1xuICAgICAgICAgICAgLy8gYWNjb3VudCBmb3IgdGhlIHBvc3NpYmlsaXR5IHRoYXQgdGhlIGFycmF5IGlzIHNwYXJzZVxuICAgICAgICAgICAgaWYgKGluZGV4IGluIHRoaXMpIHtcbiAgICAgICAgICAgICAgICBiYXNpcyA9IGNhbGxiYWNrKGJhc2lzLCB0aGlzW2luZGV4XSwgaW5kZXgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBiYXNpcztcbiAgICB9XG4pO1xuXG52YXIgYXJyYXlfaW5kZXhPZiA9IHVuY3VycnlUaGlzKFxuICAgIEFycmF5LnByb3RvdHlwZS5pbmRleE9mIHx8IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAvLyBub3QgYSB2ZXJ5IGdvb2Qgc2hpbSwgYnV0IGdvb2QgZW5vdWdoIGZvciBvdXIgb25lIHVzZSBvZiBpdFxuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IHRoaXMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGlmICh0aGlzW2ldID09PSB2YWx1ZSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiAtMTtcbiAgICB9XG4pO1xuXG52YXIgYXJyYXlfbWFwID0gdW5jdXJyeVRoaXMoXG4gICAgQXJyYXkucHJvdG90eXBlLm1hcCB8fCBmdW5jdGlvbiAoY2FsbGJhY2ssIHRoaXNwKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgdmFyIGNvbGxlY3QgPSBbXTtcbiAgICAgICAgYXJyYXlfcmVkdWNlKHNlbGYsIGZ1bmN0aW9uICh1bmRlZmluZWQsIHZhbHVlLCBpbmRleCkge1xuICAgICAgICAgICAgY29sbGVjdC5wdXNoKGNhbGxiYWNrLmNhbGwodGhpc3AsIHZhbHVlLCBpbmRleCwgc2VsZikpO1xuICAgICAgICB9LCB2b2lkIDApO1xuICAgICAgICByZXR1cm4gY29sbGVjdDtcbiAgICB9XG4pO1xuXG52YXIgb2JqZWN0X2NyZWF0ZSA9IE9iamVjdC5jcmVhdGUgfHwgZnVuY3Rpb24gKHByb3RvdHlwZSkge1xuICAgIGZ1bmN0aW9uIFR5cGUoKSB7IH1cbiAgICBUeXBlLnByb3RvdHlwZSA9IHByb3RvdHlwZTtcbiAgICByZXR1cm4gbmV3IFR5cGUoKTtcbn07XG5cbnZhciBvYmplY3RfaGFzT3duUHJvcGVydHkgPSB1bmN1cnJ5VGhpcyhPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5KTtcblxudmFyIG9iamVjdF9rZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24gKG9iamVjdCkge1xuICAgIHZhciBrZXlzID0gW107XG4gICAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgICAgICBpZiAob2JqZWN0X2hhc093blByb3BlcnR5KG9iamVjdCwga2V5KSkge1xuICAgICAgICAgICAga2V5cy5wdXNoKGtleSk7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGtleXM7XG59O1xuXG52YXIgb2JqZWN0X3RvU3RyaW5nID0gdW5jdXJyeVRoaXMoT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZyk7XG5cbmZ1bmN0aW9uIGlzT2JqZWN0KHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlID09PSBPYmplY3QodmFsdWUpO1xufVxuXG4vLyBnZW5lcmF0b3IgcmVsYXRlZCBzaGltc1xuXG4vLyBGSVhNRTogUmVtb3ZlIHRoaXMgZnVuY3Rpb24gb25jZSBFUzYgZ2VuZXJhdG9ycyBhcmUgaW4gU3BpZGVyTW9ua2V5LlxuZnVuY3Rpb24gaXNTdG9wSXRlcmF0aW9uKGV4Y2VwdGlvbikge1xuICAgIHJldHVybiAoXG4gICAgICAgIG9iamVjdF90b1N0cmluZyhleGNlcHRpb24pID09PSBcIltvYmplY3QgU3RvcEl0ZXJhdGlvbl1cIiB8fFxuICAgICAgICBleGNlcHRpb24gaW5zdGFuY2VvZiBRUmV0dXJuVmFsdWVcbiAgICApO1xufVxuXG4vLyBGSVhNRTogUmVtb3ZlIHRoaXMgaGVscGVyIGFuZCBRLnJldHVybiBvbmNlIEVTNiBnZW5lcmF0b3JzIGFyZSBpblxuLy8gU3BpZGVyTW9ua2V5LlxudmFyIFFSZXR1cm5WYWx1ZTtcbmlmICh0eXBlb2YgUmV0dXJuVmFsdWUgIT09IFwidW5kZWZpbmVkXCIpIHtcbiAgICBRUmV0dXJuVmFsdWUgPSBSZXR1cm5WYWx1ZTtcbn0gZWxzZSB7XG4gICAgUVJldHVyblZhbHVlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgICB9O1xufVxuXG4vLyBsb25nIHN0YWNrIHRyYWNlc1xuXG52YXIgU1RBQ0tfSlVNUF9TRVBBUkFUT1IgPSBcIkZyb20gcHJldmlvdXMgZXZlbnQ6XCI7XG5cbmZ1bmN0aW9uIG1ha2VTdGFja1RyYWNlTG9uZyhlcnJvciwgcHJvbWlzZSkge1xuICAgIC8vIElmIHBvc3NpYmxlLCB0cmFuc2Zvcm0gdGhlIGVycm9yIHN0YWNrIHRyYWNlIGJ5IHJlbW92aW5nIE5vZGUgYW5kIFFcbiAgICAvLyBjcnVmdCwgdGhlbiBjb25jYXRlbmF0aW5nIHdpdGggdGhlIHN0YWNrIHRyYWNlIG9mIGBwcm9taXNlYC4gU2VlICM1Ny5cbiAgICBpZiAoaGFzU3RhY2tzICYmXG4gICAgICAgIHByb21pc2Uuc3RhY2sgJiZcbiAgICAgICAgdHlwZW9mIGVycm9yID09PSBcIm9iamVjdFwiICYmXG4gICAgICAgIGVycm9yICE9PSBudWxsICYmXG4gICAgICAgIGVycm9yLnN0YWNrICYmXG4gICAgICAgIGVycm9yLnN0YWNrLmluZGV4T2YoU1RBQ0tfSlVNUF9TRVBBUkFUT1IpID09PSAtMVxuICAgICkge1xuICAgICAgICB2YXIgc3RhY2tzID0gW107XG4gICAgICAgIGZvciAodmFyIHAgPSBwcm9taXNlOyAhIXA7IHAgPSBwLnNvdXJjZSkge1xuICAgICAgICAgICAgaWYgKHAuc3RhY2spIHtcbiAgICAgICAgICAgICAgICBzdGFja3MudW5zaGlmdChwLnN0YWNrKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICBzdGFja3MudW5zaGlmdChlcnJvci5zdGFjayk7XG5cbiAgICAgICAgdmFyIGNvbmNhdGVkU3RhY2tzID0gc3RhY2tzLmpvaW4oXCJcXG5cIiArIFNUQUNLX0pVTVBfU0VQQVJBVE9SICsgXCJcXG5cIik7XG4gICAgICAgIGVycm9yLnN0YWNrID0gZmlsdGVyU3RhY2tTdHJpbmcoY29uY2F0ZWRTdGFja3MpO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gZmlsdGVyU3RhY2tTdHJpbmcoc3RhY2tTdHJpbmcpIHtcbiAgICB2YXIgbGluZXMgPSBzdGFja1N0cmluZy5zcGxpdChcIlxcblwiKTtcbiAgICB2YXIgZGVzaXJlZExpbmVzID0gW107XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsaW5lcy5sZW5ndGg7ICsraSkge1xuICAgICAgICB2YXIgbGluZSA9IGxpbmVzW2ldO1xuXG4gICAgICAgIGlmICghaXNJbnRlcm5hbEZyYW1lKGxpbmUpICYmICFpc05vZGVGcmFtZShsaW5lKSAmJiBsaW5lKSB7XG4gICAgICAgICAgICBkZXNpcmVkTGluZXMucHVzaChsaW5lKTtcbiAgICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZGVzaXJlZExpbmVzLmpvaW4oXCJcXG5cIik7XG59XG5cbmZ1bmN0aW9uIGlzTm9kZUZyYW1lKHN0YWNrTGluZSkge1xuICAgIHJldHVybiBzdGFja0xpbmUuaW5kZXhPZihcIihtb2R1bGUuanM6XCIpICE9PSAtMSB8fFxuICAgICAgICAgICBzdGFja0xpbmUuaW5kZXhPZihcIihub2RlLmpzOlwiKSAhPT0gLTE7XG59XG5cbmZ1bmN0aW9uIGdldEZpbGVOYW1lQW5kTGluZU51bWJlcihzdGFja0xpbmUpIHtcbiAgICAvLyBOYW1lZCBmdW5jdGlvbnM6IFwiYXQgZnVuY3Rpb25OYW1lIChmaWxlbmFtZTpsaW5lTnVtYmVyOmNvbHVtbk51bWJlcilcIlxuICAgIC8vIEluIElFMTAgZnVuY3Rpb24gbmFtZSBjYW4gaGF2ZSBzcGFjZXMgKFwiQW5vbnltb3VzIGZ1bmN0aW9uXCIpIE9fb1xuICAgIHZhciBhdHRlbXB0MSA9IC9hdCAuKyBcXCgoLispOihcXGQrKTooPzpcXGQrKVxcKSQvLmV4ZWMoc3RhY2tMaW5lKTtcbiAgICBpZiAoYXR0ZW1wdDEpIHtcbiAgICAgICAgcmV0dXJuIFthdHRlbXB0MVsxXSwgTnVtYmVyKGF0dGVtcHQxWzJdKV07XG4gICAgfVxuXG4gICAgLy8gQW5vbnltb3VzIGZ1bmN0aW9uczogXCJhdCBmaWxlbmFtZTpsaW5lTnVtYmVyOmNvbHVtbk51bWJlclwiXG4gICAgdmFyIGF0dGVtcHQyID0gL2F0IChbXiBdKyk6KFxcZCspOig/OlxcZCspJC8uZXhlYyhzdGFja0xpbmUpO1xuICAgIGlmIChhdHRlbXB0Mikge1xuICAgICAgICByZXR1cm4gW2F0dGVtcHQyWzFdLCBOdW1iZXIoYXR0ZW1wdDJbMl0pXTtcbiAgICB9XG5cbiAgICAvLyBGaXJlZm94IHN0eWxlOiBcImZ1bmN0aW9uQGZpbGVuYW1lOmxpbmVOdW1iZXIgb3IgQGZpbGVuYW1lOmxpbmVOdW1iZXJcIlxuICAgIHZhciBhdHRlbXB0MyA9IC8uKkAoLispOihcXGQrKSQvLmV4ZWMoc3RhY2tMaW5lKTtcbiAgICBpZiAoYXR0ZW1wdDMpIHtcbiAgICAgICAgcmV0dXJuIFthdHRlbXB0M1sxXSwgTnVtYmVyKGF0dGVtcHQzWzJdKV07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBpc0ludGVybmFsRnJhbWUoc3RhY2tMaW5lKSB7XG4gICAgdmFyIGZpbGVOYW1lQW5kTGluZU51bWJlciA9IGdldEZpbGVOYW1lQW5kTGluZU51bWJlcihzdGFja0xpbmUpO1xuXG4gICAgaWYgKCFmaWxlTmFtZUFuZExpbmVOdW1iZXIpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHZhciBmaWxlTmFtZSA9IGZpbGVOYW1lQW5kTGluZU51bWJlclswXTtcbiAgICB2YXIgbGluZU51bWJlciA9IGZpbGVOYW1lQW5kTGluZU51bWJlclsxXTtcblxuICAgIHJldHVybiBmaWxlTmFtZSA9PT0gcUZpbGVOYW1lICYmXG4gICAgICAgIGxpbmVOdW1iZXIgPj0gcVN0YXJ0aW5nTGluZSAmJlxuICAgICAgICBsaW5lTnVtYmVyIDw9IHFFbmRpbmdMaW5lO1xufVxuXG4vLyBkaXNjb3ZlciBvd24gZmlsZSBuYW1lIGFuZCBsaW5lIG51bWJlciByYW5nZSBmb3IgZmlsdGVyaW5nIHN0YWNrXG4vLyB0cmFjZXNcbmZ1bmN0aW9uIGNhcHR1cmVMaW5lKCkge1xuICAgIGlmICghaGFzU3RhY2tzKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB0cnkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoKTtcbiAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIHZhciBsaW5lcyA9IGUuc3RhY2suc3BsaXQoXCJcXG5cIik7XG4gICAgICAgIHZhciBmaXJzdExpbmUgPSBsaW5lc1swXS5pbmRleE9mKFwiQFwiKSA+IDAgPyBsaW5lc1sxXSA6IGxpbmVzWzJdO1xuICAgICAgICB2YXIgZmlsZU5hbWVBbmRMaW5lTnVtYmVyID0gZ2V0RmlsZU5hbWVBbmRMaW5lTnVtYmVyKGZpcnN0TGluZSk7XG4gICAgICAgIGlmICghZmlsZU5hbWVBbmRMaW5lTnVtYmVyKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBxRmlsZU5hbWUgPSBmaWxlTmFtZUFuZExpbmVOdW1iZXJbMF07XG4gICAgICAgIHJldHVybiBmaWxlTmFtZUFuZExpbmVOdW1iZXJbMV07XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkZXByZWNhdGUoY2FsbGJhY2ssIG5hbWUsIGFsdGVybmF0aXZlKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBjb25zb2xlICE9PSBcInVuZGVmaW5lZFwiICYmXG4gICAgICAgICAgICB0eXBlb2YgY29uc29sZS53YXJuID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihuYW1lICsgXCIgaXMgZGVwcmVjYXRlZCwgdXNlIFwiICsgYWx0ZXJuYXRpdmUgK1xuICAgICAgICAgICAgICAgICAgICAgICAgIFwiIGluc3RlYWQuXCIsIG5ldyBFcnJvcihcIlwiKS5zdGFjayk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrLmFwcGx5KGNhbGxiYWNrLCBhcmd1bWVudHMpO1xuICAgIH07XG59XG5cbi8vIGVuZCBvZiBzaGltc1xuLy8gYmVnaW5uaW5nIG9mIHJlYWwgd29ya1xuXG4vKipcbiAqIENvbnN0cnVjdHMgYSBwcm9taXNlIGZvciBhbiBpbW1lZGlhdGUgcmVmZXJlbmNlLCBwYXNzZXMgcHJvbWlzZXMgdGhyb3VnaCwgb3JcbiAqIGNvZXJjZXMgcHJvbWlzZXMgZnJvbSBkaWZmZXJlbnQgc3lzdGVtcy5cbiAqIEBwYXJhbSB2YWx1ZSBpbW1lZGlhdGUgcmVmZXJlbmNlIG9yIHByb21pc2VcbiAqL1xuZnVuY3Rpb24gUSh2YWx1ZSkge1xuICAgIC8vIElmIHRoZSBvYmplY3QgaXMgYWxyZWFkeSBhIFByb21pc2UsIHJldHVybiBpdCBkaXJlY3RseS4gIFRoaXMgZW5hYmxlc1xuICAgIC8vIHRoZSByZXNvbHZlIGZ1bmN0aW9uIHRvIGJvdGggYmUgdXNlZCB0byBjcmVhdGVkIHJlZmVyZW5jZXMgZnJvbSBvYmplY3RzLFxuICAgIC8vIGJ1dCB0byB0b2xlcmFibHkgY29lcmNlIG5vbi1wcm9taXNlcyB0byBwcm9taXNlcy5cbiAgICBpZiAodmFsdWUgaW5zdGFuY2VvZiBQcm9taXNlKSB7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICAvLyBhc3NpbWlsYXRlIHRoZW5hYmxlc1xuICAgIGlmIChpc1Byb21pc2VBbGlrZSh2YWx1ZSkpIHtcbiAgICAgICAgcmV0dXJuIGNvZXJjZSh2YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGZ1bGZpbGwodmFsdWUpO1xuICAgIH1cbn1cblEucmVzb2x2ZSA9IFE7XG5cbi8qKlxuICogUGVyZm9ybXMgYSB0YXNrIGluIGEgZnV0dXJlIHR1cm4gb2YgdGhlIGV2ZW50IGxvb3AuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSB0YXNrXG4gKi9cblEubmV4dFRpY2sgPSBuZXh0VGljaztcblxuLyoqXG4gKiBDb250cm9scyB3aGV0aGVyIG9yIG5vdCBsb25nIHN0YWNrIHRyYWNlcyB3aWxsIGJlIG9uXG4gKi9cblEubG9uZ1N0YWNrU3VwcG9ydCA9IGZhbHNlO1xuXG4vLyBlbmFibGUgbG9uZyBzdGFja3MgaWYgUV9ERUJVRyBpcyBzZXRcbmlmICh0eXBlb2YgcHJvY2VzcyA9PT0gXCJvYmplY3RcIiAmJiBwcm9jZXNzICYmIHByb2Nlc3MuZW52ICYmIHByb2Nlc3MuZW52LlFfREVCVUcpIHtcbiAgICBRLmxvbmdTdGFja1N1cHBvcnQgPSB0cnVlO1xufVxuXG4vKipcbiAqIENvbnN0cnVjdHMgYSB7cHJvbWlzZSwgcmVzb2x2ZSwgcmVqZWN0fSBvYmplY3QuXG4gKlxuICogYHJlc29sdmVgIGlzIGEgY2FsbGJhY2sgdG8gaW52b2tlIHdpdGggYSBtb3JlIHJlc29sdmVkIHZhbHVlIGZvciB0aGVcbiAqIHByb21pc2UuIFRvIGZ1bGZpbGwgdGhlIHByb21pc2UsIGludm9rZSBgcmVzb2x2ZWAgd2l0aCBhbnkgdmFsdWUgdGhhdCBpc1xuICogbm90IGEgdGhlbmFibGUuIFRvIHJlamVjdCB0aGUgcHJvbWlzZSwgaW52b2tlIGByZXNvbHZlYCB3aXRoIGEgcmVqZWN0ZWRcbiAqIHRoZW5hYmxlLCBvciBpbnZva2UgYHJlamVjdGAgd2l0aCB0aGUgcmVhc29uIGRpcmVjdGx5LiBUbyByZXNvbHZlIHRoZVxuICogcHJvbWlzZSB0byBhbm90aGVyIHRoZW5hYmxlLCB0aHVzIHB1dHRpbmcgaXQgaW4gdGhlIHNhbWUgc3RhdGUsIGludm9rZVxuICogYHJlc29sdmVgIHdpdGggdGhhdCBvdGhlciB0aGVuYWJsZS5cbiAqL1xuUS5kZWZlciA9IGRlZmVyO1xuZnVuY3Rpb24gZGVmZXIoKSB7XG4gICAgLy8gaWYgXCJtZXNzYWdlc1wiIGlzIGFuIFwiQXJyYXlcIiwgdGhhdCBpbmRpY2F0ZXMgdGhhdCB0aGUgcHJvbWlzZSBoYXMgbm90IHlldFxuICAgIC8vIGJlZW4gcmVzb2x2ZWQuICBJZiBpdCBpcyBcInVuZGVmaW5lZFwiLCBpdCBoYXMgYmVlbiByZXNvbHZlZC4gIEVhY2hcbiAgICAvLyBlbGVtZW50IG9mIHRoZSBtZXNzYWdlcyBhcnJheSBpcyBpdHNlbGYgYW4gYXJyYXkgb2YgY29tcGxldGUgYXJndW1lbnRzIHRvXG4gICAgLy8gZm9yd2FyZCB0byB0aGUgcmVzb2x2ZWQgcHJvbWlzZS4gIFdlIGNvZXJjZSB0aGUgcmVzb2x1dGlvbiB2YWx1ZSB0byBhXG4gICAgLy8gcHJvbWlzZSB1c2luZyB0aGUgYHJlc29sdmVgIGZ1bmN0aW9uIGJlY2F1c2UgaXQgaGFuZGxlcyBib3RoIGZ1bGx5XG4gICAgLy8gbm9uLXRoZW5hYmxlIHZhbHVlcyBhbmQgb3RoZXIgdGhlbmFibGVzIGdyYWNlZnVsbHkuXG4gICAgdmFyIG1lc3NhZ2VzID0gW10sIHByb2dyZXNzTGlzdGVuZXJzID0gW10sIHJlc29sdmVkUHJvbWlzZTtcblxuICAgIHZhciBkZWZlcnJlZCA9IG9iamVjdF9jcmVhdGUoZGVmZXIucHJvdG90eXBlKTtcbiAgICB2YXIgcHJvbWlzZSA9IG9iamVjdF9jcmVhdGUoUHJvbWlzZS5wcm90b3R5cGUpO1xuXG4gICAgcHJvbWlzZS5wcm9taXNlRGlzcGF0Y2ggPSBmdW5jdGlvbiAocmVzb2x2ZSwgb3AsIG9wZXJhbmRzKSB7XG4gICAgICAgIHZhciBhcmdzID0gYXJyYXlfc2xpY2UoYXJndW1lbnRzKTtcbiAgICAgICAgaWYgKG1lc3NhZ2VzKSB7XG4gICAgICAgICAgICBtZXNzYWdlcy5wdXNoKGFyZ3MpO1xuICAgICAgICAgICAgaWYgKG9wID09PSBcIndoZW5cIiAmJiBvcGVyYW5kc1sxXSkgeyAvLyBwcm9ncmVzcyBvcGVyYW5kXG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3NMaXN0ZW5lcnMucHVzaChvcGVyYW5kc1sxXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBRLm5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlZFByb21pc2UucHJvbWlzZURpc3BhdGNoLmFwcGx5KHJlc29sdmVkUHJvbWlzZSwgYXJncyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBYWFggZGVwcmVjYXRlZFxuICAgIHByb21pc2UudmFsdWVPZiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKG1lc3NhZ2VzKSB7XG4gICAgICAgICAgICByZXR1cm4gcHJvbWlzZTtcbiAgICAgICAgfVxuICAgICAgICB2YXIgbmVhcmVyVmFsdWUgPSBuZWFyZXIocmVzb2x2ZWRQcm9taXNlKTtcbiAgICAgICAgaWYgKGlzUHJvbWlzZShuZWFyZXJWYWx1ZSkpIHtcbiAgICAgICAgICAgIHJlc29sdmVkUHJvbWlzZSA9IG5lYXJlclZhbHVlOyAvLyBzaG9ydGVuIGNoYWluXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIG5lYXJlclZhbHVlO1xuICAgIH07XG5cbiAgICBwcm9taXNlLmluc3BlY3QgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGlmICghcmVzb2x2ZWRQcm9taXNlKSB7XG4gICAgICAgICAgICByZXR1cm4geyBzdGF0ZTogXCJwZW5kaW5nXCIgfTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gcmVzb2x2ZWRQcm9taXNlLmluc3BlY3QoKTtcbiAgICB9O1xuXG4gICAgaWYgKFEubG9uZ1N0YWNrU3VwcG9ydCAmJiBoYXNTdGFja3MpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcigpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICAvLyBOT1RFOiBkb24ndCB0cnkgdG8gdXNlIGBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZWAgb3IgdHJhbnNmZXIgdGhlXG4gICAgICAgICAgICAvLyBhY2Nlc3NvciBhcm91bmQ7IHRoYXQgY2F1c2VzIG1lbW9yeSBsZWFrcyBhcyBwZXIgR0gtMTExLiBKdXN0XG4gICAgICAgICAgICAvLyByZWlmeSB0aGUgc3RhY2sgdHJhY2UgYXMgYSBzdHJpbmcgQVNBUC5cbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyBBdCB0aGUgc2FtZSB0aW1lLCBjdXQgb2ZmIHRoZSBmaXJzdCBsaW5lOyBpdCdzIGFsd2F5cyBqdXN0XG4gICAgICAgICAgICAvLyBcIltvYmplY3QgUHJvbWlzZV1cXG5cIiwgYXMgcGVyIHRoZSBgdG9TdHJpbmdgLlxuICAgICAgICAgICAgcHJvbWlzZS5zdGFjayA9IGUuc3RhY2suc3Vic3RyaW5nKGUuc3RhY2suaW5kZXhPZihcIlxcblwiKSArIDEpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLy8gTk9URTogd2UgZG8gdGhlIGNoZWNrcyBmb3IgYHJlc29sdmVkUHJvbWlzZWAgaW4gZWFjaCBtZXRob2QsIGluc3RlYWQgb2ZcbiAgICAvLyBjb25zb2xpZGF0aW5nIHRoZW0gaW50byBgYmVjb21lYCwgc2luY2Ugb3RoZXJ3aXNlIHdlJ2QgY3JlYXRlIG5ld1xuICAgIC8vIHByb21pc2VzIHdpdGggdGhlIGxpbmVzIGBiZWNvbWUod2hhdGV2ZXIodmFsdWUpKWAuIFNlZSBlLmcuIEdILTI1Mi5cblxuICAgIGZ1bmN0aW9uIGJlY29tZShuZXdQcm9taXNlKSB7XG4gICAgICAgIHJlc29sdmVkUHJvbWlzZSA9IG5ld1Byb21pc2U7XG4gICAgICAgIHByb21pc2Uuc291cmNlID0gbmV3UHJvbWlzZTtcblxuICAgICAgICBhcnJheV9yZWR1Y2UobWVzc2FnZXMsIGZ1bmN0aW9uICh1bmRlZmluZWQsIG1lc3NhZ2UpIHtcbiAgICAgICAgICAgIFEubmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIG5ld1Byb21pc2UucHJvbWlzZURpc3BhdGNoLmFwcGx5KG5ld1Byb21pc2UsIG1lc3NhZ2UpO1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0sIHZvaWQgMCk7XG5cbiAgICAgICAgbWVzc2FnZXMgPSB2b2lkIDA7XG4gICAgICAgIHByb2dyZXNzTGlzdGVuZXJzID0gdm9pZCAwO1xuICAgIH1cblxuICAgIGRlZmVycmVkLnByb21pc2UgPSBwcm9taXNlO1xuICAgIGRlZmVycmVkLnJlc29sdmUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgaWYgKHJlc29sdmVkUHJvbWlzZSkge1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgYmVjb21lKFEodmFsdWUpKTtcbiAgICB9O1xuXG4gICAgZGVmZXJyZWQuZnVsZmlsbCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICBpZiAocmVzb2x2ZWRQcm9taXNlKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBiZWNvbWUoZnVsZmlsbCh2YWx1ZSkpO1xuICAgIH07XG4gICAgZGVmZXJyZWQucmVqZWN0ID0gZnVuY3Rpb24gKHJlYXNvbikge1xuICAgICAgICBpZiAocmVzb2x2ZWRQcm9taXNlKSB7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBiZWNvbWUocmVqZWN0KHJlYXNvbikpO1xuICAgIH07XG4gICAgZGVmZXJyZWQubm90aWZ5ID0gZnVuY3Rpb24gKHByb2dyZXNzKSB7XG4gICAgICAgIGlmIChyZXNvbHZlZFByb21pc2UpIHtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGFycmF5X3JlZHVjZShwcm9ncmVzc0xpc3RlbmVycywgZnVuY3Rpb24gKHVuZGVmaW5lZCwgcHJvZ3Jlc3NMaXN0ZW5lcikge1xuICAgICAgICAgICAgUS5uZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICAgICAgcHJvZ3Jlc3NMaXN0ZW5lcihwcm9ncmVzcyk7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSwgdm9pZCAwKTtcbiAgICB9O1xuXG4gICAgcmV0dXJuIGRlZmVycmVkO1xufVxuXG4vKipcbiAqIENyZWF0ZXMgYSBOb2RlLXN0eWxlIGNhbGxiYWNrIHRoYXQgd2lsbCByZXNvbHZlIG9yIHJlamVjdCB0aGUgZGVmZXJyZWRcbiAqIHByb21pc2UuXG4gKiBAcmV0dXJucyBhIG5vZGViYWNrXG4gKi9cbmRlZmVyLnByb3RvdHlwZS5tYWtlTm9kZVJlc29sdmVyID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICByZXR1cm4gZnVuY3Rpb24gKGVycm9yLCB2YWx1ZSkge1xuICAgICAgICBpZiAoZXJyb3IpIHtcbiAgICAgICAgICAgIHNlbGYucmVqZWN0KGVycm9yKTtcbiAgICAgICAgfSBlbHNlIGlmIChhcmd1bWVudHMubGVuZ3RoID4gMikge1xuICAgICAgICAgICAgc2VsZi5yZXNvbHZlKGFycmF5X3NsaWNlKGFyZ3VtZW50cywgMSkpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc2VsZi5yZXNvbHZlKHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH07XG59O1xuXG4vKipcbiAqIEBwYXJhbSByZXNvbHZlciB7RnVuY3Rpb259IGEgZnVuY3Rpb24gdGhhdCByZXR1cm5zIG5vdGhpbmcgYW5kIGFjY2VwdHNcbiAqIHRoZSByZXNvbHZlLCByZWplY3QsIGFuZCBub3RpZnkgZnVuY3Rpb25zIGZvciBhIGRlZmVycmVkLlxuICogQHJldHVybnMgYSBwcm9taXNlIHRoYXQgbWF5IGJlIHJlc29sdmVkIHdpdGggdGhlIGdpdmVuIHJlc29sdmUgYW5kIHJlamVjdFxuICogZnVuY3Rpb25zLCBvciByZWplY3RlZCBieSBhIHRocm93biBleGNlcHRpb24gaW4gcmVzb2x2ZXJcbiAqL1xuUS5Qcm9taXNlID0gcHJvbWlzZTsgLy8gRVM2XG5RLnByb21pc2UgPSBwcm9taXNlO1xuZnVuY3Rpb24gcHJvbWlzZShyZXNvbHZlcikge1xuICAgIGlmICh0eXBlb2YgcmVzb2x2ZXIgIT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICB0aHJvdyBuZXcgVHlwZUVycm9yKFwicmVzb2x2ZXIgbXVzdCBiZSBhIGZ1bmN0aW9uLlwiKTtcbiAgICB9XG4gICAgdmFyIGRlZmVycmVkID0gZGVmZXIoKTtcbiAgICB0cnkge1xuICAgICAgICByZXNvbHZlcihkZWZlcnJlZC5yZXNvbHZlLCBkZWZlcnJlZC5yZWplY3QsIGRlZmVycmVkLm5vdGlmeSk7XG4gICAgfSBjYXRjaCAocmVhc29uKSB7XG4gICAgICAgIGRlZmVycmVkLnJlamVjdChyZWFzb24pO1xuICAgIH1cbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn1cblxucHJvbWlzZS5yYWNlID0gcmFjZTsgLy8gRVM2XG5wcm9taXNlLmFsbCA9IGFsbDsgLy8gRVM2XG5wcm9taXNlLnJlamVjdCA9IHJlamVjdDsgLy8gRVM2XG5wcm9taXNlLnJlc29sdmUgPSBROyAvLyBFUzZcblxuLy8gWFhYIGV4cGVyaW1lbnRhbC4gIFRoaXMgbWV0aG9kIGlzIGEgd2F5IHRvIGRlbm90ZSB0aGF0IGEgbG9jYWwgdmFsdWUgaXNcbi8vIHNlcmlhbGl6YWJsZSBhbmQgc2hvdWxkIGJlIGltbWVkaWF0ZWx5IGRpc3BhdGNoZWQgdG8gYSByZW1vdGUgdXBvbiByZXF1ZXN0LFxuLy8gaW5zdGVhZCBvZiBwYXNzaW5nIGEgcmVmZXJlbmNlLlxuUS5wYXNzQnlDb3B5ID0gZnVuY3Rpb24gKG9iamVjdCkge1xuICAgIC8vZnJlZXplKG9iamVjdCk7XG4gICAgLy9wYXNzQnlDb3BpZXMuc2V0KG9iamVjdCwgdHJ1ZSk7XG4gICAgcmV0dXJuIG9iamVjdDtcbn07XG5cblByb21pc2UucHJvdG90eXBlLnBhc3NCeUNvcHkgPSBmdW5jdGlvbiAoKSB7XG4gICAgLy9mcmVlemUob2JqZWN0KTtcbiAgICAvL3Bhc3NCeUNvcGllcy5zZXQob2JqZWN0LCB0cnVlKTtcbiAgICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogSWYgdHdvIHByb21pc2VzIGV2ZW50dWFsbHkgZnVsZmlsbCB0byB0aGUgc2FtZSB2YWx1ZSwgcHJvbWlzZXMgdGhhdCB2YWx1ZSxcbiAqIGJ1dCBvdGhlcndpc2UgcmVqZWN0cy5cbiAqIEBwYXJhbSB4IHtBbnkqfVxuICogQHBhcmFtIHkge0FueSp9XG4gKiBAcmV0dXJucyB7QW55Kn0gYSBwcm9taXNlIGZvciB4IGFuZCB5IGlmIHRoZXkgYXJlIHRoZSBzYW1lLCBidXQgYSByZWplY3Rpb25cbiAqIG90aGVyd2lzZS5cbiAqXG4gKi9cblEuam9pbiA9IGZ1bmN0aW9uICh4LCB5KSB7XG4gICAgcmV0dXJuIFEoeCkuam9pbih5KTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLmpvaW4gPSBmdW5jdGlvbiAodGhhdCkge1xuICAgIHJldHVybiBRKFt0aGlzLCB0aGF0XSkuc3ByZWFkKGZ1bmN0aW9uICh4LCB5KSB7XG4gICAgICAgIGlmICh4ID09PSB5KSB7XG4gICAgICAgICAgICAvLyBUT0RPOiBcIj09PVwiIHNob3VsZCBiZSBPYmplY3QuaXMgb3IgZXF1aXZcbiAgICAgICAgICAgIHJldHVybiB4O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiQ2FuJ3Qgam9pbjogbm90IHRoZSBzYW1lOiBcIiArIHggKyBcIiBcIiArIHkpO1xuICAgICAgICB9XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIFJldHVybnMgYSBwcm9taXNlIGZvciB0aGUgZmlyc3Qgb2YgYW4gYXJyYXkgb2YgcHJvbWlzZXMgdG8gYmVjb21lIHNldHRsZWQuXG4gKiBAcGFyYW0gYW5zd2VycyB7QXJyYXlbQW55Kl19IHByb21pc2VzIHRvIHJhY2VcbiAqIEByZXR1cm5zIHtBbnkqfSB0aGUgZmlyc3QgcHJvbWlzZSB0byBiZSBzZXR0bGVkXG4gKi9cblEucmFjZSA9IHJhY2U7XG5mdW5jdGlvbiByYWNlKGFuc3dlclBzKSB7XG4gICAgcmV0dXJuIHByb21pc2UoZnVuY3Rpb24gKHJlc29sdmUsIHJlamVjdCkge1xuICAgICAgICAvLyBTd2l0Y2ggdG8gdGhpcyBvbmNlIHdlIGNhbiBhc3N1bWUgYXQgbGVhc3QgRVM1XG4gICAgICAgIC8vIGFuc3dlclBzLmZvckVhY2goZnVuY3Rpb24gKGFuc3dlclApIHtcbiAgICAgICAgLy8gICAgIFEoYW5zd2VyUCkudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgICAgICAvLyB9KTtcbiAgICAgICAgLy8gVXNlIHRoaXMgaW4gdGhlIG1lYW50aW1lXG4gICAgICAgIGZvciAodmFyIGkgPSAwLCBsZW4gPSBhbnN3ZXJQcy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuICAgICAgICAgICAgUShhbnN3ZXJQc1tpXSkudGhlbihyZXNvbHZlLCByZWplY3QpO1xuICAgICAgICB9XG4gICAgfSk7XG59XG5cblByb21pc2UucHJvdG90eXBlLnJhY2UgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMudGhlbihRLnJhY2UpO1xufTtcblxuLyoqXG4gKiBDb25zdHJ1Y3RzIGEgUHJvbWlzZSB3aXRoIGEgcHJvbWlzZSBkZXNjcmlwdG9yIG9iamVjdCBhbmQgb3B0aW9uYWwgZmFsbGJhY2tcbiAqIGZ1bmN0aW9uLiAgVGhlIGRlc2NyaXB0b3IgY29udGFpbnMgbWV0aG9kcyBsaWtlIHdoZW4ocmVqZWN0ZWQpLCBnZXQobmFtZSksXG4gKiBzZXQobmFtZSwgdmFsdWUpLCBwb3N0KG5hbWUsIGFyZ3MpLCBhbmQgZGVsZXRlKG5hbWUpLCB3aGljaCBhbGxcbiAqIHJldHVybiBlaXRoZXIgYSB2YWx1ZSwgYSBwcm9taXNlIGZvciBhIHZhbHVlLCBvciBhIHJlamVjdGlvbi4gIFRoZSBmYWxsYmFja1xuICogYWNjZXB0cyB0aGUgb3BlcmF0aW9uIG5hbWUsIGEgcmVzb2x2ZXIsIGFuZCBhbnkgZnVydGhlciBhcmd1bWVudHMgdGhhdCB3b3VsZFxuICogaGF2ZSBiZWVuIGZvcndhcmRlZCB0byB0aGUgYXBwcm9wcmlhdGUgbWV0aG9kIGFib3ZlIGhhZCBhIG1ldGhvZCBiZWVuXG4gKiBwcm92aWRlZCB3aXRoIHRoZSBwcm9wZXIgbmFtZS4gIFRoZSBBUEkgbWFrZXMgbm8gZ3VhcmFudGVlcyBhYm91dCB0aGUgbmF0dXJlXG4gKiBvZiB0aGUgcmV0dXJuZWQgb2JqZWN0LCBhcGFydCBmcm9tIHRoYXQgaXQgaXMgdXNhYmxlIHdoZXJlZXZlciBwcm9taXNlcyBhcmVcbiAqIGJvdWdodCBhbmQgc29sZC5cbiAqL1xuUS5tYWtlUHJvbWlzZSA9IFByb21pc2U7XG5mdW5jdGlvbiBQcm9taXNlKGRlc2NyaXB0b3IsIGZhbGxiYWNrLCBpbnNwZWN0KSB7XG4gICAgaWYgKGZhbGxiYWNrID09PSB2b2lkIDApIHtcbiAgICAgICAgZmFsbGJhY2sgPSBmdW5jdGlvbiAob3ApIHtcbiAgICAgICAgICAgIHJldHVybiByZWplY3QobmV3IEVycm9yKFxuICAgICAgICAgICAgICAgIFwiUHJvbWlzZSBkb2VzIG5vdCBzdXBwb3J0IG9wZXJhdGlvbjogXCIgKyBvcFxuICAgICAgICAgICAgKSk7XG4gICAgICAgIH07XG4gICAgfVxuICAgIGlmIChpbnNwZWN0ID09PSB2b2lkIDApIHtcbiAgICAgICAgaW5zcGVjdCA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHJldHVybiB7c3RhdGU6IFwidW5rbm93blwifTtcbiAgICAgICAgfTtcbiAgICB9XG5cbiAgICB2YXIgcHJvbWlzZSA9IG9iamVjdF9jcmVhdGUoUHJvbWlzZS5wcm90b3R5cGUpO1xuXG4gICAgcHJvbWlzZS5wcm9taXNlRGlzcGF0Y2ggPSBmdW5jdGlvbiAocmVzb2x2ZSwgb3AsIGFyZ3MpIHtcbiAgICAgICAgdmFyIHJlc3VsdDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGlmIChkZXNjcmlwdG9yW29wXSkge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGRlc2NyaXB0b3Jbb3BdLmFwcGx5KHByb21pc2UsIGFyZ3MpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXN1bHQgPSBmYWxsYmFjay5jYWxsKHByb21pc2UsIG9wLCBhcmdzKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSBjYXRjaCAoZXhjZXB0aW9uKSB7XG4gICAgICAgICAgICByZXN1bHQgPSByZWplY3QoZXhjZXB0aW9uKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAocmVzb2x2ZSkge1xuICAgICAgICAgICAgcmVzb2x2ZShyZXN1bHQpO1xuICAgICAgICB9XG4gICAgfTtcblxuICAgIHByb21pc2UuaW5zcGVjdCA9IGluc3BlY3Q7XG5cbiAgICAvLyBYWFggZGVwcmVjYXRlZCBgdmFsdWVPZmAgYW5kIGBleGNlcHRpb25gIHN1cHBvcnRcbiAgICBpZiAoaW5zcGVjdCkge1xuICAgICAgICB2YXIgaW5zcGVjdGVkID0gaW5zcGVjdCgpO1xuICAgICAgICBpZiAoaW5zcGVjdGVkLnN0YXRlID09PSBcInJlamVjdGVkXCIpIHtcbiAgICAgICAgICAgIHByb21pc2UuZXhjZXB0aW9uID0gaW5zcGVjdGVkLnJlYXNvbjtcbiAgICAgICAgfVxuXG4gICAgICAgIHByb21pc2UudmFsdWVPZiA9IGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHZhciBpbnNwZWN0ZWQgPSBpbnNwZWN0KCk7XG4gICAgICAgICAgICBpZiAoaW5zcGVjdGVkLnN0YXRlID09PSBcInBlbmRpbmdcIiB8fFxuICAgICAgICAgICAgICAgIGluc3BlY3RlZC5zdGF0ZSA9PT0gXCJyZWplY3RlZFwiKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHByb21pc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gaW5zcGVjdGVkLnZhbHVlO1xuICAgICAgICB9O1xuICAgIH1cblxuICAgIHJldHVybiBwcm9taXNlO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS50b1N0cmluZyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gXCJbb2JqZWN0IFByb21pc2VdXCI7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS50aGVuID0gZnVuY3Rpb24gKGZ1bGZpbGxlZCwgcmVqZWN0ZWQsIHByb2dyZXNzZWQpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGRlZmVycmVkID0gZGVmZXIoKTtcbiAgICB2YXIgZG9uZSA9IGZhbHNlOyAgIC8vIGVuc3VyZSB0aGUgdW50cnVzdGVkIHByb21pc2UgbWFrZXMgYXQgbW9zdCBhXG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBzaW5nbGUgY2FsbCB0byBvbmUgb2YgdGhlIGNhbGxiYWNrc1xuXG4gICAgZnVuY3Rpb24gX2Z1bGZpbGxlZCh2YWx1ZSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcmV0dXJuIHR5cGVvZiBmdWxmaWxsZWQgPT09IFwiZnVuY3Rpb25cIiA/IGZ1bGZpbGxlZCh2YWx1ZSkgOiB2YWx1ZTtcbiAgICAgICAgfSBjYXRjaCAoZXhjZXB0aW9uKSB7XG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KGV4Y2VwdGlvbik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfcmVqZWN0ZWQoZXhjZXB0aW9uKSB7XG4gICAgICAgIGlmICh0eXBlb2YgcmVqZWN0ZWQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgbWFrZVN0YWNrVHJhY2VMb25nKGV4Y2VwdGlvbiwgc2VsZik7XG4gICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgIHJldHVybiByZWplY3RlZChleGNlcHRpb24pO1xuICAgICAgICAgICAgfSBjYXRjaCAobmV3RXhjZXB0aW9uKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdChuZXdFeGNlcHRpb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiByZWplY3QoZXhjZXB0aW9uKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBfcHJvZ3Jlc3NlZCh2YWx1ZSkge1xuICAgICAgICByZXR1cm4gdHlwZW9mIHByb2dyZXNzZWQgPT09IFwiZnVuY3Rpb25cIiA/IHByb2dyZXNzZWQodmFsdWUpIDogdmFsdWU7XG4gICAgfVxuXG4gICAgUS5uZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYucHJvbWlzZURpc3BhdGNoKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICAgICAgaWYgKGRvbmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkb25lID0gdHJ1ZTtcblxuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShfZnVsZmlsbGVkKHZhbHVlKSk7XG4gICAgICAgIH0sIFwid2hlblwiLCBbZnVuY3Rpb24gKGV4Y2VwdGlvbikge1xuICAgICAgICAgICAgaWYgKGRvbmUpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBkb25lID0gdHJ1ZTtcblxuICAgICAgICAgICAgZGVmZXJyZWQucmVzb2x2ZShfcmVqZWN0ZWQoZXhjZXB0aW9uKSk7XG4gICAgICAgIH1dKTtcbiAgICB9KTtcblxuICAgIC8vIFByb2dyZXNzIHByb3BhZ2F0b3IgbmVlZCB0byBiZSBhdHRhY2hlZCBpbiB0aGUgY3VycmVudCB0aWNrLlxuICAgIHNlbGYucHJvbWlzZURpc3BhdGNoKHZvaWQgMCwgXCJ3aGVuXCIsIFt2b2lkIDAsIGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICB2YXIgbmV3VmFsdWU7XG4gICAgICAgIHZhciB0aHJldyA9IGZhbHNlO1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbmV3VmFsdWUgPSBfcHJvZ3Jlc3NlZCh2YWx1ZSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRocmV3ID0gdHJ1ZTtcbiAgICAgICAgICAgIGlmIChRLm9uZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBRLm9uZXJyb3IoZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IGU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIXRocmV3KSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5ub3RpZnkobmV3VmFsdWUpO1xuICAgICAgICB9XG4gICAgfV0pO1xuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG5RLnRhcCA9IGZ1bmN0aW9uIChwcm9taXNlLCBjYWxsYmFjaykge1xuICAgIHJldHVybiBRKHByb21pc2UpLnRhcChjYWxsYmFjayk7XG59O1xuXG4vKipcbiAqIFdvcmtzIGFsbW9zdCBsaWtlIFwiZmluYWxseVwiLCBidXQgbm90IGNhbGxlZCBmb3IgcmVqZWN0aW9ucy5cbiAqIE9yaWdpbmFsIHJlc29sdXRpb24gdmFsdWUgaXMgcGFzc2VkIHRocm91Z2ggY2FsbGJhY2sgdW5hZmZlY3RlZC5cbiAqIENhbGxiYWNrIG1heSByZXR1cm4gYSBwcm9taXNlIHRoYXQgd2lsbCBiZSBhd2FpdGVkIGZvci5cbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcmV0dXJucyB7US5Qcm9taXNlfVxuICogQGV4YW1wbGVcbiAqIGRvU29tZXRoaW5nKClcbiAqICAgLnRoZW4oLi4uKVxuICogICAudGFwKGNvbnNvbGUubG9nKVxuICogICAudGhlbiguLi4pO1xuICovXG5Qcm9taXNlLnByb3RvdHlwZS50YXAgPSBmdW5jdGlvbiAoY2FsbGJhY2spIHtcbiAgICBjYWxsYmFjayA9IFEoY2FsbGJhY2spO1xuXG4gICAgcmV0dXJuIHRoaXMudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrLmZjYWxsKHZhbHVlKS50aGVuUmVzb2x2ZSh2YWx1ZSk7XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIFJlZ2lzdGVycyBhbiBvYnNlcnZlciBvbiBhIHByb21pc2UuXG4gKlxuICogR3VhcmFudGVlczpcbiAqXG4gKiAxLiB0aGF0IGZ1bGZpbGxlZCBhbmQgcmVqZWN0ZWQgd2lsbCBiZSBjYWxsZWQgb25seSBvbmNlLlxuICogMi4gdGhhdCBlaXRoZXIgdGhlIGZ1bGZpbGxlZCBjYWxsYmFjayBvciB0aGUgcmVqZWN0ZWQgY2FsbGJhY2sgd2lsbCBiZVxuICogICAgY2FsbGVkLCBidXQgbm90IGJvdGguXG4gKiAzLiB0aGF0IGZ1bGZpbGxlZCBhbmQgcmVqZWN0ZWQgd2lsbCBub3QgYmUgY2FsbGVkIGluIHRoaXMgdHVybi5cbiAqXG4gKiBAcGFyYW0gdmFsdWUgICAgICBwcm9taXNlIG9yIGltbWVkaWF0ZSByZWZlcmVuY2UgdG8gb2JzZXJ2ZVxuICogQHBhcmFtIGZ1bGZpbGxlZCAgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIHdpdGggdGhlIGZ1bGZpbGxlZCB2YWx1ZVxuICogQHBhcmFtIHJlamVjdGVkICAgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIHdpdGggdGhlIHJlamVjdGlvbiBleGNlcHRpb25cbiAqIEBwYXJhbSBwcm9ncmVzc2VkIGZ1bmN0aW9uIHRvIGJlIGNhbGxlZCBvbiBhbnkgcHJvZ3Jlc3Mgbm90aWZpY2F0aW9uc1xuICogQHJldHVybiBwcm9taXNlIGZvciB0aGUgcmV0dXJuIHZhbHVlIGZyb20gdGhlIGludm9rZWQgY2FsbGJhY2tcbiAqL1xuUS53aGVuID0gd2hlbjtcbmZ1bmN0aW9uIHdoZW4odmFsdWUsIGZ1bGZpbGxlZCwgcmVqZWN0ZWQsIHByb2dyZXNzZWQpIHtcbiAgICByZXR1cm4gUSh2YWx1ZSkudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkLCBwcm9ncmVzc2VkKTtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUudGhlblJlc29sdmUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICByZXR1cm4gdGhpcy50aGVuKGZ1bmN0aW9uICgpIHsgcmV0dXJuIHZhbHVlOyB9KTtcbn07XG5cblEudGhlblJlc29sdmUgPSBmdW5jdGlvbiAocHJvbWlzZSwgdmFsdWUpIHtcbiAgICByZXR1cm4gUShwcm9taXNlKS50aGVuUmVzb2x2ZSh2YWx1ZSk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS50aGVuUmVqZWN0ID0gZnVuY3Rpb24gKHJlYXNvbikge1xuICAgIHJldHVybiB0aGlzLnRoZW4oZnVuY3Rpb24gKCkgeyB0aHJvdyByZWFzb247IH0pO1xufTtcblxuUS50aGVuUmVqZWN0ID0gZnVuY3Rpb24gKHByb21pc2UsIHJlYXNvbikge1xuICAgIHJldHVybiBRKHByb21pc2UpLnRoZW5SZWplY3QocmVhc29uKTtcbn07XG5cbi8qKlxuICogSWYgYW4gb2JqZWN0IGlzIG5vdCBhIHByb21pc2UsIGl0IGlzIGFzIFwibmVhclwiIGFzIHBvc3NpYmxlLlxuICogSWYgYSBwcm9taXNlIGlzIHJlamVjdGVkLCBpdCBpcyBhcyBcIm5lYXJcIiBhcyBwb3NzaWJsZSB0b28uXG4gKiBJZiBpdOKAmXMgYSBmdWxmaWxsZWQgcHJvbWlzZSwgdGhlIGZ1bGZpbGxtZW50IHZhbHVlIGlzIG5lYXJlci5cbiAqIElmIGl04oCZcyBhIGRlZmVycmVkIHByb21pc2UgYW5kIHRoZSBkZWZlcnJlZCBoYXMgYmVlbiByZXNvbHZlZCwgdGhlXG4gKiByZXNvbHV0aW9uIGlzIFwibmVhcmVyXCIuXG4gKiBAcGFyYW0gb2JqZWN0XG4gKiBAcmV0dXJucyBtb3N0IHJlc29sdmVkIChuZWFyZXN0KSBmb3JtIG9mIHRoZSBvYmplY3RcbiAqL1xuXG4vLyBYWFggc2hvdWxkIHdlIHJlLWRvIHRoaXM/XG5RLm5lYXJlciA9IG5lYXJlcjtcbmZ1bmN0aW9uIG5lYXJlcih2YWx1ZSkge1xuICAgIGlmIChpc1Byb21pc2UodmFsdWUpKSB7XG4gICAgICAgIHZhciBpbnNwZWN0ZWQgPSB2YWx1ZS5pbnNwZWN0KCk7XG4gICAgICAgIGlmIChpbnNwZWN0ZWQuc3RhdGUgPT09IFwiZnVsZmlsbGVkXCIpIHtcbiAgICAgICAgICAgIHJldHVybiBpbnNwZWN0ZWQudmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xufVxuXG4vKipcbiAqIEByZXR1cm5zIHdoZXRoZXIgdGhlIGdpdmVuIG9iamVjdCBpcyBhIHByb21pc2UuXG4gKiBPdGhlcndpc2UgaXQgaXMgYSBmdWxmaWxsZWQgdmFsdWUuXG4gKi9cblEuaXNQcm9taXNlID0gaXNQcm9taXNlO1xuZnVuY3Rpb24gaXNQcm9taXNlKG9iamVjdCkge1xuICAgIHJldHVybiBvYmplY3QgaW5zdGFuY2VvZiBQcm9taXNlO1xufVxuXG5RLmlzUHJvbWlzZUFsaWtlID0gaXNQcm9taXNlQWxpa2U7XG5mdW5jdGlvbiBpc1Byb21pc2VBbGlrZShvYmplY3QpIHtcbiAgICByZXR1cm4gaXNPYmplY3Qob2JqZWN0KSAmJiB0eXBlb2Ygb2JqZWN0LnRoZW4gPT09IFwiZnVuY3Rpb25cIjtcbn1cblxuLyoqXG4gKiBAcmV0dXJucyB3aGV0aGVyIHRoZSBnaXZlbiBvYmplY3QgaXMgYSBwZW5kaW5nIHByb21pc2UsIG1lYW5pbmcgbm90XG4gKiBmdWxmaWxsZWQgb3IgcmVqZWN0ZWQuXG4gKi9cblEuaXNQZW5kaW5nID0gaXNQZW5kaW5nO1xuZnVuY3Rpb24gaXNQZW5kaW5nKG9iamVjdCkge1xuICAgIHJldHVybiBpc1Byb21pc2Uob2JqZWN0KSAmJiBvYmplY3QuaW5zcGVjdCgpLnN0YXRlID09PSBcInBlbmRpbmdcIjtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUuaXNQZW5kaW5nID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmluc3BlY3QoKS5zdGF0ZSA9PT0gXCJwZW5kaW5nXCI7XG59O1xuXG4vKipcbiAqIEByZXR1cm5zIHdoZXRoZXIgdGhlIGdpdmVuIG9iamVjdCBpcyBhIHZhbHVlIG9yIGZ1bGZpbGxlZFxuICogcHJvbWlzZS5cbiAqL1xuUS5pc0Z1bGZpbGxlZCA9IGlzRnVsZmlsbGVkO1xuZnVuY3Rpb24gaXNGdWxmaWxsZWQob2JqZWN0KSB7XG4gICAgcmV0dXJuICFpc1Byb21pc2Uob2JqZWN0KSB8fCBvYmplY3QuaW5zcGVjdCgpLnN0YXRlID09PSBcImZ1bGZpbGxlZFwiO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS5pc0Z1bGZpbGxlZCA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5pbnNwZWN0KCkuc3RhdGUgPT09IFwiZnVsZmlsbGVkXCI7XG59O1xuXG4vKipcbiAqIEByZXR1cm5zIHdoZXRoZXIgdGhlIGdpdmVuIG9iamVjdCBpcyBhIHJlamVjdGVkIHByb21pc2UuXG4gKi9cblEuaXNSZWplY3RlZCA9IGlzUmVqZWN0ZWQ7XG5mdW5jdGlvbiBpc1JlamVjdGVkKG9iamVjdCkge1xuICAgIHJldHVybiBpc1Byb21pc2Uob2JqZWN0KSAmJiBvYmplY3QuaW5zcGVjdCgpLnN0YXRlID09PSBcInJlamVjdGVkXCI7XG59XG5cblByb21pc2UucHJvdG90eXBlLmlzUmVqZWN0ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuaW5zcGVjdCgpLnN0YXRlID09PSBcInJlamVjdGVkXCI7XG59O1xuXG4vLy8vIEJFR0lOIFVOSEFORExFRCBSRUpFQ1RJT04gVFJBQ0tJTkdcblxuLy8gVGhpcyBwcm9taXNlIGxpYnJhcnkgY29uc3VtZXMgZXhjZXB0aW9ucyB0aHJvd24gaW4gaGFuZGxlcnMgc28gdGhleSBjYW4gYmVcbi8vIGhhbmRsZWQgYnkgYSBzdWJzZXF1ZW50IHByb21pc2UuICBUaGUgZXhjZXB0aW9ucyBnZXQgYWRkZWQgdG8gdGhpcyBhcnJheSB3aGVuXG4vLyB0aGV5IGFyZSBjcmVhdGVkLCBhbmQgcmVtb3ZlZCB3aGVuIHRoZXkgYXJlIGhhbmRsZWQuICBOb3RlIHRoYXQgaW4gRVM2IG9yXG4vLyBzaGltbWVkIGVudmlyb25tZW50cywgdGhpcyB3b3VsZCBuYXR1cmFsbHkgYmUgYSBgU2V0YC5cbnZhciB1bmhhbmRsZWRSZWFzb25zID0gW107XG52YXIgdW5oYW5kbGVkUmVqZWN0aW9ucyA9IFtdO1xudmFyIHJlcG9ydGVkVW5oYW5kbGVkUmVqZWN0aW9ucyA9IFtdO1xudmFyIHRyYWNrVW5oYW5kbGVkUmVqZWN0aW9ucyA9IHRydWU7XG5cbmZ1bmN0aW9uIHJlc2V0VW5oYW5kbGVkUmVqZWN0aW9ucygpIHtcbiAgICB1bmhhbmRsZWRSZWFzb25zLmxlbmd0aCA9IDA7XG4gICAgdW5oYW5kbGVkUmVqZWN0aW9ucy5sZW5ndGggPSAwO1xuXG4gICAgaWYgKCF0cmFja1VuaGFuZGxlZFJlamVjdGlvbnMpIHtcbiAgICAgICAgdHJhY2tVbmhhbmRsZWRSZWplY3Rpb25zID0gdHJ1ZTtcbiAgICB9XG59XG5cbmZ1bmN0aW9uIHRyYWNrUmVqZWN0aW9uKHByb21pc2UsIHJlYXNvbikge1xuICAgIGlmICghdHJhY2tVbmhhbmRsZWRSZWplY3Rpb25zKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBwcm9jZXNzID09PSBcIm9iamVjdFwiICYmIHR5cGVvZiBwcm9jZXNzLmVtaXQgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICBRLm5leHRUaWNrLnJ1bkFmdGVyKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGlmIChhcnJheV9pbmRleE9mKHVuaGFuZGxlZFJlamVjdGlvbnMsIHByb21pc2UpICE9PSAtMSkge1xuICAgICAgICAgICAgICAgIHByb2Nlc3MuZW1pdChcInVuaGFuZGxlZFJlamVjdGlvblwiLCByZWFzb24sIHByb21pc2UpO1xuICAgICAgICAgICAgICAgIHJlcG9ydGVkVW5oYW5kbGVkUmVqZWN0aW9ucy5wdXNoKHByb21pc2UpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICB1bmhhbmRsZWRSZWplY3Rpb25zLnB1c2gocHJvbWlzZSk7XG4gICAgaWYgKHJlYXNvbiAmJiB0eXBlb2YgcmVhc29uLnN0YWNrICE9PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgIHVuaGFuZGxlZFJlYXNvbnMucHVzaChyZWFzb24uc3RhY2spO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHVuaGFuZGxlZFJlYXNvbnMucHVzaChcIihubyBzdGFjaykgXCIgKyByZWFzb24pO1xuICAgIH1cbn1cblxuZnVuY3Rpb24gdW50cmFja1JlamVjdGlvbihwcm9taXNlKSB7XG4gICAgaWYgKCF0cmFja1VuaGFuZGxlZFJlamVjdGlvbnMpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHZhciBhdCA9IGFycmF5X2luZGV4T2YodW5oYW5kbGVkUmVqZWN0aW9ucywgcHJvbWlzZSk7XG4gICAgaWYgKGF0ICE9PSAtMSkge1xuICAgICAgICBpZiAodHlwZW9mIHByb2Nlc3MgPT09IFwib2JqZWN0XCIgJiYgdHlwZW9mIHByb2Nlc3MuZW1pdCA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBRLm5leHRUaWNrLnJ1bkFmdGVyKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgICAgICB2YXIgYXRSZXBvcnQgPSBhcnJheV9pbmRleE9mKHJlcG9ydGVkVW5oYW5kbGVkUmVqZWN0aW9ucywgcHJvbWlzZSk7XG4gICAgICAgICAgICAgICAgaWYgKGF0UmVwb3J0ICE9PSAtMSkge1xuICAgICAgICAgICAgICAgICAgICBwcm9jZXNzLmVtaXQoXCJyZWplY3Rpb25IYW5kbGVkXCIsIHVuaGFuZGxlZFJlYXNvbnNbYXRdLCBwcm9taXNlKTtcbiAgICAgICAgICAgICAgICAgICAgcmVwb3J0ZWRVbmhhbmRsZWRSZWplY3Rpb25zLnNwbGljZShhdFJlcG9ydCwgMSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgICAgdW5oYW5kbGVkUmVqZWN0aW9ucy5zcGxpY2UoYXQsIDEpO1xuICAgICAgICB1bmhhbmRsZWRSZWFzb25zLnNwbGljZShhdCwgMSk7XG4gICAgfVxufVxuXG5RLnJlc2V0VW5oYW5kbGVkUmVqZWN0aW9ucyA9IHJlc2V0VW5oYW5kbGVkUmVqZWN0aW9ucztcblxuUS5nZXRVbmhhbmRsZWRSZWFzb25zID0gZnVuY3Rpb24gKCkge1xuICAgIC8vIE1ha2UgYSBjb3B5IHNvIHRoYXQgY29uc3VtZXJzIGNhbid0IGludGVyZmVyZSB3aXRoIG91ciBpbnRlcm5hbCBzdGF0ZS5cbiAgICByZXR1cm4gdW5oYW5kbGVkUmVhc29ucy5zbGljZSgpO1xufTtcblxuUS5zdG9wVW5oYW5kbGVkUmVqZWN0aW9uVHJhY2tpbmcgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmVzZXRVbmhhbmRsZWRSZWplY3Rpb25zKCk7XG4gICAgdHJhY2tVbmhhbmRsZWRSZWplY3Rpb25zID0gZmFsc2U7XG59O1xuXG5yZXNldFVuaGFuZGxlZFJlamVjdGlvbnMoKTtcblxuLy8vLyBFTkQgVU5IQU5ETEVEIFJFSkVDVElPTiBUUkFDS0lOR1xuXG4vKipcbiAqIENvbnN0cnVjdHMgYSByZWplY3RlZCBwcm9taXNlLlxuICogQHBhcmFtIHJlYXNvbiB2YWx1ZSBkZXNjcmliaW5nIHRoZSBmYWlsdXJlXG4gKi9cblEucmVqZWN0ID0gcmVqZWN0O1xuZnVuY3Rpb24gcmVqZWN0KHJlYXNvbikge1xuICAgIHZhciByZWplY3Rpb24gPSBQcm9taXNlKHtcbiAgICAgICAgXCJ3aGVuXCI6IGZ1bmN0aW9uIChyZWplY3RlZCkge1xuICAgICAgICAgICAgLy8gbm90ZSB0aGF0IHRoZSBlcnJvciBoYXMgYmVlbiBoYW5kbGVkXG4gICAgICAgICAgICBpZiAocmVqZWN0ZWQpIHtcbiAgICAgICAgICAgICAgICB1bnRyYWNrUmVqZWN0aW9uKHRoaXMpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdGVkID8gcmVqZWN0ZWQocmVhc29uKSA6IHRoaXM7XG4gICAgICAgIH1cbiAgICB9LCBmdW5jdGlvbiBmYWxsYmFjaygpIHtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSwgZnVuY3Rpb24gaW5zcGVjdCgpIHtcbiAgICAgICAgcmV0dXJuIHsgc3RhdGU6IFwicmVqZWN0ZWRcIiwgcmVhc29uOiByZWFzb24gfTtcbiAgICB9KTtcblxuICAgIC8vIE5vdGUgdGhhdCB0aGUgcmVhc29uIGhhcyBub3QgYmVlbiBoYW5kbGVkLlxuICAgIHRyYWNrUmVqZWN0aW9uKHJlamVjdGlvbiwgcmVhc29uKTtcblxuICAgIHJldHVybiByZWplY3Rpb247XG59XG5cbi8qKlxuICogQ29uc3RydWN0cyBhIGZ1bGZpbGxlZCBwcm9taXNlIGZvciBhbiBpbW1lZGlhdGUgcmVmZXJlbmNlLlxuICogQHBhcmFtIHZhbHVlIGltbWVkaWF0ZSByZWZlcmVuY2VcbiAqL1xuUS5mdWxmaWxsID0gZnVsZmlsbDtcbmZ1bmN0aW9uIGZ1bGZpbGwodmFsdWUpIHtcbiAgICByZXR1cm4gUHJvbWlzZSh7XG4gICAgICAgIFwid2hlblwiOiBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH0sXG4gICAgICAgIFwiZ2V0XCI6IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWVbbmFtZV07XG4gICAgICAgIH0sXG4gICAgICAgIFwic2V0XCI6IGZ1bmN0aW9uIChuYW1lLCByaHMpIHtcbiAgICAgICAgICAgIHZhbHVlW25hbWVdID0gcmhzO1xuICAgICAgICB9LFxuICAgICAgICBcImRlbGV0ZVwiOiBmdW5jdGlvbiAobmFtZSkge1xuICAgICAgICAgICAgZGVsZXRlIHZhbHVlW25hbWVdO1xuICAgICAgICB9LFxuICAgICAgICBcInBvc3RcIjogZnVuY3Rpb24gKG5hbWUsIGFyZ3MpIHtcbiAgICAgICAgICAgIC8vIE1hcmsgTWlsbGVyIHByb3Bvc2VzIHRoYXQgcG9zdCB3aXRoIG5vIG5hbWUgc2hvdWxkIGFwcGx5IGFcbiAgICAgICAgICAgIC8vIHByb21pc2VkIGZ1bmN0aW9uLlxuICAgICAgICAgICAgaWYgKG5hbWUgPT09IG51bGwgfHwgbmFtZSA9PT0gdm9pZCAwKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHZhbHVlLmFwcGx5KHZvaWQgMCwgYXJncyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB2YWx1ZVtuYW1lXS5hcHBseSh2YWx1ZSwgYXJncyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0sXG4gICAgICAgIFwiYXBwbHlcIjogZnVuY3Rpb24gKHRoaXNwLCBhcmdzKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWUuYXBwbHkodGhpc3AsIGFyZ3MpO1xuICAgICAgICB9LFxuICAgICAgICBcImtleXNcIjogZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIG9iamVjdF9rZXlzKHZhbHVlKTtcbiAgICAgICAgfVxuICAgIH0sIHZvaWQgMCwgZnVuY3Rpb24gaW5zcGVjdCgpIHtcbiAgICAgICAgcmV0dXJuIHsgc3RhdGU6IFwiZnVsZmlsbGVkXCIsIHZhbHVlOiB2YWx1ZSB9O1xuICAgIH0pO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIHRoZW5hYmxlcyB0byBRIHByb21pc2VzLlxuICogQHBhcmFtIHByb21pc2UgdGhlbmFibGUgcHJvbWlzZVxuICogQHJldHVybnMgYSBRIHByb21pc2VcbiAqL1xuZnVuY3Rpb24gY29lcmNlKHByb21pc2UpIHtcbiAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgIFEubmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgcHJvbWlzZS50aGVuKGRlZmVycmVkLnJlc29sdmUsIGRlZmVycmVkLnJlamVjdCwgZGVmZXJyZWQubm90aWZ5KTtcbiAgICAgICAgfSBjYXRjaCAoZXhjZXB0aW9uKSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXhjZXB0aW9uKTtcbiAgICAgICAgfVxuICAgIH0pO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufVxuXG4vKipcbiAqIEFubm90YXRlcyBhbiBvYmplY3Qgc3VjaCB0aGF0IGl0IHdpbGwgbmV2ZXIgYmVcbiAqIHRyYW5zZmVycmVkIGF3YXkgZnJvbSB0aGlzIHByb2Nlc3Mgb3ZlciBhbnkgcHJvbWlzZVxuICogY29tbXVuaWNhdGlvbiBjaGFubmVsLlxuICogQHBhcmFtIG9iamVjdFxuICogQHJldHVybnMgcHJvbWlzZSBhIHdyYXBwaW5nIG9mIHRoYXQgb2JqZWN0IHRoYXRcbiAqIGFkZGl0aW9uYWxseSByZXNwb25kcyB0byB0aGUgXCJpc0RlZlwiIG1lc3NhZ2VcbiAqIHdpdGhvdXQgYSByZWplY3Rpb24uXG4gKi9cblEubWFzdGVyID0gbWFzdGVyO1xuZnVuY3Rpb24gbWFzdGVyKG9iamVjdCkge1xuICAgIHJldHVybiBQcm9taXNlKHtcbiAgICAgICAgXCJpc0RlZlwiOiBmdW5jdGlvbiAoKSB7fVxuICAgIH0sIGZ1bmN0aW9uIGZhbGxiYWNrKG9wLCBhcmdzKSB7XG4gICAgICAgIHJldHVybiBkaXNwYXRjaChvYmplY3QsIG9wLCBhcmdzKTtcbiAgICB9LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHJldHVybiBRKG9iamVjdCkuaW5zcGVjdCgpO1xuICAgIH0pO1xufVxuXG4vKipcbiAqIFNwcmVhZHMgdGhlIHZhbHVlcyBvZiBhIHByb21pc2VkIGFycmF5IG9mIGFyZ3VtZW50cyBpbnRvIHRoZVxuICogZnVsZmlsbG1lbnQgY2FsbGJhY2suXG4gKiBAcGFyYW0gZnVsZmlsbGVkIGNhbGxiYWNrIHRoYXQgcmVjZWl2ZXMgdmFyaWFkaWMgYXJndW1lbnRzIGZyb20gdGhlXG4gKiBwcm9taXNlZCBhcnJheVxuICogQHBhcmFtIHJlamVjdGVkIGNhbGxiYWNrIHRoYXQgcmVjZWl2ZXMgdGhlIGV4Y2VwdGlvbiBpZiB0aGUgcHJvbWlzZVxuICogaXMgcmVqZWN0ZWQuXG4gKiBAcmV0dXJucyBhIHByb21pc2UgZm9yIHRoZSByZXR1cm4gdmFsdWUgb3IgdGhyb3duIGV4Y2VwdGlvbiBvZlxuICogZWl0aGVyIGNhbGxiYWNrLlxuICovXG5RLnNwcmVhZCA9IHNwcmVhZDtcbmZ1bmN0aW9uIHNwcmVhZCh2YWx1ZSwgZnVsZmlsbGVkLCByZWplY3RlZCkge1xuICAgIHJldHVybiBRKHZhbHVlKS5zcHJlYWQoZnVsZmlsbGVkLCByZWplY3RlZCk7XG59XG5cblByb21pc2UucHJvdG90eXBlLnNwcmVhZCA9IGZ1bmN0aW9uIChmdWxmaWxsZWQsIHJlamVjdGVkKSB7XG4gICAgcmV0dXJuIHRoaXMuYWxsKCkudGhlbihmdW5jdGlvbiAoYXJyYXkpIHtcbiAgICAgICAgcmV0dXJuIGZ1bGZpbGxlZC5hcHBseSh2b2lkIDAsIGFycmF5KTtcbiAgICB9LCByZWplY3RlZCk7XG59O1xuXG4vKipcbiAqIFRoZSBhc3luYyBmdW5jdGlvbiBpcyBhIGRlY29yYXRvciBmb3IgZ2VuZXJhdG9yIGZ1bmN0aW9ucywgdHVybmluZ1xuICogdGhlbSBpbnRvIGFzeW5jaHJvbm91cyBnZW5lcmF0b3JzLiAgQWx0aG91Z2ggZ2VuZXJhdG9ycyBhcmUgb25seSBwYXJ0XG4gKiBvZiB0aGUgbmV3ZXN0IEVDTUFTY3JpcHQgNiBkcmFmdHMsIHRoaXMgY29kZSBkb2VzIG5vdCBjYXVzZSBzeW50YXhcbiAqIGVycm9ycyBpbiBvbGRlciBlbmdpbmVzLiAgVGhpcyBjb2RlIHNob3VsZCBjb250aW51ZSB0byB3b3JrIGFuZCB3aWxsXG4gKiBpbiBmYWN0IGltcHJvdmUgb3ZlciB0aW1lIGFzIHRoZSBsYW5ndWFnZSBpbXByb3Zlcy5cbiAqXG4gKiBFUzYgZ2VuZXJhdG9ycyBhcmUgY3VycmVudGx5IHBhcnQgb2YgVjggdmVyc2lvbiAzLjE5IHdpdGggdGhlXG4gKiAtLWhhcm1vbnktZ2VuZXJhdG9ycyBydW50aW1lIGZsYWcgZW5hYmxlZC4gIFNwaWRlck1vbmtleSBoYXMgaGFkIHRoZW1cbiAqIGZvciBsb25nZXIsIGJ1dCB1bmRlciBhbiBvbGRlciBQeXRob24taW5zcGlyZWQgZm9ybS4gIFRoaXMgZnVuY3Rpb25cbiAqIHdvcmtzIG9uIGJvdGgga2luZHMgb2YgZ2VuZXJhdG9ycy5cbiAqXG4gKiBEZWNvcmF0ZXMgYSBnZW5lcmF0b3IgZnVuY3Rpb24gc3VjaCB0aGF0OlxuICogIC0gaXQgbWF5IHlpZWxkIHByb21pc2VzXG4gKiAgLSBleGVjdXRpb24gd2lsbCBjb250aW51ZSB3aGVuIHRoYXQgcHJvbWlzZSBpcyBmdWxmaWxsZWRcbiAqICAtIHRoZSB2YWx1ZSBvZiB0aGUgeWllbGQgZXhwcmVzc2lvbiB3aWxsIGJlIHRoZSBmdWxmaWxsZWQgdmFsdWVcbiAqICAtIGl0IHJldHVybnMgYSBwcm9taXNlIGZvciB0aGUgcmV0dXJuIHZhbHVlICh3aGVuIHRoZSBnZW5lcmF0b3JcbiAqICAgIHN0b3BzIGl0ZXJhdGluZylcbiAqICAtIHRoZSBkZWNvcmF0ZWQgZnVuY3Rpb24gcmV0dXJucyBhIHByb21pc2UgZm9yIHRoZSByZXR1cm4gdmFsdWVcbiAqICAgIG9mIHRoZSBnZW5lcmF0b3Igb3IgdGhlIGZpcnN0IHJlamVjdGVkIHByb21pc2UgYW1vbmcgdGhvc2VcbiAqICAgIHlpZWxkZWQuXG4gKiAgLSBpZiBhbiBlcnJvciBpcyB0aHJvd24gaW4gdGhlIGdlbmVyYXRvciwgaXQgcHJvcGFnYXRlcyB0aHJvdWdoXG4gKiAgICBldmVyeSBmb2xsb3dpbmcgeWllbGQgdW50aWwgaXQgaXMgY2F1Z2h0LCBvciB1bnRpbCBpdCBlc2NhcGVzXG4gKiAgICB0aGUgZ2VuZXJhdG9yIGZ1bmN0aW9uIGFsdG9nZXRoZXIsIGFuZCBpcyB0cmFuc2xhdGVkIGludG8gYVxuICogICAgcmVqZWN0aW9uIGZvciB0aGUgcHJvbWlzZSByZXR1cm5lZCBieSB0aGUgZGVjb3JhdGVkIGdlbmVyYXRvci5cbiAqL1xuUS5hc3luYyA9IGFzeW5jO1xuZnVuY3Rpb24gYXN5bmMobWFrZUdlbmVyYXRvcikge1xuICAgIHJldHVybiBmdW5jdGlvbiAoKSB7XG4gICAgICAgIC8vIHdoZW4gdmVyYiBpcyBcInNlbmRcIiwgYXJnIGlzIGEgdmFsdWVcbiAgICAgICAgLy8gd2hlbiB2ZXJiIGlzIFwidGhyb3dcIiwgYXJnIGlzIGFuIGV4Y2VwdGlvblxuICAgICAgICBmdW5jdGlvbiBjb250aW51ZXIodmVyYiwgYXJnKSB7XG4gICAgICAgICAgICB2YXIgcmVzdWx0O1xuXG4gICAgICAgICAgICAvLyBVbnRpbCBWOCAzLjE5IC8gQ2hyb21pdW0gMjkgaXMgcmVsZWFzZWQsIFNwaWRlck1vbmtleSBpcyB0aGUgb25seVxuICAgICAgICAgICAgLy8gZW5naW5lIHRoYXQgaGFzIGEgZGVwbG95ZWQgYmFzZSBvZiBicm93c2VycyB0aGF0IHN1cHBvcnQgZ2VuZXJhdG9ycy5cbiAgICAgICAgICAgIC8vIEhvd2V2ZXIsIFNNJ3MgZ2VuZXJhdG9ycyB1c2UgdGhlIFB5dGhvbi1pbnNwaXJlZCBzZW1hbnRpY3Mgb2ZcbiAgICAgICAgICAgIC8vIG91dGRhdGVkIEVTNiBkcmFmdHMuICBXZSB3b3VsZCBsaWtlIHRvIHN1cHBvcnQgRVM2LCBidXQgd2UnZCBhbHNvXG4gICAgICAgICAgICAvLyBsaWtlIHRvIG1ha2UgaXQgcG9zc2libGUgdG8gdXNlIGdlbmVyYXRvcnMgaW4gZGVwbG95ZWQgYnJvd3NlcnMsIHNvXG4gICAgICAgICAgICAvLyB3ZSBhbHNvIHN1cHBvcnQgUHl0aG9uLXN0eWxlIGdlbmVyYXRvcnMuICBBdCBzb21lIHBvaW50IHdlIGNhbiByZW1vdmVcbiAgICAgICAgICAgIC8vIHRoaXMgYmxvY2suXG5cbiAgICAgICAgICAgIGlmICh0eXBlb2YgU3RvcEl0ZXJhdGlvbiA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgICAgIC8vIEVTNiBHZW5lcmF0b3JzXG4gICAgICAgICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgICAgICAgICAgcmVzdWx0ID0gZ2VuZXJhdG9yW3ZlcmJdKGFyZyk7XG4gICAgICAgICAgICAgICAgfSBjYXRjaCAoZXhjZXB0aW9uKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiByZWplY3QoZXhjZXB0aW9uKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgaWYgKHJlc3VsdC5kb25lKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBRKHJlc3VsdC52YWx1ZSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHdoZW4ocmVzdWx0LnZhbHVlLCBjYWxsYmFjaywgZXJyYmFjayk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBTcGlkZXJNb25rZXkgR2VuZXJhdG9yc1xuICAgICAgICAgICAgICAgIC8vIEZJWE1FOiBSZW1vdmUgdGhpcyBjYXNlIHdoZW4gU00gZG9lcyBFUzYgZ2VuZXJhdG9ycy5cbiAgICAgICAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgICAgICAgICByZXN1bHQgPSBnZW5lcmF0b3JbdmVyYl0oYXJnKTtcbiAgICAgICAgICAgICAgICB9IGNhdGNoIChleGNlcHRpb24pIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKGlzU3RvcEl0ZXJhdGlvbihleGNlcHRpb24pKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gUShleGNlcHRpb24udmFsdWUpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHJlamVjdChleGNlcHRpb24pO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB3aGVuKHJlc3VsdCwgY2FsbGJhY2ssIGVycmJhY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHZhciBnZW5lcmF0b3IgPSBtYWtlR2VuZXJhdG9yLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgIHZhciBjYWxsYmFjayA9IGNvbnRpbnVlci5iaW5kKGNvbnRpbnVlciwgXCJuZXh0XCIpO1xuICAgICAgICB2YXIgZXJyYmFjayA9IGNvbnRpbnVlci5iaW5kKGNvbnRpbnVlciwgXCJ0aHJvd1wiKTtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrKCk7XG4gICAgfTtcbn1cblxuLyoqXG4gKiBUaGUgc3Bhd24gZnVuY3Rpb24gaXMgYSBzbWFsbCB3cmFwcGVyIGFyb3VuZCBhc3luYyB0aGF0IGltbWVkaWF0ZWx5XG4gKiBjYWxscyB0aGUgZ2VuZXJhdG9yIGFuZCBhbHNvIGVuZHMgdGhlIHByb21pc2UgY2hhaW4sIHNvIHRoYXQgYW55XG4gKiB1bmhhbmRsZWQgZXJyb3JzIGFyZSB0aHJvd24gaW5zdGVhZCBvZiBmb3J3YXJkZWQgdG8gdGhlIGVycm9yXG4gKiBoYW5kbGVyLiBUaGlzIGlzIHVzZWZ1bCBiZWNhdXNlIGl0J3MgZXh0cmVtZWx5IGNvbW1vbiB0byBydW5cbiAqIGdlbmVyYXRvcnMgYXQgdGhlIHRvcC1sZXZlbCB0byB3b3JrIHdpdGggbGlicmFyaWVzLlxuICovXG5RLnNwYXduID0gc3Bhd247XG5mdW5jdGlvbiBzcGF3bihtYWtlR2VuZXJhdG9yKSB7XG4gICAgUS5kb25lKFEuYXN5bmMobWFrZUdlbmVyYXRvcikoKSk7XG59XG5cbi8vIEZJWE1FOiBSZW1vdmUgdGhpcyBpbnRlcmZhY2Ugb25jZSBFUzYgZ2VuZXJhdG9ycyBhcmUgaW4gU3BpZGVyTW9ua2V5LlxuLyoqXG4gKiBUaHJvd3MgYSBSZXR1cm5WYWx1ZSBleGNlcHRpb24gdG8gc3RvcCBhbiBhc3luY2hyb25vdXMgZ2VuZXJhdG9yLlxuICpcbiAqIFRoaXMgaW50ZXJmYWNlIGlzIGEgc3RvcC1nYXAgbWVhc3VyZSB0byBzdXBwb3J0IGdlbmVyYXRvciByZXR1cm5cbiAqIHZhbHVlcyBpbiBvbGRlciBGaXJlZm94L1NwaWRlck1vbmtleS4gIEluIGJyb3dzZXJzIHRoYXQgc3VwcG9ydCBFUzZcbiAqIGdlbmVyYXRvcnMgbGlrZSBDaHJvbWl1bSAyOSwganVzdCB1c2UgXCJyZXR1cm5cIiBpbiB5b3VyIGdlbmVyYXRvclxuICogZnVuY3Rpb25zLlxuICpcbiAqIEBwYXJhbSB2YWx1ZSB0aGUgcmV0dXJuIHZhbHVlIGZvciB0aGUgc3Vycm91bmRpbmcgZ2VuZXJhdG9yXG4gKiBAdGhyb3dzIFJldHVyblZhbHVlIGV4Y2VwdGlvbiB3aXRoIHRoZSB2YWx1ZS5cbiAqIEBleGFtcGxlXG4gKiAvLyBFUzYgc3R5bGVcbiAqIFEuYXN5bmMoZnVuY3Rpb24qICgpIHtcbiAqICAgICAgdmFyIGZvbyA9IHlpZWxkIGdldEZvb1Byb21pc2UoKTtcbiAqICAgICAgdmFyIGJhciA9IHlpZWxkIGdldEJhclByb21pc2UoKTtcbiAqICAgICAgcmV0dXJuIGZvbyArIGJhcjtcbiAqIH0pXG4gKiAvLyBPbGRlciBTcGlkZXJNb25rZXkgc3R5bGVcbiAqIFEuYXN5bmMoZnVuY3Rpb24gKCkge1xuICogICAgICB2YXIgZm9vID0geWllbGQgZ2V0Rm9vUHJvbWlzZSgpO1xuICogICAgICB2YXIgYmFyID0geWllbGQgZ2V0QmFyUHJvbWlzZSgpO1xuICogICAgICBRLnJldHVybihmb28gKyBiYXIpO1xuICogfSlcbiAqL1xuUVtcInJldHVyblwiXSA9IF9yZXR1cm47XG5mdW5jdGlvbiBfcmV0dXJuKHZhbHVlKSB7XG4gICAgdGhyb3cgbmV3IFFSZXR1cm5WYWx1ZSh2YWx1ZSk7XG59XG5cbi8qKlxuICogVGhlIHByb21pc2VkIGZ1bmN0aW9uIGRlY29yYXRvciBlbnN1cmVzIHRoYXQgYW55IHByb21pc2UgYXJndW1lbnRzXG4gKiBhcmUgc2V0dGxlZCBhbmQgcGFzc2VkIGFzIHZhbHVlcyAoYHRoaXNgIGlzIGFsc28gc2V0dGxlZCBhbmQgcGFzc2VkXG4gKiBhcyBhIHZhbHVlKS4gIEl0IHdpbGwgYWxzbyBlbnN1cmUgdGhhdCB0aGUgcmVzdWx0IG9mIGEgZnVuY3Rpb24gaXNcbiAqIGFsd2F5cyBhIHByb21pc2UuXG4gKlxuICogQGV4YW1wbGVcbiAqIHZhciBhZGQgPSBRLnByb21pc2VkKGZ1bmN0aW9uIChhLCBiKSB7XG4gKiAgICAgcmV0dXJuIGEgKyBiO1xuICogfSk7XG4gKiBhZGQoUShhKSwgUShCKSk7XG4gKlxuICogQHBhcmFtIHtmdW5jdGlvbn0gY2FsbGJhY2sgVGhlIGZ1bmN0aW9uIHRvIGRlY29yYXRlXG4gKiBAcmV0dXJucyB7ZnVuY3Rpb259IGEgZnVuY3Rpb24gdGhhdCBoYXMgYmVlbiBkZWNvcmF0ZWQuXG4gKi9cblEucHJvbWlzZWQgPSBwcm9taXNlZDtcbmZ1bmN0aW9uIHByb21pc2VkKGNhbGxiYWNrKSB7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcmV0dXJuIHNwcmVhZChbdGhpcywgYWxsKGFyZ3VtZW50cyldLCBmdW5jdGlvbiAoc2VsZiwgYXJncykge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrLmFwcGx5KHNlbGYsIGFyZ3MpO1xuICAgICAgICB9KTtcbiAgICB9O1xufVxuXG4vKipcbiAqIHNlbmRzIGEgbWVzc2FnZSB0byBhIHZhbHVlIGluIGEgZnV0dXJlIHR1cm5cbiAqIEBwYXJhbSBvYmplY3QqIHRoZSByZWNpcGllbnRcbiAqIEBwYXJhbSBvcCB0aGUgbmFtZSBvZiB0aGUgbWVzc2FnZSBvcGVyYXRpb24sIGUuZy4sIFwid2hlblwiLFxuICogQHBhcmFtIGFyZ3MgZnVydGhlciBhcmd1bWVudHMgdG8gYmUgZm9yd2FyZGVkIHRvIHRoZSBvcGVyYXRpb25cbiAqIEByZXR1cm5zIHJlc3VsdCB7UHJvbWlzZX0gYSBwcm9taXNlIGZvciB0aGUgcmVzdWx0IG9mIHRoZSBvcGVyYXRpb25cbiAqL1xuUS5kaXNwYXRjaCA9IGRpc3BhdGNoO1xuZnVuY3Rpb24gZGlzcGF0Y2gob2JqZWN0LCBvcCwgYXJncykge1xuICAgIHJldHVybiBRKG9iamVjdCkuZGlzcGF0Y2gob3AsIGFyZ3MpO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS5kaXNwYXRjaCA9IGZ1bmN0aW9uIChvcCwgYXJncykge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgIFEubmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLnByb21pc2VEaXNwYXRjaChkZWZlcnJlZC5yZXNvbHZlLCBvcCwgYXJncyk7XG4gICAgfSk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG4vKipcbiAqIEdldHMgdGhlIHZhbHVlIG9mIGEgcHJvcGVydHkgaW4gYSBmdXR1cmUgdHVybi5cbiAqIEBwYXJhbSBvYmplY3QgICAgcHJvbWlzZSBvciBpbW1lZGlhdGUgcmVmZXJlbmNlIGZvciB0YXJnZXQgb2JqZWN0XG4gKiBAcGFyYW0gbmFtZSAgICAgIG5hbWUgb2YgcHJvcGVydHkgdG8gZ2V0XG4gKiBAcmV0dXJuIHByb21pc2UgZm9yIHRoZSBwcm9wZXJ0eSB2YWx1ZVxuICovXG5RLmdldCA9IGZ1bmN0aW9uIChvYmplY3QsIGtleSkge1xuICAgIHJldHVybiBRKG9iamVjdCkuZGlzcGF0Y2goXCJnZXRcIiwgW2tleV0pO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuZ2V0ID0gZnVuY3Rpb24gKGtleSkge1xuICAgIHJldHVybiB0aGlzLmRpc3BhdGNoKFwiZ2V0XCIsIFtrZXldKTtcbn07XG5cbi8qKlxuICogU2V0cyB0aGUgdmFsdWUgb2YgYSBwcm9wZXJ0eSBpbiBhIGZ1dHVyZSB0dXJuLlxuICogQHBhcmFtIG9iamVjdCAgICBwcm9taXNlIG9yIGltbWVkaWF0ZSByZWZlcmVuY2UgZm9yIG9iamVjdCBvYmplY3RcbiAqIEBwYXJhbSBuYW1lICAgICAgbmFtZSBvZiBwcm9wZXJ0eSB0byBzZXRcbiAqIEBwYXJhbSB2YWx1ZSAgICAgbmV3IHZhbHVlIG9mIHByb3BlcnR5XG4gKiBAcmV0dXJuIHByb21pc2UgZm9yIHRoZSByZXR1cm4gdmFsdWVcbiAqL1xuUS5zZXQgPSBmdW5jdGlvbiAob2JqZWN0LCBrZXksIHZhbHVlKSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS5kaXNwYXRjaChcInNldFwiLCBba2V5LCB2YWx1ZV0pO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKGtleSwgdmFsdWUpIHtcbiAgICByZXR1cm4gdGhpcy5kaXNwYXRjaChcInNldFwiLCBba2V5LCB2YWx1ZV0pO1xufTtcblxuLyoqXG4gKiBEZWxldGVzIGEgcHJvcGVydHkgaW4gYSBmdXR1cmUgdHVybi5cbiAqIEBwYXJhbSBvYmplY3QgICAgcHJvbWlzZSBvciBpbW1lZGlhdGUgcmVmZXJlbmNlIGZvciB0YXJnZXQgb2JqZWN0XG4gKiBAcGFyYW0gbmFtZSAgICAgIG5hbWUgb2YgcHJvcGVydHkgdG8gZGVsZXRlXG4gKiBAcmV0dXJuIHByb21pc2UgZm9yIHRoZSByZXR1cm4gdmFsdWVcbiAqL1xuUS5kZWwgPSAvLyBYWFggbGVnYWN5XG5RW1wiZGVsZXRlXCJdID0gZnVuY3Rpb24gKG9iamVjdCwga2V5KSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS5kaXNwYXRjaChcImRlbGV0ZVwiLCBba2V5XSk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5kZWwgPSAvLyBYWFggbGVnYWN5XG5Qcm9taXNlLnByb3RvdHlwZVtcImRlbGV0ZVwiXSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICByZXR1cm4gdGhpcy5kaXNwYXRjaChcImRlbGV0ZVwiLCBba2V5XSk7XG59O1xuXG4vKipcbiAqIEludm9rZXMgYSBtZXRob2QgaW4gYSBmdXR1cmUgdHVybi5cbiAqIEBwYXJhbSBvYmplY3QgICAgcHJvbWlzZSBvciBpbW1lZGlhdGUgcmVmZXJlbmNlIGZvciB0YXJnZXQgb2JqZWN0XG4gKiBAcGFyYW0gbmFtZSAgICAgIG5hbWUgb2YgbWV0aG9kIHRvIGludm9rZVxuICogQHBhcmFtIHZhbHVlICAgICBhIHZhbHVlIHRvIHBvc3QsIHR5cGljYWxseSBhbiBhcnJheSBvZlxuICogICAgICAgICAgICAgICAgICBpbnZvY2F0aW9uIGFyZ3VtZW50cyBmb3IgcHJvbWlzZXMgdGhhdFxuICogICAgICAgICAgICAgICAgICBhcmUgdWx0aW1hdGVseSBiYWNrZWQgd2l0aCBgcmVzb2x2ZWAgdmFsdWVzLFxuICogICAgICAgICAgICAgICAgICBhcyBvcHBvc2VkIHRvIHRob3NlIGJhY2tlZCB3aXRoIFVSTHNcbiAqICAgICAgICAgICAgICAgICAgd2hlcmVpbiB0aGUgcG9zdGVkIHZhbHVlIGNhbiBiZSBhbnlcbiAqICAgICAgICAgICAgICAgICAgSlNPTiBzZXJpYWxpemFibGUgb2JqZWN0LlxuICogQHJldHVybiBwcm9taXNlIGZvciB0aGUgcmV0dXJuIHZhbHVlXG4gKi9cbi8vIGJvdW5kIGxvY2FsbHkgYmVjYXVzZSBpdCBpcyB1c2VkIGJ5IG90aGVyIG1ldGhvZHNcblEubWFwcGx5ID0gLy8gWFhYIEFzIHByb3Bvc2VkIGJ5IFwiUmVkc2FuZHJvXCJcblEucG9zdCA9IGZ1bmN0aW9uIChvYmplY3QsIG5hbWUsIGFyZ3MpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLmRpc3BhdGNoKFwicG9zdFwiLCBbbmFtZSwgYXJnc10pO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUubWFwcGx5ID0gLy8gWFhYIEFzIHByb3Bvc2VkIGJ5IFwiUmVkc2FuZHJvXCJcblByb21pc2UucHJvdG90eXBlLnBvc3QgPSBmdW5jdGlvbiAobmFtZSwgYXJncykge1xuICAgIHJldHVybiB0aGlzLmRpc3BhdGNoKFwicG9zdFwiLCBbbmFtZSwgYXJnc10pO1xufTtcblxuLyoqXG4gKiBJbnZva2VzIGEgbWV0aG9kIGluIGEgZnV0dXJlIHR1cm4uXG4gKiBAcGFyYW0gb2JqZWN0ICAgIHByb21pc2Ugb3IgaW1tZWRpYXRlIHJlZmVyZW5jZSBmb3IgdGFyZ2V0IG9iamVjdFxuICogQHBhcmFtIG5hbWUgICAgICBuYW1lIG9mIG1ldGhvZCB0byBpbnZva2VcbiAqIEBwYXJhbSAuLi5hcmdzICAgYXJyYXkgb2YgaW52b2NhdGlvbiBhcmd1bWVudHNcbiAqIEByZXR1cm4gcHJvbWlzZSBmb3IgdGhlIHJldHVybiB2YWx1ZVxuICovXG5RLnNlbmQgPSAvLyBYWFggTWFyayBNaWxsZXIncyBwcm9wb3NlZCBwYXJsYW5jZVxuUS5tY2FsbCA9IC8vIFhYWCBBcyBwcm9wb3NlZCBieSBcIlJlZHNhbmRyb1wiXG5RLmludm9rZSA9IGZ1bmN0aW9uIChvYmplY3QsIG5hbWUgLyouLi5hcmdzKi8pIHtcbiAgICByZXR1cm4gUShvYmplY3QpLmRpc3BhdGNoKFwicG9zdFwiLCBbbmFtZSwgYXJyYXlfc2xpY2UoYXJndW1lbnRzLCAyKV0pO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuc2VuZCA9IC8vIFhYWCBNYXJrIE1pbGxlcidzIHByb3Bvc2VkIHBhcmxhbmNlXG5Qcm9taXNlLnByb3RvdHlwZS5tY2FsbCA9IC8vIFhYWCBBcyBwcm9wb3NlZCBieSBcIlJlZHNhbmRyb1wiXG5Qcm9taXNlLnByb3RvdHlwZS5pbnZva2UgPSBmdW5jdGlvbiAobmFtZSAvKi4uLmFyZ3MqLykge1xuICAgIHJldHVybiB0aGlzLmRpc3BhdGNoKFwicG9zdFwiLCBbbmFtZSwgYXJyYXlfc2xpY2UoYXJndW1lbnRzLCAxKV0pO1xufTtcblxuLyoqXG4gKiBBcHBsaWVzIHRoZSBwcm9taXNlZCBmdW5jdGlvbiBpbiBhIGZ1dHVyZSB0dXJuLlxuICogQHBhcmFtIG9iamVjdCAgICBwcm9taXNlIG9yIGltbWVkaWF0ZSByZWZlcmVuY2UgZm9yIHRhcmdldCBmdW5jdGlvblxuICogQHBhcmFtIGFyZ3MgICAgICBhcnJheSBvZiBhcHBsaWNhdGlvbiBhcmd1bWVudHNcbiAqL1xuUS5mYXBwbHkgPSBmdW5jdGlvbiAob2JqZWN0LCBhcmdzKSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS5kaXNwYXRjaChcImFwcGx5XCIsIFt2b2lkIDAsIGFyZ3NdKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLmZhcHBseSA9IGZ1bmN0aW9uIChhcmdzKSB7XG4gICAgcmV0dXJuIHRoaXMuZGlzcGF0Y2goXCJhcHBseVwiLCBbdm9pZCAwLCBhcmdzXSk7XG59O1xuXG4vKipcbiAqIENhbGxzIHRoZSBwcm9taXNlZCBmdW5jdGlvbiBpbiBhIGZ1dHVyZSB0dXJuLlxuICogQHBhcmFtIG9iamVjdCAgICBwcm9taXNlIG9yIGltbWVkaWF0ZSByZWZlcmVuY2UgZm9yIHRhcmdldCBmdW5jdGlvblxuICogQHBhcmFtIC4uLmFyZ3MgICBhcnJheSBvZiBhcHBsaWNhdGlvbiBhcmd1bWVudHNcbiAqL1xuUVtcInRyeVwiXSA9XG5RLmZjYWxsID0gZnVuY3Rpb24gKG9iamVjdCAvKiAuLi5hcmdzKi8pIHtcbiAgICByZXR1cm4gUShvYmplY3QpLmRpc3BhdGNoKFwiYXBwbHlcIiwgW3ZvaWQgMCwgYXJyYXlfc2xpY2UoYXJndW1lbnRzLCAxKV0pO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuZmNhbGwgPSBmdW5jdGlvbiAoLyouLi5hcmdzKi8pIHtcbiAgICByZXR1cm4gdGhpcy5kaXNwYXRjaChcImFwcGx5XCIsIFt2b2lkIDAsIGFycmF5X3NsaWNlKGFyZ3VtZW50cyldKTtcbn07XG5cbi8qKlxuICogQmluZHMgdGhlIHByb21pc2VkIGZ1bmN0aW9uLCB0cmFuc2Zvcm1pbmcgcmV0dXJuIHZhbHVlcyBpbnRvIGEgZnVsZmlsbGVkXG4gKiBwcm9taXNlIGFuZCB0aHJvd24gZXJyb3JzIGludG8gYSByZWplY3RlZCBvbmUuXG4gKiBAcGFyYW0gb2JqZWN0ICAgIHByb21pc2Ugb3IgaW1tZWRpYXRlIHJlZmVyZW5jZSBmb3IgdGFyZ2V0IGZ1bmN0aW9uXG4gKiBAcGFyYW0gLi4uYXJncyAgIGFycmF5IG9mIGFwcGxpY2F0aW9uIGFyZ3VtZW50c1xuICovXG5RLmZiaW5kID0gZnVuY3Rpb24gKG9iamVjdCAvKi4uLmFyZ3MqLykge1xuICAgIHZhciBwcm9taXNlID0gUShvYmplY3QpO1xuICAgIHZhciBhcmdzID0gYXJyYXlfc2xpY2UoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gZnVuY3Rpb24gZmJvdW5kKCkge1xuICAgICAgICByZXR1cm4gcHJvbWlzZS5kaXNwYXRjaChcImFwcGx5XCIsIFtcbiAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICBhcmdzLmNvbmNhdChhcnJheV9zbGljZShhcmd1bWVudHMpKVxuICAgICAgICBdKTtcbiAgICB9O1xufTtcblByb21pc2UucHJvdG90eXBlLmZiaW5kID0gZnVuY3Rpb24gKC8qLi4uYXJncyovKSB7XG4gICAgdmFyIHByb21pc2UgPSB0aGlzO1xuICAgIHZhciBhcmdzID0gYXJyYXlfc2xpY2UoYXJndW1lbnRzKTtcbiAgICByZXR1cm4gZnVuY3Rpb24gZmJvdW5kKCkge1xuICAgICAgICByZXR1cm4gcHJvbWlzZS5kaXNwYXRjaChcImFwcGx5XCIsIFtcbiAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICBhcmdzLmNvbmNhdChhcnJheV9zbGljZShhcmd1bWVudHMpKVxuICAgICAgICBdKTtcbiAgICB9O1xufTtcblxuLyoqXG4gKiBSZXF1ZXN0cyB0aGUgbmFtZXMgb2YgdGhlIG93bmVkIHByb3BlcnRpZXMgb2YgYSBwcm9taXNlZFxuICogb2JqZWN0IGluIGEgZnV0dXJlIHR1cm4uXG4gKiBAcGFyYW0gb2JqZWN0ICAgIHByb21pc2Ugb3IgaW1tZWRpYXRlIHJlZmVyZW5jZSBmb3IgdGFyZ2V0IG9iamVjdFxuICogQHJldHVybiBwcm9taXNlIGZvciB0aGUga2V5cyBvZiB0aGUgZXZlbnR1YWxseSBzZXR0bGVkIG9iamVjdFxuICovXG5RLmtleXMgPSBmdW5jdGlvbiAob2JqZWN0KSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS5kaXNwYXRjaChcImtleXNcIiwgW10pO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUua2V5cyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5kaXNwYXRjaChcImtleXNcIiwgW10pO1xufTtcblxuLyoqXG4gKiBUdXJucyBhbiBhcnJheSBvZiBwcm9taXNlcyBpbnRvIGEgcHJvbWlzZSBmb3IgYW4gYXJyYXkuICBJZiBhbnkgb2ZcbiAqIHRoZSBwcm9taXNlcyBnZXRzIHJlamVjdGVkLCB0aGUgd2hvbGUgYXJyYXkgaXMgcmVqZWN0ZWQgaW1tZWRpYXRlbHkuXG4gKiBAcGFyYW0ge0FycmF5Kn0gYW4gYXJyYXkgKG9yIHByb21pc2UgZm9yIGFuIGFycmF5KSBvZiB2YWx1ZXMgKG9yXG4gKiBwcm9taXNlcyBmb3IgdmFsdWVzKVxuICogQHJldHVybnMgYSBwcm9taXNlIGZvciBhbiBhcnJheSBvZiB0aGUgY29ycmVzcG9uZGluZyB2YWx1ZXNcbiAqL1xuLy8gQnkgTWFyayBNaWxsZXJcbi8vIGh0dHA6Ly93aWtpLmVjbWFzY3JpcHQub3JnL2Rva3UucGhwP2lkPXN0cmF3bWFuOmNvbmN1cnJlbmN5JnJldj0xMzA4Nzc2NTIxI2FsbGZ1bGZpbGxlZFxuUS5hbGwgPSBhbGw7XG5mdW5jdGlvbiBhbGwocHJvbWlzZXMpIHtcbiAgICByZXR1cm4gd2hlbihwcm9taXNlcywgZnVuY3Rpb24gKHByb21pc2VzKSB7XG4gICAgICAgIHZhciBwZW5kaW5nQ291bnQgPSAwO1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgICAgICBhcnJheV9yZWR1Y2UocHJvbWlzZXMsIGZ1bmN0aW9uICh1bmRlZmluZWQsIHByb21pc2UsIGluZGV4KSB7XG4gICAgICAgICAgICB2YXIgc25hcHNob3Q7XG4gICAgICAgICAgICBpZiAoXG4gICAgICAgICAgICAgICAgaXNQcm9taXNlKHByb21pc2UpICYmXG4gICAgICAgICAgICAgICAgKHNuYXBzaG90ID0gcHJvbWlzZS5pbnNwZWN0KCkpLnN0YXRlID09PSBcImZ1bGZpbGxlZFwiXG4gICAgICAgICAgICApIHtcbiAgICAgICAgICAgICAgICBwcm9taXNlc1tpbmRleF0gPSBzbmFwc2hvdC52YWx1ZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgKytwZW5kaW5nQ291bnQ7XG4gICAgICAgICAgICAgICAgd2hlbihcbiAgICAgICAgICAgICAgICAgICAgcHJvbWlzZSxcbiAgICAgICAgICAgICAgICAgICAgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBwcm9taXNlc1tpbmRleF0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmICgtLXBlbmRpbmdDb3VudCA9PT0gMCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUocHJvbWlzZXMpO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBkZWZlcnJlZC5yZWplY3QsXG4gICAgICAgICAgICAgICAgICAgIGZ1bmN0aW9uIChwcm9ncmVzcykge1xuICAgICAgICAgICAgICAgICAgICAgICAgZGVmZXJyZWQubm90aWZ5KHsgaW5kZXg6IGluZGV4LCB2YWx1ZTogcHJvZ3Jlc3MgfSk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgfVxuICAgICAgICB9LCB2b2lkIDApO1xuICAgICAgICBpZiAocGVuZGluZ0NvdW50ID09PSAwKSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHByb21pc2VzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9KTtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUuYWxsID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiBhbGwodGhpcyk7XG59O1xuXG4vKipcbiAqIFJldHVybnMgdGhlIGZpcnN0IHJlc29sdmVkIHByb21pc2Ugb2YgYW4gYXJyYXkuIFByaW9yIHJlamVjdGVkIHByb21pc2VzIGFyZVxuICogaWdub3JlZC4gIFJlamVjdHMgb25seSBpZiBhbGwgcHJvbWlzZXMgYXJlIHJlamVjdGVkLlxuICogQHBhcmFtIHtBcnJheSp9IGFuIGFycmF5IGNvbnRhaW5pbmcgdmFsdWVzIG9yIHByb21pc2VzIGZvciB2YWx1ZXNcbiAqIEByZXR1cm5zIGEgcHJvbWlzZSBmdWxmaWxsZWQgd2l0aCB0aGUgdmFsdWUgb2YgdGhlIGZpcnN0IHJlc29sdmVkIHByb21pc2UsXG4gKiBvciBhIHJlamVjdGVkIHByb21pc2UgaWYgYWxsIHByb21pc2VzIGFyZSByZWplY3RlZC5cbiAqL1xuUS5hbnkgPSBhbnk7XG5cbmZ1bmN0aW9uIGFueShwcm9taXNlcykge1xuICAgIGlmIChwcm9taXNlcy5sZW5ndGggPT09IDApIHtcbiAgICAgICAgcmV0dXJuIFEucmVzb2x2ZSgpO1xuICAgIH1cblxuICAgIHZhciBkZWZlcnJlZCA9IFEuZGVmZXIoKTtcbiAgICB2YXIgcGVuZGluZ0NvdW50ID0gMDtcbiAgICBhcnJheV9yZWR1Y2UocHJvbWlzZXMsIGZ1bmN0aW9uIChwcmV2LCBjdXJyZW50LCBpbmRleCkge1xuICAgICAgICB2YXIgcHJvbWlzZSA9IHByb21pc2VzW2luZGV4XTtcblxuICAgICAgICBwZW5kaW5nQ291bnQrKztcblxuICAgICAgICB3aGVuKHByb21pc2UsIG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzKTtcbiAgICAgICAgZnVuY3Rpb24gb25GdWxmaWxsZWQocmVzdWx0KSB7XG4gICAgICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHJlc3VsdCk7XG4gICAgICAgIH1cbiAgICAgICAgZnVuY3Rpb24gb25SZWplY3RlZCgpIHtcbiAgICAgICAgICAgIHBlbmRpbmdDb3VudC0tO1xuICAgICAgICAgICAgaWYgKHBlbmRpbmdDb3VudCA9PT0gMCkge1xuICAgICAgICAgICAgICAgIGRlZmVycmVkLnJlamVjdChuZXcgRXJyb3IoXG4gICAgICAgICAgICAgICAgICAgIFwiQ2FuJ3QgZ2V0IGZ1bGZpbGxtZW50IHZhbHVlIGZyb20gYW55IHByb21pc2UsIGFsbCBcIiArXG4gICAgICAgICAgICAgICAgICAgIFwicHJvbWlzZXMgd2VyZSByZWplY3RlZC5cIlxuICAgICAgICAgICAgICAgICkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZ1bmN0aW9uIG9uUHJvZ3Jlc3MocHJvZ3Jlc3MpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLm5vdGlmeSh7XG4gICAgICAgICAgICAgICAgaW5kZXg6IGluZGV4LFxuICAgICAgICAgICAgICAgIHZhbHVlOiBwcm9ncmVzc1xuICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICB9LCB1bmRlZmluZWQpO1xuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59XG5cblByb21pc2UucHJvdG90eXBlLmFueSA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gYW55KHRoaXMpO1xufTtcblxuLyoqXG4gKiBXYWl0cyBmb3IgYWxsIHByb21pc2VzIHRvIGJlIHNldHRsZWQsIGVpdGhlciBmdWxmaWxsZWQgb3JcbiAqIHJlamVjdGVkLiAgVGhpcyBpcyBkaXN0aW5jdCBmcm9tIGBhbGxgIHNpbmNlIHRoYXQgd291bGQgc3RvcFxuICogd2FpdGluZyBhdCB0aGUgZmlyc3QgcmVqZWN0aW9uLiAgVGhlIHByb21pc2UgcmV0dXJuZWQgYnlcbiAqIGBhbGxSZXNvbHZlZGAgd2lsbCBuZXZlciBiZSByZWplY3RlZC5cbiAqIEBwYXJhbSBwcm9taXNlcyBhIHByb21pc2UgZm9yIGFuIGFycmF5IChvciBhbiBhcnJheSkgb2YgcHJvbWlzZXNcbiAqIChvciB2YWx1ZXMpXG4gKiBAcmV0dXJuIGEgcHJvbWlzZSBmb3IgYW4gYXJyYXkgb2YgcHJvbWlzZXNcbiAqL1xuUS5hbGxSZXNvbHZlZCA9IGRlcHJlY2F0ZShhbGxSZXNvbHZlZCwgXCJhbGxSZXNvbHZlZFwiLCBcImFsbFNldHRsZWRcIik7XG5mdW5jdGlvbiBhbGxSZXNvbHZlZChwcm9taXNlcykge1xuICAgIHJldHVybiB3aGVuKHByb21pc2VzLCBmdW5jdGlvbiAocHJvbWlzZXMpIHtcbiAgICAgICAgcHJvbWlzZXMgPSBhcnJheV9tYXAocHJvbWlzZXMsIFEpO1xuICAgICAgICByZXR1cm4gd2hlbihhbGwoYXJyYXlfbWFwKHByb21pc2VzLCBmdW5jdGlvbiAocHJvbWlzZSkge1xuICAgICAgICAgICAgcmV0dXJuIHdoZW4ocHJvbWlzZSwgbm9vcCwgbm9vcCk7XG4gICAgICAgIH0pKSwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgcmV0dXJuIHByb21pc2VzO1xuICAgICAgICB9KTtcbiAgICB9KTtcbn1cblxuUHJvbWlzZS5wcm90b3R5cGUuYWxsUmVzb2x2ZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIGFsbFJlc29sdmVkKHRoaXMpO1xufTtcblxuLyoqXG4gKiBAc2VlIFByb21pc2UjYWxsU2V0dGxlZFxuICovXG5RLmFsbFNldHRsZWQgPSBhbGxTZXR0bGVkO1xuZnVuY3Rpb24gYWxsU2V0dGxlZChwcm9taXNlcykge1xuICAgIHJldHVybiBRKHByb21pc2VzKS5hbGxTZXR0bGVkKCk7XG59XG5cbi8qKlxuICogVHVybnMgYW4gYXJyYXkgb2YgcHJvbWlzZXMgaW50byBhIHByb21pc2UgZm9yIGFuIGFycmF5IG9mIHRoZWlyIHN0YXRlcyAoYXNcbiAqIHJldHVybmVkIGJ5IGBpbnNwZWN0YCkgd2hlbiB0aGV5IGhhdmUgYWxsIHNldHRsZWQuXG4gKiBAcGFyYW0ge0FycmF5W0FueSpdfSB2YWx1ZXMgYW4gYXJyYXkgKG9yIHByb21pc2UgZm9yIGFuIGFycmF5KSBvZiB2YWx1ZXMgKG9yXG4gKiBwcm9taXNlcyBmb3IgdmFsdWVzKVxuICogQHJldHVybnMge0FycmF5W1N0YXRlXX0gYW4gYXJyYXkgb2Ygc3RhdGVzIGZvciB0aGUgcmVzcGVjdGl2ZSB2YWx1ZXMuXG4gKi9cblByb21pc2UucHJvdG90eXBlLmFsbFNldHRsZWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMudGhlbihmdW5jdGlvbiAocHJvbWlzZXMpIHtcbiAgICAgICAgcmV0dXJuIGFsbChhcnJheV9tYXAocHJvbWlzZXMsIGZ1bmN0aW9uIChwcm9taXNlKSB7XG4gICAgICAgICAgICBwcm9taXNlID0gUShwcm9taXNlKTtcbiAgICAgICAgICAgIGZ1bmN0aW9uIHJlZ2FyZGxlc3MoKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHByb21pc2UuaW5zcGVjdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHByb21pc2UudGhlbihyZWdhcmRsZXNzLCByZWdhcmRsZXNzKTtcbiAgICAgICAgfSkpO1xuICAgIH0pO1xufTtcblxuLyoqXG4gKiBDYXB0dXJlcyB0aGUgZmFpbHVyZSBvZiBhIHByb21pc2UsIGdpdmluZyBhbiBvcG9ydHVuaXR5IHRvIHJlY292ZXJcbiAqIHdpdGggYSBjYWxsYmFjay4gIElmIHRoZSBnaXZlbiBwcm9taXNlIGlzIGZ1bGZpbGxlZCwgdGhlIHJldHVybmVkXG4gKiBwcm9taXNlIGlzIGZ1bGZpbGxlZC5cbiAqIEBwYXJhbSB7QW55Kn0gcHJvbWlzZSBmb3Igc29tZXRoaW5nXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayB0byBmdWxmaWxsIHRoZSByZXR1cm5lZCBwcm9taXNlIGlmIHRoZVxuICogZ2l2ZW4gcHJvbWlzZSBpcyByZWplY3RlZFxuICogQHJldHVybnMgYSBwcm9taXNlIGZvciB0aGUgcmV0dXJuIHZhbHVlIG9mIHRoZSBjYWxsYmFja1xuICovXG5RLmZhaWwgPSAvLyBYWFggbGVnYWN5XG5RW1wiY2F0Y2hcIl0gPSBmdW5jdGlvbiAob2JqZWN0LCByZWplY3RlZCkge1xuICAgIHJldHVybiBRKG9iamVjdCkudGhlbih2b2lkIDAsIHJlamVjdGVkKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLmZhaWwgPSAvLyBYWFggbGVnYWN5XG5Qcm9taXNlLnByb3RvdHlwZVtcImNhdGNoXCJdID0gZnVuY3Rpb24gKHJlamVjdGVkKSB7XG4gICAgcmV0dXJuIHRoaXMudGhlbih2b2lkIDAsIHJlamVjdGVkKTtcbn07XG5cbi8qKlxuICogQXR0YWNoZXMgYSBsaXN0ZW5lciB0aGF0IGNhbiByZXNwb25kIHRvIHByb2dyZXNzIG5vdGlmaWNhdGlvbnMgZnJvbSBhXG4gKiBwcm9taXNlJ3Mgb3JpZ2luYXRpbmcgZGVmZXJyZWQuIFRoaXMgbGlzdGVuZXIgcmVjZWl2ZXMgdGhlIGV4YWN0IGFyZ3VtZW50c1xuICogcGFzc2VkIHRvIGBgZGVmZXJyZWQubm90aWZ5YGAuXG4gKiBAcGFyYW0ge0FueSp9IHByb21pc2UgZm9yIHNvbWV0aGluZ1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2sgdG8gcmVjZWl2ZSBhbnkgcHJvZ3Jlc3Mgbm90aWZpY2F0aW9uc1xuICogQHJldHVybnMgdGhlIGdpdmVuIHByb21pc2UsIHVuY2hhbmdlZFxuICovXG5RLnByb2dyZXNzID0gcHJvZ3Jlc3M7XG5mdW5jdGlvbiBwcm9ncmVzcyhvYmplY3QsIHByb2dyZXNzZWQpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLnRoZW4odm9pZCAwLCB2b2lkIDAsIHByb2dyZXNzZWQpO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS5wcm9ncmVzcyA9IGZ1bmN0aW9uIChwcm9ncmVzc2VkKSB7XG4gICAgcmV0dXJuIHRoaXMudGhlbih2b2lkIDAsIHZvaWQgMCwgcHJvZ3Jlc3NlZCk7XG59O1xuXG4vKipcbiAqIFByb3ZpZGVzIGFuIG9wcG9ydHVuaXR5IHRvIG9ic2VydmUgdGhlIHNldHRsaW5nIG9mIGEgcHJvbWlzZSxcbiAqIHJlZ2FyZGxlc3Mgb2Ygd2hldGhlciB0aGUgcHJvbWlzZSBpcyBmdWxmaWxsZWQgb3IgcmVqZWN0ZWQuICBGb3J3YXJkc1xuICogdGhlIHJlc29sdXRpb24gdG8gdGhlIHJldHVybmVkIHByb21pc2Ugd2hlbiB0aGUgY2FsbGJhY2sgaXMgZG9uZS5cbiAqIFRoZSBjYWxsYmFjayBjYW4gcmV0dXJuIGEgcHJvbWlzZSB0byBkZWZlciBjb21wbGV0aW9uLlxuICogQHBhcmFtIHtBbnkqfSBwcm9taXNlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayB0byBvYnNlcnZlIHRoZSByZXNvbHV0aW9uIG9mIHRoZSBnaXZlblxuICogcHJvbWlzZSwgdGFrZXMgbm8gYXJndW1lbnRzLlxuICogQHJldHVybnMgYSBwcm9taXNlIGZvciB0aGUgcmVzb2x1dGlvbiBvZiB0aGUgZ2l2ZW4gcHJvbWlzZSB3aGVuXG4gKiBgYGZpbmBgIGlzIGRvbmUuXG4gKi9cblEuZmluID0gLy8gWFhYIGxlZ2FjeVxuUVtcImZpbmFsbHlcIl0gPSBmdW5jdGlvbiAob2JqZWN0LCBjYWxsYmFjaykge1xuICAgIHJldHVybiBRKG9iamVjdClbXCJmaW5hbGx5XCJdKGNhbGxiYWNrKTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLmZpbiA9IC8vIFhYWCBsZWdhY3lcblByb21pc2UucHJvdG90eXBlW1wiZmluYWxseVwiXSA9IGZ1bmN0aW9uIChjYWxsYmFjaykge1xuICAgIGNhbGxiYWNrID0gUShjYWxsYmFjayk7XG4gICAgcmV0dXJuIHRoaXMudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgcmV0dXJuIGNhbGxiYWNrLmZjYWxsKCkudGhlbihmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgICAgIH0pO1xuICAgIH0sIGZ1bmN0aW9uIChyZWFzb24pIHtcbiAgICAgICAgLy8gVE9ETyBhdHRlbXB0IHRvIHJlY3ljbGUgdGhlIHJlamVjdGlvbiB3aXRoIFwidGhpc1wiLlxuICAgICAgICByZXR1cm4gY2FsbGJhY2suZmNhbGwoKS50aGVuKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIHRocm93IHJlYXNvbjtcbiAgICAgICAgfSk7XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIFRlcm1pbmF0ZXMgYSBjaGFpbiBvZiBwcm9taXNlcywgZm9yY2luZyByZWplY3Rpb25zIHRvIGJlXG4gKiB0aHJvd24gYXMgZXhjZXB0aW9ucy5cbiAqIEBwYXJhbSB7QW55Kn0gcHJvbWlzZSBhdCB0aGUgZW5kIG9mIGEgY2hhaW4gb2YgcHJvbWlzZXNcbiAqIEByZXR1cm5zIG5vdGhpbmdcbiAqL1xuUS5kb25lID0gZnVuY3Rpb24gKG9iamVjdCwgZnVsZmlsbGVkLCByZWplY3RlZCwgcHJvZ3Jlc3MpIHtcbiAgICByZXR1cm4gUShvYmplY3QpLmRvbmUoZnVsZmlsbGVkLCByZWplY3RlZCwgcHJvZ3Jlc3MpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUuZG9uZSA9IGZ1bmN0aW9uIChmdWxmaWxsZWQsIHJlamVjdGVkLCBwcm9ncmVzcykge1xuICAgIHZhciBvblVuaGFuZGxlZEVycm9yID0gZnVuY3Rpb24gKGVycm9yKSB7XG4gICAgICAgIC8vIGZvcndhcmQgdG8gYSBmdXR1cmUgdHVybiBzbyB0aGF0IGBgd2hlbmBgXG4gICAgICAgIC8vIGRvZXMgbm90IGNhdGNoIGl0IGFuZCB0dXJuIGl0IGludG8gYSByZWplY3Rpb24uXG4gICAgICAgIFEubmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgbWFrZVN0YWNrVHJhY2VMb25nKGVycm9yLCBwcm9taXNlKTtcbiAgICAgICAgICAgIGlmIChRLm9uZXJyb3IpIHtcbiAgICAgICAgICAgICAgICBRLm9uZXJyb3IoZXJyb3IpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aHJvdyBlcnJvcjtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfTtcblxuICAgIC8vIEF2b2lkIHVubmVjZXNzYXJ5IGBuZXh0VGlja2BpbmcgdmlhIGFuIHVubmVjZXNzYXJ5IGB3aGVuYC5cbiAgICB2YXIgcHJvbWlzZSA9IGZ1bGZpbGxlZCB8fCByZWplY3RlZCB8fCBwcm9ncmVzcyA/XG4gICAgICAgIHRoaXMudGhlbihmdWxmaWxsZWQsIHJlamVjdGVkLCBwcm9ncmVzcykgOlxuICAgICAgICB0aGlzO1xuXG4gICAgaWYgKHR5cGVvZiBwcm9jZXNzID09PSBcIm9iamVjdFwiICYmIHByb2Nlc3MgJiYgcHJvY2Vzcy5kb21haW4pIHtcbiAgICAgICAgb25VbmhhbmRsZWRFcnJvciA9IHByb2Nlc3MuZG9tYWluLmJpbmQob25VbmhhbmRsZWRFcnJvcik7XG4gICAgfVxuXG4gICAgcHJvbWlzZS50aGVuKHZvaWQgMCwgb25VbmhhbmRsZWRFcnJvcik7XG59O1xuXG4vKipcbiAqIENhdXNlcyBhIHByb21pc2UgdG8gYmUgcmVqZWN0ZWQgaWYgaXQgZG9lcyBub3QgZ2V0IGZ1bGZpbGxlZCBiZWZvcmVcbiAqIHNvbWUgbWlsbGlzZWNvbmRzIHRpbWUgb3V0LlxuICogQHBhcmFtIHtBbnkqfSBwcm9taXNlXG4gKiBAcGFyYW0ge051bWJlcn0gbWlsbGlzZWNvbmRzIHRpbWVvdXRcbiAqIEBwYXJhbSB7QW55Kn0gY3VzdG9tIGVycm9yIG1lc3NhZ2Ugb3IgRXJyb3Igb2JqZWN0IChvcHRpb25hbClcbiAqIEByZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIHJlc29sdXRpb24gb2YgdGhlIGdpdmVuIHByb21pc2UgaWYgaXQgaXNcbiAqIGZ1bGZpbGxlZCBiZWZvcmUgdGhlIHRpbWVvdXQsIG90aGVyd2lzZSByZWplY3RlZC5cbiAqL1xuUS50aW1lb3V0ID0gZnVuY3Rpb24gKG9iamVjdCwgbXMsIGVycm9yKSB7XG4gICAgcmV0dXJuIFEob2JqZWN0KS50aW1lb3V0KG1zLCBlcnJvcik7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS50aW1lb3V0ID0gZnVuY3Rpb24gKG1zLCBlcnJvcikge1xuICAgIHZhciBkZWZlcnJlZCA9IGRlZmVyKCk7XG4gICAgdmFyIHRpbWVvdXRJZCA9IHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoIWVycm9yIHx8IFwic3RyaW5nXCIgPT09IHR5cGVvZiBlcnJvcikge1xuICAgICAgICAgICAgZXJyb3IgPSBuZXcgRXJyb3IoZXJyb3IgfHwgXCJUaW1lZCBvdXQgYWZ0ZXIgXCIgKyBtcyArIFwiIG1zXCIpO1xuICAgICAgICAgICAgZXJyb3IuY29kZSA9IFwiRVRJTUVET1VUXCI7XG4gICAgICAgIH1cbiAgICAgICAgZGVmZXJyZWQucmVqZWN0KGVycm9yKTtcbiAgICB9LCBtcyk7XG5cbiAgICB0aGlzLnRoZW4oZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICBkZWZlcnJlZC5yZXNvbHZlKHZhbHVlKTtcbiAgICB9LCBmdW5jdGlvbiAoZXhjZXB0aW9uKSB7XG4gICAgICAgIGNsZWFyVGltZW91dCh0aW1lb3V0SWQpO1xuICAgICAgICBkZWZlcnJlZC5yZWplY3QoZXhjZXB0aW9uKTtcbiAgICB9LCBkZWZlcnJlZC5ub3RpZnkpO1xuXG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG4vKipcbiAqIFJldHVybnMgYSBwcm9taXNlIGZvciB0aGUgZ2l2ZW4gdmFsdWUgKG9yIHByb21pc2VkIHZhbHVlKSwgc29tZVxuICogbWlsbGlzZWNvbmRzIGFmdGVyIGl0IHJlc29sdmVkLiBQYXNzZXMgcmVqZWN0aW9ucyBpbW1lZGlhdGVseS5cbiAqIEBwYXJhbSB7QW55Kn0gcHJvbWlzZVxuICogQHBhcmFtIHtOdW1iZXJ9IG1pbGxpc2Vjb25kc1xuICogQHJldHVybnMgYSBwcm9taXNlIGZvciB0aGUgcmVzb2x1dGlvbiBvZiB0aGUgZ2l2ZW4gcHJvbWlzZSBhZnRlciBtaWxsaXNlY29uZHNcbiAqIHRpbWUgaGFzIGVsYXBzZWQgc2luY2UgdGhlIHJlc29sdXRpb24gb2YgdGhlIGdpdmVuIHByb21pc2UuXG4gKiBJZiB0aGUgZ2l2ZW4gcHJvbWlzZSByZWplY3RzLCB0aGF0IGlzIHBhc3NlZCBpbW1lZGlhdGVseS5cbiAqL1xuUS5kZWxheSA9IGZ1bmN0aW9uIChvYmplY3QsIHRpbWVvdXQpIHtcbiAgICBpZiAodGltZW91dCA9PT0gdm9pZCAwKSB7XG4gICAgICAgIHRpbWVvdXQgPSBvYmplY3Q7XG4gICAgICAgIG9iamVjdCA9IHZvaWQgMDtcbiAgICB9XG4gICAgcmV0dXJuIFEob2JqZWN0KS5kZWxheSh0aW1lb3V0KTtcbn07XG5cblByb21pc2UucHJvdG90eXBlLmRlbGF5ID0gZnVuY3Rpb24gKHRpbWVvdXQpIHtcbiAgICByZXR1cm4gdGhpcy50aGVuKGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGRlZmVycmVkLnJlc29sdmUodmFsdWUpO1xuICAgICAgICB9LCB0aW1lb3V0KTtcbiAgICAgICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG4gICAgfSk7XG59O1xuXG4vKipcbiAqIFBhc3NlcyBhIGNvbnRpbnVhdGlvbiB0byBhIE5vZGUgZnVuY3Rpb24sIHdoaWNoIGlzIGNhbGxlZCB3aXRoIHRoZSBnaXZlblxuICogYXJndW1lbnRzIHByb3ZpZGVkIGFzIGFuIGFycmF5LCBhbmQgcmV0dXJucyBhIHByb21pc2UuXG4gKlxuICogICAgICBRLm5mYXBwbHkoRlMucmVhZEZpbGUsIFtfX2ZpbGVuYW1lXSlcbiAqICAgICAgLnRoZW4oZnVuY3Rpb24gKGNvbnRlbnQpIHtcbiAqICAgICAgfSlcbiAqXG4gKi9cblEubmZhcHBseSA9IGZ1bmN0aW9uIChjYWxsYmFjaywgYXJncykge1xuICAgIHJldHVybiBRKGNhbGxiYWNrKS5uZmFwcGx5KGFyZ3MpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUubmZhcHBseSA9IGZ1bmN0aW9uIChhcmdzKSB7XG4gICAgdmFyIGRlZmVycmVkID0gZGVmZXIoKTtcbiAgICB2YXIgbm9kZUFyZ3MgPSBhcnJheV9zbGljZShhcmdzKTtcbiAgICBub2RlQXJncy5wdXNoKGRlZmVycmVkLm1ha2VOb2RlUmVzb2x2ZXIoKSk7XG4gICAgdGhpcy5mYXBwbHkobm9kZUFyZ3MpLmZhaWwoZGVmZXJyZWQucmVqZWN0KTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbi8qKlxuICogUGFzc2VzIGEgY29udGludWF0aW9uIHRvIGEgTm9kZSBmdW5jdGlvbiwgd2hpY2ggaXMgY2FsbGVkIHdpdGggdGhlIGdpdmVuXG4gKiBhcmd1bWVudHMgcHJvdmlkZWQgaW5kaXZpZHVhbGx5LCBhbmQgcmV0dXJucyBhIHByb21pc2UuXG4gKiBAZXhhbXBsZVxuICogUS5uZmNhbGwoRlMucmVhZEZpbGUsIF9fZmlsZW5hbWUpXG4gKiAudGhlbihmdW5jdGlvbiAoY29udGVudCkge1xuICogfSlcbiAqXG4gKi9cblEubmZjYWxsID0gZnVuY3Rpb24gKGNhbGxiYWNrIC8qLi4uYXJncyovKSB7XG4gICAgdmFyIGFyZ3MgPSBhcnJheV9zbGljZShhcmd1bWVudHMsIDEpO1xuICAgIHJldHVybiBRKGNhbGxiYWNrKS5uZmFwcGx5KGFyZ3MpO1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUubmZjYWxsID0gZnVuY3Rpb24gKC8qLi4uYXJncyovKSB7XG4gICAgdmFyIG5vZGVBcmdzID0gYXJyYXlfc2xpY2UoYXJndW1lbnRzKTtcbiAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgIG5vZGVBcmdzLnB1c2goZGVmZXJyZWQubWFrZU5vZGVSZXNvbHZlcigpKTtcbiAgICB0aGlzLmZhcHBseShub2RlQXJncykuZmFpbChkZWZlcnJlZC5yZWplY3QpO1xuICAgIHJldHVybiBkZWZlcnJlZC5wcm9taXNlO1xufTtcblxuLyoqXG4gKiBXcmFwcyBhIE5vZGVKUyBjb250aW51YXRpb24gcGFzc2luZyBmdW5jdGlvbiBhbmQgcmV0dXJucyBhbiBlcXVpdmFsZW50XG4gKiB2ZXJzaW9uIHRoYXQgcmV0dXJucyBhIHByb21pc2UuXG4gKiBAZXhhbXBsZVxuICogUS5uZmJpbmQoRlMucmVhZEZpbGUsIF9fZmlsZW5hbWUpKFwidXRmLThcIilcbiAqIC50aGVuKGNvbnNvbGUubG9nKVxuICogLmRvbmUoKVxuICovXG5RLm5mYmluZCA9XG5RLmRlbm9kZWlmeSA9IGZ1bmN0aW9uIChjYWxsYmFjayAvKi4uLmFyZ3MqLykge1xuICAgIHZhciBiYXNlQXJncyA9IGFycmF5X3NsaWNlKGFyZ3VtZW50cywgMSk7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIG5vZGVBcmdzID0gYmFzZUFyZ3MuY29uY2F0KGFycmF5X3NsaWNlKGFyZ3VtZW50cykpO1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgICAgICBub2RlQXJncy5wdXNoKGRlZmVycmVkLm1ha2VOb2RlUmVzb2x2ZXIoKSk7XG4gICAgICAgIFEoY2FsbGJhY2spLmZhcHBseShub2RlQXJncykuZmFpbChkZWZlcnJlZC5yZWplY3QpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUubmZiaW5kID1cblByb21pc2UucHJvdG90eXBlLmRlbm9kZWlmeSA9IGZ1bmN0aW9uICgvKi4uLmFyZ3MqLykge1xuICAgIHZhciBhcmdzID0gYXJyYXlfc2xpY2UoYXJndW1lbnRzKTtcbiAgICBhcmdzLnVuc2hpZnQodGhpcyk7XG4gICAgcmV0dXJuIFEuZGVub2RlaWZ5LmFwcGx5KHZvaWQgMCwgYXJncyk7XG59O1xuXG5RLm5iaW5kID0gZnVuY3Rpb24gKGNhbGxiYWNrLCB0aGlzcCAvKi4uLmFyZ3MqLykge1xuICAgIHZhciBiYXNlQXJncyA9IGFycmF5X3NsaWNlKGFyZ3VtZW50cywgMik7XG4gICAgcmV0dXJuIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgdmFyIG5vZGVBcmdzID0gYmFzZUFyZ3MuY29uY2F0KGFycmF5X3NsaWNlKGFyZ3VtZW50cykpO1xuICAgICAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgICAgICBub2RlQXJncy5wdXNoKGRlZmVycmVkLm1ha2VOb2RlUmVzb2x2ZXIoKSk7XG4gICAgICAgIGZ1bmN0aW9uIGJvdW5kKCkge1xuICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrLmFwcGx5KHRoaXNwLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG4gICAgICAgIFEoYm91bmQpLmZhcHBseShub2RlQXJncykuZmFpbChkZWZlcnJlZC5yZWplY3QpO1xuICAgICAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbiAgICB9O1xufTtcblxuUHJvbWlzZS5wcm90b3R5cGUubmJpbmQgPSBmdW5jdGlvbiAoLyp0aGlzcCwgLi4uYXJncyovKSB7XG4gICAgdmFyIGFyZ3MgPSBhcnJheV9zbGljZShhcmd1bWVudHMsIDApO1xuICAgIGFyZ3MudW5zaGlmdCh0aGlzKTtcbiAgICByZXR1cm4gUS5uYmluZC5hcHBseSh2b2lkIDAsIGFyZ3MpO1xufTtcblxuLyoqXG4gKiBDYWxscyBhIG1ldGhvZCBvZiBhIE5vZGUtc3R5bGUgb2JqZWN0IHRoYXQgYWNjZXB0cyBhIE5vZGUtc3R5bGVcbiAqIGNhbGxiYWNrIHdpdGggYSBnaXZlbiBhcnJheSBvZiBhcmd1bWVudHMsIHBsdXMgYSBwcm92aWRlZCBjYWxsYmFjay5cbiAqIEBwYXJhbSBvYmplY3QgYW4gb2JqZWN0IHRoYXQgaGFzIHRoZSBuYW1lZCBtZXRob2RcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG5hbWUgb2YgdGhlIG1ldGhvZCBvZiBvYmplY3RcbiAqIEBwYXJhbSB7QXJyYXl9IGFyZ3MgYXJndW1lbnRzIHRvIHBhc3MgdG8gdGhlIG1ldGhvZDsgdGhlIGNhbGxiYWNrXG4gKiB3aWxsIGJlIHByb3ZpZGVkIGJ5IFEgYW5kIGFwcGVuZGVkIHRvIHRoZXNlIGFyZ3VtZW50cy5cbiAqIEByZXR1cm5zIGEgcHJvbWlzZSBmb3IgdGhlIHZhbHVlIG9yIGVycm9yXG4gKi9cblEubm1hcHBseSA9IC8vIFhYWCBBcyBwcm9wb3NlZCBieSBcIlJlZHNhbmRyb1wiXG5RLm5wb3N0ID0gZnVuY3Rpb24gKG9iamVjdCwgbmFtZSwgYXJncykge1xuICAgIHJldHVybiBRKG9iamVjdCkubnBvc3QobmFtZSwgYXJncyk7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5ubWFwcGx5ID0gLy8gWFhYIEFzIHByb3Bvc2VkIGJ5IFwiUmVkc2FuZHJvXCJcblByb21pc2UucHJvdG90eXBlLm5wb3N0ID0gZnVuY3Rpb24gKG5hbWUsIGFyZ3MpIHtcbiAgICB2YXIgbm9kZUFyZ3MgPSBhcnJheV9zbGljZShhcmdzIHx8IFtdKTtcbiAgICB2YXIgZGVmZXJyZWQgPSBkZWZlcigpO1xuICAgIG5vZGVBcmdzLnB1c2goZGVmZXJyZWQubWFrZU5vZGVSZXNvbHZlcigpKTtcbiAgICB0aGlzLmRpc3BhdGNoKFwicG9zdFwiLCBbbmFtZSwgbm9kZUFyZ3NdKS5mYWlsKGRlZmVycmVkLnJlamVjdCk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG4vKipcbiAqIENhbGxzIGEgbWV0aG9kIG9mIGEgTm9kZS1zdHlsZSBvYmplY3QgdGhhdCBhY2NlcHRzIGEgTm9kZS1zdHlsZVxuICogY2FsbGJhY2ssIGZvcndhcmRpbmcgdGhlIGdpdmVuIHZhcmlhZGljIGFyZ3VtZW50cywgcGx1cyBhIHByb3ZpZGVkXG4gKiBjYWxsYmFjayBhcmd1bWVudC5cbiAqIEBwYXJhbSBvYmplY3QgYW4gb2JqZWN0IHRoYXQgaGFzIHRoZSBuYW1lZCBtZXRob2RcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lIG5hbWUgb2YgdGhlIG1ldGhvZCBvZiBvYmplY3RcbiAqIEBwYXJhbSAuLi5hcmdzIGFyZ3VtZW50cyB0byBwYXNzIHRvIHRoZSBtZXRob2Q7IHRoZSBjYWxsYmFjayB3aWxsXG4gKiBiZSBwcm92aWRlZCBieSBRIGFuZCBhcHBlbmRlZCB0byB0aGVzZSBhcmd1bWVudHMuXG4gKiBAcmV0dXJucyBhIHByb21pc2UgZm9yIHRoZSB2YWx1ZSBvciBlcnJvclxuICovXG5RLm5zZW5kID0gLy8gWFhYIEJhc2VkIG9uIE1hcmsgTWlsbGVyJ3MgcHJvcG9zZWQgXCJzZW5kXCJcblEubm1jYWxsID0gLy8gWFhYIEJhc2VkIG9uIFwiUmVkc2FuZHJvJ3NcIiBwcm9wb3NhbFxuUS5uaW52b2tlID0gZnVuY3Rpb24gKG9iamVjdCwgbmFtZSAvKi4uLmFyZ3MqLykge1xuICAgIHZhciBub2RlQXJncyA9IGFycmF5X3NsaWNlKGFyZ3VtZW50cywgMik7XG4gICAgdmFyIGRlZmVycmVkID0gZGVmZXIoKTtcbiAgICBub2RlQXJncy5wdXNoKGRlZmVycmVkLm1ha2VOb2RlUmVzb2x2ZXIoKSk7XG4gICAgUShvYmplY3QpLmRpc3BhdGNoKFwicG9zdFwiLCBbbmFtZSwgbm9kZUFyZ3NdKS5mYWlsKGRlZmVycmVkLnJlamVjdCk7XG4gICAgcmV0dXJuIGRlZmVycmVkLnByb21pc2U7XG59O1xuXG5Qcm9taXNlLnByb3RvdHlwZS5uc2VuZCA9IC8vIFhYWCBCYXNlZCBvbiBNYXJrIE1pbGxlcidzIHByb3Bvc2VkIFwic2VuZFwiXG5Qcm9taXNlLnByb3RvdHlwZS5ubWNhbGwgPSAvLyBYWFggQmFzZWQgb24gXCJSZWRzYW5kcm8nc1wiIHByb3Bvc2FsXG5Qcm9taXNlLnByb3RvdHlwZS5uaW52b2tlID0gZnVuY3Rpb24gKG5hbWUgLyouLi5hcmdzKi8pIHtcbiAgICB2YXIgbm9kZUFyZ3MgPSBhcnJheV9zbGljZShhcmd1bWVudHMsIDEpO1xuICAgIHZhciBkZWZlcnJlZCA9IGRlZmVyKCk7XG4gICAgbm9kZUFyZ3MucHVzaChkZWZlcnJlZC5tYWtlTm9kZVJlc29sdmVyKCkpO1xuICAgIHRoaXMuZGlzcGF0Y2goXCJwb3N0XCIsIFtuYW1lLCBub2RlQXJnc10pLmZhaWwoZGVmZXJyZWQucmVqZWN0KTtcbiAgICByZXR1cm4gZGVmZXJyZWQucHJvbWlzZTtcbn07XG5cbi8qKlxuICogSWYgYSBmdW5jdGlvbiB3b3VsZCBsaWtlIHRvIHN1cHBvcnQgYm90aCBOb2RlIGNvbnRpbnVhdGlvbi1wYXNzaW5nLXN0eWxlIGFuZFxuICogcHJvbWlzZS1yZXR1cm5pbmctc3R5bGUsIGl0IGNhbiBlbmQgaXRzIGludGVybmFsIHByb21pc2UgY2hhaW4gd2l0aFxuICogYG5vZGVpZnkobm9kZWJhY2spYCwgZm9yd2FyZGluZyB0aGUgb3B0aW9uYWwgbm9kZWJhY2sgYXJndW1lbnQuICBJZiB0aGUgdXNlclxuICogZWxlY3RzIHRvIHVzZSBhIG5vZGViYWNrLCB0aGUgcmVzdWx0IHdpbGwgYmUgc2VudCB0aGVyZS4gIElmIHRoZXkgZG8gbm90XG4gKiBwYXNzIGEgbm9kZWJhY2ssIHRoZXkgd2lsbCByZWNlaXZlIHRoZSByZXN1bHQgcHJvbWlzZS5cbiAqIEBwYXJhbSBvYmplY3QgYSByZXN1bHQgKG9yIGEgcHJvbWlzZSBmb3IgYSByZXN1bHQpXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBub2RlYmFjayBhIE5vZGUuanMtc3R5bGUgY2FsbGJhY2tcbiAqIEByZXR1cm5zIGVpdGhlciB0aGUgcHJvbWlzZSBvciBub3RoaW5nXG4gKi9cblEubm9kZWlmeSA9IG5vZGVpZnk7XG5mdW5jdGlvbiBub2RlaWZ5KG9iamVjdCwgbm9kZWJhY2spIHtcbiAgICByZXR1cm4gUShvYmplY3QpLm5vZGVpZnkobm9kZWJhY2spO1xufVxuXG5Qcm9taXNlLnByb3RvdHlwZS5ub2RlaWZ5ID0gZnVuY3Rpb24gKG5vZGViYWNrKSB7XG4gICAgaWYgKG5vZGViYWNrKSB7XG4gICAgICAgIHRoaXMudGhlbihmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgIFEubmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIG5vZGViYWNrKG51bGwsIHZhbHVlKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9LCBmdW5jdGlvbiAoZXJyb3IpIHtcbiAgICAgICAgICAgIFEubmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgIG5vZGViYWNrKGVycm9yKTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG59O1xuXG5RLm5vQ29uZmxpY3QgPSBmdW5jdGlvbigpIHtcbiAgICB0aHJvdyBuZXcgRXJyb3IoXCJRLm5vQ29uZmxpY3Qgb25seSB3b3JrcyB3aGVuIFEgaXMgdXNlZCBhcyBhIGdsb2JhbFwiKTtcbn07XG5cbi8vIEFsbCBjb2RlIGJlZm9yZSB0aGlzIHBvaW50IHdpbGwgYmUgZmlsdGVyZWQgZnJvbSBzdGFjayB0cmFjZXMuXG52YXIgcUVuZGluZ0xpbmUgPSBjYXB0dXJlTGluZSgpO1xuXG5yZXR1cm4gUTtcblxufSk7XG4iLCIvLyBDb3B5cmlnaHQgMjAxMy0yMDE0IEtldmluIENveFxuXG4vKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiogIFRoaXMgc29mdHdhcmUgaXMgcHJvdmlkZWQgJ2FzLWlzJywgd2l0aG91dCBhbnkgZXhwcmVzcyBvciBpbXBsaWVkICAgICAgICAgICAqXG4qICB3YXJyYW50eS4gSW4gbm8gZXZlbnQgd2lsbCB0aGUgYXV0aG9ycyBiZSBoZWxkIGxpYWJsZSBmb3IgYW55IGRhbWFnZXMgICAgICAgKlxuKiAgYXJpc2luZyBmcm9tIHRoZSB1c2Ugb2YgdGhpcyBzb2Z0d2FyZS4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4qICBQZXJtaXNzaW9uIGlzIGdyYW50ZWQgdG8gYW55b25lIHRvIHVzZSB0aGlzIHNvZnR3YXJlIGZvciBhbnkgcHVycG9zZSwgICAgICAgKlxuKiAgaW5jbHVkaW5nIGNvbW1lcmNpYWwgYXBwbGljYXRpb25zLCBhbmQgdG8gYWx0ZXIgaXQgYW5kIHJlZGlzdHJpYnV0ZSBpdCAgICAgICpcbiogIGZyZWVseSwgc3ViamVjdCB0byB0aGUgZm9sbG93aW5nIHJlc3RyaWN0aW9uczogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4qICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKlxuKiAgMS4gVGhlIG9yaWdpbiBvZiB0aGlzIHNvZnR3YXJlIG11c3Qgbm90IGJlIG1pc3JlcHJlc2VudGVkOyB5b3UgbXVzdCBub3QgICAgICpcbiogICAgIGNsYWltIHRoYXQgeW91IHdyb3RlIHRoZSBvcmlnaW5hbCBzb2Z0d2FyZS4gSWYgeW91IHVzZSB0aGlzIHNvZnR3YXJlIGluICAqXG4qICAgICBhIHByb2R1Y3QsIGFuIGFja25vd2xlZGdtZW50IGluIHRoZSBwcm9kdWN0IGRvY3VtZW50YXRpb24gd291bGQgYmUgICAgICAgKlxuKiAgICAgYXBwcmVjaWF0ZWQgYnV0IGlzIG5vdCByZXF1aXJlZC4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4qICAyLiBBbHRlcmVkIHNvdXJjZSB2ZXJzaW9ucyBtdXN0IGJlIHBsYWlubHkgbWFya2VkIGFzIHN1Y2gsIGFuZCBtdXN0IG5vdCBiZSAgKlxuKiAgICAgbWlzcmVwcmVzZW50ZWQgYXMgYmVpbmcgdGhlIG9yaWdpbmFsIHNvZnR3YXJlLiAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbiogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAqXG4qICAzLiBUaGlzIG5vdGljZSBtYXkgbm90IGJlIHJlbW92ZWQgb3IgYWx0ZXJlZCBmcm9tIGFueSBzb3VyY2UgZGlzdHJpYnV0aW9uLiAgKlxuKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICpcbioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG5cbitmdW5jdGlvbigpe1xuXCJ1c2Ugc3RyaWN0XCI7XG5cbnZhciBhcnJheSA9IC9cXFsoW15cXFtdKilcXF0kLztcblxuLy8vIFVSTCBSZWdleC5cbi8qKlxuICogVGhpcyByZWdleCBzcGxpdHMgdGhlIFVSTCBpbnRvIHBhcnRzLiAgVGhlIGNhcHR1cmUgZ3JvdXBzIGNhdGNoIHRoZSBpbXBvcnRhbnRcbiAqIGJpdHMuXG4gKiBcbiAqIEVhY2ggc2VjdGlvbiBpcyBvcHRpb25hbCwgc28gdG8gd29yayBvbiBhbnkgcGFydCBmaW5kIHRoZSBjb3JyZWN0IHRvcCBsZXZlbFxuICogYCguLi4pP2AgYW5kIG1lc3MgYXJvdW5kIHdpdGggaXQuXG4gKi9cbnZhciByZWdleCA9IC9eKD86KFthLXpdKik6KT8oPzpcXC9cXC8pPyg/OihbXjpAXSopKD86OihbXkBdKikpP0ApPyhbYS16LS5fXSspPyg/OjooWzAtOV0qKSk/KFxcL1tePyNdKik/KD86XFw/KFteI10qKSk/KD86IyguKikpPyQvaTtcbi8vICAgICAgICAgICAgICAgMSAtIHNjaGVtZSAgICAgICAgICAgICAgICAyIC0gdXNlciAgICAzID0gcGFzcyA0IC0gaG9zdCAgICAgICAgNSAtIHBvcnQgIDYgLSBwYXRoICAgICAgICA3IC0gcXVlcnkgICAgOCAtIGhhc2hcblxudmFyIG5vc2xhc2ggPSBbXCJtYWlsdG9cIixcImJpdGNvaW5cIl07XG5cbnZhciBzZWxmID0ge1xuXHQvKiogUGFyc2UgYSBxdWVyeSBzdHJpbmcuXG5cdCAqXG5cdCAqIFRoaXMgZnVuY3Rpb24gcGFyc2VzIGEgcXVlcnkgc3RyaW5nIChzb21ldGltZXMgY2FsbGVkIHRoZSBzZWFyY2hcblx0ICogc3RyaW5nKS4gIEl0IHRha2VzIGEgcXVlcnkgc3RyaW5nIGFuZCByZXR1cm5zIGEgbWFwIG9mIHRoZSByZXN1bHRzLlxuXHQgKlxuXHQgKiBLZXlzIGFyZSBjb25zaWRlcmVkIHRvIGJlIGV2ZXJ5dGhpbmcgdXAgdG8gdGhlIGZpcnN0ICc9JyBhbmQgdmFsdWVzIGFyZVxuXHQgKiBldmVyeXRoaW5nIGFmdGVyd29yZHMuICBTaW5jZSBVUkwtZGVjb2RpbmcgaXMgZG9uZSBhZnRlciBwYXJzaW5nLCBrZXlzXG5cdCAqIGFuZCB2YWx1ZXMgY2FuIGhhdmUgYW55IHZhbHVlcywgaG93ZXZlciwgJz0nIGhhdmUgdG8gYmUgZW5jb2RlZCBpbiBrZXlzXG5cdCAqIHdoaWxlICc/JyBhbmQgJyYnIGhhdmUgdG8gYmUgZW5jb2RlZCBhbnl3aGVyZSAoYXMgdGhleSBkZWxpbWl0IHRoZVxuXHQgKiBrdi1wYWlycykuXG5cdCAqXG5cdCAqIEtleXMgYW5kIHZhbHVlcyB3aWxsIGFsd2F5cyBiZSBzdHJpbmdzLCBleGNlcHQgaWYgdGhlcmUgaXMgYSBrZXkgd2l0aCBub1xuXHQgKiAnPScgaW4gd2hpY2ggY2FzZSBpdCB3aWxsIGJlIGNvbnNpZGVyZWQgYSBmbGFnIGFuZCB3aWxsIGJlIHNldCB0byB0cnVlLlxuXHQgKiBMYXRlciB2YWx1ZXMgd2lsbCBvdmVycmlkZSBlYXJsaWVyIHZhbHVlcy5cblx0ICpcblx0ICogQXJyYXkga2V5cyBhcmUgYWxzbyBzdXBwb3J0ZWQuICBCeSBkZWZhdWx0IGtleXMgaW4gdGhlIGZvcm0gb2YgYG5hbWVbaV1gXG5cdCAqIHdpbGwgYmUgcmV0dXJuZWQgbGlrZSB0aGF0IGFzIHN0cmluZ3MuICBIb3dldmVyLCBpZiB5b3Ugc2V0IHRoZSBgYXJyYXlgXG5cdCAqIGZsYWcgaW4gdGhlIG9wdGlvbnMgb2JqZWN0IHRoZXkgd2lsbCBiZSBwYXJzZWQgaW50byBhcnJheXMuICBOb3RlIHRoYXRcblx0ICogYWx0aG91Z2ggdGhlIG9iamVjdCByZXR1cm5lZCBpcyBhbiBgQXJyYXlgIG9iamVjdCBhbGwga2V5cyB3aWxsIGJlXG5cdCAqIHdyaXR0ZW4gdG8gaXQuICBUaGlzIG1lYW5zIHRoYXQgaWYgeW91IGhhdmUgYSBrZXkgc3VjaCBhcyBga1tmb3JFYWNoXWBcblx0ICogaXQgd2lsbCBvdmVyd3JpdGUgdGhlIGBmb3JFYWNoYCBmdW5jdGlvbiBvbiB0aGF0IGFycmF5LiAgQWxzbyBub3RlIHRoYXRcblx0ICogc3RyaW5nIHByb3BlcnRpZXMgYWx3YXlzIHRha2UgcHJlY2VkZW5jZSBvdmVyIGFycmF5IHByb3BlcnRpZXMsXG5cdCAqIGlycmVzcGVjdGl2ZSBvZiB3aGVyZSB0aGV5IGFyZSBpbiB0aGUgcXVlcnkgc3RyaW5nLlxuXHQgKlxuXHQgKiAgIHVybC5nZXQoXCJhcnJheVsxXT10ZXN0JmFycmF5W2Zvb109YmFyXCIse2FycmF5OnRydWV9KS5hcnJheVsxXSAgPT09IFwidGVzdFwiXG5cdCAqICAgdXJsLmdldChcImFycmF5WzFdPXRlc3QmYXJyYXlbZm9vXT1iYXJcIix7YXJyYXk6dHJ1ZX0pLmFycmF5LmZvbyA9PT0gXCJiYXJcIlxuXHQgKiAgIHVybC5nZXQoXCJhcnJheT1ub3RhbmFycmF5JmFycmF5WzBdPTFcIix7YXJyYXk6dHJ1ZX0pLmFycmF5ICAgICAgPT09IFwibm90YW5hcnJheVwiXG5cdCAqXG5cdCAqIElmIGFycmF5IHBhcnNpbmcgaXMgZW5hYmxlZCBrZXlzIGluIHRoZSBmb3JtIG9mIGBuYW1lW11gIHdpbGxcblx0ICogYXV0b21hdGljYWxseSBiZSBnaXZlbiB0aGUgbmV4dCBhdmFpbGFibGUgaW5kZXguICBOb3RlIHRoYXQgdGhpcyBjYW4gYmVcblx0ICogb3ZlcndyaXR0ZW4gd2l0aCBsYXRlciB2YWx1ZXMgaW4gdGhlIHF1ZXJ5IHN0cmluZy4gIEZvciB0aGlzIHJlYXNvbiBpc1xuXHQgKiBpcyBiZXN0IG5vdCB0byBtaXggdGhlIHR3byBmb3JtYXRzLCBhbHRob3VnaCBpdCBpcyBzYWZlIChhbmQgb2Z0ZW5cblx0ICogdXNlZnVsKSB0byBhZGQgYW4gYXV0b21hdGljIGluZGV4IGFyZ3VtZW50IHRvIHRoZSBlbmQgb2YgYSBxdWVyeSBzdHJpbmcuXG5cdCAqXG5cdCAqICAgdXJsLmdldChcImFbXT0wJmFbXT0xJmFbMF09MlwiLCB7YXJyYXk6dHJ1ZX0pICAtPiB7YTpbXCIyXCIsXCIxXCJdfTtcblx0ICogICB1cmwuZ2V0KFwiYVswXT0wJmFbMV09MSZhW109MlwiLCB7YXJyYXk6dHJ1ZX0pIC0+IHthOltcIjBcIixcIjFcIixcIjJcIl19O1xuXHQgKlxuXHQgKiBAcGFyYW17c3RyaW5nfSBxIFRoZSBxdWVyeSBzdHJpbmcgKHRoZSBwYXJ0IGFmdGVyIHRoZSAnPycpLlxuXHQgKiBAcGFyYW17e2Z1bGw6Ym9vbGVhbixhcnJheTpib29sZWFufT19IG9wdCBPcHRpb25zLlxuXHQgKlxuXHQgKiAtIGZ1bGw6IElmIHNldCBgcWAgd2lsbCBiZSB0cmVhdGVkIGFzIGEgZnVsbCB1cmwgYW5kIGBxYCB3aWxsIGJlIGJ1aWx0LlxuXHQgKiAgIGJ5IGNhbGxpbmcgI3BhcnNlIHRvIHJldHJpZXZlIHRoZSBxdWVyeSBwb3J0aW9uLlxuXHQgKiAtIGFycmF5OiBJZiBzZXQga2V5cyBpbiB0aGUgZm9ybSBvZiBga2V5W2ldYCB3aWxsIGJlIHRyZWF0ZWRcblx0ICogICBhcyBhcnJheXMvbWFwcy5cblx0ICpcblx0ICogQHJldHVybnshT2JqZWN0LjxzdHJpbmcsIHN0cmluZ3xBcnJheT59IFRoZSBwYXJzZWQgcmVzdWx0LlxuXHQgKi9cblx0XCJnZXRcIjogZnVuY3Rpb24ocSwgb3B0KXtcblx0XHRxID0gcSB8fCBcIlwiO1xuXHRcdGlmICggdHlwZW9mIG9wdCAgICAgICAgICA9PSBcInVuZGVmaW5lZFwiICkgb3B0ID0ge307XG5cdFx0aWYgKCB0eXBlb2Ygb3B0W1wiZnVsbFwiXSAgPT0gXCJ1bmRlZmluZWRcIiApIG9wdFtcImZ1bGxcIl0gPSBmYWxzZTtcblx0XHRpZiAoIHR5cGVvZiBvcHRbXCJhcnJheVwiXSA9PSBcInVuZGVmaW5lZFwiICkgb3B0W1wiYXJyYXlcIl0gPSBmYWxzZTtcblx0XHRcblx0XHRpZiAoIG9wdFtcImZ1bGxcIl0gPT09IHRydWUgKVxuXHRcdHtcblx0XHRcdHEgPSBzZWxmW1wicGFyc2VcIl0ocSwge1wiZ2V0XCI6ZmFsc2V9KVtcInF1ZXJ5XCJdIHx8IFwiXCI7XG5cdFx0fVxuXHRcdFxuXHRcdHZhciBvID0ge307XG5cdFx0XG5cdFx0dmFyIGMgPSBxLnNwbGl0KFwiJlwiKTtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGMubGVuZ3RoOyBpKyspXG5cdFx0e1xuXHRcdFx0aWYgKCFjW2ldLmxlbmd0aCkgY29udGludWU7XG5cdFx0XHRcblx0XHRcdHZhciBkID0gY1tpXS5pbmRleE9mKFwiPVwiKTtcblx0XHRcdHZhciBrID0gY1tpXSwgdiA9IHRydWU7XG5cdFx0XHRpZiAoIGQgPj0gMCApXG5cdFx0XHR7XG5cdFx0XHRcdGsgPSBjW2ldLnN1YnN0cigwLCBkKTtcblx0XHRcdFx0diA9IGNbaV0uc3Vic3RyKGQrMSk7XG5cdFx0XHRcdFxuXHRcdFx0XHR2ID0gZGVjb2RlVVJJQ29tcG9uZW50KHYpO1xuXHRcdFx0fVxuXHRcdFx0XG5cdFx0XHRpZiAob3B0W1wiYXJyYXlcIl0pXG5cdFx0XHR7XG5cdFx0XHRcdHZhciBpbmRzID0gW107XG5cdFx0XHRcdHZhciBpbmQ7XG5cdFx0XHRcdHZhciBjdXJvID0gbztcblx0XHRcdFx0dmFyIGN1cmsgPSBrO1xuXHRcdFx0XHR3aGlsZSAoaW5kID0gY3Vyay5tYXRjaChhcnJheSkpIC8vIEFycmF5IVxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Y3VyayA9IGN1cmsuc3Vic3RyKDAsIGluZC5pbmRleCk7XG5cdFx0XHRcdFx0aW5kcy51bnNoaWZ0KGRlY29kZVVSSUNvbXBvbmVudChpbmRbMV0pKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjdXJrID0gZGVjb2RlVVJJQ29tcG9uZW50KGN1cmspO1xuXHRcdFx0XHRpZiAoaW5kcy5zb21lKGZ1bmN0aW9uKGkpXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZiAoIHR5cGVvZiBjdXJvW2N1cmtdID09IFwidW5kZWZpbmVkXCIgKSBjdXJvW2N1cmtdID0gW107XG5cdFx0XHRcdFx0aWYgKCFBcnJheS5pc0FycmF5KGN1cm9bY3Vya10pKVxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdC8vY29uc29sZS5sb2coXCJ1cmwuZ2V0OiBBcnJheSBwcm9wZXJ0eSBcIitjdXJrK1wiIGFscmVhZHkgZXhpc3RzIGFzIHN0cmluZyFcIik7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Y3VybyA9IGN1cm9bY3Vya107XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0aWYgKCBpID09PSBcIlwiICkgaSA9IGN1cm8ubGVuZ3RoO1xuXHRcdFx0XHRcdFxuXHRcdFx0XHRcdGN1cmsgPSBpO1xuXHRcdFx0XHR9KSkgY29udGludWU7XG5cdFx0XHRcdGN1cm9bY3Vya10gPSB2O1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblx0XHRcdFxuXHRcdFx0ayA9IGRlY29kZVVSSUNvbXBvbmVudChrKTtcblx0XHRcdFxuXHRcdFx0Ly90eXBlb2Ygb1trXSA9PSBcInVuZGVmaW5lZFwiIHx8IGNvbnNvbGUubG9nKFwiUHJvcGVydHkgXCIraytcIiBhbHJlYWR5IGV4aXN0cyFcIik7XG5cdFx0XHRvW2tdID0gdjtcblx0XHR9XG5cdFx0XG5cdFx0cmV0dXJuIG87XG5cdH0sXG5cdFxuXHQvKiogQnVpbGQgYSBnZXQgcXVlcnkgZnJvbSBhbiBvYmplY3QuXG5cdCAqXG5cdCAqIFRoaXMgY29uc3RydWN0cyBhIHF1ZXJ5IHN0cmluZyBmcm9tIHRoZSBrdiBwYWlycyBpbiBgZGF0YWAuICBDYWxsaW5nXG5cdCAqICNnZXQgb24gdGhlIHN0cmluZyByZXR1cm5lZCBzaG91bGQgcmV0dXJuIGFuIG9iamVjdCBpZGVudGljYWwgdG8gdGhlIG9uZVxuXHQgKiBwYXNzZWQgaW4gZXhjZXB0IGFsbCBub24tYm9vbGVhbiBzY2FsYXIgdHlwZXMgYmVjb21lIHN0cmluZ3MgYW5kIGFsbFxuXHQgKiBvYmplY3QgdHlwZXMgYmVjb21lIGFycmF5cyAobm9uLWludGVnZXIga2V5cyBhcmUgc3RpbGwgcHJlc2VudCwgc2VlXG5cdCAqICNnZXQncyBkb2N1bWVudGF0aW9uIGZvciBtb3JlIGRldGFpbHMpLlxuXHQgKlxuXHQgKiBUaGlzIGFsd2F5cyB1c2VzIGFycmF5IHN5bnRheCBmb3IgZGVzY3JpYmluZyBhcnJheXMuICBJZiB5b3Ugd2FudCB0b1xuXHQgKiBzZXJpYWxpemUgdGhlbSBkaWZmZXJlbnRseSAobGlrZSBoYXZpbmcgdGhlIHZhbHVlIGJlIGEgSlNPTiBhcnJheSBhbmRcblx0ICogaGF2ZSBhIHBsYWluIGtleSkgeW91IHdpbGwgbmVlZCB0byBkbyB0aGF0IGJlZm9yZSBwYXNzaW5nIGl0IGluLlxuXHQgKlxuXHQgKiBBbGwga2V5cyBhbmQgdmFsdWVzIGFyZSBzdXBwb3J0ZWQgKGJpbmFyeSBkYXRhIGFueW9uZT8pIGFzIHRoZXkgYXJlXG5cdCAqIHByb3Blcmx5IFVSTC1lbmNvZGVkIGFuZCAjZ2V0IHByb3Blcmx5IGRlY29kZXMuXG5cdCAqXG5cdCAqIEBwYXJhbXtPYmplY3R9IGRhdGEgVGhlIGt2IHBhaXJzLlxuXHQgKiBAcGFyYW17c3RyaW5nfSBwcmVmaXggVGhlIHByb3Blcmx5IGVuY29kZWQgYXJyYXkga2V5IHRvIHB1dCB0aGVcblx0ICogICBwcm9wZXJ0aWVzLiAgTWFpbmx5IGludGVuZGVkIGZvciBpbnRlcm5hbCB1c2UuXG5cdCAqIEByZXR1cm57c3RyaW5nfSBBIFVSTC1zYWZlIHN0cmluZy5cblx0ICovXG5cdFwiYnVpbGRnZXRcIjogZnVuY3Rpb24oZGF0YSwgcHJlZml4KXtcblx0XHR2YXIgaXRtcyA9IFtdO1xuXHRcdGZvciAoIHZhciBrIGluIGRhdGEgKVxuXHRcdHtcblx0XHRcdHZhciBlayA9IGVuY29kZVVSSUNvbXBvbmVudChrKTtcblx0XHRcdGlmICggdHlwZW9mIHByZWZpeCAhPSBcInVuZGVmaW5lZFwiIClcblx0XHRcdFx0ZWsgPSBwcmVmaXgrXCJbXCIrZWsrXCJdXCI7XG5cdFx0XHRcblx0XHRcdHZhciB2ID0gZGF0YVtrXTtcblx0XHRcdFxuXHRcdFx0c3dpdGNoICh0eXBlb2Ygdilcblx0XHRcdHtcblx0XHRcdFx0Y2FzZSAnYm9vbGVhbic6XG5cdFx0XHRcdFx0aWYodikgaXRtcy5wdXNoKGVrKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAnbnVtYmVyJzpcblx0XHRcdFx0XHR2ID0gdi50b1N0cmluZygpO1xuXHRcdFx0XHRjYXNlICdzdHJpbmcnOlxuXHRcdFx0XHRcdGl0bXMucHVzaChlaytcIj1cIitlbmNvZGVVUklDb21wb25lbnQodikpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdvYmplY3QnOlxuXHRcdFx0XHRcdGl0bXMucHVzaChzZWxmW1wiYnVpbGRnZXRcIl0odiwgZWspKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGl0bXMuam9pbihcIiZcIik7XG5cdH0sXG5cdFxuXHQvKiogUGFyc2UgYSBVUkxcblx0ICogXG5cdCAqIFRoaXMgYnJlYWtzIHVwIGEgVVJMIGludG8gY29tcG9uZW50cy4gIEl0IGF0dGVtcHRzIHRvIGJlIHZlcnkgbGliZXJhbFxuXHQgKiBhbmQgcmV0dXJucyB0aGUgYmVzdCByZXN1bHQgaW4gbW9zdCBjYXNlcy4gIFRoaXMgbWVhbnMgdGhhdCB5b3UgY2FuXG5cdCAqIG9mdGVuIHBhc3MgaW4gcGFydCBvZiBhIFVSTCBhbmQgZ2V0IGNvcnJlY3QgY2F0ZWdvcmllcyBiYWNrLiAgTm90YWJseSxcblx0ICogdGhpcyB3b3JrcyBmb3IgZW1haWxzIGFuZCBKYWJiZXIgSURzLCBhcyB3ZWxsIGFzIGFkZGluZyBhICc/JyB0byB0aGVcblx0ICogYmVnaW5uaW5nIG9mIGEgc3RyaW5nIHdpbGwgcGFyc2UgdGhlIHdob2xlIHRoaW5nIGFzIGEgcXVlcnkgc3RyaW5nLiAgSWZcblx0ICogYW4gaXRlbSBpcyBub3QgZm91bmQgdGhlIHByb3BlcnR5IHdpbGwgYmUgdW5kZWZpbmVkLiAgSW4gc29tZSBjYXNlcyBhblxuXHQgKiBlbXB0eSBzdHJpbmcgd2lsbCBiZSByZXR1cm5lZCBpZiB0aGUgc3Vycm91bmRpbmcgc3ludGF4IGJ1dCB0aGUgYWN0dWFsXG5cdCAqIHZhbHVlIGlzIGVtcHR5IChleGFtcGxlOiBcIjovL2V4YW1wbGUuY29tXCIgd2lsbCBnaXZlIGEgZW1wdHkgc3RyaW5nIGZvclxuXHQgKiBzY2hlbWUuKSAgTm90YWJseSB0aGUgaG9zdCBuYW1lIHdpbGwgYWx3YXlzIGJlIHNldCB0byBzb21ldGhpbmcuXG5cdCAqIFxuXHQgKiBSZXR1cm5lZCBwcm9wZXJ0aWVzLlxuXHQgKiBcblx0ICogLSAqKnNjaGVtZToqKiBUaGUgdXJsIHNjaGVtZS4gKGV4OiBcIm1haWx0b1wiIG9yIFwiaHR0cHNcIilcblx0ICogLSAqKnVzZXI6KiogVGhlIHVzZXJuYW1lLlxuXHQgKiAtICoqcGFzczoqKiBUaGUgcGFzc3dvcmQuXG5cdCAqIC0gKipob3N0OioqIFRoZSBob3N0bmFtZS4gKGV4OiBcImxvY2FsaG9zdFwiLCBcIjEyMy40NTYuNy44XCIgb3IgXCJleGFtcGxlLmNvbVwiKVxuXHQgKiAtICoqcG9ydDoqKiBUaGUgcG9ydCwgYXMgYSBudW1iZXIuIChleDogMTMzNylcblx0ICogLSAqKnBhdGg6KiogVGhlIHBhdGguIChleDogXCIvXCIgb3IgXCIvYWJvdXQuaHRtbFwiKVxuXHQgKiAtICoqcXVlcnk6KiogXCJUaGUgcXVlcnkgc3RyaW5nLiAoZXg6IFwiZm9vPWJhciZ2PTE3JmZvcm1hdD1qc29uXCIpXG5cdCAqIC0gKipnZXQ6KiogVGhlIHF1ZXJ5IHN0cmluZyBwYXJzZWQgd2l0aCBnZXQuICBJZiBgb3B0LmdldGAgaXMgYGZhbHNlYCB0aGlzXG5cdCAqICAgd2lsbCBiZSBhYnNlbnRcblx0ICogLSAqKmhhc2g6KiogVGhlIHZhbHVlIGFmdGVyIHRoZSBoYXNoLiAoZXg6IFwibXlhbmNob3JcIilcblx0ICogICBiZSB1bmRlZmluZWQgZXZlbiBpZiBgcXVlcnlgIGlzIHNldC5cblx0ICpcblx0ICogQHBhcmFte3N0cmluZ30gdXJsIFRoZSBVUkwgdG8gcGFyc2UuXG5cdCAqIEBwYXJhbXt7Z2V0Ok9iamVjdH09fSBvcHQgT3B0aW9uczpcblx0ICpcblx0ICogLSBnZXQ6IEFuIG9wdGlvbnMgYXJndW1lbnQgdG8gYmUgcGFzc2VkIHRvICNnZXQgb3IgZmFsc2UgdG8gbm90IGNhbGwgI2dldC5cblx0ICogICAgKipETyBOT1QqKiBzZXQgYGZ1bGxgLlxuXHQgKlxuXHQgKiBAcmV0dXJueyFPYmplY3R9IEFuIG9iamVjdCB3aXRoIHRoZSBwYXJzZWQgdmFsdWVzLlxuXHQgKi9cblx0XCJwYXJzZVwiOiBmdW5jdGlvbih1cmwsIG9wdCkge1xuXHRcdFxuXHRcdGlmICggdHlwZW9mIG9wdCA9PSBcInVuZGVmaW5lZFwiICkgb3B0ID0ge307XG5cdFx0XG5cdFx0dmFyIG1kID0gdXJsLm1hdGNoKHJlZ2V4KSB8fCBbXTtcblx0XHRcblx0XHR2YXIgciA9IHtcblx0XHRcdFwidXJsXCI6ICAgIHVybCxcblx0XHRcdFxuXHRcdFx0XCJzY2hlbWVcIjogbWRbMV0sXG5cdFx0XHRcInVzZXJcIjogICBtZFsyXSxcblx0XHRcdFwicGFzc1wiOiAgIG1kWzNdLFxuXHRcdFx0XCJob3N0XCI6ICAgbWRbNF0sXG5cdFx0XHRcInBvcnRcIjogICBtZFs1XSAmJiArbWRbNV0sXG5cdFx0XHRcInBhdGhcIjogICBtZFs2XSxcblx0XHRcdFwicXVlcnlcIjogIG1kWzddLFxuXHRcdFx0XCJoYXNoXCI6ICAgbWRbOF0sXG5cdFx0fTtcblx0XHRcblx0XHRpZiAoIG9wdC5nZXQgIT09IGZhbHNlIClcblx0XHRcdHJbXCJnZXRcIl0gPSByW1wicXVlcnlcIl0gJiYgc2VsZltcImdldFwiXShyW1wicXVlcnlcIl0sIG9wdC5nZXQpO1xuXHRcdFxuXHRcdHJldHVybiByO1xuXHR9LFxuXHRcblx0LyoqIEJ1aWxkIGEgVVJMIGZyb20gY29tcG9uZW50cy5cblx0ICogXG5cdCAqIFRoaXMgcGllY2VzIHRvZ2V0aGVyIGEgdXJsIGZyb20gdGhlIHByb3BlcnRpZXMgb2YgdGhlIHBhc3NlZCBpbiBvYmplY3QuXG5cdCAqIEluIGdlbmVyYWwgcGFzc2luZyB0aGUgcmVzdWx0IG9mIGBwYXJzZSgpYCBzaG91bGQgcmV0dXJuIHRoZSBVUkwuICBUaGVyZVxuXHQgKiBtYXkgZGlmZmVyZW5jZXMgaW4gdGhlIGdldCBzdHJpbmcgYXMgdGhlIGtleXMgYW5kIHZhbHVlcyBtaWdodCBiZSBtb3JlXG5cdCAqIGVuY29kZWQgdGhlbiB0aGV5IHdlcmUgb3JpZ2luYWxseSB3ZXJlLiAgSG93ZXZlciwgY2FsbGluZyBgZ2V0KClgIG9uIHRoZVxuXHQgKiB0d28gdmFsdWVzIHNob3VsZCB5aWVsZCB0aGUgc2FtZSByZXN1bHQuXG5cdCAqIFxuXHQgKiBIZXJlIGlzIGhvdyB0aGUgcGFyYW1ldGVycyBhcmUgdXNlZC5cblx0ICogXG5cdCAqICAtIHVybDogVXNlZCBvbmx5IGlmIG5vIG90aGVyIHZhbHVlcyBhcmUgcHJvdmlkZWQuICBJZiB0aGF0IGlzIHRoZSBjYXNlXG5cdCAqICAgICBgdXJsYCB3aWxsIGJlIHJldHVybmVkIHZlcmJhdGltLlxuXHQgKiAgLSBzY2hlbWU6IFVzZWQgaWYgZGVmaW5lZC5cblx0ICogIC0gdXNlcjogVXNlZCBpZiBkZWZpbmVkLlxuXHQgKiAgLSBwYXNzOiBVc2VkIGlmIGRlZmluZWQuXG5cdCAqICAtIGhvc3Q6IFVzZWQgaWYgZGVmaW5lZC5cblx0ICogIC0gcGF0aDogVXNlZCBpZiBkZWZpbmVkLlxuXHQgKiAgLSBxdWVyeTogVXNlZCBvbmx5IGlmIGBnZXRgIGlzIG5vdCBwcm92aWRlZCBhbmQgbm9uLWVtcHR5LlxuXHQgKiAgLSBnZXQ6IFVzZWQgaWYgbm9uLWVtcHR5LiAgUGFzc2VkIHRvICNidWlsZGdldCBhbmQgdGhlIHJlc3VsdCBpcyB1c2VkXG5cdCAqICAgIGFzIHRoZSBxdWVyeSBzdHJpbmcuXG5cdCAqICAtIGhhc2g6IFVzZWQgaWYgZGVmaW5lZC5cblx0ICogXG5cdCAqIFRoZXNlIGFyZSB0aGUgb3B0aW9ucyB0aGF0IGFyZSB2YWxpZCBvbiB0aGUgb3B0aW9ucyBvYmplY3QuXG5cdCAqIFxuXHQgKiAgLSB1c2VlbXB0eWdldDogSWYgdHJ1dGh5LCBhIHF1ZXN0aW9uIG1hcmsgd2lsbCBiZSBhcHBlbmRlZCBmb3IgZW1wdHkgZ2V0XG5cdCAqICAgIHN0cmluZ3MuICBUaGlzIG5vdGFibHkgbWFrZXMgYGJ1aWxkKClgIGFuZCBgcGFyc2UoKWAgZnVsbHkgc3ltbWV0cmljLlxuXHQgKlxuXHQgKiBAcGFyYW17T2JqZWN0fSBkYXRhIFRoZSBwaWVjZXMgb2YgdGhlIFVSTC5cblx0ICogQHBhcmFte09iamVjdH0gb3B0IE9wdGlvbnMgZm9yIGJ1aWxkaW5nIHRoZSB1cmwuXG5cdCAqIEByZXR1cm57c3RyaW5nfSBUaGUgVVJMLlxuXHQgKi9cblx0XCJidWlsZFwiOiBmdW5jdGlvbihkYXRhLCBvcHQpe1xuXHRcdG9wdCA9IG9wdCB8fCB7fTtcblx0XHRcblx0XHR2YXIgciA9IFwiXCI7XG5cdFx0XG5cdFx0aWYgKCB0eXBlb2YgZGF0YVtcInNjaGVtZVwiXSAhPSBcInVuZGVmaW5lZFwiIClcblx0XHR7XG5cdFx0XHRyICs9IGRhdGFbXCJzY2hlbWVcIl07XG5cdFx0XHRyICs9IChub3NsYXNoLmluZGV4T2YoZGF0YVtcInNjaGVtZVwiXSk+PTApP1wiOlwiOlwiOi8vXCI7XG5cdFx0fVxuXHRcdGlmICggdHlwZW9mIGRhdGFbXCJ1c2VyXCJdICE9IFwidW5kZWZpbmVkXCIgKVxuXHRcdHtcblx0XHRcdHIgKz0gZGF0YVtcInVzZXJcIl07XG5cdFx0XHRpZiAoIHR5cGVvZiBkYXRhW1wicGFzc1wiXSA9PSBcInVuZGVmaW5lZFwiIClcblx0XHRcdHtcblx0XHRcdFx0ciArPSBcIkBcIjtcblx0XHRcdH1cblx0XHR9XG5cdFx0aWYgKCB0eXBlb2YgZGF0YVtcInBhc3NcIl0gIT0gXCJ1bmRlZmluZWRcIiApIHIgKz0gXCI6XCIgKyBkYXRhW1wicGFzc1wiXSArIFwiQFwiO1xuXHRcdGlmICggdHlwZW9mIGRhdGFbXCJob3N0XCJdICE9IFwidW5kZWZpbmVkXCIgKSByICs9IGRhdGFbXCJob3N0XCJdO1xuXHRcdGlmICggdHlwZW9mIGRhdGFbXCJwb3J0XCJdICE9IFwidW5kZWZpbmVkXCIgKSByICs9IFwiOlwiICsgZGF0YVtcInBvcnRcIl07XG5cdFx0aWYgKCB0eXBlb2YgZGF0YVtcInBhdGhcIl0gIT0gXCJ1bmRlZmluZWRcIiApIHIgKz0gZGF0YVtcInBhdGhcIl07XG5cdFx0XG5cdFx0aWYgKG9wdFtcInVzZWVtcHR5Z2V0XCJdKVxuXHRcdHtcblx0XHRcdGlmICAgICAgKCB0eXBlb2YgZGF0YVtcImdldFwiXSAgICE9IFwidW5kZWZpbmVkXCIgKSByICs9IFwiP1wiICsgc2VsZltcImJ1aWxkZ2V0XCJdKGRhdGFbXCJnZXRcIl0pO1xuXHRcdFx0ZWxzZSBpZiAoIHR5cGVvZiBkYXRhW1wicXVlcnlcIl0gIT0gXCJ1bmRlZmluZWRcIiApIHIgKz0gXCI/XCIgKyBkYXRhW1wicXVlcnlcIl07XG5cdFx0fVxuXHRcdGVsc2Vcblx0XHR7XG5cdFx0XHQvLyBJZiAuZ2V0IHVzZSBpdC4gIElmIC5nZXQgbGVhZHMgdG8gZW1wdHksIHVzZSAucXVlcnkuXG5cdFx0XHR2YXIgcSA9IGRhdGFbXCJnZXRcIl0gJiYgc2VsZltcImJ1aWxkZ2V0XCJdKGRhdGFbXCJnZXRcIl0pIHx8IGRhdGFbXCJxdWVyeVwiXTtcblx0XHRcdGlmIChxKSByICs9IFwiP1wiICsgcTtcblx0XHR9XG5cdFx0XG5cdFx0aWYgKCB0eXBlb2YgZGF0YVtcImhhc2hcIl0gIT0gXCJ1bmRlZmluZWRcIiApIHIgKz0gXCIjXCIgKyBkYXRhW1wiaGFzaFwiXTtcblx0XHRcblx0XHRyZXR1cm4gciB8fCBkYXRhW1widXJsXCJdIHx8IFwiXCI7XG5cdH0sXG59O1xuXG5pZiAoIHR5cGVvZiBkZWZpbmUgIT0gXCJ1bmRlZmluZWRcIiAmJiBkZWZpbmVbXCJhbWRcIl0gKSBkZWZpbmUoc2VsZik7XG5lbHNlIGlmICggdHlwZW9mIG1vZHVsZSAhPSBcInVuZGVmaW5lZFwiICkgbW9kdWxlWydleHBvcnRzJ10gPSBzZWxmO1xuZWxzZSB3aW5kb3dbXCJ1cmxcIl0gPSBzZWxmO1xuXG59KCk7XG4iLCIvKipcbiAqIE1vZHVsZSBmb3IgbWFuYWdpbmcgbW9kYWwgcHJvbXB0IGluc3RhbmNlcy5cbiAqIE5PVEU6IFRoaXMgbW9kdWxlIGlzIGN1cnJlbnRseSBsaW1pdGVkIGluIGEgbnVtYmVyXG4gKiAgICAgICBvZiB3YXlzLiBGb3Igb25lLCBpdCBvbmx5IGFsbG93cyByYWRpb1xuICogICAgICAgaW5wdXQgb3B0aW9ucy4gQWRkaXRpb25hbGx5LCBpdCBoYXJkLWNvZGVzIGluXG4gKiAgICAgICBhIG51bWJlciBvZiBvdGhlciBiZWhhdmlvcnMgd2hpY2ggYXJlIHNwZWNpZmljXG4gKiAgICAgICB0byB0aGUgaW1hZ2UgaW1wb3J0IHN0eWxlIHByb21wdCAoZm9yIHdoaWNoXG4gKiAgICAgICB0aGlzIG1vZHVsZSB3YXMgd3JpdHRlbikuXG4gKiAgICAgICBJZiBkZXNpcmVkLCB0aGlzIG1vZHVsZSBtYXkgYmUgbWFkZSBtb3JlXG4gKiAgICAgICBnZW5lcmFsLXB1cnBvc2UgaW4gdGhlIGZ1dHVyZSwgYnV0LCBmb3Igbm93LFxuICogICAgICAgYmUgYXdhcmUgb2YgdGhlc2UgbGltaXRhdGlvbnMuXG4gKi9cbmRlZmluZShcImNwby9tb2RhbC1wcm9tcHRcIiwgW1wicVwiXSwgZnVuY3Rpb24oUSkge1xuXG4gIGZ1bmN0aW9uIGF1dG9IaWdobGlnaHRCb3godGV4dCkge1xuICAgIHZhciB0ZXh0Qm94ID0gJChcIjxpbnB1dCB0eXBlPSd0ZXh0Jz5cIikuYWRkQ2xhc3MoXCJhdXRvLWhpZ2hsaWdodFwiKTtcbiAgICB0ZXh0Qm94LmF0dHIoXCJyZWFkb25seVwiLCBcInJlYWRvbmx5XCIpO1xuICAgIHRleHRCb3gub24oXCJmb2N1c1wiLCBmdW5jdGlvbigpIHsgJCh0aGlzKS5zZWxlY3QoKTsgfSk7XG4gICAgdGV4dEJveC5vbihcIm1vdXNldXBcIiwgZnVuY3Rpb24oKSB7ICQodGhpcykuc2VsZWN0KCk7IH0pO1xuICAgIHRleHRCb3gudmFsKHRleHQpO1xuICAgIHJldHVybiB0ZXh0Qm94O1xuXG5cbiAgfVxuXG4gIC8vIEFsbG93cyBhc3luY2hyb25vdXMgcmVxdWVzdGluZyBvZiBwcm9tcHRzXG4gIHZhciBwcm9tcHRRdWV1ZSA9IFEoKTtcbiAgdmFyIHN0eWxlcyA9IFtcbiAgICBcInJhZGlvXCIsIFwidGlsZXNcIiwgXCJ0ZXh0XCIsIFwiY29weVRleHRcIiwgXCJjb25maXJtXCJcbiAgXTtcblxuICB3aW5kb3cubW9kYWxzID0gW107XG5cbiAgLyoqXG4gICAqIFJlcHJlc2VudHMgYW4gb3B0aW9uIHRvIHByZXNlbnQgdGhlIHVzZXJcbiAgICogQHR5cGVkZWYge09iamVjdH0gTW9kYWxPcHRpb25cbiAgICogQHByb3BlcnR5IHtzdHJpbmd9IG1lc3NhZ2UgLSBUaGUgbWVzc2FnZSB0byBzaG93IHRoZSB1c2VyIHdoaWNoXG4gICAgICAgICAgICAgICBkZXNjcmliZXMgdGhpcyBvcHRpb25cbiAgICogQHByb3BlcnR5IHtzdHJpbmd9IHZhbHVlIC0gVGhlIHZhbHVlIHRvIHJldHVybiBpZiB0aGlzIG9wdGlvbiBpcyBjaG9zZW5cbiAgICogQHByb3BlcnR5IHtzdHJpbmd9IFtleGFtcGxlXSAtIEEgY29kZSBzbmlwcGV0IHRvIHNob3cgd2l0aCB0aGlzIG9wdGlvblxuICAgKi9cblxuICAvKipcbiAgICogQ29uc3RydWN0b3IgZm9yIG1vZGFsIHByb21wdHMuXG4gICAqIEBwYXJhbSB7TW9kYWxPcHRpb25bXX0gb3B0aW9ucyAtIFRoZSBvcHRpb25zIHRvIHByZXNlbnQgdGhlIHVzZXJcbiAgICovXG4gIGZ1bmN0aW9uIFByb21wdChvcHRpb25zKSB7XG4gICAgd2luZG93Lm1vZGFscy5wdXNoKHRoaXMpO1xuICAgIGlmICghb3B0aW9ucyB8fFxuICAgICAgICAoc3R5bGVzLmluZGV4T2Yob3B0aW9ucy5zdHlsZSkgPT09IC0xKSB8fFxuICAgICAgICAhb3B0aW9ucy5vcHRpb25zIHx8XG4gICAgICAgICh0eXBlb2Ygb3B0aW9ucy5vcHRpb25zLmxlbmd0aCAhPT0gXCJudW1iZXJcIikgfHwgKG9wdGlvbnMub3B0aW9ucy5sZW5ndGggPT09IDApKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoXCJJbnZhbGlkIFByb21wdCBPcHRpb25zXCIsIG9wdGlvbnMpO1xuICAgIH1cbiAgICB0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuICAgIHRoaXMubW9kYWwgPSAkKFwiI3Byb21wdE1vZGFsXCIpO1xuICAgIGlmICh0aGlzLm9wdGlvbnMuc3R5bGUgPT09IFwicmFkaW9cIikge1xuICAgICAgdGhpcy5lbHRzID0gJCgkLnBhcnNlSFRNTChcIjx0YWJsZT48L3RhYmxlPlwiKSkuYWRkQ2xhc3MoXCJjaG9pY2VDb250YWluZXJcIik7XG4gICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbnMuc3R5bGUgPT09IFwidGV4dFwiKSB7XG4gICAgICB0aGlzLmVsdHMgPSAkKFwiPGRpdj5cIikuYWRkQ2xhc3MoXCJjaG9pY2VDb250YWluZXJcIik7XG4gICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbnMuc3R5bGUgPT09IFwiY29weVRleHRcIikge1xuICAgICAgdGhpcy5lbHRzID0gJChcIjxkaXY+XCIpLmFkZENsYXNzKFwiY2hvaWNlQ29udGFpbmVyXCIpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25zLnN0eWxlID09PSBcImNvbmZpcm1cIikge1xuICAgICAgdGhpcy5lbHRzID0gJChcIjxkaXY+XCIpLmFkZENsYXNzKFwiY2hvaWNlQ29udGFpbmVyXCIpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmVsdHMgPSAkKCQucGFyc2VIVE1MKFwiPGRpdj48L2Rpdj5cIikpLmFkZENsYXNzKFwiY2hvaWNlQ29udGFpbmVyXCIpO1xuICAgIH1cbiAgICB0aGlzLnRpdGxlID0gJChcIi5tb2RhbC1oZWFkZXIgPiBoM1wiLCB0aGlzLm1vZGFsKTtcbiAgICB0aGlzLm1vZGFsQ29udGVudCA9ICQoXCIubW9kYWwtY29udGVudFwiLCB0aGlzLm1vZGFsKTtcbiAgICB0aGlzLmNsb3NlQnV0dG9uID0gJChcIi5jbG9zZVwiLCB0aGlzLm1vZGFsKTtcbiAgICB0aGlzLnN1Ym1pdEJ1dHRvbiA9ICQoXCIuc3VibWl0XCIsIHRoaXMubW9kYWwpO1xuICAgIGlmKHRoaXMub3B0aW9ucy5zdWJtaXRUZXh0KSB7XG4gICAgICB0aGlzLnN1Ym1pdEJ1dHRvbi50ZXh0KHRoaXMub3B0aW9ucy5zdWJtaXRUZXh0KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aGlzLnN1Ym1pdEJ1dHRvbi50ZXh0KFwiU3VibWl0XCIpO1xuICAgIH1cbiAgICBpZih0aGlzLm9wdGlvbnMuY2FuY2VsVGV4dCkge1xuICAgICAgdGhpcy5jbG9zZUJ1dHRvbi50ZXh0KHRoaXMub3B0aW9ucy5jYW5jZWxUZXh0KTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICB0aGlzLmNsb3NlQnV0dG9uLnRleHQoXCJDYW5jZWxcIik7XG4gICAgfVxuICAgIHRoaXMubW9kYWxDb250ZW50LnRvZ2dsZUNsYXNzKFwibmFycm93XCIsICEhdGhpcy5vcHRpb25zLm5hcnJvdyk7XG5cbiAgICB0aGlzLmlzQ29tcGlsZWQgPSBmYWxzZTtcbiAgICB0aGlzLmRlZmVycmVkID0gUS5kZWZlcigpO1xuICAgIHRoaXMucHJvbWlzZSA9IHRoaXMuZGVmZXJyZWQucHJvbWlzZTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUeXBlIGZvciBoYW5kbGVycyBvZiByZXNwb25zZXMgZnJvbSBtb2RhbCBwcm9tcHRzXG4gICAqIEBjYWxsYmFjayBwcm9tcHRDYWxsYmFja1xuICAgKiBAcGFyYW0ge3N0cmluZ30gcmVzcCAtIFRoZSByZXNwb25zZSBmcm9tIHRoZSB1c2VyXG4gICAqL1xuXG4gIC8qKlxuICAgKiBTaG93cyB0aGlzIHByb21wdCB0byB0aGUgdXNlciAod2lsbCB3YWl0IHVudGlsIGFueSBhY3RpdmVcbiAgICogcHJvbXB0cyBoYXZlIGZpbmlzaGVkKVxuICAgKiBAcGFyYW0ge3Byb21wdENhbGxiYWNrfSBbY2FsbGJhY2tdIC0gT3B0aW9uYWwgY2FsbGJhY2sgd2hpY2ggaXMgcGFzc2VkIHRoZVxuICAgKiAgICAgICAgcmVzdWx0IG9mIHRoZSBwcm9tcHRcbiAgICogQHJldHVybnMgQSBwcm9taXNlIHJlc29sdmluZyB0byBlaXRoZXIgdGhlIHJlc3VsdCBvZiBgY2FsbGJhY2tgLCBpZiBwcm92aWRlZCxcbiAgICogICAgICAgICAgb3IgdGhlIHJlc3VsdCBvZiB0aGUgcHJvbXB0LCBvdGhlcndpc2UuXG4gICAqL1xuICBQcm9tcHQucHJvdG90eXBlLnNob3cgPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIC8vIFVzZSB0aGUgcHJvbWlzZSBxdWV1ZSB0byBtYWtlIHN1cmUgdGhlcmUncyBubyBvdGhlclxuICAgIC8vIHByb21wdCBiZWluZyBzaG93biBjdXJyZW50bHlcbiAgICBpZiAodGhpcy5vcHRpb25zLmhpZGVTdWJtaXQpIHtcbiAgICAgIHRoaXMuc3VibWl0QnV0dG9uLmhpZGUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5zdWJtaXRCdXR0b24uc2hvdygpO1xuICAgIH1cbiAgICB0aGlzLmNsb3NlQnV0dG9uLmNsaWNrKHRoaXMub25DbG9zZS5iaW5kKHRoaXMpKTtcbiAgICB0aGlzLm1vZGFsLmtleXByZXNzKGZ1bmN0aW9uKGUpIHtcbiAgICAgIGlmKGUud2hpY2ggPT0gMTMpIHtcbiAgICAgICAgdGhpcy5zdWJtaXRCdXR0b24uY2xpY2soKTtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0uYmluZCh0aGlzKSk7XG4gICAgdGhpcy5zdWJtaXRCdXR0b24uY2xpY2sodGhpcy5vblN1Ym1pdC5iaW5kKHRoaXMpKTtcbiAgICB2YXIgZG9jQ2xpY2sgPSAoZnVuY3Rpb24oZSkge1xuICAgICAgLy8gSWYgdGhlIHByb21wdCBpcyBhY3RpdmUgYW5kIHRoZSBiYWNrZ3JvdW5kIGlzIGNsaWNrZWQsXG4gICAgICAvLyB0aGVuIGNsb3NlLlxuICAgICAgaWYgKCQoZS50YXJnZXQpLmlzKHRoaXMubW9kYWwpICYmIHRoaXMuZGVmZXJyZWQpIHtcbiAgICAgICAgdGhpcy5vbkNsb3NlKGUpO1xuICAgICAgICAkKGRvY3VtZW50KS5vZmYoXCJjbGlja1wiLCBkb2NDbGljayk7XG4gICAgICB9XG4gICAgfSkuYmluZCh0aGlzKTtcbiAgICAkKGRvY3VtZW50KS5jbGljayhkb2NDbGljayk7XG4gICAgdmFyIGRvY0tleWRvd24gPSAoZnVuY3Rpb24oZSkge1xuICAgICAgaWYgKGUua2V5ID09PSBcIkVzY2FwZVwiKSB7XG4gICAgICAgIHRoaXMub25DbG9zZShlKTtcbiAgICAgICAgJChkb2N1bWVudCkub2ZmKFwia2V5ZG93blwiLCBkb2NLZXlkb3duKTtcbiAgICAgIH1cbiAgICB9KS5iaW5kKHRoaXMpO1xuICAgICQoZG9jdW1lbnQpLmtleWRvd24oZG9jS2V5ZG93bik7XG4gICAgdGhpcy50aXRsZS50ZXh0KHRoaXMub3B0aW9ucy50aXRsZSk7XG4gICAgdGhpcy5wb3B1bGF0ZU1vZGFsKCk7XG4gICAgdGhpcy5tb2RhbC5jc3MoJ2Rpc3BsYXknLCAnYmxvY2snKTtcbiAgICAkKFwiOmlucHV0OmVuYWJsZWQ6dmlzaWJsZTpmaXJzdFwiLCB0aGlzLm1vZGFsKS5mb2N1cygpLnNlbGVjdCgpXG5cbiAgICBpZiAoY2FsbGJhY2spIHtcbiAgICAgIHJldHVybiB0aGlzLnByb21pc2UudGhlbihjYWxsYmFjayk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLnByb21pc2U7XG4gICAgfVxuICB9O1xuXG5cbiAgLyoqXG4gICAqIENsZWFycyB0aGUgY29udGVudHMgb2YgdGhlIG1vZGFsIHByb21wdC5cbiAgICovXG4gIFByb21wdC5wcm90b3R5cGUuY2xlYXJNb2RhbCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuc3VibWl0QnV0dG9uLm9mZigpO1xuICAgIHRoaXMuY2xvc2VCdXR0b24ub2ZmKCk7XG4gICAgdGhpcy5lbHRzLmVtcHR5KCk7XG4gIH07XG4gIFxuICAvKipcbiAgICogUG9wdWxhdGVzIHRoZSBjb250ZW50cyBvZiB0aGUgbW9kYWwgcHJvbXB0IHdpdGggdGhlXG4gICAqIG9wdGlvbnMgaW4gdGhpcyBwcm9tcHQuXG4gICAqL1xuICBQcm9tcHQucHJvdG90eXBlLnBvcHVsYXRlTW9kYWwgPSBmdW5jdGlvbigpIHtcbiAgICBmdW5jdGlvbiBjcmVhdGVSYWRpb0VsdChvcHRpb24sIGlkeCkge1xuICAgICAgdmFyIGVsdCA9ICQoJC5wYXJzZUhUTUwoXCI8aW5wdXQgbmFtZT1cXFwicHlyZXQtbW9kYWxcXFwiIHR5cGU9XFxcInJhZGlvXFxcIj5cIikpO1xuICAgICAgdmFyIGlkID0gXCJyXCIgKyBpZHgudG9TdHJpbmcoKTtcbiAgICAgIHZhciBsYWJlbCA9ICQoJC5wYXJzZUhUTUwoXCI8bGFiZWwgZm9yPVxcXCJcIiArIGlkICsgXCJcXFwiPjwvbGFiZWw+XCIpKTtcbiAgICAgIGVsdC5hdHRyKFwiaWRcIiwgaWQpO1xuICAgICAgZWx0LmF0dHIoXCJ2YWx1ZVwiLCBvcHRpb24udmFsdWUpO1xuICAgICAgbGFiZWwudGV4dChvcHRpb24ubWVzc2FnZSk7XG4gICAgICB2YXIgZWx0Q29udGFpbmVyID0gJCgkLnBhcnNlSFRNTChcIjx0ZCBjbGFzcz1cXFwicHlyZXQtbW9kYWwtb3B0aW9uLXJhZGlvXFxcIj48L3RkPlwiKSk7XG4gICAgICBlbHRDb250YWluZXIuYXBwZW5kKGVsdCk7XG4gICAgICB2YXIgbGFiZWxDb250YWluZXIgPSAkKCQucGFyc2VIVE1MKFwiPHRkIGNsYXNzPVxcXCJweXJldC1tb2RhbC1vcHRpb24tbWVzc2FnZVxcXCI+PC90ZD5cIikpO1xuICAgICAgbGFiZWxDb250YWluZXIuYXBwZW5kKGxhYmVsKTtcbiAgICAgIHZhciBjb250YWluZXIgPSAkKCQucGFyc2VIVE1MKFwiPHRyIGNsYXNzPVxcXCJweXJldC1tb2RhbC1vcHRpb25cXFwiPjwvdHI+XCIpKTtcbiAgICAgIGNvbnRhaW5lci5hcHBlbmQoZWx0Q29udGFpbmVyKTtcbiAgICAgIGNvbnRhaW5lci5hcHBlbmQobGFiZWxDb250YWluZXIpO1xuICAgICAgaWYgKG9wdGlvbi5leGFtcGxlKSB7XG4gICAgICAgIHZhciBleGFtcGxlID0gJCgkLnBhcnNlSFRNTChcIjxkaXY+PC9kaXY+XCIpKTtcbiAgICAgICAgdmFyIGNtID0gQ29kZU1pcnJvcihleGFtcGxlWzBdLCB7XG4gICAgICAgICAgdmFsdWU6IG9wdGlvbi5leGFtcGxlLFxuICAgICAgICAgIG1vZGU6ICdweXJldCcsXG4gICAgICAgICAgbGluZU51bWJlcnM6IGZhbHNlLFxuICAgICAgICAgIHJlYWRPbmx5OiBcIm5vY3Vyc29yXCIgLy8gdGhpcyBtYWtlcyBpdCByZWFkT25seSAmIG5vdCBmb2N1c2FibGUgYXMgYSBmb3JtIGlucHV0XG4gICAgICAgIH0pO1xuICAgICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgICAgICAgY20ucmVmcmVzaCgpO1xuICAgICAgICB9LCAxKTtcbiAgICAgICAgdmFyIGV4YW1wbGVDb250YWluZXIgPSAkKCQucGFyc2VIVE1MKFwiPHRkIGNsYXNzPVxcXCJweXJldC1tb2RhbC1vcHRpb24tZXhhbXBsZVxcXCI+PC90ZD5cIikpO1xuICAgICAgICBleGFtcGxlQ29udGFpbmVyLmFwcGVuZChleGFtcGxlKTtcbiAgICAgICAgY29udGFpbmVyLmFwcGVuZChleGFtcGxlQ29udGFpbmVyKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgcmV0dXJuIGNvbnRhaW5lcjtcbiAgICB9XG4gICAgZnVuY3Rpb24gY3JlYXRlVGlsZUVsdChvcHRpb24sIGlkeCkge1xuICAgICAgdmFyIGVsdCA9ICQoJC5wYXJzZUhUTUwoXCI8YnV0dG9uIG5hbWU9XFxcInB5cmV0LW1vZGFsXFxcIiBjbGFzcz1cXFwidGlsZVxcXCI+PC9idXR0b24+XCIpKTtcbiAgICAgIGVsdC5hdHRyKFwiaWRcIiwgXCJ0XCIgKyBpZHgudG9TdHJpbmcoKSk7XG4gICAgICBlbHQuYXBwZW5kKCQoXCI8Yj5cIikudGV4dChvcHRpb24ubWVzc2FnZSkpXG4gICAgICAgIC5hcHBlbmQoJChcIjxwPlwiKS50ZXh0KG9wdGlvbi5kZXRhaWxzKSk7XG4gICAgICBmb3IgKHZhciBldnQgaW4gb3B0aW9uLm9uKVxuICAgICAgICBlbHQub24oZXZ0LCBvcHRpb24ub25bZXZ0XSk7XG4gICAgICByZXR1cm4gZWx0O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNyZWF0ZVRleHRFbHQob3B0aW9uKSB7XG4gICAgICB2YXIgZWx0ID0gJChcIjxkaXYgY2xhc3M9XFxcInB5cmV0LW1vZGFsLXRleHRcXFwiPlwiKTtcbiAgICAgIGNvbnN0IGlucHV0ID0gJChcIjxpbnB1dCBpZD0nbW9kYWwtcHJvbXB0LXRleHQnIHR5cGU9J3RleHQnPlwiKS52YWwob3B0aW9uLmRlZmF1bHRWYWx1ZSk7XG4gICAgICBpZihvcHRpb24uZHJhd0VsZW1lbnQpIHtcbiAgICAgICAgZWx0LmFwcGVuZChvcHRpb24uZHJhd0VsZW1lbnQoaW5wdXQpKTtcbiAgICAgIH1cbiAgICAgIGVsc2Uge1xuICAgICAgICBlbHQuYXBwZW5kKCQoXCI8bGFiZWwgZm9yPSdtb2RhbC1wcm9tcHQtdGV4dCc+XCIpLmFkZENsYXNzKFwidGV4dExhYmVsXCIpLnRleHQob3B0aW9uLm1lc3NhZ2UpKTtcbiAgICAgICAgZWx0LmFwcGVuZChpbnB1dCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZWx0O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNyZWF0ZUNvcHlUZXh0RWx0KG9wdGlvbikge1xuICAgICAgdmFyIGVsdCA9ICQoXCI8ZGl2PlwiKTtcbiAgICAgIGVsdC5hcHBlbmQoJChcIjxwPlwiKS5hZGRDbGFzcyhcInRleHRMYWJlbFwiKS50ZXh0KG9wdGlvbi5tZXNzYWdlKSk7XG4gICAgICBpZihvcHRpb24udGV4dCkge1xuICAgICAgICB2YXIgYm94ID0gYXV0b0hpZ2hsaWdodEJveChvcHRpb24udGV4dCk7XG4gIC8vICAgICAgZWx0LmFwcGVuZCgkKFwiPHNwYW4+XCIpLnRleHQoXCIoXCIgKyBvcHRpb24uZGV0YWlscyArIFwiKVwiKSk7XG4gICAgICAgIGVsdC5hcHBlbmQoYm94KTtcbiAgICAgICAgYm94LmZvY3VzKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gZWx0O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIGNyZWF0ZUNvbmZpcm1FbHQob3B0aW9uKSB7XG4gICAgICByZXR1cm4gJChcIjxwPlwiKS50ZXh0KG9wdGlvbi5tZXNzYWdlKTtcbiAgICB9XG5cbiAgICB2YXIgdGhhdCA9IHRoaXM7XG5cbiAgICBmdW5jdGlvbiBjcmVhdGVFbHQob3B0aW9uLCBpKSB7XG4gICAgICBpZih0aGF0Lm9wdGlvbnMuc3R5bGUgPT09IFwicmFkaW9cIikge1xuICAgICAgICByZXR1cm4gY3JlYXRlUmFkaW9FbHQob3B0aW9uLCBpKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYodGhhdC5vcHRpb25zLnN0eWxlID09PSBcInRpbGVzXCIpIHtcbiAgICAgICAgcmV0dXJuIGNyZWF0ZVRpbGVFbHQob3B0aW9uLCBpKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYodGhhdC5vcHRpb25zLnN0eWxlID09PSBcInRleHRcIikge1xuICAgICAgICByZXR1cm4gY3JlYXRlVGV4dEVsdChvcHRpb24pO1xuICAgICAgfVxuICAgICAgZWxzZSBpZih0aGF0Lm9wdGlvbnMuc3R5bGUgPT09IFwiY29weVRleHRcIikge1xuICAgICAgICByZXR1cm4gY3JlYXRlQ29weVRleHRFbHQob3B0aW9uKTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYodGhhdC5vcHRpb25zLnN0eWxlID09PSBcImNvbmZpcm1cIikge1xuICAgICAgICByZXR1cm4gY3JlYXRlQ29uZmlybUVsdChvcHRpb24pO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBvcHRpb25FbHRzO1xuICAgIC8vIENhY2hlIHJlc3VsdHNcbi8vICAgIGlmICh0cnVlKSB7XG4gICAgICBvcHRpb25FbHRzID0gdGhpcy5vcHRpb25zLm9wdGlvbnMubWFwKGNyZWF0ZUVsdCk7XG4vLyAgICAgIHRoaXMuY29tcGlsZWRFbHRzID0gb3B0aW9uRWx0cztcbi8vICAgICAgdGhpcy5pc0NvbXBpbGVkID0gdHJ1ZTtcbi8vICAgIH0gZWxzZSB7XG4vLyAgICAgIG9wdGlvbkVsdHMgPSB0aGlzLmNvbXBpbGVkRWx0cztcbi8vICAgIH1cbiAgICAkKFwiaW5wdXRbdHlwZT0ncmFkaW8nXVwiLCBvcHRpb25FbHRzWzBdKS5hdHRyKCdjaGVja2VkJywgdHJ1ZSk7XG4gICAgdGhpcy5lbHRzLmFwcGVuZChvcHRpb25FbHRzKTtcbiAgICAkKFwiLm1vZGFsLWJvZHlcIiwgdGhpcy5tb2RhbCkuZW1wdHkoKS5hcHBlbmQodGhpcy5lbHRzKTtcbiAgfTtcblxuICAvKipcbiAgICogSGFuZGxlciB3aGljaCBpcyBjYWxsZWQgd2hlbiB0aGUgdXNlciBkb2VzIG5vdCBzZWxlY3QgYW55dGhpbmdcbiAgICovXG4gIFByb21wdC5wcm90b3R5cGUub25DbG9zZSA9IGZ1bmN0aW9uKGUpIHtcbiAgICB0aGlzLm1vZGFsLmNzcygnZGlzcGxheScsICdub25lJyk7XG4gICAgdGhpcy5jbGVhck1vZGFsKCk7XG4gICAgdGhpcy5kZWZlcnJlZC5yZXNvbHZlKG51bGwpO1xuICAgIGRlbGV0ZSB0aGlzLmRlZmVycmVkO1xuICAgIGRlbGV0ZSB0aGlzLnByb21pc2U7XG4gIH07XG5cbiAgLyoqXG4gICAqIEhhbmRsZXIgd2hpY2ggaXMgY2FsbGVkIHdoZW4gdGhlIHVzZXIgcHJlc3NlcyBcInN1Ym1pdFwiXG4gICAqL1xuICBQcm9tcHQucHJvdG90eXBlLm9uU3VibWl0ID0gZnVuY3Rpb24oZSkge1xuICAgIGlmKHRoaXMub3B0aW9ucy5zdHlsZSA9PT0gXCJyYWRpb1wiKSB7XG4gICAgICB2YXIgcmV0dmFsID0gJChcImlucHV0W3R5cGU9J3JhZGlvJ106Y2hlY2tlZFwiLCB0aGlzLm1vZGFsKS52YWwoKTtcbiAgICB9XG4gICAgZWxzZSBpZih0aGlzLm9wdGlvbnMuc3R5bGUgPT09IFwidGV4dFwiKSB7XG4gICAgICB2YXIgcmV0dmFsID0gJChcImlucHV0W3R5cGU9J3RleHQnXVwiLCB0aGlzLm1vZGFsKS52YWwoKTtcbiAgICB9XG4gICAgZWxzZSBpZih0aGlzLm9wdGlvbnMuc3R5bGUgPT09IFwiY29weVRleHRcIikge1xuICAgICAgdmFyIHJldHZhbCA9IHRydWU7XG4gICAgfVxuICAgIGVsc2UgaWYodGhpcy5vcHRpb25zLnN0eWxlID09PSBcImNvbmZpcm1cIikge1xuICAgICAgdmFyIHJldHZhbCA9IHRydWU7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdmFyIHJldHZhbCA9IHRydWU7IC8vIEp1c3QgcmV0dXJuIHRydWUgaWYgdGhleSBjbGlja2VkIHN1Ym1pdFxuICAgIH1cbiAgICB0aGlzLm1vZGFsLmNzcygnZGlzcGxheScsICdub25lJyk7XG4gICAgdGhpcy5jbGVhck1vZGFsKCk7XG4gICAgdGhpcy5kZWZlcnJlZC5yZXNvbHZlKHJldHZhbCk7XG4gICAgZGVsZXRlIHRoaXMuZGVmZXJyZWQ7XG4gICAgZGVsZXRlIHRoaXMucHJvbWlzZTtcbiAgfTtcblxuICByZXR1cm4gUHJvbXB0O1xuXG59KTtcblxuIiwiLy8gVGhlIG1vZHVsZSBjYWNoZVxudmFyIF9fd2VicGFja19tb2R1bGVfY2FjaGVfXyA9IHt9O1xuXG4vLyBUaGUgcmVxdWlyZSBmdW5jdGlvblxuZnVuY3Rpb24gX193ZWJwYWNrX3JlcXVpcmVfXyhtb2R1bGVJZCkge1xuXHQvLyBDaGVjayBpZiBtb2R1bGUgaXMgaW4gY2FjaGVcblx0dmFyIGNhY2hlZE1vZHVsZSA9IF9fd2VicGFja19tb2R1bGVfY2FjaGVfX1ttb2R1bGVJZF07XG5cdGlmIChjYWNoZWRNb2R1bGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdHJldHVybiBjYWNoZWRNb2R1bGUuZXhwb3J0cztcblx0fVxuXHQvLyBDcmVhdGUgYSBuZXcgbW9kdWxlIChhbmQgcHV0IGl0IGludG8gdGhlIGNhY2hlKVxuXHR2YXIgbW9kdWxlID0gX193ZWJwYWNrX21vZHVsZV9jYWNoZV9fW21vZHVsZUlkXSA9IHtcblx0XHQvLyBubyBtb2R1bGUuaWQgbmVlZGVkXG5cdFx0Ly8gbm8gbW9kdWxlLmxvYWRlZCBuZWVkZWRcblx0XHRleHBvcnRzOiB7fVxuXHR9O1xuXG5cdC8vIEV4ZWN1dGUgdGhlIG1vZHVsZSBmdW5jdGlvblxuXHRfX3dlYnBhY2tfbW9kdWxlc19fW21vZHVsZUlkXShtb2R1bGUsIG1vZHVsZS5leHBvcnRzLCBfX3dlYnBhY2tfcmVxdWlyZV9fKTtcblxuXHQvLyBSZXR1cm4gdGhlIGV4cG9ydHMgb2YgdGhlIG1vZHVsZVxuXHRyZXR1cm4gbW9kdWxlLmV4cG9ydHM7XG59XG5cbiIsIi8qIGdsb2JhbCAkIGpRdWVyeSBDUE8gQ29kZU1pcnJvciBzdG9yYWdlQVBJIFEgY3JlYXRlUHJvZ3JhbUNvbGxlY3Rpb25BUEkgbWFrZVNoYXJlQVBJICovXG5cbnZhciBvcmlnaW5hbFBhZ2VMb2FkID0gRGF0ZS5ub3coKTtcbmNvbnNvbGUubG9nKFwib3JpZ2luYWxQYWdlTG9hZDogXCIsIG9yaWdpbmFsUGFnZUxvYWQpO1xuXG5jb25zdCBpc0VtYmVkZGVkID0gd2luZG93LnBhcmVudCAhPT0gd2luZG93O1xuXG52YXIgc2hhcmVBUEkgPSBtYWtlU2hhcmVBUEkocHJvY2Vzcy5lbnYuQ1VSUkVOVF9QWVJFVF9SRUxFQVNFKTtcblxudmFyIHVybCA9IHdpbmRvdy51cmwgPSByZXF1aXJlKCd1cmwuanMnKTtcbnZhciBtb2RhbFByb21wdCA9IHJlcXVpcmUoJy4vbW9kYWwtcHJvbXB0LmpzJyk7XG53aW5kb3cubW9kYWxQcm9tcHQgPSBtb2RhbFByb21wdDtcblxuY29uc3QgTE9HID0gdHJ1ZTtcbndpbmRvdy5jdF9sb2cgPSBmdW5jdGlvbigvKiB2YXJhcmdzICovKSB7XG4gIGlmICh3aW5kb3cuY29uc29sZSAmJiBMT0cpIHtcbiAgICBjb25zb2xlLmxvZy5hcHBseShjb25zb2xlLCBhcmd1bWVudHMpO1xuICB9XG59O1xuXG53aW5kb3cuY3RfZXJyb3IgPSBmdW5jdGlvbigvKiB2YXJhcmdzICovKSB7XG4gIGlmICh3aW5kb3cuY29uc29sZSAmJiBMT0cpIHtcbiAgICBjb25zb2xlLmVycm9yLmFwcGx5KGNvbnNvbGUsIGFyZ3VtZW50cyk7XG4gIH1cbn07XG52YXIgaW5pdGlhbFBhcmFtcyA9IHVybC5wYXJzZShkb2N1bWVudC5sb2NhdGlvbi5ocmVmKTtcbnZhciBwYXJhbXMgPSB1cmwucGFyc2UoXCIvP1wiICsgaW5pdGlhbFBhcmFtc1tcImhhc2hcIl0pO1xud2luZG93LmhpZ2hsaWdodE1vZGUgPSBcIm1jbWhcIjsgLy8gd2hhdCBpcyB0aGlzIGZvcj9cbndpbmRvdy5jbGVhckZsYXNoID0gZnVuY3Rpb24oKSB7XG4gICQoXCIubm90aWZpY2F0aW9uQXJlYVwiKS5lbXB0eSgpO1xufVxud2luZG93LndoaXRlVG9CbGFja05vdGlmaWNhdGlvbiA9IGZ1bmN0aW9uKCkge1xuICAvKlxuICAkKFwiLm5vdGlmaWNhdGlvbkFyZWEgLmFjdGl2ZVwiKS5jc3MoXCJiYWNrZ3JvdW5kLWNvbG9yXCIsIFwid2hpdGVcIik7XG4gICQoXCIubm90aWZpY2F0aW9uQXJlYSAuYWN0aXZlXCIpLmFuaW1hdGUoe2JhY2tncm91bmRDb2xvcjogXCIjMTExMTExXCIgfSwgMTAwMCk7XG4gICovXG59O1xud2luZG93LnN0aWNrRXJyb3IgPSBmdW5jdGlvbihtZXNzYWdlLCBtb3JlKSB7XG4gIENQTy5zYXlBbmRGb3JnZXQobWVzc2FnZSk7XG4gIGNsZWFyRmxhc2goKTtcbiAgdmFyIGVyciA9ICQoXCI8c3Bhbj5cIikuYWRkQ2xhc3MoXCJlcnJvclwiKS50ZXh0KG1lc3NhZ2UpO1xuICBpZihtb3JlKSB7XG4gICAgZXJyLmF0dHIoXCJ0aXRsZVwiLCBtb3JlKTtcbiAgfVxuICBlcnIudG9vbHRpcCgpO1xuICAkKFwiLm5vdGlmaWNhdGlvbkFyZWFcIikucHJlcGVuZChlcnIpO1xuICB3aGl0ZVRvQmxhY2tOb3RpZmljYXRpb24oKTtcbn07XG53aW5kb3cuZmxhc2hFcnJvciA9IGZ1bmN0aW9uKG1lc3NhZ2UpIHtcbiAgQ1BPLnNheUFuZEZvcmdldChtZXNzYWdlKTtcbiAgY2xlYXJGbGFzaCgpO1xuICB2YXIgZXJyID0gJChcIjxzcGFuPlwiKS5hZGRDbGFzcyhcImVycm9yXCIpLnRleHQobWVzc2FnZSk7XG4gICQoXCIubm90aWZpY2F0aW9uQXJlYVwiKS5wcmVwZW5kKGVycik7XG4gIHdoaXRlVG9CbGFja05vdGlmaWNhdGlvbigpO1xuICBlcnIuZmFkZU91dCg3MDAwKTtcbn07XG53aW5kb3cuZmxhc2hNZXNzYWdlID0gZnVuY3Rpb24obWVzc2FnZSkge1xuICBDUE8uc2F5QW5kRm9yZ2V0KG1lc3NhZ2UpO1xuICBjbGVhckZsYXNoKCk7XG4gIHZhciBtc2cgPSAkKFwiPHNwYW4+XCIpLmFkZENsYXNzKFwiYWN0aXZlXCIpLnRleHQobWVzc2FnZSk7XG4gICQoXCIubm90aWZpY2F0aW9uQXJlYVwiKS5wcmVwZW5kKG1zZyk7XG4gIHdoaXRlVG9CbGFja05vdGlmaWNhdGlvbigpO1xuICBtc2cuZmFkZU91dCg3MDAwKTtcbn07XG53aW5kb3cuc3RpY2tNZXNzYWdlID0gZnVuY3Rpb24obWVzc2FnZSkge1xuICBDUE8uc2F5QW5kRm9yZ2V0KG1lc3NhZ2UpO1xuICBjbGVhckZsYXNoKCk7XG4gIHZhciBtc2cgPSAkKFwiPHNwYW4+XCIpLmFkZENsYXNzKFwiYWN0aXZlXCIpLnRleHQobWVzc2FnZSk7XG4gICQoXCIubm90aWZpY2F0aW9uQXJlYVwiKS5wcmVwZW5kKG1zZyk7XG4gIHdoaXRlVG9CbGFja05vdGlmaWNhdGlvbigpO1xufTtcbndpbmRvdy5zdGlja1JpY2hNZXNzYWdlID0gZnVuY3Rpb24oY29udGVudCkge1xuICBDUE8uc2F5QW5kRm9yZ2V0KGNvbnRlbnQudGV4dCgpKTtcbiAgY2xlYXJGbGFzaCgpO1xuICAkKFwiLm5vdGlmaWNhdGlvbkFyZWFcIikucHJlcGVuZCgkKFwiPHNwYW4+XCIpLmFkZENsYXNzKFwiYWN0aXZlXCIpLmFwcGVuZChjb250ZW50KSk7XG4gIHdoaXRlVG9CbGFja05vdGlmaWNhdGlvbigpO1xufTtcbndpbmRvdy5ta1dhcm5pbmdVcHBlciA9IGZ1bmN0aW9uKCl7cmV0dXJuICQoXCI8ZGl2IGNsYXNzPSd3YXJuaW5nLXVwcGVyJz5cIik7fVxud2luZG93Lm1rV2FybmluZ0xvd2VyID0gZnVuY3Rpb24oKXtyZXR1cm4gJChcIjxkaXYgY2xhc3M9J3dhcm5pbmctbG93ZXInPlwiKTt9XG5cbnZhciBEb2N1bWVudHMgPSBmdW5jdGlvbigpIHtcblxuICBmdW5jdGlvbiBEb2N1bWVudHMoKSB7XG4gICAgdGhpcy5kb2N1bWVudHMgPSBuZXcgTWFwKCk7XG4gIH1cblxuICBEb2N1bWVudHMucHJvdG90eXBlLmhhcyA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuZG9jdW1lbnRzLmhhcyhuYW1lKTtcbiAgfTtcblxuICBEb2N1bWVudHMucHJvdG90eXBlLmdldCA9IGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgcmV0dXJuIHRoaXMuZG9jdW1lbnRzLmdldChuYW1lKTtcbiAgfTtcblxuICBEb2N1bWVudHMucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uIChuYW1lLCBkb2MpIHtcbiAgICBpZihsb2dnZXIuaXNEZXRhaWxlZClcbiAgICAgIGxvZ2dlci5sb2coXCJkb2Muc2V0XCIsIHtuYW1lOiBuYW1lLCB2YWx1ZTogZG9jLmdldFZhbHVlKCl9KTtcbiAgICByZXR1cm4gdGhpcy5kb2N1bWVudHMuc2V0KG5hbWUsIGRvYyk7XG4gIH07XG5cbiAgRG9jdW1lbnRzLnByb3RvdHlwZS5kZWxldGUgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIGlmKGxvZ2dlci5pc0RldGFpbGVkKVxuICAgICAgbG9nZ2VyLmxvZyhcImRvYy5kZWxcIiwge25hbWU6IG5hbWV9KTtcbiAgICByZXR1cm4gdGhpcy5kb2N1bWVudHMuZGVsZXRlKG5hbWUpO1xuICB9O1xuXG4gIERvY3VtZW50cy5wcm90b3R5cGUuZm9yRWFjaCA9IGZ1bmN0aW9uIChmKSB7XG4gICAgcmV0dXJuIHRoaXMuZG9jdW1lbnRzLmZvckVhY2goZik7XG4gIH07XG5cbiAgcmV0dXJuIERvY3VtZW50cztcbn0oKTtcblxudmFyIFZFUlNJT05fQ0hFQ0tfSU5URVJWQUwgPSAxMjAwMDAgKyAoMzAwMDAgKiBNYXRoLnJhbmRvbSgpKTtcblxuZnVuY3Rpb24gY2hlY2tWZXJzaW9uKCkge1xuICAkLmdldChcIi9jdXJyZW50LXZlcnNpb25cIikudGhlbihmdW5jdGlvbihyZXNwKSB7XG4gICAgcmVzcCA9IEpTT04ucGFyc2UocmVzcCk7XG4gICAgaWYocmVzcC52ZXJzaW9uICYmIHJlc3AudmVyc2lvbiAhPT0gcHJvY2Vzcy5lbnYuQ1VSUkVOVF9QWVJFVF9SRUxFQVNFKSB7XG4gICAgICB3aW5kb3cuZmxhc2hNZXNzYWdlKFwiQSBuZXcgdmVyc2lvbiBvZiBQeXJldCBpcyBhdmFpbGFibGUuIFNhdmUgYW5kIHJlbG9hZCB0aGUgcGFnZSB0byBnZXQgdGhlIG5ld2VzdCB2ZXJzaW9uLlwiKTtcbiAgICB9XG4gIH0pO1xufVxuaWYoIWlzRW1iZWRkZWQpIHtcbiAgd2luZG93LnNldEludGVydmFsKGNoZWNrVmVyc2lvbiwgVkVSU0lPTl9DSEVDS19JTlRFUlZBTCk7XG59XG5cbndpbmRvdy5DUE8gPSB7XG4gIHNhdmU6IGZ1bmN0aW9uKCkge30sXG4gIGF1dG9TYXZlOiBmdW5jdGlvbigpIHt9LFxuICBkb2N1bWVudHMgOiBuZXcgRG9jdW1lbnRzKClcbn07XG4kKGZ1bmN0aW9uKCkge1xuICBjb25zdCBDT05URVhUX0ZPUl9ORVdfRklMRVMgPSBcInVzZSBjb250ZXh0IHN0YXJ0ZXIyMDI0XFxuXCI7XG4gIGNvbnN0IENPTlRFWFRfUFJFRklYID0gL151c2UgY29udGV4dFxccysvO1xuXG4gIGZ1bmN0aW9uIG1lcmdlKG9iaiwgZXh0ZW5zaW9uKSB7XG4gICAgdmFyIG5ld29iaiA9IHt9O1xuICAgIE9iamVjdC5rZXlzKG9iaikuZm9yRWFjaChmdW5jdGlvbihrKSB7XG4gICAgICBuZXdvYmpba10gPSBvYmpba107XG4gICAgfSk7XG4gICAgT2JqZWN0LmtleXMoZXh0ZW5zaW9uKS5mb3JFYWNoKGZ1bmN0aW9uKGspIHtcbiAgICAgIG5ld29ialtrXSA9IGV4dGVuc2lvbltrXTtcbiAgICB9KTtcbiAgICByZXR1cm4gbmV3b2JqO1xuICB9XG4gIHZhciBhbmltYXRpb25EaXYgPSBudWxsO1xuICBmdW5jdGlvbiBjbG9zZUFuaW1hdGlvbklmT3BlbigpIHtcbiAgICBpZihhbmltYXRpb25EaXYpIHtcbiAgICAgIGFuaW1hdGlvbkRpdi5lbXB0eSgpO1xuICAgICAgYW5pbWF0aW9uRGl2LmRpYWxvZyhcImRlc3Ryb3lcIik7XG4gICAgICBhbmltYXRpb25EaXYgPSBudWxsO1xuICAgIH1cbiAgfVxuICBDUE8ubWFrZUVkaXRvciA9IGZ1bmN0aW9uKGNvbnRhaW5lciwgb3B0aW9ucykge1xuICAgIHZhciBpbml0aWFsID0gXCJcIjtcbiAgICBpZiAob3B0aW9ucy5oYXNPd25Qcm9wZXJ0eShcImluaXRpYWxcIikpIHtcbiAgICAgIGluaXRpYWwgPSBvcHRpb25zLmluaXRpYWw7XG4gICAgfVxuXG4gICAgdmFyIHRleHRhcmVhID0galF1ZXJ5KFwiPHRleHRhcmVhIGFyaWEtaGlkZGVuPSd0cnVlJz5cIik7XG4gICAgdGV4dGFyZWEudmFsKGluaXRpYWwpO1xuICAgIGNvbnRhaW5lci5hcHBlbmQodGV4dGFyZWEpO1xuXG4gICAgdmFyIHJ1bkZ1biA9IGZ1bmN0aW9uIChjb2RlLCByZXBsT3B0aW9ucykge1xuICAgICAgb3B0aW9ucy5ydW4oY29kZSwge2NtOiBDTX0sIHJlcGxPcHRpb25zKTtcbiAgICB9O1xuXG4gICAgdmFyIHVzZUxpbmVOdW1iZXJzID0gIW9wdGlvbnMuc2ltcGxlRWRpdG9yO1xuICAgIHZhciB1c2VGb2xkaW5nID0gIW9wdGlvbnMuc2ltcGxlRWRpdG9yO1xuXG4gICAgdmFyIGd1dHRlcnMgPSAhb3B0aW9ucy5zaW1wbGVFZGl0b3IgP1xuICAgICAgW1wiaGVscC1ndXR0ZXJcIiwgXCJDb2RlTWlycm9yLWxpbmVudW1iZXJzXCIsIFwiQ29kZU1pcnJvci1mb2xkZ3V0dGVyXCJdIDpcbiAgICAgIFtdO1xuXG4gICAgZnVuY3Rpb24gcmVpbmRlbnRBbGxMaW5lcyhjbSkge1xuICAgICAgdmFyIGxhc3QgPSBjbS5saW5lQ291bnQoKTtcbiAgICAgIGNtLm9wZXJhdGlvbihmdW5jdGlvbigpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsYXN0OyArK2kpIGNtLmluZGVudExpbmUoaSk7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICB2YXIgQ09ERV9MSU5FX1dJRFRIID0gMTAwO1xuXG4gICAgdmFyIHJ1bGVycywgcnVsZXJzTWluQ29sO1xuXG4gICAgLy8gcGxhY2UgYSB2ZXJ0aWNhbCBsaW5lIGluIGNvZGUgZWRpdG9yLCBhbmQgbm90IHJlcGxcbiAgICBpZiAob3B0aW9ucy5zaW1wbGVFZGl0b3IpIHtcbiAgICAgIHJ1bGVycyA9IFtdO1xuICAgIH0gZWxzZXtcbiAgICAgIHJ1bGVycyA9IFt7Y29sb3I6IFwiIzMxN0JDRlwiLCBjb2x1bW46IENPREVfTElORV9XSURUSCwgbGluZVN0eWxlOiBcImRhc2hlZFwiLCBjbGFzc05hbWU6IFwiaGlkZGVuXCJ9XTtcbiAgICAgIHJ1bGVyc01pbkNvbCA9IENPREVfTElORV9XSURUSDtcbiAgICB9XG5cbiAgICBjb25zdCBtYWMgPSBDb2RlTWlycm9yLmtleU1hcC5kZWZhdWx0ID09PSBDb2RlTWlycm9yLmtleU1hcC5tYWNEZWZhdWx0O1xuICAgIGNvbnNvbGUubG9nKFwiVXNpbmcga2V5bWFwOiBcIiwgQ29kZU1pcnJvci5rZXlNYXAuZGVmYXVsdCwgXCJtYWNEZWZhdWx0OiBcIiwgQ29kZU1pcnJvci5rZXlNYXAubWFjRGVmYXVsdCwgXCJtYWM6IFwiLCBtYWMpO1xuICAgIGNvbnN0IG1vZGlmaWVyID0gbWFjID8gXCJDbWRcIiA6IFwiQ3RybFwiO1xuXG4gICAgdmFyIGNtT3B0aW9ucyA9IHtcbiAgICAgIGV4dHJhS2V5czogQ29kZU1pcnJvci5ub3JtYWxpemVLZXlNYXAoe1xuICAgICAgICBcIlNoaWZ0LUVudGVyXCI6IGZ1bmN0aW9uKGNtKSB7IHJ1bkZ1bihjbS5nZXRWYWx1ZSgpKTsgfSxcbiAgICAgICAgXCJTaGlmdC1DdHJsLUVudGVyXCI6IGZ1bmN0aW9uKGNtKSB7IHJ1bkZ1bihjbS5nZXRWYWx1ZSgpKTsgfSxcbiAgICAgICAgXCJUYWJcIjogXCJpbmRlbnRBdXRvXCIsXG4gICAgICAgIFwiQ3RybC1JXCI6IHJlaW5kZW50QWxsTGluZXMsXG4gICAgICAgIFwiRXNjIExlZnRcIjogXCJnb0JhY2t3YXJkU2V4cFwiLFxuICAgICAgICBcIkFsdC1MZWZ0XCI6IFwiZ29CYWNrd2FyZFNleHBcIixcbiAgICAgICAgXCJFc2MgUmlnaHRcIjogXCJnb0ZvcndhcmRTZXhwXCIsXG4gICAgICAgIFwiQWx0LVJpZ2h0XCI6IFwiZ29Gb3J3YXJkU2V4cFwiLFxuICAgICAgICBcIkN0cmwtTGVmdFwiOiBcImdvQmFja3dhcmRUb2tlblwiLFxuICAgICAgICBcIkN0cmwtUmlnaHRcIjogXCJnb0ZvcndhcmRUb2tlblwiLFxuICAgICAgICBbYCR7bW9kaWZpZXJ9LUZgXTogXCJmaW5kUGVyc2lzdGVudFwiLFxuICAgICAgICBbYCR7bW9kaWZpZXJ9LS9gXTogXCJ0b2dnbGVDb21tZW50XCIsXG4gICAgICB9KSxcbiAgICAgIGluZGVudFVuaXQ6IDIsXG4gICAgICB0YWJTaXplOiAyLFxuICAgICAgdmlld3BvcnRNYXJnaW46IEluZmluaXR5LFxuICAgICAgbGluZU51bWJlcnM6IHVzZUxpbmVOdW1iZXJzLFxuICAgICAgbWF0Y2hLZXl3b3JkczogdHJ1ZSxcbiAgICAgIG1hdGNoQnJhY2tldHM6IHRydWUsXG4gICAgICBzdHlsZVNlbGVjdGVkVGV4dDogdHJ1ZSxcbiAgICAgIGZvbGRHdXR0ZXI6IHVzZUZvbGRpbmcsXG4gICAgICBndXR0ZXJzOiBndXR0ZXJzLFxuICAgICAgbGluZVdyYXBwaW5nOiB0cnVlLFxuICAgICAgbG9nZ2luZzogdHJ1ZSxcbiAgICAgIHJ1bGVyczogcnVsZXJzLFxuICAgICAgcnVsZXJzTWluQ29sOiBydWxlcnNNaW5Db2wsXG4gICAgICBzY3JvbGxQYXN0RW5kOiB0cnVlLFxuICAgIH07XG5cbiAgICBjbU9wdGlvbnMgPSBtZXJnZShjbU9wdGlvbnMsIG9wdGlvbnMuY21PcHRpb25zIHx8IHt9KTtcblxuICAgIHZhciBDTSA9IENvZGVNaXJyb3IuZnJvbVRleHRBcmVhKHRleHRhcmVhWzBdLCBjbU9wdGlvbnMpO1xuXG4gICAgZnVuY3Rpb24gZmlyc3RMaW5lSXNOYW1lc3BhY2UoKSB7XG4gICAgICBjb25zdCBmaXJzdGxpbmUgPSBDTS5nZXRMaW5lKDApO1xuICAgICAgY29uc3QgbWF0Y2ggPSBmaXJzdGxpbmUubWF0Y2goQ09OVEVYVF9QUkVGSVgpO1xuICAgICAgcmV0dXJuIG1hdGNoICE9PSBudWxsO1xuICAgIH1cblxuICAgIGxldCBuYW1lc3BhY2VtYXJrID0gbnVsbDtcbiAgICBmdW5jdGlvbiBzZXRDb250ZXh0TGluZShuZXdDb250ZXh0TGluZSkge1xuICAgICAgdmFyIGhhc05hbWVzcGFjZSA9IGZpcnN0TGluZUlzTmFtZXNwYWNlKCk7XG4gICAgICBpZighaGFzTmFtZXNwYWNlICYmIG5hbWVzcGFjZW1hcmsgIT09IG51bGwpIHtcbiAgICAgICAgbmFtZXNwYWNlbWFyay5jbGVhcigpO1xuICAgICAgfVxuICAgICAgaWYoIWhhc05hbWVzcGFjZSkge1xuICAgICAgICBDTS5yZXBsYWNlUmFuZ2UobmV3Q29udGV4dExpbmUsIHsgbGluZTowLCBjaDogMH0sIHtsaW5lOiAwLCBjaDogMH0pO1xuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIENNLnJlcGxhY2VSYW5nZShuZXdDb250ZXh0TGluZSwgeyBsaW5lOjAsIGNoOiAwfSwge2xpbmU6IDEsIGNoOiAwfSk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYoIW9wdGlvbnMuc2ltcGxlRWRpdG9yKSB7XG5cbiAgICAgIGNvbnN0IGd1dHRlclF1ZXN0aW9uV3JhcHBlciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJkaXZcIik7XG4gICAgICBndXR0ZXJRdWVzdGlvbldyYXBwZXIuY2xhc3NOYW1lID0gXCJndXR0ZXItcXVlc3Rpb24td3JhcHBlclwiO1xuICAgICAgY29uc3QgZ3V0dGVyVG9vbHRpcCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzcGFuXCIpO1xuICAgICAgZ3V0dGVyVG9vbHRpcC5jbGFzc05hbWUgPSBcImd1dHRlci1xdWVzdGlvbi10b29sdGlwXCI7XG4gICAgICBndXR0ZXJUb29sdGlwLmlubmVyVGV4dCA9IFwiVGhlIHVzZSBjb250ZXh0IGxpbmUgdGVsbHMgUHlyZXQgdG8gbG9hZCB0b29scyBmb3IgYSBzcGVjaWZpYyBjbGFzcyBjb250ZXh0LiBJdCBjYW4gYmUgY2hhbmdlZCB0aHJvdWdoIHRoZSBtYWluIFB5cmV0IG1lbnUuIE1vc3Qgb2YgdGhlIHRpbWUgeW91IHdvbid0IG5lZWQgdG8gY2hhbmdlIHRoaXMgYXQgYWxsLlwiO1xuICAgICAgY29uc3QgZ3V0dGVyUXVlc3Rpb24gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwiaW1nXCIpO1xuICAgICAgZ3V0dGVyUXVlc3Rpb24uc3JjID0gd2luZG93LkFQUF9CQVNFX1VSTCArIFwiL2ltZy9xdWVzdGlvbi5wbmdcIjtcbiAgICAgIGd1dHRlclF1ZXN0aW9uLmNsYXNzTmFtZSA9IFwiZ3V0dGVyLXF1ZXN0aW9uXCI7XG4gICAgICBndXR0ZXJRdWVzdGlvbldyYXBwZXIuYXBwZW5kQ2hpbGQoZ3V0dGVyUXVlc3Rpb24pO1xuICAgICAgZ3V0dGVyUXVlc3Rpb25XcmFwcGVyLmFwcGVuZENoaWxkKGd1dHRlclRvb2x0aXApO1xuICAgICAgQ00uc2V0R3V0dGVyTWFya2VyKDAsIFwiaGVscC1ndXR0ZXJcIiwgZ3V0dGVyUXVlc3Rpb25XcmFwcGVyKTtcblxuICAgICAgQ00uZ2V0V3JhcHBlckVsZW1lbnQoKS5vbm1vdXNlbGVhdmUgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgIENNLmNsZWFyR3V0dGVyKFwiaGVscC1ndXR0ZXJcIik7XG4gICAgICB9XG5cbiAgICAgIC8vIE5PVEUoam9lKTogVGhpcyBzZWVtcyB0byBiZSB0aGUgYmVzdCB3YXkgdG8gZ2V0IGEgaG92ZXIgb24gYSBtYXJrOiBodHRwczovL2dpdGh1Yi5jb20vY29kZW1pcnJvci9Db2RlTWlycm9yL2lzc3Vlcy8zNTI5XG4gICAgICBDTS5nZXRXcmFwcGVyRWxlbWVudCgpLm9ubW91c2Vtb3ZlID0gZnVuY3Rpb24oZSkge1xuICAgICAgICB2YXIgbGluZUNoID0gQ00uY29vcmRzQ2hhcih7IGxlZnQ6IGUuY2xpZW50WCwgdG9wOiBlLmNsaWVudFkgfSk7XG4gICAgICAgIHZhciBtYXJrZXJzID0gQ00uZmluZE1hcmtzQXQobGluZUNoKTtcbiAgICAgICAgaWYgKG1hcmtlcnMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgICAgQ00uY2xlYXJHdXR0ZXIoXCJoZWxwLWd1dHRlclwiKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAobGluZUNoLmxpbmUgPT09IDAgJiYgbWFya2Vyc1swXSA9PT0gbmFtZXNwYWNlbWFyaykge1xuICAgICAgICAgIENNLnNldEd1dHRlck1hcmtlcigwLCBcImhlbHAtZ3V0dGVyXCIsIGd1dHRlclF1ZXN0aW9uV3JhcHBlcik7XG4gICAgICAgIH1cbiAgICAgICAgZWxzZSB7XG4gICAgICAgICAgQ00uY2xlYXJHdXR0ZXIoXCJoZWxwLWd1dHRlclwiKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgQ00ub24oXCJjaGFuZ2VcIiwgZnVuY3Rpb24oY2hhbmdlKSB7XG4gICAgICAgIGZ1bmN0aW9uIGRvZXNOb3RDaGFuZ2VGaXJzdExpbmUoYykgeyByZXR1cm4gYy5mcm9tLmxpbmUgIT09IDA7IH1cbiAgICAgICAgaWYoY2hhbmdlLmN1ck9wLmNoYW5nZU9ianMgJiYgY2hhbmdlLmN1ck9wLmNoYW5nZU9ianMuZXZlcnkoZG9lc05vdENoYW5nZUZpcnN0TGluZSkpIHsgcmV0dXJuOyB9XG4gICAgICAgIHZhciBoYXNOYW1lc3BhY2UgPSBmaXJzdExpbmVJc05hbWVzcGFjZSgpO1xuICAgICAgICBpZihoYXNOYW1lc3BhY2UpIHtcbiAgICAgICAgICBpZihuYW1lc3BhY2VtYXJrKSB7IG5hbWVzcGFjZW1hcmsuY2xlYXIoKTsgfVxuICAgICAgICAgIG5hbWVzcGFjZW1hcmsgPSBDTS5tYXJrVGV4dCh7bGluZTogMCwgY2g6IDB9LCB7bGluZTogMSwgY2g6IDB9LCB7IGF0dHJpYnV0ZXM6IHsgdXNlbGluZTogdHJ1ZSB9LCBjbGFzc05hbWU6IFwidXNlbGluZVwiLCBhdG9taWM6IHRydWUsIGluY2x1c2l2ZUxlZnQ6IHRydWUsIGluY2x1c2l2ZVJpZ2h0OiBmYWxzZSB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuICAgIGlmICh1c2VMaW5lTnVtYmVycykge1xuICAgICAgQ00uZGlzcGxheS53cmFwcGVyLmFwcGVuZENoaWxkKG1rV2FybmluZ1VwcGVyKClbMF0pO1xuICAgICAgQ00uZGlzcGxheS53cmFwcGVyLmFwcGVuZENoaWxkKG1rV2FybmluZ0xvd2VyKClbMF0pO1xuICAgIH1cblxuICAgIGdldFRvcFRpZXJNZW51aXRlbXMoKTtcblxuICAgIHJldHVybiB7XG4gICAgICBjbTogQ00sXG4gICAgICBzZXRDb250ZXh0TGluZTogc2V0Q29udGV4dExpbmUsXG4gICAgICByZWZyZXNoOiBmdW5jdGlvbigpIHsgQ00ucmVmcmVzaCgpOyB9LFxuICAgICAgcnVuOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcnVuRnVuKENNLmdldFZhbHVlKCkpO1xuICAgICAgfSxcbiAgICAgIGZvY3VzOiBmdW5jdGlvbigpIHsgQ00uZm9jdXMoKTsgfSxcbiAgICAgIGZvY3VzQ2Fyb3VzZWw6IG51bGwgLy9pbml0Rm9jdXNDYXJvdXNlbFxuICAgIH07XG4gIH07XG4gIENQTy5SVU5fQ09ERSA9IGZ1bmN0aW9uKCkge1xuICAgIGNvbnNvbGUubG9nKFwiUnVubmluZyBiZWZvcmUgcmVhZHlcIiwgYXJndW1lbnRzKTtcbiAgfTtcblxuICBmdW5jdGlvbiBzZXRVc2VybmFtZSh0YXJnZXQpIHtcbiAgICByZXR1cm4gZ3dyYXAubG9hZCh7bmFtZTogJ3BsdXMnLFxuICAgICAgdmVyc2lvbjogJ3YxJyxcbiAgICB9KS50aGVuKChhcGkpID0+IHtcbiAgICAgIGFwaS5wZW9wbGUuZ2V0KHsgdXNlcklkOiBcIm1lXCIgfSkudGhlbihmdW5jdGlvbih1c2VyKSB7XG4gICAgICAgIHZhciBuYW1lID0gdXNlci5kaXNwbGF5TmFtZTtcbiAgICAgICAgaWYgKHVzZXIuZW1haWxzICYmIHVzZXIuZW1haWxzWzBdICYmIHVzZXIuZW1haWxzWzBdLnZhbHVlKSB7XG4gICAgICAgICAgbmFtZSA9IHVzZXIuZW1haWxzWzBdLnZhbHVlO1xuICAgICAgICB9XG4gICAgICAgIHRhcmdldC50ZXh0KG5hbWUpO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICBzdG9yYWdlQVBJLnRoZW4oZnVuY3Rpb24oYXBpKSB7XG4gICAgYXBpLmNvbGxlY3Rpb24udGhlbihmdW5jdGlvbigpIHtcbiAgICAgICQoXCIubG9naW5Pbmx5XCIpLnNob3coKTtcbiAgICAgICQoXCIubG9nb3V0T25seVwiKS5oaWRlKCk7XG4gICAgICBzZXRVc2VybmFtZSgkKFwiI3VzZXJuYW1lXCIpKTtcbiAgICB9KTtcbiAgICBhcGkuY29sbGVjdGlvbi5mYWlsKGZ1bmN0aW9uKCkge1xuICAgICAgJChcIi5sb2dpbk9ubHlcIikuaGlkZSgpO1xuICAgICAgJChcIi5sb2dvdXRPbmx5XCIpLnNob3coKTtcbiAgICB9KTtcbiAgfSk7XG5cbiAgc3RvcmFnZUFQSSA9IHN0b3JhZ2VBUEkudGhlbihmdW5jdGlvbihhcGkpIHsgcmV0dXJuIGFwaS5hcGk7IH0pO1xuICAkKFwiI2Z1bGxDb25uZWN0QnV0dG9uXCIpLmNsaWNrKGZ1bmN0aW9uKCkge1xuICAgIHJlYXV0aChcbiAgICAgIGZhbHNlLCAgLy8gRG9uJ3QgZG8gYW4gaW1tZWRpYXRlIGxvYWQgKHRoaXMgd2lsbCByZXF1aXJlIGxvZ2luKVxuICAgICAgdHJ1ZSAgICAvLyBVc2UgdGhlIGZ1bGwgc2V0IG9mIHNjb3BlcyBmb3IgdGhpcyBsb2dpblxuICAgICk7XG4gIH0pO1xuICAkKFwiI2Nvbm5lY3RCdXR0b25cIikuY2xpY2soZnVuY3Rpb24oKSB7XG4gICAgJChcIiNjb25uZWN0QnV0dG9uXCIpLnRleHQoXCJDb25uZWN0aW5nLi4uXCIpO1xuICAgICQoXCIjY29ubmVjdEJ1dHRvblwiKS5hdHRyKFwiZGlzYWJsZWRcIiwgXCJkaXNhYmxlZFwiKTtcbiAgICAkKCcjY29ubmVjdEJ1dHRvbmxpJykuYXR0cignZGlzYWJsZWQnLCAnZGlzYWJsZWQnKTtcbiAgICAkKFwiI2Nvbm5lY3RCdXR0b25cIikuYXR0cihcInRhYkluZGV4XCIsIFwiLTFcIik7XG4gICAgLy8kKFwiI3RvcFRpZXJVbFwiKS5hdHRyKFwidGFiSW5kZXhcIiwgXCIwXCIpO1xuICAgIGdldFRvcFRpZXJNZW51aXRlbXMoKTtcbiAgICBzdG9yYWdlQVBJID0gY3JlYXRlUHJvZ3JhbUNvbGxlY3Rpb25BUEkoXCJjb2RlLnB5cmV0Lm9yZ1wiLCBmYWxzZSk7XG4gICAgc3RvcmFnZUFQSS50aGVuKGZ1bmN0aW9uKGFwaSkge1xuICAgICAgYXBpLmNvbGxlY3Rpb24udGhlbihmdW5jdGlvbigpIHtcbiAgICAgICAgJChcIi5sb2dpbk9ubHlcIikuc2hvdygpO1xuICAgICAgICAkKFwiLmxvZ291dE9ubHlcIikuaGlkZSgpO1xuICAgICAgICBkb2N1bWVudC5hY3RpdmVFbGVtZW50LmJsdXIoKTtcbiAgICAgICAgJChcIiNib25uaWVtZW51YnV0dG9uXCIpLmZvY3VzKCk7XG4gICAgICAgIHNldFVzZXJuYW1lKCQoXCIjdXNlcm5hbWVcIikpO1xuICAgICAgICBpZihwYXJhbXNbXCJnZXRcIl0gJiYgcGFyYW1zW1wiZ2V0XCJdW1wicHJvZ3JhbVwiXSkge1xuICAgICAgICAgIHZhciB0b0xvYWQgPSBhcGkuYXBpLmdldEZpbGVCeUlkKHBhcmFtc1tcImdldFwiXVtcInByb2dyYW1cIl0pO1xuICAgICAgICAgIGNvbnNvbGUubG9nKFwiTG9nZ2VkIGluIGFuZCBoYXMgcHJvZ3JhbSB0byBsb2FkOiBcIiwgdG9Mb2FkKTtcbiAgICAgICAgICBsb2FkUHJvZ3JhbSh0b0xvYWQpO1xuICAgICAgICAgIHByb2dyYW1Ub1NhdmUgPSB0b0xvYWQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcHJvZ3JhbVRvU2F2ZSA9IFEuZmNhbGwoZnVuY3Rpb24oKSB7IHJldHVybiBudWxsOyB9KTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgICBhcGkuY29sbGVjdGlvbi5mYWlsKGZ1bmN0aW9uKCkge1xuICAgICAgICAkKFwiI2Nvbm5lY3RCdXR0b25cIikudGV4dChcIkNvbm5lY3QgdG8gR29vZ2xlIERyaXZlXCIpO1xuICAgICAgICAkKFwiI2Nvbm5lY3RCdXR0b25cIikuYXR0cihcImRpc2FibGVkXCIsIGZhbHNlKTtcbiAgICAgICAgJCgnI2Nvbm5lY3RCdXR0b25saScpLmF0dHIoJ2Rpc2FibGVkJywgZmFsc2UpO1xuICAgICAgICAvLyQoXCIjY29ubmVjdEJ1dHRvblwiKS5hdHRyKFwidGFiSW5kZXhcIiwgXCIwXCIpO1xuICAgICAgICBkb2N1bWVudC5hY3RpdmVFbGVtZW50LmJsdXIoKTtcbiAgICAgICAgJChcIiNjb25uZWN0QnV0dG9uXCIpLmZvY3VzKCk7XG4gICAgICAgIC8vJChcIiN0b3BUaWVyVWxcIikuYXR0cihcInRhYkluZGV4XCIsIFwiLTFcIik7XG4gICAgICB9KTtcbiAgICB9KTtcbiAgICBzdG9yYWdlQVBJID0gc3RvcmFnZUFQSS50aGVuKGZ1bmN0aW9uKGFwaSkgeyByZXR1cm4gYXBpLmFwaTsgfSk7XG4gIH0pO1xuXG4gIC8qXG4gICAgaW5pdGlhbFByb2dyYW0gaG9sZHMgYSBwcm9taXNlIGZvciBhIERyaXZlIEZpbGUgb2JqZWN0IG9yIG51bGxcblxuICAgIEl0J3MgbnVsbCBpZiB0aGUgcGFnZSBkb2Vzbid0IGhhdmUgYSAjc2hhcmUgb3IgI3Byb2dyYW0gdXJsXG5cbiAgICBJZiB0aGUgdXJsIGRvZXMgaGF2ZSBhICNwcm9ncmFtIG9yICNzaGFyZSwgdGhlIHByb21pc2UgaXMgZm9yIHRoZVxuICAgIGNvcnJlc3BvbmRpbmcgb2JqZWN0LlxuICAqL1xuICBsZXQgaW5pdGlhbFByb2dyYW07XG4gIGlmKHBhcmFtc1tcImdldFwiXSAmJiBwYXJhbXNbXCJnZXRcIl1bXCJzaGFyZXVybFwiXSkge1xuICAgIGluaXRpYWxQcm9ncmFtID0gbWFrZVVybEZpbGUocGFyYW1zW1wiZ2V0XCJdW1wic2hhcmV1cmxcIl0pO1xuICB9XG4gIGVsc2Uge1xuICAgIGluaXRpYWxQcm9ncmFtID0gc3RvcmFnZUFQSS50aGVuKGZ1bmN0aW9uKGFwaSkge1xuICAgICAgdmFyIHByb2dyYW1Mb2FkID0gbnVsbDtcbiAgICAgIGlmKHBhcmFtc1tcImdldFwiXSAmJiBwYXJhbXNbXCJnZXRcIl1bXCJwcm9ncmFtXCJdKSB7XG4gICAgICAgIGVuYWJsZUZpbGVPcHRpb25zKCk7XG4gICAgICAgIHByb2dyYW1Mb2FkID0gYXBpLmdldEZpbGVCeUlkKHBhcmFtc1tcImdldFwiXVtcInByb2dyYW1cIl0pO1xuICAgICAgICBwcm9ncmFtTG9hZC50aGVuKGZ1bmN0aW9uKHApIHsgc2hvd1NoYXJlQ29udGFpbmVyKHApOyB9KTtcbiAgICAgIH1cbiAgICAgIGVsc2UgaWYocGFyYW1zW1wiZ2V0XCJdICYmIHBhcmFtc1tcImdldFwiXVtcInNoYXJlXCJdKSB7XG4gICAgICAgIGxvZ2dlci5sb2coJ3NoYXJlZC1wcm9ncmFtLWxvYWQnLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkOiBwYXJhbXNbXCJnZXRcIl1bXCJzaGFyZVwiXVxuICAgICAgICAgIH0pO1xuICAgICAgICBwcm9ncmFtTG9hZCA9IGFwaS5nZXRTaGFyZWRGaWxlQnlJZChwYXJhbXNbXCJnZXRcIl1bXCJzaGFyZVwiXSk7XG4gICAgICAgIHByb2dyYW1Mb2FkLnRoZW4oZnVuY3Rpb24oZmlsZSkge1xuICAgICAgICAgIC8vIE5PVEUoam9lKTogSWYgdGhlIGN1cnJlbnQgdXNlciBkb2Vzbid0IG93biBvciBoYXZlIGFjY2VzcyB0byB0aGlzIGZpbGVcbiAgICAgICAgICAvLyAob3IgaXNuJ3QgbG9nZ2VkIGluKSB0aGlzIHdpbGwgc2ltcGx5IGZhaWwgd2l0aCBhIDQwMSwgc28gd2UgZG9uJ3QgZG9cbiAgICAgICAgICAvLyBhbnkgZnVydGhlciBwZXJtaXNzaW9uIGNoZWNraW5nIGJlZm9yZSBzaG93aW5nIHRoZSBsaW5rLlxuICAgICAgICAgIGZpbGUuZ2V0T3JpZ2luYWwoKS50aGVuKGZ1bmN0aW9uKHJlc3BvbnNlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmxvZyhcIlJlc3BvbnNlIGZvciBvcmlnaW5hbDogXCIsIHJlc3BvbnNlKTtcbiAgICAgICAgICAgIHZhciBvcmlnaW5hbCA9ICQoXCIjb3Blbi1vcmlnaW5hbFwiKS5zaG93KCkub2ZmKFwiY2xpY2tcIik7XG4gICAgICAgICAgICB2YXIgaWQgPSByZXNwb25zZS5yZXN1bHQudmFsdWU7XG4gICAgICAgICAgICBvcmlnaW5hbC5yZW1vdmVDbGFzcyhcImhpZGRlblwiKTtcbiAgICAgICAgICAgIG9yaWdpbmFsLmNsaWNrKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICB3aW5kb3cub3Blbih3aW5kb3cuQVBQX0JBU0VfVVJMICsgXCIvZWRpdG9yI3Byb2dyYW09XCIgKyBpZCwgXCJfYmxhbmtcIik7XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgcHJvZ3JhbUxvYWQgPSBudWxsO1xuICAgICAgfVxuICAgICAgaWYocHJvZ3JhbUxvYWQpIHtcbiAgICAgICAgcHJvZ3JhbUxvYWQuZmFpbChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgICAgICAgd2luZG93LnN0aWNrRXJyb3IoXCJUaGUgcHJvZ3JhbSBmYWlsZWQgdG8gbG9hZC5cIik7XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gcHJvZ3JhbUxvYWQ7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH1cbiAgICB9KS5jYXRjaChlID0+IHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoXCJzdG9yYWdlQVBJIGZhaWxlZCB0byBsb2FkLCBwcm9jZWVkaW5nIHdpdGhvdXQgc2F2aW5nIHByb2dyYW1zOiBcIiwgZSk7XG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9KTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNldFRpdGxlKHByb2dOYW1lKSB7XG4gICAgZG9jdW1lbnQudGl0bGUgPSBwcm9nTmFtZSArIFwiIC0gY29kZS5weXJldC5vcmdcIjtcbiAgICAkKFwiI3Nob3dGaWxlbmFtZVwiKS50ZXh0KFwiRmlsZTogXCIgKyBwcm9nTmFtZSk7XG4gIH1cbiAgQ1BPLnNldFRpdGxlID0gc2V0VGl0bGU7XG5cbiAgdmFyIGZpbGVuYW1lID0gZmFsc2U7XG5cbiAgJChcIiNkb3dubG9hZCBhXCIpLmNsaWNrKGZ1bmN0aW9uKCkge1xuICAgIHZhciBkb3dubG9hZEVsdCA9ICQoXCIjZG93bmxvYWQgYVwiKTtcbiAgICB2YXIgY29udGVudHMgPSBDUE8uZWRpdG9yLmNtLmdldFZhbHVlKCk7XG4gICAgdmFyIGRvd25sb2FkQmxvYiA9IHdpbmRvdy5VUkwuY3JlYXRlT2JqZWN0VVJMKG5ldyBCbG9iKFtjb250ZW50c10sIHt0eXBlOiAndGV4dC9wbGFpbid9KSk7XG4gICAgaWYoIWZpbGVuYW1lKSB7IGZpbGVuYW1lID0gJ3VudGl0bGVkX3Byb2dyYW0uYXJyJzsgfVxuICAgIGlmKGZpbGVuYW1lLmluZGV4T2YoXCIuYXJyXCIpICE9PSAoZmlsZW5hbWUubGVuZ3RoIC0gNCkpIHtcbiAgICAgIGZpbGVuYW1lICs9IFwiLmFyclwiO1xuICAgIH1cbiAgICBkb3dubG9hZEVsdC5hdHRyKHtcbiAgICAgIGRvd25sb2FkOiBmaWxlbmFtZSxcbiAgICAgIGhyZWY6IGRvd25sb2FkQmxvYlxuICAgIH0pO1xuICAgICQoXCIjZG93bmxvYWRcIikuYXBwZW5kKGRvd25sb2FkRWx0KTtcbiAgfSk7XG5cbiAgZnVuY3Rpb24gc2hvd01vZGFsKGN1cnJlbnRDb250ZXh0KSB7XG4gICAgZnVuY3Rpb24gZHJhd0VsZW1lbnQoaW5wdXQpIHtcbiAgICAgIGNvbnN0IGVsZW1lbnQgPSAkKFwiPGRpdj5cIik7XG4gICAgICBjb25zdCBncmVldGluZyA9ICQoXCI8cD5cIik7XG4gICAgICBjb25zdCBzaGFyZWQgPSAkKFwiPHR0PnNoYXJlZC1nZHJpdmUoLi4uKTwvdHQ+XCIpO1xuICAgICAgY29uc3QgY3VycmVudENvbnRleHRFbHQgPSAkKFwiPHR0PlwiICsgY3VycmVudENvbnRleHQgKyBcIjwvdHQ+XCIpO1xuICAgICAgZ3JlZXRpbmcuYXBwZW5kKFwiRW50ZXIgdGhlIGNvbnRleHQgdG8gdXNlIGZvciB0aGUgcHJvZ3JhbSwgb3IgY2hvb3NlIOKAnENhbmNlbOKAnSB0byBrZWVwIHRoZSBjdXJyZW50IGNvbnRleHQgb2YgXCIsIGN1cnJlbnRDb250ZXh0RWx0LCBcIi5cIik7XG4gICAgICBjb25zdCBlc3NlbnRpYWxzID0gJChcIjx0dD5zdGFydGVyMjAyNDwvdHQ+XCIpO1xuICAgICAgY29uc3QgbGlzdCA9ICQoXCI8dWw+XCIpXG4gICAgICAgIC5hcHBlbmQoJChcIjxsaT5cIikuYXBwZW5kKFwiVGhlIGRlZmF1bHQgaXMgXCIsIGVzc2VudGlhbHMsIFwiLlwiKSlcbiAgICAgICAgLmFwcGVuZCgkKFwiPGxpPlwiKS5hcHBlbmQoXCJZb3UgbWlnaHQgdXNlIHNvbWV0aGluZyBsaWtlIFwiLCBzaGFyZWQsIFwiIGlmIG9uZSB3YXMgcHJvdmlkZWQgYXMgcGFydCBvZiBhIGNvdXJzZS5cIikpO1xuICAgICAgZWxlbWVudC5hcHBlbmQoZ3JlZXRpbmcpO1xuICAgICAgZWxlbWVudC5hcHBlbmQoJChcIjxwPlwiKS5hcHBlbmQobGlzdCkpO1xuICAgICAgY29uc3QgdXNlQ29udGV4dCA9ICQoXCI8dHQ+dXNlIGNvbnRleHQ8L3R0PlwiKS5jc3MoeyAnZmxleC1ncm93JzogJzAnLCAncGFkZGluZy1yaWdodCc6ICcxZW0nIH0pO1xuICAgICAgY29uc3QgaW5wdXRXcmFwcGVyID0gJChcIjxkaXY+XCIpLmFwcGVuZChpbnB1dCkuY3NzKHsgJ2ZsZXgtZ3Jvdyc6ICcxJyB9KTtcbiAgICAgIGNvbnN0IGVudHJ5ID0gJChcIjxkaXY+XCIpLmNzcyh7XG4gICAgICAgIGRpc3BsYXk6ICdmbGV4JyxcbiAgICAgICAgJ2ZsZXgtZGlyZWN0aW9uJzogJ3JvdycsXG4gICAgICAgICdqdXN0aWZ5LWNvbnRlbnQnOiAnZmxleC1zdGFydCcsXG4gICAgICAgICdhbGlnbi1pdGVtcyc6ICdiYXNlbGluZSdcbiAgICAgIH0pO1xuICAgICAgZW50cnkuYXBwZW5kKHVzZUNvbnRleHQpLmFwcGVuZChpbnB1dFdyYXBwZXIpO1xuICAgICAgZWxlbWVudC5hcHBlbmQoZW50cnkpO1xuICAgICAgcmV0dXJuIGVsZW1lbnQ7XG4gICAgfVxuICAgIGNvbnN0IG5hbWVzcGFjZVJlc3VsdCA9IG5ldyBtb2RhbFByb21wdCh7XG4gICAgICAgIHRpdGxlOiBcIkNob29zZSBhIENvbnRleHRcIixcbiAgICAgICAgc3R5bGU6IFwidGV4dFwiLFxuICAgICAgICBvcHRpb25zOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgZHJhd0VsZW1lbnQ6IGRyYXdFbGVtZW50LFxuICAgICAgICAgICAgc3VibWl0VGV4dDogXCJDaGFuZ2UgTmFtZXNwYWNlXCIsXG4gICAgICAgICAgICBkZWZhdWx0VmFsdWU6IGN1cnJlbnRDb250ZXh0XG4gICAgICAgICAgfVxuICAgICAgICBdXG4gICAgICB9KTtcbiAgICBuYW1lc3BhY2VSZXN1bHQuc2hvdygocmVzdWx0KSA9PiB7XG4gICAgICBpZighcmVzdWx0KSB7IHJldHVybjsgfVxuICAgICAgQ1BPLmVkaXRvci5zZXRDb250ZXh0TGluZShcInVzZSBjb250ZXh0IFwiICsgcmVzdWx0LnRyaW0oKSArIFwiXFxuXCIpO1xuICAgIH0pO1xuICB9XG4gICQoXCIjY2hvb3NlLWNvbnRleHRcIikub24oXCJjbGlja1wiLCBmdW5jdGlvbigpIHtcbiAgICBjb25zdCBmaXJzdExpbmUgPSBDUE8uZWRpdG9yLmNtLmdldExpbmUoMCk7XG4gICAgY29uc3QgY29udGV4dExlbiA9IGZpcnN0TGluZS5tYXRjaChDT05URVhUX1BSRUZJWCk7XG4gICAgc2hvd01vZGFsKGNvbnRleHRMZW4gPT09IG51bGwgPyBcIlwiIDogZmlyc3RMaW5lLnNsaWNlKGNvbnRleHRMZW5bMF0ubGVuZ3RoKSk7XG4gIH0pO1xuXG4gIHZhciBUUlVOQ0FURV9MRU5HVEggPSAyMDtcblxuICBmdW5jdGlvbiB0cnVuY2F0ZU5hbWUobmFtZSkge1xuICAgIGlmKG5hbWUubGVuZ3RoIDw9IFRSVU5DQVRFX0xFTkdUSCArIDEpIHsgcmV0dXJuIG5hbWU7IH1cbiAgICByZXR1cm4gbmFtZS5zbGljZSgwLCBUUlVOQ0FURV9MRU5HVEggLyAyKSArIFwi4oCmXCIgKyBuYW1lLnNsaWNlKG5hbWUubGVuZ3RoIC0gVFJVTkNBVEVfTEVOR1RIIC8gMiwgbmFtZS5sZW5ndGgpO1xuICB9XG5cbiAgZnVuY3Rpb24gdXBkYXRlTmFtZShwKSB7XG4gICAgZmlsZW5hbWUgPSBwLmdldE5hbWUoKTtcbiAgICAkKFwiI2ZpbGVuYW1lXCIpLnRleHQoXCIgKFwiICsgdHJ1bmNhdGVOYW1lKGZpbGVuYW1lKSArIFwiKVwiKTtcbiAgICAkKFwiI2ZpbGVuYW1lXCIpLmF0dHIoJ3RpdGxlJywgZmlsZW5hbWUpO1xuICAgIHNldFRpdGxlKGZpbGVuYW1lKTtcbiAgICBzaG93U2hhcmVDb250YWluZXIocCk7XG4gIH1cblxuICBmdW5jdGlvbiBsb2FkUHJvZ3JhbShwKSB7XG4gICAgcHJvZ3JhbVRvU2F2ZSA9IHA7XG4gICAgcmV0dXJuIHAudGhlbihmdW5jdGlvbihwcm9nKSB7XG4gICAgICBpZihwcm9nICE9PSBudWxsKSB7XG4gICAgICAgIHVwZGF0ZU5hbWUocHJvZyk7XG4gICAgICAgIGlmKHByb2cuc2hhcmVkKSB7XG4gICAgICAgICAgd2luZG93LnN0aWNrTWVzc2FnZShcIllvdSBhcmUgdmlld2luZyBhIHNoYXJlZCBwcm9ncmFtLiBBbnkgY2hhbmdlcyB5b3UgbWFrZSB3aWxsIG5vdCBiZSBzYXZlZC4gWW91IGNhbiB1c2UgRmlsZSAtPiBTYXZlIGEgY29weSB0byBzYXZlIHlvdXIgb3duIHZlcnNpb24gd2l0aCBhbnkgZWRpdHMgeW91IG1ha2UuXCIpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBwcm9nLmdldENvbnRlbnRzKCk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgaWYocGFyYW1zW1wiZ2V0XCJdW1wiZWRpdG9yQ29udGVudHNcIl0gJiYgIShwYXJhbXNbXCJnZXRcIl1bXCJwcm9ncmFtXCJdIHx8IHBhcmFtc1tcImdldFwiXVtcInNoYXJlXCJdKSkge1xuICAgICAgICAgIHJldHVybiBwYXJhbXNbXCJnZXRcIl1bXCJlZGl0b3JDb250ZW50c1wiXTtcbiAgICAgICAgfVxuICAgICAgICBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gQ09OVEVYVF9GT1JfTkVXX0ZJTEVTO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICBmdW5jdGlvbiBzYXkobXNnLCBmb3JnZXQpIHtcbiAgICBpZiAobXNnID09PSBcIlwiKSByZXR1cm47XG4gICAgdmFyIGFubm91bmNlbWVudHMgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImFubm91bmNlbWVudGxpc3RcIik7XG4gICAgdmFyIGxpID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcIkxJXCIpO1xuICAgIGxpLmFwcGVuZENoaWxkKGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKG1zZykpO1xuICAgIGFubm91bmNlbWVudHMuaW5zZXJ0QmVmb3JlKGxpLCBhbm5vdW5jZW1lbnRzLmZpcnN0Q2hpbGQpO1xuICAgIGlmIChmb3JnZXQpIHtcbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAgIGFubm91bmNlbWVudHMucmVtb3ZlQ2hpbGQobGkpO1xuICAgICAgfSwgMTAwMCk7XG4gICAgfVxuICB9XG5cbiAgZnVuY3Rpb24gc2F5QW5kRm9yZ2V0KG1zZykge1xuICAgIGNvbnNvbGUubG9nKCdkb2luZyBzYXlBbmRGb3JnZXQnLCBtc2cpO1xuICAgIHNheShtc2csIHRydWUpO1xuICB9XG5cbiAgZnVuY3Rpb24gY3ljbGVBZHZhbmNlKGN1cnJJbmRleCwgbWF4SW5kZXgsIHJldmVyc2VQKSB7XG4gICAgdmFyIG5leHRJbmRleCA9IGN1cnJJbmRleCArIChyZXZlcnNlUD8gLTEgOiArMSk7XG4gICAgbmV4dEluZGV4ID0gKChuZXh0SW5kZXggJSBtYXhJbmRleCkgKyBtYXhJbmRleCkgJSBtYXhJbmRleDtcbiAgICByZXR1cm4gbmV4dEluZGV4O1xuICB9XG5cbiAgZnVuY3Rpb24gcG9wdWxhdGVGb2N1c0Nhcm91c2VsKGVkaXRvcikge1xuICAgIGlmICghZWRpdG9yLmZvY3VzQ2Fyb3VzZWwpIHtcbiAgICAgIGVkaXRvci5mb2N1c0Nhcm91c2VsID0gW107XG4gICAgfVxuICAgIHZhciBmYyA9IGVkaXRvci5mb2N1c0Nhcm91c2VsO1xuICAgIHZhciBkb2NtYWluID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJtYWluXCIpO1xuICAgIGlmICghZmNbMF0pIHtcbiAgICAgIHZhciB0b29sYmFyID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ1Rvb2xiYXInKTtcbiAgICAgIGZjWzBdID0gdG9vbGJhcjtcbiAgICAgIC8vZmNbMF0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcImhlYWRlcm9uZWxlZ2VuZFwiKTtcbiAgICAgIC8vZ2V0VG9wVGllck1lbnVpdGVtcygpO1xuICAgICAgLy9mY1swXSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdib25uaWVtZW51YnV0dG9uJyk7XG4gICAgfVxuICAgIGlmICghZmNbMV0pIHtcbiAgICAgIHZhciBkb2NyZXBsTWFpbiA9IGRvY21haW4uZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcInJlcGxNYWluXCIpO1xuICAgICAgdmFyIGRvY3JlcGxNYWluMDtcbiAgICAgIGlmIChkb2NyZXBsTWFpbi5sZW5ndGggPT09IDApIHtcbiAgICAgICAgZG9jcmVwbE1haW4wID0gdW5kZWZpbmVkO1xuICAgICAgfSBlbHNlIGlmIChkb2NyZXBsTWFpbi5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgZG9jcmVwbE1haW4wID0gZG9jcmVwbE1haW5bMF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGRvY3JlcGxNYWluLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgaWYgKGRvY3JlcGxNYWluW2ldLmlubmVyVGV4dCAhPT0gXCJcIikge1xuICAgICAgICAgICAgZG9jcmVwbE1haW4wID0gZG9jcmVwbE1haW5baV07XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICBmY1sxXSA9IGRvY3JlcGxNYWluMDtcbiAgICB9XG4gICAgaWYgKCFmY1syXSkge1xuICAgICAgdmFyIGRvY3JlcGwgPSBkb2NtYWluLmdldEVsZW1lbnRzQnlDbGFzc05hbWUoXCJyZXBsXCIpO1xuICAgICAgdmFyIGRvY3JlcGxjb2RlID0gZG9jcmVwbFswXS5nZXRFbGVtZW50c0J5Q2xhc3NOYW1lKFwicHJvbXB0LWNvbnRhaW5lclwiKVswXS5cbiAgICAgICAgZ2V0RWxlbWVudHNCeUNsYXNzTmFtZShcIkNvZGVNaXJyb3JcIilbMF07XG4gICAgICBmY1syXSA9IGRvY3JlcGxjb2RlO1xuICAgIH1cbiAgICBpZiAoIWZjWzNdKSB7XG4gICAgICBmY1szXSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwiYW5ub3VuY2VtZW50c1wiKTtcbiAgICB9XG4gIH1cblxuICBmdW5jdGlvbiBjeWNsZUZvY3VzKHJldmVyc2VQKSB7XG4gICAgLy9jb25zb2xlLmxvZygnZG9pbmcgY3ljbGVGb2N1cycsIHJldmVyc2VQKTtcbiAgICB2YXIgZWRpdG9yID0gdGhpcy5lZGl0b3I7XG4gICAgcG9wdWxhdGVGb2N1c0Nhcm91c2VsKGVkaXRvcik7XG4gICAgdmFyIGZDYXJvdXNlbCA9IGVkaXRvci5mb2N1c0Nhcm91c2VsO1xuICAgIHZhciBtYXhJbmRleCA9IGZDYXJvdXNlbC5sZW5ndGg7XG4gICAgdmFyIGN1cnJlbnRGb2N1c2VkRWx0ID0gZkNhcm91c2VsLmZpbmQoZnVuY3Rpb24obm9kZSkge1xuICAgICAgaWYgKCFub2RlKSB7XG4gICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBub2RlLmNvbnRhaW5zKGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQpO1xuICAgICAgfVxuICAgIH0pO1xuICAgIHZhciBjdXJyZW50Rm9jdXNJbmRleCA9IGZDYXJvdXNlbC5pbmRleE9mKGN1cnJlbnRGb2N1c2VkRWx0KTtcbiAgICB2YXIgbmV4dEZvY3VzSW5kZXggPSBjdXJyZW50Rm9jdXNJbmRleDtcbiAgICB2YXIgZm9jdXNFbHQ7XG4gICAgZG8ge1xuICAgICAgbmV4dEZvY3VzSW5kZXggPSBjeWNsZUFkdmFuY2UobmV4dEZvY3VzSW5kZXgsIG1heEluZGV4LCByZXZlcnNlUCk7XG4gICAgICBmb2N1c0VsdCA9IGZDYXJvdXNlbFtuZXh0Rm9jdXNJbmRleF07XG4gICAgICAvL2NvbnNvbGUubG9nKCd0cnlpbmcgZm9jdXNFbHQnLCBmb2N1c0VsdCk7XG4gICAgfSB3aGlsZSAoIWZvY3VzRWx0KTtcblxuICAgIHZhciBmb2N1c0VsdDA7XG4gICAgaWYgKGZvY3VzRWx0LmNsYXNzTGlzdC5jb250YWlucygndG9vbGJhcnJlZ2lvbicpKSB7XG4gICAgICAvL2NvbnNvbGUubG9nKCdzZXR0bGluZyBvbiB0b29sYmFyIHJlZ2lvbicpXG4gICAgICBnZXRUb3BUaWVyTWVudWl0ZW1zKCk7XG4gICAgICBmb2N1c0VsdDAgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYm9ubmllbWVudWJ1dHRvbicpO1xuICAgIH0gZWxzZSBpZiAoZm9jdXNFbHQuY2xhc3NMaXN0LmNvbnRhaW5zKFwicmVwbE1haW5cIikgfHxcbiAgICAgIGZvY3VzRWx0LmNsYXNzTGlzdC5jb250YWlucyhcIkNvZGVNaXJyb3JcIikpIHtcbiAgICAgIC8vY29uc29sZS5sb2coJ3NldHRsaW5nIG9uIGRlZm4gd2luZG93JylcbiAgICAgIHZhciB0ZXh0YXJlYXMgPSBmb2N1c0VsdC5nZXRFbGVtZW50c0J5VGFnTmFtZShcInRleHRhcmVhXCIpO1xuICAgICAgLy9jb25zb2xlLmxvZygndHh0YXJlYXM9JywgdGV4dGFyZWFzKVxuICAgICAgLy9jb25zb2xlLmxvZygndHh0YXJlYSBsZW49JywgdGV4dGFyZWFzLmxlbmd0aClcbiAgICAgIGlmICh0ZXh0YXJlYXMubGVuZ3RoID09PSAwKSB7XG4gICAgICAgIC8vY29uc29sZS5sb2coJ0knKVxuICAgICAgICBmb2N1c0VsdDAgPSBmb2N1c0VsdDtcbiAgICAgIH0gZWxzZSBpZiAodGV4dGFyZWFzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAvL2NvbnNvbGUubG9nKCdzZXR0bGluZyBvbiBpbnRlciB3aW5kb3cnKVxuICAgICAgICBmb2N1c0VsdDAgPSB0ZXh0YXJlYXNbMF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvL2NvbnNvbGUubG9nKCdzZXR0bGluZyBvbiBkZWZuIHdpbmRvdycpXG4gICAgICAgIC8qXG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgdGV4dGFyZWFzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgICAgaWYgKHRleHRhcmVhc1tpXS5nZXRBdHRyaWJ1dGUoJ3RhYkluZGV4JykpIHtcbiAgICAgICAgICAgIGZvY3VzRWx0MCA9IHRleHRhcmVhc1tpXTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgKi9cbiAgICAgICAgZm9jdXNFbHQwID0gdGV4dGFyZWFzW3RleHRhcmVhcy5sZW5ndGgtMV07XG4gICAgICAgIGZvY3VzRWx0MC5yZW1vdmVBdHRyaWJ1dGUoJ3RhYkluZGV4Jyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vY29uc29sZS5sb2coJ3NldHRsaW5nIG9uIGFubm91bmNlbWVudCByZWdpb24nLCBmb2N1c0VsdClcbiAgICAgIGZvY3VzRWx0MCA9IGZvY3VzRWx0O1xuICAgIH1cblxuICAgIGRvY3VtZW50LmFjdGl2ZUVsZW1lbnQuYmx1cigpO1xuICAgIGZvY3VzRWx0MC5jbGljaygpO1xuICAgIGZvY3VzRWx0MC5mb2N1cygpO1xuICAgIC8vY29uc29sZS5sb2coJyhjZilkb2NhY3RlbHQ9JywgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCk7XG4gIH1cblxuICB2YXIgcHJvZ3JhbUxvYWRlZCA9IGxvYWRQcm9ncmFtKGluaXRpYWxQcm9ncmFtKTtcblxuICB2YXIgcHJvZ3JhbVRvU2F2ZSA9IGluaXRpYWxQcm9ncmFtO1xuXG4gIGZ1bmN0aW9uIHNob3dTaGFyZUNvbnRhaW5lcihwKSB7XG4gICAgLy9jb25zb2xlLmxvZygnY2FsbGVkIHNob3dTaGFyZUNvbnRhaW5lcicpO1xuICAgIGlmKCFwLnNoYXJlZCkge1xuICAgICAgJChcIiNzaGFyZUNvbnRhaW5lclwiKS5lbXB0eSgpO1xuICAgICAgJCgnI3B1Ymxpc2hsaScpLnNob3coKTtcbiAgICAgICQoXCIjc2hhcmVDb250YWluZXJcIikuYXBwZW5kKHNoYXJlQVBJLm1ha2VTaGFyZUxpbmsocCkpO1xuICAgICAgZ2V0VG9wVGllck1lbnVpdGVtcygpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG5hbWVPclVudGl0bGVkKCkge1xuICAgIHJldHVybiBmaWxlbmFtZSB8fCBcIlVudGl0bGVkXCI7XG4gIH1cbiAgZnVuY3Rpb24gYXV0b1NhdmUoKSB7XG4gICAgcHJvZ3JhbVRvU2F2ZS50aGVuKGZ1bmN0aW9uKHApIHtcbiAgICAgIGlmKHAgIT09IG51bGwgJiYgIXAuc2hhcmVkKSB7IHNhdmUoKTsgfVxuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gZW5hYmxlRmlsZU9wdGlvbnMoKSB7XG4gICAgJChcIiNmaWxlbWVudUNvbnRlbnRzICpcIikucmVtb3ZlQ2xhc3MoXCJkaXNhYmxlZFwiKTtcbiAgfVxuXG4gIGZ1bmN0aW9uIG1lbnVJdGVtRGlzYWJsZWQoaWQpIHtcbiAgICByZXR1cm4gJChcIiNcIiArIGlkKS5oYXNDbGFzcyhcImRpc2FibGVkXCIpO1xuICB9XG5cbiAgZnVuY3Rpb24gbmV3RXZlbnQoZSkge1xuICAgIHdpbmRvdy5vcGVuKHdpbmRvdy5BUFBfQkFTRV9VUkwgKyBcIi9lZGl0b3JcIik7XG4gIH1cblxuICBmdW5jdGlvbiBzYXZlRXZlbnQoZSkge1xuICAgIGlmKG1lbnVJdGVtRGlzYWJsZWQoXCJzYXZlXCIpKSB7IHJldHVybjsgfVxuICAgIHJldHVybiBzYXZlKCk7XG4gIH1cblxuICAvKlxuICAgIHNhdmUgOiBzdHJpbmcgKG9wdGlvbmFsKSAtPiB1bmRlZlxuXG4gICAgSWYgYSBzdHJpbmcgYXJndW1lbnQgaXMgcHJvdmlkZWQsIGNyZWF0ZSBhIG5ldyBmaWxlIHdpdGggdGhhdCBuYW1lIGFuZCBzYXZlXG4gICAgdGhlIGVkaXRvciBjb250ZW50cyBpbiB0aGF0IGZpbGUuXG5cbiAgICBJZiBubyBmaWxlbmFtZSBpcyBwcm92aWRlZCwgc2F2ZSB0aGUgZXhpc3RpbmcgZmlsZSByZWZlcmVuY2VkIGJ5IHRoZSBlZGl0b3JcbiAgICB3aXRoIHRoZSBjdXJyZW50IGVkaXRvciBjb250ZW50cy4gIElmIG5vIGZpbGVuYW1lIGhhcyBiZWVuIHNldCB5ZXQsIGp1c3RcbiAgICBzZXQgdGhlIG5hbWUgdG8gXCJVbnRpdGxlZFwiLlxuXG4gICovXG4gIGZ1bmN0aW9uIHNhdmUobmV3RmlsZW5hbWUpIHtcbiAgICB2YXIgdXNlTmFtZSwgY3JlYXRlO1xuICAgIGlmKG5ld0ZpbGVuYW1lICE9PSB1bmRlZmluZWQpIHtcbiAgICAgIHVzZU5hbWUgPSBuZXdGaWxlbmFtZTtcbiAgICAgIGNyZWF0ZSA9IHRydWU7XG4gICAgfVxuICAgIGVsc2UgaWYoZmlsZW5hbWUgPT09IGZhbHNlKSB7XG4gICAgICBmaWxlbmFtZSA9IFwiVW50aXRsZWRcIjtcbiAgICAgIGNyZWF0ZSA9IHRydWU7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdXNlTmFtZSA9IGZpbGVuYW1lOyAvLyBBIGNsb3NlZC1vdmVyIHZhcmlhYmxlXG4gICAgICBjcmVhdGUgPSBmYWxzZTtcbiAgICB9XG4gICAgd2luZG93LnN0aWNrTWVzc2FnZShcIlNhdmluZy4uLlwiKTtcbiAgICB2YXIgc2F2ZWRQcm9ncmFtID0gcHJvZ3JhbVRvU2F2ZS50aGVuKGZ1bmN0aW9uKHApIHtcbiAgICAgIGlmKHAgIT09IG51bGwgJiYgcC5zaGFyZWQgJiYgIWNyZWF0ZSkge1xuICAgICAgICByZXR1cm4gcDsgLy8gRG9uJ3QgdHJ5IHRvIHNhdmUgc2hhcmVkIGZpbGVzXG4gICAgICB9XG4gICAgICBpZihjcmVhdGUpIHtcbiAgICAgICAgcHJvZ3JhbVRvU2F2ZSA9IHN0b3JhZ2VBUElcbiAgICAgICAgICAudGhlbihmdW5jdGlvbihhcGkpIHsgcmV0dXJuIGFwaS5jcmVhdGVGaWxlKHVzZU5hbWUpOyB9KVxuICAgICAgICAgIC50aGVuKGZ1bmN0aW9uKHApIHtcbiAgICAgICAgICAgIC8vIHNob3dTaGFyZUNvbnRhaW5lcihwKTsgVE9ETyhqb2UpOiBmaWd1cmUgb3V0IHdoZXJlIHRvIHB1dCB0aGlzXG4gICAgICAgICAgICBoaXN0b3J5LnB1c2hTdGF0ZShudWxsLCBudWxsLCBcIiNwcm9ncmFtPVwiICsgcC5nZXRVbmlxdWVJZCgpKTtcbiAgICAgICAgICAgIHVwZGF0ZU5hbWUocCk7IC8vIHNldHMgZmlsZW5hbWVcbiAgICAgICAgICAgIGVuYWJsZUZpbGVPcHRpb25zKCk7XG4gICAgICAgICAgICByZXR1cm4gcDtcbiAgICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHByb2dyYW1Ub1NhdmUudGhlbihmdW5jdGlvbihwKSB7XG4gICAgICAgICAgcmV0dXJuIHNhdmUoKTtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHByb2dyYW1Ub1NhdmUudGhlbihmdW5jdGlvbihwKSB7XG4gICAgICAgICAgaWYocCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgICAgfVxuICAgICAgICAgIGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHAuc2F2ZShDUE8uZWRpdG9yLmNtLmdldFZhbHVlKCksIGZhbHNlKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pLnRoZW4oZnVuY3Rpb24ocCkge1xuICAgICAgICAgIGlmKHAgIT09IG51bGwpIHtcbiAgICAgICAgICAgIHdpbmRvdy5mbGFzaE1lc3NhZ2UoXCJQcm9ncmFtIHNhdmVkIGFzIFwiICsgcC5nZXROYW1lKCkpO1xuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gcDtcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG4gICAgc2F2ZWRQcm9ncmFtLmZhaWwoZnVuY3Rpb24oZXJyKSB7XG4gICAgICB3aW5kb3cuc3RpY2tFcnJvcihcIlVuYWJsZSB0byBzYXZlXCIsIFwiWW91ciBpbnRlcm5ldCBjb25uZWN0aW9uIG1heSBiZSBkb3duLCBvciBzb21ldGhpbmcgZWxzZSBtaWdodCBiZSB3cm9uZyB3aXRoIHRoaXMgc2l0ZSBvciBzYXZpbmcgdG8gR29vZ2xlLiAgWW91IHNob3VsZCBiYWNrIHVwIGFueSBjaGFuZ2VzIHRvIHRoaXMgcHJvZ3JhbSBzb21ld2hlcmUgZWxzZS4gIFlvdSBjYW4gdHJ5IHNhdmluZyBhZ2FpbiB0byBzZWUgaWYgdGhlIHByb2JsZW0gd2FzIHRlbXBvcmFyeSwgYXMgd2VsbC5cIik7XG4gICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgfSk7XG4gICAgcmV0dXJuIHNhdmVkUHJvZ3JhbTtcbiAgfVxuXG4gIGZ1bmN0aW9uIHNhdmVBcygpIHtcbiAgICBpZihtZW51SXRlbURpc2FibGVkKFwic2F2ZWFzXCIpKSB7IHJldHVybjsgfVxuICAgIHByb2dyYW1Ub1NhdmUudGhlbihmdW5jdGlvbihwKSB7XG4gICAgICB2YXIgbmFtZSA9IHAgPT09IG51bGwgPyBcIlVudGl0bGVkXCIgOiBwLmdldE5hbWUoKTtcbiAgICAgIHZhciBzYXZlQXNQcm9tcHQgPSBuZXcgbW9kYWxQcm9tcHQoe1xuICAgICAgICB0aXRsZTogXCJTYXZlIGEgY29weVwiLFxuICAgICAgICBzdHlsZTogXCJ0ZXh0XCIsXG4gICAgICAgIHN1Ym1pdFRleHQ6IFwiU2F2ZVwiLFxuICAgICAgICBuYXJyb3c6IHRydWUsXG4gICAgICAgIG9wdGlvbnM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBtZXNzYWdlOiBcIlRoZSBuYW1lIGZvciB0aGUgY29weTpcIixcbiAgICAgICAgICAgIGRlZmF1bHRWYWx1ZTogbmFtZVxuICAgICAgICAgIH1cbiAgICAgICAgXVxuICAgICAgfSk7XG4gICAgICByZXR1cm4gc2F2ZUFzUHJvbXB0LnNob3coKS50aGVuKGZ1bmN0aW9uKG5ld05hbWUpIHtcbiAgICAgICAgaWYobmV3TmFtZSA9PT0gbnVsbCkgeyByZXR1cm4gbnVsbDsgfVxuICAgICAgICB3aW5kb3cuc3RpY2tNZXNzYWdlKFwiU2F2aW5nLi4uXCIpO1xuICAgICAgICByZXR1cm4gc2F2ZShuZXdOYW1lKTtcbiAgICAgIH0pLlxuICAgICAgZmFpbChmdW5jdGlvbihlcnIpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihcIkZhaWxlZCB0byByZW5hbWU6IFwiLCBlcnIpO1xuICAgICAgICB3aW5kb3cuZmxhc2hFcnJvcihcIkZhaWxlZCB0byByZW5hbWUgZmlsZVwiKTtcbiAgICAgIH0pO1xuICAgIH0pO1xuICB9XG5cbiAgZnVuY3Rpb24gcmVuYW1lKCkge1xuICAgIHByb2dyYW1Ub1NhdmUudGhlbihmdW5jdGlvbihwKSB7XG4gICAgICB2YXIgcmVuYW1lUHJvbXB0ID0gbmV3IG1vZGFsUHJvbXB0KHtcbiAgICAgICAgdGl0bGU6IFwiUmVuYW1lIHRoaXMgZmlsZVwiLFxuICAgICAgICBzdHlsZTogXCJ0ZXh0XCIsXG4gICAgICAgIG5hcnJvdzogdHJ1ZSxcbiAgICAgICAgc3VibWl0VGV4dDogXCJSZW5hbWVcIixcbiAgICAgICAgb3B0aW9uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIG1lc3NhZ2U6IFwiVGhlIG5ldyBuYW1lIGZvciB0aGUgZmlsZTpcIixcbiAgICAgICAgICAgIGRlZmF1bHRWYWx1ZTogcC5nZXROYW1lKClcbiAgICAgICAgICB9XG4gICAgICAgIF1cbiAgICAgIH0pO1xuICAgICAgLy8gbnVsbCByZXR1cm4gdmFsdWVzIGFyZSBmb3IgdGhlIFwiY2FuY2VsXCIgcGF0aFxuICAgICAgcmV0dXJuIHJlbmFtZVByb21wdC5zaG93KCkudGhlbihmdW5jdGlvbihuZXdOYW1lKSB7XG4gICAgICAgIGlmKG5ld05hbWUgPT09IG51bGwpIHtcbiAgICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgICAgfVxuICAgICAgICB3aW5kb3cuc3RpY2tNZXNzYWdlKFwiUmVuYW1pbmcuLi5cIik7XG4gICAgICAgIHByb2dyYW1Ub1NhdmUgPSBwLnJlbmFtZShuZXdOYW1lKTtcbiAgICAgICAgcmV0dXJuIHByb2dyYW1Ub1NhdmU7XG4gICAgICB9KVxuICAgICAgLnRoZW4oZnVuY3Rpb24ocCkge1xuICAgICAgICBpZihwID09PSBudWxsKSB7XG4gICAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICAgIH1cbiAgICAgICAgdXBkYXRlTmFtZShwKTtcbiAgICAgICAgd2luZG93LmZsYXNoTWVzc2FnZShcIlByb2dyYW0gc2F2ZWQgYXMgXCIgKyBwLmdldE5hbWUoKSk7XG4gICAgICB9KVxuICAgICAgLmZhaWwoZnVuY3Rpb24oZXJyKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoXCJGYWlsZWQgdG8gcmVuYW1lOiBcIiwgZXJyKTtcbiAgICAgICAgd2luZG93LmZsYXNoRXJyb3IoXCJGYWlsZWQgdG8gcmVuYW1lIGZpbGVcIik7XG4gICAgICB9KTtcbiAgICB9KVxuICAgIC5mYWlsKGZ1bmN0aW9uKGVycikge1xuICAgICAgY29uc29sZS5lcnJvcihcIlVuYWJsZSB0byByZW5hbWU6IFwiLCBlcnIpO1xuICAgIH0pO1xuICB9XG5cbiAgJChcIiNydW5CdXR0b25cIikuY2xpY2soZnVuY3Rpb24oKSB7XG4gICAgQ1BPLmF1dG9TYXZlKCk7XG4gIH0pO1xuXG4gICQoXCIjbmV3XCIpLmNsaWNrKG5ld0V2ZW50KTtcbiAgJChcIiNzYXZlXCIpLmNsaWNrKHNhdmVFdmVudCk7XG4gICQoXCIjcmVuYW1lXCIpLmNsaWNrKHJlbmFtZSk7XG4gICQoXCIjc2F2ZWFzXCIpLmNsaWNrKHNhdmVBcyk7XG5cbiAgdmFyIGZvY3VzYWJsZUVsdHMgPSAkKGRvY3VtZW50KS5maW5kKCcjaGVhZGVyIC5mb2N1c2FibGUnKTtcbiAgLy9jb25zb2xlLmxvZygnZm9jdXNhYmxlRWx0cz0nLCBmb2N1c2FibGVFbHRzKVxuICB2YXIgdGhlVG9vbGJhciA9ICQoZG9jdW1lbnQpLmZpbmQoJyNUb29sYmFyJyk7XG5cbiAgZnVuY3Rpb24gZ2V0VG9wVGllck1lbnVpdGVtcygpIHtcbiAgICAvL2NvbnNvbGUubG9nKCdkb2luZyBnZXRUb3BUaWVyTWVudWl0ZW1zJylcbiAgICB2YXIgdG9wVGllck1lbnVpdGVtcyA9ICQoZG9jdW1lbnQpLmZpbmQoJyNoZWFkZXIgdWwgbGkudG9wVGllcicpLnRvQXJyYXkoKTtcbiAgICB0b3BUaWVyTWVudWl0ZW1zID0gdG9wVGllck1lbnVpdGVtcy5cbiAgICAgICAgICAgICAgICAgICAgICAgIGZpbHRlcihlbHQgPT4gIShlbHQuc3R5bGUuZGlzcGxheSA9PT0gJ25vbmUnIHx8XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZWx0LmdldEF0dHJpYnV0ZSgnZGlzYWJsZWQnKSA9PT0gJ2Rpc2FibGVkJykpO1xuICAgIHZhciBudW1Ub3BUaWVyTWVudWl0ZW1zID0gdG9wVGllck1lbnVpdGVtcy5sZW5ndGg7XG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBudW1Ub3BUaWVyTWVudWl0ZW1zOyBpKyspIHtcbiAgICAgIHZhciBpdGhUb3BUaWVyTWVudWl0ZW0gPSB0b3BUaWVyTWVudWl0ZW1zW2ldO1xuICAgICAgdmFyIGlDaGlsZCA9ICQoaXRoVG9wVGllck1lbnVpdGVtKS5jaGlsZHJlbigpLmZpcnN0KCk7XG4gICAgICAvL2NvbnNvbGUubG9nKCdpQ2hpbGQ9JywgaUNoaWxkKTtcbiAgICAgIGlDaGlsZC5maW5kKCcuZm9jdXNhYmxlJykuXG4gICAgICAgIGF0dHIoJ2FyaWEtc2V0c2l6ZScsIG51bVRvcFRpZXJNZW51aXRlbXMudG9TdHJpbmcoKSkuXG4gICAgICAgIGF0dHIoJ2FyaWEtcG9zaW5zZXQnLCAoaSsxKS50b1N0cmluZygpKTtcbiAgICB9XG4gICAgcmV0dXJuIHRvcFRpZXJNZW51aXRlbXM7XG4gIH1cblxuICBmdW5jdGlvbiB1cGRhdGVFZGl0b3JIZWlnaHQoKSB7XG4gICAgdmFyIHRvb2xiYXJIZWlnaHQgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndG9wVGllclVsJykub2Zmc2V0SGVpZ2h0O1xuICAgIC8vIGdldHMgYnVtcGVkIHRvIDY3IG9uIGluaXRpYWwgcmVzaXplIHBlcnR1cmJhdGlvbiwgYnV0IGFjdHVhbCB2YWx1ZSBpcyBpbmRlZWQgNDBcbiAgICBpZiAodG9vbGJhckhlaWdodCA8IDgwKSB0b29sYmFySGVpZ2h0ID0gNDA7XG4gICAgdG9vbGJhckhlaWdodCArPSAncHgnO1xuICAgIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdSRVBMJykuc3R5bGUucGFkZGluZ1RvcCA9IHRvb2xiYXJIZWlnaHQ7XG4gICAgdmFyIGRvY01haW4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnbWFpbicpO1xuICAgIHZhciBkb2NSZXBsTWFpbiA9IGRvY01haW4uZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgncmVwbE1haW4nKTtcbiAgICBpZiAoZG9jUmVwbE1haW4ubGVuZ3RoICE9PSAwKSB7XG4gICAgICBkb2NSZXBsTWFpblswXS5zdHlsZS5wYWRkaW5nVG9wID0gdG9vbGJhckhlaWdodDtcbiAgICB9XG4gIH1cblxuICAkKHdpbmRvdykub24oJ3Jlc2l6ZScsIHVwZGF0ZUVkaXRvckhlaWdodCk7XG5cbiAgZnVuY3Rpb24gaW5zZXJ0QXJpYVBvcyhzdWJtZW51KSB7XG4gICAgLy9jb25zb2xlLmxvZygnZG9pbmcgaW5zZXJ0QXJpYVBvcycsIHN1Ym1lbnUpXG4gICAgdmFyIGFyciA9IHN1Ym1lbnUudG9BcnJheSgpO1xuICAgIC8vY29uc29sZS5sb2coJ2Fycj0nLCBhcnIpO1xuICAgIHZhciBsZW4gPSBhcnIubGVuZ3RoO1xuICAgIGZvciAodmFyIGkgPSAwOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgIHZhciBlbHQgPSBhcnJbaV07XG4gICAgICAvL2NvbnNvbGUubG9nKCdlbHQnLCBpLCAnPScsIGVsdCk7XG4gICAgICBlbHQuc2V0QXR0cmlidXRlKCdhcmlhLXNldHNpemUnLCBsZW4udG9TdHJpbmcoKSk7XG4gICAgICBlbHQuc2V0QXR0cmlidXRlKCdhcmlhLXBvc2luc2V0JywgKGkrMSkudG9TdHJpbmcoKSk7XG4gICAgfVxuICB9XG5cblxuICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIGZ1bmN0aW9uICgpIHtcbiAgICBoaWRlQWxsVG9wTWVudWl0ZW1zKCk7XG4gIH0pO1xuXG4gIHRoZVRvb2xiYXIuY2xpY2soZnVuY3Rpb24gKGUpIHtcbiAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICB9KTtcblxuICB0aGVUb29sYmFyLmtleWRvd24oZnVuY3Rpb24gKGUpIHtcbiAgICAvL2NvbnNvbGUubG9nKCd0b29sYmFyIGtleWRvd24nLCBlKTtcbiAgICAvL21vc3QgYW55IGtleSBhdCBhbGxcbiAgICB2YXIga2MgPSBlLmtleUNvZGU7XG4gICAgaWYgKGtjID09PSAyNykge1xuICAgICAgLy8gZXNjYXBlXG4gICAgICBoaWRlQWxsVG9wTWVudWl0ZW1zKCk7XG4gICAgICAvL2NvbnNvbGUubG9nKCdjYWxsaW5nIGN5Y2xlRm9jdXMgZnJvbSB0b29sYmFyJylcbiAgICAgIENQTy5jeWNsZUZvY3VzKCk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIH0gZWxzZSBpZiAoa2MgPT09IDkgfHwga2MgPT09IDM3IHx8IGtjID09PSAzOCB8fCBrYyA9PT0gMzkgfHwga2MgPT09IDQwKSB7XG4gICAgICAvLyBhbiBhcnJvd1xuICAgICAgdmFyIHRhcmdldCA9ICQodGhpcykuZmluZCgnW3RhYkluZGV4PS0xXScpO1xuICAgICAgZ2V0VG9wVGllck1lbnVpdGVtcygpO1xuICAgICAgZG9jdW1lbnQuYWN0aXZlRWxlbWVudC5ibHVyKCk7IC8vbmVlZGVkP1xuICAgICAgdGFyZ2V0LmZpcnN0KCkuZm9jdXMoKTsgLy9uZWVkZWQ/XG4gICAgICAvL2NvbnNvbGUubG9nKCdkb2NhY3RlbHQ9JywgZG9jdW1lbnQuYWN0aXZlRWxlbWVudCk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBoaWRlQWxsVG9wTWVudWl0ZW1zKCk7XG4gICAgfVxuICB9KTtcblxuICBmdW5jdGlvbiBjbGlja1RvcE1lbnVpdGVtKGUpIHtcbiAgICBoaWRlQWxsVG9wTWVudWl0ZW1zKCk7XG4gICAgdmFyIHRoaXNFbHQgPSAkKHRoaXMpO1xuICAgIC8vY29uc29sZS5sb2coJ2RvaW5nIGNsaWNrVG9wTWVudWl0ZW0gb24nLCB0aGlzRWx0KTtcbiAgICB2YXIgdG9wVGllclVsID0gdGhpc0VsdC5jbG9zZXN0KCd1bFtpZD10b3BUaWVyVWxdJyk7XG4gICAgaWYgKHRoaXNFbHRbMF0uaGFzQXR0cmlidXRlKCdhcmlhLWhpZGRlbicpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGlmICh0aGlzRWx0WzBdLmdldEF0dHJpYnV0ZSgnZGlzYWJsZWQnKSA9PT0gJ2Rpc2FibGVkJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvL3ZhciBoaWRkZW5QID0gKHRoaXNFbHRbMF0uZ2V0QXR0cmlidXRlKCdhcmlhLWV4cGFuZGVkJykgPT09ICdmYWxzZScpO1xuICAgIC8vaGlkZGVuUCBhbHdheXMgZmFsc2U/XG4gICAgdmFyIHRoaXNUb3BNZW51aXRlbSA9IHRoaXNFbHQuY2xvc2VzdCgnbGkudG9wVGllcicpO1xuICAgIC8vY29uc29sZS5sb2coJ3RoaXNUb3BNZW51aXRlbT0nLCB0aGlzVG9wTWVudWl0ZW0pO1xuICAgIHZhciB0MSA9IHRoaXNUb3BNZW51aXRlbVswXTtcbiAgICB2YXIgc3VibWVudU9wZW4gPSAodGhpc0VsdFswXS5nZXRBdHRyaWJ1dGUoJ2FyaWEtZXhwYW5kZWQnKSA9PT0gJ3RydWUnKTtcbiAgICBpZiAoIXN1Ym1lbnVPcGVuKSB7XG4gICAgICAvL2NvbnNvbGUubG9nKCdoaWRkZW5wIHRydWUgYnJhbmNoJyk7XG4gICAgICBoaWRlQWxsVG9wTWVudWl0ZW1zKCk7XG4gICAgICB0aGlzVG9wTWVudWl0ZW0uY2hpbGRyZW4oJ3VsLnN1Ym1lbnUnKS5hdHRyKCdhcmlhLWhpZGRlbicsICdmYWxzZScpLnNob3coKTtcbiAgICAgIHRoaXNUb3BNZW51aXRlbS5jaGlsZHJlbigpLmZpcnN0KCkuZmluZCgnW2FyaWEtZXhwYW5kZWRdJykuYXR0cignYXJpYS1leHBhbmRlZCcsICd0cnVlJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vY29uc29sZS5sb2coJ2hpZGRlbnAgZmFsc2UgYnJhbmNoJyk7XG4gICAgICB0aGlzVG9wTWVudWl0ZW0uY2hpbGRyZW4oJ3VsLnN1Ym1lbnUnKS5hdHRyKCdhcmlhLWhpZGRlbicsICd0cnVlJykuaGlkZSgpO1xuICAgICAgdGhpc1RvcE1lbnVpdGVtLmNoaWxkcmVuKCkuZmlyc3QoKS5maW5kKCdbYXJpYS1leHBhbmRlZF0nKS5hdHRyKCdhcmlhLWV4cGFuZGVkJywgJ2ZhbHNlJyk7XG4gICAgfVxuICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gIH1cblxuICB2YXIgZXhwYW5kYWJsZUVsdHMgPSAkKGRvY3VtZW50KS5maW5kKCcjaGVhZGVyIFthcmlhLWV4cGFuZGVkXScpO1xuICBleHBhbmRhYmxlRWx0cy5jbGljayhjbGlja1RvcE1lbnVpdGVtKTtcblxuICBmdW5jdGlvbiBoaWRlQWxsVG9wTWVudWl0ZW1zKCkge1xuICAgIC8vY29uc29sZS5sb2coJ2RvaW5nIGhpZGVBbGxUb3BNZW51aXRlbXMnKTtcbiAgICB2YXIgdG9wVGllclVsID0gJChkb2N1bWVudCkuZmluZCgnI2hlYWRlciB1bFtpZD10b3BUaWVyVWxdJyk7XG4gICAgdG9wVGllclVsLmZpbmQoJ1thcmlhLWV4cGFuZGVkXScpLmF0dHIoJ2FyaWEtZXhwYW5kZWQnLCAnZmFsc2UnKTtcbiAgICB0b3BUaWVyVWwuZmluZCgndWwuc3VibWVudScpLmF0dHIoJ2FyaWEtaGlkZGVuJywgJ3RydWUnKS5oaWRlKCk7XG4gIH1cblxuICB2YXIgbm9uZXhwYW5kYWJsZUVsdHMgPSAkKGRvY3VtZW50KS5maW5kKCcjaGVhZGVyIC50b3BUaWVyID4gZGl2ID4gYnV0dG9uOm5vdChbYXJpYS1leHBhbmRlZF0pJyk7XG4gIG5vbmV4cGFuZGFibGVFbHRzLmNsaWNrKGhpZGVBbGxUb3BNZW51aXRlbXMpO1xuXG4gIGZ1bmN0aW9uIHN3aXRjaFRvcE1lbnVpdGVtKGRlc3RUb3BNZW51aXRlbSwgZGVzdEVsdCkge1xuICAgIC8vY29uc29sZS5sb2coJ2RvaW5nIHN3aXRjaFRvcE1lbnVpdGVtJywgZGVzdFRvcE1lbnVpdGVtLCBkZXN0RWx0KTtcbiAgICAvL2NvbnNvbGUubG9nKCdkdG1pbD0nLCBkZXN0VG9wTWVudWl0ZW0ubGVuZ3RoKTtcbiAgICBoaWRlQWxsVG9wTWVudWl0ZW1zKCk7XG4gICAgaWYgKGRlc3RUb3BNZW51aXRlbSAmJiBkZXN0VG9wTWVudWl0ZW0ubGVuZ3RoICE9PSAwKSB7XG4gICAgICB2YXIgZWx0ID0gZGVzdFRvcE1lbnVpdGVtWzBdO1xuICAgICAgdmFyIGVsdElkID0gZWx0LmdldEF0dHJpYnV0ZSgnaWQnKTtcbiAgICAgIGRlc3RUb3BNZW51aXRlbS5jaGlsZHJlbigndWwuc3VibWVudScpLmF0dHIoJ2FyaWEtaGlkZGVuJywgJ2ZhbHNlJykuc2hvdygpO1xuICAgICAgZGVzdFRvcE1lbnVpdGVtLmNoaWxkcmVuKCkuZmlyc3QoKS5maW5kKCdbYXJpYS1leHBhbmRlZF0nKS5hdHRyKCdhcmlhLWV4cGFuZGVkJywgJ3RydWUnKTtcbiAgICB9XG4gICAgaWYgKGRlc3RFbHQpIHtcbiAgICAgIC8vZGVzdEVsdC5hdHRyKCd0YWJJbmRleCcsICcwJykuZm9jdXMoKTtcbiAgICAgIGRlc3RFbHQuZm9jdXMoKTtcbiAgICB9XG4gIH1cblxuICB2YXIgc2hvd2luZ0hlbHBLZXlzID0gZmFsc2U7XG5cbiAgZnVuY3Rpb24gc2hvd0hlbHBLZXlzKCkge1xuICAgIHNob3dpbmdIZWxwS2V5cyA9IHRydWU7XG4gICAgJCgnI2hlbHAta2V5cycpLmZhZGVJbigxMDApO1xuICAgIHJlY2l0ZUhlbHAoKTtcbiAgfVxuXG4gIGZvY3VzYWJsZUVsdHMua2V5ZG93bihmdW5jdGlvbiAoZSkge1xuICAgIC8vY29uc29sZS5sb2coJ2ZvY3VzYWJsZSBlbHQga2V5ZG93bicsIGUpO1xuICAgIHZhciBrYyA9IGUua2V5Q29kZTtcbiAgICAvLyQodGhpcykuYmx1cigpOyAvLyBEZWxldGU/XG4gICAgdmFyIHdpdGhpblNlY29uZFRpZXJVbCA9IHRydWU7XG4gICAgdmFyIHRvcFRpZXJVbCA9ICQodGhpcykuY2xvc2VzdCgndWxbaWQ9dG9wVGllclVsXScpO1xuICAgIHZhciBzZWNvbmRUaWVyVWwgPSAkKHRoaXMpLmNsb3Nlc3QoJ3VsLnN1Ym1lbnUnKTtcbiAgICBpZiAoc2Vjb25kVGllclVsLmxlbmd0aCA9PT0gMCkge1xuICAgICAgd2l0aGluU2Vjb25kVGllclVsID0gZmFsc2U7XG4gICAgfVxuICAgIGlmIChrYyA9PT0gMjcpIHtcbiAgICAgIC8vY29uc29sZS5sb2coJ2VzY2FwZSBwcmVzc2VkIGknKVxuICAgICAgJCgnI2hlbHAta2V5cycpLmZhZGVPdXQoNTAwKTtcbiAgICB9XG4gICAgaWYgKGtjID09PSAyNyAmJiB3aXRoaW5TZWNvbmRUaWVyVWwpIHsgLy8gZXNjYXBlXG4gICAgICB2YXIgZGVzdFRvcE1lbnVpdGVtID0gJCh0aGlzKS5jbG9zZXN0KCdsaS50b3BUaWVyJyk7XG4gICAgICB2YXIgcG9zc0VsdHMgPSBkZXN0VG9wTWVudWl0ZW0uZmluZCgnLmZvY3VzYWJsZTpub3QoW2Rpc2FibGVkXSknKS5maWx0ZXIoJzp2aXNpYmxlJyk7XG4gICAgICBzd2l0Y2hUb3BNZW51aXRlbShkZXN0VG9wTWVudWl0ZW0sIHBvc3NFbHRzLmZpcnN0KCkpO1xuICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB9IGVsc2UgaWYgKGtjID09PSAzOSkgeyAvLyByaWdodGFycm93XG4gICAgICAvL2NvbnNvbGUubG9nKCdyaWdodGFycm93IHByZXNzZWQnKTtcbiAgICAgIHZhciBzcmNUb3BNZW51aXRlbSA9ICQodGhpcykuY2xvc2VzdCgnbGkudG9wVGllcicpO1xuICAgICAgLy9jb25zb2xlLmxvZygnc3JjVG9wTWVudWl0ZW09Jywgc3JjVG9wTWVudWl0ZW0pO1xuICAgICAgc3JjVG9wTWVudWl0ZW0uY2hpbGRyZW4oKS5maXJzdCgpLmZpbmQoJy5mb2N1c2FibGUnKS5hdHRyKCd0YWJJbmRleCcsICctMScpO1xuICAgICAgdmFyIHRvcFRpZXJNZW51aXRlbXMgPSBnZXRUb3BUaWVyTWVudWl0ZW1zKCk7XG4gICAgICAvL2NvbnNvbGUubG9nKCd0dG1pKiA9JywgdG9wVGllck1lbnVpdGVtcyk7XG4gICAgICB2YXIgdHRtaU4gPSB0b3BUaWVyTWVudWl0ZW1zLmxlbmd0aDtcbiAgICAgIHZhciBqID0gdG9wVGllck1lbnVpdGVtcy5pbmRleE9mKHNyY1RvcE1lbnVpdGVtWzBdKTtcbiAgICAgIC8vY29uc29sZS5sb2coJ2ogaW5pdGlhbD0nLCBqKTtcbiAgICAgIGZvciAodmFyIGkgPSAoaiArIDEpICUgdHRtaU47IGkgIT09IGo7IGkgPSAoaSArIDEpICUgdHRtaU4pIHtcbiAgICAgICAgdmFyIGRlc3RUb3BNZW51aXRlbSA9ICQodG9wVGllck1lbnVpdGVtc1tpXSk7XG4gICAgICAgIC8vY29uc29sZS5sb2coJ2Rlc3RUb3BNZW51aXRlbShhKT0nLCBkZXN0VG9wTWVudWl0ZW0pO1xuICAgICAgICB2YXIgcG9zc0VsdHMgPSBkZXN0VG9wTWVudWl0ZW0uZmluZCgnLmZvY3VzYWJsZTpub3QoW2Rpc2FibGVkXSknKS5maWx0ZXIoJzp2aXNpYmxlJyk7XG4gICAgICAgIC8vY29uc29sZS5sb2coJ3Bvc3NFbHRzPScsIHBvc3NFbHRzKVxuICAgICAgICBpZiAocG9zc0VsdHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coJ2ZpbmFsIGk9JywgaSk7XG4gICAgICAgICAgLy9jb25zb2xlLmxvZygnbGFuZGluZyBvbicsIHBvc3NFbHRzLmZpcnN0KCkpO1xuICAgICAgICAgIHN3aXRjaFRvcE1lbnVpdGVtKGRlc3RUb3BNZW51aXRlbSwgcG9zc0VsdHMuZmlyc3QoKSk7XG4gICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoa2MgPT09IDM3KSB7IC8vIGxlZnRhcnJvd1xuICAgICAgLy9jb25zb2xlLmxvZygnbGVmdGFycm93IHByZXNzZWQnKTtcbiAgICAgIHZhciBzcmNUb3BNZW51aXRlbSA9ICQodGhpcykuY2xvc2VzdCgnbGkudG9wVGllcicpO1xuICAgICAgLy9jb25zb2xlLmxvZygnc3JjVG9wTWVudWl0ZW09Jywgc3JjVG9wTWVudWl0ZW0pO1xuICAgICAgc3JjVG9wTWVudWl0ZW0uY2hpbGRyZW4oKS5maXJzdCgpLmZpbmQoJy5mb2N1c2FibGUnKS5hdHRyKCd0YWJJbmRleCcsICctMScpO1xuICAgICAgdmFyIHRvcFRpZXJNZW51aXRlbXMgPSBnZXRUb3BUaWVyTWVudWl0ZW1zKCk7XG4gICAgICAvL2NvbnNvbGUubG9nKCd0dG1pKiA9JywgdG9wVGllck1lbnVpdGVtcyk7XG4gICAgICB2YXIgdHRtaU4gPSB0b3BUaWVyTWVudWl0ZW1zLmxlbmd0aDtcbiAgICAgIHZhciBqID0gdG9wVGllck1lbnVpdGVtcy5pbmRleE9mKHNyY1RvcE1lbnVpdGVtWzBdKTtcbiAgICAgIC8vY29uc29sZS5sb2coJ2ogaW5pdGlhbD0nLCBqKTtcbiAgICAgIGZvciAodmFyIGkgPSAoaiArIHR0bWlOIC0gMSkgJSB0dG1pTjsgaSAhPT0gajsgaSA9IChpICsgdHRtaU4gLSAxKSAlIHR0bWlOKSB7XG4gICAgICAgIHZhciBkZXN0VG9wTWVudWl0ZW0gPSAkKHRvcFRpZXJNZW51aXRlbXNbaV0pO1xuICAgICAgICAvL2NvbnNvbGUubG9nKCdkZXN0VG9wTWVudWl0ZW0oYik9JywgZGVzdFRvcE1lbnVpdGVtKTtcbiAgICAgICAgLy9jb25zb2xlLmxvZygnaT0nLCBpKVxuICAgICAgICB2YXIgcG9zc0VsdHMgPSBkZXN0VG9wTWVudWl0ZW0uZmluZCgnLmZvY3VzYWJsZTpub3QoW2Rpc2FibGVkXSknKS5maWx0ZXIoJzp2aXNpYmxlJyk7XG4gICAgICAgIC8vY29uc29sZS5sb2coJ3Bvc3NFbHRzPScsIHBvc3NFbHRzKVxuICAgICAgICBpZiAocG9zc0VsdHMubGVuZ3RoID4gMCkge1xuICAgICAgICAgIC8vY29uc29sZS5sb2coJ2ZpbmFsIGk9JywgaSk7XG4gICAgICAgICAgLy9jb25zb2xlLmxvZygnbGFuZGluZyBvbicsIHBvc3NFbHRzLmZpcnN0KCkpO1xuICAgICAgICAgIHN3aXRjaFRvcE1lbnVpdGVtKGRlc3RUb3BNZW51aXRlbSwgcG9zc0VsdHMuZmlyc3QoKSk7XG4gICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoa2MgPT09IDM4KSB7IC8vIHVwYXJyb3dcbiAgICAgIC8vY29uc29sZS5sb2coJ3VwYXJyb3cgcHJlc3NlZCcpO1xuICAgICAgdmFyIHN1Ym1lbnU7XG4gICAgICBpZiAod2l0aGluU2Vjb25kVGllclVsKSB7XG4gICAgICAgIHZhciBuZWFyU2licyA9ICQodGhpcykuY2xvc2VzdCgnZGl2JykuZmluZCgnLmZvY3VzYWJsZScpLmZpbHRlcignOnZpc2libGUnKTtcbiAgICAgICAgLy9jb25zb2xlLmxvZygnbmVhclNpYnM9JywgbmVhclNpYnMpO1xuICAgICAgICB2YXIgbXlJZCA9ICQodGhpcylbMF0uZ2V0QXR0cmlidXRlKCdpZCcpO1xuICAgICAgICAvL2NvbnNvbGUubG9nKCdteUlkPScsIG15SWQpO1xuICAgICAgICBzdWJtZW51ID0gJChbXSk7XG4gICAgICAgIHZhciB0aGlzRW5jb3VudGVyZWQgPSBmYWxzZTtcbiAgICAgICAgZm9yICh2YXIgaSA9IG5lYXJTaWJzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG4gICAgICAgICAgaWYgKHRoaXNFbmNvdW50ZXJlZCkge1xuICAgICAgICAgICAgLy9jb25zb2xlLmxvZygnYWRkaW5nJywgbmVhclNpYnNbaV0pO1xuICAgICAgICAgICAgc3VibWVudSA9IHN1Ym1lbnUuYWRkKCQobmVhclNpYnNbaV0pKTtcbiAgICAgICAgICB9IGVsc2UgaWYgKG5lYXJTaWJzW2ldLmdldEF0dHJpYnV0ZSgnaWQnKSA9PT0gbXlJZCkge1xuICAgICAgICAgICAgdGhpc0VuY291bnRlcmVkID0gdHJ1ZTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgLy9jb25zb2xlLmxvZygnc3VibWVudSBzbyBmYXI9Jywgc3VibWVudSk7XG4gICAgICAgIHZhciBmYXJTaWJzID0gJCh0aGlzKS5jbG9zZXN0KCdsaScpLnByZXZBbGwoKS5maW5kKCdkaXY6bm90KC5kaXNhYmxlZCknKVxuICAgICAgICAgIC5maW5kKCcuZm9jdXNhYmxlJykuZmlsdGVyKCc6dmlzaWJsZScpO1xuICAgICAgICBzdWJtZW51ID0gc3VibWVudS5hZGQoZmFyU2licyk7XG4gICAgICAgIGlmIChzdWJtZW51Lmxlbmd0aCA9PT0gMCkge1xuICAgICAgICAgIHN1Ym1lbnUgPSAkKHRoaXMpLmNsb3Nlc3QoJ2xpJykuY2xvc2VzdCgndWwnKS5maW5kKCdkaXY6bm90KC5kaXNhYmxlZCknKVxuICAgICAgICAgIC5maW5kKCcuZm9jdXNhYmxlJykuZmlsdGVyKCc6dmlzaWJsZScpLmxhc3QoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoc3VibWVudS5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgc3VibWVudS5sYXN0KCkuZm9jdXMoKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAvKlxuICAgICAgICAgIC8vY29uc29sZS5sb2coJ25vIGFjdGlvbmFibGUgc3VibWVudSBmb3VuZCcpXG4gICAgICAgICAgdmFyIHRvcG1lbnVJdGVtID0gJCh0aGlzKS5jbG9zZXN0KCd1bC5zdWJtZW51JykuY2xvc2VzdCgnbGknKVxuICAgICAgICAgIC5jaGlsZHJlbigpLmZpcnN0KCkuZmluZCgnLmZvY3VzYWJsZTpub3QoW2Rpc2FibGVkXSknKS5maWx0ZXIoJzp2aXNpYmxlJyk7XG4gICAgICAgICAgaWYgKHRvcG1lbnVJdGVtLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIHRvcG1lbnVJdGVtLmZpcnN0KCkuZm9jdXMoKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgLy9jb25zb2xlLmxvZygnbm8gYWN0aW9uYWJsZSB0b3BtZW51aXRlbSBmb3VuZCBlaXRoZXInKVxuICAgICAgICAgIH1cbiAgICAgICAgICAqL1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIH0gZWxzZSBpZiAoa2MgPT09IDQwKSB7IC8vIGRvd25hcnJvd1xuICAgICAgLy9jb25zb2xlLmxvZygnZG93bmFycm93IHByZXNzZWQnKTtcbiAgICAgIHZhciBzdWJtZW51RGl2cztcbiAgICAgIHZhciBzdWJtZW51O1xuICAgICAgaWYgKCF3aXRoaW5TZWNvbmRUaWVyVWwpIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZygnMXN0IHRpZXInKVxuICAgICAgICBzdWJtZW51RGl2cyA9ICQodGhpcykuY2xvc2VzdCgnbGknKS5jaGlsZHJlbigndWwnKS5maW5kKCdkaXY6bm90KC5kaXNhYmxlZCknKTtcbiAgICAgICAgc3VibWVudSA9IHN1Ym1lbnVEaXZzLmZpbmQoJy5mb2N1c2FibGUnKS5maWx0ZXIoJzp2aXNpYmxlJyk7XG4gICAgICAgIGluc2VydEFyaWFQb3Moc3VibWVudSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvL2NvbnNvbGUubG9nKCcybmQgdGllcicpXG4gICAgICAgIHZhciBuZWFyU2licyA9ICQodGhpcykuY2xvc2VzdCgnZGl2JykuZmluZCgnLmZvY3VzYWJsZScpLmZpbHRlcignOnZpc2libGUnKTtcbiAgICAgICAgLy9jb25zb2xlLmxvZygnbmVhclNpYnM9JywgbmVhclNpYnMpO1xuICAgICAgICB2YXIgbXlJZCA9ICQodGhpcylbMF0uZ2V0QXR0cmlidXRlKCdpZCcpO1xuICAgICAgICAvL2NvbnNvbGUubG9nKCdteUlkPScsIG15SWQpO1xuICAgICAgICBzdWJtZW51ID0gJChbXSk7XG4gICAgICAgIHZhciB0aGlzRW5jb3VudGVyZWQgPSBmYWxzZTtcbiAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBuZWFyU2licy5sZW5ndGg7IGkrKykge1xuICAgICAgICAgIGlmICh0aGlzRW5jb3VudGVyZWQpIHtcbiAgICAgICAgICAgIC8vY29uc29sZS5sb2coJ2FkZGluZycsIG5lYXJTaWJzW2ldKTtcbiAgICAgICAgICAgIHN1Ym1lbnUgPSBzdWJtZW51LmFkZCgkKG5lYXJTaWJzW2ldKSk7XG4gICAgICAgICAgfSBlbHNlIGlmIChuZWFyU2lic1tpXS5nZXRBdHRyaWJ1dGUoJ2lkJykgPT09IG15SWQpIHtcbiAgICAgICAgICAgIHRoaXNFbmNvdW50ZXJlZCA9IHRydWU7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIC8vY29uc29sZS5sb2coJ3N1Ym1lbnUgc28gZmFyPScsIHN1Ym1lbnUpO1xuICAgICAgICB2YXIgZmFyU2licyA9ICQodGhpcykuY2xvc2VzdCgnbGknKS5uZXh0QWxsKCkuZmluZCgnZGl2Om5vdCguZGlzYWJsZWQpJylcbiAgICAgICAgICAuZmluZCgnLmZvY3VzYWJsZScpLmZpbHRlcignOnZpc2libGUnKTtcbiAgICAgICAgc3VibWVudSA9IHN1Ym1lbnUuYWRkKGZhclNpYnMpO1xuICAgICAgICBpZiAoc3VibWVudS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgICBzdWJtZW51ID0gJCh0aGlzKS5jbG9zZXN0KCdsaScpLmNsb3Nlc3QoJ3VsJykuZmluZCgnZGl2Om5vdCguZGlzYWJsZWQpJylcbiAgICAgICAgICAgIC5maW5kKCcuZm9jdXNhYmxlJykuZmlsdGVyKCc6dmlzaWJsZScpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgICAvL2NvbnNvbGUubG9nKCdzdWJtZW51PScsIHN1Ym1lbnUpXG4gICAgICBpZiAoc3VibWVudS5sZW5ndGggPiAwKSB7XG4gICAgICAgIHN1Ym1lbnUuZmlyc3QoKS5mb2N1cygpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZygnbm8gYWN0aW9uYWJsZSBzdWJtZW51IGZvdW5kJylcbiAgICAgIH1cbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgfSBlbHNlIGlmIChrYyA9PT0gMjcpIHtcbiAgICAgIC8vY29uc29sZS5sb2coJ2VzYyBwcmVzc2VkJyk7XG4gICAgICBoaWRlQWxsVG9wTWVudWl0ZW1zKCk7XG4gICAgICBpZiAoc2hvd2luZ0hlbHBLZXlzKSB7XG4gICAgICAgIHNob3dpbmdIZWxwS2V5cyA9IGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZygnY2FsbGluZyBjeWNsZUZvY3VzIGlpJylcbiAgICAgICAgQ1BPLmN5Y2xlRm9jdXMoKTtcbiAgICAgIH1cbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAvLyQodGhpcykuY2xvc2VzdCgnbmF2JykuY2xvc2VzdCgnbWFpbicpLmZvY3VzKCk7XG4gICAgfSBlbHNlIGlmIChrYyA9PT0gOSApIHtcbiAgICAgIGlmIChlLnNoaWZ0S2V5KSB7XG4gICAgICAgIGhpZGVBbGxUb3BNZW51aXRlbXMoKTtcbiAgICAgICAgQ1BPLmN5Y2xlRm9jdXModHJ1ZSk7XG4gICAgICB9XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIH0gZWxzZSBpZiAoa2MgPT09IDEzIHx8IGtjID09PSAxNyB8fCBrYyA9PT0gMjAgfHwga2MgPT09IDMyKSB7XG4gICAgICAvLyAxMz1lbnRlciAxNz1jdHJsIDIwPWNhcHNsb2NrIDMyPXNwYWNlXG4gICAgICAvL2NvbnNvbGUubG9nKCdzdG9wcHJvcCAxJylcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgfSBlbHNlIGlmIChrYyA+PSAxMTIgJiYga2MgPD0gMTIzKSB7XG4gICAgICAvL2NvbnNvbGUubG9nKCdkb3Byb3AgMScpXG4gICAgICAvLyBmbiBrZXlzXG4gICAgICAvLyBnbyBhaGVhZCwgcHJvcGFnYXRlXG4gICAgfSBlbHNlIGlmIChlLmN0cmxLZXkgJiYga2MgPT09IDE5MSkge1xuICAgICAgLy9jb25zb2xlLmxvZygnQy0/IHByZXNzZWQnKVxuICAgICAgc2hvd0hlbHBLZXlzKCk7XG4gICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvL2NvbnNvbGUubG9nKCdzdG9wcHJvcCAyJylcbiAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgfVxuICAgIC8vZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgfSk7XG5cbiAgLy8gc2hhcmVBUEkubWFrZUhvdmVyTWVudSgkKFwiI2ZpbGVtZW51XCIpLCAkKFwiI2ZpbGVtZW51Q29udGVudHNcIiksIGZhbHNlLCBmdW5jdGlvbigpe30pO1xuICAvLyBzaGFyZUFQSS5tYWtlSG92ZXJNZW51KCQoXCIjYm9ubmllbWVudVwiKSwgJChcIiNib25uaWVtZW51Q29udGVudHNcIiksIGZhbHNlLCBmdW5jdGlvbigpe30pO1xuXG5cbiAgdmFyIGNvZGVDb250YWluZXIgPSAkKFwiPGRpdj5cIikuYWRkQ2xhc3MoXCJyZXBsTWFpblwiKTtcbiAgY29kZUNvbnRhaW5lci5hdHRyKFwicm9sZVwiLCBcInJlZ2lvblwiKS5cbiAgICBhdHRyKFwiYXJpYS1sYWJlbFwiLCBcIkRlZmluaXRpb25zXCIpO1xuICAgIC8vYXR0cihcInRhYkluZGV4XCIsIFwiLTFcIik7XG4gICQoXCIjbWFpblwiKS5wcmVwZW5kKGNvZGVDb250YWluZXIpO1xuXG5cbiAgaWYocGFyYW1zW1wiZ2V0XCJdW1wiaGlkZURlZmluaXRpb25zXCJdKSB7XG4gICAgJChcIi5yZXBsTWFpblwiKS5hdHRyKFwiYXJpYS1oaWRkZW5cIiwgdHJ1ZSkuYXR0cihcInRhYmluZGV4XCIsICctMScpO1xuICB9XG4gIFxuICBjb25zdCBpc0NvbnRyb2xsZWQgPSBwYXJhbXNbXCJnZXRcIl1bXCJjb250cm9sbGVkXCJdO1xuICBjb25zdCBoYXNXYXJuT25FeGl0ID0gKFwid2Fybk9uRXhpdFwiIGluIHBhcmFtc1tcImdldFwiXSk7XG4gIGNvbnN0IHNraXBXYXJuaW5nID0gaGFzV2Fybk9uRXhpdCAmJiAocGFyYW1zW1wiZ2V0XCJdW1wid2Fybk9uRXhpdFwiXSA9PT0gXCJmYWxzZVwiKTtcblxuICBpZighaXNDb250cm9sbGVkICYmICFza2lwV2FybmluZykge1xuICAgICQod2luZG93KS5iaW5kKFwiYmVmb3JldW5sb2FkXCIsIGZ1bmN0aW9uKCkge1xuICAgICAgcmV0dXJuIFwiQmVjYXVzZSB0aGlzIHBhZ2UgY2FuIGxvYWQgc2xvd2x5LCBhbmQgeW91IG1heSBoYXZlIG91dHN0YW5kaW5nIGNoYW5nZXMsIHdlIGFzayB0aGF0IHlvdSBjb25maXJtIGJlZm9yZSBsZWF2aW5nIHRoZSBlZGl0b3IgaW4gY2FzZSBjbG9zaW5nIHdhcyBhbiBhY2NpZGVudC5cIjtcbiAgICB9KTtcbiAgfVxuXG4gIENQTy5lZGl0b3IgPSBDUE8ubWFrZUVkaXRvcihjb2RlQ29udGFpbmVyLCB7XG4gICAgcnVuQnV0dG9uOiAkKFwiI3J1bkJ1dHRvblwiKSxcbiAgICBzaW1wbGVFZGl0b3I6IGZhbHNlLFxuICAgIHJ1bjogQ1BPLlJVTl9DT0RFLFxuICAgIGluaXRpYWxHYXM6IDEwMCxcbiAgICBzY3JvbGxQYXN0RW5kOiB0cnVlLFxuICB9KTtcbiAgQ1BPLmVkaXRvci5jbS5zZXRPcHRpb24oXCJyZWFkT25seVwiLCBcIm5vY3Vyc29yXCIpO1xuICBDUE8uZWRpdG9yLmNtLnNldE9wdGlvbihcImxvbmdMaW5lc1wiLCBuZXcgTWFwKCkpO1xuICBmdW5jdGlvbiByZW1vdmVTaG9ydGVuZWRMaW5lKGxpbmVIYW5kbGUpIHtcbiAgICB2YXIgcnVsZXJzID0gQ1BPLmVkaXRvci5jbS5nZXRPcHRpb24oXCJydWxlcnNcIik7XG4gICAgdmFyIHJ1bGVyc01pbkNvbCA9IENQTy5lZGl0b3IuY20uZ2V0T3B0aW9uKFwicnVsZXJzTWluQ29sXCIpO1xuICAgIHZhciBsb25nTGluZXMgPSBDUE8uZWRpdG9yLmNtLmdldE9wdGlvbihcImxvbmdMaW5lc1wiKTtcbiAgICBpZiAobGluZUhhbmRsZS50ZXh0Lmxlbmd0aCA8PSBydWxlcnNNaW5Db2wpIHtcbiAgICAgIGxpbmVIYW5kbGUucnVsZXJMaXN0ZW5lcnMuZm9yRWFjaCgoZiwgZXZ0KSA9PiBsaW5lSGFuZGxlLm9mZihldnQsIGYpKTtcbiAgICAgIGxvbmdMaW5lcy5kZWxldGUobGluZUhhbmRsZSk7XG4gICAgICAvLyBjb25zb2xlLmxvZyhcIlJlbW92ZWQgXCIsIGxpbmVIYW5kbGUpO1xuICAgICAgcmVmcmVzaFJ1bGVycygpO1xuICAgIH1cbiAgfVxuICBmdW5jdGlvbiBkZWxldGVMaW5lKGxpbmVIYW5kbGUpIHtcbiAgICB2YXIgbG9uZ0xpbmVzID0gQ1BPLmVkaXRvci5jbS5nZXRPcHRpb24oXCJsb25nTGluZXNcIik7XG4gICAgbGluZUhhbmRsZS5ydWxlckxpc3RlbmVycy5mb3JFYWNoKChmLCBldnQpID0+IGxpbmVIYW5kbGUub2ZmKGV2dCwgZikpO1xuICAgIGxvbmdMaW5lcy5kZWxldGUobGluZUhhbmRsZSk7XG4gICAgLy8gY29uc29sZS5sb2coXCJSZW1vdmVkIFwiLCBsaW5lSGFuZGxlKTtcbiAgICByZWZyZXNoUnVsZXJzKCk7XG4gIH1cbiAgZnVuY3Rpb24gcmVmcmVzaFJ1bGVycygpIHtcbiAgICB2YXIgcnVsZXJzID0gQ1BPLmVkaXRvci5jbS5nZXRPcHRpb24oXCJydWxlcnNcIik7XG4gICAgdmFyIGxvbmdMaW5lcyA9IENQTy5lZGl0b3IuY20uZ2V0T3B0aW9uKFwibG9uZ0xpbmVzXCIpO1xuICAgIHZhciBtaW5MZW5ndGg7XG4gICAgaWYgKGxvbmdMaW5lcy5zaXplID09PSAwKSB7XG4gICAgICBtaW5MZW5ndGggPSAwOyAvLyBpZiB0aGVyZSBhcmUgbm8gbG9uZyBsaW5lcywgdGhlbiB3ZSBkb24ndCBjYXJlIGFib3V0IHNob3dpbmcgYW55IHJ1bGVyc1xuICAgIH0gZWxzZSB7XG4gICAgICBtaW5MZW5ndGggPSBOdW1iZXIuTUFYX1ZBTFVFO1xuICAgICAgbG9uZ0xpbmVzLmZvckVhY2goZnVuY3Rpb24obGluZU5vLCBsaW5lSGFuZGxlKSB7XG4gICAgICAgIGlmIChsaW5lSGFuZGxlLnRleHQubGVuZ3RoIDwgbWluTGVuZ3RoKSB7IG1pbkxlbmd0aCA9IGxpbmVIYW5kbGUudGV4dC5sZW5ndGg7IH1cbiAgICAgIH0pO1xuICAgIH1cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHJ1bGVycy5sZW5ndGg7IGkrKykge1xuICAgICAgaWYgKHJ1bGVyc1tpXS5jb2x1bW4gPj0gbWluTGVuZ3RoKSB7XG4gICAgICAgIHJ1bGVyc1tpXS5jbGFzc05hbWUgPSBcImhpZGRlblwiO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcnVsZXJzW2ldLmNsYXNzTmFtZSA9IHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gZ290dGEgc2V0IHRoZSBvcHRpb24gdHdpY2UsIG9yIGVsc2UgQ00gc2hvcnQtY2lyY3VpdHMgYW5kIGlnbm9yZXMgaXRcbiAgICBDUE8uZWRpdG9yLmNtLnNldE9wdGlvbihcInJ1bGVyc1wiLCB1bmRlZmluZWQpO1xuICAgIENQTy5lZGl0b3IuY20uc2V0T3B0aW9uKFwicnVsZXJzXCIsIHJ1bGVycyk7XG4gIH1cbiAgQ1BPLmVkaXRvci5jbS5vbignY2hhbmdlcycsIGZ1bmN0aW9uKGluc3RhbmNlLCBjaGFuZ2VPYmpzKSB7XG4gICAgdmFyIG1pbkxpbmUgPSBpbnN0YW5jZS5sYXN0TGluZSgpLCBtYXhMaW5lID0gMDtcbiAgICB2YXIgcnVsZXJzTWluQ29sID0gaW5zdGFuY2UuZ2V0T3B0aW9uKFwicnVsZXJzTWluQ29sXCIpO1xuICAgIHZhciBsb25nTGluZXMgPSBpbnN0YW5jZS5nZXRPcHRpb24oXCJsb25nTGluZXNcIik7XG4gICAgY2hhbmdlT2Jqcy5mb3JFYWNoKGZ1bmN0aW9uKGNoYW5nZSkge1xuICAgICAgaWYgKG1pbkxpbmUgPiBjaGFuZ2UuZnJvbS5saW5lKSB7IG1pbkxpbmUgPSBjaGFuZ2UuZnJvbS5saW5lOyB9XG4gICAgICBpZiAobWF4TGluZSA8IGNoYW5nZS5mcm9tLmxpbmUgKyBjaGFuZ2UudGV4dC5sZW5ndGgpIHsgbWF4TGluZSA9IGNoYW5nZS5mcm9tLmxpbmUgKyBjaGFuZ2UudGV4dC5sZW5ndGg7IH1cbiAgICB9KTtcbiAgICB2YXIgY2hhbmdlZCA9IGZhbHNlO1xuICAgIGluc3RhbmNlLmVhY2hMaW5lKG1pbkxpbmUsIG1heExpbmUsIGZ1bmN0aW9uKGxpbmVIYW5kbGUpIHtcbiAgICAgIGlmIChsaW5lSGFuZGxlLnRleHQubGVuZ3RoID4gcnVsZXJzTWluQ29sKSB7XG4gICAgICAgIGlmICghbG9uZ0xpbmVzLmhhcyhsaW5lSGFuZGxlKSkge1xuICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICAgIGxvbmdMaW5lcy5zZXQobGluZUhhbmRsZSwgbGluZUhhbmRsZS5saW5lTm8oKSk7XG4gICAgICAgICAgbGluZUhhbmRsZS5ydWxlckxpc3RlbmVycyA9IG5ldyBNYXAoW1xuICAgICAgICAgICAgW1wiY2hhbmdlXCIsIHJlbW92ZVNob3J0ZW5lZExpbmVdLFxuICAgICAgICAgICAgW1wiZGVsZXRlXCIsIGZ1bmN0aW9uKCkgeyAvLyBuZWVkZWQgYmVjYXVzZSB0aGUgZGVsZXRlIGhhbmRsZXIgZ2V0cyBubyBhcmd1bWVudHMgYXQgYWxsXG4gICAgICAgICAgICAgIGRlbGV0ZUxpbmUobGluZUhhbmRsZSk7XG4gICAgICAgICAgICB9XVxuICAgICAgICAgIF0pO1xuICAgICAgICAgIGxpbmVIYW5kbGUucnVsZXJMaXN0ZW5lcnMuZm9yRWFjaCgoZiwgZXZ0KSA9PiBsaW5lSGFuZGxlLm9uKGV2dCwgZikpO1xuICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiQWRkZWQgXCIsIGxpbmVIYW5kbGUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAobG9uZ0xpbmVzLmhhcyhsaW5lSGFuZGxlKSkge1xuICAgICAgICAgIGNoYW5nZWQgPSB0cnVlO1xuICAgICAgICAgIGxvbmdMaW5lcy5kZWxldGUobGluZUhhbmRsZSk7XG4gICAgICAgICAgLy8gY29uc29sZS5sb2coXCJSZW1vdmVkIFwiLCBsaW5lSGFuZGxlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pO1xuICAgIGlmIChjaGFuZ2VkKSB7XG4gICAgICByZWZyZXNoUnVsZXJzKCk7XG4gICAgfVxuICB9KTtcblxuICBwcm9ncmFtTG9hZGVkLnRoZW4oZnVuY3Rpb24oYykge1xuICAgIENQTy5kb2N1bWVudHMuc2V0KFwiZGVmaW5pdGlvbnM6Ly9cIiwgQ1BPLmVkaXRvci5jbS5nZXREb2MoKSk7XG4gICAgaWYoYyA9PT0gXCJcIikge1xuICAgICAgYyA9IENPTlRFWFRfRk9SX05FV19GSUxFUztcbiAgICB9XG5cbiAgICBpZiAoYy5zdGFydHNXaXRoKFwiPHNjcmlwdHNvbmx5XCIpKSB7XG4gICAgICAvLyB0aGlzIGlzIGJsb2NrcyBmaWxlLiBPcGVuIGl0IHdpdGggL2Jsb2Nrc1xuICAgICAgd2luZG93LmxvY2F0aW9uLmhyZWYgPSB3aW5kb3cubG9jYXRpb24uaHJlZi5yZXBsYWNlKCdlZGl0b3InLCAnYmxvY2tzJyk7XG4gICAgfVxuXG4gICAgaWYoIXBhcmFtc1tcImdldFwiXVtcImNvbnRyb2xsZWRcIl0pIHtcbiAgICAgIC8vIE5PVEUoam9lKTogQ2xlYXJpbmcgaGlzdG9yeSB0byBhZGRyZXNzIGh0dHBzOi8vZ2l0aHViLmNvbS9icm93bnBsdC9weXJldC1sYW5nL2lzc3Vlcy8zODYsXG4gICAgICAvLyBpbiB3aGljaCB1bmRvIGNhbiByZXZlcnQgdGhlIHByb2dyYW0gYmFjayB0byBlbXB0eVxuICAgICAgQ1BPLmVkaXRvci5jbS5zZXRWYWx1ZShjKTtcbiAgICAgIENQTy5lZGl0b3IuY20uY2xlYXJIaXN0b3J5KCk7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgY29uc3QgaGlkZVdoZW5Db250cm9sbGVkID0gW1xuICAgICAgICBcIiNmdWxsQ29ubmVjdEJ1dHRvblwiLFxuICAgICAgICBcIiNsb2dnaW5nXCIsXG4gICAgICAgIFwiI2xvZ291dFwiXG4gICAgICBdO1xuICAgICAgY29uc3QgcmVtb3ZlV2hlbkNvbnRyb2xsZWQgPSBbXG4gICAgICAgIFwiI2Nvbm5lY3RCdXR0b25saVwiLFxuICAgICAgXTtcbiAgICAgIGhpZGVXaGVuQ29udHJvbGxlZC5mb3JFYWNoKHMgPT4gJChzKS5oaWRlKCkpO1xuICAgICAgcmVtb3ZlV2hlbkNvbnRyb2xsZWQuZm9yRWFjaChzID0+ICQocykucmVtb3ZlKCkpO1xuICAgIH1cblxuICB9KTtcblxuICBwcm9ncmFtTG9hZGVkLmZhaWwoZnVuY3Rpb24oZXJyb3IpIHtcbiAgICBjb25zb2xlLmVycm9yKFwiUHJvZ3JhbSBjb250ZW50cyBkaWQgbm90IGxvYWQ6IFwiLCBlcnJvcik7XG4gICAgQ1BPLmRvY3VtZW50cy5zZXQoXCJkZWZpbml0aW9uczovL1wiLCBDUE8uZWRpdG9yLmNtLmdldERvYygpKTtcbiAgfSk7XG5cbiAgY29uc29sZS5sb2coXCJBYm91dCB0byBsb2FkIFB5cmV0OiBcIiwgb3JpZ2luYWxQYWdlTG9hZCwgRGF0ZS5ub3coKSk7XG5cbiAgdmFyIHB5cmV0TG9hZCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuICBjb25zb2xlLmxvZyh3aW5kb3cuUFlSRVQpO1xuICBweXJldExvYWQuc3JjID0gd2luZG93LlBZUkVUO1xuICBweXJldExvYWQudHlwZSA9IFwidGV4dC9qYXZhc2NyaXB0XCI7XG4gIHB5cmV0TG9hZC5zZXRBdHRyaWJ1dGUoXCJjcm9zc29yaWdpblwiLCBcImFub255bW91c1wiKTtcbiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChweXJldExvYWQpO1xuXG4gIHZhciBweXJldExvYWQyID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc2NyaXB0Jyk7XG5cbiAgZnVuY3Rpb24gbG9nRmFpbHVyZUFuZE1hbnVhbEZldGNoKHVybCwgZSkge1xuXG4gICAgLy8gTk9URShqb2UpOiBUaGUgZXJyb3IgcmVwb3J0ZWQgYnkgdGhlIFwiZXJyb3JcIiBldmVudCBoYXMgZXNzZW50aWFsbHkgbm9cbiAgICAvLyBpbmZvcm1hdGlvbiBvbiBpdDsgaXQncyBqdXN0IGEgbm90aWZpY2F0aW9uIHRoYXQgX3NvbWV0aGluZ18gd2VudCB3cm9uZy5cbiAgICAvLyBTbywgd2UgbG9nIHRoYXQgc29tZXRoaW5nIGhhcHBlbmVkLCB0aGVuIGltbWVkaWF0ZWx5IGRvIGFuIEFKQVggcmVxdWVzdFxuICAgIC8vIGNhbGwgZm9yIHRoZSBzYW1lIFVSTCwgdG8gc2VlIGlmIHdlIGNhbiBnZXQgbW9yZSBpbmZvcm1hdGlvbi4gVGhpc1xuICAgIC8vIGRvZXNuJ3QgcGVyZmVjdGx5IHRlbGwgdXMgYWJvdXQgdGhlIG9yaWdpbmFsIGZhaWx1cmUsIGJ1dCBpdCdzXG4gICAgLy8gc29tZXRoaW5nLlxuXG4gICAgLy8gSW4gYWRkaXRpb24sIGlmIHNvbWVvbmUgaXMgc2VlaW5nIHRoZSBQeXJldCBmYWlsZWQgdG8gbG9hZCBlcnJvciwgYnV0IHdlXG4gICAgLy8gZG9uJ3QgZ2V0IHRoZXNlIGxvZ2dpbmcgZXZlbnRzLCB3ZSBoYXZlIGEgc3Ryb25nIGhpbnQgdGhhdCBzb21ldGhpbmcgaXNcbiAgICAvLyB1cCB3aXRoIHRoZWlyIG5ldHdvcmsuXG4gICAgbG9nZ2VyLmxvZygncHlyZXQtbG9hZC1mYWlsdXJlJyxcbiAgICAgIHtcbiAgICAgICAgZXZlbnQgOiAnaW5pdGlhbC1mYWlsdXJlJyxcbiAgICAgICAgdXJsIDogdXJsLFxuXG4gICAgICAgIC8vIFRoZSB0aW1lc3RhbXAgYXBwZWFycyB0byBjb3VudCBmcm9tIHRoZSBiZWdpbm5pbmcgb2YgcGFnZSBsb2FkLFxuICAgICAgICAvLyB3aGljaCBtYXkgYXBwcm94aW1hdGUgZG93bmxvYWQgdGltZSBpZiwgc2F5LCByZXF1ZXN0cyBhcmUgdGltaW5nIG91dFxuICAgICAgICAvLyBvciBnZXR0aW5nIGN1dCBvZmYuXG5cbiAgICAgICAgdGltZVN0YW1wIDogZS50aW1lU3RhbXBcbiAgICAgIH0pO1xuXG4gICAgdmFyIG1hbnVhbEZldGNoID0gJC5hamF4KHVybCk7XG4gICAgbWFudWFsRmV0Y2gudGhlbihmdW5jdGlvbihyZXMpIHtcbiAgICAgIC8vIEhlcmUsIHdlIGxvZyB0aGUgZmlyc3QgMTAwIGNoYXJhY3RlcnMgb2YgdGhlIHJlc3BvbnNlIHRvIG1ha2Ugc3VyZVxuICAgICAgLy8gdGhleSByZXNlbWJsZSB0aGUgUHlyZXQgYmxvYlxuICAgICAgbG9nZ2VyLmxvZygncHlyZXQtbG9hZC1mYWlsdXJlJywge1xuICAgICAgICBldmVudCA6ICdzdWNjZXNzLXdpdGgtYWpheCcsXG4gICAgICAgIGNvbnRlbnRzUHJlZml4IDogcmVzLnNsaWNlKDAsIDEwMClcbiAgICAgIH0pO1xuICAgIH0pO1xuICAgIG1hbnVhbEZldGNoLmZhaWwoZnVuY3Rpb24ocmVzKSB7XG4gICAgICBsb2dnZXIubG9nKCdweXJldC1sb2FkLWZhaWx1cmUnLCB7XG4gICAgICAgIGV2ZW50IDogJ2ZhaWx1cmUtd2l0aC1hamF4JyxcbiAgICAgICAgc3RhdHVzOiByZXMuc3RhdHVzLFxuICAgICAgICBzdGF0dXNUZXh0OiByZXMuc3RhdHVzVGV4dCxcbiAgICAgICAgLy8gU2luY2UgcmVzcG9uc2VUZXh0IGNvdWxkIGJlIGEgbG9uZyBlcnJvciBwYWdlLCBhbmQgd2UgZG9uJ3Qgd2FudCB0b1xuICAgICAgICAvLyBsb2cgaHVnZSBwYWdlcywgd2Ugc2xpY2UgaXQgdG8gMTAwIGNoYXJhY3RlcnMsIHdoaWNoIGlzIGVub3VnaCB0b1xuICAgICAgICAvLyB0ZWxsIHVzIHdoYXQncyBnb2luZyBvbiAoZS5nLiBBV1MgZmFpbHVyZSwgbmV0d29yayBvdXRhZ2UpLlxuICAgICAgICByZXNwb25zZVRleHQ6IHJlcy5yZXNwb25zZVRleHQuc2xpY2UoMCwgMTAwKVxuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICAkKHB5cmV0TG9hZCkub24oXCJlcnJvclwiLCBmdW5jdGlvbihlKSB7XG4gICAgbG9nRmFpbHVyZUFuZE1hbnVhbEZldGNoKHdpbmRvdy5QWVJFVCwgZSk7XG4gICAgcHlyZXRMb2FkMi5zcmMgPSBwcm9jZXNzLmVudi5QWVJFVF9CQUNLVVA7XG4gICAgcHlyZXRMb2FkMi50eXBlID0gXCJ0ZXh0L2phdmFzY3JpcHRcIjtcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHB5cmV0TG9hZDIpO1xuICB9KTtcblxuICAkKHB5cmV0TG9hZDIpLm9uKFwiZXJyb3JcIiwgZnVuY3Rpb24oZSkge1xuICAgICQoXCIjbG9hZGVyXCIpLmhpZGUoKTtcbiAgICAkKFwiI3J1blBhcnRcIikuaGlkZSgpO1xuICAgICQoXCIjYnJlYWtCdXR0b25cIikuaGlkZSgpO1xuICAgIHdpbmRvdy5zdGlja0Vycm9yKFwiUHlyZXQgZmFpbGVkIHRvIGxvYWQ7IGNoZWNrIHlvdXIgY29ubmVjdGlvbiBvciB0cnkgcmVmcmVzaGluZyB0aGUgcGFnZS4gIElmIHRoaXMgaGFwcGVucyByZXBlYXRlZGx5LCBwbGVhc2UgcmVwb3J0IGl0IGFzIGEgYnVnLlwiKTtcbiAgICBsb2dGYWlsdXJlQW5kTWFudWFsRmV0Y2gocHJvY2Vzcy5lbnYuUFlSRVRfQkFDS1VQLCBlKTtcblxuICB9KTtcblxuICBmdW5jdGlvbiBtYWtlRXZlbnQoKSB7XG4gICAgY29uc3QgaGFuZGxlcnMgPSBbXTtcbiAgICBmdW5jdGlvbiBvbihoYW5kbGVyKSB7XG4gICAgICBoYW5kbGVycy5wdXNoKGhhbmRsZXIpO1xuICAgIH1cbiAgICBmdW5jdGlvbiB0cmlnZ2VyKHYpIHtcbiAgICAgIGhhbmRsZXJzLmZvckVhY2goaCA9PiBoKHYpKTtcbiAgICB9XG4gICAgcmV0dXJuIFtvbiwgdHJpZ2dlcl07XG4gIH1cbiAgbGV0IFsgb25SdW4sIHRyaWdnZXJPblJ1biBdID0gbWFrZUV2ZW50KCk7XG4gIGxldCBbIG9uSW50ZXJhY3Rpb24sIHRyaWdnZXJPbkludGVyYWN0aW9uIF0gPSBtYWtlRXZlbnQoKTtcbiAgbGV0IFsgb25Mb2FkLCB0cmlnZ2VyT25Mb2FkIF0gPSBtYWtlRXZlbnQoKTtcblxuICBwcm9ncmFtTG9hZGVkLmZpbihmdW5jdGlvbigpIHtcbiAgICBDUE8uZWRpdG9yLmZvY3VzKCk7XG4gICAgQ1BPLmVkaXRvci5jbS5zZXRPcHRpb24oXCJyZWFkT25seVwiLCBmYWxzZSk7XG4gIH0pO1xuXG4gIENQTy5hdXRvU2F2ZSA9IGF1dG9TYXZlO1xuICBDUE8uc2F2ZSA9IHNhdmU7XG4gIENQTy51cGRhdGVOYW1lID0gdXBkYXRlTmFtZTtcbiAgQ1BPLnNob3dTaGFyZUNvbnRhaW5lciA9IHNob3dTaGFyZUNvbnRhaW5lcjtcbiAgQ1BPLmxvYWRQcm9ncmFtID0gbG9hZFByb2dyYW07XG4gIENQTy5zdG9yYWdlQVBJID0gc3RvcmFnZUFQSTtcbiAgQ1BPLmN5Y2xlRm9jdXMgPSBjeWNsZUZvY3VzO1xuICBDUE8uc2F5ID0gc2F5O1xuICBDUE8uc2F5QW5kRm9yZ2V0ID0gc2F5QW5kRm9yZ2V0O1xuICBDUE8uZXZlbnRzID0ge1xuICAgIG9uUnVuLFxuICAgIHRyaWdnZXJPblJ1bixcbiAgICBvbkludGVyYWN0aW9uLFxuICAgIHRyaWdnZXJPbkludGVyYWN0aW9uLFxuICAgIG9uTG9hZCxcbiAgICB0cmlnZ2VyT25Mb2FkXG4gIH07XG5cbiAgLy8gV2UgbmV2ZXIgd2FudCBpbnRlcmFjdGlvbnMgdG8gYmUgaGlkZGVuICp3aGVuIHJ1bm5pbmcgY29kZSouXG4gIC8vIFNvIGhpZGVJbnRlcmFjdGlvbnMgc2hvdWxkIGdvIGF3YXkgYXMgc29vbiBhcyBydW4gaXMgY2xpY2tlZFxuICBDUE8uZXZlbnRzLm9uUnVuKCgpID0+IHsgZG9jdW1lbnQuYm9keS5jbGFzc0xpc3QucmVtb3ZlKFwiaGlkZUludGVyYWN0aW9uc1wiKTsgfSk7XG5cbiAgbGV0IGluaXRpYWxTdGF0ZSA9IHBhcmFtc1tcImdldFwiXVtcImluaXRpYWxTdGF0ZVwiXTtcblxuICBpZiAodHlwZW9mIGFjcXVpcmVWc0NvZGVBcGkgPT09IFwiZnVuY3Rpb25cIikge1xuICAgIHdpbmRvdy5NRVNTQUdFUyA9IG1ha2VFdmVudHMoe1xuICAgICAgQ1BPOiBDUE8sXG4gICAgICBzZW5kUG9ydDogYWNxdWlyZVZzQ29kZUFwaSgpLFxuICAgICAgcmVjZWl2ZVBvcnQ6IHdpbmRvdyxcbiAgICAgIGluaXRpYWxTdGF0ZVxuICAgIH0pO1xuICB9XG4gIGVsc2UgaWYoKHdpbmRvdy5wYXJlbnQgJiYgKHdpbmRvdy5wYXJlbnQgIT09IHdpbmRvdykpKSB7XG4gICAgd2luZG93Lk1FU1NBR0VTID0gbWFrZUV2ZW50cyh7IENQTzogQ1BPLCBzZW5kUG9ydDogd2luZG93LnBhcmVudCwgcmVjZWl2ZVBvcnQ6IHdpbmRvdywgaW5pdGlhbFN0YXRlIH0pO1xuICB9XG59KTtcbiJdLCJuYW1lcyI6WyJkZWZpbmUiLCJRIiwiYXV0b0hpZ2hsaWdodEJveCIsInRleHQiLCJ0ZXh0Qm94IiwiJCIsImFkZENsYXNzIiwiYXR0ciIsIm9uIiwic2VsZWN0IiwidmFsIiwicHJvbXB0UXVldWUiLCJzdHlsZXMiLCJ3aW5kb3ciLCJtb2RhbHMiLCJQcm9tcHQiLCJvcHRpb25zIiwicHVzaCIsImluZGV4T2YiLCJzdHlsZSIsImxlbmd0aCIsIkVycm9yIiwibW9kYWwiLCJlbHRzIiwicGFyc2VIVE1MIiwidGl0bGUiLCJtb2RhbENvbnRlbnQiLCJjbG9zZUJ1dHRvbiIsInN1Ym1pdEJ1dHRvbiIsInN1Ym1pdFRleHQiLCJjYW5jZWxUZXh0IiwidG9nZ2xlQ2xhc3MiLCJuYXJyb3ciLCJpc0NvbXBpbGVkIiwiZGVmZXJyZWQiLCJkZWZlciIsInByb21pc2UiLCJwcm90b3R5cGUiLCJzaG93IiwiY2FsbGJhY2siLCJoaWRlU3VibWl0IiwiaGlkZSIsImNsaWNrIiwib25DbG9zZSIsImJpbmQiLCJrZXlwcmVzcyIsImUiLCJ3aGljaCIsIm9uU3VibWl0IiwiZG9jQ2xpY2siLCJ0YXJnZXQiLCJpcyIsImRvY3VtZW50Iiwib2ZmIiwiZG9jS2V5ZG93biIsImtleSIsImtleWRvd24iLCJwb3B1bGF0ZU1vZGFsIiwiY3NzIiwiZm9jdXMiLCJ0aGVuIiwiY2xlYXJNb2RhbCIsImVtcHR5IiwiY3JlYXRlUmFkaW9FbHQiLCJvcHRpb24iLCJpZHgiLCJlbHQiLCJpZCIsInRvU3RyaW5nIiwibGFiZWwiLCJ2YWx1ZSIsIm1lc3NhZ2UiLCJlbHRDb250YWluZXIiLCJhcHBlbmQiLCJsYWJlbENvbnRhaW5lciIsImNvbnRhaW5lciIsImV4YW1wbGUiLCJjbSIsIkNvZGVNaXJyb3IiLCJtb2RlIiwibGluZU51bWJlcnMiLCJyZWFkT25seSIsInNldFRpbWVvdXQiLCJyZWZyZXNoIiwiZXhhbXBsZUNvbnRhaW5lciIsImNyZWF0ZVRpbGVFbHQiLCJkZXRhaWxzIiwiZXZ0IiwiY3JlYXRlVGV4dEVsdCIsImlucHV0IiwiZGVmYXVsdFZhbHVlIiwiZHJhd0VsZW1lbnQiLCJjcmVhdGVDb3B5VGV4dEVsdCIsImJveCIsImNyZWF0ZUNvbmZpcm1FbHQiLCJ0aGF0IiwiY3JlYXRlRWx0IiwiaSIsIm9wdGlvbkVsdHMiLCJtYXAiLCJyZXNvbHZlIiwicmV0dmFsIiwib3JpZ2luYWxQYWdlTG9hZCIsIkRhdGUiLCJub3ciLCJjb25zb2xlIiwibG9nIiwiaXNFbWJlZGRlZCIsInBhcmVudCIsInNoYXJlQVBJIiwibWFrZVNoYXJlQVBJIiwicHJvY2VzcyIsImVudiIsIkNVUlJFTlRfUFlSRVRfUkVMRUFTRSIsInVybCIsInJlcXVpcmUiLCJtb2RhbFByb21wdCIsIkxPRyIsImN0X2xvZyIsImFwcGx5IiwiYXJndW1lbnRzIiwiY3RfZXJyb3IiLCJlcnJvciIsImluaXRpYWxQYXJhbXMiLCJwYXJzZSIsImxvY2F0aW9uIiwiaHJlZiIsInBhcmFtcyIsImhpZ2hsaWdodE1vZGUiLCJjbGVhckZsYXNoIiwid2hpdGVUb0JsYWNrTm90aWZpY2F0aW9uIiwic3RpY2tFcnJvciIsIm1vcmUiLCJDUE8iLCJzYXlBbmRGb3JnZXQiLCJlcnIiLCJ0b29sdGlwIiwicHJlcGVuZCIsImZsYXNoRXJyb3IiLCJmYWRlT3V0IiwiZmxhc2hNZXNzYWdlIiwibXNnIiwic3RpY2tNZXNzYWdlIiwic3RpY2tSaWNoTWVzc2FnZSIsImNvbnRlbnQiLCJta1dhcm5pbmdVcHBlciIsIm1rV2FybmluZ0xvd2VyIiwiRG9jdW1lbnRzIiwiZG9jdW1lbnRzIiwiTWFwIiwiaGFzIiwibmFtZSIsImdldCIsInNldCIsImRvYyIsImxvZ2dlciIsImlzRGV0YWlsZWQiLCJnZXRWYWx1ZSIsImZvckVhY2giLCJmIiwiVkVSU0lPTl9DSEVDS19JTlRFUlZBTCIsIk1hdGgiLCJyYW5kb20iLCJjaGVja1ZlcnNpb24iLCJyZXNwIiwiSlNPTiIsInZlcnNpb24iLCJzZXRJbnRlcnZhbCIsInNhdmUiLCJhdXRvU2F2ZSIsIkNPTlRFWFRfRk9SX05FV19GSUxFUyIsIkNPTlRFWFRfUFJFRklYIiwibWVyZ2UiLCJvYmoiLCJleHRlbnNpb24iLCJuZXdvYmoiLCJPYmplY3QiLCJrZXlzIiwiayIsImFuaW1hdGlvbkRpdiIsImNsb3NlQW5pbWF0aW9uSWZPcGVuIiwiZGlhbG9nIiwibWFrZUVkaXRvciIsImluaXRpYWwiLCJoYXNPd25Qcm9wZXJ0eSIsInRleHRhcmVhIiwialF1ZXJ5IiwicnVuRnVuIiwiY29kZSIsInJlcGxPcHRpb25zIiwicnVuIiwiQ00iLCJ1c2VMaW5lTnVtYmVycyIsInNpbXBsZUVkaXRvciIsInVzZUZvbGRpbmciLCJndXR0ZXJzIiwicmVpbmRlbnRBbGxMaW5lcyIsImxhc3QiLCJsaW5lQ291bnQiLCJvcGVyYXRpb24iLCJpbmRlbnRMaW5lIiwiQ09ERV9MSU5FX1dJRFRIIiwicnVsZXJzIiwicnVsZXJzTWluQ29sIiwiY29sb3IiLCJjb2x1bW4iLCJsaW5lU3R5bGUiLCJjbGFzc05hbWUiLCJtYWMiLCJrZXlNYXAiLCJtYWNEZWZhdWx0IiwibW9kaWZpZXIiLCJjbU9wdGlvbnMiLCJleHRyYUtleXMiLCJub3JtYWxpemVLZXlNYXAiLCJfZGVmaW5lUHJvcGVydHkiLCJTaGlmdEVudGVyIiwiU2hpZnRDdHJsRW50ZXIiLCJjb25jYXQiLCJpbmRlbnRVbml0IiwidGFiU2l6ZSIsInZpZXdwb3J0TWFyZ2luIiwiSW5maW5pdHkiLCJtYXRjaEtleXdvcmRzIiwibWF0Y2hCcmFja2V0cyIsInN0eWxlU2VsZWN0ZWRUZXh0IiwiZm9sZEd1dHRlciIsImxpbmVXcmFwcGluZyIsImxvZ2dpbmciLCJzY3JvbGxQYXN0RW5kIiwiZnJvbVRleHRBcmVhIiwiZmlyc3RMaW5lSXNOYW1lc3BhY2UiLCJmaXJzdGxpbmUiLCJnZXRMaW5lIiwibWF0Y2giLCJuYW1lc3BhY2VtYXJrIiwic2V0Q29udGV4dExpbmUiLCJuZXdDb250ZXh0TGluZSIsImhhc05hbWVzcGFjZSIsImNsZWFyIiwicmVwbGFjZVJhbmdlIiwibGluZSIsImNoIiwiZ3V0dGVyUXVlc3Rpb25XcmFwcGVyIiwiY3JlYXRlRWxlbWVudCIsImd1dHRlclRvb2x0aXAiLCJpbm5lclRleHQiLCJndXR0ZXJRdWVzdGlvbiIsInNyYyIsIkFQUF9CQVNFX1VSTCIsImFwcGVuZENoaWxkIiwic2V0R3V0dGVyTWFya2VyIiwiZ2V0V3JhcHBlckVsZW1lbnQiLCJvbm1vdXNlbGVhdmUiLCJjbGVhckd1dHRlciIsIm9ubW91c2Vtb3ZlIiwibGluZUNoIiwiY29vcmRzQ2hhciIsImxlZnQiLCJjbGllbnRYIiwidG9wIiwiY2xpZW50WSIsIm1hcmtlcnMiLCJmaW5kTWFya3NBdCIsImNoYW5nZSIsImRvZXNOb3RDaGFuZ2VGaXJzdExpbmUiLCJjIiwiZnJvbSIsImN1ck9wIiwiY2hhbmdlT2JqcyIsImV2ZXJ5IiwibWFya1RleHQiLCJhdHRyaWJ1dGVzIiwidXNlbGluZSIsImF0b21pYyIsImluY2x1c2l2ZUxlZnQiLCJpbmNsdXNpdmVSaWdodCIsImRpc3BsYXkiLCJ3cmFwcGVyIiwiZ2V0VG9wVGllck1lbnVpdGVtcyIsImZvY3VzQ2Fyb3VzZWwiLCJSVU5fQ09ERSIsInNldFVzZXJuYW1lIiwiZ3dyYXAiLCJsb2FkIiwiYXBpIiwicGVvcGxlIiwidXNlcklkIiwidXNlciIsImRpc3BsYXlOYW1lIiwiZW1haWxzIiwic3RvcmFnZUFQSSIsImNvbGxlY3Rpb24iLCJmYWlsIiwicmVhdXRoIiwiY3JlYXRlUHJvZ3JhbUNvbGxlY3Rpb25BUEkiLCJhY3RpdmVFbGVtZW50IiwiYmx1ciIsInRvTG9hZCIsImdldEZpbGVCeUlkIiwibG9hZFByb2dyYW0iLCJwcm9ncmFtVG9TYXZlIiwiZmNhbGwiLCJpbml0aWFsUHJvZ3JhbSIsIm1ha2VVcmxGaWxlIiwicHJvZ3JhbUxvYWQiLCJlbmFibGVGaWxlT3B0aW9ucyIsInAiLCJzaG93U2hhcmVDb250YWluZXIiLCJnZXRTaGFyZWRGaWxlQnlJZCIsImZpbGUiLCJnZXRPcmlnaW5hbCIsInJlc3BvbnNlIiwib3JpZ2luYWwiLCJyZXN1bHQiLCJyZW1vdmVDbGFzcyIsIm9wZW4iLCJzZXRUaXRsZSIsInByb2dOYW1lIiwiZmlsZW5hbWUiLCJkb3dubG9hZEVsdCIsImNvbnRlbnRzIiwiZWRpdG9yIiwiZG93bmxvYWRCbG9iIiwiVVJMIiwiY3JlYXRlT2JqZWN0VVJMIiwiQmxvYiIsInR5cGUiLCJkb3dubG9hZCIsInNob3dNb2RhbCIsImN1cnJlbnRDb250ZXh0IiwiZWxlbWVudCIsImdyZWV0aW5nIiwic2hhcmVkIiwiY3VycmVudENvbnRleHRFbHQiLCJlc3NlbnRpYWxzIiwibGlzdCIsInVzZUNvbnRleHQiLCJpbnB1dFdyYXBwZXIiLCJlbnRyeSIsIm5hbWVzcGFjZVJlc3VsdCIsInRyaW0iLCJmaXJzdExpbmUiLCJjb250ZXh0TGVuIiwic2xpY2UiLCJUUlVOQ0FURV9MRU5HVEgiLCJ0cnVuY2F0ZU5hbWUiLCJ1cGRhdGVOYW1lIiwiZ2V0TmFtZSIsInByb2ciLCJnZXRDb250ZW50cyIsInNheSIsImZvcmdldCIsImFubm91bmNlbWVudHMiLCJnZXRFbGVtZW50QnlJZCIsImxpIiwiY3JlYXRlVGV4dE5vZGUiLCJpbnNlcnRCZWZvcmUiLCJmaXJzdENoaWxkIiwicmVtb3ZlQ2hpbGQiLCJjeWNsZUFkdmFuY2UiLCJjdXJySW5kZXgiLCJtYXhJbmRleCIsInJldmVyc2VQIiwibmV4dEluZGV4IiwicG9wdWxhdGVGb2N1c0Nhcm91c2VsIiwiZmMiLCJkb2NtYWluIiwidG9vbGJhciIsImRvY3JlcGxNYWluIiwiZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSIsImRvY3JlcGxNYWluMCIsInVuZGVmaW5lZCIsImRvY3JlcGwiLCJkb2NyZXBsY29kZSIsImN5Y2xlRm9jdXMiLCJmQ2Fyb3VzZWwiLCJjdXJyZW50Rm9jdXNlZEVsdCIsImZpbmQiLCJub2RlIiwiY29udGFpbnMiLCJjdXJyZW50Rm9jdXNJbmRleCIsIm5leHRGb2N1c0luZGV4IiwiZm9jdXNFbHQiLCJmb2N1c0VsdDAiLCJjbGFzc0xpc3QiLCJ0ZXh0YXJlYXMiLCJnZXRFbGVtZW50c0J5VGFnTmFtZSIsInJlbW92ZUF0dHJpYnV0ZSIsInByb2dyYW1Mb2FkZWQiLCJtYWtlU2hhcmVMaW5rIiwibmFtZU9yVW50aXRsZWQiLCJtZW51SXRlbURpc2FibGVkIiwiaGFzQ2xhc3MiLCJuZXdFdmVudCIsInNhdmVFdmVudCIsIm5ld0ZpbGVuYW1lIiwidXNlTmFtZSIsImNyZWF0ZSIsInNhdmVkUHJvZ3JhbSIsImNyZWF0ZUZpbGUiLCJoaXN0b3J5IiwicHVzaFN0YXRlIiwiZ2V0VW5pcXVlSWQiLCJzYXZlQXMiLCJzYXZlQXNQcm9tcHQiLCJuZXdOYW1lIiwicmVuYW1lIiwicmVuYW1lUHJvbXB0IiwiZm9jdXNhYmxlRWx0cyIsInRoZVRvb2xiYXIiLCJ0b3BUaWVyTWVudWl0ZW1zIiwidG9BcnJheSIsImZpbHRlciIsImdldEF0dHJpYnV0ZSIsIm51bVRvcFRpZXJNZW51aXRlbXMiLCJpdGhUb3BUaWVyTWVudWl0ZW0iLCJpQ2hpbGQiLCJjaGlsZHJlbiIsImZpcnN0IiwidXBkYXRlRWRpdG9ySGVpZ2h0IiwidG9vbGJhckhlaWdodCIsIm9mZnNldEhlaWdodCIsInBhZGRpbmdUb3AiLCJkb2NNYWluIiwiZG9jUmVwbE1haW4iLCJpbnNlcnRBcmlhUG9zIiwic3VibWVudSIsImFyciIsImxlbiIsInNldEF0dHJpYnV0ZSIsImFkZEV2ZW50TGlzdGVuZXIiLCJoaWRlQWxsVG9wTWVudWl0ZW1zIiwic3RvcFByb3BhZ2F0aW9uIiwia2MiLCJrZXlDb2RlIiwiY2xpY2tUb3BNZW51aXRlbSIsInRoaXNFbHQiLCJ0b3BUaWVyVWwiLCJjbG9zZXN0IiwiaGFzQXR0cmlidXRlIiwidGhpc1RvcE1lbnVpdGVtIiwidDEiLCJzdWJtZW51T3BlbiIsImV4cGFuZGFibGVFbHRzIiwibm9uZXhwYW5kYWJsZUVsdHMiLCJzd2l0Y2hUb3BNZW51aXRlbSIsImRlc3RUb3BNZW51aXRlbSIsImRlc3RFbHQiLCJlbHRJZCIsInNob3dpbmdIZWxwS2V5cyIsInNob3dIZWxwS2V5cyIsImZhZGVJbiIsInJlY2l0ZUhlbHAiLCJ3aXRoaW5TZWNvbmRUaWVyVWwiLCJzZWNvbmRUaWVyVWwiLCJwb3NzRWx0cyIsInNyY1RvcE1lbnVpdGVtIiwidHRtaU4iLCJqIiwibmVhclNpYnMiLCJteUlkIiwidGhpc0VuY291bnRlcmVkIiwiYWRkIiwiZmFyU2licyIsInByZXZBbGwiLCJzdWJtZW51RGl2cyIsIm5leHRBbGwiLCJwcmV2ZW50RGVmYXVsdCIsInNoaWZ0S2V5IiwiY3RybEtleSIsImNvZGVDb250YWluZXIiLCJpc0NvbnRyb2xsZWQiLCJoYXNXYXJuT25FeGl0Iiwic2tpcFdhcm5pbmciLCJydW5CdXR0b24iLCJpbml0aWFsR2FzIiwic2V0T3B0aW9uIiwicmVtb3ZlU2hvcnRlbmVkTGluZSIsImxpbmVIYW5kbGUiLCJnZXRPcHRpb24iLCJsb25nTGluZXMiLCJydWxlckxpc3RlbmVycyIsInJlZnJlc2hSdWxlcnMiLCJkZWxldGVMaW5lIiwibWluTGVuZ3RoIiwic2l6ZSIsIk51bWJlciIsIk1BWF9WQUxVRSIsImxpbmVObyIsImluc3RhbmNlIiwibWluTGluZSIsImxhc3RMaW5lIiwibWF4TGluZSIsImNoYW5nZWQiLCJlYWNoTGluZSIsImdldERvYyIsInN0YXJ0c1dpdGgiLCJyZXBsYWNlIiwic2V0VmFsdWUiLCJjbGVhckhpc3RvcnkiLCJoaWRlV2hlbkNvbnRyb2xsZWQiLCJyZW1vdmVXaGVuQ29udHJvbGxlZCIsInMiLCJyZW1vdmUiLCJweXJldExvYWQiLCJQWVJFVCIsImJvZHkiLCJweXJldExvYWQyIiwibG9nRmFpbHVyZUFuZE1hbnVhbEZldGNoIiwiZXZlbnQiLCJ0aW1lU3RhbXAiLCJtYW51YWxGZXRjaCIsImFqYXgiLCJyZXMiLCJjb250ZW50c1ByZWZpeCIsInN0YXR1cyIsInN0YXR1c1RleHQiLCJyZXNwb25zZVRleHQiLCJQWVJFVF9CQUNLVVAiLCJtYWtlRXZlbnQiLCJoYW5kbGVycyIsImhhbmRsZXIiLCJ0cmlnZ2VyIiwidiIsImgiLCJfbWFrZUV2ZW50IiwiX21ha2VFdmVudDIiLCJfc2xpY2VkVG9BcnJheSIsIm9uUnVuIiwidHJpZ2dlck9uUnVuIiwiX21ha2VFdmVudDMiLCJfbWFrZUV2ZW50NCIsIm9uSW50ZXJhY3Rpb24iLCJ0cmlnZ2VyT25JbnRlcmFjdGlvbiIsIl9tYWtlRXZlbnQ1IiwiX21ha2VFdmVudDYiLCJvbkxvYWQiLCJ0cmlnZ2VyT25Mb2FkIiwiZmluIiwiZXZlbnRzIiwiaW5pdGlhbFN0YXRlIiwiYWNxdWlyZVZzQ29kZUFwaSIsIk1FU1NBR0VTIiwibWFrZUV2ZW50cyIsInNlbmRQb3J0IiwicmVjZWl2ZVBvcnQiXSwic291cmNlUm9vdCI6IiJ9