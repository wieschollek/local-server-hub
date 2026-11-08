import { httpUrl, loopbackHost } from "../address.js";
export function extractTitle(html) {
    const match = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    return match ? decodeBasic(match[1].trim()) : null;
}
export async function probeHttp(port, address, timeoutMs = 800) {
    const url = httpUrl(address, port);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const head = await fetch(url, { method: "HEAD", signal: controller.signal, redirect: "manual" });
        if (head.status !== 405 && head.status !== 501) {
            return { url, ok: head.status > 0, status: head.status, title: null, error: null };
        }
        const body = await fetch(url, { method: "GET", signal: controller.signal, redirect: "manual" });
        const text = (await body.text()).slice(0, 32_768);
        return { url, ok: body.status > 0, status: body.status, title: extractTitle(text), error: null };
    }
    catch (error) {
        const name = error instanceof Error ? error.name : "Error";
        return { url, ok: false, status: null, title: null, error: name === "AbortError" ? "timeout" : name };
    }
    finally {
        clearTimeout(timer);
    }
}
export function displayHost(address) {
    return loopbackHost(address);
}
function decodeBasic(value) {
    return value
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'");
}
//# sourceMappingURL=http.js.map