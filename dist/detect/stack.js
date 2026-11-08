const COMMAND_RULES = [
    [/\bvite\b/i, "vite"],
    [/(^|[^\w.-])next(\s|-server|\b)/i, "next"],
    [/\bnuxt\b/i, "nuxt"],
    [/\bastro\b/i, "astro"],
    [/ng serve|@angular/i, "angular"],
    [/webpack-dev-server/i, "webpack"],
    [/\bremix\b/i, "remix"],
    [/uvicorn|fastapi/i, "fastapi"],
    [/\bflask\b/i, "flask"],
    [/manage\.py|django/i, "django"],
    [/\brails\b|\bpuma\b/i, "rails"],
    [/artisan/i, "php"],
    [/spring-boot|springframework/i, "spring"],
    [/\bdotnet\b/i, "dotnet"],
    [/\bcargo\b/i, "rust"],
    [/(^|[^\w])go(\s|$)|go-build/i, "go"],
    [/docker-proxy|com\.docker/i, "docker"],
    [/\b(node|npm|pnpm|yarn|bun)\b/i, "node"],
];
function hasDep(pkg, name) {
    return new RegExp(`"${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"\\s*:`).test(pkg);
}
function stackFromFiles(files) {
    const pkg = files["package.json"];
    if (pkg) {
        if (hasDep(pkg, "vite") || hasDep(pkg, "vitejs"))
            return "vite";
        if (hasDep(pkg, "next"))
            return "next";
        if (hasDep(pkg, "nuxt"))
            return "nuxt";
        if (hasDep(pkg, "astro"))
            return "astro";
        if (hasDep(pkg, "@angular/core"))
            return "angular";
        if (hasDep(pkg, "@remix-run/dev") || hasDep(pkg, "@remix-run/serve"))
            return "remix";
        if (hasDep(pkg, "webpack-dev-server"))
            return "webpack";
    }
    if ("manage.py" in files)
        return "django";
    const python = `${files["pyproject.toml"] ?? ""}\n${files["requirements.txt"] ?? ""}`;
    if (/fastapi/i.test(python))
        return "fastapi";
    if (/flask/i.test(python))
        return "flask";
    if (/django/i.test(python))
        return "django";
    if ("Gemfile" in files)
        return "rails";
    if ("artisan" in files || "composer.json" in files)
        return "php";
    if ("go.mod" in files)
        return "go";
    const java = `${files["pom.xml"] ?? ""}\n${files["build.gradle"] ?? ""}\n${files["build.gradle.kts"] ?? ""}`;
    if (/springframework|spring-boot/i.test(java))
        return "spring";
    if (Object.keys(files).some((name) => name.endsWith(".csproj")))
        return "dotnet";
    if ("Cargo.toml" in files)
        return "rust";
    return null;
}
export function detectStack(command, files) {
    let fromCommand = null;
    if (command) {
        for (const [pattern, stack] of COMMAND_RULES) {
            if (pattern.test(command)) {
                fromCommand = stack;
                break;
            }
        }
    }
    if (fromCommand && fromCommand !== "node") {
        return fromCommand;
    }
    return stackFromFiles(files) ?? fromCommand ?? "unknown";
}
//# sourceMappingURL=stack.js.map