(function () {
    function productCard(p) {
        var desc = p.description.length > 80 ? p.description.slice(0, 80) + "…" : p.description;
        return (
            '<article class="card">' +
            '<div class="product-img">☕</div>' +
            '<div class="card-body">' +
            "<h3><a href=\"/shop/" + p.id + "\">" + Inkwell.escapeText(p.name) + "</a></h3>" +
            '<p class="sans muted" style="font-size: 14px;">' + Inkwell.escapeText(desc) + "</p>" +
            '<div class="price">' + Inkwell.formatPrice(p.price_cents) + "</div>" +
            '<p class="sans muted" style="font-size: 12px;">' + p.stock + " in stock</p>" +
            '<div class="shop-actions">' +
            '<input class="cart-qty" type="number" min="1" max="10" value="1" data-qty-for="' + p.id + '">' +
            '<button class="btn btn-primary add-cart-btn" type="button" data-product-id="' + p.id + '">Add to cart</button>' +
            "</div>" +
            "</div></article>"
        );
    }

    document.addEventListener("DOMContentLoaded", function () {
        var grid = Inkwell.qs("#shop-grid");
        if (!grid) return;
        Inkwell.fetchJSON("/api/products").then(function (products) {
            grid.innerHTML = products.map(productCard).join("");
            grid.addEventListener("click", function (e) {
                var btn = e.target.closest(".add-cart-btn");
                if (!btn) return;
                var productId = parseInt(btn.getAttribute("data-product-id"), 10);
                var product = products.find(function (p) { return p.id === productId; });
                var qtyInput = Inkwell.qs('[data-qty-for="' + productId + '"]', grid);
                var qty = qtyInput ? qtyInput.value : 1;
                if (!product) return;
                InkwellStore.addToCart(product, qty);
                btn.textContent = "Added";
                setTimeout(function () {
                    btn.textContent = "Add to cart";
                }, 900);
            });
        });
    });
})();
