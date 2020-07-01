define([
  "lodash",
  "app/core/core",
  "app/core/utils/datemath",
  "app/plugins/sdk",
  "react"
], function(e, t, n, r, s) {
  return (function(e) {
    var t = {};
    function n(r) {
      if (t[r]) return t[r].exports;
      var s = (t[r] = { i: r, l: !1, exports: {} });
      return e[r].call(s.exports, s, s.exports, n), (s.l = !0), s.exports;
    }
    return (
      (n.m = e),
      (n.c = t),
      (n.d = function(e, t, r) {
        n.o(e, t) || Object.defineProperty(e, t, { enumerable: !0, get: r });
      }),
      (n.r = function(e) {
        "undefined" != typeof Symbol &&
          Symbol.toStringTag &&
          Object.defineProperty(e, Symbol.toStringTag, { value: "Module" }),
          Object.defineProperty(e, "__esModule", { value: !0 });
      }),
      (n.t = function(e, t) {
        if ((1 & t && (e = n(e)), 8 & t)) return e;
        if (4 & t && "object" == typeof e && e && e.__esModule) return e;
        var r = Object.create(null);
        if (
          (n.r(r),
          Object.defineProperty(r, "default", { enumerable: !0, value: e }),
          2 & t && "string" != typeof e)
        )
          for (var s in e)
            n.d(
              r,
              s,
              function(t) {
                return e[t];
              }.bind(null, s)
            );
        return r;
      }),
      (n.n = function(e) {
        var t =
          e && e.__esModule
            ? function() {
                return e.default;
              }
            : function() {
                return e;
              };
        return n.d(t, "a", t), t;
      }),
      (n.o = function(e, t) {
        return Object.prototype.hasOwnProperty.call(e, t);
      }),
      (n.p = ""),
      n((n.s = 15))
    );
  })([
    function(t, n) {
      t.exports = e;
    },
    function(e, t, n) {
      "use strict";
      Object.defineProperty(t, "__esModule", { value: !0 }),
        (t.HttpMethod = t.ParseType = t.Tab = t.eventFactory = t.isError = void 0),
        (t.isError = function(e) {
          return void 0 !== e.error;
        }),
        (t.eventFactory = function(e) {
          return { name: e };
        }),
        (function(e) {
          (e.Timeseries = "Timeseries"),
            (e.Asset = "Asset"),
            (e.Custom = "Custom");
        })(t.Tab || (t.Tab = {})),
        (function(e) {
          (e.Timeseries = "Timeseries"),
            (e.Asset = "Asset"),
            (e.Event = "Event");
        })(t.ParseType || (t.ParseType = {})),
        (function(e) {
          (e.POST = "POST"),
            (e.GET = "GET"),
            (e.PATCH = "PATCH"),
            (e.DELETE = "DELETE");
        })(t.HttpMethod || (t.HttpMethod = {}));
    },
    function(e, t, n) {
      "use strict";
      var r = function(e) {
        return e && e.__esModule ? e : { default: e };
      };
      Object.defineProperty(t, "__esModule", { value: !0 }),
        (t.checkFilter = t.applyFilters = t.getRequestId = t.ms2String = t.getQueryString = void 0);
      var s = n(0),
        o = n(17),
        a = r(n(10)),
        i = n(11);
      (t.getQueryString = function(e) {
        return o.stringify(s.omitBy(e, s.isNil));
      }),
        (t.ms2String = function(e) {
          return a.default(e < 1e3 ? 1e3 : e);
        }),
        (t.getRequestId = function(e, t) {
          return e.dashboardId + "_" + e.panelId + "_" + t.refId;
        }),
        (t.applyFilters = function(e, n) {
          return n.length
            ? e.filter(function(e) {
                return n.every(function(n) {
                  return t.checkFilter(e, n);
                });
              })
            : e;
        }),
        (t.checkFilter = function(e, t) {
          var n = t.path,
            r = t.filter,
            o = t.value,
            a = s.get(e, n, null),
            l = new RegExp("^" + o + "$");
          switch (r) {
            case i.FilterType.RegexEquals:
              return l.test(a);
            case i.FilterType.RegexNotEquals:
              return !l.test(a);
            case i.FilterType.NotEquals:
              return o !== a;
          }
        });
    },
    function(e, t, n) {
      "use strict";
      var r = function() {
          return (r =
            Object.assign ||
            function(e) {
              for (var t, n = 1, r = arguments.length; n < r; n++)
                for (var s in (t = arguments[n]))
                  Object.prototype.hasOwnProperty.call(t, s) && (e[s] = t[s]);
              return e;
            }).apply(this, arguments);
        },
        s = Object.create
          ? function(e, t, n, r) {
              void 0 === r && (r = n),
                Object.defineProperty(e, r, {
                  enumerable: !0,
                  get: function() {
                    return t[n];
                  }
                });
            }
          : function(e, t, n, r) {
              void 0 === r && (r = n), (e[r] = t[n]);
            },
        o = Object.create
          ? function(e, t) {
              Object.defineProperty(e, "default", { enumerable: !0, value: t });
            }
          : function(e, t) {
              e.default = t;
            },
        a = function(e) {
          if (e && e.__esModule) return e;
          var t = {};
          if (null != e)
            for (var n in e)
              "default" !== n && Object.hasOwnProperty.call(e, n) && s(t, e, n);
          return o(t, e), t;
        },
        i = function(e) {
          return e && e.__esModule ? e : { default: e };
        };
      Object.defineProperty(t, "__esModule", { value: !0 }),
        (t.parseWith = t.parseQuery = t.formatQueryParse = t.parse = void 0);
      var l = a(n(0)),
        u = i(n(5)),
        c = i(n(27)),
        p = i(n(28)),
        f = n(12),
        m = i(n(30)),
        b = f.Grammar.fromCompiled(m.default),
        d = u.default(l.default),
        h = c.default(l.default),
        y = p.default(l.default),
        $ = function(e, t) {
          var n,
            r = t.trim();
          try {
            e.feed(r), (n = e.finish()[0]);
          } catch (e) {
            var s = v(e, r);
            throw new Error(s);
          }
          if (!n) {
            s = v({ offset: r.length }, r, "Parser: Unexpected end of input");
            throw new Error(s);
          }
          return n;
        };
      t.parseWith = $;
      var g = function(e) {
        return $(new f.Parser(b), e);
      };
      t.parseQuery = g;
      var v = function(e, t, n) {
          var r = e.offset;
          void 0 === n && (n = "Parser: Syntax error");
          var s = Number.isInteger(r) ? r + 1 : t.length;
          return n + ":\n" + (t + "\n" + Array(s).join(" ") + "^");
        },
        x = function(e) {
          var t = e.type,
            n = e.query,
            s = d(n, function(e, t, n) {
              var r = n.value,
                s = n.filter;
              return !l.isUndefined(r) && s;
            }),
            o = s
              ? s.reduce(function(e, t) {
                  return r(r({}, e), t);
                }, {})
              : {},
            a = y(o, ["filter", "value", "key"]),
            i = h(a, { pathFormat: "array" }).map(function(e) {
              var t = e.join("."),
                n = e.slice(0, -1),
                r = l.get(o, t),
                s = r.filter,
                a = r.key,
                i = r.value;
              return n.push(a), { filter: s, value: i, path: n.join(".") };
            }),
            u = d(n, function(e, t, n) {
              var r = n.value,
                s = n.filter;
              return !(!l.isUndefined(r) && s);
            });
          return {
            type: t,
            params: u
              ? u.reduce(function(e, t) {
                  return r(r({}, e), t);
                }, {})
              : {},
            filters: i
          };
        };
      t.formatQueryParse = x;
      t.parse = function(e) {
        var t = g(e);
        return x(t);
      };
    },
    function(e, t, n) {
      "use strict";
      Object.defineProperty(t, "__esModule", { value: !0 }),
        (t.CacheTime = t.datapointsWarningEvent = t.failedResponseEvent = t.TIMESERIES_LIMIT_WARNING = t.DATAPOINTS_LIMIT_WARNING = void 0);
      var r = n(1);
      (t.DATAPOINTS_LIMIT_WARNING =
        "Datapoints limit was reached, so not all datapoints may be shown. Try increasing the granularity, or choose a smaller time range."),
        (t.TIMESERIES_LIMIT_WARNING =
          "Only showing first 100 timeseries. To get better results, either change the selected asset or use 'Custom Query'."),
        (t.failedResponseEvent = r.eventFactory("failed-request")),
        (t.datapointsWarningEvent = r.eventFactory("datapoints-warning")),
        (t.CacheTime = {
          TimeseriesList: "61s",
          TimeseriesByIds: "61m",
          Default: "11s"
        });
    },
    function(e, t, n) {
      "use strict";
      var r = n(6),
        s = n(7),
        o = n(23),
        a = n(25),
        i = n(26);
      e.exports = function(e) {
        var t = s(e),
          n = r(e),
          l = i(e),
          u = o(e),
          c = a(e);
        return function(r, s, o) {
          (s = e.iteratee(s)),
            o
              ? void 0 !== (o = e.cloneDeep(o)).leafsOnly &&
                (o.leavesOnly = o.leafsOnly)
              : (o = {}),
            o.onTrue || (o.onTrue = {}),
            o.onFalse || (o.onFalse = {}),
            o.onUndefined || (o.onUndefined = {}),
            void 0 !== o.childrenPath &&
              (void 0 === o.onTrue.skipChildren && (o.onTrue.skipChildren = !1),
              void 0 === o.onUndefined.skipChildren &&
                (o.onUndefined.skipChildren = !1),
              void 0 === o.onFalse.skipChildren &&
                (o.onFalse.skipChildren = !1),
              void 0 === o.onTrue.cloneDeep && (o.onTrue.cloneDeep = !0),
              void 0 === o.onUndefined.cloneDeep &&
                (o.onUndefined.cloneDeep = !0),
              void 0 === o.onFalse.cloneDeep && (o.onFalse.cloneDeep = !0));
          var a,
            i = {
              pathFormat: (o = e.merge(
                {
                  checkCircular: !1,
                  keepCircular: !0,
                  leavesOnly: void 0 === o.childrenPath,
                  condense: !0,
                  cloneDeep: e.cloneDeep,
                  pathFormat: "string",
                  onTrue: { skipChildren: !0, cloneDeep: !0, keepIfEmpty: !0 },
                  onUndefined: {
                    skipChildren: !1,
                    cloneDeep: !1,
                    keepIfEmpty: !1
                  },
                  onFalse: { skipChildren: !0, cloneDeep: !1, keepIfEmpty: !1 }
                },
                o
              )).pathFormat,
              checkCircular: o.checkCircular,
              childrenPath: o.childrenPath,
              includeRoot: o.includeRoot,
              callbackAfterIterate: !0,
              leavesOnly: !1
            },
            p = e.isArray(r) ? [] : e.isObject(r) ? {} : null,
            f = {},
            m = [];
          return (
            t(
              r,
              function(t, r, i, l) {
                delete l.break;
                var u = n(l.path);
                if (!l.afterIterate) {
                  if (l.isCircular)
                    return (
                      e.unset(p, l.path),
                      o.keepCircular && m.push([l.path, l.circularParent.path]),
                      !1
                    );
                  var c = !o.leavesOnly || l.isLeaf ? s(t, r, i, l) : void 0;
                  return (
                    e.isObject(c) ||
                      (c =
                        void 0 === c
                          ? e.clone(o.onUndefined)
                          : c
                          ? e.clone(o.onTrue)
                          : e.clone(o.onFalse)),
                    void 0 === c.empty && (c.empty = !0),
                    void 0 !== u
                      ? ((f[u] = c),
                        a ||
                          (a = {
                            skipChildren: !1,
                            cloneDeep: !1,
                            keepIfEmpty: !1,
                            empty: c.empty
                          }))
                      : (a = c),
                    (!c.keepIfEmpty && c.skipChildren) ||
                      (o.cloneDeep && c.cloneDeep
                        ? void 0 !== l.path
                          ? e.set(p, l.path, o.cloneDeep(t))
                          : (p = o.cloneDeep(t))
                        : void 0 !== l.path
                        ? e.set(
                            p,
                            l.path,
                            e.isArray(t) ? [] : e.isPlainObject(t) ? {} : t
                          )
                        : (p = e.isArray(t)
                            ? []
                            : e.isPlainObject(t)
                            ? {}
                            : t)),
                    !c.skipChildren
                  );
                }
                !l.afterIterate ||
                  l.isCircular ||
                  (void 0 === u && a.empty && !a.keepIfEmpty
                    ? (p = null)
                    : void 0 !== u && f[u].empty && !f[u].keepIfEmpty
                    ? e.unset(p, l.path)
                    : (e.eachRight(l.parents, function(e) {
                        var t = n(e.path);
                        if (void 0 === t || !f[t].empty) return !1;
                        f[t].empty = !1;
                      }),
                      (a.empty = !1)));
              },
              i
            ),
            a && a.empty && !a.keepIfEmpty && (p = null),
            e.each(m, function(t) {
              var n;
              (void 0 === t[1] || c(p, t[1])) &&
                ((n = e.has(o, "replaceCircularBy")
                  ? o.replaceCircularBy
                  : l(p, t[1])),
                e.set(p, t[0], n));
            }),
            o.condense && (p = u(p, { checkCircular: o.checkCircular })),
            !e.isArray(p) || p.length || i.includeRoot ? p : null
          );
        };
      };
    },
    function(e, t, n) {
      "use strict";
      var r = /^\d+$/,
        s = /^[a-zA-Z_$]+([\w_$]*)$/;
      function o(e) {
        return function(t) {
          return e.isString(t)
            ? t
            : e.isArray(t)
            ? e.reduce(
                t,
                function(e, t) {
                  return r.test(t)
                    ? e + "[" + t + "]"
                    : s.test(t)
                    ? e + (e ? "." : "") + t
                    : e + '["' + t.toString().replace(/"/g, '\\"') + '"]';
                },
                ""
              )
            : void 0;
        };
      }
      (o.notChainable = !0), (e.exports = o);
    },
    function(e, t, n) {
      "use strict";
      var r = n(21);
      e.exports = function(e) {
        var t = r(e);
        return function(n, r, s) {
          if (
            (void 0 === r && (r = e.identity),
            void 0 !==
              (s = e.merge(
                {
                  includeRoot: !e.isArray(n),
                  pathFormat: "string",
                  checkCircular: !1,
                  leavesOnly: !1
                },
                s || {}
              )).childrenPath)
          ) {
            if (
              (s.includeRoot ||
                void 0 !== s.rootIsChildren ||
                (s.rootIsChildren = e.isArray(n)),
              !e.isString(s.childrenPath) && !e.isArray(s.childrenPath))
            )
              throw Error("childrenPath can be string or array");
            e.isString(s.childrenPath) && (s.childrenPath = [s.childrenPath]);
            for (var o = s.childrenPath.length - 1; o >= 0; o--)
              s.childrenPath[o] = e.toPath(s.childrenPath[o]);
          }
          return t(n, r, s, void 0, void 0, 0, void 0, [], n), n;
        };
      };
    },
    function(e, n) {
      e.exports = t;
    },
    function(e, t, n) {
      "use strict";
      var r = function() {
          return (r =
            Object.assign ||
            function(e) {
              for (var t, n = 1, r = arguments.length; n < r; n++)
                for (var s in (t = arguments[n]))
                  Object.prototype.hasOwnProperty.call(t, s) && (e[s] = t[s]);
              return e;
            }).apply(this, arguments);
        },
        s = function(e, t, n, r) {
          return new (n || (n = Promise))(function(s, o) {
            function a(e) {
              try {
                l(r.next(e));
              } catch (e) {
                o(e);
              }
            }
            function i(e) {
              try {
                l(r.throw(e));
              } catch (e) {
                o(e);
              }
            }
            function l(e) {
              var t;
              e.done
                ? s(e.value)
                : ((t = e.value),
                  t instanceof n
                    ? t
                    : new n(function(e) {
                        e(t);
                      })).then(a, i);
            }
            l((r = r.apply(e, t || [])).next());
          });
        },
        o = function(e, t) {
          var n,
            r,
            s,
            o,
            a = {
              label: 0,
              sent: function() {
                if (1 & s[0]) throw s[1];
                return s[1];
              },
              trys: [],
              ops: []
            };
          return (
            (o = { next: i(0), throw: i(1), return: i(2) }),
            "function" == typeof Symbol &&
              (o[Symbol.iterator] = function() {
                return this;
              }),
            o
          );
          function i(o) {
            return function(i) {
              return (function(o) {
                if (n) throw new TypeError("Generator is already executing.");
                for (; a; )
                  try {
                    if (
                      ((n = 1),
                      r &&
                        (s =
                          2 & o[0]
                            ? r.return
                            : o[0]
                            ? r.throw || ((s = r.return) && s.call(r), 0)
                            : r.next) &&
                        !(s = s.call(r, o[1])).done)
                    )
                      return s;
                    switch (((r = 0), s && (o = [2 & o[0], s.value]), o[0])) {
                      case 0:
                      case 1:
                        s = o;
                        break;
                      case 4:
                        return a.label++, { value: o[1], done: !1 };
                      case 5:
                        a.label++, (r = o[1]), (o = [0]);
                        continue;
                      case 7:
                        (o = a.ops.pop()), a.trys.pop();
                        continue;
                      default:
                        if (
                          !((s = a.trys),
                          (s = s.length > 0 && s[s.length - 1]) ||
                            (6 !== o[0] && 2 !== o[0]))
                        ) {
                          a = 0;
                          continue;
                        }
                        if (
                          3 === o[0] &&
                          (!s || (o[1] > s[0] && o[1] < s[3]))
                        ) {
                          a.label = o[1];
                          break;
                        }
                        if (6 === o[0] && a.label < s[1]) {
                          (a.label = s[1]), (s = o);
                          break;
                        }
                        if (s && a.label < s[2]) {
                          (a.label = s[2]), a.ops.push(o);
                          break;
                        }
                        s[2] && a.ops.pop(), a.trys.pop();
                        continue;
                    }
                    o = t.call(e, a);
                  } catch (e) {
                    (o = [6, e]), (r = 0);
                  } finally {
                    n = s = 0;
                  }
                if (5 & o[0]) throw o[1];
                return { value: o[0] ? o[1] : void 0, done: !0 };
              })([o, i]);
            };
          }
        };
      Object.defineProperty(t, "__esModule", { value: !0 }),
        (t.getRange = t.filterEmptyQueryTargets = void 0);
      var a = n(16),
        i = n(2),
        l = n(3),
        u = n(13),
        c = n(8),
        p = n(1),
        f = n(14),
        m = n(32),
        b = n(4),
        d = p.Tab.Asset,
        h = p.Tab.Custom,
        y = p.Tab.Timeseries,
        $ = p.HttpMethod.POST,
        g = (function() {
          function e(e, t, n) {
            (this.templateSrv = n),
              (this.id = e.id),
              (this.url = e.url),
              (this.name = e.name);
            var r = e.url,
              s = e.jsonData;
            (this.project = s.cogniteProject),
              (this.connector = new m.Connector(s.cogniteProject, r, t));
          }
          return (
            (e.$inject = ["instanceSettings", "backendSrv", "templateSrv"]),
            (e.prototype.query = function(e) {
              return s(this, void 0, void 0, function() {
                var t, n, r, s, a, i;
                return o(this, function(o) {
                  switch (o.label) {
                    case 0:
                      if (((t = v(e.targets)), (n = []), !t.length))
                        return [3, 4];
                      o.label = 1;
                    case 1:
                      return (
                        o.trys.push([1, 3, , 4]),
                        [4, this.fetchTimeseriesForTargets(t, e)]
                      );
                    case 2:
                      return (
                        (r = o.sent()),
                        (s = r.failed),
                        (a = r.succeded),
                        (function(e) {
                          e.filter(p.isError)
                            .filter(function(e) {
                              return !e.error.cancelled;
                            })
                            .forEach(function(e) {
                              var t = e.error,
                                n = e.metadata,
                                r =
                                  t.data && t.data.error
                                    ? "[" +
                                      t.status +
                                      " ERROR] " +
                                      t.data.error.message
                                    : "Unknown error";
                              c.appEvents.emit(b.failedResponseEvent, {
                                refId: n.target.refId,
                                error: r
                              });
                            });
                        })(s),
                        a.forEach(function(e) {
                          var t = e.result,
                            n = e.metadata,
                            r = t.data.items,
                            s = t.config.data.limit,
                            o = n.target.refId,
                            a = [
                              f.getLimitsWarnings(r, s),
                              f.getCalculationWarnings(r)
                            ]
                              .filter(Boolean)
                              .join("\n");
                          a &&
                            c.appEvents.emit(b.datapointsWarningEvent, {
                              refId: o,
                              warning: a
                            });
                        }),
                        (n = f.reduceTimeseries(a, x(e.range))),
                        [3, 4]
                      );
                    case 3:
                      return (i = o.sent()), console.error(i), [3, 4];
                    case 4:
                      return [2, { data: n }];
                  }
                });
              });
            }),
            (e.prototype.fetchTimeseriesForTargets = function(e, t) {
              return s(this, void 0, void 0, function() {
                var n,
                  r,
                  a,
                  l,
                  u,
                  p = this;
                return o(this, function(m) {
                  switch (m.label) {
                    case 0:
                      return (
                        (n = e.map(function(e) {
                          return s(p, void 0, void 0, function() {
                            var n;
                            return o(this, function(r) {
                              switch (r.label) {
                                case 0:
                                  return (
                                    r.trys.push([0, 2, , 3]),
                                    [4, this.getDataQueryRequestItems(e, t)]
                                  );
                                case 1:
                                  return [2, { items: r.sent(), target: e }];
                                case 2:
                                  return (
                                    (n = r.sent()),
                                    c.appEvents.emit(b.failedResponseEvent, {
                                      refId: e.refId,
                                      error: n.message
                                    }),
                                    [2, null]
                                  );
                                case 3:
                                  return [2];
                              }
                            });
                          });
                        })),
                        [4, Promise.all(n)]
                      );
                    case 1:
                      return (
                        (r = m.sent()),
                        (a = r.filter(function(e) {
                          return e && e.items && e.items.length;
                        })),
                        (l = f.formQueriesForTargets(a, t)),
                        [4, f.formMetadatasForTargets(a, t, this.connector)]
                      );
                    case 2:
                      return (
                        (u = (u = m.sent()).map(function(e) {
                          var n = e.target;
                          return {
                            labels: e.labels.map(function(e) {
                              return p.replaceVariable(e, t.scopedVars);
                            }),
                            target: n
                          };
                        })),
                        [
                          2,
                          f.promiser(l, u, function(e, n) {
                            var r = n.target;
                            return s(p, void 0, void 0, function() {
                              var n, s;
                              return o(this, function(o) {
                                return (
                                  (n = e.items.some(function(e) {
                                    return !!e.expression;
                                  })),
                                  (s = n ? 10 : 100),
                                  [
                                    2,
                                    this.connector.chunkAndFetch(
                                      {
                                        data: e,
                                        path: f.datapointsPath(n),
                                        method: $,
                                        requestId: i.getRequestId(t, r)
                                      },
                                      s
                                    )
                                  ]
                                );
                              });
                            });
                          })
                        ]
                      );
                  }
                });
              });
            }),
            (e.prototype.getDataQueryRequestItems = function(e, t) {
              return s(this, void 0, void 0, function() {
                var n, r, s, a;
                return o(this, function(o) {
                  switch (o.label) {
                    case 0:
                      switch (
                        ((n = e.tab),
                        (r = e.target),
                        e.assetQuery,
                        (s = e.expr),
                        n)
                      ) {
                        case void 0:
                        case y:
                          return [3, 1];
                        case d:
                          return [3, 2];
                        case p.Tab.Custom:
                          return [3, 4];
                      }
                      return [3, 5];
                    case 1:
                      return [2, [{ id: r }]];
                    case 2:
                      return [4, this.findAssetTimeseries(e, t)];
                    case 3:
                      return [
                        2,
                        o.sent().map(function(e) {
                          return { id: e.id };
                        })
                      ];
                    case 4:
                      return (
                        (a = this.replaceVariable(s, t.scopedVars)),
                        [
                          2,
                          u.formQueriesForExpression(
                            a,
                            e,
                            this.connector,
                            t.interval
                          )
                        ]
                      );
                    case 5:
                      return [2];
                  }
                });
              });
            }),
            (e.prototype.replaceVariable = function(e, t) {
              return this.templateSrv.replace(e.trim(), t);
            }),
            (e.prototype.annotationQuery = function(e) {
              return s(this, void 0, void 0, function() {
                var t, n, s, a, u, c, p, f, m, b, d, h, y, g, v;
                return o(this, function(o) {
                  switch (o.label) {
                    case 0:
                      return (
                        (t = e.range),
                        (n = e.annotation),
                        (s = e.annotation),
                        (a = s.query),
                        (u = s.error),
                        (c = x(t)),
                        (p = c[0]),
                        (f = c[1]),
                        u || !a
                          ? [2, []]
                          : ((m = this.replaceVariable(a)),
                            (b = l.parse(m)),
                            (d = b.filters),
                            (h = b.params),
                            (y = {
                              startTime: { max: f },
                              endTime: { min: p }
                            }),
                            (g = { filter: r(r({}, h), y), limit: 1e3 }),
                            [
                              4,
                              this.connector.fetchItems({
                                data: g,
                                path: "/events/list",
                                method: $
                              })
                            ])
                      );
                    case 1:
                      return (
                        (v = o.sent()),
                        [
                          2,
                          i.applyFilters(v, d).map(function(e) {
                            var t = e.description,
                              r = e.startTime,
                              s = e.endTime,
                              o = e.type;
                            return {
                              annotation: n,
                              isRegion: !0,
                              text: t,
                              time: r,
                              timeEnd: s,
                              title: o
                            };
                          })
                        ]
                      );
                  }
                });
              });
            }),
            (e.prototype.getOptionsForDropdown = function(e, t, n) {
              return s(this, void 0, void 0, function() {
                var r, s, a;
                return o(this, function(o) {
                  switch (o.label) {
                    case 0:
                      return (
                        ((a = {})[p.Tab.Asset] = "assets"),
                        (a[p.Tab.Timeseries] = "timeseries"),
                        (r = a),
                        (s = e ? { search: { query: e } } : {}),
                        [
                          4,
                          this.connector.fetchItems({
                            data: s,
                            path: "/" + r[t] + "/search",
                            method: $,
                            params: n
                          })
                        ]
                      );
                    case 1:
                      return [
                        2,
                        o.sent().map(function(e) {
                          var t = e.name,
                            n = e.externalId,
                            r = e.id,
                            s = e.description,
                            o = t || n;
                          return {
                            text: s ? o + " (" + s + ")" : o,
                            value: r.toString()
                          };
                        })
                      ];
                  }
                });
              });
            }),
            (e.prototype.findAssetTimeseries = function(e, t) {
              return s(this, void 0, void 0, function() {
                var n, r, s, a;
                return o(this, function(o) {
                  switch (o.label) {
                    case 0:
                      return (
                        (n = this.replaceVariable(
                          e.assetQuery.target,
                          t.scopedVars
                        )),
                        (r = e.assetQuery.includeSubtrees
                          ? { assetSubtreeIds: [{ id: Number(n) }] }
                          : { assetIds: [n] }),
                        (s = 101),
                        [
                          4,
                          f.getTimeseries(
                            { filter: r, limit: s },
                            e,
                            this.connector
                          )
                        ]
                      );
                    case 1:
                      return (
                        (a = o.sent()).length === s &&
                          (c.appEvents.emit(b.datapointsWarningEvent, {
                            warning: b.TIMESERIES_LIMIT_WARNING,
                            refId: e.refId
                          }),
                          a.splice(-1)),
                        [2, a]
                      );
                  }
                });
              });
            }),
            (e.prototype.metricFindQuery = function(e) {
              var t = e.query;
              return s(this, void 0, void 0, function() {
                var e, n, r, s, a;
                return o(this, function(o) {
                  switch (o.label) {
                    case 0:
                      try {
                        (a = l.parse(t)), (e = a.params), (n = a.filters);
                      } catch (e) {
                        return [2, []];
                      }
                      return (
                        (r = { filter: e, limit: 1e3 }),
                        [
                          4,
                          this.connector.fetchItems({
                            data: r,
                            path: "/assets/list",
                            method: $
                          })
                        ]
                      );
                    case 1:
                      return (
                        (s = o.sent()),
                        [
                          2,
                          i.applyFilters(s, n).map(function(e) {
                            return { text: e.name, value: e.id };
                          })
                        ]
                      );
                  }
                });
              });
            }),
            (e.prototype.testDatasource = function() {
              return s(this, void 0, void 0, function() {
                var e, t, n;
                return o(this, function(r) {
                  switch (r.label) {
                    case 0:
                      return [
                        4,
                        this.connector.request({ path: "cogniteloginstatus" })
                      ];
                    case 1:
                      return (
                        (e = r.sent()),
                        (t = e.status),
                        (n = e.data),
                        200 === t
                          ? n.data.loggedIn && n.data.project === this.project
                            ? [
                                2,
                                {
                                  status: "success",
                                  message: "Your Cognite credentials are valid",
                                  title: "Success"
                                }
                              ]
                            : [
                                2,
                                {
                                  status: "error",
                                  message:
                                    "Your Cognite credentials are invalid",
                                  title: "Error"
                                }
                              ]
                          : [2]
                      );
                  }
                });
              });
            }),
            e
          );
        })();
      function v(e) {
        return e.filter(function(e) {
          if (e && !e.hide) {
            var t = e.tab,
              n = e.assetQuery;
            switch (t) {
              case d:
                return n && n.target;
              case h:
                return e.expr;
              case y:
              case void 0:
                return e.target;
            }
          }
        });
      }
      function x(e) {
        return [Math.ceil(a.parse(e.from)), Math.ceil(a.parse(e.to))];
      }
      (t.default = g), (t.filterEmptyQueryTargets = v), (t.getRange = x);
    },
    function(e, t) {
      var n = 1e3,
        r = 6e4,
        s = 60 * r,
        o = 24 * s;
      function a(e, t, n, r) {
        var s = t >= 1.5 * n;
        return Math.round(e / n) + " " + r + (s ? "s" : "");
      }
      e.exports = function(e, t) {
        t = t || {};
        var i = typeof e;
        if ("string" === i && e.length > 0)
          return (function(e) {
            if ((e = String(e)).length > 100) return;
            var t = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
              e
            );
            if (!t) return;
            var a = parseFloat(t[1]);
            switch ((t[2] || "ms").toLowerCase()) {
              case "years":
              case "year":
              case "yrs":
              case "yr":
              case "y":
                return 315576e5 * a;
              case "weeks":
              case "week":
              case "w":
                return 6048e5 * a;
              case "days":
              case "day":
              case "d":
                return a * o;
              case "hours":
              case "hour":
              case "hrs":
              case "hr":
              case "h":
                return a * s;
              case "minutes":
              case "minute":
              case "mins":
              case "min":
              case "m":
                return a * r;
              case "seconds":
              case "second":
              case "secs":
              case "sec":
              case "s":
                return a * n;
              case "milliseconds":
              case "millisecond":
              case "msecs":
              case "msec":
              case "ms":
                return a;
              default:
                return;
            }
          })(e);
        if ("number" === i && isFinite(e))
          return t.long
            ? (function(e) {
                var t = Math.abs(e);
                if (t >= o) return a(e, t, o, "day");
                if (t >= s) return a(e, t, s, "hour");
                if (t >= r) return a(e, t, r, "minute");
                if (t >= n) return a(e, t, n, "second");
                return e + " ms";
              })(e)
            : (function(e) {
                var t = Math.abs(e);
                if (t >= o) return Math.round(e / o) + "d";
                if (t >= s) return Math.round(e / s) + "h";
                if (t >= r) return Math.round(e / r) + "m";
                if (t >= n) return Math.round(e / n) + "s";
                return e + "ms";
              })(e);
        throw new Error(
          "val is not a non-empty string or a valid number. val=" +
            JSON.stringify(e)
        );
      };
    },
    function(e, t, n) {
      "use strict";
      Object.defineProperty(t, "__esModule", { value: !0 }),
        (t.QueryParserTypes = t.FilterType = void 0),
        (t.FilterType = {
          RegexNotEquals: "!~",
          RegexEquals: "=~",
          NotEquals: "!=",
          Equals: "="
        }),
        (function(e) {
          (e.assets = "assets"), (e.events = "events");
        })(t.QueryParserTypes || (t.QueryParserTypes = {}));
    },
    function(e, t, n) {
      var r, s;
      (r = this),
        (s = function() {
          function e(t, n, r) {
            return (
              (this.id = ++e.highestId),
              (this.name = t),
              (this.symbols = n),
              (this.postprocess = r),
              this
            );
          }
          function t(e, t, n, r) {
            (this.rule = e),
              (this.dot = t),
              (this.reference = n),
              (this.data = []),
              (this.wantedBy = r),
              (this.isComplete = this.dot === e.symbols.length);
          }
          function n(e, t) {
            (this.grammar = e),
              (this.index = t),
              (this.states = []),
              (this.wants = {}),
              (this.scannable = []),
              (this.completed = {});
          }
          function r(e, t) {
            (this.rules = e), (this.start = t || this.rules[0].name);
            var n = (this.byName = {});
            this.rules.forEach(function(e) {
              n.hasOwnProperty(e.name) || (n[e.name] = []), n[e.name].push(e);
            });
          }
          function s() {
            this.reset("");
          }
          function o(e, t, o) {
            if (e instanceof r) {
              var a = e;
              o = t;
            } else a = r.fromCompiled(e, t);
            for (var i in ((this.grammar = a),
            (this.options = { keepHistory: !1, lexer: a.lexer || new s() }),
            o || {}))
              this.options[i] = o[i];
            (this.lexer = this.options.lexer), (this.lexerState = void 0);
            var l = new n(a, 0);
            (this.table = [l]),
              (l.wants[a.start] = []),
              l.predict(a.start),
              l.process(),
              (this.current = 0);
          }
          return (
            (e.highestId = 0),
            (e.prototype.toString = function(e) {
              function t(e) {
                return e.literal
                  ? JSON.stringify(e.literal)
                  : e.type
                  ? "%" + e.type
                  : e.toString();
              }
              var n =
                void 0 === e
                  ? this.symbols.map(t).join(" ")
                  : this.symbols
                      .slice(0, e)
                      .map(t)
                      .join(" ") +
                    " ● " +
                    this.symbols
                      .slice(e)
                      .map(t)
                      .join(" ");
              return this.name + " → " + n;
            }),
            (t.prototype.toString = function() {
              return (
                "{" +
                this.rule.toString(this.dot) +
                "}, from: " +
                (this.reference || 0)
              );
            }),
            (t.prototype.nextState = function(e) {
              var n = new t(
                this.rule,
                this.dot + 1,
                this.reference,
                this.wantedBy
              );
              return (
                (n.left = this),
                (n.right = e),
                n.isComplete && (n.data = n.build()),
                n
              );
            }),
            (t.prototype.build = function() {
              var e = [],
                t = this;
              do {
                e.push(t.right.data), (t = t.left);
              } while (t.left);
              return e.reverse(), e;
            }),
            (t.prototype.finish = function() {
              this.rule.postprocess &&
                (this.data = this.rule.postprocess(
                  this.data,
                  this.reference,
                  o.fail
                ));
            }),
            (n.prototype.process = function(e) {
              for (
                var t = this.states, n = this.wants, r = this.completed, s = 0;
                s < t.length;
                s++
              ) {
                var a = t[s];
                if (a.isComplete) {
                  if ((a.finish(), a.data !== o.fail)) {
                    for (var i = a.wantedBy, l = i.length; l--; ) {
                      var u = i[l];
                      this.complete(u, a);
                    }
                    if (a.reference === this.index) {
                      var c = a.rule.name;
                      (this.completed[c] = this.completed[c] || []).push(a);
                    }
                  }
                } else {
                  if ("string" != typeof (c = a.rule.symbols[a.dot])) {
                    this.scannable.push(a);
                    continue;
                  }
                  if (n[c]) {
                    if ((n[c].push(a), r.hasOwnProperty(c))) {
                      var p = r[c];
                      for (l = 0; l < p.length; l++) {
                        var f = p[l];
                        this.complete(a, f);
                      }
                    }
                  } else (n[c] = [a]), this.predict(c);
                }
              }
            }),
            (n.prototype.predict = function(e) {
              for (
                var n = this.grammar.byName[e] || [], r = 0;
                r < n.length;
                r++
              ) {
                var s = n[r],
                  o = this.wants[e],
                  a = new t(s, 0, this.index, o);
                this.states.push(a);
              }
            }),
            (n.prototype.complete = function(e, t) {
              var n = e.nextState(t);
              this.states.push(n);
            }),
            (r.fromCompiled = function(t, n) {
              var s = t.Lexer;
              t.ParserStart && ((n = t.ParserStart), (t = t.ParserRules));
              var o = new r(
                (t = t.map(function(t) {
                  return new e(t.name, t.symbols, t.postprocess);
                })),
                n
              );
              return (o.lexer = s), o;
            }),
            (s.prototype.reset = function(e, t) {
              (this.buffer = e),
                (this.index = 0),
                (this.line = t ? t.line : 1),
                (this.lastLineBreak = t ? -t.col : 0);
            }),
            (s.prototype.next = function() {
              if (this.index < this.buffer.length) {
                var e = this.buffer[this.index++];
                return (
                  "\n" === e &&
                    ((this.line += 1), (this.lastLineBreak = this.index)),
                  { value: e }
                );
              }
            }),
            (s.prototype.save = function() {
              return { line: this.line, col: this.index - this.lastLineBreak };
            }),
            (s.prototype.formatError = function(e, t) {
              var n = this.buffer;
              if ("string" == typeof n) {
                var r = n.indexOf("\n", this.index);
                -1 === r && (r = n.length);
                var s = n.substring(this.lastLineBreak, r),
                  o = this.index - this.lastLineBreak;
                return (
                  (t += " at line " + this.line + " col " + o + ":\n\n"),
                  (t += "  " + s + "\n"),
                  (t += "  " + Array(o).join(" ") + "^")
                );
              }
              return t + " at index " + (this.index - 1);
            }),
            (o.fail = {}),
            (o.prototype.feed = function(e) {
              var t,
                r = this.lexer;
              for (r.reset(e, this.lexerState); (t = r.next()); ) {
                var o = this.table[this.current];
                this.options.keepHistory || delete this.table[this.current - 1];
                var a = this.current + 1,
                  i = new n(this.grammar, a);
                this.table.push(i);
                for (
                  var l = void 0 !== t.text ? t.text : t.value,
                    u = r.constructor === s ? t.value : t,
                    c = o.scannable,
                    p = c.length;
                  p--;

                ) {
                  var f = c[p],
                    m = f.rule.symbols[f.dot];
                  if (
                    m.test
                      ? m.test(u)
                      : m.type
                      ? m.type === t.type
                      : m.literal === l
                  ) {
                    var b = f.nextState({
                      data: u,
                      token: t,
                      isToken: !0,
                      reference: a - 1
                    });
                    i.states.push(b);
                  }
                }
                if ((i.process(), 0 === i.states.length)) {
                  var d = new Error(this.reportError(t));
                  throw ((d.offset = this.current), (d.token = t), d);
                }
                this.options.keepHistory && (o.lexerState = r.save()),
                  this.current++;
              }
              return (
                o && (this.lexerState = r.save()),
                (this.results = this.finish()),
                this
              );
            }),
            (o.prototype.reportError = function(e) {
              var t = [],
                n =
                  (e.type ? e.type + " token: " : "") +
                  JSON.stringify(void 0 !== e.value ? e.value : e);
              t.push(this.lexer.formatError(e, "Syntax error")),
                t.push(
                  "Unexpected " +
                    n +
                    ". Instead, I was expecting to see one of the following:\n"
                );
              var r = this.table.length - 2;
              return (
                this.table[r].states
                  .filter(function(e) {
                    var t = e.rule.symbols[e.dot];
                    return t && "string" != typeof t;
                  })
                  .map(function(e) {
                    return this.buildFirstStateStack(e, []);
                  }, this)
                  .forEach(function(e) {
                    var n = e[0],
                      r = n.rule.symbols[n.dot],
                      s = this.getSymbolDisplay(r);
                    t.push("A " + s + " based on:"),
                      this.displayStateStack(e, t);
                  }, this),
                t.push(""),
                t.join("\n")
              );
            }),
            (o.prototype.displayStateStack = function(e, t) {
              for (var n, r = 0, s = 0; s < e.length; s++) {
                var o = e[s],
                  a = o.rule.toString(o.dot);
                a === n
                  ? r++
                  : (r > 0 &&
                      t.push("    ⬆ ︎" + r + " more lines identical to this"),
                    (r = 0),
                    t.push("    " + a)),
                  (n = a);
              }
            }),
            (o.prototype.getSymbolDisplay = function(e) {
              var t = typeof e;
              if ("string" === t) return e;
              if ("object" === t && e.literal) return JSON.stringify(e.literal);
              if ("object" === t && e instanceof RegExp)
                return "character matching " + e;
              if ("object" === t && e.type) return e.type + " token";
              throw new Error("Unknown symbol type: " + e);
            }),
            (o.prototype.buildFirstStateStack = function(e, t) {
              if (-1 !== t.indexOf(e)) return null;
              if (0 === e.wantedBy.length) return [e];
              var n = e.wantedBy[0],
                r = [e].concat(t),
                s = this.buildFirstStateStack(n, r);
              return null === s ? null : [e].concat(s);
            }),
            (o.prototype.save = function() {
              var e = this.table[this.current];
              return (e.lexerState = this.lexerState), e;
            }),
            (o.prototype.restore = function(e) {
              var t = e.index;
              (this.current = t),
                (this.table[t] = e),
                this.table.splice(t + 1),
                (this.lexerState = e.lexerState),
                (this.results = this.finish());
            }),
            (o.prototype.rewind = function(e) {
              if (!this.options.keepHistory)
                throw new Error("set option `keepHistory` to enable rewinding");
              this.restore(this.table[e]);
            }),
            (o.prototype.finish = function() {
              var e = [],
                t = this.grammar.start;
              return (
                this.table[this.table.length - 1].states.forEach(function(n) {
                  n.rule.name === t &&
                    n.dot === n.rule.symbols.length &&
                    0 === n.reference &&
                    n.data !== o.fail &&
                    e.push(n);
                }),
                e.map(function(e) {
                  return e.data;
                })
              );
            }),
            { Parser: o, Grammar: r, Rule: e }
          );
        }),
        e.exports ? (e.exports = s()) : (r.nearley = s());
    },
    function(e, t, n) {
      "use strict";
      var r = function() {
          return (r =
            Object.assign ||
            function(e) {
              for (var t, n = 1, r = arguments.length; n < r; n++)
                for (var s in (t = arguments[n]))
                  Object.prototype.hasOwnProperty.call(t, s) && (e[s] = t[s]);
              return e;
            }).apply(this, arguments);
        },
        s = Object.create
          ? function(e, t, n, r) {
              void 0 === r && (r = n),
                Object.defineProperty(e, r, {
                  enumerable: !0,
                  get: function() {
                    return t[n];
                  }
                });
            }
          : function(e, t, n, r) {
              void 0 === r && (r = n), (e[r] = t[n]);
            },
        o = Object.create
          ? function(e, t) {
              Object.defineProperty(e, "default", { enumerable: !0, value: t });
            }
          : function(e, t) {
              e.default = t;
            },
        a = function(e) {
          if (e && e.__esModule) return e;
          var t = {};
          if (null != e)
            for (var n in e)
              "default" !== n && Object.hasOwnProperty.call(e, n) && s(t, e, n);
          return o(t, e), t;
        },
        i = function(e, t, n, r) {
          return new (n || (n = Promise))(function(s, o) {
            function a(e) {
              try {
                l(r.next(e));
              } catch (e) {
                o(e);
              }
            }
            function i(e) {
              try {
                l(r.throw(e));
              } catch (e) {
                o(e);
              }
            }
            function l(e) {
              var t;
              e.done
                ? s(e.value)
                : ((t = e.value),
                  t instanceof n
                    ? t
                    : new n(function(e) {
                        e(t);
                      })).then(a, i);
            }
            l((r = r.apply(e, t || [])).next());
          });
        },
        l = function(e, t) {
          var n,
            r,
            s,
            o,
            a = {
              label: 0,
              sent: function() {
                if (1 & s[0]) throw s[1];
                return s[1];
              },
              trys: [],
              ops: []
            };
          return (
            (o = { next: i(0), throw: i(1), return: i(2) }),
            "function" == typeof Symbol &&
              (o[Symbol.iterator] = function() {
                return this;
              }),
            o
          );
          function i(o) {
            return function(i) {
              return (function(o) {
                if (n) throw new TypeError("Generator is already executing.");
                for (; a; )
                  try {
                    if (
                      ((n = 1),
                      r &&
                        (s =
                          2 & o[0]
                            ? r.return
                            : o[0]
                            ? r.throw || ((s = r.return) && s.call(r), 0)
                            : r.next) &&
                        !(s = s.call(r, o[1])).done)
                    )
                      return s;
                    switch (((r = 0), s && (o = [2 & o[0], s.value]), o[0])) {
                      case 0:
                      case 1:
                        s = o;
                        break;
                      case 4:
                        return a.label++, { value: o[1], done: !1 };
                      case 5:
                        a.label++, (r = o[1]), (o = [0]);
                        continue;
                      case 7:
                        (o = a.ops.pop()), a.trys.pop();
                        continue;
                      default:
                        if (
                          !((s = a.trys),
                          (s = s.length > 0 && s[s.length - 1]) ||
                            (6 !== o[0] && 2 !== o[0]))
                        ) {
                          a = 0;
                          continue;
                        }
                        if (
                          3 === o[0] &&
                          (!s || (o[1] > s[0] && o[1] < s[3]))
                        ) {
                          a.label = o[1];
                          break;
                        }
                        if (6 === o[0] && a.label < s[1]) {
                          (a.label = s[1]), (s = o);
                          break;
                        }
                        if (s && a.label < s[2]) {
                          (a.label = s[2]), a.ops.push(o);
                          break;
                        }
                        s[2] && a.ops.pop(), a.trys.pop();
                        continue;
                    }
                    o = t.call(e, a);
                  } catch (e) {
                    (o = [6, e]), (r = 0);
                  } finally {
                    n = s = 0;
                  }
                if (5 & o[0]) throw o[1];
                return { value: o[0] ? o[1] : void 0, done: !0 };
              })([o, i]);
            };
          }
        },
        u = function() {
          for (var e = 0, t = 0, n = arguments.length; t < n; t++)
            e += arguments[t].length;
          var r = Array(e),
            s = 0;
          for (t = 0; t < n; t++)
            for (var o = arguments[t], a = 0, i = o.length; a < i; a++, s++)
              r[s] = o[a];
          return r;
        },
        c = function(e) {
          return e && e.__esModule ? e : { default: e };
        };
      Object.defineProperty(t, "__esModule", { value: !0 }),
        (t.Constant = t.Operator = t.STSFilter = t.STSReference = t.composeSTSQuery = t.getClientFilters = t.flattenClientQueryFilters = t.getServerFilters = t.extractFilters = t.getIndicesOfMultiaryFunctionArgs = t.walk = t.flattenServerQueryFilters = t.hasAggregates = t.getReferencedTimeseries = t.getLabelsForExpression = t.convertExpressionToLabel = t.generateAllPossiblePermutations = t.parse = t.injectTSIdsInExpression = t.enrichWithDefaultAggregates = t.formQueriesForExpression = void 0);
      var p = a(n(0)),
        f = n(12),
        m = c(n(31)),
        b = n(14),
        d = n(11),
        h = n(2),
        y = n(3),
        $ = c(n(5)).default(p.default),
        g = f.Grammar.fromCompiled(m.default);
      t.formQueriesForExpression = function(e, n, r, s) {
        return i(void 0, void 0, void 0, function() {
          var o, a, u, c, p, f, m, d, y, $;
          return l(this, function(g) {
            switch (g.label) {
              case 0:
                return (
                  (o = t.parse(e)),
                  (a = n.aggregation),
                  (u = n.granularity),
                  (c = t.enrichWithDefaultAggregates(
                    o,
                    { granularity: u, aggregate: a },
                    s
                  )),
                  (p = t.getServerFilters(c)).length
                    ? [
                        4,
                        Promise.all(
                          p.map(function(t) {
                            return i(void 0, void 0, void 0, function() {
                              var s;
                              return l(this, function(o) {
                                switch (o.label) {
                                  case 0:
                                    return [
                                      4,
                                      b.getTimeseries({ filter: t }, n, r, !1)
                                    ];
                                  case 1:
                                    if (!(s = o.sent()).length) throw v(t, e);
                                    return [2, s];
                                }
                              });
                            });
                          })
                        )
                      ]
                    : [2, [{ expression: t.composeSTSQuery(c) }]]
                );
              case 1:
                return (
                  (f = g.sent()),
                  (m = t.getClientFilters(c)),
                  (d = f.map(function(e, t) {
                    return h.applyFilters(e, m[t]);
                  })),
                  (y = t.getIndicesOfMultiaryFunctionArgs(c)),
                  ($ = t.generateAllPossiblePermutations(d, y)),
                  [
                    2,
                    $.map(function(e) {
                      return t.injectTSIdsInExpression(c, e);
                    }).map(function(e) {
                      return { expression: e };
                    })
                  ]
                );
            }
          });
        });
      };
      var v = function(e, t) {
        return new Error(
          "No timeseries found for filter " +
            JSON.stringify(e) +
            " in expression " +
            t
        );
      };
      (t.enrichWithDefaultAggregates = function(e, n, r) {
        var s = n.aggregate,
          o = n.granularity;
        if ("none" === s) return e;
        var a = p.cloneDeep(e),
          i = { aggregate: s, granularity: o || r };
        return (
          t.walk(a, function(e) {
            B(e) &&
              Object.keys(i).forEach(function(n) {
                -1 === p.findIndex(e.query, ["path", n]) &&
                  e.query.push(t.STSFilter(n, i[n]));
              });
          }),
          a
        );
      }),
        (t.injectTSIdsInExpression = function(e, n) {
          var r = 0,
            s = t.composeSTSQuery(e, function(e) {
              if (B(e) && !S(e)) {
                var s = e.query.filter(O);
                return n[r++]
                  .map(function(e) {
                    return e.id;
                  })
                  .map(function(e) {
                    return t.STSReference(u([t.STSFilter("id", e)], s));
                  })
                  .map(function(e) {
                    return t.composeSTSQuery(e);
                  })
                  .join(", ");
              }
            });
          return E(s);
        }),
        (t.parse = function(e) {
          return y.parseWith(new f.Parser(g), e);
        }),
        (t.generateAllPossiblePermutations = function(e, t) {
          void 0 === t && (t = []);
          for (var n = [], r = 0; r < e.length; r++) {
            var s = t.includes(r),
              o = u(e[r]);
            if (n.length) {
              for (var a = [], i = 0, l = u(n); i < l.length; i++) {
                var c = l[i];
                if (s) a.push(u(c, [o]));
                else
                  for (var p = 0, f = o; p < f.length; p++) {
                    var m = f[p];
                    a.push(u(c, [[m]]));
                  }
              }
              n = u(a);
            } else
              n = s
                ? [[o]]
                : o.map(function(e) {
                    return [[e]];
                  });
          }
          return n;
        }),
        (t.convertExpressionToLabel = function(e, n, r) {
          return t.composeSTSQuery(t.parse(e), function(e) {
            if (B(e)) {
              var t = C(e)[0].value,
                s = r[String(t)];
              return n
                ? b.getLabelWithInjectedProps(n, s)
                : "" + (s.name || s.externalId || s.id);
            }
          });
        }),
        (t.getLabelsForExpression = function(e, n, r, s) {
          return i(void 0, void 0, void 0, function() {
            var o, a, i, u;
            return l(this, function(l) {
              switch (l.label) {
                case 0:
                  return (
                    (o = _(e)),
                    (a = p.uniqBy(o, w)),
                    [4, b.getTimeseries({ items: a }, r, s, !1)]
                  );
                case 1:
                  return (
                    (i = l.sent()),
                    (u = A(i)),
                    [
                      2,
                      e.map(function(e) {
                        return t.convertExpressionToLabel(e, n, u);
                      })
                    ]
                  );
              }
            });
          });
        }),
        (t.getReferencedTimeseries = function(e) {
          var n = [];
          return (
            t.walk(e, function(e) {
              if (B(e)) {
                var t = C(e);
                n = u(n, t);
              }
            }),
            n.map(function(e) {
              var t,
                n = e.path,
                r = e.value;
              return ((t = {})[n] = r), t;
            })
          );
        }),
        (t.hasAggregates = function(e) {
          var n = !1;
          return (
            t.walk(t.parse(e), function(e) {
              B(e) && e.query.some(O) && (n = !0);
            }),
            n
          );
        }),
        (t.flattenServerQueryFilters = function(e) {
          return e.filter(R).reduce(function(e, n) {
            var s;
            return (
              (s = F(n.value)
                ? n.value.map(function(e) {
                    return t.flattenServerQueryFilters([e]);
                  })
                : N(n.value)
                ? r(r({}, e[n.path]), t.flattenServerQueryFilters(n.value))
                : M(n.value)
                ? n.value.map(t.flattenServerQueryFilters)
                : n.value),
              (e[n.path] = s),
              e
            );
          }, {});
        }),
        (t.walk = function(e, n) {
          p.isArray(e)
            ? e.forEach(function(e) {
                return t.walk(e, n);
              })
            : (n(e), D(e) && t.walk(W(e) ? e.args[0] : e.args, n));
        }),
        (t.getIndicesOfMultiaryFunctionArgs = function(e) {
          var n = [],
            r = [],
            s = 0;
          return (
            t.walk(e, function(e) {
              G(e) && 1 === e.args.length
                ? r.push.apply(r, e.args)
                : B(e) && !S(e) && (r.includes(e) && n.push(s), s++);
            }),
            n
          );
        }),
        (t.extractFilters = function(e, n) {
          var r = [];
          return (
            t.walk(e, function(e) {
              B(e) && !S(e) && r.push($(e.query, n));
            }),
            r
          );
        }),
        (t.getServerFilters = function(e) {
          return t
            .extractFilters(e, function(e, t, n) {
              return I(n) || !R(n);
            })
            .map(function(e) {
              return t.flattenServerQueryFilters(e || []);
            });
        }),
        (t.flattenClientQueryFilters = function(e, n) {
          void 0 === n && (n = []);
          var r = [];
          return (
            e.filter(R).forEach(function(e) {
              I(e) && N(e.value)
                ? r.push.apply(
                    r,
                    t.flattenClientQueryFilters(e.value, u(n, [e.path]))
                  )
                : r.push({
                    path: u(n, [e.path]).join("."),
                    value: e.value,
                    filter: e.filter
                  });
            }),
            r
          );
        }),
        (t.getClientFilters = function(e) {
          return t
            .extractFilters(e, function(e, t, n) {
              return P(n) || p.isArray(n.value);
            })
            .map(function(e) {
              return t.flattenClientQueryFilters(e || []);
            });
        });
      var x = function(e) {
          var t = e.path,
            n = e.filter,
            r = e.value;
          return "" + t + n + j(r);
        },
        j = function e(t, n) {
          if ((void 0 === n && (n = !0), p.isArray(t))) {
            var r = t
              .map(function(t) {
                return R(t) ? x(t) : e(t);
              })
              .join(", ");
            return n ? (N(t) ? "{" + r + "}" : "[" + r + "]") : r;
          }
          return JSON.stringify(t);
        };
      t.composeSTSQuery = function(e, n, r) {
        if ((void 0 === r && (r = ""), n)) {
          var s = n(e);
          if (void 0 !== s) return s;
        }
        if (p.isArray(e))
          return e
            .map(function(e) {
              return t.composeSTSQuery(e, n);
            })
            .join(r);
        if (B(e)) return e.type + "{" + j(e.query, !1) + "}";
        if (L(e)) return " " + e.operator + " ";
        if (Q(e)) return "" + e.constant;
        var o = G(e) ? ", " : "",
          a = "";
        if (W(e)) {
          var i = e.args,
            l = i[0],
            u = i.slice(1);
          a =
            t.composeSTSQuery(l, n) +
            ", " +
            u
              .map(function(e) {
                return j(e);
              })
              .join(", ");
        } else a = t.composeSTSQuery(e.args, n, o);
        return e.func + "(" + a + ")";
      };
      var E = function(e) {
          return t.composeSTSQuery(t.parse(e), function(e) {
            if (V(e)) return "(" + t.composeSTSQuery(e.args, null, " + ") + ")";
          });
        },
        w = function(e) {
          return "id" in e ? e.id : e.externalId;
        },
        _ = function(e) {
          for (var n = [], r = 0, s = e; r < s.length; r++) {
            var o = s[r],
              a = t.parse(o),
              i = t.getReferencedTimeseries(a);
            n.push.apply(n, i);
          }
          return n;
        },
        A = function(e) {
          return e.reduce(function(e, t) {
            return (e[t.id] = t), t.externalId && (e[t.externalId] = t), e;
          }, {});
        };
      (t.STSReference = function(e) {
        return void 0 === e && (e = []), { query: e, type: "ts" };
      }),
        (t.STSFilter = function(e, t, n) {
          return void 0 === n && (n = "="), { path: e, value: t, filter: n };
        }),
        (t.Operator = function(e) {
          return { operator: e };
        }),
        (t.Constant = function(e) {
          return { constant: e };
        });
      var C = function(e) {
          return e.query.filter(q);
        },
        S = function(e) {
          return C(e).length;
        },
        k = function(e) {
          return R(e) && e.filter === d.FilterType.Equals;
        },
        T = function(e) {
          for (var t = [], n = 1; n < arguments.length; n++)
            t[n - 1] = arguments[n];
          return -1 !== t.indexOf(e);
        },
        O = function(e) {
          return k(e) && T(e.path, "granularity", "aggregate");
        },
        q = function(e) {
          return k(e) && T(e.path, "id", "externalId");
        },
        I = function(e) {
          return k(e) && !O(e);
        },
        P = function(e) {
          return R(e) && !k(e);
        },
        F = function(e) {
          return p.isArray(e) && e.some(q);
        },
        R = function(e) {
          return p.isObjectLike(e) && e.path && e.filter && "value" in e;
        },
        N = function(e) {
          return p.isArray(e) && e.length && e.every(R);
        },
        M = function(e) {
          return p.isArray(e) && e.every(N);
        },
        Q = function(e) {
          return p.isObjectLike(e) && "constant" in e;
        },
        B = function(e) {
          return p.isObjectLike(e) && "ts" === e.type;
        },
        L = function(e) {
          return p.isObjectLike(e) && "operator" in e;
        },
        D = function(e) {
          return p.isObjectLike(e) && "args" in e && "func" in e;
        },
        U = function(e, t) {
          return D(e) && t === e.func;
        },
        W = function(e) {
          return U(e, "map");
        },
        V = function(e) {
          return U(e, "sum");
        },
        G = function(e) {
          return (
            D(e) &&
            T(e.func, "avg", "sum", "min", "max", "pow", "round", "on_error")
          );
        };
    },
    function(e, t, n) {
      "use strict";
      var r = function() {
          return (r =
            Object.assign ||
            function(e) {
              for (var t, n = 1, r = arguments.length; n < r; n++)
                for (var s in (t = arguments[n]))
                  Object.prototype.hasOwnProperty.call(t, s) && (e[s] = t[s]);
              return e;
            }).apply(this, arguments);
        },
        s = function(e, t, n, r) {
          return new (n || (n = Promise))(function(s, o) {
            function a(e) {
              try {
                l(r.next(e));
              } catch (e) {
                o(e);
              }
            }
            function i(e) {
              try {
                l(r.throw(e));
              } catch (e) {
                o(e);
              }
            }
            function l(e) {
              var t;
              e.done
                ? s(e.value)
                : ((t = e.value),
                  t instanceof n
                    ? t
                    : new n(function(e) {
                        e(t);
                      })).then(a, i);
            }
            l((r = r.apply(e, t || [])).next());
          });
        },
        o = function(e, t) {
          var n,
            r,
            s,
            o,
            a = {
              label: 0,
              sent: function() {
                if (1 & s[0]) throw s[1];
                return s[1];
              },
              trys: [],
              ops: []
            };
          return (
            (o = { next: i(0), throw: i(1), return: i(2) }),
            "function" == typeof Symbol &&
              (o[Symbol.iterator] = function() {
                return this;
              }),
            o
          );
          function i(o) {
            return function(i) {
              return (function(o) {
                if (n) throw new TypeError("Generator is already executing.");
                for (; a; )
                  try {
                    if (
                      ((n = 1),
                      r &&
                        (s =
                          2 & o[0]
                            ? r.return
                            : o[0]
                            ? r.throw || ((s = r.return) && s.call(r), 0)
                            : r.next) &&
                        !(s = s.call(r, o[1])).done)
                    )
                      return s;
                    switch (((r = 0), s && (o = [2 & o[0], s.value]), o[0])) {
                      case 0:
                      case 1:
                        s = o;
                        break;
                      case 4:
                        return a.label++, { value: o[1], done: !1 };
                      case 5:
                        a.label++, (r = o[1]), (o = [0]);
                        continue;
                      case 7:
                        (o = a.ops.pop()), a.trys.pop();
                        continue;
                      default:
                        if (
                          !((s = a.trys),
                          (s = s.length > 0 && s[s.length - 1]) ||
                            (6 !== o[0] && 2 !== o[0]))
                        ) {
                          a = 0;
                          continue;
                        }
                        if (
                          3 === o[0] &&
                          (!s || (o[1] > s[0] && o[1] < s[3]))
                        ) {
                          a.label = o[1];
                          break;
                        }
                        if (6 === o[0] && a.label < s[1]) {
                          (a.label = s[1]), (s = o);
                          break;
                        }
                        if (s && a.label < s[2]) {
                          (a.label = s[2]), a.ops.push(o);
                          break;
                        }
                        s[2] && a.ops.pop(), a.trys.pop();
                        continue;
                    }
                    o = t.call(e, a);
                  } catch (e) {
                    (o = [6, e]), (r = 0);
                  } finally {
                    n = s = 0;
                  }
                if (5 & o[0]) throw o[1];
                return { value: o[0] ? o[1] : void 0, done: !0 };
              })([o, i]);
            };
          }
        };
      Object.defineProperty(t, "__esModule", { value: !0 }),
        (t.datapointsPath = t.getCalculationWarnings = t.getLimitsWarnings = t.promiser = t.datapoints2Tuples = t.reduceTimeseries = t.getTimeseries = t.getLabelWithInjectedProps = t.formMetadatasForTargets = t.formQueriesForTargets = t.formQueryForItems = void 0);
      var a = n(1),
        i = n(0),
        l = n(2),
        u = n(13),
        c = n(9),
        p = n(8),
        f = n(4),
        m = a.Tab.Asset,
        b = a.Tab.Custom,
        d = a.Tab.Timeseries;
      function h(e, t, n) {
        var s = t.tab,
          o = t.aggregation,
          a = t.granularity,
          i = c.getRange(n.range),
          u = i[0],
          p = i[1];
        if (s === b) {
          var f = y(e.length);
          return {
            items: e.map(function(e) {
              return { expression: e.expression, start: u, end: p, limit: f };
            })
          };
        }
        var m = null,
          d = o && "none" !== o;
        d &&
          (m = {
            aggregates: [o],
            granularity: a || l.ms2String(n.intervalMs)
          });
        var h = y(e.length, d);
        return r(r({}, m), { end: p, start: u, items: e, limit: h });
      }
      function y(e, t) {
        return (
          void 0 === t && (t = !0),
          Math.floor((t ? 1e4 : 1e5) / Math.min(e, 100))
        );
      }
      function $(e, t, n) {
        return s(this, void 0, void 0, function() {
          var r, s;
          return o(this, function(o) {
            switch (o.label) {
              case 0:
                switch (e.tab) {
                  case void 0:
                  case d:
                    return [3, 1];
                  case m:
                    return [3, 3];
                  case b:
                    return [3, 5];
                }
                return [3, 6];
              case 1:
                return [4, g(e.label, e.target, e, n)];
              case 2:
                return [2, [o.sent()]];
              case 3:
                return (
                  (r = e.label || ""),
                  [
                    4,
                    x(
                      {
                        items: t.map(function(e) {
                          return { id: e.id };
                        })
                      },
                      e,
                      n,
                      !1
                    )
                  ]
                );
              case 4:
                return [
                  2,
                  o.sent().map(function(e) {
                    return v(r, e);
                  })
                ];
              case 5:
                return (
                  (s = t.map(function(e) {
                    return e.expression;
                  })),
                  [2, u.getLabelsForExpression(s, e.label, e, n)]
                );
              case 6:
                return [2];
            }
          });
        });
      }
      function g(e, t, n, r) {
        return (
          void 0 === e && (e = ""),
          s(this, void 0, void 0, function() {
            var s, a;
            return o(this, function(o) {
              switch (o.label) {
                case 0:
                  if (((s = e), !e || !e.match(/{{.*}}/))) return [3, 4];
                  o.label = 1;
                case 1:
                  return (
                    o.trys.push([1, 3, , 4]),
                    [4, x({ items: [{ id: t }] }, n, r)]
                  );
                case 2:
                  return (a = o.sent()[0]), (s = v(e, a)), [3, 4];
                case 3:
                  return o.sent(), [3, 4];
                case 4:
                  return [2, s];
              }
            });
          })
        );
      }
      function v(e, t) {
        return e.replace(/{{([^{}]*)}}/g, function(e, n) {
          return i.get(t, n, e);
        });
      }
      function x(e, t, n, r) {
        return (
          void 0 === r && (r = !0),
          s(this, void 0, void 0, function() {
            var s, l, u, c, m, b;
            return o(this, function(o) {
              switch (o.label) {
                case 0:
                  return (
                    o.trys.push([0, 5, , 6]),
                    (s = a.HttpMethod.POST),
                    (l = void 0),
                    "items" in e
                      ? [
                          4,
                          n.fetchItems({
                            data: e,
                            method: s,
                            path: "/timeseries/byids",
                            cacheTime: f.CacheTime.TimeseriesByIds
                          })
                        ]
                      : [3, 2]
                  );
                case 1:
                  return (l = o.sent()), [3, 4];
                case 2:
                  return [
                    4,
                    n.fetchAndPaginate({
                      data: e,
                      method: s,
                      path: "/timeseries/list",
                      cacheTime: f.CacheTime.TimeseriesList
                    })
                  ];
                case 3:
                  (l = o.sent()), (o.label = 4);
                case 4:
                  return [
                    2,
                    i.cloneDeep(
                      r
                        ? l.filter(function(e) {
                            return !e.isString;
                          })
                        : l
                    )
                  ];
                case 5:
                  return (
                    (u = o.sent()),
                    (c = u.data),
                    (m = u.status),
                    (b =
                      c && c.error
                        ? "[" + m + " ERROR] " + c.error.message
                        : "Unknown error"),
                    p.appEvents.emit(f.failedResponseEvent, {
                      refId: t.refId,
                      error: b
                    }),
                    [2, []]
                  );
                case 6:
                  return [2];
              }
            });
          })
        );
      }
      function j(e, t) {
        return e.map(function(e) {
          return [(r = t) in (n = e) ? n[r] : n.value, n.timestamp];
          var n, r;
        });
      }
      (t.formQueryForItems = h),
        (t.formQueriesForTargets = function(e, t) {
          return e.map(function(e) {
            var n = e.target;
            return h(e.items, n, t);
          });
        }),
        (t.formMetadatasForTargets = function(e, t, n) {
          return s(this, void 0, void 0, function() {
            var t,
              r = this;
            return o(this, function(a) {
              return (
                (t = e.map(function(e) {
                  var t = e.target,
                    a = e.items;
                  return s(r, void 0, void 0, function() {
                    var e;
                    return o(this, function(r) {
                      switch (r.label) {
                        case 0:
                          return [4, $(t, a, n)];
                        case 1:
                          return (e = r.sent()), [2, { target: t, labels: e }];
                      }
                    });
                  });
                })),
                [2, Promise.all(t)]
              );
            });
          });
        }),
        (t.getLabelWithInjectedProps = v),
        (t.getTimeseries = x),
        (t.reduceTimeseries = function(e, t) {
          var n = t[0],
            r = t[1],
            s = [];
          return (
            e.forEach(function(e) {
              var t = e.result,
                o = e.metadata.labels,
                a = t.config.data.aggregates,
                i = t.data.items,
                l = a ? a + " " : "",
                u = i.map(function(e, t) {
                  var s = e.datapoints,
                    i = e.externalId,
                    u = e.id;
                  return {
                    target: (o && o[t]) || "" + l + (i || u),
                    datapoints: j(
                      s.filter(function(e) {
                        var t = e.timestamp;
                        return t >= n && t <= r;
                      }),
                      a
                    )
                  };
                });
              s.push.apply(s, u);
            }),
            s
          );
        }),
        (t.datapoints2Tuples = j),
        (t.promiser = function(e, t, n) {
          return s(this, void 0, void 0, function() {
            var r,
              a,
              i,
              l = this;
            return o(this, function(u) {
              switch (u.label) {
                case 0:
                  return (
                    (r = []),
                    (a = []),
                    (i = e.map(function(e, i) {
                      return s(l, void 0, void 0, function() {
                        var s, l, u;
                        return o(this, function(o) {
                          switch (o.label) {
                            case 0:
                              (s = t[i]), (o.label = 1);
                            case 1:
                              return o.trys.push([1, 3, , 4]), [4, n(e, s)];
                            case 2:
                              return (
                                (l = o.sent()),
                                r.push({ result: l, metadata: s }),
                                [3, 4]
                              );
                            case 3:
                              return (
                                (u = o.sent()),
                                a.push({ error: u, metadata: s }),
                                [3, 4]
                              );
                            case 4:
                              return [2];
                          }
                        });
                      });
                    })),
                    [4, Promise.all(i)]
                  );
                case 1:
                  return u.sent(), [2, { succeded: r, failed: a }];
              }
            });
          });
        }),
        (t.getLimitsWarnings = function(e, t) {
          return e.some(function(e) {
            return e.datapoints.length >= t;
          })
            ? f.DATAPOINTS_LIMIT_WARNING
            : "";
        }),
        (t.getCalculationWarnings = function(e) {
          var t = new Set();
          return (
            e.forEach(function(e) {
              e.datapoints
                .map(function(e) {
                  return e.error;
                })
                .filter(Boolean)
                .forEach(function(e) {
                  t.add(e);
                });
            }),
            Array.from(t).join("\n")
          );
        }),
        (t.datapointsPath = function(e) {
          return "/timeseries/" + (e ? "synthetic/query" : "data/list");
        });
    },
    function(e, t, n) {
      "use strict";
      var r = function(e) {
        return e && e.__esModule ? e : { default: e };
      };
      Object.defineProperty(t, "__esModule", { value: !0 }),
        (t.VariableQueryEditor = t.AnnotationsQueryCtrl = t.ConfigCtrl = t.QueryCtrl = t.Datasource = void 0);
      var s = r(n(9));
      t.Datasource = s.default;
      var o = n(33);
      Object.defineProperty(t, "QueryCtrl", {
        enumerable: !0,
        get: function() {
          return o.CogniteQueryCtrl;
        }
      });
      var a = n(40);
      Object.defineProperty(t, "ConfigCtrl", {
        enumerable: !0,
        get: function() {
          return a.CogniteConfigCtrl;
        }
      });
      var i = n(41);
      Object.defineProperty(t, "AnnotationsQueryCtrl", {
        enumerable: !0,
        get: function() {
          return i.CogniteAnnotationsQueryCtrl;
        }
      });
      var l = n(42);
      Object.defineProperty(t, "VariableQueryEditor", {
        enumerable: !0,
        get: function() {
          return l.CogniteVariableQueryCtrl;
        }
      });
    },
    function(e, t) {
      e.exports = n;
    },
    function(e, t, n) {
      "use strict";
      const r = n(18),
        s = n(19),
        o = n(20);
      function a(e, t) {
        return t.encode ? (t.strict ? r(e) : encodeURIComponent(e)) : e;
      }
      function i(e, t) {
        return t.decode ? s(e) : e;
      }
      function l(e) {
        const t = e.indexOf("#");
        return -1 !== t && (e = e.slice(0, t)), e;
      }
      function u(e) {
        const t = (e = l(e)).indexOf("?");
        return -1 === t ? "" : e.slice(t + 1);
      }
      function c(e, t) {
        return (
          t.parseNumbers &&
          !Number.isNaN(Number(e)) &&
          "string" == typeof e &&
          "" !== e.trim()
            ? (e = Number(e))
            : !t.parseBooleans ||
              null === e ||
              ("true" !== e.toLowerCase() && "false" !== e.toLowerCase()) ||
              (e = "true" === e.toLowerCase()),
          e
        );
      }
      function p(e, t) {
        const n = (function(e) {
            let t;
            switch (e.arrayFormat) {
              case "index":
                return (e, n, r) => {
                  (t = /\[(\d*)\]$/.exec(e)),
                    (e = e.replace(/\[\d*\]$/, "")),
                    t
                      ? (void 0 === r[e] && (r[e] = {}), (r[e][t[1]] = n))
                      : (r[e] = n);
                };
              case "bracket":
                return (e, n, r) => {
                  (t = /(\[\])$/.exec(e)),
                    (e = e.replace(/\[\]$/, "")),
                    t
                      ? void 0 !== r[e]
                        ? (r[e] = [].concat(r[e], n))
                        : (r[e] = [n])
                      : (r[e] = n);
                };
              case "comma":
                return (e, t, n) => {
                  const r =
                    "string" == typeof t && t.split("").indexOf(",") > -1
                      ? t.split(",")
                      : t;
                  n[e] = r;
                };
              default:
                return (e, t, n) => {
                  void 0 !== n[e] ? (n[e] = [].concat(n[e], t)) : (n[e] = t);
                };
            }
          })(
            (t = Object.assign(
              {
                decode: !0,
                sort: !0,
                arrayFormat: "none",
                parseNumbers: !1,
                parseBooleans: !1
              },
              t
            ))
          ),
          r = Object.create(null);
        if ("string" != typeof e) return r;
        if (!(e = e.trim().replace(/^[?#&]/, ""))) return r;
        for (const s of e.split("&")) {
          let [e, a] = o(t.decode ? s.replace(/\+/g, " ") : s, "=");
          (a = void 0 === a ? null : i(a, t)), n(i(e, t), a, r);
        }
        for (const e of Object.keys(r)) {
          const n = r[e];
          if ("object" == typeof n && null !== n)
            for (const e of Object.keys(n)) n[e] = c(n[e], t);
          else r[e] = c(n, t);
        }
        return !1 === t.sort
          ? r
          : (!0 === t.sort
              ? Object.keys(r).sort()
              : Object.keys(r).sort(t.sort)
            ).reduce((e, t) => {
              const n = r[t];
              return (
                Boolean(n) && "object" == typeof n && !Array.isArray(n)
                  ? (e[t] = (function e(t) {
                      return Array.isArray(t)
                        ? t.sort()
                        : "object" == typeof t
                        ? e(Object.keys(t))
                            .sort((e, t) => Number(e) - Number(t))
                            .map(e => t[e])
                        : t;
                    })(n))
                  : (e[t] = n),
                e
              );
            }, Object.create(null));
      }
      (t.extract = u),
        (t.parse = p),
        (t.stringify = (e, t) => {
          if (!e) return "";
          const n = (function(e) {
              switch (e.arrayFormat) {
                case "index":
                  return t => (n, r) => {
                    const s = n.length;
                    return void 0 === r || (e.skipNull && null === r)
                      ? n
                      : null === r
                      ? [...n, [a(t, e), "[", s, "]"].join("")]
                      : [...n, [a(t, e), "[", a(s, e), "]=", a(r, e)].join("")];
                  };
                case "bracket":
                  return t => (n, r) =>
                    void 0 === r || (e.skipNull && null === r)
                      ? n
                      : null === r
                      ? [...n, [a(t, e), "[]"].join("")]
                      : [...n, [a(t, e), "[]=", a(r, e)].join("")];
                case "comma":
                  return t => (n, r) =>
                    null == r || 0 === r.length
                      ? n
                      : 0 === n.length
                      ? [[a(t, e), "=", a(r, e)].join("")]
                      : [[n, a(r, e)].join(",")];
                default:
                  return t => (n, r) =>
                    void 0 === r || (e.skipNull && null === r)
                      ? n
                      : null === r
                      ? [...n, a(t, e)]
                      : [...n, [a(t, e), "=", a(r, e)].join("")];
              }
            })(
              (t = Object.assign(
                { encode: !0, strict: !0, arrayFormat: "none" },
                t
              ))
            ),
            r = Object.assign({}, e);
          if (t.skipNull)
            for (const e of Object.keys(r))
              (void 0 !== r[e] && null !== r[e]) || delete r[e];
          const s = Object.keys(r);
          return (
            !1 !== t.sort && s.sort(t.sort),
            s
              .map(r => {
                const s = e[r];
                return void 0 === s
                  ? ""
                  : null === s
                  ? a(r, t)
                  : Array.isArray(s)
                  ? s.reduce(n(r), []).join("&")
                  : a(r, t) + "=" + a(s, t);
              })
              .filter(e => e.length > 0)
              .join("&")
          );
        }),
        (t.parseUrl = (e, t) => ({
          url: l(e).split("?")[0] || "",
          query: p(u(e), t)
        })),
        (t.stringifyUrl = (e, n) => {
          const r = l(e.url).split("?")[0] || "",
            s = t.extract(e.url),
            o = t.parse(s),
            a = (function(e) {
              let t = "";
              const n = e.indexOf("#");
              return -1 !== n && (t = e.slice(n)), t;
            })(e.url),
            i = Object.assign(o, e.query);
          let u = t.stringify(i, n);
          return u && (u = "?" + u), `${r}${u}${a}`;
        });
    },
    function(e, t, n) {
      "use strict";
      e.exports = e =>
        encodeURIComponent(e).replace(
          /[!'()*]/g,
          e =>
            "%" +
            e
              .charCodeAt(0)
              .toString(16)
              .toUpperCase()
        );
    },
    function(e, t, n) {
      "use strict";
      var r = new RegExp("%[a-f0-9]{2}", "gi"),
        s = new RegExp("(%[a-f0-9]{2})+", "gi");
      function o(e, t) {
        try {
          return decodeURIComponent(e.join(""));
        } catch (e) {}
        if (1 === e.length) return e;
        t = t || 1;
        var n = e.slice(0, t),
          r = e.slice(t);
        return Array.prototype.concat.call([], o(n), o(r));
      }
      function a(e) {
        try {
          return decodeURIComponent(e);
        } catch (s) {
          for (var t = e.match(r), n = 1; n < t.length; n++)
            t = (e = o(t, n).join("")).match(r);
          return e;
        }
      }
      e.exports = function(e) {
        if ("string" != typeof e)
          throw new TypeError(
            "Expected `encodedURI` to be of type `string`, got `" +
              typeof e +
              "`"
          );
        try {
          return (e = e.replace(/\+/g, " ")), decodeURIComponent(e);
        } catch (t) {
          return (function(e) {
            for (
              var t = { "%FE%FF": "��", "%FF%FE": "��" }, n = s.exec(e);
              n;

            ) {
              try {
                t[n[0]] = decodeURIComponent(n[0]);
              } catch (e) {
                var r = a(n[0]);
                r !== n[0] && (t[n[0]] = r);
              }
              n = s.exec(e);
            }
            t["%C2"] = "�";
            for (var o = Object.keys(t), i = 0; i < o.length; i++) {
              var l = o[i];
              e = e.replace(new RegExp(l, "g"), t[l]);
            }
            return e;
          })(e);
        }
      };
    },
    function(e, t, n) {
      "use strict";
      e.exports = (e, t) => {
        if ("string" != typeof e || "string" != typeof t)
          throw new TypeError("Expected the arguments to be of type `string`");
        if ("" === t) return [e];
        const n = e.indexOf(t);
        return -1 === n ? [e] : [e.slice(0, n), e.slice(n + t.length)];
      };
    },
    function(e, t, n) {
      "use strict";
      var r = n(6),
        s = n(22);
      e.exports = function(e) {
        var t = r(e),
          n = s(e),
          o = e.each || e.forArray;
        return function r(s, a, i, l, u, c, p, f, m, b) {
          if (!i.break) {
            var d,
              h = {
                value: s,
                key: l,
                path: "array" == i.pathFormat ? u : t(u),
                parent: p
              },
              y = f.concat([h]),
              $ = void 0,
              g = void 0,
              v = void 0;
            i.checkCircular &&
              (e.isObject(s) && !e.isEmpty(s)
                ? (v =
                    f[
                      (g = e.findIndex(f, function(e) {
                        return e.value === s;
                      }))
                    ] || null)
                : ((g = -1), (v = null)),
              ($ = -1 !== g));
            var x =
                !e.isObject(s) ||
                e.isEmpty(s) ||
                $ ||
                (void 0 !== i.childrenPath && !n(s, i.childrenPath)),
              j = (c || i.includeRoot) && (!i.leavesOnly || x);
            if (j) {
              var E = {
                path: "array" == i.pathFormat ? u : t(u),
                parent: p,
                parents: f,
                obj: m,
                depth: c,
                isCircular: $,
                circularParent: v,
                circularParentIndex: g,
                isLeaf: x,
                break: function() {
                  return (i.break = !0), !1;
                }
              };
              void 0 !== i.childrenPath &&
                ((h.childrenPath = "array" == i.pathFormat ? b : t(b)),
                (E.childrenPath = h.childrenPath));
              try {
                d = a(s, l, p && p.value, E);
              } catch (e) {
                throw (e.message &&
                  (e.message +=
                    "\ncallback failed before deep iterate at:\n" + E.path),
                e);
              }
            }
            if (!i.break && !1 !== d && !$ && e.isObject(s))
              if (void 0 !== i.childrenPath) {
                function w(t, n) {
                  t &&
                    e.isObject(t) &&
                    e.forOwn(t, function(e, t) {
                      var s = (u || []).concat(n || [], [t]);
                      r(e, a, i, t, s, c + 1, h, y, m, n);
                    });
                }
                !c && i.rootIsChildren
                  ? w(s, void 0)
                  : o(i.childrenPath, function(t) {
                      w(e.get(s, t), t);
                    });
              } else
                e.forOwn(s, function(t, n) {
                  if (!e.isArray(s) || void 0 !== t || n in s) {
                    var o = (u || []).concat([n]);
                    r(t, a, i, n, o, c + 1, h, y, m);
                  }
                });
            if (i.callbackAfterIterate && j) {
              E.afterIterate = !0;
              try {
                a(s, l, p && p.value, E);
              } catch (e) {
                throw (e.message &&
                  (e.message +=
                    "\ncallback failed after deep iterate at:\n" + E.path),
                e);
              }
            }
          }
        };
      };
    },
    function(e, t, n) {
      "use strict";
      e.exports = function(e) {
        return function(t, n) {
          return e.some(n, function(n) {
            var r = e.get(t, n);
            return !e.isEmpty(r);
          });
        };
      };
    },
    function(e, t, n) {
      "use strict";
      var r = n(24),
        s = n(7);
      e.exports = function(e) {
        var t = s(e),
          n = r(),
          o = e.each || e.forArray;
        return function(r, s) {
          var a = {
              checkCircular: (s = e.merge({ checkCircular: !1 }, s || {}))
                .checkCircular
            },
            i = [];
          return (
            t(
              r,
              function(t, n, r, s) {
                !s.isCircular && e.isArray(t) && i.push(t);
              },
              a
            ),
            e.isArray(r) && i.push(r),
            o(i, n),
            r
          );
        };
      };
    },
    function(e, t, n) {
      "use strict";
      e.exports = function(e) {
        return function(e) {
          for (var t = [], n = 0; n < e.length; n++) n in e || t.push(n);
          for (var r = t.length; r--; ) e.splice(t[r], 1);
          return e;
        };
      };
    },
    function(e, t, n) {
      "use strict";
      function r(e) {
        return function(t, n) {
          var r = (n = e.isArray(n) ? e.clone(n) : e.toPath(n)).pop(),
            s = n.length ? e.get(t, n) : t;
          return void 0 !== s && r in s;
        };
      }
      (r.notChainable = !0), (e.exports = r);
    },
    function(e, t, n) {
      "use strict";
      function r(e) {
        return function(t, n) {
          return void 0 === n ? t : e.get(t, n);
        };
      }
      (r.notChainable = !0), (e.exports = r);
    },
    function(e, t, n) {
      "use strict";
      var r = n(7);
      e.exports = function(e) {
        var t = r(e);
        return function(n, r) {
          r && void 0 !== r.leafsOnly && (r.leavesOnly = r.leafsOnly);
          var s = {
              pathFormat: (r = e.merge(
                {
                  checkCircular: !1,
                  includeCircularPath: !0,
                  leavesOnly: !r || void 0 === r.childrenPath,
                  pathFormat: "string"
                },
                r || {}
              )).pathFormat,
              checkCircular: r.checkCircular,
              includeRoot: r.includeRoot,
              childrenPath: r.childrenPath,
              rootIsChildren: r.rootIsChildren,
              leavesOnly: r.leavesOnly
            },
            o = [];
          return (
            t(
              n,
              function(e, t, n, s) {
                (s.isCircular && !r.includeCircularPath) ||
                  (void 0 !== s.path && o.push(s.path));
              },
              s
            ),
            o
          );
        };
      };
    },
    function(e, t, n) {
      "use strict";
      var r = n(5),
        s = n(29);
      e.exports = function(e) {
        var t = s(e),
          n = r(e);
        return function(r, s, o) {
          var a = !(o = e.merge({ invert: !1 }, o || {})).invert;
          return (
            ((o = e.merge(
              {
                onMatch: { cloneDeep: !1, skipChildren: !1, keepIfEmpty: !a },
                onNotMatch: { cloneDeep: !1, skipChildren: !1, keepIfEmpty: a }
              },
              o
            )).leavesOnly = !1),
            (o.childrenPath = void 0),
            (o.includeRoot = void 0),
            (o.pathFormat = "array"),
            (o.onTrue = o.invert ? o.onMatch : o.onNotMatch),
            (o.onFalse = o.invert ? o.onNotMatch : o.onMatch),
            n(
              r,
              function(e, n, r, a) {
                return !1 !== t(a.path, s) ? o.invert : !o.invert;
              },
              o
            )
          );
        };
      };
    },
    function(e, t, n) {
      "use strict";
      var r = n(6);
      function s(e) {
        var t = r(e);
        return function(n, r) {
          var s, o;
          e.isString(n) ? (s = n) : (o = n),
            (r = e.isArray(r) ? e.cloneDeep(r) : [r]);
          for (var a = 0; a < r.length; a++)
            if (
              (e.isString(r[a]) && (r[a] = e.toPath(r[a])), e.isArray(r[a]))
            ) {
              if (
                (void 0 === o && (o = e.toPath(s)),
                o.length >= r[a].length &&
                  e.isEqual(e.takeRight(o, r[a].length), r[a]))
              )
                return r[a];
            } else {
              if (!(r[a] instanceof RegExp))
                throw new Error(
                  "To match path use only string/regex or array of them."
                );
              if ((void 0 === s && (s = t(n)), r[a].test(s))) return r[a];
            }
          return !1;
        };
      }
      (s.notChainable = !0), (e.exports = s);
    },
    function(e, t, n) {
      "use strict";
      var r = function() {
        return (r =
          Object.assign ||
          function(e) {
            for (var t, n = 1, r = arguments.length; n < r; n++)
              for (var s in (t = arguments[n]))
                Object.prototype.hasOwnProperty.call(t, s) && (e[s] = t[s]);
            return e;
          }).apply(this, arguments);
      };
      function s(e) {
        return e[0];
      }
      Object.defineProperty(t, "__esModule", { value: !0 });
      var o = function() {
          return [];
        },
        a = function(e) {
          var t, n;
          return e.length > 2
            ? (((t = {})[e[0] + e[1]] = {
                key: e[0],
                filter: e[1],
                value: e[2]
              }),
              t)
            : (((n = {})[e[0]] = e[1]), n);
        },
        i = {
          Lexer: void 0,
          ParserRules: [
            { name: "unsigned_int$ebnf$1", symbols: [/[0-9]/] },
            {
              name: "unsigned_int$ebnf$1",
              symbols: ["unsigned_int$ebnf$1", /[0-9]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "unsigned_int",
              symbols: ["unsigned_int$ebnf$1"],
              postprocess: function(e) {
                return parseInt(e[0].join(""));
              }
            },
            { name: "int$ebnf$1$subexpression$1", symbols: [{ literal: "-" }] },
            { name: "int$ebnf$1$subexpression$1", symbols: [{ literal: "+" }] },
            {
              name: "int$ebnf$1",
              symbols: ["int$ebnf$1$subexpression$1"],
              postprocess: s
            },
            {
              name: "int$ebnf$1",
              symbols: [],
              postprocess: function() {
                return null;
              }
            },
            { name: "int$ebnf$2", symbols: [/[0-9]/] },
            {
              name: "int$ebnf$2",
              symbols: ["int$ebnf$2", /[0-9]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "int",
              symbols: ["int$ebnf$1", "int$ebnf$2"],
              postprocess: function(e) {
                return e[0]
                  ? parseInt(e[0][0] + e[1].join(""))
                  : parseInt(e[1].join(""));
              }
            },
            { name: "unsigned_decimal$ebnf$1", symbols: [/[0-9]/] },
            {
              name: "unsigned_decimal$ebnf$1",
              symbols: ["unsigned_decimal$ebnf$1", /[0-9]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "unsigned_decimal$ebnf$2$subexpression$1$ebnf$1",
              symbols: [/[0-9]/]
            },
            {
              name: "unsigned_decimal$ebnf$2$subexpression$1$ebnf$1",
              symbols: [
                "unsigned_decimal$ebnf$2$subexpression$1$ebnf$1",
                /[0-9]/
              ],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "unsigned_decimal$ebnf$2$subexpression$1",
              symbols: [
                { literal: "." },
                "unsigned_decimal$ebnf$2$subexpression$1$ebnf$1"
              ]
            },
            {
              name: "unsigned_decimal$ebnf$2",
              symbols: ["unsigned_decimal$ebnf$2$subexpression$1"],
              postprocess: s
            },
            {
              name: "unsigned_decimal$ebnf$2",
              symbols: [],
              postprocess: function() {
                return null;
              }
            },
            {
              name: "unsigned_decimal",
              symbols: ["unsigned_decimal$ebnf$1", "unsigned_decimal$ebnf$2"],
              postprocess: function(e) {
                return parseFloat(
                  e[0].join("") + (e[1] ? "." + e[1][1].join("") : "")
                );
              }
            },
            {
              name: "decimal$ebnf$1",
              symbols: [{ literal: "-" }],
              postprocess: s
            },
            {
              name: "decimal$ebnf$1",
              symbols: [],
              postprocess: function() {
                return null;
              }
            },
            { name: "decimal$ebnf$2", symbols: [/[0-9]/] },
            {
              name: "decimal$ebnf$2",
              symbols: ["decimal$ebnf$2", /[0-9]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "decimal$ebnf$3$subexpression$1$ebnf$1",
              symbols: [/[0-9]/]
            },
            {
              name: "decimal$ebnf$3$subexpression$1$ebnf$1",
              symbols: ["decimal$ebnf$3$subexpression$1$ebnf$1", /[0-9]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "decimal$ebnf$3$subexpression$1",
              symbols: [
                { literal: "." },
                "decimal$ebnf$3$subexpression$1$ebnf$1"
              ]
            },
            {
              name: "decimal$ebnf$3",
              symbols: ["decimal$ebnf$3$subexpression$1"],
              postprocess: s
            },
            {
              name: "decimal$ebnf$3",
              symbols: [],
              postprocess: function() {
                return null;
              }
            },
            {
              name: "decimal",
              symbols: ["decimal$ebnf$1", "decimal$ebnf$2", "decimal$ebnf$3"],
              postprocess: function(e) {
                return parseFloat(
                  (e[0] || "") +
                    e[1].join("") +
                    (e[2] ? "." + e[2][1].join("") : "")
                );
              }
            },
            {
              name: "percentage",
              symbols: ["decimal", { literal: "%" }],
              postprocess: function(e) {
                return e[0] / 100;
              }
            },
            {
              name: "jsonfloat$ebnf$1",
              symbols: [{ literal: "-" }],
              postprocess: s
            },
            {
              name: "jsonfloat$ebnf$1",
              symbols: [],
              postprocess: function() {
                return null;
              }
            },
            { name: "jsonfloat$ebnf$2", symbols: [/[0-9]/] },
            {
              name: "jsonfloat$ebnf$2",
              symbols: ["jsonfloat$ebnf$2", /[0-9]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "jsonfloat$ebnf$3$subexpression$1$ebnf$1",
              symbols: [/[0-9]/]
            },
            {
              name: "jsonfloat$ebnf$3$subexpression$1$ebnf$1",
              symbols: ["jsonfloat$ebnf$3$subexpression$1$ebnf$1", /[0-9]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "jsonfloat$ebnf$3$subexpression$1",
              symbols: [
                { literal: "." },
                "jsonfloat$ebnf$3$subexpression$1$ebnf$1"
              ]
            },
            {
              name: "jsonfloat$ebnf$3",
              symbols: ["jsonfloat$ebnf$3$subexpression$1"],
              postprocess: s
            },
            {
              name: "jsonfloat$ebnf$3",
              symbols: [],
              postprocess: function() {
                return null;
              }
            },
            {
              name: "jsonfloat$ebnf$4$subexpression$1$ebnf$1",
              symbols: [/[+-]/],
              postprocess: s
            },
            {
              name: "jsonfloat$ebnf$4$subexpression$1$ebnf$1",
              symbols: [],
              postprocess: function() {
                return null;
              }
            },
            {
              name: "jsonfloat$ebnf$4$subexpression$1$ebnf$2",
              symbols: [/[0-9]/]
            },
            {
              name: "jsonfloat$ebnf$4$subexpression$1$ebnf$2",
              symbols: ["jsonfloat$ebnf$4$subexpression$1$ebnf$2", /[0-9]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "jsonfloat$ebnf$4$subexpression$1",
              symbols: [
                /[eE]/,
                "jsonfloat$ebnf$4$subexpression$1$ebnf$1",
                "jsonfloat$ebnf$4$subexpression$1$ebnf$2"
              ]
            },
            {
              name: "jsonfloat$ebnf$4",
              symbols: ["jsonfloat$ebnf$4$subexpression$1"],
              postprocess: s
            },
            {
              name: "jsonfloat$ebnf$4",
              symbols: [],
              postprocess: function() {
                return null;
              }
            },
            {
              name: "jsonfloat",
              symbols: [
                "jsonfloat$ebnf$1",
                "jsonfloat$ebnf$2",
                "jsonfloat$ebnf$3",
                "jsonfloat$ebnf$4"
              ],
              postprocess: function(e) {
                return parseFloat(
                  (e[0] || "") +
                    e[1].join("") +
                    (e[2] ? "." + e[2][1].join("") : "") +
                    (e[3] ? "e" + (e[3][1] || "+") + e[3][2].join("") : "")
                );
              }
            },
            {
              name: "regexp$string$1",
              symbols: [{ literal: "=" }, { literal: "~" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "regexp", symbols: ["regexp$string$1"], postprocess: s },
            {
              name: "regexp$string$2",
              symbols: [{ literal: "!" }, { literal: "~" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "regexp", symbols: ["regexp$string$2"], postprocess: s },
            { name: "equals", symbols: [{ literal: "=" }], postprocess: s },
            {
              name: "not_equals$string$1",
              symbols: [{ literal: "!" }, { literal: "=" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "not_equals",
              symbols: ["not_equals$string$1"],
              postprocess: s
            },
            { name: "prop_name$ebnf$1", symbols: [/[A-Za-z0-9_]/] },
            {
              name: "prop_name$ebnf$1",
              symbols: ["prop_name$ebnf$1", /[A-Za-z0-9_]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "prop_name",
              symbols: ["prop_name$ebnf$1"],
              postprocess: function(e) {
                return e[0].join("");
              }
            },
            { name: "number", symbols: ["decimal"], postprocess: s },
            { name: "dqstring$ebnf$1", symbols: [] },
            {
              name: "dqstring$ebnf$1",
              symbols: ["dqstring$ebnf$1", "dstrchar"],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "dqstring",
              symbols: [{ literal: '"' }, "dqstring$ebnf$1", { literal: '"' }],
              postprocess: function(e) {
                return e[1].join("");
              }
            },
            { name: "sqstring$ebnf$1", symbols: [] },
            {
              name: "sqstring$ebnf$1",
              symbols: ["sqstring$ebnf$1", "sstrchar"],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "sqstring",
              symbols: [{ literal: "'" }, "sqstring$ebnf$1", { literal: "'" }],
              postprocess: function(e) {
                return e[1].join("");
              }
            },
            { name: "dqregexp$ebnf$1", symbols: [] },
            {
              name: "dqregexp$ebnf$1",
              symbols: ["dqregexp$ebnf$1", "ndstrchar"],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "dqregexp",
              symbols: [{ literal: '"' }, "dqregexp$ebnf$1", { literal: '"' }],
              postprocess: function(e) {
                return e[1].join("");
              }
            },
            { name: "sqregexp$ebnf$1", symbols: [] },
            {
              name: "sqregexp$ebnf$1",
              symbols: ["sqregexp$ebnf$1", "nsstrchar"],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "sqregexp",
              symbols: [{ literal: "'" }, "sqregexp$ebnf$1", { literal: "'" }],
              postprocess: function(e) {
                return e[1].join("");
              }
            },
            { name: "dstrchar", symbols: [/[^\\"\n]/], postprocess: s },
            {
              name: "dstrchar",
              symbols: ["backslash", "strescape"],
              postprocess: function(e) {
                return JSON.parse('"' + e.join("") + '"');
              }
            },
            {
              name: "dstrchar$string$1",
              symbols: [{ literal: "\\" }, { literal: '"' }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "dstrchar",
              symbols: ["dstrchar$string$1"],
              postprocess: function(e) {
                return '"';
              }
            },
            { name: "sstrchar", symbols: [/[^\\'\n]/], postprocess: s },
            {
              name: "sstrchar",
              symbols: ["backslash", "strescape"],
              postprocess: function(e) {
                return JSON.parse('"' + e.join("") + '"');
              }
            },
            {
              name: "sstrchar$string$1",
              symbols: [{ literal: "\\" }, { literal: "'" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "sstrchar",
              symbols: ["sstrchar$string$1"],
              postprocess: function(e) {
                return "'";
              }
            },
            { name: "ndstrchar", symbols: [/[^\\"\n]/], postprocess: s },
            {
              name: "ndstrchar",
              symbols: ["backslash", "unicode"],
              postprocess: function(e) {
                return JSON.parse('"' + e.join("") + '"');
              }
            },
            {
              name: "ndstrchar$string$1",
              symbols: [{ literal: "\\" }, { literal: '"' }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "ndstrchar",
              symbols: ["ndstrchar$string$1"],
              postprocess: function(e) {
                return '\\"';
              }
            },
            { name: "ndstrchar", symbols: ["backslash"], postprocess: s },
            { name: "nsstrchar", symbols: [/[^\\'\n]/], postprocess: s },
            {
              name: "nsstrchar",
              symbols: ["backslash", "unicode"],
              postprocess: function(e) {
                return JSON.parse('"' + e.join("") + '"');
              }
            },
            {
              name: "nsstrchar$string$1",
              symbols: [{ literal: "\\" }, { literal: "'" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "nsstrchar",
              symbols: ["nsstrchar$string$1"],
              postprocess: function(e) {
                return "\\'";
              }
            },
            { name: "nsstrchar", symbols: ["backslash"], postprocess: s },
            { name: "strescape", symbols: [/["\\/bfnrt]/], postprocess: s },
            { name: "strescape", symbols: ["unicode"], postprocess: s },
            {
              name: "backslash",
              symbols: [{ literal: "\\" }],
              postprocess: function(e) {
                return "\\";
              }
            },
            {
              name: "unicode",
              symbols: [
                { literal: "u" },
                /[a-fA-F0-9]/,
                /[a-fA-F0-9]/,
                /[a-fA-F0-9]/,
                /[a-fA-F0-9]/
              ],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "_$ebnf$1", symbols: [] },
            {
              name: "_$ebnf$1",
              symbols: ["_$ebnf$1", /[\s]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            { name: "_", symbols: ["_$ebnf$1"], postprocess: null },
            { name: "value", symbols: ["object"], postprocess: s },
            { name: "value", symbols: ["array"], postprocess: s },
            { name: "value", symbols: ["primitive"], postprocess: s },
            { name: "primitive", symbols: ["number"], postprocess: s },
            { name: "primitive", symbols: ["string"], postprocess: s },
            {
              name: "primitive$string$1",
              symbols: [
                { literal: "t" },
                { literal: "r" },
                { literal: "u" },
                { literal: "e" }
              ],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "primitive",
              symbols: ["primitive$string$1"],
              postprocess: function() {
                return !0;
              }
            },
            {
              name: "primitive$string$2",
              symbols: [
                { literal: "f" },
                { literal: "a" },
                { literal: "l" },
                { literal: "s" },
                { literal: "e" }
              ],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "primitive",
              symbols: ["primitive$string$2"],
              postprocess: function() {
                return !1;
              }
            },
            {
              name: "primitive$string$3",
              symbols: [
                { literal: "n" },
                { literal: "u" },
                { literal: "l" },
                { literal: "l" }
              ],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "primitive",
              symbols: ["primitive$string$3"],
              postprocess: function() {
                return null;
              }
            },
            {
              name: "rule",
              symbols: ["type", "condition"],
              postprocess: function(e) {
                return { type: e[0], query: e[1] };
              }
            },
            {
              name: "type$string$1",
              symbols: [
                { literal: "a" },
                { literal: "s" },
                { literal: "s" },
                { literal: "e" },
                { literal: "t" },
                { literal: "s" }
              ],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "type", symbols: ["type$string$1"], postprocess: s },
            {
              name: "type$string$2",
              symbols: [
                { literal: "e" },
                { literal: "v" },
                { literal: "e" },
                { literal: "n" },
                { literal: "t" },
                { literal: "s" }
              ],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "type", symbols: ["type$string$2"], postprocess: s },
            {
              name: "condition",
              symbols: [{ literal: "{" }, { literal: "}" }],
              postprocess: o
            },
            { name: "condition$ebnf$1", symbols: [] },
            {
              name: "condition$ebnf$1$subexpression$1",
              symbols: [{ literal: "," }, "_", "pair", "_"]
            },
            {
              name: "condition$ebnf$1",
              symbols: ["condition$ebnf$1", "condition$ebnf$1$subexpression$1"],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "condition",
              symbols: [
                { literal: "{" },
                "_",
                "pair",
                "_",
                "condition$ebnf$1",
                "_",
                { literal: "}" }
              ],
              postprocess: function(e) {
                if (!e.length) return [];
                var t = [a(e[2])];
                for (var n in e[4]) t.push(a(e[4][n][2]));
                return t;
              }
            },
            { name: "regexp_string", symbols: ["sqregexp"], postprocess: s },
            { name: "regexp_string", symbols: ["dqregexp"], postprocess: s },
            { name: "string", symbols: ["sqstring"], postprocess: s },
            { name: "string", symbols: ["dqstring"], postprocess: s },
            {
              name: "array",
              symbols: [{ literal: "[" }, "_", { literal: "]" }],
              postprocess: o
            },
            { name: "array$ebnf$1", symbols: [] },
            {
              name: "array$ebnf$1$subexpression$1",
              symbols: [{ literal: "," }, "_", "value", "_"]
            },
            {
              name: "array$ebnf$1",
              symbols: ["array$ebnf$1", "array$ebnf$1$subexpression$1"],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "array",
              symbols: [
                { literal: "[" },
                "_",
                "value",
                "_",
                "array$ebnf$1",
                "_",
                { literal: "]" }
              ],
              postprocess: function(e) {
                var t = [e[2]];
                for (var n in e[4]) t.push(e[4][n][2]);
                return t;
              }
            },
            {
              name: "object",
              symbols: [{ literal: "{" }, "_", { literal: "}" }],
              postprocess: function() {
                return {};
              }
            },
            { name: "object$ebnf$1", symbols: [] },
            {
              name: "object$ebnf$1$subexpression$1",
              symbols: [{ literal: "," }, "_", "pair", "_"]
            },
            {
              name: "object$ebnf$1",
              symbols: ["object$ebnf$1", "object$ebnf$1$subexpression$1"],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "object",
              symbols: [
                { literal: "{" },
                "_",
                "pair",
                "_",
                "object$ebnf$1",
                "_",
                { literal: "}" }
              ],
              postprocess: function(e) {
                var t = r({}, a(e[2]));
                for (var n in e[4]) t = r(r({}, t), a(e[4][n][2]));
                return t;
              }
            },
            {
              name: "pair",
              symbols: ["prop_name", "_", "equals", "_", "value"],
              postprocess: function(e) {
                return [e[0], e[4]];
              }
            },
            {
              name: "pair",
              symbols: ["prop_name", "_", "regexp", "_", "regexp_string"],
              postprocess: function(e) {
                return [e[0], e[2], e[4]];
              }
            },
            {
              name: "pair",
              symbols: ["prop_name", "_", "not_equals", "_", "primitive"],
              postprocess: function(e) {
                return [e[0], e[2], e[4]];
              }
            }
          ],
          ParserStart: "rule"
        };
      t.default = i;
    },
    function(e, t, n) {
      "use strict";
      var r = function() {
        for (var e = 0, t = 0, n = arguments.length; t < n; t++)
          e += arguments[t].length;
        var r = Array(e),
          s = 0;
        for (t = 0; t < n; t++)
          for (var o = arguments[t], a = 0, i = o.length; a < i; a++, s++)
            r[s] = o[a];
        return r;
      };
      function s(e) {
        return e[0];
      }
      Object.defineProperty(t, "__esModule", { value: !0 });
      var o = function() {
          return [];
        },
        a = function(e) {
          return e.join("");
        },
        i = function(e) {
          return { path: e[0], filter: e[1], value: e[2] };
        },
        l = function(e) {
          e[0];
          var t = e[1];
          e[2];
          return { operator: t };
        },
        u = function(e) {
          var t = e[0],
            n = (e[1], e[2]);
          e[3];
          return n && n.length ? { func: t || "", args: n } : { func: t };
        },
        c = {
          Lexer: void 0,
          ParserRules: [
            { name: "unsigned_int$ebnf$1", symbols: [/[0-9]/] },
            {
              name: "unsigned_int$ebnf$1",
              symbols: ["unsigned_int$ebnf$1", /[0-9]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "unsigned_int",
              symbols: ["unsigned_int$ebnf$1"],
              postprocess: function(e) {
                return parseInt(e[0].join(""));
              }
            },
            { name: "int$ebnf$1$subexpression$1", symbols: [{ literal: "-" }] },
            { name: "int$ebnf$1$subexpression$1", symbols: [{ literal: "+" }] },
            {
              name: "int$ebnf$1",
              symbols: ["int$ebnf$1$subexpression$1"],
              postprocess: s
            },
            {
              name: "int$ebnf$1",
              symbols: [],
              postprocess: function() {
                return null;
              }
            },
            { name: "int$ebnf$2", symbols: [/[0-9]/] },
            {
              name: "int$ebnf$2",
              symbols: ["int$ebnf$2", /[0-9]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "int",
              symbols: ["int$ebnf$1", "int$ebnf$2"],
              postprocess: function(e) {
                return e[0]
                  ? parseInt(e[0][0] + e[1].join(""))
                  : parseInt(e[1].join(""));
              }
            },
            { name: "unsigned_decimal$ebnf$1", symbols: [/[0-9]/] },
            {
              name: "unsigned_decimal$ebnf$1",
              symbols: ["unsigned_decimal$ebnf$1", /[0-9]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "unsigned_decimal$ebnf$2$subexpression$1$ebnf$1",
              symbols: [/[0-9]/]
            },
            {
              name: "unsigned_decimal$ebnf$2$subexpression$1$ebnf$1",
              symbols: [
                "unsigned_decimal$ebnf$2$subexpression$1$ebnf$1",
                /[0-9]/
              ],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "unsigned_decimal$ebnf$2$subexpression$1",
              symbols: [
                { literal: "." },
                "unsigned_decimal$ebnf$2$subexpression$1$ebnf$1"
              ]
            },
            {
              name: "unsigned_decimal$ebnf$2",
              symbols: ["unsigned_decimal$ebnf$2$subexpression$1"],
              postprocess: s
            },
            {
              name: "unsigned_decimal$ebnf$2",
              symbols: [],
              postprocess: function() {
                return null;
              }
            },
            {
              name: "unsigned_decimal",
              symbols: ["unsigned_decimal$ebnf$1", "unsigned_decimal$ebnf$2"],
              postprocess: function(e) {
                return parseFloat(
                  e[0].join("") + (e[1] ? "." + e[1][1].join("") : "")
                );
              }
            },
            {
              name: "decimal$ebnf$1",
              symbols: [{ literal: "-" }],
              postprocess: s
            },
            {
              name: "decimal$ebnf$1",
              symbols: [],
              postprocess: function() {
                return null;
              }
            },
            { name: "decimal$ebnf$2", symbols: [/[0-9]/] },
            {
              name: "decimal$ebnf$2",
              symbols: ["decimal$ebnf$2", /[0-9]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "decimal$ebnf$3$subexpression$1$ebnf$1",
              symbols: [/[0-9]/]
            },
            {
              name: "decimal$ebnf$3$subexpression$1$ebnf$1",
              symbols: ["decimal$ebnf$3$subexpression$1$ebnf$1", /[0-9]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "decimal$ebnf$3$subexpression$1",
              symbols: [
                { literal: "." },
                "decimal$ebnf$3$subexpression$1$ebnf$1"
              ]
            },
            {
              name: "decimal$ebnf$3",
              symbols: ["decimal$ebnf$3$subexpression$1"],
              postprocess: s
            },
            {
              name: "decimal$ebnf$3",
              symbols: [],
              postprocess: function() {
                return null;
              }
            },
            {
              name: "decimal",
              symbols: ["decimal$ebnf$1", "decimal$ebnf$2", "decimal$ebnf$3"],
              postprocess: function(e) {
                return parseFloat(
                  (e[0] || "") +
                    e[1].join("") +
                    (e[2] ? "." + e[2][1].join("") : "")
                );
              }
            },
            {
              name: "percentage",
              symbols: ["decimal", { literal: "%" }],
              postprocess: function(e) {
                return e[0] / 100;
              }
            },
            {
              name: "jsonfloat$ebnf$1",
              symbols: [{ literal: "-" }],
              postprocess: s
            },
            {
              name: "jsonfloat$ebnf$1",
              symbols: [],
              postprocess: function() {
                return null;
              }
            },
            { name: "jsonfloat$ebnf$2", symbols: [/[0-9]/] },
            {
              name: "jsonfloat$ebnf$2",
              symbols: ["jsonfloat$ebnf$2", /[0-9]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "jsonfloat$ebnf$3$subexpression$1$ebnf$1",
              symbols: [/[0-9]/]
            },
            {
              name: "jsonfloat$ebnf$3$subexpression$1$ebnf$1",
              symbols: ["jsonfloat$ebnf$3$subexpression$1$ebnf$1", /[0-9]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "jsonfloat$ebnf$3$subexpression$1",
              symbols: [
                { literal: "." },
                "jsonfloat$ebnf$3$subexpression$1$ebnf$1"
              ]
            },
            {
              name: "jsonfloat$ebnf$3",
              symbols: ["jsonfloat$ebnf$3$subexpression$1"],
              postprocess: s
            },
            {
              name: "jsonfloat$ebnf$3",
              symbols: [],
              postprocess: function() {
                return null;
              }
            },
            {
              name: "jsonfloat$ebnf$4$subexpression$1$ebnf$1",
              symbols: [/[+-]/],
              postprocess: s
            },
            {
              name: "jsonfloat$ebnf$4$subexpression$1$ebnf$1",
              symbols: [],
              postprocess: function() {
                return null;
              }
            },
            {
              name: "jsonfloat$ebnf$4$subexpression$1$ebnf$2",
              symbols: [/[0-9]/]
            },
            {
              name: "jsonfloat$ebnf$4$subexpression$1$ebnf$2",
              symbols: ["jsonfloat$ebnf$4$subexpression$1$ebnf$2", /[0-9]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "jsonfloat$ebnf$4$subexpression$1",
              symbols: [
                /[eE]/,
                "jsonfloat$ebnf$4$subexpression$1$ebnf$1",
                "jsonfloat$ebnf$4$subexpression$1$ebnf$2"
              ]
            },
            {
              name: "jsonfloat$ebnf$4",
              symbols: ["jsonfloat$ebnf$4$subexpression$1"],
              postprocess: s
            },
            {
              name: "jsonfloat$ebnf$4",
              symbols: [],
              postprocess: function() {
                return null;
              }
            },
            {
              name: "jsonfloat",
              symbols: [
                "jsonfloat$ebnf$1",
                "jsonfloat$ebnf$2",
                "jsonfloat$ebnf$3",
                "jsonfloat$ebnf$4"
              ],
              postprocess: function(e) {
                return parseFloat(
                  (e[0] || "") +
                    e[1].join("") +
                    (e[2] ? "." + e[2][1].join("") : "") +
                    (e[3] ? "e" + (e[3][1] || "+") + e[3][2].join("") : "")
                );
              }
            },
            {
              name: "regexp$string$1",
              symbols: [{ literal: "=" }, { literal: "~" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "regexp", symbols: ["regexp$string$1"], postprocess: s },
            {
              name: "regexp$string$2",
              symbols: [{ literal: "!" }, { literal: "~" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "regexp", symbols: ["regexp$string$2"], postprocess: s },
            { name: "equals", symbols: [{ literal: "=" }], postprocess: s },
            {
              name: "not_equals$string$1",
              symbols: [{ literal: "!" }, { literal: "=" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "not_equals",
              symbols: ["not_equals$string$1"],
              postprocess: s
            },
            { name: "prop_name$ebnf$1", symbols: [/[A-Za-z0-9_]/] },
            {
              name: "prop_name$ebnf$1",
              symbols: ["prop_name$ebnf$1", /[A-Za-z0-9_]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "prop_name",
              symbols: ["prop_name$ebnf$1"],
              postprocess: function(e) {
                var t = e[0];
                return a(t);
              }
            },
            { name: "number", symbols: ["decimal"], postprocess: s },
            { name: "dqstring$ebnf$1", symbols: [] },
            {
              name: "dqstring$ebnf$1",
              symbols: ["dqstring$ebnf$1", "dstrchar"],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "dqstring",
              symbols: [{ literal: '"' }, "dqstring$ebnf$1", { literal: '"' }],
              postprocess: function(e) {
                return e[1].join("");
              }
            },
            { name: "sqstring$ebnf$1", symbols: [] },
            {
              name: "sqstring$ebnf$1",
              symbols: ["sqstring$ebnf$1", "sstrchar"],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "sqstring",
              symbols: [{ literal: "'" }, "sqstring$ebnf$1", { literal: "'" }],
              postprocess: function(e) {
                return e[1].join("");
              }
            },
            { name: "dqregexp$ebnf$1", symbols: [] },
            {
              name: "dqregexp$ebnf$1",
              symbols: ["dqregexp$ebnf$1", "ndstrchar"],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "dqregexp",
              symbols: [{ literal: '"' }, "dqregexp$ebnf$1", { literal: '"' }],
              postprocess: function(e) {
                return e[1].join("");
              }
            },
            { name: "sqregexp$ebnf$1", symbols: [] },
            {
              name: "sqregexp$ebnf$1",
              symbols: ["sqregexp$ebnf$1", "nsstrchar"],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "sqregexp",
              symbols: [{ literal: "'" }, "sqregexp$ebnf$1", { literal: "'" }],
              postprocess: function(e) {
                return e[1].join("");
              }
            },
            { name: "dstrchar", symbols: [/[^\\"\n]/], postprocess: s },
            {
              name: "dstrchar",
              symbols: ["backslash", "strescape"],
              postprocess: function(e) {
                return JSON.parse('"' + e.join("") + '"');
              }
            },
            {
              name: "dstrchar$string$1",
              symbols: [{ literal: "\\" }, { literal: '"' }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "dstrchar",
              symbols: ["dstrchar$string$1"],
              postprocess: function(e) {
                return '"';
              }
            },
            { name: "sstrchar", symbols: [/[^\\'\n]/], postprocess: s },
            {
              name: "sstrchar",
              symbols: ["backslash", "strescape"],
              postprocess: function(e) {
                return JSON.parse('"' + e.join("") + '"');
              }
            },
            {
              name: "sstrchar$string$1",
              symbols: [{ literal: "\\" }, { literal: "'" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "sstrchar",
              symbols: ["sstrchar$string$1"],
              postprocess: function(e) {
                return "'";
              }
            },
            { name: "ndstrchar", symbols: [/[^\\"\n]/], postprocess: s },
            {
              name: "ndstrchar",
              symbols: ["backslash", "unicode"],
              postprocess: function(e) {
                return JSON.parse('"' + e.join("") + '"');
              }
            },
            {
              name: "ndstrchar$string$1",
              symbols: [{ literal: "\\" }, { literal: '"' }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "ndstrchar",
              symbols: ["ndstrchar$string$1"],
              postprocess: function(e) {
                return '\\"';
              }
            },
            { name: "ndstrchar", symbols: ["backslash"], postprocess: s },
            { name: "nsstrchar", symbols: [/[^\\'\n]/], postprocess: s },
            {
              name: "nsstrchar",
              symbols: ["backslash", "unicode"],
              postprocess: function(e) {
                return JSON.parse('"' + e.join("") + '"');
              }
            },
            {
              name: "nsstrchar$string$1",
              symbols: [{ literal: "\\" }, { literal: "'" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "nsstrchar",
              symbols: ["nsstrchar$string$1"],
              postprocess: function(e) {
                return "\\'";
              }
            },
            { name: "nsstrchar", symbols: ["backslash"], postprocess: s },
            { name: "strescape", symbols: [/["\\/bfnrt]/], postprocess: s },
            { name: "strescape", symbols: ["unicode"], postprocess: s },
            {
              name: "backslash",
              symbols: [{ literal: "\\" }],
              postprocess: function(e) {
                return "\\";
              }
            },
            {
              name: "unicode",
              symbols: [
                { literal: "u" },
                /[a-fA-F0-9]/,
                /[a-fA-F0-9]/,
                /[a-fA-F0-9]/,
                /[a-fA-F0-9]/
              ],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "_$ebnf$1", symbols: [] },
            {
              name: "_$ebnf$1",
              symbols: ["_$ebnf$1", /[\s]/],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            { name: "_", symbols: ["_$ebnf$1"], postprocess: null },
            { name: "value", symbols: ["object"], postprocess: s },
            { name: "value", symbols: ["array"], postprocess: s },
            { name: "value", symbols: ["primitive"], postprocess: s },
            { name: "primitive", symbols: ["number"], postprocess: s },
            { name: "primitive", symbols: ["string"], postprocess: s },
            {
              name: "primitive$string$1",
              symbols: [
                { literal: "t" },
                { literal: "r" },
                { literal: "u" },
                { literal: "e" }
              ],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "primitive",
              symbols: ["primitive$string$1"],
              postprocess: function() {
                return !0;
              }
            },
            {
              name: "primitive$string$2",
              symbols: [
                { literal: "f" },
                { literal: "a" },
                { literal: "l" },
                { literal: "s" },
                { literal: "e" }
              ],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "primitive",
              symbols: ["primitive$string$2"],
              postprocess: function() {
                return !1;
              }
            },
            {
              name: "primitive$string$3",
              symbols: [
                { literal: "n" },
                { literal: "u" },
                { literal: "l" },
                { literal: "l" }
              ],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "primitive",
              symbols: ["primitive$string$3"],
              postprocess: function() {
                return null;
              }
            },
            {
              name: "query",
              symbols: ["_", "trimmed", "_"],
              postprocess: function(e) {
                return e[1];
              }
            },
            { name: "trimmed", symbols: ["compositeElement"], postprocess: s },
            { name: "trimmed", symbols: ["function"], postprocess: s },
            {
              name: "function",
              symbols: ["unary", "br", "arithmeticElements", "BR"],
              postprocess: u
            },
            {
              name: "function",
              symbols: ["unary", "br", "oneElement", "BR"],
              postprocess: u
            },
            {
              name: "function",
              symbols: ["binary", "br", "twoElements", "BR"],
              postprocess: u
            },
            {
              name: "function",
              symbols: ["n_ary", "br", "commaSeparatedElements", "BR"],
              postprocess: u
            },
            {
              name: "function$string$1",
              symbols: [{ literal: "m" }, { literal: "a" }, { literal: "p" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "function",
              symbols: ["function$string$1", "br", "map_func_args", "BR"],
              postprocess: u
            },
            {
              name: "oneElement",
              symbols: ["arithmeticElement"],
              postprocess: function(e) {
                var t = e[0];
                return Array.isArray(t) ? t : [t];
              }
            },
            {
              name: "twoElements",
              symbols: ["compositeElement", "comma", "compositeElement"],
              postprocess: function(e) {
                return [e[0], e[2]];
              }
            },
            { name: "commaSeparatedElements$ebnf$1", symbols: [] },
            {
              name: "commaSeparatedElements$ebnf$1$subexpression$1",
              symbols: ["comma", "compositeElement"]
            },
            {
              name: "commaSeparatedElements$ebnf$1",
              symbols: [
                "commaSeparatedElements$ebnf$1",
                "commaSeparatedElements$ebnf$1$subexpression$1"
              ],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "commaSeparatedElements",
              symbols: ["compositeElement", "commaSeparatedElements$ebnf$1"],
              postprocess: function(e) {
                var t = [e[0]];
                for (var n in e[1]) t.push(e[1][n][1]);
                return t;
              }
            },
            {
              name: "arithmeticElements$ebnf$1$subexpression$1",
              symbols: ["operator", "arithmeticElement"]
            },
            {
              name: "arithmeticElements$ebnf$1",
              symbols: ["arithmeticElements$ebnf$1$subexpression$1"]
            },
            {
              name: "arithmeticElements$ebnf$1$subexpression$2",
              symbols: ["operator", "arithmeticElement"]
            },
            {
              name: "arithmeticElements$ebnf$1",
              symbols: [
                "arithmeticElements$ebnf$1",
                "arithmeticElements$ebnf$1$subexpression$2"
              ],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "arithmeticElements",
              symbols: ["arithmeticElement", "arithmeticElements$ebnf$1"],
              postprocess: function(e) {
                var t = Array.isArray(e[0]) ? r(e[0]) : [e[0]];
                for (var n in e[1]) {
                  var s = [].concat.apply([], e[1][n]);
                  t.push.apply(t, s);
                }
                return t;
              }
            },
            {
              name: "map_func_args",
              symbols: [
                "compositeElement",
                { literal: "," },
                "array",
                { literal: "," },
                "array",
                "comma",
                "number"
              ],
              postprocess: function(e) {
                return e.filter(function(e) {
                  return "," !== e;
                });
              }
            },
            {
              name: "compositeElement",
              symbols: ["arithmeticElement"],
              postprocess: s
            },
            {
              name: "compositeElement",
              symbols: ["arithmeticElements"],
              postprocess: s
            },
            {
              name: "arithmeticElement$ebnf$1$subexpression$1",
              symbols: ["unary_operator"]
            },
            {
              name: "arithmeticElement$ebnf$1",
              symbols: ["arithmeticElement$ebnf$1$subexpression$1"],
              postprocess: s
            },
            {
              name: "arithmeticElement$ebnf$1",
              symbols: [],
              postprocess: function() {
                return null;
              }
            },
            {
              name: "arithmeticElement",
              symbols: ["arithmeticElement$ebnf$1", "element"],
              postprocess: function(e) {
                var t = e[0],
                  n = e[1];
                return t ? [t[0], n] : n;
              }
            },
            { name: "element", symbols: ["function"], postprocess: s },
            {
              name: "element",
              symbols: ["type", "condition"],
              postprocess: function(e) {
                return { type: e[0], query: e[1] };
              }
            },
            {
              name: "element",
              symbols: ["number"],
              postprocess: function(e) {
                return { constant: e[0] };
              }
            },
            {
              name: "element$string$1",
              symbols: [{ literal: "p" }, { literal: "i" }, { literal: "(" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "element",
              symbols: ["element$string$1", "_", { literal: ")" }],
              postprocess: function(e) {
                return { constant: e[0] + e[2] };
              }
            },
            {
              name: "type$string$1",
              symbols: [{ literal: "t" }, { literal: "s" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "type", symbols: ["type$string$1"], postprocess: s },
            {
              name: "type$string$2",
              symbols: [{ literal: "T" }, { literal: "S" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "type",
              symbols: ["type$string$2"],
              postprocess: function(e) {
                return e[0].toLowerCase();
              }
            },
            { name: "condition", symbols: ["curl", "CURL"], postprocess: o },
            { name: "condition$ebnf$1", symbols: [] },
            {
              name: "condition$ebnf$1$subexpression$1",
              symbols: ["comma", "pair"]
            },
            {
              name: "condition$ebnf$1",
              symbols: ["condition$ebnf$1", "condition$ebnf$1$subexpression$1"],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "condition",
              symbols: ["curl", "pair", "condition$ebnf$1", "CURL"],
              postprocess: function(e) {
                if (!e.length) return [];
                var t = [i(e[1])];
                for (var n in e[2]) t.push(i(e[2][n][1]));
                return t;
              }
            },
            { name: "string", symbols: ["sqstring"], postprocess: s },
            { name: "string", symbols: ["dqstring"], postprocess: s },
            { name: "string", symbols: ["variable"], postprocess: s },
            { name: "regexp_string", symbols: ["sqregexp"], postprocess: s },
            { name: "regexp_string", symbols: ["dqregexp"], postprocess: s },
            { name: "regexp_string", symbols: ["variable"], postprocess: s },
            { name: "array", symbols: ["sqr", "SQR"], postprocess: o },
            { name: "array$ebnf$1", symbols: [] },
            {
              name: "array$ebnf$1$subexpression$1",
              symbols: ["comma", "value"]
            },
            {
              name: "array$ebnf$1",
              symbols: ["array$ebnf$1", "array$ebnf$1$subexpression$1"],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "array",
              symbols: ["sqr", "value", "array$ebnf$1", "SQR"],
              postprocess: function(e) {
                var t = [e[1]];
                for (var n in e[2]) t.push(e[2][n][1]);
                return t;
              }
            },
            {
              name: "object",
              symbols: ["curl", "CURL"],
              postprocess: function() {
                return {};
              }
            },
            { name: "object$ebnf$1", symbols: [] },
            {
              name: "object$ebnf$1$subexpression$1",
              symbols: ["comma", "pair"]
            },
            {
              name: "object$ebnf$1",
              symbols: ["object$ebnf$1", "object$ebnf$1$subexpression$1"],
              postprocess: function(e) {
                return e[0].concat([e[1]]);
              }
            },
            {
              name: "object",
              symbols: ["curl", "pair", "object$ebnf$1", "CURL"],
              postprocess: function(e) {
                var t = [i(e[1])];
                for (var n in e[2]) t.push(i(e[2][n][1]));
                return t;
              }
            },
            {
              name: "pair",
              symbols: ["prop_name", "_", "equals", "_", "value"],
              postprocess: function(e) {
                return [e[0], e[2], e[4]];
              }
            },
            {
              name: "pair",
              symbols: ["prop_name", "_", "not_equals", "_", "primitive"],
              postprocess: function(e) {
                return [e[0], e[2], e[4]];
              }
            },
            {
              name: "pair",
              symbols: ["prop_name", "_", "regexp", "_", "regexp_string"],
              postprocess: function(e) {
                return [e[0], e[2], e[4]];
              }
            },
            {
              name: "variable",
              symbols: [{ literal: "$" }, "prop_name"],
              postprocess: a
            },
            {
              name: "variable$string$1",
              symbols: [{ literal: "[" }, { literal: "[" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "variable$string$2",
              symbols: [{ literal: "]" }, { literal: "]" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            {
              name: "variable",
              symbols: ["variable$string$1", "prop_name", "variable$string$2"],
              postprocess: a
            },
            {
              name: "variable",
              symbols: [{ literal: "$" }, "advanced_variable"],
              postprocess: a
            },
            {
              name: "advanced_variable",
              symbols: [
                { literal: "{" },
                "prop_name",
                { literal: ":" },
                "prop_name",
                { literal: "}" }
              ],
              postprocess: a
            },
            {
              name: "unary_operator",
              symbols: ["_", { literal: "-" }, "_"],
              postprocess: l
            },
            {
              name: "operator",
              symbols: ["_", { literal: "+" }, "_"],
              postprocess: l
            },
            {
              name: "operator",
              symbols: ["_", { literal: "-" }, "_"],
              postprocess: l
            },
            {
              name: "operator",
              symbols: ["_", { literal: "/" }, "_"],
              postprocess: l
            },
            {
              name: "operator",
              symbols: ["_", { literal: "*" }, "_"],
              postprocess: l
            },
            {
              name: "comma",
              symbols: ["_", { literal: "," }, "_"],
              postprocess: function(e) {
                return e[1];
              }
            },
            {
              name: "unary$string$1",
              symbols: [{ literal: "s" }, { literal: "i" }, { literal: "n" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "unary", symbols: ["unary$string$1"], postprocess: s },
            {
              name: "unary$string$2",
              symbols: [{ literal: "c" }, { literal: "o" }, { literal: "s" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "unary", symbols: ["unary$string$2"], postprocess: s },
            {
              name: "unary$string$3",
              symbols: [{ literal: "l" }, { literal: "n" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "unary", symbols: ["unary$string$3"], postprocess: s },
            {
              name: "unary$string$4",
              symbols: [
                { literal: "s" },
                { literal: "q" },
                { literal: "r" },
                { literal: "t" }
              ],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "unary", symbols: ["unary$string$4"], postprocess: s },
            {
              name: "unary$string$5",
              symbols: [{ literal: "e" }, { literal: "x" }, { literal: "p" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "unary", symbols: ["unary$string$5"], postprocess: s },
            {
              name: "unary$string$6",
              symbols: [{ literal: "a" }, { literal: "b" }, { literal: "s" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "unary", symbols: ["unary$string$6"], postprocess: s },
            { name: "unary", symbols: [], postprocess: s },
            {
              name: "binary$string$1",
              symbols: [{ literal: "p" }, { literal: "o" }, { literal: "w" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "binary", symbols: ["binary$string$1"], postprocess: s },
            {
              name: "binary$string$2",
              symbols: [
                { literal: "r" },
                { literal: "o" },
                { literal: "u" },
                { literal: "n" },
                { literal: "d" }
              ],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "binary", symbols: ["binary$string$2"], postprocess: s },
            {
              name: "binary$string$3",
              symbols: [
                { literal: "o" },
                { literal: "n" },
                { literal: "_" },
                { literal: "e" },
                { literal: "r" },
                { literal: "r" },
                { literal: "o" },
                { literal: "r" }
              ],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "binary", symbols: ["binary$string$3"], postprocess: s },
            {
              name: "n_ary$string$1",
              symbols: [{ literal: "m" }, { literal: "a" }, { literal: "x" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "n_ary", symbols: ["n_ary$string$1"], postprocess: s },
            {
              name: "n_ary$string$2",
              symbols: [{ literal: "m" }, { literal: "i" }, { literal: "n" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "n_ary", symbols: ["n_ary$string$2"], postprocess: s },
            {
              name: "n_ary$string$3",
              symbols: [{ literal: "a" }, { literal: "v" }, { literal: "g" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "n_ary", symbols: ["n_ary$string$3"], postprocess: s },
            {
              name: "n_ary$string$4",
              symbols: [{ literal: "s" }, { literal: "u" }, { literal: "m" }],
              postprocess: function(e) {
                return e.join("");
              }
            },
            { name: "n_ary", symbols: ["n_ary$string$4"], postprocess: s },
            { name: "br", symbols: ["_", { literal: "(" }], postprocess: null },
            { name: "BR", symbols: ["_", { literal: ")" }], postprocess: null },
            {
              name: "curl",
              symbols: ["_", { literal: "{" }],
              postprocess: null
            },
            {
              name: "CURL",
              symbols: ["_", { literal: "}" }],
              postprocess: null
            },
            {
              name: "sqr",
              symbols: ["_", { literal: "[" }],
              postprocess: null
            },
            { name: "SQR", symbols: ["_", { literal: "]" }], postprocess: null }
          ],
          ParserStart: "query"
        };
      t.default = c;
    },
    function(e, t, n) {
      "use strict";
      var r = function() {
          return (r =
            Object.assign ||
            function(e) {
              for (var t, n = 1, r = arguments.length; n < r; n++)
                for (var s in (t = arguments[n]))
                  Object.prototype.hasOwnProperty.call(t, s) && (e[s] = t[s]);
              return e;
            }).apply(this, arguments);
        },
        s = function(e, t, n, r) {
          return new (n || (n = Promise))(function(s, o) {
            function a(e) {
              try {
                l(r.next(e));
              } catch (e) {
                o(e);
              }
            }
            function i(e) {
              try {
                l(r.throw(e));
              } catch (e) {
                o(e);
              }
            }
            function l(e) {
              var t;
              e.done
                ? s(e.value)
                : ((t = e.value),
                  t instanceof n
                    ? t
                    : new n(function(e) {
                        e(t);
                      })).then(a, i);
            }
            l((r = r.apply(e, t || [])).next());
          });
        },
        o = function(e, t) {
          var n,
            r,
            s,
            o,
            a = {
              label: 0,
              sent: function() {
                if (1 & s[0]) throw s[1];
                return s[1];
              },
              trys: [],
              ops: []
            };
          return (
            (o = { next: i(0), throw: i(1), return: i(2) }),
            "function" == typeof Symbol &&
              (o[Symbol.iterator] = function() {
                return this;
              }),
            o
          );
          function i(o) {
            return function(i) {
              return (function(o) {
                if (n) throw new TypeError("Generator is already executing.");
                for (; a; )
                  try {
                    if (
                      ((n = 1),
                      r &&
                        (s =
                          2 & o[0]
                            ? r.return
                            : o[0]
                            ? r.throw || ((s = r.return) && s.call(r), 0)
                            : r.next) &&
                        !(s = s.call(r, o[1])).done)
                    )
                      return s;
                    switch (((r = 0), s && (o = [2 & o[0], s.value]), o[0])) {
                      case 0:
                      case 1:
                        s = o;
                        break;
                      case 4:
                        return a.label++, { value: o[1], done: !1 };
                      case 5:
                        a.label++, (r = o[1]), (o = [0]);
                        continue;
                      case 7:
                        (o = a.ops.pop()), a.trys.pop();
                        continue;
                      default:
                        if (
                          !((s = a.trys),
                          (s = s.length > 0 && s[s.length - 1]) ||
                            (6 !== o[0] && 2 !== o[0]))
                        ) {
                          a = 0;
                          continue;
                        }
                        if (
                          3 === o[0] &&
                          (!s || (o[1] > s[0] && o[1] < s[3]))
                        ) {
                          a.label = o[1];
                          break;
                        }
                        if (6 === o[0] && a.label < s[1]) {
                          (a.label = s[1]), (s = o);
                          break;
                        }
                        if (s && a.label < s[2]) {
                          (a.label = s[2]), a.ops.push(o);
                          break;
                        }
                        s[2] && a.ops.pop(), a.trys.pop();
                        continue;
                    }
                    o = t.call(e, a);
                  } catch (e) {
                    (o = [6, e]), (r = 0);
                  } finally {
                    n = s = 0;
                  }
                if (5 & o[0]) throw o[1];
                return { value: o[0] ? o[1] : void 0, done: !0 };
              })([o, i]);
            };
          }
        },
        a = function(e, t) {
          var n = {};
          for (var r in e)
            Object.prototype.hasOwnProperty.call(e, r) &&
              t.indexOf(r) < 0 &&
              (n[r] = e[r]);
          if (null != e && "function" == typeof Object.getOwnPropertySymbols) {
            var s = 0;
            for (r = Object.getOwnPropertySymbols(e); s < r.length; s++)
              t.indexOf(r[s]) < 0 &&
                Object.prototype.propertyIsEnumerable.call(e, r[s]) &&
                (n[r[s]] = e[r[s]]);
          }
          return n;
        },
        i = function() {
          for (var e = 0, t = 0, n = arguments.length; t < n; t++)
            e += arguments[t].length;
          var r = Array(e),
            s = 0;
          for (t = 0; t < n; t++)
            for (var o = arguments[t], a = 0, i = o.length; a < i; a++, s++)
              r[s] = o[a];
          return r;
        },
        l = function(e) {
          return e && e.__esModule ? e : { default: e };
        };
      Object.defineProperty(t, "__esModule", { value: !0 }),
        (t.Connector = void 0);
      var u = n(1),
        c = n(2),
        p = n(0),
        f = n(4),
        m = l(n(10)),
        b = (function() {
          function e(e, t, n) {
            var r = this;
            (this.project = e),
              (this.apiUrl = t),
              (this.backendSrv = n),
              (this.cachedRequests = new Map()),
              (this.cachedRequest = function(e, t) {
                return (
                  void 0 === t && (t = f.CacheTime.Default),
                  s(r, void 0, void 0, function() {
                    var n,
                      r,
                      i,
                      l,
                      c = this;
                    return o(this, function(p) {
                      return (
                        e.requestId,
                        (n = a(e, ["requestId"])),
                        (r = JSON.stringify(n)),
                        (i = m.default(t)),
                        this.cachedRequests.has(r)
                          ? [2, this.cachedRequests.get(r)]
                          : ((l = s(c, void 0, void 0, function() {
                              var t,
                                n,
                                s = this;
                              return o(this, function(o) {
                                switch (o.label) {
                                  case 0:
                                    return (
                                      o.trys.push([0, 2, , 3]),
                                      [4, this.backendSrv.datasourceRequest(e)]
                                    );
                                  case 1:
                                    if (((t = o.sent()), u.isError(t))) throw t;
                                    return (
                                      setTimeout(function() {
                                        return s.cachedRequests.delete(r);
                                      }, i),
                                      [2, t]
                                    );
                                  case 2:
                                    throw ((n = o.sent()),
                                    this.cachedRequests.delete(r),
                                    n);
                                  case 3:
                                    return [2];
                                }
                              });
                            })),
                            this.cachedRequests.set(r, l),
                            [2, l])
                      );
                    });
                  })
                );
              });
          }
          return (
            (e.prototype.fetchData = function(e) {
              var t = e.path,
                n = e.data,
                r = e.method,
                s = e.params,
                o = e.requestId,
                a = e.cacheTime,
                i = s ? "?" + c.getQueryString(s) : "",
                l = {
                  url: this.apiUrl + "/cogniteapi/" + this.project + t + i,
                  data: n,
                  method: r
                };
              return o && (l.requestId = o), this.cachedRequest(l, a);
            }),
            (e.prototype.chunkAndFetch = function(e, t) {
              return (
                void 0 === t && (t = 100),
                s(this, void 0, void 0, function() {
                  var n,
                    s,
                    a,
                    l,
                    u,
                    c,
                    f,
                    m = this;
                  return o(this, function(o) {
                    switch (o.label) {
                      case 0:
                        return (
                          (n = e.data),
                          (s = e.requestId),
                          (a = p.chunk(n.items, t)),
                          (l = a.map(function(t, o) {
                            return r(r(r({}, e), d(s, o)), {
                              data: r(r({}, n), { items: t })
                            });
                          })),
                          (u = l.map(function(e) {
                            return m.fetchData(e);
                          })),
                          [4, Promise.all(u)]
                        );
                      case 1:
                        return (
                          (c = o.sent()),
                          (f = c.reduce(function(e, t) {
                            var n = t.data;
                            return i(e, n.items);
                          }, [])),
                          [
                            2,
                            r(r({}, c[0]), {
                              data: r(r({}, c[0].data), { items: f })
                            })
                          ]
                        );
                    }
                  });
                })
              );
            }),
            (e.prototype.fetchItems = function(e) {
              return s(this, void 0, void 0, function() {
                return o(this, function(t) {
                  switch (t.label) {
                    case 0:
                      return [4, this.fetchData(e)];
                    case 1:
                      return [2, t.sent().data.items];
                  }
                });
              });
            }),
            (e.prototype.fetchAndPaginate = function(e) {
              return s(this, void 0, void 0, function() {
                var t, n, s, a, l, u, c;
                return o(this, function(o) {
                  switch (o.label) {
                    case 0:
                      return (
                        (t = 1e3),
                        (n = e.data),
                        (s = n.limit || t),
                        [
                          4,
                          this.fetchData(
                            r(r({}, e), {
                              data: r(r({}, n), { limit: Math.min(t, s) })
                            })
                          )
                        ]
                      );
                    case 1:
                      (a = o.sent().data),
                        (l = a.nextCursor),
                        (u = a.items),
                        (o.label = 2);
                    case 2:
                      return l && s > u.length
                        ? [
                            4,
                            this.fetchData(
                              r(r({}, e), {
                                data: r(r({}, n), { cursor: l, limit: t })
                              })
                            )
                          ]
                        : [3, 4];
                    case 3:
                      return (
                        (c = o.sent().data),
                        (l = c.nextCursor),
                        (u = i(u, c.items)),
                        [3, 2]
                      );
                    case 4:
                      return u.length > s && (u.length = s), [2, u];
                  }
                });
              });
            }),
            (e.prototype.request = function(e) {
              var t = e.path,
                n = e.method,
                r = void 0 === n ? u.HttpMethod.GET : n;
              return this.backendSrv.datasourceRequest({
                method: r,
                url: this.apiUrl + "/" + t
              });
            }),
            e
          );
        })();
      t.Connector = b;
      var d = function(e, t) {
        return e ? { requestId: t ? "" + e + t : e } : void 0;
      };
    },
    function(e, t, n) {
      "use strict";
      var r,
        s = ((r = function(e, t) {
          return (r =
            Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array &&
              function(e, t) {
                e.__proto__ = t;
              }) ||
            function(e, t) {
              for (var n in t) t.hasOwnProperty(n) && (e[n] = t[n]);
            })(e, t);
        }),
        function(e, t) {
          function n() {
            this.constructor = e;
          }
          r(e, t),
            (e.prototype =
              null === t
                ? Object.create(t)
                : ((n.prototype = t.prototype), new n()));
        }),
        o = function(e) {
          return e && e.__esModule ? e : { default: e };
        };
      Object.defineProperty(t, "__esModule", { value: !0 }),
        (t.CogniteQueryCtrl = void 0);
      var a = o(n(0)),
        i = n(34),
        l = n(8);
      n(35);
      var u = n(1),
        c = n(4),
        p = (function(e) {
          function t(t, n, r) {
            var s = e.call(this, t, n) || this;
            return (
              (s.templateSrv = r),
              (s.aggregation = [
                { value: "none", name: "None" },
                { value: "average", name: "Average" },
                { value: "max", name: "Max" },
                { value: "min", name: "Min" },
                { value: "count", name: "Count" },
                { value: "sum", name: "Sum" },
                { value: "interpolation", name: "Interpolation" },
                { value: "stepInterpolation", name: "Step Interpolation" },
                { value: "continuousVariance", name: "Continuous Variance" },
                { value: "discreteVariance", name: "Discrete Variance" },
                { value: "totalVariation", name: "Total Variation" }
              ]),
              (s.customTabAggregation = [
                { value: "none", name: "None" },
                { value: "average", name: "Average" },
                { value: "interpolation", name: "Interpolation" },
                { value: "stepInterpolation", name: "Step Interpolation" }
              ]),
              (s.tabs = [
                {
                  value: u.Tab.Timeseries,
                  name: "Select Timeseries",
                  src: "timeseriestab.html"
                },
                {
                  value: u.Tab.Asset,
                  name: "Select Timeseries from Asset",
                  src: "assettab.html"
                },
                {
                  value: u.Tab.Custom,
                  name: "Custom Query",
                  src: "customtab.html"
                }
              ]),
              (s.defaults = {
                target: "",
                type: "timeserie",
                aggregation: "average",
                granularity: "",
                label: "",
                tab: u.Tab.Timeseries,
                expr: "",
                assetQuery: { target: "", old: void 0, includeSubtrees: !1 }
              }),
              (s.handleWarning = function(e) {
                var t = e.refId,
                  n = e.warning;
                s.target.refId === t && (s.target.warning = n);
              }),
              (s.handleError = function(e) {
                var t = e.refId,
                  n = e.error;
                s.target.refId === t && (s.target.error = n);
              }),
              a.default.defaultsDeep(s.target, s.defaults),
              (s.currentTabIndex =
                s.tabs.findIndex(function(e) {
                  return e.value === s.target.tab;
                }) || 0),
              l.appEvents.on(c.failedResponseEvent, s.handleError),
              l.appEvents.on(c.datapointsWarningEvent, s.handleWarning),
              s
            );
          }
          return (
            s(t, e),
            (t.$inject = ["$scope", "$injector", "templateSrv"]),
            (t.prototype.getOptions = function(e, t) {
              var n = this;
              return this.datasource
                .getOptionsForDropdown(e || "", t)
                .then(function(e) {
                  return (
                    a.default.defer(function() {
                      return n.$scope.$digest();
                    }),
                    e
                  );
                });
            }),
            (t.prototype.refreshData = function() {
              this.onChangeQuery(), this.refresh();
            }),
            (t.prototype.onChangeQuery = function() {
              this.target.error && (this.target.error = ""),
                this.target.warning && (this.target.warning = "");
            }),
            (t.prototype.changeTab = function(e) {
              (this.currentTabIndex = e),
                (this.target.tab = this.tabs[e].value),
                this.refresh();
            }),
            (t.prototype.getCollapsedText = function() {
              return this.target.tab === u.Tab.Timeseries
                ? "Timeseries: " + this.target.target + " " + this.target.error
                : this.target.tab === u.Tab.Asset
                ? "Timeseries from Asset: " +
                  this.target.assetQuery.target +
                  " " +
                  this.target.error
                : this.target.tab === u.Tab.Custom
                ? "Custom Query: " + this.target.expr + " " + this.target.error
                : "";
            }),
            (t.prototype.getInitAggregate = function() {
              -1 ===
                a.default.findIndex(this.customTabAggregation, [
                  "value",
                  this.target.aggregation
                ]) &&
                ((this.target.aggregation = this.customTabAggregation[0].value),
                this.refresh());
            }),
            (t.prototype.$onDestroy = function() {
              l.appEvents.off(c.failedResponseEvent, this.handleError),
                l.appEvents.off(c.datapointsWarningEvent, this.handleWarning);
            }),
            (t.templateUrl = "partials/query.editor.html"),
            t
          );
        })(i.QueryCtrl);
      t.CogniteQueryCtrl = p;
    },
    function(e, t) {
      e.exports = r;
    },
    function(e, t, n) {
      var r = n(36);
      "string" == typeof r && (r = [[e.i, r, ""]]);
      var s = { hmr: !0, transform: void 0, insertInto: void 0 };
      n(38)(r, s);
      r.locals && (e.exports = r.locals);
    },
    function(e, t, n) {
      (e.exports = n(37)(!0)).push([
        e.i,
        ".min-width-10 {\n  min-width: 10rem;\n}\n\n.min-width-12 {\n  min-width: 12rem;\n}\n\n.min-width-20 {\n  min-width: 20rem;\n}\n\n.gf-form-select-wrapper select.gf-form-input {\n  height: 2.64rem;\n}\n\n.gf-form-select-wrapper--caret-indent.gf-form-select-wrapper::after {\n  right: 0.775rem;\n}\n\n.gf-tabs-cognite.active:before,\n.gf-tabs-cognite.active:focus:before,\n.gf-tabs-cognite.active:hover:before {\n  background-image: linear-gradient(90deg, #33b5e5 0, #00b3ff 99%, #1b1b1b);\n}\n\ninput[type='checkbox'] {\n  margin: 4px;\n}\n\n.custom-query {\n  font-family: monospace;\n}\n\npre code {\n  line-height: 2;\n}\n\n.cognite-timeseries-list-checkbox {\n  margin-right: 10px;\n}\n\n.gf-dropdown-wrapper {\n  min-width: 200px;\n}\n\npre.gf-formatted-error,\npre.gf-formatted-warning {\n  background: transparent;\n  border: none;\n  padding-bottom: 0;\n  color: #ff6060;\n}\n\npre.gf-formatted-warning {\n  color: #f79520;\n}\n",
        "",
        {
          version: 3,
          sources: ["query_editor.css"],
          names: [],
          mappings:
            "AAAA;EACE,gBAAgB;AAClB;;AAEA;EACE,gBAAgB;AAClB;;AAEA;EACE,gBAAgB;AAClB;;AAEA;EACE,eAAe;AACjB;;AAEA;EACE,eAAe;AACjB;;AAEA;;;EAGE,yEAAyE;AAC3E;;AAEA;EACE,WAAW;AACb;;AAEA;EACE,sBAAsB;AACxB;;AAEA;EACE,cAAc;AAChB;;AAEA;EACE,kBAAkB;AACpB;;AAEA;EACE,gBAAgB;AAClB;;AAEA;;EAEE,uBAAuB;EACvB,YAAY;EACZ,iBAAiB;EACjB,cAAc;AAChB;;AAEA;EACE,cAAc;AAChB",
          file: "query_editor.css",
          sourcesContent: [
            ".min-width-10 {\n  min-width: 10rem;\n}\n\n.min-width-12 {\n  min-width: 12rem;\n}\n\n.min-width-20 {\n  min-width: 20rem;\n}\n\n.gf-form-select-wrapper select.gf-form-input {\n  height: 2.64rem;\n}\n\n.gf-form-select-wrapper--caret-indent.gf-form-select-wrapper::after {\n  right: 0.775rem;\n}\n\n.gf-tabs-cognite.active:before,\n.gf-tabs-cognite.active:focus:before,\n.gf-tabs-cognite.active:hover:before {\n  background-image: linear-gradient(90deg, #33b5e5 0, #00b3ff 99%, #1b1b1b);\n}\n\ninput[type='checkbox'] {\n  margin: 4px;\n}\n\n.custom-query {\n  font-family: monospace;\n}\n\npre code {\n  line-height: 2;\n}\n\n.cognite-timeseries-list-checkbox {\n  margin-right: 10px;\n}\n\n.gf-dropdown-wrapper {\n  min-width: 200px;\n}\n\npre.gf-formatted-error,\npre.gf-formatted-warning {\n  background: transparent;\n  border: none;\n  padding-bottom: 0;\n  color: #ff6060;\n}\n\npre.gf-formatted-warning {\n  color: #f79520;\n}\n"
          ]
        }
      ]);
    },
    function(e, t, n) {
      "use strict";
      e.exports = function(e) {
        var t = [];
        return (
          (t.toString = function() {
            return this.map(function(t) {
              var n = (function(e, t) {
                var n = e[1] || "",
                  r = e[3];
                if (!r) return n;
                if (t && "function" == typeof btoa) {
                  var s = ((a = r),
                    "/*# sourceMappingURL=data:application/json;charset=utf-8;base64," +
                      btoa(unescape(encodeURIComponent(JSON.stringify(a)))) +
                      " */"),
                    o = r.sources.map(function(e) {
                      return "/*# sourceURL=" + r.sourceRoot + e + " */";
                    });
                  return [n]
                    .concat(o)
                    .concat([s])
                    .join("\n");
                }
                var a;
                return [n].join("\n");
              })(t, e);
              return t[2] ? "@media " + t[2] + "{" + n + "}" : n;
            }).join("");
          }),
          (t.i = function(e, n) {
            "string" == typeof e && (e = [[null, e, ""]]);
            for (var r = {}, s = 0; s < this.length; s++) {
              var o = this[s][0];
              null != o && (r[o] = !0);
            }
            for (s = 0; s < e.length; s++) {
              var a = e[s];
              (null != a[0] && r[a[0]]) ||
                (n && !a[2]
                  ? (a[2] = n)
                  : n && (a[2] = "(" + a[2] + ") and (" + n + ")"),
                t.push(a));
            }
          }),
          t
        );
      };
    },
    function(e, t, n) {
      var r,
        s,
        o = {},
        a = ((r = function() {
          return window && document && document.all && !window.atob;
        }),
        function() {
          return void 0 === s && (s = r.apply(this, arguments)), s;
        }),
        i = function(e, t) {
          return t ? t.querySelector(e) : document.querySelector(e);
        },
        l = (function(e) {
          var t = {};
          return function(e, n) {
            if ("function" == typeof e) return e();
            if (void 0 === t[e]) {
              var r = i.call(this, e, n);
              if (
                window.HTMLIFrameElement &&
                r instanceof window.HTMLIFrameElement
              )
                try {
                  r = r.contentDocument.head;
                } catch (e) {
                  r = null;
                }
              t[e] = r;
            }
            return t[e];
          };
        })(),
        u = null,
        c = 0,
        p = [],
        f = n(39);
      function m(e, t) {
        for (var n = 0; n < e.length; n++) {
          var r = e[n],
            s = o[r.id];
          if (s) {
            s.refs++;
            for (var a = 0; a < s.parts.length; a++) s.parts[a](r.parts[a]);
            for (; a < r.parts.length; a++) s.parts.push(g(r.parts[a], t));
          } else {
            var i = [];
            for (a = 0; a < r.parts.length; a++) i.push(g(r.parts[a], t));
            o[r.id] = { id: r.id, refs: 1, parts: i };
          }
        }
      }
      function b(e, t) {
        for (var n = [], r = {}, s = 0; s < e.length; s++) {
          var o = e[s],
            a = t.base ? o[0] + t.base : o[0],
            i = { css: o[1], media: o[2], sourceMap: o[3] };
          r[a] ? r[a].parts.push(i) : n.push((r[a] = { id: a, parts: [i] }));
        }
        return n;
      }
      function d(e, t) {
        var n = l(e.insertInto);
        if (!n)
          throw new Error(
            "Couldn't find a style target. This probably means that the value for the 'insertInto' parameter is invalid."
          );
        var r = p[p.length - 1];
        if ("top" === e.insertAt)
          r
            ? r.nextSibling
              ? n.insertBefore(t, r.nextSibling)
              : n.appendChild(t)
            : n.insertBefore(t, n.firstChild),
            p.push(t);
        else if ("bottom" === e.insertAt) n.appendChild(t);
        else {
          if ("object" != typeof e.insertAt || !e.insertAt.before)
            throw new Error(
              "[Style Loader]\n\n Invalid value for parameter 'insertAt' ('options.insertAt') found.\n Must be 'top', 'bottom', or Object.\n (https://github.com/webpack-contrib/style-loader#insertat)\n"
            );
          var s = l(e.insertAt.before, n);
          n.insertBefore(t, s);
        }
      }
      function h(e) {
        if (null === e.parentNode) return !1;
        e.parentNode.removeChild(e);
        var t = p.indexOf(e);
        t >= 0 && p.splice(t, 1);
      }
      function y(e) {
        var t = document.createElement("style");
        if (
          (void 0 === e.attrs.type && (e.attrs.type = "text/css"),
          void 0 === e.attrs.nonce)
        ) {
          var r = (function() {
            0;
            return n.nc;
          })();
          r && (e.attrs.nonce = r);
        }
        return $(t, e.attrs), d(e, t), t;
      }
      function $(e, t) {
        Object.keys(t).forEach(function(n) {
          e.setAttribute(n, t[n]);
        });
      }
      function g(e, t) {
        var n, r, s, o;
        if (t.transform && e.css) {
          if (
            !(o =
              "function" == typeof t.transform
                ? t.transform(e.css)
                : t.transform.default(e.css))
          )
            return function() {};
          e.css = o;
        }
        if (t.singleton) {
          var a = c++;
          (n = u || (u = y(t))),
            (r = j.bind(null, n, a, !1)),
            (s = j.bind(null, n, a, !0));
        } else
          e.sourceMap &&
          "function" == typeof URL &&
          "function" == typeof URL.createObjectURL &&
          "function" == typeof URL.revokeObjectURL &&
          "function" == typeof Blob &&
          "function" == typeof btoa
            ? ((n = (function(e) {
                var t = document.createElement("link");
                return (
                  void 0 === e.attrs.type && (e.attrs.type = "text/css"),
                  (e.attrs.rel = "stylesheet"),
                  $(t, e.attrs),
                  d(e, t),
                  t
                );
              })(t)),
              (r = w.bind(null, n, t)),
              (s = function() {
                h(n), n.href && URL.revokeObjectURL(n.href);
              }))
            : ((n = y(t)),
              (r = E.bind(null, n)),
              (s = function() {
                h(n);
              }));
        return (
          r(e),
          function(t) {
            if (t) {
              if (
                t.css === e.css &&
                t.media === e.media &&
                t.sourceMap === e.sourceMap
              )
                return;
              r((e = t));
            } else s();
          }
        );
      }
      e.exports = function(e, t) {
        if ("undefined" != typeof DEBUG && DEBUG && "object" != typeof document)
          throw new Error(
            "The style-loader cannot be used in a non-browser environment"
          );
        ((t = t || {}).attrs = "object" == typeof t.attrs ? t.attrs : {}),
          t.singleton || "boolean" == typeof t.singleton || (t.singleton = a()),
          t.insertInto || (t.insertInto = "head"),
          t.insertAt || (t.insertAt = "bottom");
        var n = b(e, t);
        return (
          m(n, t),
          function(e) {
            for (var r = [], s = 0; s < n.length; s++) {
              var a = n[s];
              (i = o[a.id]).refs--, r.push(i);
            }
            e && m(b(e, t), t);
            for (s = 0; s < r.length; s++) {
              var i;
              if (0 === (i = r[s]).refs) {
                for (var l = 0; l < i.parts.length; l++) i.parts[l]();
                delete o[i.id];
              }
            }
          }
        );
      };
      var v,
        x = ((v = []),
        function(e, t) {
          return (v[e] = t), v.filter(Boolean).join("\n");
        });
      function j(e, t, n, r) {
        var s = n ? "" : r.css;
        if (e.styleSheet) e.styleSheet.cssText = x(t, s);
        else {
          var o = document.createTextNode(s),
            a = e.childNodes;
          a[t] && e.removeChild(a[t]),
            a.length ? e.insertBefore(o, a[t]) : e.appendChild(o);
        }
      }
      function E(e, t) {
        var n = t.css,
          r = t.media;
        if ((r && e.setAttribute("media", r), e.styleSheet))
          e.styleSheet.cssText = n;
        else {
          for (; e.firstChild; ) e.removeChild(e.firstChild);
          e.appendChild(document.createTextNode(n));
        }
      }
      function w(e, t, n) {
        var r = n.css,
          s = n.sourceMap,
          o = void 0 === t.convertToAbsoluteUrls && s;
        (t.convertToAbsoluteUrls || o) && (r = f(r)),
          s &&
            (r +=
              "\n/*# sourceMappingURL=data:application/json;base64," +
              btoa(unescape(encodeURIComponent(JSON.stringify(s)))) +
              " */");
        var a = new Blob([r], { type: "text/css" }),
          i = e.href;
        (e.href = URL.createObjectURL(a)), i && URL.revokeObjectURL(i);
      }
    },
    function(e, t) {
      e.exports = function(e) {
        var t = "undefined" != typeof window && window.location;
        if (!t) throw new Error("fixUrls requires window.location");
        if (!e || "string" != typeof e) return e;
        var n = t.protocol + "//" + t.host,
          r = n + t.pathname.replace(/\/[^\/]*$/, "/");
        return e.replace(
          /url\s*\(((?:[^)(]|\((?:[^)(]+|\([^)(]*\))*\))*)\)/gi,
          function(e, t) {
            var s,
              o = t
                .trim()
                .replace(/^"(.*)"$/, function(e, t) {
                  return t;
                })
                .replace(/^'(.*)'$/, function(e, t) {
                  return t;
                });
            return /^(#|data:|http:\/\/|https:\/\/|file:\/\/\/|\s*$)/i.test(o)
              ? e
              : ((s =
                  0 === o.indexOf("//")
                    ? o
                    : 0 === o.indexOf("/")
                    ? n + o
                    : r + o.replace(/^\.\//, "")),
                "url(" + JSON.stringify(s) + ")");
          }
        );
      };
    },
    function(e, t, n) {
      "use strict";
      Object.defineProperty(t, "__esModule", { value: !0 }),
        (t.CogniteConfigCtrl = void 0);
      var r = (function() {
        function e(e) {}
        return (
          (e.$inject = ["$scope"]), (e.templateUrl = "partials/config.html"), e
        );
      })();
      t.CogniteConfigCtrl = r;
    },
    function(e, t, n) {
      "use strict";
      Object.defineProperty(t, "__esModule", { value: !0 }),
        (t.CogniteAnnotationsQueryCtrl = void 0);
      var r = n(3),
        s = (function() {
          function e() {}
          return (
            (e.prototype.onBlur = function() {
              this.annotation.error = "";
              try {
                var e = this.datasource.replaceVariable(this.annotation.query);
                r.parse(e);
              } catch (e) {
                var t = e.message;
                this.annotation.error = t;
              }
            }),
            (e.templateUrl = "partials/annotations.editor.html"),
            e
          );
        })();
      t.CogniteAnnotationsQueryCtrl = s;
    },
    function(e, t, n) {
      "use strict";
      var r,
        s = ((r = function(e, t) {
          return (r =
            Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array &&
              function(e, t) {
                e.__proto__ = t;
              }) ||
            function(e, t) {
              for (var n in t) t.hasOwnProperty(n) && (e[n] = t[n]);
            })(e, t);
        }),
        function(e, t) {
          function n() {
            this.constructor = e;
          }
          r(e, t),
            (e.prototype =
              null === t
                ? Object.create(t)
                : ((n.prototype = t.prototype), new n()));
        }),
        o = function(e) {
          return e && e.__esModule ? e : { default: e };
        };
      Object.defineProperty(t, "__esModule", { value: !0 }),
        (t.CogniteVariableQueryCtrl = void 0);
      var a = o(n(43)),
        i = n(3),
        l = a.default.createElement(
          "pre",
          null,
          "Variable query uses the",
          " ",
          a.default.createElement(
            "a",
            {
              className: "query-keyword",
              href: "https://docs.cognite.com/api/v1/#operation/listAssets",
              target: "_blank"
            },
            "assets/list"
          ),
          " ",
          "endpoint for data fetching. ",
          a.default.createElement(
            "code",
            { className: "query-keyword" },
            "'='"
          ),
          " sign is used to provide parameters for the request.",
          a.default.createElement("br", null),
          "Format: ",
          a.default.createElement(
            "code",
            { className: "query-keyword" },
            "assets{param=value,...}"
          ),
          a.default.createElement("br", null),
          "Example:",
          " ",
          a.default.createElement(
            "code",
            { className: "query-keyword" },
            "assets{assetSubtreeIds=[{id=123}, {externalId='external'}]"
          ),
          a.default.createElement("br", null),
          a.default.createElement("br", null),
          "Results filtering is also possible by adding ",
          a.default.createElement(
            "code",
            { className: "query-keyword" },
            "'=~'"
          ),
          ",",
          " ",
          a.default.createElement(
            "code",
            { className: "query-keyword" },
            "'!~'"
          ),
          " and ",
          a.default.createElement(
            "code",
            { className: "query-keyword" },
            "'!='"
          ),
          " ",
          "signs to props. Applying few filters for query acts as logic AND",
          a.default.createElement("br", null),
          "Format:",
          a.default.createElement("br", null),
          a.default.createElement(
            "code",
            { className: "query-keyword" },
            "'=~'"
          ),
          " – regex equality, means that provided regexp is used to match defined prop and matched value will be included",
          a.default.createElement("br", null),
          a.default.createElement(
            "code",
            { className: "query-keyword" },
            "'!~'"
          ),
          " – regex inequality, means that provided regexp is used to match defined prop and matched value will be excluded",
          a.default.createElement("br", null),
          a.default.createElement(
            "code",
            { className: "query-keyword" },
            "'!='"
          ),
          " – strict inequality, means that provided string is used to strict prop comparing and matched value will be excluded",
          a.default.createElement("br", null),
          "Example:",
          " ",
          a.default.createElement(
            "code",
            { className: "query-keyword" },
            "assets{metadata={KEY='value', KEY_2=~'value.*'}, assetSubtreeIds=[{id=123}]}"
          ),
          "To learn more about the querying capabilities of Cognite Data Source for Grafana, please visit our",
          " ",
          a.default.createElement(
            "a",
            {
              className: "query-keyword",
              href:
                "https://docs.cognite.com/cdf/dashboards/guides/grafana/getting_started.html"
            },
            "documentation"
          ),
          "."
        ),
        u = (function(e) {
          function t(t) {
            var n = e.call(this, t) || this;
            return (
              (n.defaults = { query: "", error: "" }),
              (n.handleQueryChange = function(e) {
                n.setState({ query: e.target.value, error: "" });
              }),
              (n.handleBlur = function() {
                try {
                  var e = n.state.query;
                  i.parse(e), n.props.onChange({ query: e }, e);
                } catch (e) {
                  var t = e.message;
                  n.setState({ error: t }), n.props.onChange({ query: "" }, "");
                }
              }),
              (n.state = Object.assign(n.defaults, n.props.query)),
              n
            );
          }
          return (
            s(t, e),
            (t.prototype.render = function() {
              return a.default.createElement(
                "div",
                null,
                a.default.createElement(
                  "div",
                  { className: "gf-form gf-form--grow" },
                  a.default.createElement(
                    "span",
                    {
                      className:
                        "gf-form-label query-keyword fix-query-keyword width-10"
                    },
                    "Query"
                  ),
                  a.default.createElement("input", {
                    type: "text",
                    className: "gf-form-input",
                    value: this.state.query,
                    onChange: this.handleQueryChange,
                    onBlur: this.handleBlur,
                    placeholder:
                      "eg: assets{name='example', assetSubtreeIds=[{id=123456789, externalId='externalId'}]}"
                  })
                ),
                a.default.createElement(
                  "div",
                  { className: "gf-form--grow" },
                  this.state.error
                    ? a.default.createElement(
                        "pre",
                        { className: "gf-formatted-error" },
                        this.state.error
                      )
                    : null,
                  l
                )
              );
            }),
            t
          );
        })(a.default.PureComponent);
      t.CogniteVariableQueryCtrl = u;
    },
    function(e, t) {
      e.exports = s;
    }
  ]);
});
//# sourceMappingURL=module.js.map
