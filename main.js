/**
 * Nuur Al Shams - Navigation & UI Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const mainNav = document.getElementById('mainNav');
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const sideMenu = document.getElementById('sideMenu');
    const menuOverlay = document.getElementById('menuOverlay');
    const menuLinks = document.querySelectorAll('.menu-link');
    const pageTransitionOverlay = document.querySelector('.page-transition-overlay');

    // --- Menu Logic ---
    function toggleMenu() {
        hamburgerBtn.classList.toggle('open');
        sideMenu.classList.toggle('open');
        menuOverlay.classList.toggle('open');
        document.body.style.overflow = sideMenu.classList.contains('open') ? 'hidden' : '';
    }

    function closeMenu() {
        hamburgerBtn.classList.remove('open');
        sideMenu.classList.remove('open');
        menuOverlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', toggleMenu);
    }

    if (menuOverlay) {
        menuOverlay.addEventListener('click', closeMenu);
    }

    // --- Scroll Effect ---
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            mainNav?.classList.add('scrolled');
        } else {
            mainNav?.classList.remove('scrolled');
        }
    });

    // --- Smooth Scrolling & Page Transitions ---
    document.querySelectorAll('a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');

            // 1. Internal Anchor Link (Scroll)
            if (href && href.includes('#')) {
                const parts = href.split('#');
                const targetPage = parts[0];
                const targetId = '#' + parts[1];
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';

                // If same page
                if (targetPage === '' || targetPage === currentPage) {
                    e.preventDefault();
                    closeMenu();
                    const targetElement = document.querySelector(targetId);
                    if (targetElement) {
                        if (targetId === '#contact-section' && window.innerWidth <= 768) {
                            const yOffset = -120; // Increased offset for better visibility
                            const y = targetElement.getBoundingClientRect().top + window.pageYOffset + yOffset;
                            window.scrollTo({ top: y, behavior: 'smooth' });
                        } else {
                            targetElement.scrollIntoView({ behavior: 'smooth' });
                        }
                    }
                    return;
                }
            }

            // 2. External Page Link (Transition)
            if (href && !href.startsWith('#') && !href.startsWith('http') && !this.target) {
                e.preventDefault();
                closeMenu();
                
                // Start Transition
                document.body.classList.add('page-transitioning');
                
                setTimeout(() => {
                    window.location.href = href;
                }, 400); // Match CSS transition duration
            }
        });
    });

    // --- Active Link Highlight ---
    function updateActiveLink() {
        const currentPath = window.location.pathname.split('/').pop() || 'index.html';
        const currentHash = window.location.hash;
        
        menuLinks.forEach(link => {
            const linkHref = link.getAttribute('href');
            if (linkHref === (currentPath + currentHash) || linkHref === currentPath) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }

    updateActiveLink();
    window.addEventListener('hashchange', updateActiveLink);

    // --- Gallery Slider (Learn More Page) ---
    const slides = document.querySelectorAll('.slide');
    const prevBtn = document.querySelector('.slider-btn.prev');
    const nextBtn = document.querySelector('.slider-btn.next');
    let currentSlide = 0;

    function showSlide(index) {
        if (!slides.length) return;
        slides.forEach(s => s.classList.remove('active'));
        if (index >= slides.length) currentSlide = 0;
        else if (index < 0) currentSlide = slides.length - 1;
        else currentSlide = index;
        slides[currentSlide].classList.add('active');
    }
    
    // --- Hash Scroll Fix on Load ---
    window.addEventListener('load', () => {
        if (window.location.hash === "#contact-section" && window.innerWidth <= 768) {
            const el = document.getElementById("contact-section");
            if (el) {
                setTimeout(() => {
                    const yOffset = -120; // Increased offset to prevent header overlap
                    const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
                    window.scrollTo({ top: y, behavior: "smooth" });
                }, 300);
            }
        } else if (window.location.hash) {
            const targetId = window.location.hash;
            const el = document.querySelector(targetId);
            if (el) {
                setTimeout(() => {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 300);
            }
        }
    });

    if (nextBtn && prevBtn && slides.length > 0) {
        nextBtn.addEventListener('click', (e) => { e.preventDefault(); currentSlide++; showSlide(currentSlide); });
        prevBtn.addEventListener('click', (e) => { e.preventDefault(); currentSlide--; showSlide(currentSlide); });

        setInterval(() => {
            currentSlide++;
            showSlide(currentSlide);
        }, 5000);
    }
});