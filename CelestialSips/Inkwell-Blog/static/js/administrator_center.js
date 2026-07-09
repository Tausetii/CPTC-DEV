(function () {
    function renderUserRow(user) {
        return (
            "<tr>" +
            "<td>" + Inkwell.escapeText(user.username) + "</td>" +
            "<td>" + Inkwell.escapeText(user.full_name) + "</td>" +
            "<td>" + Inkwell.escapeText(user.email) + "</td>" +
            "<td>" + Inkwell.escapeText(user.role) + "</td>" +
            "</tr>"
        );
    }

    document.addEventListener("DOMContentLoaded", function () {
        var page = Inkwell.qs("#administrator-center");
        if (!page) return;

        Inkwell.fetchJSON("/api/administrator_center").then(function (data) {
            var summary = data.summary || {};
            var users = data.users || [];
            var operations = data.operations || [];

            page.innerHTML =
                "<h1>Administrator Center</h1>" +
                '<p class="sans muted">Internal operations console for site administrators.</p>' +
                '<div class="grid-3" style="margin-top: 24px;">' +
                '<div class="card"><div class="card-body"><div class="sans muted">Registered users</div><div style="font-size: 28px; font-weight: 700;">' + (summary.registered_users || 0) + "</div></div></div>" +
                '<div class="card"><div class="card-body"><div class="sans muted">Admin accounts</div><div style="font-size: 28px; font-weight: 700;">' + (summary.admin_accounts || 0) + "</div></div></div>" +
                '<div class="card"><div class="card-body"><div class="sans muted">Products listed</div><div style="font-size: 28px; font-weight: 700;">' + (summary.products_listed || 0) + "</div></div></div>" +
                "</div>" +
                '<div class="card" style="margin-top: 24px;"><div class="card-body">' +
                '<h3 class="sans">User directory</h3>' +
                '<table class="sans stock-table"><thead><tr>' +
                "<th>Username</th><th>Name</th><th>Email</th><th>Role</th>" +
                "</tr></thead><tbody>" +
                users.map(renderUserRow).join("") +
                "</tbody></table></div></div>" +
                '<div class="card" style="margin-top: 24px;"><div class="card-body">' +
                '<h3 class="sans">Pending operations</h3>' +
                '<ul class="sans">' + operations.map(function (item) {
                    return "<li>" + Inkwell.escapeText(item) + "</li>";
                }).join("") + "</ul></div></div>";
        }).catch(function () {
            page.innerHTML = "<p class=\"sans\">Could not load administrator data.</p>";
        });
    });
})();
