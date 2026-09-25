chrome.runtime.onInstalled.addListener(async (e) => {
	console.log("CCTV GeoPlanner Extension installed/reloaded:", e.reason);
	try {
		let e = await chrome.tabs.query({ url: [
			"*://earth.google.com/*",
			"*://*.google.com/earth/*",
			"*://google.com/earth/*",
			"*://*.google.com/maps/*",
			"*://maps.google.com/*",
			"*://google.com/maps/*"
		] });
		for (let t of e) if (t.id) try {
			await chrome.scripting.executeScript({
				target: { tabId: t.id },
				files: ["content/content.js"]
			}), await chrome.scripting.insertCSS({
				target: { tabId: t.id },
				files: ["content/content.css"]
			});
		} catch {}
	} catch (e) {
		console.debug("Tab auto-injection skipped:", e);
	}
}), chrome.action.onClicked.addListener(async (e) => {
	if (!e.id) return;
	let t = e.url || "";
	if (t.includes("earth.google.com") || t.includes("google.com/maps")) try {
		await chrome.tabs.sendMessage(e.id, { type: "TOGGLE_OVERLAY" });
	} catch {}
	else chrome.tabs.create({ url: "https://earth.google.com/web/" });
}), chrome.runtime.onMessage.addListener((e, t, n) => {
	if (e?.type === "CAPTURE_VISIBLE_TAB") {
		let e = t.tab?.windowId, r = (e) => {
			chrome.runtime.lastError || !e ? (console.warn("captureVisibleTab error:", chrome.runtime.lastError?.message), n({
				success: !1,
				error: chrome.runtime.lastError?.message || "Failed to capture visible tab"
			})) : n({
				success: !0,
				dataUrl: e
			});
		};
		try {
			typeof e == "number" ? chrome.tabs.captureVisibleTab(e, { format: "png" }, r) : chrome.tabs.captureVisibleTab({ format: "png" }, r);
		} catch (e) {
			n({
				success: !1,
				error: e?.message || "captureVisibleTab error"
			});
		}
		return !0;
	}
});
//#endregion
