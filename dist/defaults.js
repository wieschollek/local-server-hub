export const FRAMEWORK_DEFAULTS = {
    vite: 5173,
    next: 3000,
    nuxt: 3000,
    astro: 4321,
    angular: 4200,
    webpack: 8080,
    remix: 3000,
    django: 8000,
    flask: 5000,
    fastapi: 8000,
    rails: 3000,
    php: 8000,
    go: 8080,
    spring: 8080,
    dotnet: 5000,
    rust: 8080,
    node: 3000,
    docker: 8080,
};
export const KNOWN_FRAMEWORKS = Object.keys(FRAMEWORK_DEFAULTS);
export function frameworkDefault(framework) {
    return FRAMEWORK_DEFAULTS[framework.toLowerCase()] ?? null;
}
export function defaultProbePorts() {
    return [...new Set(Object.values(FRAMEWORK_DEFAULTS))].sort((a, b) => a - b);
}
//# sourceMappingURL=defaults.js.map