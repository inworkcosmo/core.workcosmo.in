import { auth, db, doc, getDoc, onAuthStateChanged, signInWithCustomToken, signOut } from "./firebase.js";

// Helper to normalize and retrieve companyId
export function getCompanyId() {
    const pathSegment = window.location.pathname.split("/").filter(Boolean)[0];
    const reserved = new Set(["index.html", "src", "css", "js", "assets", "shared", "app"]);
    if (pathSegment && !reserved.has(pathSegment.toLowerCase())) {
        return pathSegment.toLowerCase().trim();
    }
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("companyId") || params.get("company") || params.get("cid") || sessionStorage.getItem("tenant_client_id") || "";
    return cid.toLowerCase().trim();
}

async function performSSOLogin(idToken) {
    const isLocal = window.location.hostname.toLowerCase() === 'localhost' || window.location.hostname.toLowerCase() === '127.0.0.1';
    const urls = [];
    if (isLocal) {
        urls.push("http://localhost:8080/api/sso");
    }
    urls.push("https://workcosmo.in/api/sso");

    let lastError = null;
    for (const url of urls) {
        try {
            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.customToken) return data.customToken;
            }
        } catch (err) {
            lastError = err;
        }
    }
    throw lastError || new Error("SSO Token Exchange failed");
}

export function initAuthGuard(onSuccess) {
    const loader = document.getElementById("auth-loader");
    const appShell = document.getElementById("app-shell");

    (async () => {
        const params = new URLSearchParams(window.location.search);
        const ssoToken = params.get("ssoToken");

        if (ssoToken) {
            if (loader) {
                const statusEl = loader.querySelector("p") || loader;
                statusEl.textContent = "Signing in with Space Single Sign-On...";
            }
            try {
                console.log("SSO token found, exchanging...");
                const customToken = await performSSOLogin(ssoToken);
                await signInWithCustomToken(auth, customToken);
                
                // Clear ssoToken from URL
                params.delete("ssoToken");
                const newSearch = params.toString();
                const cleanUrl = window.location.pathname + (newSearch ? "?" + newSearch : "");
                window.history.replaceState({}, document.title, cleanUrl);
            } catch (err) {
                console.error("SSO Token Exchange failed:", err);
                alert("SSO Login failed: " + err.message);
            }
        }

        onAuthStateChanged(auth, async (user) => {
        if (!user || user.isAnonymous) {
            // Redirect to Space login
            const cid = getCompanyId();
            const spaceUrl = cid ? `https://space.workcosmo.in?companyId=${cid}` : "https://space.workcosmo.in";
            window.location.href = spaceUrl;
            return;
        }

        try {
            // Load User Profile
            const userSnap = await getDoc(doc(db, "users", user.uid));
            if (!userSnap.exists()) {
                alert("User profile not found. Redirecting to Space.");
                await signOut(auth);
                window.location.href = "https://space.workcosmo.in";
                return;
            }

            const profile = userSnap.data();
            if (profile.status !== "active") {
                alert("Your account is inactive. Redirecting to Space.");
                await signOut(auth);
                window.location.href = "https://space.workcosmo.in";
                return;
            }

            // Verify Company Scope
            const userCompanyId = String(profile.companyId || profile.clientId || profile.subdomain || "").toLowerCase().trim();
            const urlCompanyId = getCompanyId();

            if (urlCompanyId && userCompanyId !== urlCompanyId) {
                alert(`Access Denied: Your account belongs to company '${userCompanyId}', but you are trying to access '${urlCompanyId}'.`);
                await signOut(auth);
                window.location.href = `https://space.workcosmo.in?companyId=${urlCompanyId}`;
                return;
            }

            // Load Company Details
            const companySnap = await getDoc(doc(db, "companies", userCompanyId));
            if (!companySnap.exists()) {
                alert("Workspace metadata not found. Redirecting to Space.");
                await signOut(auth);
                window.location.href = "https://space.workcosmo.in";
                return;
            }
            const company = companySnap.data();

            // Verify Core module is enabled
            const modulesEnabled = company.modulesEnabled || {};
            const isCoreEnabled = Object.prototype.hasOwnProperty.call(modulesEnabled, "core")
                ? modulesEnabled.core === true
                : (Array.isArray(company.features) ? company.features.includes("coreModule") : false);

            if (!isCoreEnabled) {
                alert("The Core module is not enabled for this workspace.");
                await signOut(auth);
                window.location.href = `https://space.workcosmo.in?companyId=${userCompanyId}`;
                return;
            }

            // Store in Session
            sessionStorage.setItem("tenant_client_id", userCompanyId);

            // Hide Loader & Show App
            if (loader) loader.classList.add("hidden");
            if (appShell) appShell.classList.remove("hidden");

            // Execute success callback
            if (typeof onSuccess === "function") {
                onSuccess({ user, profile, company });
            }
        } catch (error) {
            console.error("Auth Guard Error:", error);
            alert("Authentication check failed. Please log in again.");
            await signOut(auth);
            window.location.href = "https://space.workcosmo.in";
        }
    });
    })();

    // Handle logout button
    document.getElementById("sign-out-btn")?.addEventListener("click", async () => {
        await signOut(auth);
        window.location.href = "https://space.workcosmo.in";
    });
}
