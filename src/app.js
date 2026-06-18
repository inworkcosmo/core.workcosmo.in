import { initAuthGuard } from "./auth-guard.js";

// Initialize Auth Guard and load application dashboard
initAuthGuard(({ user, profile, company }) => {
    // Render Company Branding
    const companyBadge = document.getElementById("company-badge");
    if (companyBadge) {
        companyBadge.textContent = company.companyName || company.name || "Workspace";
    }

    // Render User profile details
    const userNameEl = document.getElementById("sidebar-user-name");
    const userRoleEl = document.getElementById("sidebar-user-role");
    const avatarEl = document.getElementById("user-avatar");

    const name = profile.name || profile.displayName || user.displayName || user.email.split("@")[0] || "User";
    if (userNameEl) userNameEl.textContent = name;
    if (userRoleEl) userRoleEl.textContent = profile.role || "Member";
    if (avatarEl) avatarEl.textContent = name.charAt(0).toUpperCase();

    // Setup Navigation Tabs logic
    const navItems = document.querySelectorAll("#sidebar-nav .nav-item");
    const sections = document.querySelectorAll(".content-section");
    const pageTitle = document.getElementById("page-title");
    const pageSubtitle = document.getElementById("header-subtitle");

    const sectionMeta = {
        "dashboard": { title: "Dashboard", subtitle: "HR core operations" },
        "employees": { title: "Employee Directory", subtitle: "Workspace employee records" },
        "org-chart": { title: "Org Chart", subtitle: "Visual organization hierarchy" },
        "documents": { title: "Documents", subtitle: "Corporate file vault" },
        "settings": { title: "Settings", subtitle: "Manage module preferences" }
    };

    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const sectionId = item.getAttribute("data-section");
            if (!sectionId) return;

            // Update active navigation item
            navItems.forEach(nav => nav.classList.remove("active"));
            item.classList.add("active");

            // Display target section
            sections.forEach(sec => sec.classList.remove("active"));
            const targetSec = document.getElementById(`section-${sectionId}`);
            if (targetSec) targetSec.classList.add("active");

            // Update Header Meta
            const meta = sectionMeta[sectionId];
            if (meta) {
                if (pageTitle) pageTitle.textContent = meta.title;
                if (pageSubtitle) pageSubtitle.textContent = meta.subtitle;
            }
        });
    });

    // Mobile menu toggle
    const menuBtn = document.getElementById("mobile-menu-btn");
    const sidebar = document.getElementById("sidebar");
    if (menuBtn && sidebar) {
        menuBtn.addEventListener("click", () => {
            sidebar.classList.toggle("open");
        });

        // Close sidebar if user clicks outside of it on mobile view
        document.addEventListener("click", (e) => {
            if (!sidebar.contains(e.target) && !menuBtn.contains(e.target) && sidebar.classList.contains("open")) {
                sidebar.classList.remove("open");
            }
        });
    }
});
