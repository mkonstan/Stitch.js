/*
 * The attribute XSS corpus: values that reach an attribute through data-attr and would run
 * script (or load a document that can), in the classic filter-evasion forms (OWASP XSS
 * Filter Evasion Cheat Sheet: case, whitespace, control characters, character references
 * with and without semicolons, padding, hex, double encoding, percent-escapes, data: URLs,
 * srcset lists, SVG animation values), plus legitimate values that must keep working.
 *
 * Used by test-attr-safety.html (every entry, both directions) and by the strict-CSP suite
 * (the refusals: a refused value writes nothing, so it can run under the policy).
 *
 * Payloads call top.__xss(...) so a payload that ever runs is seen. Control characters are
 * built with c(n), so this file stays plain ASCII.
 */
(function (global) {
    "use strict";

    function c(n) { return String.fromCharCode(n); }
    var RUN = "top.__xss(1)";
    var JS = "javascript:" + RUN;
    // A 1x1 transparent PNG.
    var PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
    var HTML_DOC = "data:text/html,<script>" + RUN + "</script>";

    function dec(text) { return text.split("").map(function (ch) { return "&#" + ch.charCodeAt(0) + ";"; }).join(""); }
    function decPadded(text) { return text.split("").map(function (ch) { return "&#" + ("0000000" + ch.charCodeAt(0)).slice(-7); }).join(""); }
    function hexNoSemi(text) { return text.split("").map(function (ch) { return "&#x" + ch.charCodeAt(0).toString(16); }).join(""); }

    // Forms of "javascript:<payload>" that browsers (or older ones) read as a javascript: URL,
    // and some that only a lax reader would: all must be refused.
    var scriptUrls = [
        ["plain", JS],
        ["mixed case", "JaVaScRiPt:" + RUN],
        ["upper case", "JAVASCRIPT:" + RUN],
        ["leading space", "   " + JS],
        ["leading tab", c(9) + JS],
        ["leading newline", c(10) + JS],
        ["leading control characters", c(1) + c(2) + c(31) + JS],
        ["leading NUL", c(0) + JS],
        ["tab inside the scheme", "java" + c(9) + "script:" + RUN],
        ["newline inside the scheme", "java" + c(10) + "script:" + RUN],
        ["carriage return inside the scheme", "java" + c(13) + "script:" + RUN],
        ["NUL inside the scheme", "java" + c(0) + "script:" + RUN],
        ["vertical tab and form feed", c(11) + "java" + c(12) + "script:" + RUN],
        ["no-break space before", c(160) + JS],
        ["zero-width space inside", "java" + c(0x200b) + "script:" + RUN],
        ["byte order mark before", c(0xfeff) + JS],
        ["entity tab inside", "jav&#x09;ascript:" + RUN],
        ["entity newline inside", "jav&#x0A;ascript:" + RUN],
        ["entity carriage return inside", "jav&#x0D;ascript:" + RUN],
        ["named entity tab", "java&Tab;script:" + RUN],
        ["named entity newline", "java&NewLine;script:" + RUN],
        ["decimal references", dec("javascript:") + RUN],
        ["padded decimal references without semicolons", decPadded("javascript:") + RUN],
        ["hex references without semicolons", hexNoSemi("javascript:") + RUN],
        ["hex reference for the first letter", "&#x6A;avascript:" + RUN],
        ["named colon", "javascript&colon;" + RUN],
        ["decimal colon", "javascript&#58;" + RUN],
        ["double-encoded reference", "&amp;#106;avascript:" + RUN],
        ["percent-escaped letter", "%6Aavascript:" + RUN],
        ["percent-escaped colon", "javascript%3A" + RUN],
        ["percent-escaped body", "javascript:%74%6F%70.__xss(1)"],
        ["comment-looking body", "javascript://%0A" + RUN],
        ["space before the colon", "javascript :" + RUN],
        ["vbscript", "vbscript:msgbox(1)"],
        ["vbscript mixed case", "VbScRiPt:msgbox(1)"],
        ["vbscript with references", dec("vbscript:") + "msgbox(1)"]
    ];

    var dataUrls = [
        ["html document", HTML_DOC],
        ["base64 html document", "data:text/html;base64,PHNjcmlwdD50b3AuX194c3MoMSk8L3NjcmlwdD4="],
        ["upper case", "DATA:text/html,<script>" + RUN + "</script>"],
        ["leading space", " " + HTML_DOC],
        ["tab inside the scheme", "da" + c(9) + "ta:text/html,<script>" + RUN + "</script>"],
        ["entity colon", "data&colon;text/html,<script>" + RUN + "</script>"],
        ["svg document", "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' onload='" + RUN + "'/>"],
        ["javascript as data", "data:text/javascript," + RUN],
        ["no media type", "data:,<script>" + RUN + "</script>"]
    ];

    // { element, attribute, value, code, label } - every one must be refused with its code.
    var refused = [];
    function add(element, attribute, value, code, label) {
        refused.push({ element: element, attribute: attribute, value: value, code: code, label: label });
    }

    // Event-handler names: any attribute name starting with "on", any case, any value.
    [["a", "onclick"], ["a", "ONCLICK"], ["div", "OnMouseOver"], ["img", "onerror"], ["body", "onload"],
        ["input", "onfocus"], ["svg", "onload"], ["animate", "onbegin"], ["div", "on"], ["details", "ontoggle"],
        ["form", "onsubmit"], ["video", "onerror"]].forEach(function (pair) {
        add(pair[0], pair[1], RUN, "E321", pair[1] + " on <" + pair[0] + ">");
    });
    add("a", "onclick", null, "E321", "onclick with null (removing is refused too: data never names a handler)");
    add("iframe", "srcdoc", "<script>" + RUN + "</script>", "E322", "srcdoc");
    add("iframe", "SRCDOC", "<img src=x onerror=" + RUN + ">", "E322", "SRCDOC");

    // Security-sensitive names: they decide what the page or an embedded document may do, so
    // data may neither set nor remove them (removing a static sandbox lifts it).
    [["iframe", "sandbox"], ["iframe", "SANDBOX"], ["iframe", "allow"], ["iframe", "allowfullscreen"],
        ["iframe", "allowpaymentrequest"], ["iframe", "allowusermedia"], ["iframe", "csp"], ["iframe", "credentialless"],
        ["div", "http-equiv"], ["link", "integrity"],
        ["img", "crossorigin"], ["a", "referrerpolicy"], ["iframe", "referrerpolicy"], ["link", "nonce"], ["div", "nonce"],
        ["div", "is"]].forEach(function (pair) {
        [null, "", "allow-scripts allow-same-origin", true].forEach(function (value) {
            add(pair[0], pair[1], value, "E327", pair[1] + " on <" + pair[0] + "> = " + JSON.stringify(value));
        });
    });

    // rel="opener" hands the linked page this window.
    ["opener", "OPENER", "noreferrer opener", "opener\tnoreferrer"].forEach(function (value) {
        add("a", "rel", value, "E328", "rel " + JSON.stringify(value));
    });

    // javascript:/vbscript: in every URL-bearing attribute.
    var urlTargets = [["a", "href"], ["area", "href"], ["iframe", "src"], ["frame", "src"], ["embed", "src"],
        ["object", "data"], ["form", "action"], ["button", "formaction"], ["input", "formaction"],
        ["video", "poster"], ["blockquote", "cite"], ["table", "background"], ["a", "ping"],
        ["svg:a", "href"], ["svg:a", "xlink:href"], ["svg:use", "href"], ["svg:image", "href"], ["math", "href"],
        ["link", "href"], ["img", "src"], ["object", "codebase"], ["img", "longdesc"], ["html", "manifest"], ["img", "usemap"]];
    urlTargets.forEach(function (pair) {
        scriptUrls.forEach(function (form) {
            add(pair[0], pair[1], form[1], "E323", pair[1] + " on <" + pair[0] + ">: " + form[0]);
        });
    });
    // URL lists and SVG animation values.
    add("img", "srcset", "small.png 1x, " + JS + " 2x", "E323", "srcset entry");
    add("source", "srcset", JS, "E323", "srcset on <source>");
    add("link", "imagesrcset", "a.png 1x, " + JS + " 2x", "E323", "imagesrcset entry");
    add("a", "ping", "https://example.com/ok " + JS, "E323", "ping list entry");
    add("svg:animate", "to", JS, "E323", "SVG animate to");
    add("svg:animate", "values", "#ok;" + JS, "E323", "SVG animate values list");
    add("svg:set", "to", "JaVaScRiPt:" + RUN, "E323", "SVG set to");
    add("svg:animate", "from", JS, "E323", "SVG animate from");

    // data: URLs, except data:image/ in an <img> src.
    [["a", "href"], ["iframe", "src"], ["object", "data"], ["embed", "src"], ["form", "action"],
        ["button", "formaction"], ["svg:a", "href"], ["svg:use", "href"], ["svg:image", "href"]].forEach(function (pair) {
        dataUrls.forEach(function (form) {
            add(pair[0], pair[1], form[1], "E324", pair[1] + " on <" + pair[0] + ">: data " + form[0]);
        });
    });
    add("a", "href", PNG, "E324", "data:image on a link (only an <img> src may take one)");
    add("iframe", "src", PNG, "E324", "data:image in an iframe");
    add("img", "src", HTML_DOC, "E324", "data:text/html in an img src");
    add("img", "srcset", PNG + " 1x", "E324", "data:image in srcset (only src)");

    // Style strings.
    add("div", "style", "color: red", "E325", "style string");
    add("div", "style", "background:url(" + JS + ")", "E325", "style string with a javascript: url()");
    add("div", "STYLE", "width: expression(" + RUN + ")", "E325", "STYLE string with expression()");
    add("div", "style", ["color: red"], "E325", "style array");

    // Legitimate values: { element, attribute, value, expected } - written as given (expected
    // is the attribute text afterwards; null = removed). None of these elements fetches.
    var allowed = [
        { element: "a", attribute: "href", value: "/page", expected: "/page" },
        { element: "a", attribute: "href", value: "page.html", expected: "page.html" },
        { element: "a", attribute: "href", value: "../up/page.html?x=1#y", expected: "../up/page.html?x=1#y" },
        { element: "a", attribute: "href", value: "https://example.com/a?next=javascript:x", expected: "https://example.com/a?next=javascript:x" },
        { element: "a", attribute: "href", value: "HTTPS://EXAMPLE.COM/", expected: "HTTPS://EXAMPLE.COM/" },
        { element: "a", attribute: "href", value: "//example.com/x", expected: "//example.com/x" },
        { element: "a", attribute: "href", value: "mailto:client@example.com", expected: "mailto:client@example.com" },
        { element: "a", attribute: "href", value: "tel:+1-212-555-0100", expected: "tel:+1-212-555-0100" },
        { element: "a", attribute: "href", value: "#holdings", expected: "#holdings" },
        { element: "a", attribute: "href", value: "?page=2", expected: "?page=2" },
        { element: "a", attribute: "href", value: "javascript-guide.html", expected: "javascript-guide.html" },
        { element: "a", attribute: "href", value: "data-sheet.pdf", expected: "data-sheet.pdf" },
        { element: "a", attribute: "href", value: "/files/data:2024.csv", expected: "/files/data:2024.csv" },
        { element: "a", attribute: "href", value: null, expected: null },
        { element: "a", attribute: "title", value: JS, expected: JS },
        { element: "a", attribute: "aria-label", value: "Open the report", expected: "Open the report" },
        { element: "a", attribute: "data-row", value: 7, expected: "7" },
        { element: "a", attribute: "target", value: "_blank", expected: "_blank" },
        { element: "a", attribute: "rel", value: "noopener noreferrer", expected: "noopener noreferrer" },
        { element: "a", attribute: "rel", value: null, expected: null },
        { element: "img", attribute: "src", value: PNG, expected: PNG },
        { element: "img", attribute: "alt", value: "Chart", expected: "Chart" },
        { element: "source", attribute: "srcset", value: "a.png 1x, b.png 2x", expected: "a.png 1x, b.png 2x" },
        { element: "form", attribute: "action", value: "/save", expected: "/save" },
        { element: "button", attribute: "formaction", value: "https://example.com/submit", expected: "https://example.com/submit" },
        { element: "details", attribute: "open", value: true, expected: "" },
        { element: "input", attribute: "disabled", value: false, expected: null },
        { element: "div", attribute: "class", value: ["a", "b"], expected: "a b" },
        { element: "div", attribute: "data-config", value: { a: 1 }, expected: "{\"a\":1}" },
        { element: "svg:a", attribute: "href", value: "#section", expected: "#section" }
    ];

    global.STITCH_XSS_CORPUS = { refused: refused, allowed: allowed, scriptUrls: scriptUrls, dataUrls: dataUrls, PNG: PNG };
})(typeof window !== "undefined" ? window : this);
