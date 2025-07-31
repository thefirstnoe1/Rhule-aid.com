// Enhanced Mobile Menu Functionality
// This file provides consistent mobile menu behavior across all pages

// Enhanced mobile menu toggle function with debugging
function toggleMobileMenu() {
    console.log('toggleMobileMenu called');
    const nav = document.getElementById('site-nav');
    if (!nav) {
        console.error('site-nav element not found');
        return;
    }
    
    const isOpen = nav.classList.contains('mobile-open');
    console.log('Current state:', isOpen ? 'open' : 'closed');
    
    nav.classList.toggle('mobile-open');
    
    const newState = nav.classList.contains('mobile-open');
    console.log('New state:', newState ? 'open' : 'closed');
    
    // Update toggle button appearance
    const toggleBtn = document.querySelector('.mobile-menu-toggle');
    if (toggleBtn) {
        toggleBtn.innerHTML = newState ? '✕' : '☰';
        toggleBtn.setAttribute('aria-expanded', newState.toString());
    }
}

// Close mobile menu when clicking outside
function initMobileMenuClickOutside() {
    document.addEventListener('click', function(event) {
        const nav = document.getElementById('site-nav');
        const toggleBtn = document.querySelector('.mobile-menu-toggle');
        
        if (nav && nav.classList.contains('mobile-open')) {
            const isClickInsideNav = nav.contains(event.target);
            const isClickOnToggle = toggleBtn && toggleBtn.contains(event.target);
            
            if (!isClickInsideNav && !isClickOnToggle) {
                nav.classList.remove('mobile-open');
                if (toggleBtn) {
                    toggleBtn.innerHTML = '☰';
                    toggleBtn.setAttribute('aria-expanded', 'false');
                }
            }
        }
    });
}

// Initialize mobile menu functionality when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initMobileMenuClickOutside();
    
    // Ensure mobile menu toggle has proper accessibility attributes
    const toggleBtn = document.querySelector('.mobile-menu-toggle');
    if (toggleBtn) {
        toggleBtn.setAttribute('aria-label', 'Toggle navigation menu');
        toggleBtn.setAttribute('aria-expanded', 'false');
        toggleBtn.setAttribute('aria-controls', 'site-nav');
    }
});

// Close mobile menu when window is resized to desktop
window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
        const nav = document.getElementById('site-nav');
        const toggleBtn = document.querySelector('.mobile-menu-toggle');
        
        if (nav && nav.classList.contains('mobile-open')) {
            nav.classList.remove('mobile-open');
            if (toggleBtn) {
                toggleBtn.innerHTML = '☰';
                toggleBtn.setAttribute('aria-expanded', 'false');
            }
        }
    }
});
