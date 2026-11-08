import { describe, expect, test } from "vitest";
import { detectStack } from "../src/detect/stack.js";

describe("detectStack", () => {
  test("recognizes common dev-server commands", () => {
    expect(detectStack("node /app/node_modules/vite/bin/vite.js", {})).toBe("vite");
    expect(detectStack("next dev", {})).toBe("next");
    expect(detectStack("nuxt dev", {})).toBe("nuxt");
    expect(detectStack("astro dev", {})).toBe("astro");
    expect(detectStack("ng serve", {})).toBe("angular");
    expect(detectStack("webpack-dev-server", {})).toBe("webpack");
    expect(detectStack("remix dev", {})).toBe("remix");
    expect(detectStack("uvicorn app:app", {})).toBe("fastapi");
    expect(detectStack("flask run", {})).toBe("flask");
    expect(detectStack("python manage.py runserver", {})).toBe("django");
    expect(detectStack("rails s", {})).toBe("rails");
    expect(detectStack("php artisan serve", {})).toBe("php");
    expect(detectStack("java -jar app.jar spring-boot", {})).toBe("spring");
    expect(detectStack("dotnet App.dll", {})).toBe("dotnet");
    expect(detectStack("cargo run", {})).toBe("rust");
    expect(detectStack("go run .", {})).toBe("go");
    expect(detectStack("docker-proxy", {})).toBe("docker");
  });

  test("refines a generic node process from project files", () => {
    expect(detectStack("node server.js", { package: "" })).toBe("node");
    expect(detectStack("node server.js", { "package.json": '{ "devDependencies": { "vite": "^5.0.0" } }' })).toBe("vite");
    expect(detectStack(null, { "manage.py": "" })).toBe("django");
    expect(detectStack(null, { "pyproject.toml": "[project]\ndependencies=['fastapi']" })).toBe("fastapi");
    expect(detectStack(null, { "requirements.txt": "flask==3.0.0" })).toBe("flask");
    expect(detectStack(null, { Gemfile: "gem 'rails'" })).toBe("rails");
    expect(detectStack(null, { "composer.json": "{}" })).toBe("php");
    expect(detectStack(null, { "go.mod": "module example" })).toBe("go");
    expect(detectStack(null, { "pom.xml": "<groupId>org.springframework.boot</groupId>" })).toBe("spring");
    expect(detectStack(null, { "App.csproj": "csproj" })).toBe("dotnet");
    expect(detectStack(null, { "Cargo.toml": "[package]" })).toBe("rust");
    expect(detectStack("python -m http.server", {})).toBe("unknown");
  });
});
