import { useState, useRef, useEffect } from 'react'
import { useTranslation } from '../context/TranslationContext'
import { cn } from '../lib/cn'

/**
 * Language Toggle Component
 * 
 * Dropdown to select between English and Hindi
 * Designed for easy understanding by uneducated users
 */
export function LanguageToggle({ className, variant = 'default', onLanguageChange }) {
  const { language, setLanguage, isHindi, isEnglish } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef(null)

  console.log('[LanguageToggle] Current language:', language, 'isHindi:', isHindi, 'isEnglish:', isEnglish)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleLanguageSelect = (lang) => {
    console.log('[LanguageToggle] Language selected:', lang)
    setLanguage(lang)
    setIsOpen(false)
    // Call the callback if provided (e.g., to close mobile menu)
    if (onLanguageChange) {
      onLanguageChange(lang)
    }
  }

  const languages = [
    {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      flag: '🇬🇧',
    },
    {
      code: 'hi',
      name: 'Hindi',
      nativeName: 'हिंदी',
      flag: '🇮🇳',
    },
  ]

  const currentLang = languages.find((l) => l.code === language) || languages[0]

  // Default variant (for mobile menu) - Dropdown design
  if (variant === 'default') {
    return (
      <div ref={dropdownRef} className={cn('relative', className)}>
        <button
          type="button"
          onClick={() => {
            console.log('[LanguageToggle] Dropdown button clicked, isOpen:', isOpen)
            setIsOpen(!isOpen)
          }}
          className={cn(
            'flex w-full items-center justify-between gap-3 rounded-xl border border-muted/60 bg-white px-4 py-3 text-sm font-medium transition-all',
            'hover:border-brand/50 hover:bg-brand/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
            isOpen && 'border-brand bg-brand/5'
          )}
          aria-label="Select language"
          aria-expanded={isOpen}
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xl">{currentLang.flag}</span>
            <div className="flex flex-col items-start">
              <span className="text-sm font-semibold text-surface-foreground">{currentLang.nativeName}</span>
              <span className="text-xs text-muted-foreground">{currentLang.name}</span>
            </div>
          </div>
          <svg
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-180'
            )}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-muted/60 bg-white shadow-lg">
            {languages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleLanguageSelect(lang.code)}
                className={cn(
                  'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors first:rounded-t-xl last:rounded-b-xl',
                  'hover:bg-brand/10 focus:bg-brand/10 focus:outline-none',
                  currentLang.code === lang.code && 'bg-brand/5'
                )}
              >
                <span className="text-xl">{lang.flag}</span>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-semibold text-surface-foreground">{lang.nativeName}</span>
                  <span className="text-xs text-muted-foreground">{lang.name}</span>
                </div>
                {currentLang.code === lang.code && (
                  <svg className="ml-auto h-5 w-5 text-brand" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Compact variant (for desktop nav) - Toggle Switch design
  if (variant === 'compact') {
    const isEnglishSelected = currentLang.code === 'en'
    
    return (
      <div ref={dropdownRef} className={cn('relative', className)}>
        {/* Toggle Switch */}
        <div className="relative flex items-center w-[160px] h-12 rounded-full bg-gray-200 overflow-hidden cursor-pointer">
          {/* English Section */}
          <button
            type="button"
            onClick={() => handleLanguageSelect('en')}
            className={cn(
              'flex-1 h-full flex items-center justify-center transition-all duration-300 z-10',
              isEnglishSelected ? 'bg-blue-600' : 'bg-transparent'
            )}
          >
            <span className={cn(
              'text-sm font-semibold transition-colors duration-300',
              isEnglishSelected ? 'text-white' : 'text-gray-600'
            )}>
              English
            </span>
          </button>
          
          {/* Hindi Section */}
          <button
            type="button"
            onClick={() => handleLanguageSelect('hi')}
            className={cn(
              'flex-1 h-full flex items-center justify-center transition-all duration-300 z-10',
              !isEnglishSelected ? 'bg-gray-300' : 'bg-transparent'
            )}
          >
            <span className={cn(
              'text-sm font-semibold transition-colors duration-300',
              !isEnglishSelected ? 'text-black' : 'text-gray-600'
            )}>
              हिंदी
            </span>
          </button>
          
          {/* Toggle Button (White Circle) */}
          <div
            className={cn(
              'absolute top-1 left-1 w-10 h-10 bg-white rounded-full shadow-lg transition-transform duration-300 z-20',
              isEnglishSelected ? 'translate-x-0' : 'translate-x-[80px]'
            )}
          />
        </div>
      </div>
    )
  }

  // Icon only variant - Dropdown design
  if (variant === 'icon') {
    return (
      <div ref={dropdownRef} className={cn('relative', className)}>
        <button
          type="button"
          onClick={() => {
            console.log('[LanguageToggle] Icon dropdown button clicked, isOpen:', isOpen)
            setIsOpen(!isOpen)
          }}
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-2xl transition-all',
            'bg-white/10 text-white hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50',
            isOpen && 'bg-white/20'
          )}
          aria-label="Select language"
          aria-expanded={isOpen}
          title={`Current: ${currentLang.nativeName} - Click to change`}
        >
          <span className="text-lg">{currentLang.flag}</span>
        </button>

        {isOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 min-w-[160px] rounded-xl border border-white/20 bg-white shadow-xl">
            {languages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleLanguageSelect(lang.code)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors first:rounded-t-xl last:rounded-b-xl',
                  'hover:bg-brand/10 focus:bg-brand/10 focus:outline-none',
                  currentLang.code === lang.code && 'bg-brand/5'
                )}
              >
                <span className="text-lg">{lang.flag}</span>
                <div className="flex flex-col items-start flex-1">
                  <span className="text-sm font-semibold text-surface-foreground">{lang.nativeName}</span>
                  <span className="text-xs text-muted-foreground">{lang.name}</span>
                </div>
                {currentLang.code === lang.code && (
                  <svg className="h-4 w-4 text-brand" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return null
}

