"use client";

import { forwardRef, useCallback, useRef, useState, type InputHTMLAttributes } from 'react';
import PhoneInput, { getCountryCallingCode, isValidPhoneNumber, type Country } from 'react-phone-number-input';
import ptLabels from 'react-phone-number-input/locale/pt.json';
import enLabels from 'react-phone-number-input/locale/en.json';
import 'react-phone-number-input/style.css';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';

// The library's PT label is the formal "Brasil, República Federativa do".
const PT_LABELS = { ...ptLabels, BR: 'Brasil' };

// Most registrations come from Portugal and Brazil, so they sit on top of the list.
const PRIORITY: Country[] = ['PT', 'BR'];

// A realistic national example per country reads better than an empty box.
const PLACEHOLDERS: Partial<Record<Country, string>> = {
    PT: '912 345 678',
    BR: '(11) 91234-5678',
    ES: '612 34 56 78',
    FR: '06 12 34 56 78',
    IT: '312 345 6789',
    US: '(201) 555-0123',
    GB: '07400 123456',
    DE: '01512 3456789',
    CH: '078 123 45 67',
    AO: '923 123 456',
    MZ: '82 123 4567',
};

const EASE = [0.23, 1, 0.32, 1] as const;

// Pre-pick the country from the device language (pt-PT → PT, pt-BR → BR…).
const guessCountry = (fallback: Country): Country => {
    if (typeof navigator === 'undefined') return fallback;
    for (const tag of navigator.languages || [navigator.language]) {
        const region = tag?.split('-')[1]?.toUpperCase();
        if (!region) continue;
        try {
            getCountryCallingCode(region as Country);
            return region as Country;
        } catch {
            // Not a phone-numbering country: keep looking.
        }
    }
    return fallback;
};

type CountrySelectProps = {
    value?: Country;
    onChange: (value?: Country) => void;
    options: { value?: Country; label: string; divider?: boolean }[];
    iconComponent: React.ElementType;
    disabled?: boolean;
    onFocus?: () => void;
    onBlur?: () => void;
    'aria-label'?: string;
};

// A visible "flag +351 ⌄" chip with the native <select> stretched invisibly on
// top, so phones open their own country picker.
function CountryChip({ value, onChange, options, iconComponent: Icon, disabled, onFocus, onBlur, ...rest }: CountrySelectProps) {
    return (
        <div className="reg-phone-country">
            <Icon country={value} label="" />
            <span className="reg-phone-code">{value ? `+${getCountryCallingCode(value)}` : '+'}</span>
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
            <select
                value={value || 'ZZ'}
                onChange={(event) => onChange(event.target.value === 'ZZ' ? undefined : event.target.value as Country)}
                onFocus={onFocus}
                onBlur={onBlur}
                disabled={disabled}
                aria-label={rest['aria-label']}
            >
                {options.map((option, index) => option.divider
                    ? <option key={`divider-${index}`} disabled>──────────</option>
                    : (
                        <option key={option.value || 'ZZ'} value={option.value || 'ZZ'}>
                            {option.label}{option.value ? ` (+${getCountryCallingCode(option.value)})` : ''}
                        </option>
                    ))}
            </select>
        </div>
    );
}

// Big "satisfying" number entry: a real <input> (transparent) captures typing,
// paste and autofill, while a mirror renders each character with a soft
// blur-in and a custom blinking caret. The caret is kept at the end, like an
// OTP field, so the mirror always matches what is typed.
const DigitsInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function DigitsInput(
    { value, placeholder, onFocus, onBlur, className, ...rest },
    ref,
) {
    const reduced = useReducedMotion();
    const [focused, setFocused] = useState(false);
    const innerRef = useRef<HTMLInputElement | null>(null);
    const text = String(value ?? '');

    const setRefs = useCallback((el: HTMLInputElement | null) => {
        innerRef.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
    }, [ref]);

    const caretToEnd = () => {
        const el = innerRef.current;
        if (!el) return;
        const end = el.value.length;
        if (el.selectionStart !== end || el.selectionEnd !== end) el.setSelectionRange(end, end);
    };

    return (
        <div className={`reg-digits ${className || ''}`}>
            <input
                {...rest}
                ref={setRefs}
                value={value}
                className="reg-digits-input"
                onFocus={(event) => { setFocused(true); onFocus?.(event); requestAnimationFrame(caretToEnd); }}
                onBlur={(event) => { setFocused(false); onBlur?.(event); }}
                onSelect={caretToEnd}
                onClick={caretToEnd}
            />
            <span className="reg-digits-mirror" aria-hidden="true">
                {!text && focused && <Caret reduced={!!reduced} />}
                {text ? (
                    <AnimatePresence initial={false} mode="popLayout">
                        {text.split('').map((char, index) => (
                            <motion.span
                                key={`${index}-${char}`}
                                className={/\d/.test(char) ? 'reg-digit' : 'reg-digit-sep'}
                                initial={reduced ? false : { opacity: 0, y: 12, scale: 0.96, filter: 'blur(6px)' }}
                                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                                exit={reduced ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98, filter: 'blur(3px)' }}
                                transition={reduced ? { duration: 0 } : { duration: 0.22, ease: EASE }}
                            >
                                {char}
                            </motion.span>
                        ))}
                    </AnimatePresence>
                ) : (
                    <span className="reg-digits-placeholder">{placeholder}</span>
                )}
                {text && focused && <Caret reduced={!!reduced} />}
            </span>
        </div>
    );
});

function Caret({ reduced }: { reduced: boolean }) {
    return (
        <motion.span
            className="reg-digits-caret"
            initial={{ opacity: 1 }}
            animate={reduced ? { opacity: 1 } : { opacity: [1, 1, 0, 0] }}
            transition={reduced ? { duration: 0 } : { duration: 1.06, times: [0, 0.5, 0.5, 1], repeat: Infinity, ease: 'linear' }}
        />
    );
}

type Props = {
    id?: string;
    value?: string;
    onChange: (value?: string) => void;
    isEn?: boolean;
    autoFocus?: boolean;
    fallbackCountry?: Country;
    variant?: 'field' | 'hero';
};

export default function RegistrationPhoneInput({ id, value, onChange, isEn = false, autoFocus = false, fallbackCountry = 'BR', variant = 'field' }: Props) {
    const [defaultCountry] = useState<Country>(() => guessCountry(fallbackCountry));
    const [country, setCountry] = useState<Country | undefined>(defaultCountry);
    const reduced = useReducedMotion();
    const isHero = variant === 'hero';
    const valid = !!value && isValidPhoneNumber(value);

    return (
        <div className={isHero ? 'reg-phone-hero' : undefined}>
            <PhoneInput
                id={id}
                value={value}
                onChange={onChange}
                defaultCountry={defaultCountry}
                // Coming back to this step: show "912 345 678", not "+351 912 345 678".
                initialValueFormat="national"
                onCountryChange={setCountry}
                labels={isEn ? enLabels : PT_LABELS}
                countryOptionsOrder={[...PRIORITY, '|', '...']}
                countrySelectComponent={CountryChip}
                countrySelectProps={{ 'aria-label': isEn ? 'Country code' : 'Indicativo do país' }}
                inputComponent={isHero ? DigitsInput : undefined}
                smartCaret={!isHero}
                addInternationalOption={false}
                focusInputOnCountrySelection
                placeholder={(country && PLACEHOLDERS[country]) || (isEn ? 'Phone number' : 'Número de telemóvel')}
                autoComplete="tel"
                enterKeyHint="go"
                autoFocus={autoFocus}
                limitMaxLength
            />
            {isHero && (
                <AnimatePresence>
                    {valid && (
                        <motion.span
                            className="reg-phone-ok"
                            initial={reduced ? false : { opacity: 0, scale: 0.4 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.6 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                            aria-hidden="true"
                        >
                            <Check className="h-4 w-4" strokeWidth={3} />
                        </motion.span>
                    )}
                </AnimatePresence>
            )}
        </div>
    );
}
