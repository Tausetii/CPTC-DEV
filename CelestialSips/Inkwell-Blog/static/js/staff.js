(function () {
    document.addEventListener("DOMContentLoaded", function () {
        var dashboard = Inkwell.qs("#staff-dashboard");
        if (!dashboard) return;

        Inkwell.fetchJSON("/api/staff/dashboard").then(function (data) {
            var rows = data.low_stock || [];
            var table = "";
            if (rows.length) {
                table =
                    '<table class="sans stock-table"><thead><tr><th>Product</th><th>Stock</th></tr></thead><tbody>' +
                    rows.map(function (item) {
                        return "<tr><td>" + Inkwell.escapeText(item.name) + "</td><td>" + item.stock + "</td></tr>";
                    }).join("") +
                    "</tbody></table>";
            } else {
                table = '<p class="sans muted">All products are well stocked.</p>';
            }

            dashboard.innerHTML =
                "<h1>Staff dashboard</h1>" +
                '<p class="sans"><form class="inline-form" action="/api/staff/logout" method="POST">' +
                '<button type="submit" class="link-btn">Sign out</button></form></p>' +
                '<div class="card" style="margin-top: 20px;"><div class="card-body">' +
                '<h3 class="sans">Low stock alert</h3>' + table +
                "</div></div>";
        }).catch(function () {
            window.location.href = "/staff/login";
        });
    });
})();
