(function () {
    function listCard(post) {
        return (
            '<article class="card" style="margin-bottom: 16px;"><div class="card-body">' +
            '<div class="meta">' + Inkwell.formatDate(post.published_at) + " · " + Inkwell.escapeText(post.author) + "</div>" +
            "<h3><a href=\"/blog/" + post.id + "\">" + Inkwell.escapeText(post.title) + "</a></h3>" +
            "<p>" + Inkwell.escapeText(post.excerpt) + "</p>" +
            '<a href="/blog/' + post.id + '">Read more →</a>' +
            "</div></article>"
        );
    }

    document.addEventListener("DOMContentLoaded", function () {
        var listEl = Inkwell.qs("#blog-list");
        var postEl = Inkwell.qs("#blog-post");
        var postId = Inkwell.postIdFromPath();

        if (listEl) {
            Inkwell.fetchJSON("/api/posts").then(function (posts) {
                listEl.innerHTML = posts.map(listCard).join("");
            });
        }

        if (postEl && postId) {
            Inkwell.fetchJSON("/api/posts/" + postId).then(function (post) {
                document.title = post.title + " — Celestial Sips";
                postEl.innerHTML =
                    '<div class="meta sans">' + Inkwell.formatDate(post.published_at) + " · " + Inkwell.escapeText(post.author) + "</div>" +
                    "<h1>" + Inkwell.escapeText(post.title) + "</h1>" +
                    post.body;
            }).catch(function () {
                postEl.innerHTML = "<p>Post not found.</p>";
            });
        }
    });
})();
