/**
 * Shared API helpers and navigation for Celestial Sips static pages.
 */
(function (global) {
    function qs(sel, root) {
        return (root || document).querySelector(sel);
    }

    function qsa(sel, root) {
        return Array.from((root || document).querySelectorAll(sel));
    }

    function formatPrice(cents) {
        return "$" + (cents / 100).toFixed(2);
    }

    function formatDate(iso) {
        return iso ? iso.slice(0, 10) : "";
    }

    function getQueryParam(name) {
        return new URLSearchParams(window.location.search).get(name);
    }

    function productIdFromPath() {
        var match = window.location.pathname.match(/\/shop\/(\d+)/);
        return match ? parseInt(match[1], 10) : null;
    }

    function postIdFromPath() {
        var match = window.location.pathname.match(/\/blog\/(\d+)/);
        return match ? parseInt(match[1], 10) : null;
    }

    function fetchJSON(url, options) {
        return fetch(url, Object.assign({ credentials: "same-origin" }, options || {}))
            .then(function (res) {
                if (!res.ok) {
                    return res.json().catch(function () { return {}; }).then(function (body) {
                        var err = new Error(body.error || res.statusText);
                        err.status = res.status;
                        err.body = body;
                        throw err;
                    });
                }
                return res.json();
            });
    }

    function cartStorageKey() {
        return "inkwell-cart-v1";
    }

    function readCart() {
        try {
            return JSON.parse(localStorage.getItem(cartStorageKey()) || "[]");
        } catch (_err) {
            return [];
        }
    }

    function writeCart(items) {
        localStorage.setItem(cartStorageKey(), JSON.stringify(items || []));
        updateCartBadge();
    }

    function getCartCount() {
        return readCart().reduce(function (sum, item) {
            return sum + (parseInt(item.quantity, 10) || 0);
        }, 0);
    }

    function ensureCartLink() {
        var nav = qs(".main-nav");
        if (!nav || qs('a[href="/cart"]', nav)) return;
        var link = document.createElement("a");
        link.href = "/cart";
        link.setAttribute("data-nav", "");
        link.innerHTML = 'Cart <span class="cart-badge" id="cart-count">0</span>';
        var about = qs('a[href="/about"]', nav);
        if (about) {
            nav.insertBefore(link, about);
        } else {
            nav.appendChild(link);
        }
    }

    function updateCartBadge() {
        var el = qs("#cart-count");
        if (!el) return;
        el.textContent = String(getCartCount());
    }

    function setActiveNav() {
        var path = window.location.pathname;
        qsa("[data-nav]").forEach(function (link) {
            var href = link.getAttribute("href");
            var active = href === path ||
                (href !== "/" && path.indexOf(href) === 0);
            link.classList.toggle("active", active);
        });
    }

    function renderAuthNav() {
        var container = qs("#auth-nav");
        if (!container) return;

        fetchJSON("/api/auth/me").then(function (data) {
            if (data.authenticated) {
                container.innerHTML =
                    '<span>Hi, ' + escapeText(data.full_name) + '</span>' +
                    '<a href="/account">Account</a>' +
                    '<form class="inline-form" action="/api/auth/logout" method="POST">' +
                    '<button type="submit" class="link-btn">Log out</button></form>';
            } else {
                container.innerHTML =
                    '<a href="/login">Log in</a>' +
                    '<a href="/register">Register</a>';
            }
        }).catch(function () {
            container.innerHTML =
                '<a href="/login">Log in</a>' +
                '<a href="/register">Register</a>';
        });
    }

    function renderAdminNav() {
        var nav = qs(".main-nav");
        if (!nav || qs('a[href="/administrator_center"]', nav)) return;

        fetchJSON("/api/auth/me").then(function (data) {
            if (!data.authenticated || data.role !== "admin") return;

            var link = document.createElement("a");
            link.href = "/administrator_center";
            link.setAttribute("data-nav", "");
            link.textContent = "Administrator Center";

            var about = qs('a[href="/about"]', nav);
            if (about) {
                nav.insertBefore(link, about);
            } else {
                nav.appendChild(link);
            }
            setActiveNav();
        }).catch(function () {});
    }

    /** Safe text insertion — used for data we control, not user reviews. */
    function escapeText(value) {
        var div = document.createElement("div");
        div.textContent = value == null ? "" : String(value);
        return div.innerHTML;
    }

    function stars(rating) {
        var n = parseInt(rating, 10) || 0;
        var out = "";
        for (var i = 0; i < n; i++) out += "★";
        return out;
    }

    global.Inkwell = {
        qs: qs,
        qsa: qsa,
        formatPrice: formatPrice,
        formatDate: formatDate,
        getQueryParam: getQueryParam,
        productIdFromPath: productIdFromPath,
        postIdFromPath: postIdFromPath,
        fetchJSON: fetchJSON,
        setActiveNav: setActiveNav,
        renderAuthNav: renderAuthNav,
        renderAdminNav: renderAdminNav,
        escapeText: escapeText,
        stars: stars,
        readCart: readCart,
        writeCart: writeCart,
        getCartCount: getCartCount,
        updateCartBadge: updateCartBadge,
    };

    document.addEventListener("DOMContentLoaded", function () {
        ensureCartLink();
        setActiveNav();
        updateCartBadge();
        renderAuthNav();
        renderAdminNav();
    });
})(window);
