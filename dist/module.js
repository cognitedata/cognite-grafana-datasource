define([
  "lodash",
  "app/core/utils/datemath",
  "app/plugins/sdk",
  "react"
], function(e, t, r, n) {
  return (function(e) {
    var t = {};
    function r(n) {
      if (t[n]) return t[n].exports;
      var a = (t[n] = { i: n, l: !1, exports: {} });
      return e[n].call(a.exports, a, a.exports, r), (a.l = !0), a.exports;
    }
    return (
      (r.m = e),
      (r.c = t),
      (r.d = function(e, t, n) {
        r.o(e, t) || Object.defineProperty(e, t, { enumerable: !0, get: n });
      }),
      (r.r = function(e) {
        "undefined" != typeof Symbol &&
          Symbol.toStringTag &&
          Object.defineProperty(e, Symbol.toStringTag, { value: "Module" }),
          Object.defineProperty(e, "__esModule", { value: !0 });
      }),
      (r.t = function(e, t) {
        if ((1 & t && (e = r(e)), 8 & t)) return e;
        if (4 & t && "object" == typeof e && e && e.__esModule) return e;
        var n = Object.create(null);
        if (
          (r.r(n),
          Object.defineProperty(n, "default", { enumerable: !0, value: e }),
          2 & t && "string" != typeof e)
        )
          for (var a in e)
            r.d(
              n,
              a,
              function(t) {
                return e[t];
              }.bind(null, a)
            );
        return n;
      }),
      (r.n = function(e) {
        var t =
          e && e.__esModule
            ? function() {
                return e.default;
              }
            : function() {
                return e;
              };
        return r.d(t, "a", t), t;
      }),
      (r.o = function(e, t) {
        return Object.prototype.hasOwnProperty.call(e, t);
      }),
      (r.p = ""),
      r((r.s = 3))
    );
  })([
    function(e, t, r) {
      "use strict";
      Object.defineProperty(t, "__esModule", { value: !0 }),
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
        (t.isError = function(e) {
          return void 0 !== e.error;
        }),
        (function(e) {
          (e.Equals = "="),
            (e.NotEquals = "!="),
            (e.RegexEquals = "=~"),
            (e.RegexNotEquals = "!~");
        })(t.FilterType || (t.FilterType = {}));
    },
    function(t, r) {
      t.exports = e;
    },
    function(e, t, r) {
      "use strict";
      var n =
          "function" == typeof Symbol && "symbol" == typeof Symbol.iterator
            ? function(e) {
                return typeof e;
              }
            : function(e) {
                return e &&
                  "function" == typeof Symbol &&
                  e.constructor === Symbol &&
                  e !== Symbol.prototype
                  ? "symbol"
                  : typeof e;
              },
        a = function(e) {
          return e && e.__esModule ? e : { default: e };
        };
      Object.defineProperty(t, "__esModule", { value: !0 });
      var i = a(r(1)),
        o = r(0),
        s = (function() {
          function e() {}
          return (
            (e.getQueryString = function(e) {
              return i.default
                .reduce(
                  e,
                  function(e, t, r) {
                    return i.default.isNil(t)
                      ? e
                      : i.default.isArray(t)
                      ? e + [r, t].map(encodeURIComponent).join("=[") + "]&"
                      : e + [r, t].map(encodeURIComponent).join("=") + "&";
                  },
                  ""
                )
                .slice(0, -1);
            }),
            (e.getDatasourceValueString = function(e) {
              return (
                {
                  "": "value",
                  undefined: "value",
                  none: "value",
                  avg: "average",
                  int: "interpolation",
                  stepinterpolation: "stepInterpolation",
                  step: "stepInterpolation",
                  continuousvariance: "continousVariance",
                  continuousVariance: "continousVariance",
                  cv: "continousVariance",
                  discretevariance: "discreteVariance",
                  dv: "discreteVariance",
                  totalvariation: "totalVariation",
                  tv: "totalVariation"
                }[e] || e
              );
            }),
            (e.getAggregationDropdownString = function(t) {
              var r = e.getDatasourceValueString(t);
              return (
                "continousVariance" === r
                  ? (r = "continuousVariance")
                  : "value" === r && (r = "none"),
                r
              );
            }),
            (e.splitFilters = function(e, t, r) {
              for (
                var a,
                  i = [],
                  o = ["(", "[", "{", "'", '"'],
                  s = [")", "]", "}", "'", '"'],
                  u = 0,
                  l = function(n) {
                    if (n === e.length || "," === e[n]) {
                      var l = e.substring(u, n).trim();
                      return 0 === l.length
                        ? ((u = n + 1), (a = n), "continue")
                        : r && !l.match(/[^!]=[^~]/)
                        ? ((t.error =
                            "ERROR: Unable to parse '" +
                            l +
                            "'. Only strict equality (=) is allowed."),
                          { value: void 0 })
                        : -1 === l.indexOf("=") && -1 === l.indexOf("~")
                        ? ((t.error =
                            "ERROR: Could not parse: '" +
                            l +
                            "'. Missing a comparator (=,!=,=~,!~)."),
                          { value: void 0 })
                        : (i.push(l), (u = n + 1), (a = n), "continue");
                    }
                    var c = o.findIndex(function(t) {
                      return t === e[n];
                    });
                    if (c >= 0) {
                      var f = e.indexOf(s[c], n + 1);
                      return f >= 0
                        ? ((a = n = f), "continue")
                        : ((t.error =
                            "ERROR: Could not find closing ' " +
                            s[c] +
                            " ' while parsing '" +
                            e.substring(u) +
                            "'."),
                          { value: void 0 });
                    }
                    var p = s.findIndex(function(t) {
                      return t === e[n];
                    });
                    if (p >= 0)
                      return (
                        (t.error =
                          "ERROR: Unexpected character ' " +
                          s[p] +
                          " ' while parsing '" +
                          e.substring(u) +
                          "'."),
                        { value: void 0 }
                      );
                    a = n;
                  },
                  c = 0;
                c <= e.length;
                ++c
              ) {
                var f = l(c);
                if (((c = a), "object" === (void 0 === f ? "undefined" : n(f))))
                  return f.value;
              }
              return i;
            }),
            (e.applyFilters = function(e, t) {
              for (var r = 0, n = t; r < n.length; r++) {
                var a = n[r];
                a.selected = !0;
                for (var s = 0, u = e; s < u.length; s++) {
                  var l = u[s];
                  if (l.type === o.FilterType.RegexEquals) {
                    var c = i.default.get(a, l.property),
                      f = "^" + l.value + "$";
                    if (void 0 === c || !c.match(f)) {
                      a.selected = !1;
                      break;
                    }
                  } else if (l.type === o.FilterType.RegexNotEquals) {
                    (c = i.default.get(a, l.property)),
                      (f = "^" + l.value + "$");
                    if (void 0 === c || c.match(f)) {
                      a.selected = !1;
                      break;
                    }
                  } else if (l.type === o.FilterType.NotEquals) {
                    if (
                      void 0 === (c = i.default.get(a, l.property)) ||
                      String(c) === l.value
                    ) {
                      a.selected = !1;
                      break;
                    }
                  } else if (l.type === o.FilterType.Equals) {
                    if (
                      void 0 === (c = i.default.get(a, l.property)) ||
                      String(c) !== l.value
                    ) {
                      a.selected = !1;
                      break;
                    }
                  }
                }
              }
            }),
            (e.intervalToGranularity = function(e) {
              var t = Math.round(e / 1e3);
              if (t <= 60) return t <= 1 ? "1s" : t + "s";
              var r = Math.round(e / 1e3 / 60);
              if (r < 60) return r + "m";
              var n = Math.round(e / 1e3 / 60 / 60);
              return n <= 24
                ? n + "h"
                : Math.round(e / 1e3 / 60 / 60 / 24) + "d";
            }),
            (e.timeseriesHash = function(e, t) {
              return (
                e.dashboardId +
                "_" +
                e.panelId +
                "_" +
                t.refId +
                "_" +
                t.assetQuery.templatedTarget +
                "_" +
                t.assetQuery.includeSubtrees
              );
            }),
            e
          );
        })();
      t.default = s;
    },
    function(e, t, r) {
      "use strict";
      var n = function(e) {
        return e && e.__esModule ? e : { default: e };
      };
      Object.defineProperty(t, "__esModule", { value: !0 });
      var a = n(r(4));
      t.Datasource = a.default;
      var i = r(8);
      t.QueryCtrl = i.CogniteQueryCtrl;
      var o = r(15);
      t.ConfigCtrl = o.CogniteConfigCtrl;
      var s = r(16);
      t.AnnotationsQueryCtrl = s.CogniteAnnotationsQueryCtrl;
      var u = r(17);
      t.VariableQueryEditor = u.CogniteVariableQueryCtrl;
    },
    function(e, t, r) {
      "use strict";
      var n = function() {
          return (n =
            Object.assign ||
            function(e) {
              for (var t, r = 1, n = arguments.length; r < n; r++)
                for (var a in (t = arguments[r]))
                  Object.prototype.hasOwnProperty.call(t, a) && (e[a] = t[a]);
              return e;
            }).apply(this, arguments);
        },
        a = function(e, t, r, n) {
          return new (r || (r = Promise))(function(a, i) {
            function o(e) {
              try {
                u(n.next(e));
              } catch (e) {
                i(e);
              }
            }
            function s(e) {
              try {
                u(n.throw(e));
              } catch (e) {
                i(e);
              }
            }
            function u(e) {
              e.done
                ? a(e.value)
                : new r(function(t) {
                    t(e.value);
                  }).then(o, s);
            }
            u((n = n.apply(e, t || [])).next());
          });
        },
        i = function(e, t) {
          var r,
            n,
            a,
            i,
            o = {
              label: 0,
              sent: function() {
                if (1 & a[0]) throw a[1];
                return a[1];
              },
              trys: [],
              ops: []
            };
          return (
            (i = { next: s(0), throw: s(1), return: s(2) }),
            "function" == typeof Symbol &&
              (i[Symbol.iterator] = function() {
                return this;
              }),
            i
          );
          function s(i) {
            return function(s) {
              return (function(i) {
                if (r) throw new TypeError("Generator is already executing.");
                for (; o; )
                  try {
                    if (
                      ((r = 1),
                      n &&
                        (a =
                          2 & i[0]
                            ? n.return
                            : i[0]
                            ? n.throw || ((a = n.return) && a.call(n), 0)
                            : n.next) &&
                        !(a = a.call(n, i[1])).done)
                    )
                      return a;
                    switch (((n = 0), a && (i = [2 & i[0], a.value]), i[0])) {
                      case 0:
                      case 1:
                        a = i;
                        break;
                      case 4:
                        return o.label++, { value: i[1], done: !1 };
                      case 5:
                        o.label++, (n = i[1]), (i = [0]);
                        continue;
                      case 7:
                        (i = o.ops.pop()), o.trys.pop();
                        continue;
                      default:
                        if (
                          !(a = (a = o.trys).length > 0 && a[a.length - 1]) &&
                          (6 === i[0] || 2 === i[0])
                        ) {
                          o = 0;
                          continue;
                        }
                        if (
                          3 === i[0] &&
                          (!a || (i[1] > a[0] && i[1] < a[3]))
                        ) {
                          o.label = i[1];
                          break;
                        }
                        if (6 === i[0] && o.label < a[1]) {
                          (o.label = a[1]), (a = i);
                          break;
                        }
                        if (a && o.label < a[2]) {
                          (o.label = a[2]), o.ops.push(i);
                          break;
                        }
                        a[2] && o.ops.pop(), o.trys.pop();
                        continue;
                    }
                    i = t.call(e, o);
                  } catch (e) {
                    (i = [6, e]), (n = 0);
                  } finally {
                    r = a = 0;
                  }
                if (5 & i[0]) throw i[1];
                return { value: i[0] ? i[1] : void 0, done: !0 };
              })([i, s]);
            };
          }
        },
        o = function(e) {
          return e && e.__esModule ? e : { default: e };
        },
        s = function(e) {
          if (e && e.__esModule) return e;
          var t = {};
          if (null != e)
            for (var r in e) Object.hasOwnProperty.call(e, r) && (t[r] = e[r]);
          return (t.default = e), t;
        };
      Object.defineProperty(t, "__esModule", { value: !0 });
      var u = o(r(1)),
        l = s(r(5)),
        c = o(r(2)),
        f = o(r(6)),
        p = r(7),
        d = r(0),
        g = (function() {
          function e(e, t, r) {
            (this.backendSrv = t),
              (this.templateSrv = r),
              (this.id = e.id),
              (this.url = e.url),
              (this.project = e.jsonData.cogniteProject),
              (this.name = e.name);
          }
          return (
            (e.$inject = ["instanceSettings", "backendSrv", "templateSrv"]),
            (e.prototype.query = function(e) {
              return a(this, void 0, void 0, function() {
                var t,
                  r,
                  n,
                  a,
                  o,
                  s,
                  p,
                  g,
                  h,
                  m,
                  v,
                  y,
                  b,
                  A,
                  T,
                  E,
                  w,
                  x,
                  C,
                  S,
                  O = this;
                return i(this, function(j) {
                  switch (j.label) {
                    case 0:
                      if (
                        0 ===
                        (t = e.targets.reduce(function(e, t) {
                          return (
                            (t.error = ""),
                            (t.warning = ""),
                            t &&
                            !t.hide &&
                            ((t.tab !== d.Tab.Timeseries && void 0 !== t.tab) ||
                              (t.target &&
                                "Start typing tag id here" !== t.target)) &&
                            ((t.tab !== d.Tab.Asset &&
                              t.tab !== d.Tab.Custom) ||
                              (t.assetQuery && "" !== t.assetQuery.target))
                              ? e.concat(t)
                              : e
                          );
                        }, [])).length
                      )
                        return [2, Promise.resolve({ data: [] })];
                      for (
                        r = Math.ceil(l.parse(e.range.from)),
                          n = Math.ceil(l.parse(e.range.to)),
                          a = [],
                          o = [],
                          s = [],
                          p = 0,
                          g = t;
                        p < g.length;
                        p++
                      )
                        (E = g[p]), s.push(this.getDataQueryRequestItems(E, e));
                      return [4, Promise.all(s)];
                    case 1:
                      (h = j.sent()),
                        (m = []),
                        (v = function(t, s) {
                          var l,
                            p,
                            g,
                            h,
                            v,
                            b,
                            A,
                            T,
                            E,
                            w,
                            x,
                            C,
                            S,
                            j,
                            _,
                            R,
                            Q,
                            q;
                          return i(this, function(i) {
                            switch (i.label) {
                              case 0:
                                if (0 === s.length || t.error)
                                  return [2, "continue"];
                                for (
                                  l = u.default.chunk(s, 100), p = 0, g = l;
                                  p < g.length;
                                  p++
                                ) {
                                  if (
                                    ((h = g[p]),
                                    a.push({ refId: t.refId, count: h.length }),
                                    (v = { items: h, start: r, end: n }),
                                    t.aggregation &&
                                      "none" !== t.aggregation &&
                                      ((v.aggregates = t.aggregation),
                                      t.granularity
                                        ? (v.granularity = t.granularity)
                                        : (v.granularity = c.default.intervalToGranularity(
                                            e.intervalMs
                                          ))),
                                    t.tab === d.Tab.Custom && h[0].function)
                                  ) {
                                    for (
                                      b = 0, A = /\[.*?\]/g, T = 0, E = h;
                                      T < E.length &&
                                      ((w = E[T]), (x = w.function.match(A)));
                                      T++
                                    ) {
                                      for (
                                        C = {}, S = 0, j = x;
                                        S < j.length;
                                        S++
                                      )
                                        (_ = j[S]),
                                          (C[_.substr(1, _.length - 2)] = !0);
                                      b += Object.keys(C).length;
                                    }
                                    0 === b && (b = 1),
                                      (R = h.some(function(e) {
                                        return e.aliases.length > 0;
                                      })),
                                      (v.limit = Math.floor(
                                        (R ? 1e4 : 1e5) / b
                                      ));
                                  } else
                                    v.limit = Math.floor(
                                      (v.aggregates ? 1e4 : 1e5) / h.length
                                    );
                                  m.push(v);
                                }
                                if (
                                  t.tab !== d.Tab.Timeseries &&
                                  void 0 !== t.tab
                                )
                                  return [3, 7];
                                if (
                                  (t.label || (t.label = ""),
                                  !t.label.match(/{{.*}}/))
                                )
                                  return [3, 5];
                                i.label = 1;
                              case 1:
                                return (
                                  i.trys.push([1, 3, , 4]),
                                  [
                                    4,
                                    y.getTimeseries(
                                      { q: t.target, limit: 1 },
                                      t
                                    )
                                  ]
                                );
                              case 2:
                                return (
                                  (Q = i.sent()),
                                  o.push(y.getTimeseriesLabel(t.label, Q[0])),
                                  [3, 4]
                                );
                              case 3:
                                return i.sent(), o.push(t.label), [3, 4];
                              case 4:
                                return [3, 6];
                              case 5:
                                o.push(t.label), (i.label = 6);
                              case 6:
                                return [3, 8];
                              case 7:
                                if (t.tab === d.Tab.Asset)
                                  t.assetQuery.timeseries.forEach(function(e) {
                                    e.selected &&
                                      (t.label || (t.label = ""),
                                      o.push(O.getTimeseriesLabel(t.label, e)));
                                  });
                                else
                                  for (q = 0; q < s.length; )
                                    f.default
                                      .getTimeseries(e, t)
                                      .forEach(function(e) {
                                        if (e.selected && q < s.length) {
                                          if (((q += 1), !t.label)) {
                                            if (s[0].function)
                                              return void o.push(e.name);
                                            t.label = "";
                                          }
                                          o.push(
                                            O.getTimeseriesLabel(t.label, e)
                                          );
                                        }
                                      });
                                i.label = 8;
                              case 8:
                                return [2];
                            }
                          });
                        }),
                        (y = this),
                        (b = 0),
                        (A = h.map(function(e, r) {
                          return { target: t[r], queryList: e };
                        })),
                        (j.label = 2);
                    case 2:
                      return b < A.length
                        ? ((T = A[b]),
                          (E = T.target),
                          (w = T.queryList),
                          [5, v(E, w)])
                        : [3, 5];
                    case 3:
                      j.sent(), (j.label = 4);
                    case 4:
                      return b++, [3, 2];
                    case 5:
                      (x = m.map(function(e) {
                        return f.default
                          .getQuery(
                            {
                              url:
                                O.url +
                                "/cogniteapi/" +
                                O.project +
                                "/timeseries/dataquery",
                              method: "POST",
                              data: e
                            },
                            O.backendSrv
                          )
                          .catch(function(e) {
                            return { error: e };
                          });
                      })),
                        (j.label = 6);
                    case 6:
                      return j.trys.push([6, 8, , 9]), [4, Promise.all(x)];
                    case 7:
                      return (C = j.sent()), [3, 9];
                    case 8:
                      return j.sent(), [2, { data: [] }];
                    case 9:
                      return (
                        (S = 0),
                        [
                          2,
                          {
                            data: C.reduce(function(e, i, s) {
                              var u = a[s].refId,
                                l = t.find(function(e) {
                                  return e.refId === u;
                                });
                              if (d.isError(i)) {
                                var f = void 0;
                                return (
                                  (f =
                                    i.error.data && i.error.data.error
                                      ? "[" +
                                        i.error.status +
                                        " ERROR] " +
                                        i.error.data.error.message
                                      : "Unknown error"),
                                  (l.error = f),
                                  (S += a[s].count),
                                  e
                                );
                              }
                              var p = i.config.data.aggregates,
                                g = p ? p + " " : "";
                              return e.concat(
                                i.data.data.items.map(function(e) {
                                  return {
                                    target: o[S++] ? o[S - 1] : g + e.name,
                                    datapoints: e.datapoints
                                      .filter(function(e) {
                                        return (
                                          e.timestamp >= r && e.timestamp <= n
                                        );
                                      })
                                      .map(function(e) {
                                        var t = c.default.getDatasourceValueString(
                                          i.config.data.aggregates
                                        );
                                        return [
                                          void 0 === e[t] ? e.value : e[t],
                                          e.timestamp
                                        ];
                                      })
                                  };
                                })
                              );
                            }, [])
                          }
                        ]
                      );
                  }
                });
              });
            }),
            (e.prototype.getDataQueryRequestItems = function(e, t) {
              return a(this, void 0, void 0, function() {
                return i(this, function(r) {
                  switch (r.label) {
                    case 0:
                      return e.tab === d.Tab.Timeseries || void 0 === e.tab
                        ? [2, [{ name: e.target }]]
                        : e.tab !== d.Tab.Asset
                        ? [3, 2]
                        : [4, this.findAssetTimeseries(e, t)];
                    case 1:
                      return (
                        r.sent(),
                        [
                          2,
                          e.assetQuery.timeseries
                            .filter(function(e) {
                              return e.selected;
                            })
                            .map(function(e) {
                              return { name: e.name };
                            })
                        ]
                      );
                    case 2:
                      return e.tab !== d.Tab.Custom
                        ? [3, 4]
                        : [4, this.findAssetTimeseries(e, t)];
                    case 3:
                      if ((r.sent(), !e.expr)) return [2, []];
                      try {
                        return [
                          2,
                          p.parseExpression(
                            e.expr,
                            t,
                            f.default.getTimeseries(t, e),
                            this.templateSrv,
                            e
                          )
                        ];
                      } catch (t) {
                        return (e.error = t), [2, []];
                      }
                      r.label = 4;
                    case 4:
                      return [2, []];
                  }
                });
              });
            }),
            (e.prototype.annotationQuery = function(e) {
              return a(this, void 0, void 0, function() {
                var t, r, a, o, s, u, g, h, m, v, y, b;
                return i(this, function(i) {
                  switch (i.label) {
                    case 0:
                      return (
                        (t = e.range),
                        (r = e.annotation),
                        (a = r.expr),
                        (o = r.filter),
                        (s = r.error),
                        (u = Math.ceil(l.parse(t.from))),
                        (g = Math.ceil(l.parse(t.to))),
                        s || !a
                          ? [2, []]
                          : (h = p.parse(
                              a,
                              d.ParseType.Event,
                              this.templateSrv
                            )).error
                          ? (console.error(h.error), [2, []])
                          : ((m = p.parse(
                              o || "",
                              d.ParseType.Event,
                              this.templateSrv
                            )),
                            o && m.error
                              ? (console.error(m.error), [2, []])
                              : ((v = n(
                                  {
                                    limit: 1e3,
                                    maxStartTime: g,
                                    minEndTime: u
                                  },
                                  h.filters.reduce(function(e, t) {
                                    return (e[t.property] = t.value), e;
                                  }, {})
                                )),
                                [
                                  4,
                                  f.default.getQuery(
                                    {
                                      url:
                                        this.url +
                                        "/cogniteapi/" +
                                        this.project +
                                        "/events/search?" +
                                        c.default.getQueryString(v),
                                      method: "GET"
                                    },
                                    this.backendSrv
                                  )
                                ]))
                      );
                    case 1:
                      return (
                        (y = i.sent()),
                        (b = y.data.data.items) && 0 !== b.length
                          ? (c.default.applyFilters(m.filters, b),
                            [
                              2,
                              b
                                .filter(function(e) {
                                  return !0 === e.selected;
                                })
                                .map(function(e) {
                                  return {
                                    annotation: r,
                                    isRegion: !0,
                                    text: e.description,
                                    time: e.startTime,
                                    timeEnd: e.endTime,
                                    title: e.type
                                  };
                                })
                            ])
                          : [2, []]
                      );
                  }
                });
              });
            }),
            (e.prototype.getOptionsForDropdown = function(e, t, r) {
              return a(this, void 0, void 0, function() {
                var n;
                return i(this, function(a) {
                  return (
                    t === d.Tab.Asset
                      ? (n =
                          0 === e.length
                            ? "/cogniteapi/" + this.project + "/assets?"
                            : "/cogniteapi/" +
                              this.project +
                              "/assets/search?query=" +
                              e)
                      : t === d.Tab.Timeseries &&
                        (n =
                          0 === e.length
                            ? "/cogniteapi/" + this.project + "/timeseries?"
                            : "/cogniteapi/" +
                              this.project +
                              "/timeseries/search?query=" +
                              e),
                    r && (n += "&" + c.default.getQueryString(r)),
                    [
                      2,
                      f.default
                        .getQuery(
                          { url: this.url + n, method: "GET" },
                          this.backendSrv
                        )
                        .then(function(e) {
                          return e.data.data.items.map(function(e) {
                            return {
                              text: e.description
                                ? e.name + " (" + e.description + ")"
                                : e.name,
                              value: t === d.Tab.Asset ? String(e.id) : e.name
                            };
                          });
                        })
                    ]
                  );
                });
              });
            }),
            (e.prototype.findAssetTimeseries = function(e, t) {
              return a(this, void 0, void 0, function() {
                var r, n, a, o;
                return i(this, function(i) {
                  switch (i.label) {
                    case 0:
                      return (
                        (r = this.templateSrv.replace(
                          e.assetQuery.target,
                          t.scopedVars
                        )),
                        (n = {
                          path: e.assetQuery.includeSubtrees ? [r] : void 0,
                          assetId: e.assetQuery.includeSubtrees ? void 0 : r,
                          limit: 1e4
                        }),
                        e.tab !== d.Tab.Custom
                          ? [3, 3]
                          : ((e.assetQuery.templatedTarget = r),
                            f.default.getTimeseries(t, e)
                              ? [3, 2]
                              : [4, this.getTimeseries(n, e)])
                      );
                    case 1:
                      (a = i.sent()),
                        f.default.setTimeseries(
                          t,
                          e,
                          a.map(function(e) {
                            return (e.selected = !0), e;
                          })
                        ),
                        (i.label = 2);
                    case 2:
                      return [2, Promise.resolve()];
                    case 3:
                      return e.assetQuery.old &&
                        r === e.assetQuery.old.target &&
                        e.assetQuery.includeSubtrees ===
                          e.assetQuery.old.includeSubtrees
                        ? [2, Promise.resolve()]
                        : ((e.assetQuery.old = {
                            target: String(r),
                            includeSubtrees: e.assetQuery.includeSubtrees
                          }),
                          (n.limit = 101),
                          [4, this.getTimeseries(n, e)]);
                    case 4:
                      return (
                        101 === (o = i.sent()).length &&
                          ((e.warning =
                            "[WARNING] Only showing first 100 timeseries. To get better results, either change the selected asset or use 'Custom Query'."),
                          o.splice(-1)),
                        (e.assetQuery.timeseries = o.map(function(e) {
                          return (e.selected = !0), e;
                        })),
                        [2]
                      );
                  }
                });
              });
            }),
            (e.prototype.getTimeseries = function(e, t) {
              return a(this, void 0, void 0, function() {
                return i(this, function(r) {
                  return [
                    2,
                    f.default
                      .getQuery(
                        {
                          url:
                            this.url +
                            "/cogniteapi/" +
                            this.project +
                            "/timeseries?" +
                            c.default.getQueryString(e),
                          method: "GET"
                        },
                        this.backendSrv
                      )
                      .then(
                        function(e) {
                          return u.default.cloneDeep(
                            e.data.data.items.filter(function(e) {
                              return !e.isString;
                            })
                          );
                        },
                        function(e) {
                          return (
                            e.data && e.data.error
                              ? (t.error =
                                  "[" +
                                  e.status +
                                  " ERROR] " +
                                  e.data.error.message)
                              : (t.error = "Unknown error"),
                            []
                          );
                        }
                      )
                  ];
                });
              });
            }),
            (e.prototype.metricFindQuery = function(e) {
              return a(this, void 0, void 0, function() {
                var t, r, a, o, s, u;
                return i(this, function(i) {
                  switch (i.label) {
                    case 0:
                      return (t = p.parse(
                        e.query,
                        d.ParseType.Asset,
                        this.templateSrv
                      )).error
                        ? [2, [{ text: t.error, value: "-" }]]
                        : ((r = p.parse(
                            e.filter,
                            d.ParseType.Asset,
                            this.templateSrv
                          )),
                          e.filter && r.error
                            ? [2, [{ text: r.error, value: "-" }]]
                            : ((a =
                                "/cogniteapi/" +
                                this.project +
                                "/assets/search?"),
                              (o = n(
                                { limit: 1e3 },
                                t.filters.reduce(function(e, t) {
                                  return (e[t.property] = t.value), e;
                                }, {})
                              )),
                              [
                                4,
                                f.default.getQuery(
                                  {
                                    url:
                                      this.url +
                                      a +
                                      c.default.getQueryString(o),
                                    method: "GET"
                                  },
                                  this.backendSrv
                                )
                              ]));
                    case 1:
                      return (
                        (s = i.sent()),
                        (u = s.data.data.items),
                        c.default.applyFilters(r.filters, u),
                        [
                          2,
                          u
                            .filter(function(e) {
                              return !0 === e.selected;
                            })
                            .map(function(e) {
                              return { text: e.name, value: e.id };
                            })
                        ]
                      );
                  }
                });
              });
            }),
            (e.prototype.getTimeseriesLabel = function(e, t) {
              return e.replace(/{{([^{}]*)}}/g, function(e, r) {
                return u.default.get(t, r, e);
              });
            }),
            (e.prototype.testDatasource = function() {
              var e = this;
              return this.backendSrv
                .datasourceRequest({
                  url: this.url + "/cogniteloginstatus",
                  method: "GET"
                })
                .then(function(t) {
                  if (200 === t.status)
                    return t.data.data.loggedIn &&
                      t.data.data.project === e.project
                      ? {
                          status: "success",
                          message: "Your Cognite credentials are valid",
                          title: "Success"
                        }
                      : {
                          status: "error",
                          message: "Your Cognite credentials are invalid",
                          title: "Error"
                        };
                });
            }),
            e
          );
        })();
      t.default = g;
    },
    function(e, r) {
      e.exports = t;
    },
    function(e, t, r) {
      "use strict";
      var n = function(e, t, r, n) {
          return new (r || (r = Promise))(function(a, i) {
            function o(e) {
              try {
                u(n.next(e));
              } catch (e) {
                i(e);
              }
            }
            function s(e) {
              try {
                u(n.throw(e));
              } catch (e) {
                i(e);
              }
            }
            function u(e) {
              e.done
                ? a(e.value)
                : new r(function(t) {
                    t(e.value);
                  }).then(o, s);
            }
            u((n = n.apply(e, t || [])).next());
          });
        },
        a = function(e, t) {
          var r,
            n,
            a,
            i,
            o = {
              label: 0,
              sent: function() {
                if (1 & a[0]) throw a[1];
                return a[1];
              },
              trys: [],
              ops: []
            };
          return (
            (i = { next: s(0), throw: s(1), return: s(2) }),
            "function" == typeof Symbol &&
              (i[Symbol.iterator] = function() {
                return this;
              }),
            i
          );
          function s(i) {
            return function(s) {
              return (function(i) {
                if (r) throw new TypeError("Generator is already executing.");
                for (; o; )
                  try {
                    if (
                      ((r = 1),
                      n &&
                        (a =
                          2 & i[0]
                            ? n.return
                            : i[0]
                            ? n.throw || ((a = n.return) && a.call(n), 0)
                            : n.next) &&
                        !(a = a.call(n, i[1])).done)
                    )
                      return a;
                    switch (((n = 0), a && (i = [2 & i[0], a.value]), i[0])) {
                      case 0:
                      case 1:
                        a = i;
                        break;
                      case 4:
                        return o.label++, { value: i[1], done: !1 };
                      case 5:
                        o.label++, (n = i[1]), (i = [0]);
                        continue;
                      case 7:
                        (i = o.ops.pop()), o.trys.pop();
                        continue;
                      default:
                        if (
                          !(a = (a = o.trys).length > 0 && a[a.length - 1]) &&
                          (6 === i[0] || 2 === i[0])
                        ) {
                          o = 0;
                          continue;
                        }
                        if (
                          3 === i[0] &&
                          (!a || (i[1] > a[0] && i[1] < a[3]))
                        ) {
                          o.label = i[1];
                          break;
                        }
                        if (6 === i[0] && o.label < a[1]) {
                          (o.label = a[1]), (a = i);
                          break;
                        }
                        if (a && o.label < a[2]) {
                          (o.label = a[2]), o.ops.push(i);
                          break;
                        }
                        a[2] && o.ops.pop(), o.trys.pop();
                        continue;
                    }
                    i = t.call(e, o);
                  } catch (e) {
                    (i = [6, e]), (n = 0);
                  } finally {
                    r = a = 0;
                  }
                if (5 & i[0]) throw i[1];
                return { value: i[0] ? i[1] : void 0, done: !0 };
              })([i, s]);
            };
          }
        },
        i = function(e) {
          return e && e.__esModule ? e : { default: e };
        };
      Object.defineProperty(t, "__esModule", { value: !0 });
      var o = r(0),
        s = i(r(2)),
        u = { results: new Map(), requests: new Map() };
      t.getQuery = function(e, t) {
        return n(void 0, void 0, void 0, function() {
          var r, n;
          return a(this, function(a) {
            return (
              (r = JSON.stringify(e)),
              u.requests.has(r)
                ? [2, u.requests.get(r)]
                : u.results.has(r)
                ? [2, u.results.get(r)]
                : ((n = t.datasourceRequest(e).then(
                    function(e) {
                      if (!e) return {};
                      var t = e;
                      return (
                        o.isError(t) ||
                          (u.results.set(r, t),
                          setTimeout(function() {
                            u.results.delete(r), u.requests.delete(r);
                          }, 1e4)),
                        u.requests.delete(r),
                        t
                      );
                    },
                    function(e) {
                      throw (u.requests.delete(r), e);
                    }
                  )),
                  u.requests.set(r, n),
                  [2, n])
            );
          });
        });
      };
      var l = new Map();
      (t.getTimeseries = function(e, t) {
        return l.get(s.default.timeseriesHash(e, t));
      }),
        (t.setTimeseries = function(e, t, r) {
          l.set(s.default.timeseriesHash(e, t), r);
        });
      var c = {
        getQuery: t.getQuery,
        getTimeseries: t.getTimeseries,
        setTimeseries: t.setTimeseries
      };
      t.default = c;
    },
    function(e, t, r) {
      "use strict";
      var n = function(e) {
        return e && e.__esModule ? e : { default: e };
      };
      Object.defineProperty(t, "__esModule", { value: !0 });
      var a = r(0),
        i = n(r(2)),
        o = n(r(1));
      t.parseExpression = function(e, t, r, n, a) {
        var o = e.trim();
        if (f(o)) {
          var c = l(o, n, t, r);
          return (
            (a.aggregation = i.default.getAggregationDropdownString(
              c.aggregation
            )),
            (a.granularity = c.granularity),
            r
              .filter(function(e) {
                return e.selected;
              })
              .map(function(e) {
                return { name: e.name };
              })
          );
        }
        var p = s(o, t, r, n);
        return u(p, t, r, n, "");
      };
      var s = function(e, t, r, n) {
          var a = e,
            i = a.match(/sum\(.*?\)/gi);
          if (i)
            for (
              var o = function(e) {
                  var i = e.slice(4, -1),
                    o = l(i, n, t, r),
                    s =
                      "([" +
                      r
                        .filter(function(e) {
                          return e.selected;
                        })
                        .map(function(e) {
                          return c(e, o);
                        })
                        .join("] + [") +
                      "])";
                  a = a.replace(e, s);
                },
                s = 0,
                u = (i = i.filter(function(e, t, r) {
                  return t === r.indexOf(e);
                }));
              s < u.length;
              s++
            ) {
              o(u[s]);
            }
          var f = a.match(/(max|min|avg)\(.*?\)/gi);
          if (f)
            for (
              var p = function(e) {
                  var i = e.slice(4, -1),
                    o = l(i, n, t, r),
                    s = r.filter(function(e) {
                      return e.selected;
                    }),
                    u = "";
                  (u =
                    s.length <= 1
                      ? s
                          .map(function(e) {
                            return "[" + c(e, o) + "]";
                          })
                          .join("")
                      : e.slice(0, 3).toLowerCase() +
                        "([" +
                        s
                          .map(function(e) {
                            return c(e, o);
                          })
                          .join("], [") +
                        "])"),
                    (a = a.replace(e, u));
                },
                d = 0,
                g = (f = f.filter(function(e, t, r) {
                  return t === r.indexOf(e);
                }));
              d < g.length;
              d++
            ) {
              p(g[d]);
            }
          return a;
        },
        u = function e(t, r, n, a, i) {
          var o = [],
            s = p(t);
          if (s)
            for (
              var u = l(s, a, r, n),
                f = n.filter(function(e) {
                  return e.selected;
                }),
                g = 0,
                h = f;
              g < h.length;
              g++
            ) {
              for (
                var m = h[g],
                  v = "[" + c(m, u) + "]",
                  y = t.replace(s, v),
                  b = p(s, !1),
                  A = y.indexOf(b);
                A >= 0;

              ) {
                var T = p(y.substr(A)),
                  E = l(T, a, r, f);
                A = (y = y.replace(T, "[" + c(m, E) + "]")).indexOf(b);
              }
              o = o.concat(e(y, r, n, a, i || m.name));
            }
          else o.push({ name: i, function: t });
          return o.map(function(e) {
            return d(e, r), e;
          });
        },
        l = function(e, r, n, o) {
          var s = t.parse(e, a.ParseType.Timeseries, r, n);
          if (s.error) throw s.error;
          return i.default.applyFilters(s.filters, o), s;
        },
        c = function(e, t) {
          return (
            e.id +
            (t.aggregation ? "," + t.aggregation : "") +
            (t.granularity ? "," + t.granularity : "")
          );
        },
        f = function(e) {
          return p(e) === e;
        },
        p = function(e, t) {
          void 0 === t && (t = !0);
          var r = e.indexOf("timeseries{");
          if (r < 0) return "";
          for (var n = r + "timeseries{".length, a = 1, i = 0; a > 0; ) {
            if (n + i >= e.length)
              throw "ERROR: Unable to parse " + e.substr(r);
            if ("{" === e.charAt(n + i)) a += 1;
            else if ("}" === e.charAt(n + i)) a -= 1;
            else if ('"' === e.charAt(n + i) || "'" === e.charAt(n + i)) {
              var o = e.indexOf(e.charAt(n + i), n + i + 1);
              if (o < 0) throw "ERROR: Unable to parse " + e.substr(r);
              i = o - n;
            }
            i += 1;
          }
          if (t && n + i < e.length && "[" === e.charAt(n + i)) {
            var s = e.indexOf("]", n + i);
            if (!(s > 0)) throw "ERROR: Unable to parse " + e.substr(r);
            i = s - n + 1;
          }
          return e.substr(r, i + "timeseries{".length);
        },
        d = function(e, t) {
          var r = e.function.match(/\[.*?\]/g);
          if ((e.aliases || (e.aliases = []), r))
            for (
              var n = function(r) {
                  var n = r
                    .substr(1, r.length - 2)
                    .split(",")
                    .filter(function(e) {
                      return e.length;
                    })
                    .map(function(e) {
                      return o.default.trim(e, " '\"");
                    });
                  if (1 === n.length) return "continue";
                  var a = { alias: "alias" + n.join("_"), id: Number(n[0]) };
                  if (
                    ((a.aggregate = n[1]),
                    (a.granularity =
                      n[2] || i.default.intervalToGranularity(t.intervalMs)),
                    (e.function = e.function.replace(r, "[" + a.alias + "]")),
                    e.aliases.find(function(e) {
                      return e.alias === a.alias;
                    }))
                  )
                    return "continue";
                  e.aliases.push(a);
                },
                a = 0,
                s = r;
              a < s.length;
              a++
            ) {
              n(s[a]);
            }
        };
      t.parse = function(e, t, r, n) {
        var s = e;
        if (t === a.ParseType.Timeseries || t === a.ParseType.Event)
          if (n) s = r.replace(s, n.scopedVars);
          else
            for (var u = 0, l = r.variables; u < l.length; u++) {
              var c = l[u];
              s = (s = s.replace(
                "[[" + c.name + "]]",
                c.current.value
              )).replace("$" + c.name, c.current.value);
            }
        var f,
          p = { filters: [], granularity: "", aggregation: "", error: "" },
          d = s.match(/^timeseries\{(.*)\}(?:\[(.*)\])?$/),
          g = s.match(/^(?:asset|event)\{(.*)\}$/),
          h = s.match(/^filter\{(.*)\}$/);
        if (
          (d
            ? (f = i.default.splitFilters(d[1], p, !1))
            : g
            ? (f = i.default.splitFilters(g[1], p, !0))
            : h
            ? (f = i.default.splitFilters(h[1], p, !1))
            : (p.error = "ERROR: Unable to parse expression " + s),
          p.error)
        )
          return p;
        for (var m = 0, v = f; m < v.length; m++) {
          var y = v[m];
          if ("" !== (y = o.default.trim(y, " "))) {
            var b = {},
              A = void 0;
            (A = y.indexOf(a.FilterType.RegexEquals)) > -1
              ? ((b.property = o.default.trim(y.substr(0, A), " '\"")),
                (b.value = o.default.trim(y.substr(A + 2), " '\"")),
                (b.type = a.FilterType.RegexEquals))
              : (A = y.indexOf(a.FilterType.RegexNotEquals)) > -1
              ? ((b.property = o.default.trim(y.substr(0, A), " '\"")),
                (b.value = o.default.trim(y.substr(A + 2), " '\"")),
                (b.type = a.FilterType.RegexNotEquals))
              : (A = y.indexOf(a.FilterType.NotEquals)) > -1
              ? ((b.property = o.default.trim(y.substr(0, A), " '\"")),
                (b.value = o.default.trim(y.substr(A + 2), " '\"")),
                (b.type = a.FilterType.NotEquals))
              : (A = y.indexOf(a.FilterType.Equals)) > -1
              ? ((b.property = o.default.trim(y.substr(0, A), " '\"")),
                (b.value = o.default.trim(y.substr(A + 1), " '\"")),
                (b.type = a.FilterType.Equals))
              : console.error("Error parsing " + y),
              p.filters.push(b);
          }
        }
        if (d) {
          var T = d[2];
          if (T) {
            var E = T.split(",");
            (p.aggregation = o.default.trim(E[0], " '\"").toLowerCase()),
              (p.granularity =
                E.length > 1 ? o.default.trim(E[1], " '\"") : "");
          }
        }
        return p;
      };
    },
    function(e, t, r) {
      "use strict";
      var n,
        a = ((n = function(e, t) {
          return (n =
            Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array &&
              function(e, t) {
                e.__proto__ = t;
              }) ||
            function(e, t) {
              for (var r in t) t.hasOwnProperty(r) && (e[r] = t[r]);
            })(e, t);
        }),
        function(e, t) {
          function r() {
            this.constructor = e;
          }
          n(e, t),
            (e.prototype =
              null === t
                ? Object.create(t)
                : ((r.prototype = t.prototype), new r()));
        }),
        i = function(e) {
          return e && e.__esModule ? e : { default: e };
        };
      Object.defineProperty(t, "__esModule", { value: !0 });
      var o = i(r(1)),
        s = r(9);
      r(10);
      var u = r(0),
        l = (function(e) {
          function t(t, r, n) {
            var a = e.call(this, t, r) || this;
            return (
              (a.templateSrv = n),
              (a.aggregation = [
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
              (a.tabs = [
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
              (a.defaults = {
                target: "Start typing tag id here",
                type: "timeserie",
                aggregation: "average",
                granularity: "",
                label: "",
                tab: u.Tab.Timeseries,
                expr: "",
                assetQuery: {
                  target: "",
                  old: void 0,
                  timeseries: [],
                  includeSubtrees: !1,
                  func: "",
                  templatedTarget: ""
                }
              }),
              o.default.defaultsDeep(a.target, a.defaults),
              (a.currentTabIndex =
                a.tabs.findIndex(function(e) {
                  return e.value === a.target.tab;
                }) || 0),
              a.target.tab !== u.Tab.Asset &&
                ((a.target.assetQuery.timeseries = []),
                (a.target.assetQuery.old = void 0)),
              (a.isAllSelected =
                a.target.assetQuery.timeseries &&
                a.target.assetQuery.timeseries.every(function(e) {
                  return e.selected;
                })),
              a
            );
          }
          return (
            a(t, e),
            (t.$inject = ["$scope", "$injector", "templateSrv"]),
            (t.prototype.getOptions = function(e, t) {
              var r = this;
              return this.datasource
                .getOptionsForDropdown(e || "", t)
                .then(function(e) {
                  return (
                    o.default.defer(function() {
                      return r.$scope.$digest();
                    }),
                    e
                  );
                });
            }),
            (t.prototype.onChangeInternal = function() {
              this.refresh();
            }),
            (t.prototype.changeTab = function(e) {
              (this.currentTabIndex = e),
                (this.target.tab = this.tabs[e].value),
                this.refresh();
            }),
            (t.prototype.toggleCheckboxes = function() {
              var e = this;
              (this.isAllSelected = !this.isAllSelected),
                this.target.assetQuery.timeseries.forEach(function(t) {
                  return (t.selected = e.isAllSelected);
                });
            }),
            (t.prototype.selectOption = function(e) {
              (e.selected = !e.selected),
                (this.isAllSelected = this.target.assetQuery.timeseries.every(
                  function(e) {
                    return e.selected;
                  }
                ));
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
            (t.templateUrl = "partials/query.editor.html"),
            t
          );
        })(s.QueryCtrl);
      t.CogniteQueryCtrl = l;
    },
    function(e, t) {
      e.exports = r;
    },
    function(e, t, r) {
      var n = r(11);
      "string" == typeof n && (n = [[e.i, n, ""]]);
      var a = { hmr: !0, transform: void 0, insertInto: void 0 };
      r(13)(n, a);
      n.locals && (e.exports = n.locals);
    },
    function(e, t, r) {
      (e.exports = r(12)(!0)).push([
        e.i,
        ".min-width-10 {\n  min-width: 10rem;\n}\n\n.min-width-12 {\n  min-width: 12rem;\n}\n\n.min-width-20 {\n  min-width: 20rem;\n}\n\n.gf-form-select-wrapper select.gf-form-input {\n  height: 2.64rem;\n}\n\n.gf-form-select-wrapper--caret-indent.gf-form-select-wrapper::after {\n  right: 0.775rem;\n}\n\n.gf-tabs-cognite.active:before,\n.gf-tabs-cognite.active:focus:before,\n.gf-tabs-cognite.active:hover:before {\n  background-image: linear-gradient(90deg, #33b5e5 0, #00b3ff 99%, #1b1b1b);\n}\n\ninput[type='checkbox'] {\n  margin: 4px;\n}\n\n.custom-query {\n  font-family: monospace;\n}\n\npre code {\n  line-height: 2;\n}\n\n.cognite-timeseries-list-checkbox {\n  margin-right: 10px;\n}\n",
        "",
        {
          version: 3,
          sources: ["query_editor.css"],
          names: [],
          mappings:
            "AAAA;EACE,gBAAgB;AAClB;;AAEA;EACE,gBAAgB;AAClB;;AAEA;EACE,gBAAgB;AAClB;;AAEA;EACE,eAAe;AACjB;;AAEA;EACE,eAAe;AACjB;;AAEA;;;EAGE,yEAAyE;AAC3E;;AAEA;EACE,WAAW;AACb;;AAEA;EACE,sBAAsB;AACxB;;AAEA;EACE,cAAc;AAChB;;AAEA;EACE,kBAAkB;AACpB",
          file: "query_editor.css",
          sourcesContent: [
            ".min-width-10 {\n  min-width: 10rem;\n}\n\n.min-width-12 {\n  min-width: 12rem;\n}\n\n.min-width-20 {\n  min-width: 20rem;\n}\n\n.gf-form-select-wrapper select.gf-form-input {\n  height: 2.64rem;\n}\n\n.gf-form-select-wrapper--caret-indent.gf-form-select-wrapper::after {\n  right: 0.775rem;\n}\n\n.gf-tabs-cognite.active:before,\n.gf-tabs-cognite.active:focus:before,\n.gf-tabs-cognite.active:hover:before {\n  background-image: linear-gradient(90deg, #33b5e5 0, #00b3ff 99%, #1b1b1b);\n}\n\ninput[type='checkbox'] {\n  margin: 4px;\n}\n\n.custom-query {\n  font-family: monospace;\n}\n\npre code {\n  line-height: 2;\n}\n\n.cognite-timeseries-list-checkbox {\n  margin-right: 10px;\n}\n"
          ]
        }
      ]);
    },
    function(e, t, r) {
      "use strict";
      e.exports = function(e) {
        var t = [];
        return (
          (t.toString = function() {
            return this.map(function(t) {
              var r = (function(e, t) {
                var r = e[1] || "",
                  n = e[3];
                if (!n) return r;
                if (t && "function" == typeof btoa) {
                  var a = ((o = n),
                    "/*# sourceMappingURL=data:application/json;charset=utf-8;base64," +
                      btoa(unescape(encodeURIComponent(JSON.stringify(o)))) +
                      " */"),
                    i = n.sources.map(function(e) {
                      return "/*# sourceURL=" + n.sourceRoot + e + " */";
                    });
                  return [r]
                    .concat(i)
                    .concat([a])
                    .join("\n");
                }
                var o;
                return [r].join("\n");
              })(t, e);
              return t[2] ? "@media " + t[2] + "{" + r + "}" : r;
            }).join("");
          }),
          (t.i = function(e, r) {
            "string" == typeof e && (e = [[null, e, ""]]);
            for (var n = {}, a = 0; a < this.length; a++) {
              var i = this[a][0];
              null != i && (n[i] = !0);
            }
            for (a = 0; a < e.length; a++) {
              var o = e[a];
              (null != o[0] && n[o[0]]) ||
                (r && !o[2]
                  ? (o[2] = r)
                  : r && (o[2] = "(" + o[2] + ") and (" + r + ")"),
                t.push(o));
            }
          }),
          t
        );
      };
    },
    function(e, t, r) {
      var n,
        a,
        i = {},
        o = ((n = function() {
          return window && document && document.all && !window.atob;
        }),
        function() {
          return void 0 === a && (a = n.apply(this, arguments)), a;
        }),
        s = (function(e) {
          var t = {};
          return function(e, r) {
            if ("function" == typeof e) return e();
            if (void 0 === t[e]) {
              var n = function(e, t) {
                return t ? t.querySelector(e) : document.querySelector(e);
              }.call(this, e, r);
              if (
                window.HTMLIFrameElement &&
                n instanceof window.HTMLIFrameElement
              )
                try {
                  n = n.contentDocument.head;
                } catch (e) {
                  n = null;
                }
              t[e] = n;
            }
            return t[e];
          };
        })(),
        u = null,
        l = 0,
        c = [],
        f = r(14);
      function p(e, t) {
        for (var r = 0; r < e.length; r++) {
          var n = e[r],
            a = i[n.id];
          if (a) {
            a.refs++;
            for (var o = 0; o < a.parts.length; o++) a.parts[o](n.parts[o]);
            for (; o < n.parts.length; o++) a.parts.push(y(n.parts[o], t));
          } else {
            var s = [];
            for (o = 0; o < n.parts.length; o++) s.push(y(n.parts[o], t));
            i[n.id] = { id: n.id, refs: 1, parts: s };
          }
        }
      }
      function d(e, t) {
        for (var r = [], n = {}, a = 0; a < e.length; a++) {
          var i = e[a],
            o = t.base ? i[0] + t.base : i[0],
            s = { css: i[1], media: i[2], sourceMap: i[3] };
          n[o] ? n[o].parts.push(s) : r.push((n[o] = { id: o, parts: [s] }));
        }
        return r;
      }
      function g(e, t) {
        var r = s(e.insertInto);
        if (!r)
          throw new Error(
            "Couldn't find a style target. This probably means that the value for the 'insertInto' parameter is invalid."
          );
        var n = c[c.length - 1];
        if ("top" === e.insertAt)
          n
            ? n.nextSibling
              ? r.insertBefore(t, n.nextSibling)
              : r.appendChild(t)
            : r.insertBefore(t, r.firstChild),
            c.push(t);
        else if ("bottom" === e.insertAt) r.appendChild(t);
        else {
          if ("object" != typeof e.insertAt || !e.insertAt.before)
            throw new Error(
              "[Style Loader]\n\n Invalid value for parameter 'insertAt' ('options.insertAt') found.\n Must be 'top', 'bottom', or Object.\n (https://github.com/webpack-contrib/style-loader#insertat)\n"
            );
          var a = s(e.insertAt.before, r);
          r.insertBefore(t, a);
        }
      }
      function h(e) {
        if (null === e.parentNode) return !1;
        e.parentNode.removeChild(e);
        var t = c.indexOf(e);
        t >= 0 && c.splice(t, 1);
      }
      function m(e) {
        var t = document.createElement("style");
        if (
          (void 0 === e.attrs.type && (e.attrs.type = "text/css"),
          void 0 === e.attrs.nonce)
        ) {
          var n = (function() {
            0;
            return r.nc;
          })();
          n && (e.attrs.nonce = n);
        }
        return v(t, e.attrs), g(e, t), t;
      }
      function v(e, t) {
        Object.keys(t).forEach(function(r) {
          e.setAttribute(r, t[r]);
        });
      }
      function y(e, t) {
        var r, n, a, i;
        if (t.transform && e.css) {
          if (
            !(i =
              "function" == typeof t.transform
                ? t.transform(e.css)
                : t.transform.default(e.css))
          )
            return function() {};
          e.css = i;
        }
        if (t.singleton) {
          var o = l++;
          (r = u || (u = m(t))),
            (n = T.bind(null, r, o, !1)),
            (a = T.bind(null, r, o, !0));
        } else
          e.sourceMap &&
          "function" == typeof URL &&
          "function" == typeof URL.createObjectURL &&
          "function" == typeof URL.revokeObjectURL &&
          "function" == typeof Blob &&
          "function" == typeof btoa
            ? ((r = (function(e) {
                var t = document.createElement("link");
                return (
                  void 0 === e.attrs.type && (e.attrs.type = "text/css"),
                  (e.attrs.rel = "stylesheet"),
                  v(t, e.attrs),
                  g(e, t),
                  t
                );
              })(t)),
              (n = function(e, t, r) {
                var n = r.css,
                  a = r.sourceMap,
                  i = void 0 === t.convertToAbsoluteUrls && a;
                (t.convertToAbsoluteUrls || i) && (n = f(n));
                a &&
                  (n +=
                    "\n/*# sourceMappingURL=data:application/json;base64," +
                    btoa(unescape(encodeURIComponent(JSON.stringify(a)))) +
                    " */");
                var o = new Blob([n], { type: "text/css" }),
                  s = e.href;
                (e.href = URL.createObjectURL(o)), s && URL.revokeObjectURL(s);
              }.bind(null, r, t)),
              (a = function() {
                h(r), r.href && URL.revokeObjectURL(r.href);
              }))
            : ((r = m(t)),
              (n = function(e, t) {
                var r = t.css,
                  n = t.media;
                n && e.setAttribute("media", n);
                if (e.styleSheet) e.styleSheet.cssText = r;
                else {
                  for (; e.firstChild; ) e.removeChild(e.firstChild);
                  e.appendChild(document.createTextNode(r));
                }
              }.bind(null, r)),
              (a = function() {
                h(r);
              }));
        return (
          n(e),
          function(t) {
            if (t) {
              if (
                t.css === e.css &&
                t.media === e.media &&
                t.sourceMap === e.sourceMap
              )
                return;
              n((e = t));
            } else a();
          }
        );
      }
      e.exports = function(e, t) {
        if ("undefined" != typeof DEBUG && DEBUG && "object" != typeof document)
          throw new Error(
            "The style-loader cannot be used in a non-browser environment"
          );
        ((t = t || {}).attrs = "object" == typeof t.attrs ? t.attrs : {}),
          t.singleton || "boolean" == typeof t.singleton || (t.singleton = o()),
          t.insertInto || (t.insertInto = "head"),
          t.insertAt || (t.insertAt = "bottom");
        var r = d(e, t);
        return (
          p(r, t),
          function(e) {
            for (var n = [], a = 0; a < r.length; a++) {
              var o = r[a];
              (s = i[o.id]).refs--, n.push(s);
            }
            e && p(d(e, t), t);
            for (a = 0; a < n.length; a++) {
              var s;
              if (0 === (s = n[a]).refs) {
                for (var u = 0; u < s.parts.length; u++) s.parts[u]();
                delete i[s.id];
              }
            }
          }
        );
      };
      var b,
        A = ((b = []),
        function(e, t) {
          return (b[e] = t), b.filter(Boolean).join("\n");
        });
      function T(e, t, r, n) {
        var a = r ? "" : n.css;
        if (e.styleSheet) e.styleSheet.cssText = A(t, a);
        else {
          var i = document.createTextNode(a),
            o = e.childNodes;
          o[t] && e.removeChild(o[t]),
            o.length ? e.insertBefore(i, o[t]) : e.appendChild(i);
        }
      }
    },
    function(e, t) {
      e.exports = function(e) {
        var t = "undefined" != typeof window && window.location;
        if (!t) throw new Error("fixUrls requires window.location");
        if (!e || "string" != typeof e) return e;
        var r = t.protocol + "//" + t.host,
          n = r + t.pathname.replace(/\/[^\/]*$/, "/");
        return e.replace(
          /url\s*\(((?:[^)(]|\((?:[^)(]+|\([^)(]*\))*\))*)\)/gi,
          function(e, t) {
            var a,
              i = t
                .trim()
                .replace(/^"(.*)"$/, function(e, t) {
                  return t;
                })
                .replace(/^'(.*)'$/, function(e, t) {
                  return t;
                });
            return /^(#|data:|http:\/\/|https:\/\/|file:\/\/\/|\s*$)/i.test(i)
              ? e
              : ((a =
                  0 === i.indexOf("//")
                    ? i
                    : 0 === i.indexOf("/")
                    ? r + i
                    : n + i.replace(/^\.\//, "")),
                "url(" + JSON.stringify(a) + ")");
          }
        );
      };
    },
    function(e, t, r) {
      "use strict";
      Object.defineProperty(t, "__esModule", { value: !0 });
      var n = (function() {
        function e(e) {}
        return (
          (e.$inject = ["$scope"]), (e.templateUrl = "partials/config.html"), e
        );
      })();
      t.CogniteConfigCtrl = n;
    },
    function(e, t, r) {
      "use strict";
      var n = function(e) {
        return e && e.__esModule ? e : { default: e };
      };
      Object.defineProperty(t, "__esModule", { value: !0 });
      var a = n(r(2)),
        i = (function() {
          function e() {}
          return (
            (e.prototype.verify = function() {
              this.annotation.error = "";
              var e,
                t = { error: "" };
              this.annotation.expr
                ? (e = this.annotation.expr.match(/^event\{(.*)\}$/))
                  ? a.default.splitFilters(e[1], t, !0) ||
                    (this.annotation.error =
                      t.error + " | Expected format: event{param=value,...}")
                  : (this.annotation.error =
                      "Error: Unable to parse " +
                      this.annotation.expr +
                      " | Expected format: event{param=value,...}")
                : (this.annotation.error = "Error: Query expression required.");
              !this.annotation.error &&
                this.annotation.filter &&
                ((e = this.annotation.filter.match(/^filter\{(.*)\}$/))
                  ? a.default.splitFilters(e[1], t, !1) ||
                    (this.annotation.error =
                      t.error +
                      " | Expected format: filter{property [=|!=|=~|!~] value,...}")
                  : (this.annotation.error =
                      "Error: Unable to parse " +
                      this.annotation.filter +
                      " | Expected format: filter{property [=|!=|=~|!~] value,...}"));
            }),
            (e.templateUrl = "partials/annotations.editor.html"),
            e
          );
        })();
      t.CogniteAnnotationsQueryCtrl = i;
    },
    function(e, t, r) {
      "use strict";
      var n,
        a = ((n = function(e, t) {
          return (n =
            Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array &&
              function(e, t) {
                e.__proto__ = t;
              }) ||
            function(e, t) {
              for (var r in t) t.hasOwnProperty(r) && (e[r] = t[r]);
            })(e, t);
        }),
        function(e, t) {
          function r() {
            this.constructor = e;
          }
          n(e, t),
            (e.prototype =
              null === t
                ? Object.create(t)
                : ((r.prototype = t.prototype), new r()));
        }),
        i = function(e) {
          return e && e.__esModule ? e : { default: e };
        };
      Object.defineProperty(t, "__esModule", { value: !0 });
      var o = i(r(18)),
        s = (function(e) {
          function t(t) {
            var r = e.call(this, t) || this;
            return (
              (r.defaults = { query: "", filter: "" }),
              (r.state = Object.assign(r.defaults, r.props.query)),
              r
            );
          }
          return (
            a(t, e),
            (t.prototype.handleChange = function(e, t) {
              var r,
                n = (((r = {})[t] = e.target.value), r);
              this.setState(n);
            }),
            (t.prototype.handleBlur = function() {
              this.props.onChange(this.state, this.state.query);
            }),
            (t.prototype.render = function() {
              var e = this;
              return o.default.createElement(
                "div",
                null,
                o.default.createElement(
                  "div",
                  { className: "gf-form gf-form--grow" },
                  o.default.createElement(
                    "span",
                    {
                      className:
                        "gf-form-label query-keyword fix-query-keyword width-10"
                    },
                    "Query"
                  ),
                  o.default.createElement("input", {
                    type: "text",
                    className: "gf-form-input",
                    value: this.state.query,
                    onChange: function(t) {
                      return e.handleChange(t, "query");
                    },
                    onBlur: function(t) {
                      return e.handleBlur();
                    },
                    placeholder:
                      "eg: asset{name='example', assetSubtrees=[123456789]}",
                    required: !0
                  })
                ),
                o.default.createElement(
                  "div",
                  { className: "gf-form gf-form--grow" },
                  o.default.createElement(
                    "span",
                    {
                      className:
                        "gf-form-label query-keyword fix-query-keyword width-10"
                    },
                    "Filter"
                  ),
                  o.default.createElement("input", {
                    type: "text",
                    className: "gf-form-input",
                    value: this.state.filter,
                    onChange: function(t) {
                      return e.handleChange(t, "filter");
                    },
                    onBlur: function(t) {
                      return e.handleBlur();
                    },
                    placeholder:
                      "eg: filter{name=~'.*test.*', isStep=1, metadata.key1!=false}"
                  })
                ),
                o.default.createElement(
                  "div",
                  { className: "gf-form--grow" },
                  o.default.createElement(
                    "pre",
                    null,
                    "  Query for assets using the '/assets/search' endpoint\n    Format is asset{param=value,...}\n  Then, filter on these assets\n    Format is filter{property comparator value,...}\n    Comparator can be =, !=, =~, !~ "
                  )
                )
              );
            }),
            t
          );
        })(o.default.PureComponent);
      t.CogniteVariableQueryCtrl = s;
    },
    function(e, t) {
      e.exports = n;
    }
  ]);
});
//# sourceMappingURL=module.js.map
