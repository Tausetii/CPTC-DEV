/**
 * Product page — reviews rendered via innerHTML (intentionally vulnerable to HTML XSS).
 */
(function () {
    function renderReviews(reviews) {
        var container = Inkwell.qs("#reviews-list");
        if (!container) return;

        if (!reviews.length) {
            container.innerHTML = '<p class="sans muted">No reviews yet. Be the first!</p>';
            return;
        }

        // Intentionally unsafe: review body is inserted as raw HTML for "rich text" support.
        var html = "";
        reviews.forEach(function (r) {
            html +=
                '<div class="review">' +
                '<div class="author">' + r.author + "</div>" +
                '<div class="stars sans">' + Inkwell.stars(r.rating) + "</div>" +
                '<div class="body">' + r.body + "</div>" +
                "</div>";
        });
        container.innerHTML = html;
    }

    function setStockLabel(count) {
        var stock = Inkwell.qs("#product-stock");
        if (stock) {
            stock.textContent = count + " units in stock";
        }
    }

    function bindStockRefresh(product) {
        var btn = Inkwell.qs("#stock-refresh-btn");
        if (!btn || !product.stock_api_url) return;

        btn.addEventListener("click", function () {
            var id = Inkwell.productIdFromPath();
            if (!id) return;

            var query = "?stock_api=" + encodeURIComponent(product.stock_api_url);
            btn.disabled = true;
            Inkwell.fetchJSON("/api/products/" + id + "/stock" + query).then(function (data) {
                setStockLabel(data.available);
            }).catch(function () {
                setStockLabel("—");
            }).finally(function () {
                btn.disabled = false;
            });
        });
    }

    function loadProduct() {
        var id = Inkwell.productIdFromPath();
        if (!id) return;

        Inkwell.fetchJSON("/api/products/" + id).then(function (product) {
            document.title = product.name + " — Celestial Sips";
            Inkwell.qs("#product-name").textContent = product.name;
            Inkwell.qs("#product-price").textContent = Inkwell.formatPrice(product.price_cents);
            Inkwell.qs("#product-desc").textContent = product.description;
            setStockLabel(product.stock);
            bindStockRefresh(product);
            var btn = Inkwell.qs("#product-add-cart");
            if (btn) {
                btn.addEventListener("click", function () {
                    var qty = Inkwell.qs("#product-qty").value;
                    InkwellStore.addToCart(product, qty);
                    btn.textContent = "Added to cart";
                    setTimeout(function () {
                        btn.textContent = "Add to cart";
                    }, 900);
                });
            }
        });

        Inkwell.fetchJSON("/api/products/" + id + "/reviews").then(renderReviews);
    }

    function bindReviewForm() {
        var form = Inkwell.qs("#review-form");
        if (!form) return;

        Inkwell.fetchJSON("/api/auth/me").then(function (me) {
            if (me.authenticated) {
                Inkwell.qs("#review-author").value = me.full_name;
            }
        }).catch(function () {});

        form.addEventListener("submit", function (e) {
            e.preventDefault();
            var id = Inkwell.productIdFromPath();
            var msg = Inkwell.qs("#review-message");
            var body = {
                author: Inkwell.qs("#review-author").value,
                rating: Inkwell.qs("#review-rating").value,
                body: Inkwell.qs("#review-body").value,
            };

            fetch("/api/products/" + id + "/reviews", {
                method: "POST",
                credentials: "same-origin",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            }).then(function (res) {
                if (!res.ok) throw new Error("Failed to post review");
                form.reset();
                if (msg) {
                    msg.className = "flash success";
                    msg.textContent = "Thanks for your review!";
                    msg.hidden = false;
                }
                return Inkwell.fetchJSON("/api/products/" + id + "/reviews");
            }).then(renderReviews).catch(function () {
                if (msg) {
                    msg.className = "flash error";
                    msg.textContent = "Could not post review.";
                    msg.hidden = false;
                }
            });
        });
    }

    document.addEventListener("DOMContentLoaded", function () {
        loadProduct();
        bindReviewForm();
    });
})();
