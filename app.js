let clickCount = 0;

const clickBtn = document.getElementById('clickBtn');
const counter = document.getElementById('counter');
const contactForm = document.getElementById('contactForm');

clickBtn.addEventListener('click', () => {
    clickCount++;
    counter.textContent = `Clicks: ${clickCount}`;
    
    if (clickCount === 10) {
        alert('Congratulations! You clicked 10 times!');
    }
});

contactForm.addEventListener('submit', (e) => {
    e.preventDefault();
    alert('Thank you for your message! (This is a demo)');
    contactForm.reset();
});

document.querySelectorAll('nav a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        const targetSection = document.getElementById(targetId);
        
        if (targetSection) {
            targetSection.scrollIntoView({ behavior: 'smooth' });
        }
    });
});
