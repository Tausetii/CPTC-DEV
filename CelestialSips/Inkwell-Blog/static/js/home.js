(function () {
    function cardHTML(post) {
        return (
            '<article class="card"><div class="card-body">' +
            '<div class="meta">' + Inkwell.formatDate(post.published_at) + " · " + Inkwell.escapeText(post.author) + "</div>" +
            "<h3><a href=\"/blog/" + post.id + "\">" + Inkwell.escapeText(post.title) + "</a></h3>" +
            "<p>" + Inkwell.escapeText(post.excerpt) + "</p>" +
            "</div></article>"
        );
    }

    function productCardHTML(p) {
        return (
            '<article class="card">' +
            '<div class="product-img">☕</div>' +
            '<div class="card-body">' +
            "<h3><a href=\"/shop/" + p.id + "\">" + Inkwell.escapeText(p.name) + "</a></h3>" +
            '<div class="price">' + Inkwell.formatPrice(p.price_cents) + "</div>" +
            "</div></article>"
        );
    }

    document.addEventListener("DOMContentLoaded", function () {
        var postsEl = Inkwell.qs("#home-posts");
        var productsEl = Inkwell.qs("#home-products");

        if (postsEl) {
            Inkwell.fetchJSON("/api/posts?limit=3").then(function (posts) {
                postsEl.innerHTML = posts.map(cardHTML).join("");
            });
        }

        if (productsEl) {
            Inkwell.fetchJSON("/api/products").then(function (products) {
                productsEl.innerHTML = products.slice(0, 4).map(productCardHTML).join("");
            });
        }
    });
})();
