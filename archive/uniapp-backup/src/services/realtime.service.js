import { SUPABASE_CONFIG } from "../../lib/supabase";
import { fetchFoodNodes } from "./foodNodes.service";

let timer = 0;
let lastDigest = "";

function digestNodes(nodes) {
    return JSON.stringify(
        (nodes || []).map((n) => [n.id, n.updated_at || "", n.lng, n.lat, n.name || ""])
    );
}

export function stopFoodNodesSync() {
    if (timer) {
        clearInterval(timer);
        timer = 0;
    }
    lastDigest = "";
}

export function startFoodNodesSync({ accessToken, onChange, onError }) {
    stopFoodNodesSync();

    const pull = async () => {
        try {
            const rows = await fetchFoodNodes(accessToken);
            const digest = digestNodes(rows);
            if (digest !== lastDigest) {
                lastDigest = digest;
                if (typeof onChange === "function") onChange(rows);
            }
        } catch (err) {
            if (typeof onError === "function") onError(err);
        }
    };

    pull();
    timer = setInterval(pull, Math.max(1200, Number(SUPABASE_CONFIG.realtimePollMs) || 3000));
}
