//#region src/extension/utils/urlHelper.ts
function e(e) {
	if (!e || typeof e != "string") return !1;
	let t = e.trim();
	if (!t) return !1;
	try {
		let e = new URL(t);
		if (e.protocol !== "https:" && e.protocol !== "http:" || e.hostname !== "earth.google.com") return !1;
		let n = e.pathname;
		return !!(n === "/web" || n.startsWith("/web/"));
	} catch {
		return !1;
	}
}
function t(t) {
	return e(t?.url);
}
chrome.runtime.onInstalled.addListener(async (e) => {
	console.log("CCTV GeoPlanner Extension installed/reloaded:", e.reason);
	try {
		let e = await chrome.tabs.query({ url: ["*://earth.google.com/web/*"] });
		for (let n of e) if (n.id && t(n)) try {
			await chrome.scripting.executeScript({
				target: { tabId: n.id },
				files: ["content/content.js"]
			}), await chrome.scripting.insertCSS({
				target: { tabId: n.id },
				files: ["content/content.css"]
			});
		} catch {}
	} catch (e) {
		console.debug("Tab auto-injection skipped:", e);
	}
}), chrome.action.onClicked.addListener(async (e) => {
	if (e.id) {
		if (t(e)) try {
			await chrome.tabs.sendMessage(e.id, { type: "TOGGLE_OVERLAY" });
		} catch {}
		else chrome.tabs.create({ url: "https://earth.google.com/web/" });
	}
}), chrome.runtime.onMessage.addListener((e, n, r) => {
	if (e?.type === "CAPTURE_VISIBLE_TAB") {
		if (n.tab && !t(n.tab)) return r({
			success: !1,
			error: "Unauthorized origin for tab capture"
		}), !1;
		let e = n.tab?.windowId, i = (e) => {
			chrome.runtime.lastError || !e ? (console.warn("captureVisibleTab error:", chrome.runtime.lastError?.message), r({
				success: !1,
				error: chrome.runtime.lastError?.message || "Failed to capture visible tab"
			})) : r({
				success: !0,
				dataUrl: e
			});
		};
		try {
			typeof e == "number" ? chrome.tabs.captureVisibleTab(e, { format: "png" }, i) : chrome.tabs.captureVisibleTab({ format: "png" }, i);
		} catch (e) {
			r({
				success: !1,
				error: e?.message || "captureVisibleTab error"
			});
		}
		return !0;
	}
});
//#endregion
