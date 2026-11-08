import { canBind, isPortOpen } from "./ports/bind.js";
import { probeHttp } from "./probe/http.js";
import { createProcessInspector, defaultStoreDir, execFileRunner, readProjectFiles } from "./process/inspect.js";
import { ReservationStore } from "./registry/store.js";
export function createHubDeps(overrides = {}) {
    const platform = overrides.platform ?? process.platform;
    const runner = overrides.runner ?? ((command, args) => execFileRunner(command, args));
    return {
        platform,
        runner,
        inspector: overrides.inspector ?? createProcessInspector(runner, platform),
        probe: overrides.probe ?? ((port, address) => probeHttp(port, address)),
        store: overrides.store ?? new ReservationStore(defaultStoreDir()),
        now: overrides.now ?? (() => new Date()),
        canBind: overrides.canBind ?? canBind,
        isListening: overrides.isListening ?? ((port, host) => isPortOpen(port, host)),
        readProjectFiles: overrides.readProjectFiles ?? readProjectFiles,
    };
}
//# sourceMappingURL=runtime.js.map