// ===================================
// Navigation Scroll Effect
// ===================================
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('navToggle');
const navMenu = document.getElementById('navMenu');
const navLinks = document.querySelectorAll('.nav-link');

// Add scrolled class to navbar on scroll
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Mobile Navigation Toggle
navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    navMenu.classList.toggle('active');
});

// Close mobile menu when clicking on a nav link
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
    });
});

// Close mobile menu when clicking outside
document.addEventListener('click', (e) => {
    if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
        navToggle.classList.remove('active');
        navMenu.classList.remove('active');
    }
});

// ===================================
// Smooth Scrolling for Navigation Links
// ===================================
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        const targetSection = document.querySelector(targetId);
        
        if (targetSection) {
            const offsetTop = targetSection.offsetTop - 80;
            window.scrollTo({
                top: offsetTop,
                behavior: 'smooth'
            });
        }
    });
});

// ===================================
// Active Navigation Link on Scroll
// ===================================
const sections = document.querySelectorAll('section[id]');

function highlightNavigation() {
    const scrollY = window.pageYOffset;

    sections.forEach(section => {
        const sectionHeight = section.offsetHeight;
        const sectionTop = section.offsetTop - 100;
        const sectionId = section.getAttribute('id');
        const navLink = document.querySelector(`.nav-link[href="#${sectionId}"]`);

        if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
            navLink?.classList.add('active');
        } else {
            navLink?.classList.remove('active');
        }
    });
}

window.addEventListener('scroll', highlightNavigation);

// ===================================
// Intersection Observer for Animations
// ===================================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -100px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all sections for fade-in animation
document.querySelectorAll('.section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(30px)';
    section.style.transition = 'opacity 0.8s ease-out, transform 0.8s ease-out';
    observer.observe(section);
});

// ===================================
// Contact Form Handling
// ===================================
const contactForm = document.getElementById('contactForm');
const emailInput = document.getElementById('email');
const emailError = document.getElementById('emailError');
const formStatus = document.getElementById('formStatus');
const contactSubmit = document.getElementById('contactSubmit');

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

function updateEmailValidation(forceShowError = false) {
    if (!emailInput) return true;

    // Always reset first — avoids stale customValidity poisoning validity.valid
    emailInput.setCustomValidity('');

    const email = emailInput.value.trim();

    if (!email) {
        if (forceShowError) {
            const message = 'Please enter your email address.';
            emailInput.setCustomValidity(message);
            if (emailError) {
                emailError.textContent = message;
                emailError.hidden = false;
            }
            emailInput.setAttribute('aria-invalid', 'true');
            return false;
        }
        if (emailError) {
            emailError.textContent = '';
            emailError.hidden = true;
        }
        emailInput.removeAttribute('aria-invalid');
        return false;
    }

    // Use our regex — do NOT call checkValidity() here; it reads back the
    // browser's state which may be stale in some browser/OS combinations.
    if (!EMAIL_REGEX.test(email)) {
        const message = 'Enter a valid email address, for example name@example.com.';
        emailInput.setCustomValidity(message);
        if (emailError && (forceShowError || !emailError.hidden)) {
            emailError.textContent = message;
            emailError.hidden = false;
            emailInput.setAttribute('aria-invalid', 'true');
        }
        return false;
    }

    // Format is valid
    if (emailError) {
        emailError.textContent = '';
        emailError.hidden = true;
    }
    emailInput.removeAttribute('aria-invalid');
    return true;
}

const emailValidationCache = new Map();
let isFormSubmitting = false;
let isQuotaExhaustedClient = false;

if (contactForm && emailInput) {
    emailInput.addEventListener('input', () => {
        updateEmailValidation(false);
    });

    emailInput.addEventListener('blur', () => {
        if (emailInput.value.trim()) {
            updateEmailValidation(true);
        }
    });

    contactForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (isFormSubmitting) return;
        isFormSubmitting = true;

        // Layer 0: Anti-Spam Honeypot Check (silent drop for automated bots)
        const honeypotInput = document.getElementById('website_hp');
        const honeypotVal = honeypotInput ? honeypotInput.value.trim() : '';
        if (honeypotVal !== '') {
            console.warn('[contactForm] Honeypot field filled. Silently dropping bot submission.');
            formStatus.textContent = 'Thank you\u2014your message has been sent.';
            formStatus.className = 'form-status form-status-success';
            contactForm.reset();
            isFormSubmitting = false;
            return;
        }

        // Layer 0.5: Client Session Rate Limiter (2nd anti-abuse layer for browser session)
        try {
            const now = Date.now();
            const sessionData = JSON.parse(sessionStorage.getItem('mk_form_submissions') || '[]');
            const recentSubmissions = sessionData.filter(t => now - t < 10 * 60 * 1000);
            if (recentSubmissions.length >= 3) {
                formStatus.textContent = 'Too many submissions from this browser session. Please wait 10 minutes before sending another message.';
                formStatus.className = 'form-status form-status-error';
                isFormSubmitting = false;
                return;
            }
        } catch (_err) {}

        // Layer 1: fast local format check (no network)
        const isFormatValid = updateEmailValidation(true);
        if (!isFormatValid || !contactForm.checkValidity()) {
            contactForm.reportValidity();
            isFormSubmitting = false;
            return;
        }

        const originalButtonText = contactSubmit.querySelector('span').textContent;
        contactSubmit.disabled = true;
        contactSubmit.querySelector('span').textContent = 'Sending...';
        formStatus.textContent = '';
        formStatus.className = 'form-status';

        const nameVal = document.getElementById('name') ? document.getElementById('name').value.trim() : '';
        const emailVal = emailInput.value.trim();
        const subjectVal = document.getElementById('subject') ? document.getElementById('subject').value.trim() : '';
        const messageVal = document.getElementById('message') ? document.getElementById('message').value.trim() : '';

        // Layer 2: Send complete payload to /api/contact serverless endpoint
        // (Handles IP rate limiting, honeypot, Abstract API check, and server-side Formspree proxy)
        try {
            const response = await fetch('/api/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    name: nameVal,
                    email: emailVal,
                    subject: subjectVal,
                    message: messageVal,
                    website_hp: honeypotVal,
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const errMsg = data.error || data.reason || 'Your message could not be sent. Please try again.';
                if (response.status === 429) {
                    formStatus.textContent = errMsg;
                    formStatus.className = 'form-status form-status-error';
                } else if (data.reason || (data.error && data.error.toLowerCase().includes('email'))) {
                    if (emailError) {
                        emailError.textContent = errMsg;
                        emailError.hidden = false;
                    }
                    emailInput.setAttribute('aria-invalid', 'true');
                    emailInput.setCustomValidity(errMsg);
                    formStatus.textContent = '';
                } else {
                    formStatus.textContent = errMsg;
                    formStatus.className = 'form-status form-status-error';
                }
                return;
            }

            // Success -> record session timestamp
            try {
                const now = Date.now();
                const sessionData = JSON.parse(sessionStorage.getItem('mk_form_submissions') || '[]');
                const recentSubmissions = sessionData.filter(t => now - t < 10 * 60 * 1000);
                recentSubmissions.push(now);
                sessionStorage.setItem('mk_form_submissions', JSON.stringify(recentSubmissions));
            } catch (_err) {}

            contactForm.reset();
            emailInput.removeAttribute('aria-invalid');
            emailInput.setCustomValidity('');
            if (emailError) emailError.hidden = true;
            formStatus.textContent = 'Thank you\u2014your message has been sent.';
            formStatus.className = 'form-status form-status-success';

        } catch (_err) {
            formStatus.textContent = 'Your message could not be sent due to a network error. Please try again later.';
            formStatus.className = 'form-status form-status-error';
        } finally {
            contactSubmit.disabled = false;
            contactSubmit.querySelector('span').textContent = originalButtonText;
            isFormSubmitting = false;
        }
    });
}

// ===================================
// Resume Button Alert
// ===================================
const resumeBtn = document.getElementById('resumeBtn');

if (resumeBtn) {
    resumeBtn.addEventListener('click', (e) => {
    e.preventDefault();
    
    // Create custom alert
    const alertBox = document.createElement('div');
    alertBox.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: var(--bg-secondary);
        border: 2px solid var(--accent-primary);
        border-radius: 16px;
        padding: 40px;
        z-index: 10000;
        max-width: 500px;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    `;
    
    alertBox.innerHTML = `
        <i class="fas fa-file-pdf" style="font-size: 48px; color: var(--accent-primary); margin-bottom: 20px;"></i>
        <h3 style="color: var(--text-primary); margin-bottom: 15px; font-family: var(--font-display); font-size: 24px;">Resume Coming Soon</h3>
        <p style="color: var(--text-secondary); margin-bottom: 25px; line-height: 1.6;">
            Upload your resume PDF and update the link in the HTML file. 
            Replace the '#' in the "View Resume" button href with your resume URL.
        </p>
        <button onclick="this.parentElement.remove()" style="
            background-color: var(--accent-primary);
            color: var(--bg-primary);
            border: none;
            padding: 12px 32px;
            border-radius: 8px;
            font-weight: 600;
            cursor: pointer;
            font-size: 15px;
        ">Got it!</button>
    `;
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.7);
        z-index: 9999;
        backdrop-filter: blur(5px);
    `;
    
    overlay.onclick = () => {
        overlay.remove();
        alertBox.remove();
    };
    
    document.body.appendChild(overlay);
    document.body.appendChild(alertBox);
    });
}

// ===================================
// Typed Effect for Hero Subtitle (Optional Enhancement)
// ===================================
function typeEffect(element, text, speed = 100) {
    let i = 0;
    element.textContent = '';
    
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    
    type();
}

// Uncomment to enable typing effect on hero subtitle
// window.addEventListener('load', () => {
//     const subtitle = document.querySelector('.hero-subtitle');
//     const originalText = subtitle.textContent;
//     typeEffect(subtitle, originalText, 80);
// });

// ===================================
// Scroll Progress Indicator
// ===================================
function createScrollProgress() {
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        height: 3px;
        background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
        z-index: 10000;
        transition: width 0.1s ease-out;
    `;
    document.body.appendChild(progressBar);
    
    window.addEventListener('scroll', () => {
        const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
        const scrolled = (window.scrollY / windowHeight) * 100;
        progressBar.style.width = scrolled + '%';
    });
}

// Call this function to enable scroll progress indicator
createScrollProgress();

// ===================================
// Parallax Effect for Hero Decoration
// ===================================
window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    const decorationCircles = document.querySelectorAll('.decoration-circle');
    
    decorationCircles.forEach((circle, index) => {
        const speed = 0.5 + (index * 0.2);
        circle.style.transform = `translateY(${scrolled * speed}px)`;
    });
});

// ===================================
// Lazy Loading Images (for future use)
// ===================================
if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                img.src = img.dataset.src;
                img.classList.add('loaded');
                observer.unobserve(img);
            }
        });
    });
    
    // Observe all images with data-src attribute
    document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
    });
}

// ===================================
// Console Message (Easter Egg)
// ===================================
console.log('%c👋 Hello, Developer!', 'color: #d4a574; font-size: 24px; font-weight: bold;');
console.log('%cLooking to customize this portfolio?', 'color: #b0b0b0; font-size: 16px;');
console.log('%c1. Update personal information in index.html', 'color: #707070; font-size: 14px;');
console.log('%c2. Add your projects in the Projects section', 'color: #707070; font-size: 14px;');
console.log('%c3. Customize colors in styles.css (CSS Variables)', 'color: #707070; font-size: 14px;');
console.log('%c4. Add your social media links', 'color: #707070; font-size: 14px;');
console.log('%cHappy coding! 🚀', 'color: #d4a574; font-size: 16px; font-weight: bold;');

// ===================================
// Subtle Haptic Feedback (Vibration API)
// ===================================
(function initHapticFeedback() {
    // Helper to safely trigger subtle haptic vibration
    function triggerHaptic(duration = 10) {
        if (!('vibrate' in navigator) || typeof navigator.vibrate !== 'function') return;
        
        // Respect reduced motion / accessibility preferences
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) return;
        
        try {
            navigator.vibrate(duration);
        } catch (e) {
            // Ignore potential permission/device restrictions
        }
    }

    // Attach subtle haptic feedback using event delegation
    document.addEventListener('click', (e) => {
        const target = e.target.closest('a, button, .btn, .social-link, .nav-link, .nav-logo');
        if (!target) return;

        // CTA buttons (Contact Me, View Resume, Send Message) get slightly stronger feedback (12ms)
        if (target.classList.contains('btn') || target.tagName === 'BUTTON' || target.getAttribute('type') === 'submit') {
            triggerHaptic(12);
        } 
        // Navigation links, social links & logos get ultra-short subtle pulse (8ms)
        else if (target.classList.contains('nav-link') || target.classList.contains('social-link') || target.classList.contains('nav-logo')) {
            triggerHaptic(8);
        }
        // General links
        else if (target.tagName === 'A') {
            triggerHaptic(8);
        }
    }, { passive: true });
})();

// ===================================
// Web Audio API Synthesized UI Click Sound
// ===================================
(function initClickSound() {
    let audioCtx = null;

    function playSynthesizedClick() {
        try {
            // Lazy-initialize shared AudioContext on user interaction
            if (!audioCtx) {
                const AudioContextClass = window.AudioContext || window.webkitAudioContext;
                if (!AudioContextClass) return;
                audioCtx = new AudioContextClass();
            }

            // Ensure AudioContext is active (resumed if suspended by browser autoplay rules)
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }

            const now = audioCtx.currentTime;

            // Minimal UI Pop: Warm sine oscillator with rapid pitch drop (420Hz -> 120Hz) + lowpass filter
            const duration = 0.065; // 65ms total duration
            const osc = audioCtx.createOscillator();
            const filter = audioCtx.createBiquadFilter();
            const gainNode = audioCtx.createGain();

            // Smooth sine wave with pitch drop for a natural rounded pop
            osc.type = 'sine';
            osc.frequency.setValueAtTime(420, now);
            osc.frequency.exponentialRampToValueAtTime(120, now + 0.055);

            // Lowpass filter at 1400Hz to remove metallic transients
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1400, now);

            // Volume envelope (~12% peak volume, fast exponential decay)
            gainNode.gain.setValueAtTime(0.12, now);
            gainNode.gain.exponentialRampToValueAtTime(0.0005, now + duration);

            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(audioCtx.destination);

            osc.start(now);
            osc.stop(now + duration);
        } catch (e) {
            // Fail silently without console errors on unsupported devices
        }
    }

    // Attach click listener to real interactive elements
    document.addEventListener('click', (e) => {
        const target = e.target.closest('a, button, .btn, .social-link, .nav-link, .nav-logo, .project-card, .filter-btn');
        if (target) {
            playSynthesizedClick();
        }
    }, { passive: true });
})();

// ===================================
// Premium 3D Spotlight + Tilt Interactions
// ===================================
(function init3DInteractions() {
    // Disable 3D mouse tracking on touch devices or reduced motion
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isTouchDevice || prefersReducedMotion) return;

    // Helper to calculate mouse percentage coordinates for dynamic CSS spotlight
    function setMouseSpotlight(el, e) {
        const rect = el.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        el.style.setProperty('--mouse-x', `${x.toFixed(1)}%`);
        el.style.setProperty('--mouse-y', `${y.toFixed(1)}%`);
    }

    // 1. Project Cards — Full 3D Spotlight + Tilt (5–6° max, subtle internal parallax)
    const projectCards = document.querySelectorAll('.project-card');
    projectCards.forEach(card => {
        let reqId = null;
        const cardImg = card.querySelector('.project-img');

        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (((y - centerY) / centerY) * -5.5).toFixed(2);
            const rotateY = (((x - centerX) / centerX) * 5.5).toFixed(2);

            setMouseSpotlight(card, e);

            if (reqId) cancelAnimationFrame(reqId);
            reqId = requestAnimationFrame(() => {
                card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-3px)`;
                if (cardImg) {
                    cardImg.style.transform = `scale(1.05) translate3d(${(rotateY * -0.5).toFixed(1)}px, ${(rotateX * 0.5).toFixed(1)}px, 0)`;
                }
            });
        });

        card.addEventListener('mouseleave', () => {
            if (reqId) cancelAnimationFrame(reqId);
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
            if (cardImg) {
                cardImg.style.transform = 'scale(1) translate3d(0, 0, 0)';
            }
        });
    });

    // 2. Profile Card — Lighter 3D Spotlight + Tilt (3–4° max)
    const profileCard = document.querySelector('.contact-portrait');
    if (profileCard) {
        let reqId = null;
        const portraitImg = profileCard.querySelector('.contact-portrait-image');

        profileCard.addEventListener('mousemove', (e) => {
            const rect = profileCard.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (((y - centerY) / centerY) * -3.5).toFixed(2);
            const rotateY = (((x - centerX) / centerX) * 3.5).toFixed(2);

            setMouseSpotlight(profileCard, e);

            if (reqId) cancelAnimationFrame(reqId);
            reqId = requestAnimationFrame(() => {
                profileCard.style.transform = `perspective(800px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
                if (portraitImg) {
                    portraitImg.style.transform = `translate3d(${(rotateY * -0.4).toFixed(1)}px, ${(rotateX * 0.4).toFixed(1)}px, 0)`;
                }
            });
        });

        profileCard.addEventListener('mouseleave', () => {
            if (reqId) cancelAnimationFrame(reqId);
            profileCard.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateY(0px)';
            if (portraitImg) {
                portraitImg.style.transform = 'translate3d(0, 0, 0)';
            }
        });
    }

    // 3. Skill Cards — Spotlight Only (no heavy tilt, 1–2px lift)
    const skillCards = document.querySelectorAll('.skill-category');
    skillCards.forEach(card => {
        let reqId = null;

        card.addEventListener('mousemove', (e) => {
            setMouseSpotlight(card, e);
        });

        card.addEventListener('mouseleave', () => {
            if (reqId) cancelAnimationFrame(reqId);
            card.style.transform = 'translateY(0px)';
        });
    });

    // 4. Social Icons — Micro 3D Tilt (2–3° max)
    const socialLinks = document.querySelectorAll('.social-link');
    socialLinks.forEach(link => {
        let reqId = null;

        link.addEventListener('mousemove', (e) => {
            const rect = link.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            const rotateX = ((y / (rect.height / 2)) * -2.5).toFixed(2);
            const rotateY = ((x / (rect.width / 2)) * 2.5).toFixed(2);

            if (reqId) cancelAnimationFrame(reqId);
            reqId = requestAnimationFrame(() => {
                link.style.transform = `perspective(400px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
            });
        });

        link.addEventListener('mouseleave', () => {
            if (reqId) cancelAnimationFrame(reqId);
            link.style.transform = 'perspective(400px) rotateX(0deg) rotateY(0deg) translateY(0px)';
        });
    });

    // 5. CTA Buttons — Light Magnetic Cursor Interaction (4–6px max)
    const ctaButtons = document.querySelectorAll('.hero-cta .btn, .btn-primary, .btn-secondary');
    ctaButtons.forEach(btn => {
        let reqId = null;

        btn.addEventListener('mousemove', (e) => {
            const rect = btn.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;

            const moveX = (x * 0.15).toFixed(2);
            const moveY = (y * 0.15).toFixed(2);

            if (reqId) cancelAnimationFrame(reqId);
            reqId = requestAnimationFrame(() => {
                btn.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;
            });
        });

        btn.addEventListener('mouseleave', () => {
            if (reqId) cancelAnimationFrame(reqId);
            btn.style.transform = 'translate3d(0px, 0px, 0px)';
        });
    });

    // 6. Hero Section — Mouse-Following Parallax (5–10px max on decorative elements)
    const heroSection = document.querySelector('.hero');
    const heroCircles = document.querySelectorAll('.hero-decoration .decoration-circle');

    if (heroSection && heroCircles.length > 0) {
        let reqId = null;

        heroSection.addEventListener('mousemove', (e) => {
            const rect = heroSection.getBoundingClientRect();
            const relX = (e.clientX - rect.left - rect.width / 2) / (rect.width / 2);
            const relY = (e.clientY - rect.top - rect.height / 2) / (rect.height / 2);

            if (reqId) cancelAnimationFrame(reqId);
            reqId = requestAnimationFrame(() => {
                heroCircles.forEach((circle, idx) => {
                    const depth = (idx + 1) * 3; // 3px, 6px, 9px max
                    const moveX = (relX * depth).toFixed(2);
                    const moveY = (relY * depth).toFixed(2);
                    circle.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;
                });
            });
        });

        heroSection.addEventListener('mouseleave', () => {
            if (reqId) cancelAnimationFrame(reqId);
            heroCircles.forEach(circle => {
                circle.style.transform = 'translate3d(0px, 0px, 0px)';
            });
        });
    }
})();

// ===================================
// Subtle Hero Proximity Color Interaction
// ===================================
(function initHeroProximity() {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (isTouchDevice || prefersReducedMotion) return;

    const hero = document.querySelector('.hero');
    if (!hero) return;

    // Target elements with .cursor-reactive ONLY inside hero
    const targets = Array.from(hero.querySelectorAll('.cursor-reactive'));
    if (targets.length === 0) return;

    const maxRadius = 250; // 250px proximity radius requirement
    let mouseX = -1000;
    let mouseY = -1000;
    let isInsideHero = false;

    // Track proximity state per element for smooth lerping
    const items = targets.map(el => ({
        el,
        currentProximity: 0,
        targetProximity: 0
    }));

    window.addEventListener('mousemove', (e) => {
        const heroRect = hero.getBoundingClientRect();
        if (
            e.clientX >= heroRect.left &&
            e.clientX <= heroRect.right &&
            e.clientY >= heroRect.top &&
            e.clientY <= heroRect.bottom
        ) {
            isInsideHero = true;
            mouseX = e.clientX;
            mouseY = e.clientY;
        } else {
            isInsideHero = false;
        }
    }, { passive: true });

    document.addEventListener('mouseleave', () => {
        isInsideHero = false;
    });

    // Helper: interpolate RGB (for standard text / non-clipped text if any)
    function interpolateColor(p) {
        // Normal text color baseline: default white / light gray (#ffffff / rgb(255,255,255))
        // Target: Electric Blue (#008CFF -> rgb(0, 140, 255)) to Cyan (#00B7FF -> rgb(0, 183, 255))
        const r = Math.round(255 * (1 - p) + 0 * p);
        const g = Math.round(255 * (1 - p) + (140 + 43 * p) * p);
        const b = 255;
        return `rgb(${r}, ${g}, ${b})`;
    }

    function animate() {
        items.forEach(item => {
            const el = item.el;
            if (isInsideHero) {
                const rect = el.getBoundingClientRect();
                const centerX = rect.left + rect.width / 2;
                const centerY = rect.top + rect.height / 2;
                const dist = Math.hypot(mouseX - centerX, mouseY - centerY);

                if (dist < maxRadius) {
                    item.targetProximity = Math.min(1, Math.max(0, 1 - dist / maxRadius));
                } else {
                    item.targetProximity = 0;
                }
            } else {
                item.targetProximity = 0;
            }

            // Lerp smoothing: current += (target - current) * 0.12
            item.currentProximity += (item.targetProximity - item.currentProximity) * 0.12;
            const p = item.currentProximity;

            // Apply visual changes based on proximity intensity p (0 to 1)
            if (p > 0.005) {
                // Glow intensity for distance < 100px (proximity > 0.6)
                const glowAlpha = p > 0.6 ? (p - 0.6) * 0.75 : 0;
                const glowBlur = Math.round(p * 14);

                if (el.classList.contains('hero-name')) {
                    // Hero name has background-clip: text.
                    // We apply SVG drop-shadow filter + color saturation shift
                    el.style.filter = `drop-shadow(0 0 ${glowBlur}px rgba(0, 183, 255, ${0.3 + glowAlpha})) brightness(${1 + p * 0.35})`;
                } else if (el.classList.contains('hero-accent-text')) {
                    // AI & Data Science (gradient background clipped)
                    el.style.filter = `drop-shadow(0 0 ${glowBlur}px rgba(0, 183, 255, ${0.4 + glowAlpha})) brightness(${1 + p * 0.4})`;
                } else {
                    // Standard text elements (e.g. CTA text)
                    el.style.color = interpolateColor(p);
                    if (p > 0.6) {
                        el.style.textShadow = `0 0 12px rgba(0, 168, 255, ${glowAlpha})`;
                    } else {
                        el.style.textShadow = 'none';
                    }
                }
            } else {
                // Reset when far away
                if (el.classList.contains('hero-name') || el.classList.contains('hero-accent-text')) {
                    el.style.filter = 'none';
                } else {
                    el.style.color = '';
                    el.style.textShadow = '';
                }
            }
        });

        requestAnimationFrame(animate);
    }

    // Start continuous rAF loop
    requestAnimationFrame(animate);
})();


