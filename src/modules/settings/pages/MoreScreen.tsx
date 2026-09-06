import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@app/providers/LanguageProvider';
import type { SupportedLanguage } from '@config/app.config';
import { APP_CONFIG } from '@config/app.config';
import { useAuth } from '@modules/auth/context/AuthContext';
import { authService } from '@modules/auth/services/authService';
import { PinDialog } from '@shared/components/pin-dialog/PinDialog';
import { EDITOR_LOGIN_PATH, MEMBER_MANAGEMENT_PATH, AUDIT_LOG_PATH } from '@app/router/routes.config';
import { ROLE_LABELS } from '@modules/roles-permissions/config/roleLabels.config';
import { ApiError } from '@shared/lib/functionsClient';

/**
 * Each language's name is intentionally shown in its OWN script (not
 * translated through `t()`), matching the Welcome Screen's language
 * picker — a devotee looking for Hindi needs to recognise "हिन्दी"
 * regardless of which language the interface currently happens to be in.
 */
const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  gu: 'ગુજરાતી',
  hi: 'हिन्दी',
  en: 'English',
};

/**
 * More / Settings route (SDD 8.1 MainLayout > RouteOutlet > MoreScreen ->
 * Profile / Language / FontSize / Theme / About / Contact / Help /
 * Logout). Bottom Nav "More" destination.
 *
 * Task 4 scope: only "Change Language" (FR-SET-003/004, SRS 19.5) is
 * wired up here, since it directly exercises the language-switching
 * requirement. The remaining More-menu items listed in SRS 19.3/24.15
 * (My Profile, Font Size, Theme, About Temple, Contact Temple, Developer
 * Information, Privacy Policy, Terms & Conditions, Help & FAQ, Logout)
 * belong to the Settings module task and are intentionally not built yet.
 * Task 9 adds the Account section: Member ID display, Editor Login /
 * Exit Editor Mode, Change PIN, Logout (FR-AUTH/FR-MEM), and links into
 * Member Management / Audit Log for roles permitted to see them (SRS
 * Chapter 13/18). Font Size, Theme, About Temple, Contact Temple,
 * Developer Information, Privacy Policy, Terms & Conditions, and Help &
 * FAQ remain out of scope for this task.
 */
export function MoreScreen() {
  const { language, setLanguage, t } = useLanguage();
  const { member, editorSession, isEditorMode, hasPermission, exitEditorMode, logout } = useAuth();
  const navigate = useNavigate();

  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [changePinError, setChangePinError] = useState<string | null>(null);
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [changePinStep, setChangePinStep] = useState<'current' | 'new'>('current');
  const [pendingCurrentPin, setPendingCurrentPin] = useState('');

  const handleChangePinSubmit = async (pin: string) => {
    setIsChangingPin(true);
    setChangePinError(null);
    try {
      if (changePinStep === 'current') {
        setPendingCurrentPin(pin);
        setChangePinStep('new');
        return;
      }
      await authService.changeOwnPin(pendingCurrentPin, pin);
      setIsChangePinOpen(false);
      setChangePinStep('current');
      setPendingCurrentPin('');
    } catch (error) {
      setChangePinError(error instanceof ApiError ? error.message : t('registration.errors.generic'));
    } finally {
      setIsChangingPin(false);
    }
  };

  return (
    <section className="flex flex-1 flex-col gap-6 px-1 py-6">
      <h1 className="text-center text-app-xl font-bold text-saffron">
        {t('nav.more')}
      </h1>

      <div className="rounded-card border border-black/10 bg-cream/40 p-4 dark:border-white/10 dark:bg-surface-dark">
        <h2 className="mb-3 text-app-base font-semibold text-text-primary">{t('settings.account')}</h2>
        {member && (
          <p className="mb-2 text-app-sm text-text-secondary">
            {member.fullName} · {member.memberId}
            {isEditorMode && editorSession && ` · ${ROLE_LABELS[editorSession.role]}`}
          </p>
        )}

        <div className="flex flex-col gap-2">
          {!isEditorMode ? (
            <button
              type="button"
              onClick={() => navigate(EDITOR_LOGIN_PATH)}
              className="w-full rounded-card border border-black/10 px-4 py-3 text-left text-app-base text-text-primary dark:border-white/10"
            >
              {t('settings.editorLogin')}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={exitEditorMode}
                className="w-full rounded-card border border-black/10 px-4 py-3 text-left text-app-base text-text-primary dark:border-white/10"
              >
                {t('settings.exitEditorMode')}
              </button>
              <button
                type="button"
                onClick={() => setIsChangePinOpen(true)}
                className="w-full rounded-card border border-black/10 px-4 py-3 text-left text-app-base text-text-primary dark:border-white/10"
              >
                {t('settings.changePin')}
              </button>
            </>
          )}

          {hasPermission('member_management', 'search_members') && (
            <button
              type="button"
              onClick={() => navigate(MEMBER_MANAGEMENT_PATH)}
              className="w-full rounded-card border border-black/10 px-4 py-3 text-left text-app-base text-text-primary dark:border-white/10"
            >
              {t('memberManagement.title')}
            </button>
          )}

          {(hasPermission('audit_log', 'view_limited') || hasPermission('audit_log', 'view_full')) && (
            <button
              type="button"
              onClick={() => navigate(AUDIT_LOG_PATH)}
              className="w-full rounded-card border border-black/10 px-4 py-3 text-left text-app-base text-text-primary dark:border-white/10"
            >
              {t('auditLog.title')}
            </button>
          )}

          <button
            type="button"
            onClick={logout}
            className="w-full rounded-card border border-danger px-4 py-3 text-left text-app-base font-semibold text-danger"
          >
            {t('settings.logout')}
          </button>
        </div>
      </div>

      {isChangePinOpen && (
        <PinDialog
          title={changePinStep === 'current' ? t('settings.currentPinPrompt') : t('settings.newPinPrompt')}
          onSubmit={handleChangePinSubmit}
          onCancel={() => {
            setIsChangePinOpen(false);
            setChangePinStep('current');
            setChangePinError(null);
          }}
          isSubmitting={isChangingPin}
          errorMessage={changePinError}
        />
      )}

      <div className="rounded-card border border-black/10 bg-cream/40 p-4 dark:border-white/10 dark:bg-surface-dark">
        <h2 className="mb-3 text-app-base font-semibold text-text-primary">
          {t('settings.changeLanguage')}
        </h2>
        <div
          role="radiogroup"
          aria-label={t('settings.changeLanguage')}
          className="flex flex-col gap-2"
        >
          {APP_CONFIG.supportedLanguages.map((code) => (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={language === code}
              onClick={() => setLanguage(code)}
              className={`w-full rounded-card border px-4 py-3 text-left text-app-base transition-colors ${
                language === code
                  ? 'border-saffron bg-surface-light text-text-primary dark:bg-surface-light/10'
                  : 'border-black/10 text-text-secondary dark:border-white/10'
              }`}
            >
              {LANGUAGE_NAMES[code]}
            </button>
          ))}
        </div>
      </div>

      <p className="text-center text-app-sm text-text-secondary">
        {t('settings.languageSectionHint')}
      </p>
    </section>
  );
}
