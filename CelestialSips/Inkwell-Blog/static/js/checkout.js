(function () {
    function cartTotal(items) {
        return items.reduce(function (sum, item) {
            return sum + (item.quantity * item.unit_price_cents);
        }, 0);
    }

    function renderCheckout(items) {
        var container = Inkwell.qs("#checkout-items");
        var totalEl = Inkwell.qs("#checkout-total");
        var buyBtn = Inkwell.qs("#buy-items-btn");
        if (!container) return;

        if (!items.length) {
            container.innerHTML = '<p class="sans muted">Your cart is empty.</p>';
            if (totalEl) totalEl.textContent = "$0.00";
            if (buyBtn) buyBtn.disabled = true;
            return;
        }

        container.innerHTML = items.map(function (item) {
            return (
                '<div class="cart-item">' +
                '<div class="cart-item-meta">' +
                '<h3>' + Inkwell.escapeText(item.name) + '</h3>' +
                '</div>' +
                '<div class="sans">Qty: ' + item.quantity + '</div>' +
                '<div class="price">' + Inkwell.formatPrice(item.quantity * item.unit_price_cents) + '</div>' +
                '</div>'
            );
        }).join("");

        if (totalEl) totalEl.textContent = Inkwell.formatPrice(cartTotal(items));
        if (buyBtn) buyBtn.disabled = false;
    }

    document.addEventListener("DOMContentLoaded", function () {
        var items = Inkwell.readCart();
        var flash = Inkwell.qs("#checkout-flash");
        var buyBtn = Inkwell.qs("#buy-items-btn");
        renderCheckout(items);

        if (!buyBtn) return;
        buyBtn.addEventListener("click", function () {
            var payload = { items: Inkwell.readCart() };
            fetch("/api/checkout", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            }).then(function (res) {
                return res.json().then(function (data) {
                    if (!res.ok) throw new Error(data.error || "Checkout failed");
                    return data;
                });
            }).then(function (data) {
                InkwellStore.clearCart();
                renderCheckout([]);
                if (flash) {
                    flash.className = "flash success";
                    flash.textContent = data.message;
                    flash.hidden = false;
                }
            }).catch(function (err) {
                if (flash) {
                    flash.className = "flash error";
                    flash.textContent = err.message || "Checkout failed";
                    flash.hidden = false;
                }
            });
        });
    });
})();
