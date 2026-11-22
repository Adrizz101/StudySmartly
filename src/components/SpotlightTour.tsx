import { useEffect, useRef } from 'react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { useNavigate } from '@tanstack/react-router';

const TOUR_KEY = 'studysmartly_tour_completed';

export default function SpotlightTour() {
  const navigate = useNavigate();
  const driverRef = useRef<Driver | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    try {
      if (window.localStorage.getItem(TOUR_KEY) === 'true') return;
    } catch (error) {
      console.warn('[Spotlight Tour] Could not read tour preference:', error);
      return;
    }

    const timer = window.setTimeout(() => {
      const isMobile = window.matchMedia('(max-width: 1023px)').matches;
      const tour = driver({
        animate: true,
        smoothScroll: true,
        allowClose: false,
        overlayClickBehavior: () => {},
        disableActiveInteraction: false,
        showProgress: true,
        showButtons: ['next'],
        nextBtnText: 'Next →',
        popoverClass: 'studysmartly-tour-popover',
        overlayColor: 'rgba(3, 7, 18, 0.78)',
        stagePadding: 8,
        stageRadius: 16,
        steps: [
          {
            element: isMobile ? '[data-tour="sidebar-mobile"]' : '.sidebar-shell',
            popover: {
              title: 'Your command center',
              description: "Hey! Welcome to StudySmartly. This is your command center. Let's take a quick look around.",
              side: isMobile ? 'bottom' : 'right',
              align: 'start',
            },
          },
          {
            element: '[data-tour="dashboard"]',
            onNextClick: () => {
              if (window.matchMedia('(max-width: 1023px)').matches) {
                window.dispatchEvent(new Event('studysmartly:open-mobile-nav'));
                window.setTimeout(() => tour.moveNext(), 300);
              } else {
                tour.moveNext();
              }
            },
            popover: {
              title: 'Your dashboard',
              description: "Here you can see what's due, your study streak, and what to tackle next.",
              side: 'bottom',
              align: 'start',
            },
          },
          {
            element: '[data-tour="flashcards"]',
            popover: {
              title: 'Flashcards',
              description: 'Memorize anything fast with our spaced repetition flashcards.',
              side: 'right',
              align: 'start',
            },
          },
          {
            element: '[data-tour="exams"]',
            popover: {
              title: 'Exam Arena',
              description: 'Test your knowledge with past paper questions and mock exams.',
              side: 'right',
              align: 'start',
            },
          },
          {
            element: '[data-tour="tutor"]',
            popover: {
              title: 'AI Tutor',
              description: 'Stuck? Hop into the AI Tutor. It teaches you step-by-step, like a real tutor.',
              side: 'right',
              align: 'start',
            },
            onNextClick: () => {
              if (window.matchMedia('(max-width: 1023px)').matches) {
                window.dispatchEvent(new Event('studysmartly:close-mobile-nav'));
              }
              void navigate({ to: '/tutor' });
              window.setTimeout(() => tour.moveNext(), 500);
            },
          },
          {
            element: '[data-tour="upload"]',
            popover: {
              title: 'Upload your notes',
              description: "Got a photo of a textbook or a PDF? Upload it here and I'll read it for you.",
              side: 'top',
              align: 'center',
            },
          },
          {
            element: '[data-tour="settings"]',
            popover: {
              title: 'Make AI yours',
              description: "We're 100% free, so you get 15 AI questions a day. Want unlimited? Click here to add your own free API key.",
              side: isMobile ? 'bottom' : 'right',
              align: 'start',
            },
          },
        ],
        onPopoverRender: (popover) => {
          if (popover.wrapper.querySelector('.studysmartly-tour-skip')) return;
          const skip = document.createElement('button');
          skip.type = 'button';
          skip.className = 'studysmartly-tour-skip';
          skip.textContent = 'Skip Tour';
          skip.addEventListener('click', () => {
            try { window.localStorage.setItem(TOUR_KEY, 'true'); } catch (error) {
              console.warn('[Spotlight Tour] Could not save completion:', error);
            }
            tour.destroy();
            driverRef.current = null;
          });
          popover.footerButtons.appendChild(skip);
        },
        onDestroyed: () => {
          try { window.localStorage.setItem(TOUR_KEY, 'true'); } catch (error) {
            console.warn('[Spotlight Tour] Could not save completion:', error);
          }
          driverRef.current = null;
        },
      });
      driverRef.current = tour;
      startedRef.current = true;
      tour.drive();
    }, 900);

    return () => window.clearTimeout(timer);
  }, [navigate]);


  return null;
}
