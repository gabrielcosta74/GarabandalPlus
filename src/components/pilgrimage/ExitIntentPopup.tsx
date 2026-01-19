"use client";

import { useEffect, useState } from 'react';
import { BrochureDownloadModal } from './BrochureDownloadModal';

interface ExitIntentPopupProps {
    pilgrimageId: string;
}

export default function ExitIntentPopup({ pilgrimageId }: ExitIntentPopupProps) {
    const [showModal, setShowModal] = useState(false);
    const [hasTriggered, setHasTriggered] = useState(false);

    useEffect(() => {
        // Validation: Only run on desktop (width > 768px assumed or mouse events)
        // Checks local storage to see if already dismissed/seen
        const STORAGE_KEY = `exit_intent_seen_${pilgrimageId}`;
        const hasSeen = localStorage.getItem(STORAGE_KEY);

        if (hasSeen) return;

        let timer: NodeJS.Timeout;

        // 1. Minimum Time on Site (e.g., 30 seconds)
        const isTimeMature = new Promise<void>((resolve) => {
            timer = setTimeout(() => {
                resolve();
            }, 30000); // 30 seconds
        });

        // 2. Mouse Leave Event
        const handleMouseLeave = async (e: MouseEvent) => {
            if (e.clientY <= 0 && !hasTriggered) {
                // User is trying to leave via top bar
                // Check if time is mature? Or maybe strict exit intent is enough?
                // Use a flag for time to avoid blocking the event, usually exit intent is immediate
                // but we want to avoid showing it to bouncers (0-5s).
                // Let's enforce a 10s minimum.

                // We check if the timer has passed implicitly by checking a ref or just strictly checking time since mount
                const timeOnPage = performance.now();
                if (timeOnPage < 10000) return; // Ignore early exits

                setHasTriggered(true);
                setShowModal(true);
                localStorage.setItem(STORAGE_KEY, 'true');
            }
        };

        document.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            document.removeEventListener('mouseleave', handleMouseLeave);
            clearTimeout(timer);
        };
    }, [pilgrimageId, hasTriggered]);

    // We control the modal via the "trigger" prop being null which defaults to the button,
    // but here we want to programmatically open it. 
    // Actually BrochureDownloadModal manages its own state via DialogTrigger.
    // We need to control it externally or wrap it.
    // Modified BrochureDownloadModal to accept 'open' and 'onOpenChange' props if we want controlled mode.
    // OR we can make this component Render nothing but trigger the modal via a hidden button click? 
    // Cleanest is to make BrochureDownloadModal accept controlled state.

    // For now, let's assume I will update BrochureDownloadModal to be controllable or use a ref.
    // Re-reading BrochureDownloadModal code:
    // It uses `const [open, setOpen] = useState(false);` internally.
    // I should modify BrochureDownloadModal to accept `open` prop.
    // However, Shadcn Dialog accepts `open` on the root.

    // Let's modify BrochureDownloadModal first to support controlled state.
    // But since I cannot modify it right now in this step, I will wrap it.

    // Actually, I can render the Dialog directly here reusing the content? 
    // Better to update BrochureDownloadModal.

    return (
        <BrochureDownloadModal
            pilgrimageId={pilgrimageId}
            forceOpen={showModal}
            onOpenChange={setShowModal}
            // Trigger can be null/empty div so it doesn't render a button
            trigger={<span className="hidden" />}
        />
    );
}
