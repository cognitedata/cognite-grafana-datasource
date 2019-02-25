define(["lodash", "app/core/utils/datemath", "app/plugins/sdk"], function(
  e,
  t,
  r
) {
  return (function(e) {
    var t = {};
    function r(n) {
      if (t[n]) return t[n].exports;
      var o = (t[n] = { i: n, l: !1, exports: {} });
      return e[n].call(o.exports, o, o.exports, r), (o.l = !0), o.exports;
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
          for (var o in e)
            r.d(
              n,
              o,
              function(t) {
                return e[t];
              }.bind(null, o)
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
      var n = function() {
          return (n =
            Object.assign ||
            function(e) {
              for (var t, r = 1, n = arguments.length; r < n; r++)
                for (var o in (t = arguments[r]))
                  Object.prototype.hasOwnProperty.call(t, o) && (e[o] = t[o]);
              return e;
            }).apply(this, arguments);
        },
        o = function(e, t, r, n) {
          return new (r || (r = Promise))(function(o, i) {
            function a(e) {
              try {
                s(n.next(e));
              } catch (e) {
                i(e);
              }
            }
            function u(e) {
              try {
                s(n.throw(e));
              } catch (e) {
                i(e);
              }
            }
            function s(e) {
              e.done
                ? o(e.value)
                : new r(function(t) {
                    t(e.value);
                  }).then(a, u);
            }
            s((n = n.apply(e, t || [])).next());
          });
        },
        i = function(e, t) {
          var r,
            n,
            o,
            i,
            a = {
              label: 0,
              sent: function() {
                if (1 & o[0]) throw o[1];
                return o[1];
              },
              trys: [],
              ops: []
            };
          return (
            (i = { next: u(0), throw: u(1), return: u(2) }),
            "function" == typeof Symbol &&
              (i[Symbol.iterator] = function() {
                return this;
              }),
            i
          );
          function u(i) {
            return function(u) {
              return (function(i) {
                if (r) throw new TypeError("Generator is already executing.");
                for (; a; )
                  try {
                    if (
                      ((r = 1),
                      n &&
                        (o =
                          2 & i[0]
                            ? n.return
                            : i[0]
                            ? n.throw || ((o = n.return) && o.call(n), 0)
                            : n.next) &&
                        !(o = o.call(n, i[1])).done)
                    )
                      return o;
                    switch (((n = 0), o && (i = [2 & i[0], o.value]), i[0])) {
                      case 0:
                      case 1:
                        o = i;
                        break;
                      case 4:
                        return a.label++, { value: i[1], done: !1 };
                      case 5:
                        a.label++, (n = i[1]), (i = [0]);
                        continue;
                      case 7:
                        (i = a.ops.pop()), a.trys.pop();
                        continue;
                      default:
                        if (
                          !(o = (o = a.trys).length > 0 && o[o.length - 1]) &&
                          (6 === i[0] || 2 === i[0])
                        ) {
                          a = 0;
                          continue;
                        }
                        if (
                          3 === i[0] &&
                          (!o || (i[1] > o[0] && i[1] < o[3]))
                        ) {
                          a.label = i[1];
                          break;
                        }
                        if (6 === i[0] && a.label < o[1]) {
                          (a.label = o[1]), (o = i);
                          break;
                        }
                        if (o && a.label < o[2]) {
                          (a.label = o[2]), a.ops.push(i);
                          break;
                        }
                        o[2] && a.ops.pop(), a.trys.pop();
                        continue;
                    }
                    i = t.call(e, a);
                  } catch (e) {
                    (i = [6, e]), (n = 0);
                  } finally {
                    r = o = 0;
                  }
                if (5 & i[0]) throw i[1];
                return { value: i[0] ? i[1] : void 0, done: !0 };
              })([i, u]);
            };
          }
        },
        a = function(e) {
          return e && e.__esModule ? e : { default: e };
        },
        u = function(e) {
          if (e && e.__esModule) return e;
          var t = {};
          if (null != e)
            for (var r in e) Object.hasOwnProperty.call(e, r) && (t[r] = e[r]);
          return (t.default = e), t;
        };
      Object.defineProperty(t, "__esModule", { value: !0 });
      var s,
        l,
        c = a(r(1)),
        f = u(r(4)),
        p = a(r(2)),
        d = a(r(5));
      function h(e) {
        return void 0 !== e.error;
      }
      !(function(e) {
        (e.Timeseries = "Timeseries"),
          (e.Asset = "Asset"),
          (e.Custom = "Custom");
      })((s = t.Tab || (t.Tab = {}))),
        (function(e) {
          (e.Timeseries = "Timeseries"),
            (e.Asset = "Asset"),
            (e.Event = "Event");
        })(l || (l = {})),
        (t.isError = h);
      var m = (function() {
        function e(e, t, r, n) {
          (this.$q = t),
            (this.backendSrv = r),
            (this.templateSrv = n),
            (this.id = e.id),
            (this.url = e.url),
            (this.project = e.jsonData.cogniteProject),
            (this.q = t),
            (this.name = e.name);
        }
        return (
          (e.$inject = ["instanceSettings", "$q", "backendSrv", "templateSrv"]),
          (e.prototype.intervalToGranularity = function(e) {
            var t = Math.round(e / 1e3);
            if (t <= 60) return t <= 1 ? "1s" : t + "s";
            var r = Math.round(e / 1e3 / 60);
            if (r < 60) return r + "m";
            var n = Math.round(e / 1e3 / 60 / 60);
            return n <= 24 ? n + "h" : Math.round(e / 1e3 / 60 / 60 / 24) + "d";
          }),
          (e.prototype.getDataQueryRequestItems = function(e, t) {
            return o(this, void 0, void 0, function() {
              var r = this;
              return i(this, function(n) {
                switch (n.label) {
                  case 0:
                    return e.tab === s.Timeseries || void 0 === e.tab
                      ? [2, [{ name: e.target }]]
                      : e.tab !== s.Asset && e.tab !== s.Custom
                      ? [3, 2]
                      : [4, this.findAssetTimeseries(e)];
                  case 1:
                    return (
                      n.sent(),
                      e.tab === s.Custom && this.filterOnAssetTimeseries(e),
                      [
                        2,
                        e.assetQuery.timeseries.reduce(function(n, o) {
                          if (!o.selected) return n;
                          var i = { name: o.name };
                          if (e.tab === s.Custom && e.assetQuery.func) {
                            i.function = e.assetQuery.func.replace(
                              /ID/g,
                              String(o.id)
                            );
                            var a = i.function.match(/\[.*?\]/g);
                            if (((i.aliases = []), a))
                              for (
                                var u = function(e) {
                                    var n = e
                                      .substr(1, e.length - 2)
                                      .split(",")
                                      .filter(function(e) {
                                        return e.length;
                                      })
                                      .map(function(e) {
                                        return c.default.trim(e, " '\"");
                                      });
                                    if (1 === n.length) return "continue";
                                    var o = {
                                      alias: "alias" + n.join("_"),
                                      id: Number(n[0])
                                    };
                                    if (
                                      ((o.aggregate = n[1]),
                                      (o.granularity =
                                        n[2] ||
                                        r.intervalToGranularity(t.intervalMs)),
                                      (i.function = i.function.replace(
                                        e,
                                        "[" + o.alias + "]"
                                      )),
                                      i.aliases.find(function(e) {
                                        return e.alias === o.alias;
                                      }))
                                    )
                                      return "continue";
                                    i.aliases.push(o);
                                  },
                                  l = 0,
                                  f = a;
                                l < f.length;
                                l++
                              ) {
                                u(f[l]);
                              }
                          }
                          return n.concat(i);
                        }, [])
                      ]
                    );
                  case 2:
                    return [2, []];
                }
              });
            });
          }),
          (e.prototype.query = function(e) {
            return o(this, void 0, void 0, function() {
              var t,
                r,
                n,
                o,
                a,
                u,
                l,
                c,
                m,
                y,
                v,
                g,
                b,
                w,
                A,
                S,
                C,
                x,
                E,
                O,
                j = this;
              return i(this, function(_) {
                switch (_.label) {
                  case 0:
                    if (
                      0 ===
                      (t = e.targets.reduce(function(e, t) {
                        return (
                          (t.error = ""),
                          t &&
                          !t.hide &&
                          ((t.tab !== s.Timeseries && void 0 !== t.tab) ||
                            (t.target &&
                              "Start typing tag id here" !== t.target)) &&
                          ((t.tab !== s.Asset && t.tab !== s.Custom) ||
                            (t.assetQuery && "" !== t.assetQuery.target))
                            ? e.concat(t)
                            : e
                        );
                      }, [])).length
                    )
                      return [2, Promise.resolve({ data: [] })];
                    for (
                      r = Math.ceil(f.parse(e.range.from)),
                        n = Math.ceil(f.parse(e.range.to)),
                        o = [],
                        a = [],
                        u = [],
                        l = 0,
                        c = t;
                      l < c.length;
                      l++
                    )
                      (S = c[l]), u.push(this.getDataQueryRequestItems(S, e));
                    return [4, Promise.all(u)];
                  case 1:
                    (m = _.sent()),
                      (y = []),
                      (v = function(t, u) {
                        var l, c, f, p, d, h, m, v, b, w, A, S, C;
                        return i(this, function(i) {
                          switch (i.label) {
                            case 0:
                              if (0 === u.length) return [2, "continue"];
                              if (
                                (o.push({ refId: t.refId, count: u.length }),
                                (l = { items: u, start: r, end: n }),
                                t.aggregation &&
                                  "none" !== t.aggregation &&
                                  ((l.aggregates = t.aggregation),
                                  t.granularity
                                    ? (l.granularity = t.granularity)
                                    : (l.granularity = g.intervalToGranularity(
                                        e.intervalMs
                                      ))),
                                t.assetQuery &&
                                  t.assetQuery.func &&
                                  t.tab === s.Custom)
                              ) {
                                if (l.aggregates)
                                  return (
                                    (t.error =
                                      "[ERROR] To use aggregations with functions, use [ID,aggregation,granularity] or [ID,aggregation]"),
                                    o.pop(),
                                    [2, "continue"]
                                  );
                                for (
                                  c = 0, f = /\[.*?\]/g, p = 0, d = u;
                                  p < d.length &&
                                  ((h = d[p]), (m = h.function.match(f)));
                                  p++
                                ) {
                                  for (v = {}, b = 0, w = m; b < w.length; b++)
                                    (A = w[b]),
                                      (v[A.substr(1, A.length - 2)] = !0);
                                  c += Object.keys(v).length;
                                }
                                0 === c && (c = 1),
                                  (S = u.some(function(e) {
                                    return e.aliases.length > 0;
                                  })),
                                  (l.limit = Math.floor((S ? 1e4 : 1e5) / c));
                              } else l.limit = Math.floor((l.aggregates ? 1e4 : 1e5) / u.length);
                              if (
                                (y.push(l),
                                t.tab !== s.Timeseries && void 0 !== t.tab)
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
                                [4, g.getTimeseries({ q: t.target, limit: 1 })]
                              );
                            case 2:
                              return (
                                (C = i.sent()),
                                a.push(g.getTimeseriesLabel(t.label, C[0])),
                                [3, 4]
                              );
                            case 3:
                              return i.sent(), a.push(t.label), [3, 4];
                            case 4:
                              return [3, 6];
                            case 5:
                              a.push(t.label), (i.label = 6);
                            case 6:
                              return [3, 8];
                            case 7:
                              t.assetQuery.timeseries.forEach(function(e) {
                                e.selected &&
                                  (t.label || (t.label = ""),
                                  a.push(j.getTimeseriesLabel(t.label, e)));
                              }),
                                (i.label = 8);
                            case 8:
                              return [2];
                          }
                        });
                      }),
                      (g = this),
                      (b = 0),
                      (w = m.map(function(e, r) {
                        return [t[r], e];
                      })),
                      (_.label = 2);
                  case 2:
                    return b < w.length
                      ? ((A = w[b]), (S = A[0]), (C = A[1]), [5, v(S, C)])
                      : [3, 5];
                  case 3:
                    _.sent(), (_.label = 4);
                  case 4:
                    return b++, [3, 2];
                  case 5:
                    (x = y.map(function(e) {
                      return d.default
                        .getQuery(
                          {
                            url:
                              j.url +
                              "/cogniteapi/" +
                              j.project +
                              "/timeseries/dataquery",
                            method: "POST",
                            data: e
                          },
                          j.backendSrv
                        )
                        .catch(function(e) {
                          return { error: e };
                        });
                    })),
                      (_.label = 6);
                  case 6:
                    return _.trys.push([6, 8, , 9]), [4, Promise.all(x)];
                  case 7:
                    return (E = _.sent()), [3, 9];
                  case 8:
                    return _.sent(), [2, { data: [] }];
                  case 9:
                    return (
                      (O = 0),
                      [
                        2,
                        {
                          data: E.reduce(function(e, i, u) {
                            var s = o[u].refId,
                              l = t.find(function(e) {
                                return e.refId === s;
                              });
                            if (h(i)) {
                              var c = void 0;
                              return (
                                (c =
                                  i.error.data && i.error.data.error
                                    ? "[" +
                                      i.error.status +
                                      " ERROR] " +
                                      i.error.data.error.message
                                    : "Unknown error"),
                                (l.error = c),
                                e
                              );
                            }
                            var f = i.config.data.aggregates,
                              d = f ? f + " " : "";
                            return e.concat(
                              i.data.data.items.map(function(e) {
                                return {
                                  target: a[O++] ? a[O - 1] : d + e.name,
                                  datapoints: e.datapoints
                                    .filter(function(e) {
                                      return (
                                        e.timestamp >= r && e.timestamp <= n
                                      );
                                    })
                                    .map(function(e) {
                                      var t = p.default.getDatasourceValueString(
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
          (e.prototype.annotationQuery = function(e) {
            return o(this, void 0, void 0, function() {
              var t, r, o, a, u, s, c, h, m, y, v, g;
              return i(this, function(i) {
                switch (i.label) {
                  case 0:
                    return (
                      (t = e.range),
                      (r = e.annotation),
                      (o = r.expr),
                      (a = r.filter),
                      (u = r.error),
                      (s = Math.ceil(f.parse(t.from))),
                      (c = Math.ceil(f.parse(t.to))),
                      u || !o
                        ? [2, []]
                        : (h = this.parse(o, l.Event)).error
                        ? [2, [{ value: h.error }]]
                        : ((m = this.parse(a || "", l.Event)),
                          a && m.error
                            ? [2, [{ value: m.error }]]
                            : ((y = n(
                                { limit: 1e3, maxStartTime: c, minEndTime: s },
                                h.filters.reduce(function(e, t) {
                                  return (e[t.property] = t.value), e;
                                }, {})
                              )),
                              [
                                4,
                                d.default.getQuery(
                                  {
                                    url:
                                      this.url +
                                      "/cogniteapi/" +
                                      this.project +
                                      "/events/search?" +
                                      p.default.getQueryString(y),
                                    method: "GET"
                                  },
                                  this.backendSrv
                                )
                              ]))
                    );
                  case 1:
                    return (
                      (v = i.sent()),
                      (g = v.data.data.items) && 0 !== g.length
                        ? (this.applyFilters(m.filters, g),
                          [
                            2,
                            g
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
          (e.prototype.metricFindQuery = function(e) {
            return o(this, void 0, void 0, function() {
              return i(this, function(t) {
                return [2, this.getAssetsForMetrics(e)];
              });
            });
          }),
          (e.prototype.getOptionsForDropdown = function(e, t, r) {
            return o(this, void 0, void 0, function() {
              var n;
              return i(this, function(o) {
                return (
                  t === s.Asset
                    ? (n =
                        0 === e.length
                          ? "/cogniteapi/" + this.project + "/assets?"
                          : "/cogniteapi/" +
                            this.project +
                            "/assets/search?query=" +
                            e)
                    : t === s.Timeseries &&
                      (n =
                        0 === e.length
                          ? "/cogniteapi/" +
                            this.project +
                            "/timeseries?limit=1000"
                          : "/cogniteapi/" +
                            this.project +
                            "/timeseries/search?query=" +
                            e),
                  r && (n += "&" + p.default.getQueryString(r)),
                  [
                    2,
                    d.default
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
                            value: t === s.Asset ? String(e.id) : e.name
                          };
                        });
                      })
                  ]
                );
              });
            });
          }),
          (e.prototype.findAssetTimeseries = function(e) {
            return o(this, void 0, void 0, function() {
              var t, r, n, o, a, u;
              return i(this, function(i) {
                switch (i.label) {
                  case 0:
                    for (
                      t = e.assetQuery.target,
                        r = 0,
                        n = this.templateSrv.variables;
                      r < n.length;
                      r++
                    )
                      (o = n[r]),
                        (t = (t = t.replace(
                          "[[" + o.name + "]]",
                          o.current.value
                        )).replace("$" + o.name, o.current.value));
                    return e.assetQuery.old &&
                      t === e.assetQuery.old.target &&
                      e.assetQuery.includeSubtrees ===
                        e.assetQuery.old.includeSubtrees
                      ? [2, Promise.resolve()]
                      : ((e.assetQuery.old = {}),
                        (e.assetQuery.old.target = String(t)),
                        (e.assetQuery.old.includeSubtrees =
                          e.assetQuery.includeSubtrees),
                        (a = {
                          path: e.assetQuery.includeSubtrees ? [t] : void 0,
                          assetId: e.assetQuery.includeSubtrees ? void 0 : t,
                          limit: 1e4
                        }),
                        [4, this.getTimeseries(a)]);
                  case 1:
                    return (
                      (u = i.sent()),
                      (e.assetQuery.timeseries = u.map(function(e) {
                        return (e.selected = !0), e;
                      })),
                      [2]
                    );
                }
              });
            });
          }),
          (e.prototype.getTimeseries = function(e) {
            return o(this, void 0, void 0, function() {
              return i(this, function(t) {
                return [
                  2,
                  d.default
                    .getQuery(
                      {
                        url:
                          this.url +
                          "/cogniteapi/" +
                          this.project +
                          "/timeseries?" +
                          p.default.getQueryString(e),
                        method: "GET"
                      },
                      this.backendSrv
                    )
                    .then(function(e) {
                      return c.default.cloneDeep(
                        e.data.data.items.filter(function(e) {
                          return !e.isString;
                        })
                      );
                    })
                ];
              });
            });
          }),
          (e.prototype.filterOnAssetTimeseries = function(e) {
            var t = this.parse(e.expr, l.Timeseries),
              r = t.filters.find(function(e) {
                return "function" === e.property;
              });
            r
              ? ((t.filters = t.filters.filter(function(e) {
                  return "function" !== e.property;
                })),
                (e.assetQuery.func = r.value))
              : (e.assetQuery.func = ""),
              this.applyFilters(t.filters, e.assetQuery.timeseries),
              (e.aggregation = t.aggregation),
              (e.granularity = t.granularity);
          }),
          (e.prototype.getAssetsForMetrics = function(e) {
            return o(this, void 0, void 0, function() {
              var t, r, o, a, u, s;
              return i(this, function(i) {
                switch (i.label) {
                  case 0:
                    return (t = this.parse(e.query, l.Asset)).error
                      ? [2, [{ value: t.error }]]
                      : ((r = this.parse(e.filter, l.Asset)),
                        e.filter && r.error
                          ? [2, [{ value: r.error }]]
                          : ((o =
                              "/cogniteapi/" +
                              this.project +
                              "/assets/search?"),
                            (a = n(
                              { limit: 1e3 },
                              t.filters.reduce(function(e, t) {
                                return (e[t.property] = t.value), e;
                              }, {})
                            )),
                            [
                              4,
                              d.default.getQuery(
                                {
                                  url:
                                    this.url + o + p.default.getQueryString(a),
                                  method: "GET"
                                },
                                this.backendSrv
                              )
                            ]));
                  case 1:
                    return (
                      (u = i.sent()),
                      (s = u.data.data.items),
                      this.applyFilters(r.filters, s),
                      [
                        2,
                        s
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
          (e.prototype.parse = function(e, t) {
            var r = e;
            if (t === l.Timeseries || t === l.Event)
              for (
                var n = 0, o = this.templateSrv.variables;
                n < o.length;
                n++
              ) {
                var i = o[n];
                r = (r = r.replace(
                  "[[" + i.name + "]]",
                  i.current.value
                )).replace("$" + i.name, i.current.value);
              }
            var a,
              u = { filters: [], granularity: "", aggregation: "", error: "" },
              s = r.match(/^timeseries\{(.*)\}(?:\[(.*)\])?$/),
              f = r.match(/^(?:asset|event)\{(.*)\}$/),
              d = r.match(/^filter\{(.*)\}$/);
            if (
              (s
                ? (a = p.default.splitFilters(s[1], u, !1))
                : f
                ? (a = p.default.splitFilters(f[1], u, !0))
                : d
                ? (a = p.default.splitFilters(d[1], u, !1))
                : (u.error = "ERROR: Unable to parse expression " + r),
              u.error)
            )
              return u;
            for (var h = 0, m = a; h < m.length; h++) {
              var y = m[h];
              if ("" !== (y = c.default.trim(y, " "))) {
                var v = {},
                  g = void 0;
                (g = y.indexOf("=~")) > -1
                  ? ((v.property = c.default.trim(y.substr(0, g), " '\"")),
                    (v.value = c.default.trim(y.substr(g + 2), " '\"")),
                    (v.type = "=~"))
                  : (g = y.indexOf("!~")) > -1
                  ? ((v.property = c.default.trim(y.substr(0, g), " '\"")),
                    (v.value = c.default.trim(y.substr(g + 2), " '\"")),
                    (v.type = "!~"))
                  : (g = y.indexOf("!=")) > -1
                  ? ((v.property = c.default.trim(y.substr(0, g), " '\"")),
                    (v.value = c.default.trim(y.substr(g + 2), " '\"")),
                    (v.type = "!="))
                  : (g = y.indexOf("=")) > -1
                  ? ((v.property = c.default.trim(y.substr(0, g), " '\"")),
                    (v.value = c.default.trim(y.substr(g + 1), " '\"")),
                    (v.type = "="))
                  : console.error("Error parsing " + y),
                  u.filters.push(v);
              }
            }
            if (s) {
              var b = s[2];
              if (b) {
                var w = b.split(",");
                (u.aggregation = c.default.trim(w[0], " '\"").toLowerCase()),
                  (u.granularity =
                    w.length > 1 ? c.default.trim(w[1], " '\"") : "");
              }
            }
            return u;
          }),
          (e.prototype.applyFilters = function(e, t) {
            for (var r = 0, n = t; r < n.length; r++) {
              var o = n[r];
              o.selected = !0;
              for (var i = 0, a = e; i < a.length; i++) {
                var u = a[i];
                if ("=~" === u.type) {
                  var s = c.default.get(o, u.property),
                    l = "^" + u.value + "$";
                  if (void 0 === s || !s.match(l)) {
                    o.selected = !1;
                    break;
                  }
                } else if ("!~" === u.type) {
                  (s = c.default.get(o, u.property)), (l = "^" + u.value + "$");
                  if (void 0 === s || s.match(l)) {
                    o.selected = !1;
                    break;
                  }
                } else if ("!=" === u.type) {
                  if (
                    void 0 === (s = c.default.get(o, u.property)) ||
                    String(s) === u.value
                  ) {
                    o.selected = !1;
                    break;
                  }
                } else if ("=" === u.type) {
                  if (
                    void 0 === (s = c.default.get(o, u.property)) ||
                    String(s) !== u.value
                  ) {
                    o.selected = !1;
                    break;
                  }
                }
              }
            }
          }),
          (e.prototype.getTimeseriesLabel = function(e, t) {
            return e.replace(/{{([^{}]*)}}/g, function(e, r) {
              return c.default.get(t, r, e);
            });
          }),
          (e.prototype.testDatasource = function() {
            return this.backendSrv
              .datasourceRequest({
                url: this.url + "/cogniteloginstatus",
                method: "GET"
              })
              .then(function(e) {
                if (200 === e.status)
                  return e.data.data.loggedIn
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
      t.default = m;
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
        o = function(e) {
          return e && e.__esModule ? e : { default: e };
        };
      Object.defineProperty(t, "__esModule", { value: !0 });
      var i = o(r(1)),
        a = (function() {
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
            (e.splitFilters = function(e, t, r) {
              for (
                var o,
                  i = [],
                  a = ["(", "[", "{", "'", '"'],
                  u = [")", "]", "}", "'", '"'],
                  s = 0,
                  l = function(n) {
                    if (n === e.length || "," === e[n]) {
                      var l = e.substring(s, n).trim();
                      return 0 === l.length
                        ? ((s = n + 1), (o = n), "continue")
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
                        : (i.push(l), (s = n + 1), (o = n), "continue");
                    }
                    var c = a.findIndex(function(t) {
                      return t === e[n];
                    });
                    if (c >= 0) {
                      var f = e.indexOf(u[c], n + 1);
                      return f >= 0
                        ? ((o = n = f), "continue")
                        : ((t.error =
                            "ERROR: Could not find closing ' " +
                            u[c] +
                            " ' while parsing '" +
                            e.substring(s) +
                            "'."),
                          { value: void 0 });
                    }
                    var p = u.findIndex(function(t) {
                      return t === e[n];
                    });
                    if (p >= 0)
                      return (
                        (t.error =
                          "ERROR: Unexpected character ' " +
                          u[p] +
                          " ' while parsing '" +
                          e.substring(s) +
                          "'."),
                        { value: void 0 }
                      );
                    o = n;
                  },
                  c = 0;
                c <= e.length;
                ++c
              ) {
                var f = l(c);
                if (((c = o), "object" === (void 0 === f ? "undefined" : n(f))))
                  return f.value;
              }
              return i;
            }),
            e
          );
        })();
      t.default = a;
    },
    function(e, t, r) {
      "use strict";
      var n = function(e) {
        return e && e.__esModule ? e : { default: e };
      };
      Object.defineProperty(t, "__esModule", { value: !0 });
      var o = n(r(0));
      t.Datasource = o.default;
      var i = r(6);
      t.QueryCtrl = i.CogniteQueryCtrl;
      var a = r(13);
      t.ConfigCtrl = a.CogniteConfigCtrl;
      var u = r(14);
      t.AnnotationsQueryCtrl = u.CogniteAnnotationsQueryCtrl;
      var s = r(15);
      t.VariableQueryEditor = s.CogniteVariableQueryCtrl;
    },
    function(e, r) {
      e.exports = t;
    },
    function(e, t, r) {
      "use strict";
      var n = function(e, t, r, n) {
          return new (r || (r = Promise))(function(o, i) {
            function a(e) {
              try {
                s(n.next(e));
              } catch (e) {
                i(e);
              }
            }
            function u(e) {
              try {
                s(n.throw(e));
              } catch (e) {
                i(e);
              }
            }
            function s(e) {
              e.done
                ? o(e.value)
                : new r(function(t) {
                    t(e.value);
                  }).then(a, u);
            }
            s((n = n.apply(e, t || [])).next());
          });
        },
        o = function(e, t) {
          var r,
            n,
            o,
            i,
            a = {
              label: 0,
              sent: function() {
                if (1 & o[0]) throw o[1];
                return o[1];
              },
              trys: [],
              ops: []
            };
          return (
            (i = { next: u(0), throw: u(1), return: u(2) }),
            "function" == typeof Symbol &&
              (i[Symbol.iterator] = function() {
                return this;
              }),
            i
          );
          function u(i) {
            return function(u) {
              return (function(i) {
                if (r) throw new TypeError("Generator is already executing.");
                for (; a; )
                  try {
                    if (
                      ((r = 1),
                      n &&
                        (o =
                          2 & i[0]
                            ? n.return
                            : i[0]
                            ? n.throw || ((o = n.return) && o.call(n), 0)
                            : n.next) &&
                        !(o = o.call(n, i[1])).done)
                    )
                      return o;
                    switch (((n = 0), o && (i = [2 & i[0], o.value]), i[0])) {
                      case 0:
                      case 1:
                        o = i;
                        break;
                      case 4:
                        return a.label++, { value: i[1], done: !1 };
                      case 5:
                        a.label++, (n = i[1]), (i = [0]);
                        continue;
                      case 7:
                        (i = a.ops.pop()), a.trys.pop();
                        continue;
                      default:
                        if (
                          !(o = (o = a.trys).length > 0 && o[o.length - 1]) &&
                          (6 === i[0] || 2 === i[0])
                        ) {
                          a = 0;
                          continue;
                        }
                        if (
                          3 === i[0] &&
                          (!o || (i[1] > o[0] && i[1] < o[3]))
                        ) {
                          a.label = i[1];
                          break;
                        }
                        if (6 === i[0] && a.label < o[1]) {
                          (a.label = o[1]), (o = i);
                          break;
                        }
                        if (o && a.label < o[2]) {
                          (a.label = o[2]), a.ops.push(i);
                          break;
                        }
                        o[2] && a.ops.pop(), a.trys.pop();
                        continue;
                    }
                    i = t.call(e, a);
                  } catch (e) {
                    (i = [6, e]), (n = 0);
                  } finally {
                    r = o = 0;
                  }
                if (5 & i[0]) throw i[1];
                return { value: i[0] ? i[1] : void 0, done: !0 };
              })([i, u]);
            };
          }
        };
      Object.defineProperty(t, "__esModule", { value: !0 });
      var i = r(0),
        a = { results: new Map(), requests: new Map() };
      t.getQuery = function(e, t) {
        return n(void 0, void 0, void 0, function() {
          var r, n;
          return o(this, function(o) {
            return (
              (r = JSON.stringify(e)),
              a.requests.has(r)
                ? [2, a.requests.get(r)]
                : a.results.has(r)
                ? [2, a.results.get(r)]
                : ((n = t.datasourceRequest(e).then(
                    function(e) {
                      if (!e) return {};
                      var t = e;
                      return (
                        i.isError(t) ||
                          (a.results.set(r, t),
                          setTimeout(function() {
                            a.results.delete(r), a.requests.delete(r);
                          }, 1e4)),
                        a.requests.delete(r),
                        t
                      );
                    },
                    function(e) {
                      throw (a.requests.delete(r), e);
                    }
                  )),
                  a.requests.set(r, n),
                  [2, n])
            );
          });
        });
      };
      var u = { getQuery: t.getQuery };
      t.default = u;
    },
    function(e, t, r) {
      "use strict";
      var n,
        o = ((n = function(e, t) {
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
      var a = i(r(1)),
        u = r(7);
      r(8);
      var s = r(0),
        l = (function(e) {
          function t(t, r, n) {
            var o = e.call(this, t, r) || this;
            return (
              (o.templateSrv = n),
              (o.aggregation = [
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
              (o.tabs = [
                {
                  value: s.Tab.Timeseries,
                  name: "Select Timeseries",
                  src: "timeseriestab.html"
                },
                {
                  value: s.Tab.Asset,
                  name: "Select Timeseries from Asset",
                  src: "assettab.html"
                },
                {
                  value: s.Tab.Custom,
                  name: "Custom Query",
                  src: "customtab.html"
                }
              ]),
              (o.defaults = {
                target: "Start typing tag id here",
                type: "timeserie",
                aggregation: "average",
                granularity: "",
                label: "",
                tab: s.Tab.Timeseries,
                expr: "",
                assetQuery: {
                  target: "",
                  old: {},
                  timeseries: [],
                  includeSubtrees: !1,
                  func: ""
                }
              }),
              a.default.defaultsDeep(o.target, o.defaults),
              (o.currentTabIndex =
                o.tabs.findIndex(function(e) {
                  return e.value === o.target.tab;
                }) || 0),
              o
            );
          }
          return (
            o(t, e),
            (t.$inject = ["$scope", "$injector", "templateSrv"]),
            (t.prototype.getOptions = function(e, t) {
              return this.datasource.getOptionsForDropdown(e || "", t);
            }),
            (t.prototype.onChangeInternal = function() {
              this.refresh();
            }),
            (t.prototype.changeTab = function(e) {
              (this.currentTabIndex = e),
                (this.target.tab = this.tabs[e].value);
            }),
            (t.prototype.getCollapsedText = function() {
              return this.target.tab === s.Tab.Timeseries
                ? "Timeseries: " + this.target.target + " " + this.target.error
                : this.target.tab === s.Tab.Asset
                ? "Timeseries from Asset: " +
                  this.target.assetQuery.target +
                  " " +
                  this.target.error
                : this.target.tab === s.Tab.Custom
                ? "Custom Query: " + this.target.expr + " " + this.target.error
                : "";
            }),
            (t.templateUrl = "partials/query.editor.html"),
            t
          );
        })(u.QueryCtrl);
      t.CogniteQueryCtrl = l;
    },
    function(e, t) {
      e.exports = r;
    },
    function(e, t, r) {
      var n = r(9);
      "string" == typeof n && (n = [[e.i, n, ""]]);
      var o = { hmr: !0, transform: void 0, insertInto: void 0 };
      r(11)(n, o);
      n.locals && (e.exports = n.locals);
    },
    function(e, t, r) {
      (e.exports = r(10)(!0)).push([
        e.i,
        ".min-width-10 {\n  min-width: 10rem;\n}\n\n.min-width-12 {\n  min-width: 12rem;\n}\n\n.min-width-20 {\n  min-width: 20rem;\n}\n\n.gf-form-select-wrapper select.gf-form-input {\n  height: 2.64rem;\n}\n\n.gf-form-select-wrapper--caret-indent.gf-form-select-wrapper::after {\n  right: 0.775rem;\n}\n\n.gf-tabs-cognite.active:before,\n.gf-tabs-cognite.active:focus:before,\n.gf-tabs-cognite.active:hover:before {\n  background-image: linear-gradient(90deg, #33b5e5 0, #00b3ff 99%, #1b1b1b);\n}\n\ninput[type='checkbox'] {\n  margin: 4px;\n}\n\n.custom-query {\n  font-family: monospace;\n}\n",
        "",
        {
          version: 3,
          sources: [
            "/Users/julienhe/Documents/cognite/cognite-grafana-datasource/src/css/query_editor.css"
          ],
          names: [],
          mappings:
            "AAAA;EACE,gBAAgB;AAClB;;AAEA;EACE,gBAAgB;AAClB;;AAEA;EACE,gBAAgB;AAClB;;AAEA;EACE,eAAe;AACjB;;AAEA;EACE,eAAe;AACjB;;AAEA;;;EAGE,yEAAyE;AAC3E;;AAEA;EACE,WAAW;AACb;;AAEA;EACE,sBAAsB;AACxB",
          file: "query_editor.css",
          sourcesContent: [
            ".min-width-10 {\n  min-width: 10rem;\n}\n\n.min-width-12 {\n  min-width: 12rem;\n}\n\n.min-width-20 {\n  min-width: 20rem;\n}\n\n.gf-form-select-wrapper select.gf-form-input {\n  height: 2.64rem;\n}\n\n.gf-form-select-wrapper--caret-indent.gf-form-select-wrapper::after {\n  right: 0.775rem;\n}\n\n.gf-tabs-cognite.active:before,\n.gf-tabs-cognite.active:focus:before,\n.gf-tabs-cognite.active:hover:before {\n  background-image: linear-gradient(90deg, #33b5e5 0, #00b3ff 99%, #1b1b1b);\n}\n\ninput[type='checkbox'] {\n  margin: 4px;\n}\n\n.custom-query {\n  font-family: monospace;\n}\n"
          ],
          sourceRoot: ""
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
                  var o = ((a = n),
                    "/*# sourceMappingURL=data:application/json;charset=utf-8;base64," +
                      btoa(unescape(encodeURIComponent(JSON.stringify(a)))) +
                      " */"),
                    i = n.sources.map(function(e) {
                      return "/*# sourceURL=" + n.sourceRoot + e + " */";
                    });
                  return [r]
                    .concat(i)
                    .concat([o])
                    .join("\n");
                }
                var a;
                return [r].join("\n");
              })(t, e);
              return t[2] ? "@media " + t[2] + "{" + r + "}" : r;
            }).join("");
          }),
          (t.i = function(e, r) {
            "string" == typeof e && (e = [[null, e, ""]]);
            for (var n = {}, o = 0; o < this.length; o++) {
              var i = this[o][0];
              null != i && (n[i] = !0);
            }
            for (o = 0; o < e.length; o++) {
              var a = e[o];
              (null != a[0] && n[a[0]]) ||
                (r && !a[2]
                  ? (a[2] = r)
                  : r && (a[2] = "(" + a[2] + ") and (" + r + ")"),
                t.push(a));
            }
          }),
          t
        );
      };
    },
    function(e, t, r) {
      var n,
        o,
        i = {},
        a = ((n = function() {
          return window && document && document.all && !window.atob;
        }),
        function() {
          return void 0 === o && (o = n.apply(this, arguments)), o;
        }),
        u = (function(e) {
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
        s = null,
        l = 0,
        c = [],
        f = r(12);
      function p(e, t) {
        for (var r = 0; r < e.length; r++) {
          var n = e[r],
            o = i[n.id];
          if (o) {
            o.refs++;
            for (var a = 0; a < o.parts.length; a++) o.parts[a](n.parts[a]);
            for (; a < n.parts.length; a++) o.parts.push(g(n.parts[a], t));
          } else {
            var u = [];
            for (a = 0; a < n.parts.length; a++) u.push(g(n.parts[a], t));
            i[n.id] = { id: n.id, refs: 1, parts: u };
          }
        }
      }
      function d(e, t) {
        for (var r = [], n = {}, o = 0; o < e.length; o++) {
          var i = e[o],
            a = t.base ? i[0] + t.base : i[0],
            u = { css: i[1], media: i[2], sourceMap: i[3] };
          n[a] ? n[a].parts.push(u) : r.push((n[a] = { id: a, parts: [u] }));
        }
        return r;
      }
      function h(e, t) {
        var r = u(e.insertInto);
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
          var o = u(e.insertAt.before, r);
          r.insertBefore(t, o);
        }
      }
      function m(e) {
        if (null === e.parentNode) return !1;
        e.parentNode.removeChild(e);
        var t = c.indexOf(e);
        t >= 0 && c.splice(t, 1);
      }
      function y(e) {
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
        return v(t, e.attrs), h(e, t), t;
      }
      function v(e, t) {
        Object.keys(t).forEach(function(r) {
          e.setAttribute(r, t[r]);
        });
      }
      function g(e, t) {
        var r, n, o, i;
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
          var a = l++;
          (r = s || (s = y(t))),
            (n = A.bind(null, r, a, !1)),
            (o = A.bind(null, r, a, !0));
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
                  h(e, t),
                  t
                );
              })(t)),
              (n = function(e, t, r) {
                var n = r.css,
                  o = r.sourceMap,
                  i = void 0 === t.convertToAbsoluteUrls && o;
                (t.convertToAbsoluteUrls || i) && (n = f(n));
                o &&
                  (n +=
                    "\n/*# sourceMappingURL=data:application/json;base64," +
                    btoa(unescape(encodeURIComponent(JSON.stringify(o)))) +
                    " */");
                var a = new Blob([n], { type: "text/css" }),
                  u = e.href;
                (e.href = URL.createObjectURL(a)), u && URL.revokeObjectURL(u);
              }.bind(null, r, t)),
              (o = function() {
                m(r), r.href && URL.revokeObjectURL(r.href);
              }))
            : ((r = y(t)),
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
              (o = function() {
                m(r);
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
            } else o();
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
        var r = d(e, t);
        return (
          p(r, t),
          function(e) {
            for (var n = [], o = 0; o < r.length; o++) {
              var a = r[o];
              (u = i[a.id]).refs--, n.push(u);
            }
            e && p(d(e, t), t);
            for (o = 0; o < n.length; o++) {
              var u;
              if (0 === (u = n[o]).refs) {
                for (var s = 0; s < u.parts.length; s++) u.parts[s]();
                delete i[u.id];
              }
            }
          }
        );
      };
      var b,
        w = ((b = []),
        function(e, t) {
          return (b[e] = t), b.filter(Boolean).join("\n");
        });
      function A(e, t, r, n) {
        var o = r ? "" : n.css;
        if (e.styleSheet) e.styleSheet.cssText = w(t, o);
        else {
          var i = document.createTextNode(o),
            a = e.childNodes;
          a[t] && e.removeChild(a[t]),
            a.length ? e.insertBefore(i, a[t]) : e.appendChild(i);
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
            var o,
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
              : ((o =
                  0 === i.indexOf("//")
                    ? i
                    : 0 === i.indexOf("/")
                    ? r + i
                    : n + i.replace(/^\.\//, "")),
                "url(" + JSON.stringify(o) + ")");
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
      var o = n(r(2)),
        i = (function() {
          function e() {}
          return (
            (e.prototype.verify = function() {
              this.annotation.error = "";
              var e,
                t = { error: "" };
              this.annotation.expr
                ? (e = this.annotation.expr.match(/^event\{(.*)\}$/))
                  ? o.default.splitFilters(e[1], t, !0) ||
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
                  ? o.default.splitFilters(e[1], t, !1) ||
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
        o = ((n = function(e, t) {
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
      var a = i(r(16)),
        u = (function(e) {
          function t(t) {
            var r = e.call(this, t) || this;
            return (
              (r.defaults = { query: "", filter: "" }),
              (r.state = Object.assign(r.defaults, r.props.query)),
              r
            );
          }
          return (
            o(t, e),
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
                a.default.createElement(
                  "div",
                  { className: "gf-form gf-form--grow" },
                  a.default.createElement(
                    "span",
                    {
                      className:
                        "gf-form-label query-keyword fix-query-keyword width-10"
                    },
                    "Filter"
                  ),
                  a.default.createElement("input", {
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
                a.default.createElement(
                  "div",
                  { className: "gf-form--grow" },
                  a.default.createElement(
                    "pre",
                    null,
                    "  Query for assets using the '/assets/search' endpoint\n    Format is asset{param=value,...}\n  Then, filter on these assets\n    Format is filter{property comparator value,...}\n    Comparator can be =, !=, =~, !~ "
                  )
                )
              );
            }),
            t
          );
        })(a.default.PureComponent);
      t.CogniteVariableQueryCtrl = u;
    },
    function(e, t, r) {
      "use strict";
      e.exports = r(17);
    },
    function(e, t, r) {
      "use strict";
      /** @license React v16.8.0
       * react.production.min.js
       *
       * Copyright (c) Facebook, Inc. and its affiliates.
       *
       * This source code is licensed under the MIT license found in the
       * LICENSE file in the root directory of this source tree.
       */ var n = r(18),
        o = "function" == typeof Symbol && Symbol.for,
        i = o ? Symbol.for("react.element") : 60103,
        a = o ? Symbol.for("react.portal") : 60106,
        u = o ? Symbol.for("react.fragment") : 60107,
        s = o ? Symbol.for("react.strict_mode") : 60108,
        l = o ? Symbol.for("react.profiler") : 60114,
        c = o ? Symbol.for("react.provider") : 60109,
        f = o ? Symbol.for("react.context") : 60110,
        p = o ? Symbol.for("react.concurrent_mode") : 60111,
        d = o ? Symbol.for("react.forward_ref") : 60112,
        h = o ? Symbol.for("react.suspense") : 60113,
        m = o ? Symbol.for("react.memo") : 60115,
        y = o ? Symbol.for("react.lazy") : 60116,
        v = "function" == typeof Symbol && Symbol.iterator;
      function g(e) {
        for (
          var t = arguments.length - 1,
            r = "https://reactjs.org/docs/error-decoder.html?invariant=" + e,
            n = 0;
          n < t;
          n++
        )
          r += "&args[]=" + encodeURIComponent(arguments[n + 1]);
        !(function(e, t, r, n, o, i, a, u) {
          if (!e) {
            if (((e = void 0), void 0 === t))
              e = Error(
                "Minified exception occurred; use the non-minified dev environment for the full error message and additional helpful warnings."
              );
            else {
              var s = [r, n, o, i, a, u],
                l = 0;
              (e = Error(
                t.replace(/%s/g, function() {
                  return s[l++];
                })
              )).name = "Invariant Violation";
            }
            throw ((e.framesToPop = 1), e);
          }
        })(
          !1,
          "Minified React error #" +
            e +
            "; visit %s for the full message or use the non-minified dev environment for full errors and additional helpful warnings. ",
          r
        );
      }
      var b = {
          isMounted: function() {
            return !1;
          },
          enqueueForceUpdate: function() {},
          enqueueReplaceState: function() {},
          enqueueSetState: function() {}
        },
        w = {};
      function A(e, t, r) {
        (this.props = e),
          (this.context = t),
          (this.refs = w),
          (this.updater = r || b);
      }
      function S() {}
      function C(e, t, r) {
        (this.props = e),
          (this.context = t),
          (this.refs = w),
          (this.updater = r || b);
      }
      (A.prototype.isReactComponent = {}),
        (A.prototype.setState = function(e, t) {
          "object" != typeof e &&
            "function" != typeof e &&
            null != e &&
            g("85"),
            this.updater.enqueueSetState(this, e, t, "setState");
        }),
        (A.prototype.forceUpdate = function(e) {
          this.updater.enqueueForceUpdate(this, e, "forceUpdate");
        }),
        (S.prototype = A.prototype);
      var x = (C.prototype = new S());
      (x.constructor = C), n(x, A.prototype), (x.isPureReactComponent = !0);
      var E = { current: null },
        O = { current: null },
        j = Object.prototype.hasOwnProperty,
        _ = { key: !0, ref: !0, __self: !0, __source: !0 };
      function T(e, t, r) {
        var n = void 0,
          o = {},
          a = null,
          u = null;
        if (null != t)
          for (n in (void 0 !== t.ref && (u = t.ref),
          void 0 !== t.key && (a = "" + t.key),
          t))
            j.call(t, n) && !_.hasOwnProperty(n) && (o[n] = t[n]);
        var s = arguments.length - 2;
        if (1 === s) o.children = r;
        else if (1 < s) {
          for (var l = Array(s), c = 0; c < s; c++) l[c] = arguments[c + 2];
          o.children = l;
        }
        if (e && e.defaultProps)
          for (n in (s = e.defaultProps)) void 0 === o[n] && (o[n] = s[n]);
        return {
          $$typeof: i,
          type: e,
          key: a,
          ref: u,
          props: o,
          _owner: O.current
        };
      }
      function k(e) {
        return "object" == typeof e && null !== e && e.$$typeof === i;
      }
      var R = /\/+/g,
        Q = [];
      function M(e, t, r, n) {
        if (Q.length) {
          var o = Q.pop();
          return (
            (o.result = e),
            (o.keyPrefix = t),
            (o.func = r),
            (o.context = n),
            (o.count = 0),
            o
          );
        }
        return { result: e, keyPrefix: t, func: r, context: n, count: 0 };
      }
      function P(e) {
        (e.result = null),
          (e.keyPrefix = null),
          (e.func = null),
          (e.context = null),
          (e.count = 0),
          10 > Q.length && Q.push(e);
      }
      function q(e, t, r) {
        return null == e
          ? 0
          : (function e(t, r, n, o) {
              var u = typeof t;
              ("undefined" !== u && "boolean" !== u) || (t = null);
              var s = !1;
              if (null === t) s = !0;
              else
                switch (u) {
                  case "string":
                  case "number":
                    s = !0;
                    break;
                  case "object":
                    switch (t.$$typeof) {
                      case i:
                      case a:
                        s = !0;
                    }
                }
              if (s) return n(o, t, "" === r ? "." + $(t, 0) : r), 1;
              if (((s = 0), (r = "" === r ? "." : r + ":"), Array.isArray(t)))
                for (var l = 0; l < t.length; l++) {
                  var c = r + $((u = t[l]), l);
                  s += e(u, c, n, o);
                }
              else if (
                ((c =
                  null === t || "object" != typeof t
                    ? null
                    : "function" == typeof (c = (v && t[v]) || t["@@iterator"])
                    ? c
                    : null),
                "function" == typeof c)
              )
                for (t = c.call(t), l = 0; !(u = t.next()).done; )
                  s += e((u = u.value), (c = r + $(u, l++)), n, o);
              else
                "object" === u &&
                  g(
                    "31",
                    "[object Object]" == (n = "" + t)
                      ? "object with keys {" + Object.keys(t).join(", ") + "}"
                      : n,
                    ""
                  );
              return s;
            })(e, "", t, r);
      }
      function $(e, t) {
        return "object" == typeof e && null !== e && null != e.key
          ? (function(e) {
              var t = { "=": "=0", ":": "=2" };
              return (
                "$" +
                ("" + e).replace(/[=:]/g, function(e) {
                  return t[e];
                })
              );
            })(e.key)
          : t.toString(36);
      }
      function I(e, t) {
        e.func.call(e.context, t, e.count++);
      }
      function U(e, t, r) {
        var n = e.result,
          o = e.keyPrefix;
        (e = e.func.call(e.context, t, e.count++)),
          Array.isArray(e)
            ? B(e, n, r, function(e) {
                return e;
              })
            : null != e &&
              (k(e) &&
                (e = (function(e, t) {
                  return {
                    $$typeof: i,
                    type: e.type,
                    key: t,
                    ref: e.ref,
                    props: e.props,
                    _owner: e._owner
                  };
                })(
                  e,
                  o +
                    (!e.key || (t && t.key === e.key)
                      ? ""
                      : ("" + e.key).replace(R, "$&/") + "/") +
                    r
                )),
              n.push(e));
      }
      function B(e, t, r, n, o) {
        var i = "";
        null != r && (i = ("" + r).replace(R, "$&/") + "/"),
          q(e, U, (t = M(t, i, n, o))),
          P(t);
      }
      function L() {
        var e = E.current;
        return null === e && g("307"), e;
      }
      var F = {
          Children: {
            map: function(e, t, r) {
              if (null == e) return e;
              var n = [];
              return B(e, n, null, t, r), n;
            },
            forEach: function(e, t, r) {
              if (null == e) return e;
              q(e, I, (t = M(null, null, t, r))), P(t);
            },
            count: function(e) {
              return q(
                e,
                function() {
                  return null;
                },
                null
              );
            },
            toArray: function(e) {
              var t = [];
              return (
                B(e, t, null, function(e) {
                  return e;
                }),
                t
              );
            },
            only: function(e) {
              return k(e) || g("143"), e;
            }
          },
          createRef: function() {
            return { current: null };
          },
          Component: A,
          PureComponent: C,
          createContext: function(e, t) {
            return (
              void 0 === t && (t = null),
              ((e = {
                $$typeof: f,
                _calculateChangedBits: t,
                _currentValue: e,
                _currentValue2: e,
                _threadCount: 0,
                Provider: null,
                Consumer: null
              }).Provider = { $$typeof: c, _context: e }),
              (e.Consumer = e)
            );
          },
          forwardRef: function(e) {
            return { $$typeof: d, render: e };
          },
          lazy: function(e) {
            return { $$typeof: y, _ctor: e, _status: -1, _result: null };
          },
          memo: function(e, t) {
            return { $$typeof: m, type: e, compare: void 0 === t ? null : t };
          },
          useCallback: function(e, t) {
            return L().useCallback(e, t);
          },
          useContext: function(e, t) {
            return L().useContext(e, t);
          },
          useEffect: function(e, t) {
            return L().useEffect(e, t);
          },
          useImperativeHandle: function(e, t, r) {
            return L().useImperativeHandle(e, t, r);
          },
          useDebugValue: function() {},
          useLayoutEffect: function(e, t) {
            return L().useLayoutEffect(e, t);
          },
          useMemo: function(e, t) {
            return L().useMemo(e, t);
          },
          useReducer: function(e, t, r) {
            return L().useReducer(e, t, r);
          },
          useRef: function(e) {
            return L().useRef(e);
          },
          useState: function(e) {
            return L().useState(e);
          },
          Fragment: u,
          StrictMode: s,
          Suspense: h,
          createElement: T,
          cloneElement: function(e, t, r) {
            null == e && g("267", e);
            var o = void 0,
              a = n({}, e.props),
              u = e.key,
              s = e.ref,
              l = e._owner;
            if (null != t) {
              void 0 !== t.ref && ((s = t.ref), (l = O.current)),
                void 0 !== t.key && (u = "" + t.key);
              var c = void 0;
              for (o in (e.type &&
                e.type.defaultProps &&
                (c = e.type.defaultProps),
              t))
                j.call(t, o) &&
                  !_.hasOwnProperty(o) &&
                  (a[o] = void 0 === t[o] && void 0 !== c ? c[o] : t[o]);
            }
            if (1 === (o = arguments.length - 2)) a.children = r;
            else if (1 < o) {
              c = Array(o);
              for (var f = 0; f < o; f++) c[f] = arguments[f + 2];
              a.children = c;
            }
            return {
              $$typeof: i,
              type: e.type,
              key: u,
              ref: s,
              props: a,
              _owner: l
            };
          },
          createFactory: function(e) {
            var t = T.bind(null, e);
            return (t.type = e), t;
          },
          isValidElement: k,
          version: "16.8.0",
          unstable_ConcurrentMode: p,
          unstable_Profiler: l,
          __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
            ReactCurrentDispatcher: E,
            ReactCurrentOwner: O,
            assign: n
          }
        },
        N = { default: F },
        V = (N && F) || N;
      e.exports = V.default || V;
    },
    function(e, t, r) {
      "use strict";
      /*
object-assign
(c) Sindre Sorhus
@license MIT
*/ var n =
          Object.getOwnPropertySymbols,
        o = Object.prototype.hasOwnProperty,
        i = Object.prototype.propertyIsEnumerable;
      e.exports = (function() {
        try {
          if (!Object.assign) return !1;
          var e = new String("abc");
          if (((e[5] = "de"), "5" === Object.getOwnPropertyNames(e)[0]))
            return !1;
          for (var t = {}, r = 0; r < 10; r++)
            t["_" + String.fromCharCode(r)] = r;
          if (
            "0123456789" !==
            Object.getOwnPropertyNames(t)
              .map(function(e) {
                return t[e];
              })
              .join("")
          )
            return !1;
          var n = {};
          return (
            "abcdefghijklmnopqrst".split("").forEach(function(e) {
              n[e] = e;
            }),
            "abcdefghijklmnopqrst" ===
              Object.keys(Object.assign({}, n)).join("")
          );
        } catch (e) {
          return !1;
        }
      })()
        ? Object.assign
        : function(e, t) {
            for (
              var r,
                a,
                u = (function(e) {
                  if (null == e)
                    throw new TypeError(
                      "Object.assign cannot be called with null or undefined"
                    );
                  return Object(e);
                })(e),
                s = 1;
              s < arguments.length;
              s++
            ) {
              for (var l in (r = Object(arguments[s])))
                o.call(r, l) && (u[l] = r[l]);
              if (n) {
                a = n(r);
                for (var c = 0; c < a.length; c++)
                  i.call(r, a[c]) && (u[a[c]] = r[a[c]]);
              }
            }
            return u;
          };
    }
  ]);
});
//# sourceMappingURL=module.js.map
