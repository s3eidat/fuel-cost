/* Fuel Cost — everything is converted to litres and kilometres internally. */
(function () {
  "use strict";
  var $ = S3.$, $$ = S3.$$, h = S3.h;
  var KEY = "fuel.v1";
  var KM_PER_MI = 1.609344, L_PER_GALUS = 3.785411784, L_PER_GALUK = 4.54609;
  var UNITS = { l100: "L/100 km", kml: "km/L", mpgus: "mpg (US)", mpguk: "mpg (UK)" };

  // ---------- conversions (tested) ----------
  // Any consumption → litres per 100 km.
  function toL100(v, unit) {
    if (!(v > 0)) return null;
    if (unit === "l100") return v;
    if (unit === "kml") return 100 / v;
    if (unit === "mpgus") return 100 * L_PER_GALUS / (v * KM_PER_MI);
    if (unit === "mpguk") return 100 * L_PER_GALUK / (v * KM_PER_MI);
    return null;
  }
  function fromL100(l, unit) {
    if (!(l > 0)) return null;
    if (unit === "l100") return l;
    if (unit === "kml") return 100 / l;
    if (unit === "mpgus") return 100 * L_PER_GALUS / (l * KM_PER_MI);
    if (unit === "mpguk") return 100 * L_PER_GALUK / (l * KM_PER_MI);
    return null;
  }
  function pricePerLitre(p, unit) { return unit === "galUS" ? p / L_PER_GALUS : unit === "galUK" ? p / L_PER_GALUK : p; }
  function trip(o) {   // o: {km, l100, ppl, people}
    var litres = o.km * o.l100 / 100, cost = litres * o.ppl;
    return { litres: litres, cost: cost, each: cost / Math.max(1, o.people), perKm: o.km ? cost / o.km : 0 };
  }
  function num(v) {
    v = String(v == null ? "" : v).trim().replace(/[٠-٩]/g, function (d) { return d.charCodeAt(0) - 0x660; }).replace(/[٫,]/g, ".").replace(/\s/g, "");
    return /^\d*\.?\d+$|^\d+\.$/.test(v) ? parseFloat(v) : null;
  }

  // ---------- UI ----------
  var sv = S3.store(KEY) || {};
  var st = { distUnit: sv.distUnit === "mi" ? "mi" : "km" };
  ["unitA", "unitB"].forEach(function (id) { Object.keys(UNITS).forEach(function (u) { $("#" + id).appendChild(h("option", { value: u, text: UNITS[u] })); }); });
  var FIELDS = ["dist", "price", "cur", "people", "nameA", "consA", "nameB", "consB", "priceB"];
  FIELDS.forEach(function (k) { if (typeof sv[k] === "string") $("#" + k).value = sv[k].slice(0, 30); });
  $("#unitA").value = UNITS[sv.unitA] ? sv.unitA : "l100"; $("#unitB").value = UNITS[sv.unitB] ? sv.unitB : "l100";
  $("#priceUnit").value = ["L", "galUS", "galUK"].indexOf(sv.priceUnit) >= 0 ? sv.priceUnit : "L";
  $("#round").checked = sv.round === true; $("#compare").checked = sv.compare === true;
  function save() {
    var o = { distUnit: st.distUnit, unitA: $("#unitA").value, unitB: $("#unitB").value, priceUnit: $("#priceUnit").value, round: $("#round").checked, compare: $("#compare").checked };
    FIELDS.forEach(function (k) { o[k] = $("#" + k).value; });
    S3.store(KEY, o);
  }
  function fmt(n, d) { return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function money(n) { var c = $("#cur").value.trim(); return (c ? c + " " : "") + fmt(n, n < 10 ? 2 : n < 1000 ? 2 : 0); }
  function stat(label, value) { return h("div", { "class": "stat" }, [h("b", { text: value }), h("span", { text: label })]); }
  function convLine(id, cons, unit) {
    var l = toL100(cons, unit), el = $(id);
    el.textContent = l ? "= " + Object.keys(UNITS).filter(function (u) { return u !== unit; }).map(function (u) { return fmt(fromL100(l, u), 1) + " " + UNITS[u]; }).join(" · ") : "";
  }
  var text = "";
  function render() {
    save();
    $("#carB").hidden = !$("#compare").checked;
    var dist = num($("#dist").value), price = num($("#price").value), people = Math.max(1, Math.min(99, parseInt($("#people").value, 10) || 1));
    var consA = num($("#consA").value), consB = num($("#consB").value), unitA = $("#unitA").value, unitB = $("#unitB").value;
    convLine("#convA", consA, unitA); convLine("#convB", consB, unitB);
    var res = $("#res"), stats = $("#stats"), cmp = $("#cmp"); res.textContent = ""; stats.textContent = ""; cmp.textContent = ""; text = "";
    var lA = toL100(consA, unitA);
    if (!(dist > 0) || price == null || !lA) {
      res.appendChild(h("div", { "class": "empty" }, [h("b", { text: "Enter distance, price and consumption" }), "The trip cost appears here."]));
      return;
    }
    var mi = st.distUnit === "mi", km = dist * (mi ? KM_PER_MI : 1) * ($("#round").checked ? 2 : 1), ppl = pricePerLitre(price, $("#priceUnit").value);
    var a = trip({ km: km, l100: lA, ppl: ppl, people: people }), nameA = $("#nameA").value.trim() || "Car A";
    var galUnit = $("#priceUnit").value === "galUK" ? L_PER_GALUK : L_PER_GALUS, galName = $("#priceUnit").value === "galUK" ? "UK gal" : "US gal";
    res.appendChild(h("span", { "class": "fc-k", text: "Fuel cost" + ($("#round").checked ? " · round trip" : "") }));
    res.appendChild(h("b", { text: money(a.cost) }));
    res.appendChild(h("span", { "class": "fc-sub", text: fmt(km / (mi ? KM_PER_MI : 1), 0) + " " + (mi ? "miles" : "km") + " · " + fmt(a.litres, 1) + " L (" + fmt(a.litres / galUnit, 1) + " " + galName + ")" }));
    if (people > 1) stats.appendChild(stat("each, split " + people + " ways", money(a.each)));
    stats.appendChild(stat("per " + (mi ? "mile" : "km"), money(a.perKm * (mi ? KM_PER_MI : 1))));
    stats.appendChild(stat("per 100 " + (mi ? "miles" : "km"), money(a.perKm * 100 * (mi ? KM_PER_MI : 1))));
    stats.appendChild(stat("fuel price per litre", money(ppl)));
    text = "Trip: " + fmt(km / (mi ? KM_PER_MI : 1), 0) + (mi ? " miles" : " km") + ($("#round").checked ? " (round trip)" : "") + ", " + nameA + " at " + fmt(lA, 1) + " L/100 km: " +
      fmt(a.litres, 1) + " L = " + money(a.cost) + (people > 1 ? " (" + money(a.each) + " each for " + people + ")" : "");

    var lB = toL100(consB, unitB);
    if ($("#compare").checked && lB) {
      var pB = num($("#priceB").value), b = trip({ km: km, l100: lB, ppl: pB != null ? pricePerLitre(pB, $("#priceUnit").value) : ppl, people: people });
      var nameB = $("#nameB").value.trim() || "Car B", diff = b.cost - a.cost, cheaper = diff < 0 ? nameB : nameA;
      var tbl = h("table", { "class": "tbl" }, [
        h("thead", {}, [h("tr", {}, [h("th", { text: "" }), h("th", { dir: "auto", text: nameA }), h("th", { dir: "auto", text: nameB })])]),
        h("tbody", {}, [
          h("tr", {}, [h("td", { text: "L/100 km" }), h("td", { text: fmt(lA, 1) }), h("td", { text: fmt(lB, 1) })]),
          h("tr", {}, [h("td", { text: "Fuel" }), h("td", { text: fmt(a.litres, 1) + " L" }), h("td", { text: fmt(b.litres, 1) + " L" })]),
          h("tr", {}, [h("td", { text: "Cost" }), h("td", { text: money(a.cost) }), h("td", { text: money(b.cost) })]),
          people > 1 ? h("tr", {}, [h("td", { text: "Each" }), h("td", { text: money(a.each) }), h("td", { text: money(b.each) })]) : null
        ])
      ]);
      cmp.appendChild(h("div", { "class": "tbl-wrap" }, [tbl]));
      cmp.appendChild(h("p", { "class": "fc-save" + (Math.abs(diff) < 0.005 ? "" : " ok"), dir: "auto",
        text: Math.abs(diff) < 0.005 ? "Both cost the same for this trip." : cheaper + " saves " + money(Math.abs(diff)) + " on this trip (" + fmt(Math.abs(diff) / Math.max(a.cost, b.cost) * 100, 0) + "% less)." }));
      text += "\n" + nameB + " at " + fmt(lB, 1) + " L/100 km: " + money(b.cost) + ". " + cmp.lastChild.textContent;
    }
  }
  function seg(el, value, onPick) {
    $$("button", el).forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.v === value));
      b.addEventListener("click", function () { $$("button", el).forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); }); onPick(b.dataset.v); });
    });
  }
  seg($("#distUnit"), st.distUnit, function (v) {
    var d = num($("#dist").value);
    if (d != null && v !== st.distUnit) $("#dist").value = String(Math.round((v === "mi" ? d / KM_PER_MI : d * KM_PER_MI) * 10) / 10);
    st.distUnit = v; render();
  });
  // Changing a unit converts the number already typed, so the car stays the same car.
  ["A", "B"].forEach(function (x) {
    var sel = $("#unit" + x), prev = sel.value;
    sel.addEventListener("change", function () {
      var c = num($("#cons" + x).value), l = toL100(c, prev);
      if (l) $("#cons" + x).value = String(Math.round(fromL100(l, sel.value) * 10) / 10);
      prev = sel.value; render();
    });
  });
  $$("input, select").forEach(function (el) { el.addEventListener("input", render); });
  $("#pMinus").addEventListener("click", function () { $("#people").value = Math.max(1, (parseInt($("#people").value, 10) || 1) - 1); render(); });
  $("#pPlus").addEventListener("click", function () { $("#people").value = Math.min(99, (parseInt($("#people").value, 10) || 1) + 1); render(); });
  $("#copy").addEventListener("click", function () { if (!text) return S3.toast("Fill in the trip first", "error"); S3.copy(text); S3.done(); });
  render();

  window.S3_DEMO = function () {
    $("#dist").value = "335"; $("#distUnit button[data-v=km]").click(); $("#round").checked = true;
    $("#price").value = "0.90"; $("#priceUnit").value = "L"; $("#cur").value = "JD"; $("#people").value = "3";
    $("#nameA").value = "Family SUV"; $("#consA").value = "10.5"; $("#unitA").value = "l100";
    $("#compare").checked = true; $("#nameB").value = "Hybrid"; $("#consB").value = "50"; $("#unitB").value = "mpgus"; $("#priceB").value = "";
    render();
  };

  window.S3_SELFTEST = function () {
    function near(a, b, e) { return Math.abs(a - b) < (e || 1e-3); }
    var t = trip({ km: 100, l100: 8, ppl: 1, people: 4 });
    return near(toL100(30, "mpgus"), 7.84049) && near(toL100(30, "mpguk"), 9.41604) && near(fromL100(7.84049, "mpgus"), 30) &&
      near(fromL100(toL100(42.5, "mpguk"), "mpgus"), 42.5 * L_PER_GALUS / L_PER_GALUK) && near(toL100(20, "kml"), 5) && near(fromL100(5, "kml"), 20) &&
      near(fromL100(toL100(55, "mpgus"), "mpguk"), 66.05, 0.01) && near(235.2146 / 10, fromL100(10, "mpgus"), 1e-3) &&
      near(pricePerLitre(3.785411784, "galUS"), 1) && near(pricePerLitre(4.54609, "galUK"), 1) && pricePerLitre(2, "L") === 2 &&
      near(t.litres, 8) && near(t.cost, 8) && near(t.each, 2) && near(t.perKm, 0.08) &&
      toL100(0, "l100") === null && toL100(-5, "kml") === null && num("7,5") === 7.5 && num("١٠") === 10 && num("x") === null;
  };
})();
