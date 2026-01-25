import { EMAIL_REGISTRY } from '../../../lib/email-registry';
import { useMemo } from 'react';
import { X } from 'lucide-react';

interface EmailPreviewModalProps {
    emailId: string | null;
    isOpen: boolean;
    onClose: () => void;
}

const EMAIL_CATALOG = Object.entries(EMAIL_REGISTRY).map(([id, entry]) => ({
    id,
    label: entry.label,
    category: 'System',
    recipient: entry.recipient,
    trigger: entry.description,
    render: entry.render
}));

export default function EmailPreviewModal({ emailId, isOpen, onClose }: EmailPreviewModalProps) {
    const emailDef = useMemo(() =>
        EMAIL_CATALOG.find((e) => e.id === emailId),
        [emailId]);

    const htmlContent = useMemo(() => {
        if (!emailDef) return '';

        try {
            const result = emailDef.render(undefined);
            return result.html || '<div>No HTML returned</div>';

        } catch (err: any) {
            console.error('Error rendering email preview:', err);
            return `<div style="padding: 20px; color: red;">Erro ao gerar preview: ${err.message}</div>`;
        }
    }, [emailDef]);

    if (!emailDef || !isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal Content */}
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-slide-up">

                {/* Header */}
                <div className="p-6 pb-4 border-b border-gray-100 bg-white flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-serif font-bold text-gray-900 flex items-center gap-3">
                            Preview: {emailDef.label}
                            <span className="text-xs font-sans font-normal px-2 py-1 rounded bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wide">
                                {emailDef.category}
                            </span>
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">
                            Audience: <span className="font-medium text-gray-700">{emailDef.recipient}</span> •
                            Trigger: <span className="font-medium text-gray-700">{emailDef.trigger}</span>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Iframe Container */}
                <div className="flex-1 w-full bg-gray-100 p-4 overflow-hidden relative flex justify-center">
                    <div className="h-full w-full max-w-[650px] bg-white shadow-lg rounded-sm overflow-hidden border border-gray-200">
                        <iframe
                            srcDoc={htmlContent}
                            className="w-full h-full border-none bg-white"
                            title="Email Preview"
                            sandbox="allow-same-origin"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
