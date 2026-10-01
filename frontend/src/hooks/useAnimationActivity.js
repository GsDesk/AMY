import { useEffect, useState } from 'react';

// Decorative motion only runs while visible and allowed by system preferences.
export default function useAnimationActivity(ref) {
    const [active, setActive] = useState(false);
    useEffect(() => {
        const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
        let visible = false;
        const update = () => setActive(visible && !document.hidden && !preference.matches);
        const observer = new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            update();
        });
        if (ref.current) observer.observe(ref.current);
        preference.addEventListener('change', update);
        document.addEventListener('visibilitychange', update);
        return () => {
            observer.disconnect();
            preference.removeEventListener('change', update);
            document.removeEventListener('visibilitychange', update);
        };
    }, [ref]);
    return active;
}
