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

        // Layer 1: fast local format check (no network)
        const isFormatValid = updateEmailValidation(true);
        if (!isFormatValid || !contactForm.checkValidity()) {
            contactForm.reportValidity();
            isFormSubmitting = false;
            return;
        }

        const originalButtonText = contactSubmit.querySelector('span').textContent;
        contactSubmit.disabled = true;
        contactSubmit.querySelector('span').textContent = 'Verifying...';
        formStatus.textContent = '';
        formStatus.className = 'form-status';

        // Layer 2: reputation check via our own backend proxy (never exposes the API key)
        const emailValue = emailInput.value.trim().toLowerCase();
        let validationResult = null;

        if (emailValidationCache.has(emailValue)) {
            validationResult = emailValidationCache.get(emailValue);
        } else if (!isQuotaExhaustedClient) {
            try {
                const validateRes = await fetch('/api/validate-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({ email: emailValue, website_hp: honeypotVal }),
                });

                if (validateRes.ok) {
                    const result = await validateRes.json();
                    if (result.fallback) {
                        isQuotaExhaustedClient = true;
                    }
                    emailValidationCache.set(emailValue, result);
                    validationResult = result;
                } else {
                    isQuotaExhaustedClient = true;
                }
            } catch (_err) {
                isQuotaExhaustedClient = true;
            }
        }

        if (validationResult && !validationResult.valid) {
            // Reputation check failed — show error, do not submit
            const msg = validationResult.reason ||
                'This email address does not appear to be deliverable. Please use a real address.';
            if (emailError) {
                emailError.textContent = msg;
                emailError.hidden = false;
            }
            emailInput.setAttribute('aria-invalid', 'true');
            emailInput.setCustomValidity(msg);
            contactSubmit.disabled = false;
            contactSubmit.querySelector('span').textContent = originalButtonText;
            isFormSubmitting = false;
            return;
        }

        // Layer 3: Submit to Formspree
        contactSubmit.querySelector('span').textContent = 'Sending...';
        try {
            const response = await fetch(contactForm.action, {
                method: 'POST',
                body: new FormData(contactForm),
                headers: { Accept: 'application/json' },
            });

            if (!response.ok) {
                throw new Error('Submission failed');
            }

            contactForm.reset();
            emailInput.removeAttribute('aria-invalid');
            emailInput.setCustomValidity('');
            if (emailError) emailError.hidden = true;
            formStatus.textContent = 'Thank you\u2014your message has been sent.';
            formStatus.classList.add('form-status-success');
        } catch (_err) {
            formStatus.textContent = 'Your message could not be sent. Please try again or email me directly.';
            formStatus.classList.add('form-status-error');
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
// Cursor Follow Effect (Optional)
// ===================================
function createCursorEffect() {
    const cursor = document.createElement('div');
    cursor.style.cssText = `
        position: fixed;
        width: 20px;
        height: 20px;
        border: 2px solid var(--accent-primary);
        border-radius: 50%;
        pointer-events: none;
        z-index: 9999;
        transition: transform 0.15s ease-out, opacity 0.15s ease-out;
        opacity: 0;
    `;
    document.body.appendChild(cursor);
    
    let mouseX = 0;
    let mouseY = 0;
    let cursorX = 0;
    let cursorY = 0;
    
    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        cursor.style.opacity = '1';
    });
    
    document.addEventListener('mouseleave', () => {
        cursor.style.opacity = '0';
    });
    
    function animateCursor() {
        const diffX = mouseX - cursorX;
        const diffY = mouseY - cursorY;
        
        cursorX += diffX * 0.1;
        cursorY += diffY * 0.1;
        
        cursor.style.left = cursorX + 'px';
        cursor.style.top = cursorY + 'px';
        
        requestAnimationFrame(animateCursor);
    }
    
    animateCursor();
    
    // Scale cursor on hover over interactive elements
    const interactiveElements = document.querySelectorAll('a, button, .btn, .project-card, .skill-badge');
    interactiveElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            cursor.style.transform = 'scale(2)';
        });
        el.addEventListener('mouseleave', () => {
            cursor.style.transform = 'scale(1)';
        });
    });
}

// Uncomment to enable custom cursor (works best on desktop)
// createCursorEffect();

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
