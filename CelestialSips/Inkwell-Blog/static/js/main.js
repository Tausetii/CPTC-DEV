/**
 * Celestial Sips storefront helpers
 * TODO: remove before prod — temp staff login for QA:
 *   barista_mgr / espresso2049
 *   inventory / beans_and_books
 */
(function () {
    function normalizeQuantity(value) {
        var qty = parseInt(value, 10) || 1;
        if (qty < 1) qty = 1;
        if (qty > 10) qty = 10;
        return qty;
    }

    function addToCart(product, quantity) {
        var cart = Inkwell.readCart();
        var qty = normalizeQuantity(quantity);
        var existing = cart.find(function (item) {
            return item.product_id === product.id;
        });

        if (existing) {
            existing.quantity = normalizeQuantity(existing.quantity + qty);
        } else {
            cart.push({
                product_id: product.id,
                name: product.name,
                unit_price_cents: product.price_cents,
                quantity: qty,
            });
        }
        Inkwell.writeCart(cart);
    }

    function removeFromCart(productId) {
        var cart = Inkwell.readCart().filter(function (item) {
            return item.product_id !== productId;
        });
        Inkwell.writeCart(cart);
    }

    function updateCartQuantity(productId, quantity) {
        var cart = Inkwell.readCart();
        var item = cart.find(function (entry) {
            return entry.product_id === productId;
        });
        if (!item) return;
        item.quantity = normalizeQuantity(quantity);
        Inkwell.writeCart(cart);
    }

    function clearCart() {
        Inkwell.writeCart([]);
    }

    window.InkwellStore = {
        addToCart: addToCart,
        removeFromCart: removeFromCart,
        updateCartQuantity: updateCartQuantity,
        clearCart: clearCart,
        normalizeQuantity: normalizeQuantity,
    };
})();
