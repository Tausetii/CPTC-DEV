(function () {
    function showQueryFlash(id, param) {
        var value = Inkwell.getQueryParam(param);
        var el = Inkwell.qs(id);
        if (el && value) {
            el.textContent = value;
            el.hidden = false;
        }
    }

    document.addEventListener("DOMContentLoaded", function () {
        showQueryFlash("#login-error", "error");
        showQueryFlash("#login-query", "query");
        showQueryFlash("#staff-login-error", "error");

        var regFlash = Inkwell.qs("#register-flash");
        if (regFlash) {
            if (Inkwell.getQueryParam("registered")) {
                regFlash.className = "flash success";
                regFlash.textContent = "Account created. Please log in.";
                regFlash.hidden = false;
            }
            if (Inkwell.getQueryParam("error")) {
                regFlash.className = "flash error";
                regFlash.textContent = Inkwell.getQueryParam("error");
                regFlash.hidden = false;
            }
        }

        var accountPage = Inkwell.qs("#account-page");
        if (accountPage) {
            Inkwell.fetchJSON("/api/auth/me").then(function (data) {
                if (!data.authenticated) {
                    window.location.href = "/login";
                    return;
                }
                var html =
                    "<h1>My account</h1>" +
                    '<p class="sans">Signed in as <strong>' + Inkwell.escapeText(data.username) + "</strong> (" + Inkwell.escapeText(data.role) + ")</p>" +
                    '<div class="card" style="margin-top: 20px; max-width: 520px;"><div class="card-body">' +
                    '<h3 class="sans">Profile</h3>' +
                    "<p><strong>Name:</strong> " + Inkwell.escapeText(data.full_name) + "</p>" +
                    "<p><strong>Email:</strong> " + Inkwell.escapeText(data.email) + "</p>" +
                    "</div></div>";

                if (data.secret_token) {
                    html +=
                        '<div class="card" style="margin-top: 20px; max-width: 520px;"><div class="card-body">' +
                        '<h3 class="sans">API token</h3>' +
                        '<p style="font-family: monospace; font-size: 14px;">' + Inkwell.escapeText(data.secret_token) + '</p>' +
                        '</div></div>';
                }
                accountPage.innerHTML = html;
            }).catch(function () {
                window.location.href = "/login";
            });
        }
    });
})();
