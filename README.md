# 🌟 Personal Portfolio Website - Manish Kumar

A modern, elegant, and fully responsive personal portfolio website built with HTML, CSS, and JavaScript. Designed for students and early-career professionals to showcase their skills, education, and projects.

![Portfolio Preview](preview.png)

## ✨ Features

- **Elegant Dark Theme**: Sophisticated dark mode design with warm accent colors
- **Fully Responsive**: Optimized for all devices (mobile, tablet, desktop)
- **Smooth Animations**: Professional transitions and micro-interactions
- **SEO Optimized**: Meta tags and semantic HTML for better search visibility
- **Easy to Customize**: Well-structured code with clear comments
- **Project Ready**: Placeholder cards ready for your projects
- **Contact Form**: Built-in contact form (needs backend integration)
- **Social Links**: Integrated social media links section

## 🚀 Quick Start

### Option 1: Direct Download & Open
1. Download all files
2. Open `index.html` in your web browser
3. That's it! The site runs locally.

### Option 2: Live Server (Recommended for Development)
If you have VS Code:
1. Install the "Live Server" extension
2. Right-click on `index.html`
3. Select "Open with Live Server"

## 📁 Project Structure

```
portfolio/
│
├── index.html          # Main HTML file
├── styles.css          # All styling (colors, layout, animations)
├── script.js           # Interactive functionality
├── README.md           # This file
└── assets/             # Create this folder for images
    ├── resume.pdf      # Your resume (add this)
    ├── profile.jpg     # Your profile photo (add this)
    └── projects/       # Project screenshots (add these)
```

## 🎨 Customization Guide

### 1️⃣ Personal Information

**Update these in `index.html`:**

```html
<!-- Line 21-25: Update meta tags -->
<meta name="description" content="Your description here">
<meta name="keywords" content="Your, Keywords, Here">
<meta name="author" content="Your Name">

<!-- Line 38: Logo -->
<a href="#home" class="nav-logo">YI</a>  <!-- Your Initials -->

<!-- Line 57-60: Hero Section -->
<h1 class="hero-title">
    <span class="hero-name">Your Name</span>
</h1>
<p class="hero-subtitle">Your Professional Title</p>

<!-- Line 63-67: Hero Description -->
<p class="hero-description">
    Your personalized introduction here...
</p>

<!-- Line 82-97: Social Media Links -->
<a href="https://linkedin.com/in/yourprofile" class="social-link">
<a href="https://github.com/yourusername" class="social-link">
<a href="https://twitter.com/yourhandle" class="social-link">
<a href="https://instagram.com/yourhandle" class="social-link">

<!-- Line 112-130: About Section -->
Update the entire about text with your story

<!-- Line 158-178: Education Details -->
Update degree, university, dates, and description
```

### 2️⃣ Adding Your Photo

1. Create an `assets` folder in your project
2. Add your photo (e.g., `profile.jpg`)
3. In `index.html`, find line 140-145:

```html
<!-- Replace this: -->
<div class="image-placeholder">
    <i class="fas fa-user"></i>
    <p>Your Photo Here</p>
</div>

<!-- With this: -->
<img src="assets/profile.jpg" alt="Your Name" 
     style="width: 100%; height: 100%; object-fit: cover;">
```

### 3️⃣ Adding Projects

Find the Projects section (line 254-340) and replace placeholder cards:

```html
<div class="project-card">
    <div class="project-image">
        <!-- Add your project screenshot -->
        <img src="assets/projects/project1.jpg" alt="Project Name">
        <!-- Remove the project-overlay div for real projects -->
    </div>
    <div class="project-content">
        <div class="project-tags">
            <span class="tag">React</span>
            <span class="tag">Node.js</span>
        </div>
        <h3 class="project-title">Your Project Name</h3>
        <p class="project-description">
            Describe what your project does, technologies used, and impact.
        </p>
        <div class="project-links">
            <a href="https://github.com/yourusername/project" class="project-link">
                <i class="fab fa-github"></i>
                <span>Code</span>
            </a>
            <a href="https://your-project-demo.com" class="project-link">
                <i class="fas fa-external-link-alt"></i>
                <span>Live Demo</span>
            </a>
        </div>
    </div>
</div>
```

**To add more projects**, copy the entire `project-card` div and paste it in the `projects-grid`.

### 4️⃣ Updating Skills

Find the Skills section (line 197-252) and update skill badges:

```html
<div class="skill-items">
    <span class="skill-badge">Your Skill</span>
    <span class="skill-badge">Another Skill</span>
    <!-- Add more as needed -->
</div>
```

### 5️⃣ Contact Information

Update contact details (line 377-400):

```html
<a href="mailto:your.real.email@example.com">your.real.email@example.com</a>
<a href="tel:+919876543210">+91 98765 43210</a>
<p>Your City, Your State, India</p>
```

### 6️⃣ Adding Your Resume

1. Add your resume PDF to the `assets` folder
2. Update the resume button link in `index.html` (line 73):

```html
<a href="assets/resume.pdf" class="btn btn-secondary" download>
    <span>View Resume</span>
    <i class="fas fa-download"></i>
</a>
```

### 7️⃣ Color Customization

Want to change colors? Edit CSS variables in `styles.css` (line 1-16):

```css
:root {
    /* Change these colors */
    --accent-primary: #d4a574;     /* Main accent color */
    --accent-secondary: #c89858;   /* Secondary accent */
    --accent-hover: #e0b886;       /* Hover state */
    
    /* Or try different color schemes: */
    
    /* Blue Theme */
    --accent-primary: #4A90E2;
    --accent-secondary: #357ABD;
    
    /* Purple Theme */
    --accent-primary: #9B59B6;
    --accent-secondary: #8E44AD;
    
    /* Green Theme */
    --accent-primary: #27AE60;
    --accent-secondary: #229954;
}
```

## 🌐 Deployment Options

### Option 1: GitHub Pages (Recommended - Free & Easy)

1. **Create a GitHub account** (if you don't have one)

2. **Create a new repository**:
   - Go to github.com
   - Click "New repository"
   - Name it: `yourusername.github.io` (replace with your GitHub username)
   - Make it public
   - Don't initialize with README

3. **Upload your files**:
   ```bash
   # In your project folder, open terminal/command prompt
   git init
   git add .
   git commit -m "Initial portfolio commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/yourusername.github.io.git
   git push -u origin main
   ```

4. **Enable GitHub Pages**:
   - Go to repository Settings
   - Scroll to "Pages" section
   - Source: Deploy from branch "main"
   - Folder: / (root)
   - Click Save

5. **Access your site**: `https://yourusername.github.io`

**Note**: It may take a few minutes for your site to go live.

### Option 2: Netlify (Very Easy - Drag & Drop)

1. Go to [netlify.com](https://netlify.com)
2. Sign up (free account)
3. Drag your project folder into Netlify
4. Your site is live! You'll get a URL like `random-name.netlify.app`
5. You can customize the domain name in settings

### Option 3: Vercel (Great for Developers)

1. Install Vercel CLI:
   ```bash
   npm install -g vercel
   ```

2. In your project folder:
   ```bash
   vercel
   ```

3. Follow the prompts
4. Your site will be deployed!

### Option 4: Traditional Web Hosting

If you have traditional web hosting (like Hostinger, Bluehost, etc.):
1. Use FTP client (FileZilla)
2. Connect to your hosting
3. Upload all files to `public_html` or `www` folder
4. Access via your domain

## 📧 Contact Form Integration

The contact form is currently frontend-only. To make it functional:

### Option 1: FormSpree (Easiest)
1. Go to [formspree.io](https://formspree.io)
2. Sign up and create a form
3. Update form in `index.html`:
```html
<form class="contact-form" action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
```

### Option 2: EmailJS
1. Go to [emailjs.com](https://emailjs.com)
2. Set up email service
3. Add EmailJS script to your HTML
4. Update JavaScript to use EmailJS

### Option 3: Backend (Advanced)
Create your own backend with Node.js, PHP, or Python to handle form submissions.

## 🔧 Advanced Customizations

### Enable Typing Effect
Uncomment lines 178-183 in `script.js` to enable hero subtitle typing animation.

### Enable Custom Cursor
Uncomment line 294 in `script.js` to enable custom cursor effect (desktop only).

### Add More Sections
Copy the section structure and modify:
```html
<section id="newsection" class="newsection section">
    <div class="container">
        <div class="section-header">
            <span class="section-number">07</span>
            <h2 class="section-title">New Section</h2>
        </div>
        <!-- Your content here -->
    </div>
</section>
```

Don't forget to add navigation link!

## 🐛 Common Issues & Fixes

### Issue: Fonts not loading
**Solution**: Check internet connection. Fonts are loaded from Google Fonts CDN.

### Issue: Icons not showing
**Solution**: Font Awesome is loaded from CDN. Verify internet connection.

### Issue: Smooth scrolling not working
**Solution**: Some older browsers don't support smooth scrolling. This is expected behavior.

### Issue: Mobile menu not working
**Solution**: Ensure JavaScript file is properly linked and loaded.

## 📱 Browser Support

- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ⚠️ Internet Explorer (not recommended, limited support)

## 📄 License

This portfolio template is free to use for personal projects. Feel free to customize it to match your style!

## 🤝 Need Help?

If you encounter any issues:
1. Check the console for JavaScript errors (F12 in browser)
2. Validate your HTML at [validator.w3.org](https://validator.w3.org)
3. Ensure all file paths are correct
4. Make sure all files are in the same folder

## 🎯 Next Steps

After setting up your portfolio:

1. ✅ Update all personal information
2. ✅ Add your best profile photo
3. ✅ Upload your resume
4. ✅ Add 3-5 quality projects
5. ✅ Update all social media links
6. ✅ Test on mobile devices
7. ✅ Deploy to a live server
8. ✅ Share on LinkedIn!

## 🌟 Tips for a Great Portfolio

1. **Quality over Quantity**: 3 great projects > 10 mediocre ones
2. **Keep it Updated**: Add new projects and skills regularly
3. **Show Your Personality**: Let your unique voice shine through
4. **Test Everything**: Click all links, test all forms
5. **Get Feedback**: Ask friends/mentors to review
6. **Mobile First**: Most recruiters view on phones
7. **Load Speed Matters**: Optimize images (use TinyPNG.com)
8. **Professional Email**: Use a professional email address
9. **Proofread**: Check for typos and grammar errors
10. **Analytics**: Add Google Analytics to track visitors

## 📚 Resources

- [HTML Documentation](https://developer.mozilla.org/en-US/docs/Web/HTML)
- [CSS Tricks](https://css-tricks.com)
- [JavaScript Info](https://javascript.info)
- [Web Dev Simplified](https://www.youtube.com/c/WebDevSimplified)
- [Free Code Camp](https://www.freecodecamp.org)

---

**Built with ❤️ for aspiring developers**

Good luck with your portfolio! 🚀
