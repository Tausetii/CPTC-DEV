(function () {
    function renderCart() {
        var items = Inkwell.readCart();
        var container = Inkwell.qs("#cart-items");
        var countEl = Inkwell.qs("#cart-item-count");
        var totalEl = Inkwell.qs("#cart-total");
        var checkoutLink = Inkwell.qs("#checkout-link");

        if (!container) return;

        if (!items.length) {
            container.innerHTML = '<p class="sans muted">Your cart is empty.</p>';
            if (countEl) countEl.textContent = "0";
            if (totalEl) totalEl.textContent = "$0.00";
            if (checkoutLink) checkoutLink.classList.add("disabled");
            return;
        }

        var totalQty = 0;
        var totalCents = 0;
        container.innerHTML = items.map(function (item) {
            totalQty += item.quantity;
            totalCents += item.quantity * item.unit_price_cents;
            return (
                '<div class="cart-item">' +
                '<div class="cart-item-meta">' +
                '<h3>' + Inkwell.escapeText(item.name) + '</h3>' +
                '<div class="sans muted">Unit price: ' + Inkwell.formatPrice(item.unit_price_cents) + '</div>' +
                '</div>' +
                '<input class="cart-qty" type="number" min="1" max="10" value="' + item.quantity + '" data-cart-qty="' + item.product_id + '">' +
                '<div class="price">' + Inkwell.formatPrice(item.quantity * item.unit_price_cents) + '</div>' +
                '<button class="btn btn-outline remove-cart-btn" type="button" data-remove-id="' + item.product_id + '">Remove</button>' +
                '</div>'
            );
        }).join("");

        if (countEl) countEl.textContent = String(totalQty);
        if (totalEl) totalEl.textContent = Inkwell.formatPrice(totalCents);
        if (checkoutLink) checkoutLink.classList.remove("disabled");
    }

    document.addEventListener("DOMContentLoaded", function () {
        var root = Inkwell.qs("#cart-items");
        if (!root) return;
        renderCart();

        root.addEventListener("change", function (e) {
            var input = e.target.closest("[data-cart-qty]");
            if (!input) return;
            var productId = parseInt(input.getAttribute("data-cart-qty"), 10);
            InkwellStore.updateCartQuantity(productId, input.value);
            renderCart();
        });

        root.addEventListener("click", function (e) {
            var btn = e.target.closest("[data-remove-id]");
            if (!btn) return;
            var productId = parseInt(btn.getAttribute("data-remove-id"), 10);
            InkwellStore.removeFromCart(productId);
            renderCart();
        });
    });
})();
